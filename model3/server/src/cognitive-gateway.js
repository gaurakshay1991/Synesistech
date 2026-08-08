import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import {
  DEFAULT_COGNITIVE_CONTROLS,
  normalizeControls,
  informationFlowDecision,
  deterministicDecision,
  probabilisticDecision,
  requiresHumanApproval,
  redactForExternalModel,
  operationalEvent
} from './cognitive-core.js';

const externalPort = Number(process.env.PORT || 3000);
const internalPort = Number(process.env.SYNESIS_INTERNAL_PORT || (externalPort >= 65535 ? externalPort - 1 : externalPort + 1));
if (internalPort === externalPort || internalPort < 1024 || internalPort > 65535) throw new Error('SYNESIS_INTERNAL_PORT must be a different valid TCP port.');

// Start the existing validated SYNESIS v5 runtime unchanged on a loopback-only internal port.
process.env.PORT = String(internalPort);
await import('./index.js');
const [{ config }, db, live] = await Promise.all([
  import('./config.js'),
  import('./db.js'),
  import('./live-intelligence.js')
]);
process.env.PORT = String(externalPort);

const openai = config.openaiKey ? new OpenAI({ apiKey: config.openaiKey, timeout: 90_000, maxRetries: 1 }) : null;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cognitiveHtml = path.resolve(__dirname, '../../client/dist/cognitive-console.html');
const transientMemory = new Map();
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 180, standardHeaders: true, legacyHeaders: false }));

const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const safeString = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const safeArray = (value, max = 8) => Array.isArray(value) ? value.map(item => safeString(item, 200)).filter(Boolean).slice(0, max) : [];

function memoryKey(user, scope) {
  return `${user.organizationId}:${user.id}:${scope || 'standalone'}`;
}

function cleanupTransientMemory() {
  const now = Date.now();
  for (const [key, entries] of transientMemory.entries()) {
    const liveEntries = entries.filter(entry => entry.expiresAt > now);
    if (liveEntries.length) transientMemory.set(key, liveEntries);
    else transientMemory.delete(key);
  }
}

function putTransientMemory(user, scope, controls, record) {
  cleanupTransientMemory();
  const key = memoryKey(user, scope);
  const entries = transientMemory.get(key) || [];
  const ttl = controls.transientMemoryTtlMinutes * 60_000;
  entries.unshift({ ...record, expiresAt: Date.now() + ttl });
  transientMemory.set(key, entries.slice(0, 20));
}

function getTransientMemory(user, scope) {
  cleanupTransientMemory();
  return (transientMemory.get(memoryKey(user, scope)) || []).map(({ expiresAt, ...entry }) => ({ ...entry, expiresAt: new Date(expiresAt).toISOString() }));
}

async function internalJson(req, pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (req.headers.cookie) headers.cookie = req.headers.cookie;
  if (req.headers.authorization) headers.authorization = req.headers.authorization;
  const response = await fetch(`http://127.0.0.1:${internalPort}${pathname}`, { ...options, headers });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text || `HTTP ${response.status}` }; }
  return { ok: response.ok, status: response.status, body };
}

async function requireSession(req, res, next) {
  try {
    const session = await internalJson(req, '/api/auth/session');
    if (!session.ok || !session.body?.user) return res.status(session.status || 401).json({ error: session.body?.error || 'Login required.' });
    req.synesisUser = session.body.user;
    req.orgId = session.body.user.organizationId;
    next();
  } catch (error) {
    res.status(503).json({ error: 'Core SYNESIS runtime is not ready.', detail: config.production ? undefined : error.message });
  }
}

async function controlsFor(orgId) {
  const state = await db.getState(orgId);
  return normalizeControls(state.cognitiveControl || DEFAULT_COGNITIVE_CONTROLS);
}

async function saveControls(orgId, controls) {
  await db.mutateState(orgId, state => {
    state.cognitiveControl = normalizeControls(controls);
    return state;
  });
  return controlsFor(orgId);
}

function scopedEvidenceSummary({ state, document }) {
  if (document) {
    const analysis = document.analysis || {};
    return {
      scope: 'single-document',
      documentId: document.id,
      title: document.title,
      matter: document.matter,
      jurisdiction: document.jurisdiction,
      overallRisk: analysis.overall_risk || document.overallRisk || 'Unassessed',
      findings: (analysis.findings || []).slice(0, 12).map(item => ({
        category: item.category,
        risk: item.risk_level || item.risk,
        issue: item.issue || item.title,
        clause: item.clause_reference,
        confidence: item.confidence || item.confidence_score
      })),
      neuroSymbolic: {
        rulesFired: analysis.neuro_symbolic?.symbolic?.rules_fired?.length || 0,
        contradictions: analysis.neuro_symbolic?.contradictions?.length || 0
      }
    };
  }
  const graph = state?.graph || { nodes: [], edges: [] };
  return {
    scope: 'institution',
    metrics: state?.metrics || {},
    graph: { nodes: graph.nodes?.length || 0, edges: graph.edges?.length || 0 },
    decisionsPending: (state?.decisions || []).filter(item => ['Pending', 'Challenge', 'Deferred'].includes(item.status)).length,
    openRegulatoryUpdates: (state?.regulatoryUpdates || []).filter(item => item.status !== 'Verified and mapped').length
  };
}

async function externalIntelligence({ question, user, controls, flow, document, state, jurisdiction, regulator }) {
  if (!flow.allowModel || !openai) return { used: false, reason: !openai ? 'OpenAI connection is not configured.' : 'External model use is blocked by information-flow policy.', answer: null, citations: [], model: null, liveWebUsed: false };
  const safeQuestion = redactForExternalModel(question);

  if (flow.allowResearch) {
    try {
      const result = await live.liveLegalResearch({
        client: openai,
        model: config.openaiLiveModel,
        question: safeQuestion,
        jurisdiction: jurisdiction || document?.jurisdiction || '',
        regulator: regulator || '',
        document: document ? { ...document, sourceText: redactForExternalModel(document.sourceText || '') } : null,
        organisationContext: document ? null : scopedEvidenceSummary({ state, document: null }),
        preferredDomains: flow.allowedDomains,
        purpose: 'governed cognitive-control-plane decision support'
      });
      return { used: true, answer: result.answer, citations: result.citations || [], model: result.model, liveWebUsed: true, runId: result.runId, researchedAt: result.researchedAt };
    } catch (error) {
      return { used: false, reason: `Live authority research failed: ${error.message}`, answer: null, citations: [], model: config.openaiLiveModel, liveWebUsed: false };
    }
  }

  const evidence = scopedEvidenceSummary({ state, document });
  const response = await openai.responses.create({
    model: config.openaiModel,
    store: false,
    max_output_tokens: 1800,
    input: `You are the governed analytical model inside SYNESIS Cognitive Control Plane. You may analyse and recommend but you have no authority to execute actions. Use only the supplied isolated evidence. Do not expose hidden chain-of-thought. Return a concise decision-support answer with conclusion, evidence, uncertainty, contrary considerations and next governed action. Do not invent monetary exposure.\n\nQUESTION: ${safeQuestion}\n\nISOLATED EVIDENCE: ${JSON.stringify(evidence)}`
  });
  return { used: true, answer: response.output_text, citations: [], model: config.openaiModel, liveWebUsed: false };
}

async function runCognitive(req, body, emit = () => {}) {
  const runId = crypto.randomUUID();
  const user = req.synesisUser;
  const controls = await controlsFor(req.orgId);
  const question = safeString(body.question, 6000);
  if (question.length < 3) throw Object.assign(new Error('A substantive natural-language request is required.'), { status: 400 });

  const scope = safeString(body.scope || body.documentId || 'standalone', 180);
  const dataClass = ['public', 'internal', 'confidential', 'restricted'].includes(String(body.dataClass || '').toLowerCase()) ? String(body.dataClass).toLowerCase() : 'internal';
  const requestedAction = safeString(body.requestedAction, 1000);
  const mode = ['governed', 'deterministic', 'probabilistic'].includes(body.mode) ? body.mode : 'governed';
  const requestedOptions = safeArray(body.options, controls.maxHypotheses);
  const preferredDomains = safeArray(body.preferredDomains, 20).map(value => value.toLowerCase());

  emit(operationalEvent('intake', 'Request accepted into an isolated cognitive run.', { runId, scope, dataClass, mode }));
  if (controls.killSwitch) throw Object.assign(new Error('Cognitive kill switch is active. No cognitive run may proceed.'), { status: 423 });

  let document = null;
  let state = null;
  if (body.documentId) {
    document = await db.getDocument(req.orgId, safeString(body.documentId, 120), true);
    if (!document) throw Object.assign(new Error('Selected document was not found in this organisation.'), { status: 404 });
    emit(operationalEvent('scope', 'Single-document isolation locked. Other matter memory is excluded.', { documentId: document.id }));
  } else {
    state = await db.getState(req.orgId);
    emit(operationalEvent('scope', 'Institution-scoped state loaded. Document source text is not included.', { graphNodes: state.graph?.nodes?.length || 0, graphEdges: state.graph?.edges?.length || 0 }));
  }

  const requestedDestinations = ['openai', 'official-web'];
  const flow = informationFlowDecision({ controls, dataClass, requestedDestinations, preferredDomains });
  emit(operationalEvent('firewall', flow.permitted ? 'Information-flow policy evaluated.' : 'Information-flow policy blocked one or more requested destinations.', {
    allowModel: flow.allowModel,
    allowResearch: flow.allowResearch,
    blockedDestinations: flow.blockedDestinations
  }));

  const deterministic = deterministicDecision({ question, requestedAction, state: document ? null : state, document, controls });
  emit(operationalEvent('deterministic', 'Deterministic policy/risk baseline completed.', { riskLevel: deterministic.riskLevel, riskScore: deterministic.riskScore, evidenceQuality: deterministic.evidenceQuality }));

  const probabilistic = probabilisticDecision({ deterministic, controls, requestedOptions });
  emit(operationalEvent('probabilistic', 'Competing options normalised into a governed analytical distribution.', { selected: probabilistic.selected, uncertainty: probabilistic.uncertainty, abstained: probabilistic.abstained }));

  const effectiveMode = controls.forceDeterministic ? 'deterministic' : mode;
  let intelligence = { used: false, answer: null, citations: [], model: null, liveWebUsed: false, reason: 'Deterministic mode selected.' };
  if (effectiveMode !== 'deterministic') {
    intelligence = await externalIntelligence({
      question,
      user,
      controls,
      flow,
      document,
      state,
      jurisdiction: safeString(body.jurisdiction, 100),
      regulator: safeString(body.regulator, 140)
    });
    emit(operationalEvent('model-router', intelligence.used ? 'Governed model/research role completed.' : 'External intelligence was not used.', {
      model: intelligence.model,
      liveWebUsed: intelligence.liveWebUsed,
      citationCount: intelligence.citations?.length || 0,
      reason: intelligence.reason
    }));
  }

  const approval = requiresHumanApproval({ riskLevel: deterministic.riskLevel, requestedAction, controls, userRole: user.role });
  const confidenceTooLow = probabilistic.abstained;
  let disposition = deterministic.recommendation;
  if (confidenceTooLow) disposition = 'Abstain and obtain additional evidence before a decision.';
  if (approval.required) disposition = `${disposition} Human approval is mandatory before any consequential action.`;
  emit(operationalEvent('governor', 'Final deterministic governance gate evaluated.', { approvalRequired: approval.required, disposition, effectiveMode }));

  const result = {
    runId,
    product: 'SYNESIS Cognitive Control Plane',
    systemType: 'Governed agentic / neuro-symbolic decision-intelligence system — not conscious or sentient',
    createdAt: new Date().toISOString(),
    scope: { type: document ? 'single-document' : 'institution', key: scope, documentId: document?.id || null, crossMatterMemoryUsed: false },
    mode: { requested: mode, effective: effectiveMode, deterministicForcedByPolicy: controls.forceDeterministic },
    informationFlow: {
      dataClass,
      permitted: flow.permitted,
      externalModelAllowed: flow.allowModel,
      externalResearchAllowed: flow.allowResearch,
      blockedDestinations: flow.blockedDestinations,
      policyReasons: flow.reasons
    },
    deterministic,
    probabilistic,
    governor: { ...approval, disposition, safeMode: controls.safeMode, killSwitch: controls.killSwitch },
    intelligence,
    neuroSymbolic: scopedEvidenceSummary({ state, document }),
    transientMemory: { ttlMinutes: controls.transientMemoryTtlMinutes, durablePromotionAutomatic: false },
    exposureDiscipline: 'No monetary exposure is created by the Cognitive Control Plane unless underlying document/current-law analysis contains a verified monetary basis. Unquantified risks remain explicitly unquantified.',
    hiddenReasoningDisclosure: 'Private chain-of-thought is never exposed. The console emits operational stages, evidence provenance, policy outcomes and concise rationale only.'
  };

  putTransientMemory(user, scope, controls, {
    runId,
    createdAt: result.createdAt,
    riskLevel: deterministic.riskLevel,
    selected: probabilistic.selected,
    disposition,
    documentId: document?.id || null,
    durable: false
  });

  await db.logAudit({
    orgId: req.orgId,
    user,
    action: 'cognitive.run.completed',
    entityType: document ? 'document' : 'organization',
    entityId: document?.id || req.orgId,
    metadata: {
      runId,
      mode: effectiveMode,
      dataClass,
      riskLevel: deterministic.riskLevel,
      riskScore: deterministic.riskScore,
      selectedOption: probabilistic.selected,
      selectedProbability: probabilistic.selectedProbability,
      abstained: probabilistic.abstained,
      approvalRequired: approval.required,
      externalModelUsed: intelligence.used,
      liveWebUsed: intelligence.liveWebUsed,
      citations: intelligence.citations?.map(item => item.url).slice(0, 20) || [],
      crossMatterMemoryUsed: false
    }
  });

  return result;
}

app.get('/api/cognitive/health', (req, res) => res.json({
  ok: true,
  product: 'SYNESIS Cognitive Control Plane',
  version: '6.0.0-control-plane',
  coreRuntime: `loopback:${internalPort}`,
  externalPort,
  openaiConfigured: Boolean(openai),
  sentienceClaim: false,
  time: new Date().toISOString()
}));

app.get('/api/cognitive/control-plane', requireSession, asyncRoute(async (req, res) => {
  const controls = await controlsFor(req.orgId);
  const state = await db.getState(req.orgId);
  res.json({
    controls,
    user: req.synesisUser,
    system: {
      product: 'SYNESIS Cognitive Control Plane',
      governor: 'deterministic',
      probabilisticDecisioning: true,
      transientWorkingMemory: true,
      persistentNeuroSymbolicGraph: true,
      graphNodes: state.graph?.nodes?.length || 0,
      graphEdges: state.graph?.edges?.length || 0,
      liveAuthorityResearch: Boolean(openai && controls.externalResearch),
      externalModels: Boolean(openai && controls.externalModels)
    }
  });
}));

app.patch('/api/cognitive/control-plane', requireSession, asyncRoute(async (req, res) => {
  if (!['admin', 'management'].includes(String(req.synesisUser.role).toLowerCase())) return res.status(403).json({ error: 'Only Administrator or Management may change cognitive control policy.' });
  const current = await controlsFor(req.orgId);
  const allowedKeys = new Set(Object.keys(DEFAULT_COGNITIVE_CONTROLS));
  const patch = {};
  for (const [key, value] of Object.entries(req.body || {})) if (allowedKeys.has(key) && key !== 'schemaVersion') patch[key] = value;
  const controls = await saveControls(req.orgId, { ...current, ...patch });
  await db.logAudit({ orgId: req.orgId, user: req.synesisUser, action: 'cognitive.controls.updated', entityType: 'organization', entityId: req.orgId, metadata: { changedKeys: Object.keys(patch), controls } });
  res.json({ controls });
}));

app.post('/api/cognitive/run', requireSession, asyncRoute(async (req, res) => {
  const result = await runCognitive(req, req.body || {});
  res.json(result);
}));

app.post('/api/cognitive/stream', requireSession, asyncRoute(async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const send = payload => res.write(`data: ${JSON.stringify(payload)}\n\n`);
  try {
    const result = await runCognitive(req, req.body || {}, event => send({ type: 'event', event }));
    send({ type: 'result', result });
  } catch (error) {
    send({ type: 'error', error: error.status && error.status < 500 ? error.message : 'Cognitive run could not be completed.' });
  } finally {
    res.end();
  }
}));

app.get('/api/cognitive/memory', requireSession, asyncRoute(async (req, res) => {
  const controls = await controlsFor(req.orgId);
  const scope = safeString(req.query.scope || 'standalone', 180);
  res.json({ scope, ttlMinutes: controls.transientMemoryTtlMinutes, durablePromotionAutomatic: false, entries: getTransientMemory(req.synesisUser, scope) });
}));

app.post('/api/cognitive/memory/promote', requireSession, asyncRoute(async (req, res) => {
  const controls = await controlsFor(req.orgId);
  if (!controls.allowMemoryPromotion) return res.status(403).json({ error: 'Durable memory promotion is disabled by cognitive-control policy.' });
  if (!['admin', 'management', 'legal', 'compliance', 'risk'].includes(String(req.synesisUser.role).toLowerCase())) return res.status(403).json({ error: 'Your role cannot promote cognitive working memory.' });
  const scope = safeString(req.body?.scope || 'standalone', 180);
  const runId = safeString(req.body?.runId, 120);
  const entry = getTransientMemory(req.synesisUser, scope).find(item => item.runId === runId);
  if (!entry) return res.status(404).json({ error: 'Transient run was not found or has expired.' });
  await db.mutateState(req.orgId, state => {
    state.cognitiveMemory ||= [];
    state.cognitiveMemory.unshift({ ...entry, promotedAt: new Date().toISOString(), promotedBy: req.synesisUser.email, scope, humanValidated: true });
    state.cognitiveMemory = state.cognitiveMemory.slice(0, 250);
    return state;
  });
  await db.logAudit({ orgId: req.orgId, user: req.synesisUser, action: 'cognitive.memory.promoted', entityType: 'cognitive_run', entityId: runId, metadata: { scope, humanValidated: true } });
  res.json({ ok: true, runId, scope, humanValidated: true });
}));

app.get('/cognitive', asyncRoute(async (req, res) => {
  try {
    const html = await fs.readFile(cognitiveHtml, 'utf8');
    res.type('html').send(html);
  } catch {
    res.status(503).type('text').send('Cognitive Console frontend has not been built yet.');
  }
}));

app.use((error, req, res, next) => {
  console.error('[cognitive-gateway]', error);
  const status = error.status || 500;
  res.status(status).json({ error: status >= 500 ? 'Cognitive request could not be completed.' : error.message });
});

function proxyToCore(req, res) {
  const headers = { ...req.headers, host: req.headers.host };
  const proxy = http.request({ hostname: '127.0.0.1', port: internalPort, path: req.url, method: req.method, headers }, upstream => {
    res.writeHead(upstream.statusCode || 502, upstream.headers);
    upstream.pipe(res);
  });
  proxy.on('error', error => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Core SYNESIS runtime is unavailable.', detail: config.production ? undefined : error.message }));
  });
  req.pipe(proxy);
}

const server = http.createServer((req, res) => {
  if (req.url === '/cognitive' || req.url?.startsWith('/api/cognitive/')) return app(req, res);
  return proxyToCore(req, res);
});

server.listen(externalPort, '0.0.0.0', () => {
  console.log(`SYNESIS Cognitive Control Plane listening on http://0.0.0.0:${externalPort}; v5 core isolated on loopback:${internalPort}`);
});
