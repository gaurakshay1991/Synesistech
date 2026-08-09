import http from 'node:http';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';

const externalPort = Number(process.env.PORT || 3000);
const internalGatewayPort = externalPort + 10 <= 65534 ? externalPort + 10 : externalPort - 10;
const internalCorePort = internalGatewayPort + 1;
process.env.PORT = String(internalGatewayPort);
process.env.SYNESIS_INTERNAL_PORT = String(internalCorePort);
await import('./cognitive-gateway.js');

const [{ config }, db, analysisModule, exposureModule, liveModule, product, regulatory] = await Promise.all([
  import('./config.js'),
  import('./db.js'),
  import('./analysis.js'),
  import('./exposure.js'),
  import('./live-intelligence.js'),
  import('./product-intelligence.js'),
  import('./regulatory-impact.js')
]);
process.env.PORT = String(externalPort);

const openai = config.openaiKey ? new OpenAI({ apiKey: config.openaiKey, timeout: 90_000, maxRetries: 1 }) : null;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1, fields: 20 } });
const app = express();
app.disable('x-powered-by');
if (config.production) app.set('trust proxy', 1);

const jsonRoute = express.json({ limit: '3mb' });
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const clean = (value, fallback = '', max = 500) => String(value ?? fallback).trim().slice(0, max);

const runtimeSmoke = {
  openaiConfigured: Boolean(openai),
  model: config.openaiModel,
  liveModel: config.openaiLiveModel,
  neural: { status: openai ? 'pending' : 'unavailable', checkedAt: null },
  liveResearch: { status: openai ? 'pending' : 'unavailable', checkedAt: null, citationCount: 0 }
};

function parseJsonOutput(value) {
  const raw = String(value || '').trim();
  try { return JSON.parse(raw); } catch {}
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
  throw new Error('The intelligence model returned invalid structured output.');
}

async function callStructured(instruction, payload, maxOutput = 5000) {
  if (!openai) throw Object.assign(new Error('Live neural intelligence is not configured.'), { status: 503 });
  const response = await openai.responses.create({
    model: config.openaiModel,
    store: false,
    max_output_tokens: maxOutput,
    input: `${instruction}\n\nCONTROLLED INPUT:\n${JSON.stringify(payload)}\n\nReturn one valid JSON object only. Do not use markdown.`
  });
  return parseJsonOutput(response.output_text);
}

async function internalFetch(req, pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (req.headers.cookie) headers.cookie = req.headers.cookie;
  if (req.headers.authorization) headers.authorization = req.headers.authorization;
  const response = await fetch(`http://127.0.0.1:${internalGatewayPort}${pathname}`, { ...options, headers });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text || `HTTP ${response.status}` }; }
  return { ok: response.ok, status: response.status, body };
}

async function requireSession(req, res, next) {
  try {
    const session = await internalFetch(req, '/api/auth/session');
    if (!session.ok || !session.body?.user) return res.status(session.status || 401).json({ error: session.body?.error || 'Login required.' });
    req.synesisUser = session.body.user;
    req.orgId = session.body.user.organizationId;
    next();
  } catch {
    res.status(503).json({ error: 'SYNESIS authentication runtime is unavailable.' });
  }
}

function findingById(document, findingId) {
  const findings = document.analysis?.findings || [];
  return findings.find((item, index) => String(item.id || `finding-${index + 1}`) === String(findingId));
}

async function generateRegulatoryImpact({ document, sourceText, currentLaw = null }) {
  const referenceInventory = regulatory.extractLegalReferences(sourceText || document?.sourceText || '');
  let research = currentLaw;
  try {
    research = await liveModule.liveLegalResearch({
      client: openai,
      model: config.openaiLiveModel,
      question: regulatory.regulatoryImpactResearchQuestion(referenceInventory),
      jurisdiction: document.jurisdiction,
      document: { ...document, sourceText: sourceText || document.sourceText },
      purpose: 'regulatory reference freshness, amendment, supersession and compliance impact audit'
    });
  } catch (error) {
    return regulatory.emptyRegulatoryImpact(referenceInventory, `Live regulatory verification unavailable: ${error.message}`);
  }

  try {
    const instruction = `You are the regulatory change, compliance-impact and stale-law verification engine inside SYNESIS. Use ONLY the selected document, the extracted reference inventory and the supplied fresh live-research result. Do not invent an amendment, effective date, requirement, penalty, regulator or citation that is not supported by those inputs. Return JSON keys: overallImpact, staleReferenceWarning, executiveConclusion, citedAuthorities[], omittedApplicableAuthorities[], complianceImpacts[], transitionAndDeadlines[], requiredActions[], approvalsAndEscalations[], missingFacts[], decisionEffect. overallImpact must be one of NONE, LOW, MEDIUM, HIGH, CRITICAL. Each citedAuthorities item must contain referenceId, documentReference, currentStatus, currentInstrument, amendmentOrSupersession, effectiveDate, transitionDate, impact, sourceUrls[]. currentStatus must be CURRENT, AMENDED, SUPERSEDED, REPEALED, WITHDRAWN, PARTIALLY_EFFECTIVE, NOT_YET_EFFECTIVE, UNCLEAR, or NOT_VERIFIED. Each complianceImpacts item must contain dimension, impactLevel, requirement, applicability, ownerFunction, trigger, deadline, evidenceRequired, controlChange, consequenceOfFailure, mitigation. Each omittedApplicableAuthorities item must explain why the current authority applies despite not being cited. requiredActions must be concrete and prioritised. Distinguish mandatory law from regulatory expectation, guidance, contractual preference and proposal/consultation.`;
    const pack = await callStructured(instruction, {
      document: { id: document.id, title: document.title, matter: document.matter, jurisdiction: document.jurisdiction, documentType: document.documentType },
      referenceInventory,
      complianceDimensions: regulatory.COMPLIANCE_IMPACT_DIMENSIONS,
      liveResearch: { answer: research.answer || '', citations: research.citations || [], researchedAt: research.researchedAt || null },
      sourceText: sourceText || document.sourceText
    }, 7000);
    return regulatory.normalizeRegulatoryImpact(pack, referenceInventory, research);
  } catch (error) {
    const fallback = regulatory.emptyRegulatoryImpact(referenceInventory, `Regulatory impact structuring failed: ${error.message}`);
    fallback.status = 'RESEARCH_COMPLETE_STRUCTURING_FAILED';
    fallback.currentLawCitations = research?.citations || [];
    fallback.researchedAt = research?.researchedAt || new Date().toISOString();
    fallback.liveWebUsed = Boolean(research?.liveWebUsed);
    return fallback;
  }
}

async function appendDocumentWork(orgId, document, analysis) {
  await db.mutateState(orgId, state => {
    state.tasks ||= [];
    state.obligations ||= [];
    state.decisions ||= [];
    const stamp = Date.now().toString(36);
    (analysis.obligations || []).slice(0, 20).forEach((item, index) => state.obligations.unshift({
      id: `doc-ob-${stamp}-${index}`, documentId: document.id, title: clean(item.title, `Obligation from ${document.title}`, 240),
      type: clean(item.type, 'Document', 80), source: document.title, sourceRef: clean(item.source_reference, 'Document evidence', 240),
      owner: clean(item.owner, 'Matter owner', 120), due: clean(item.deadline, 'To be determined', 80), status: clean(item.status, 'Proposed', 60),
      risk: clean(item.risk, analysis.overall_risk, 30), evidence: 0, controls: []
    }));
    (analysis.decision_questions || []).slice(0, 12).forEach((item, index) => state.decisions.unshift({
      id: `doc-dec-${stamp}-${index}`, documentId: document.id, title: clean(item.question, `Decision required for ${document.title}`, 260),
      matter: document.matter, risk: clean(item.risk, analysis.overall_risk, 30), status: 'Pending', owner: clean(item.owner, 'Matter owner', 120),
      due: clean(item.urgency, 'Review now', 80), rationale: analysis.recommended_decision, approvals: [{ role: 'Legal', status: 'Pending' }]
    }));
    (analysis.required_actions || []).slice(0, 20).forEach((item, index) => state.tasks.unshift({
      id: `doc-task-${stamp}-${index}`, documentId: document.id, title: clean(item.title, `Action for ${document.title}`, 260),
      owner: clean(item.owner, 'Matter owner', 120), due: clean(item.due, 'To be scheduled', 80), status: 'Not started', priority: analysis.overall_risk,
      blocker: '', evidenceRequired: Array.isArray(item.evidence_required) ? item.evidence_required : []
    }));
    (analysis.regulatory_impact?.requiredActions || []).slice(0, 20).forEach((item, index) => state.tasks.unshift({
      id: `reg-task-${stamp}-${index}`, documentId: document.id,
      title: clean(item.title || item.action || item.requirement, `Regulatory remediation for ${document.title}`, 260),
      owner: clean(item.ownerFunction || item.owner, 'Legal / Compliance', 120), due: clean(item.deadline || item.due, 'Review now', 80),
      status: 'Not started', priority: clean(item.priority || analysis.regulatory_impact?.overallImpact, 'High', 30),
      blocker: '', evidenceRequired: Array.isArray(item.evidenceRequired) ? item.evidenceRequired : []
    }));
    return state;
  });
}

app.get('/api/product-v8/health', (req, res) => res.json({
  ok: true,
  product: 'SYNESIS Matter Intelligence Workbench',
  version: '8.1.0-regulatory-impact',
  policy: 'Live neural analysis required for completed document review; demo seed state suppressed; regulatory references are independently checked for currentness when live research is available.',
  runtimeSmoke,
  time: new Date().toISOString()
}));

app.get('/api/bootstrap', requireSession, asyncRoute(async (req, res) => {
  const [state, documents] = await Promise.all([db.getState(req.orgId), db.listDocuments(req.orgId, 300)]);
  res.json({
    state: product.operationalStateFromDocuments(state, documents),
    documents,
    user: req.synesisUser,
    organization: { id: req.orgId, name: config.organizationName },
    productMode: 'document-derived-live-intelligence'
  });
}));

app.post('/api/documents/analyze', requireSession, upload.single('file'), asyncRoute(async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'Live neural analysis is unavailable. SYNESIS will not save a rule-only template as a completed AI review.' });
  const extracted = await analysisModule.extractText(req.file, req.body.text);
  const options = {
    title: clean(req.body.title, extracted.fileName.replace(/\.[^.]+$/, '') || 'Pasted document', 200),
    matter: clean(req.body.matter, 'General institutional review', 200),
    documentType: clean(req.body.documentType, 'Auto-detect', 100),
    jurisdiction: clean(req.body.jurisdiction, 'India', 100),
    riskAppetite: clean(req.body.riskAppetite, 'Conservative', 80),
    analysisMode: 'Live multipass',
    objective: clean(req.body.objective, 'Determine what is material, what can be accepted, what must be raised, the defensible exposure, mitigation strategy, regulatory/compliance impact and exact drafting.', 1000)
  };

  const analysis = await analysisModule.analyzeDocument({ client: openai, model: config.openaiModel, text: extracted.text, options });
  if (analysis.analysis_details?.live_ai_used !== true) {
    return res.status(502).json({
      error: 'The live neural analysis failed. No completed review was saved.',
      diagnostic: analysis.analysis_details?.failure || analysis.assumptions_and_limits?.find(value => /Live AI|provider|OpenAI/i.test(value)) || 'Unknown model failure',
      ruleSignals: analysis.neuro_symbolic?.symbolic?.rules_fired?.length || 0
    });
  }

  analysis.exposure_model = exposureModule.buildDocumentExposureModel(analysis, extracted.text, options);
  analysis.analysis_details ||= {};
  analysis.analysis_details.document_isolation = 'single-document';
  analysis.analysis_details.current_law_web_used = false;

  const provisionalDocument = {
    id: `upload-${extracted.hash.slice(0, 16)}`,
    title: options.title,
    jurisdiction: options.jurisdiction,
    matter: options.matter,
    documentType: options.documentType,
    sourceText: extracted.text
  };

  try {
    analysis.live_current_law = await liveModule.liveLegalResearch({
      client: openai,
      model: config.openaiLiveModel,
      question: 'Verify this exact selected document against law, regulations, rules, circulars, guidelines, orders and authoritative amendments current today. Explicitly identify any cited authority that has since been amended, superseded, repealed, withdrawn, consolidated or partly/not-yet brought into force, and identify material current authorities that apply but were omitted. Distinguish operative law from proposal/guidance, state effective and transition dates where available, and do not invent monetary exposure.',
      jurisdiction: options.jurisdiction,
      document: provisionalDocument,
      purpose: 'automatic independent current-law document analysis'
    });
    analysis.analysis_details.current_law_web_used = true;
    analysis.engine = `${analysis.engine} + live current-law authority pass`;
  } catch (error) {
    analysis.live_current_law = { status: 'Current-law verification unavailable', error: error.message, researchedAt: new Date().toISOString(), liveWebUsed: false, isolation: { scope: 'single-document', otherDocumentMemoryUsed: false } };
    analysis.analysis_details.current_law_error = error.message;
  }

  analysis.regulatory_impact = await generateRegulatoryImpact({ document: provisionalDocument, sourceText: extracted.text });
  analysis.analysis_details.regulatory_impact_live_used = Boolean(analysis.regulatory_impact?.liveWebUsed);

  const provisional = {
    id: `pending-${extracted.hash.slice(0, 12)}`,
    title: options.title,
    matter: options.matter,
    jurisdiction: options.jurisdiction,
    analysis
  };
  analysis.document_graph = product.buildDocumentGraph(provisional);
  analysis.clause_memory = product.buildClauseMemory(provisional);

  const document = await db.saveDocument({
    orgId: req.orgId, userId: req.synesisUser.id, title: options.title, fileName: extracted.fileName, mimeType: extracted.mimeType, hash: extracted.hash,
    documentType: options.documentType, jurisdiction: options.jurisdiction, matter: options.matter, sourceText: extracted.text, analysis
  });
  analysis.document_graph = product.buildDocumentGraph({ ...document, analysis });
  analysis.clause_memory = product.buildClauseMemory({ ...document, analysis });
  await appendDocumentWork(req.orgId, document, analysis);
  await db.logAudit({ orgId: req.orgId, user: req.synesisUser, action: 'document.analysis.completed.v8', entityType: 'document', entityId: document.id, metadata: { engine: analysis.engine, liveAi: true, liveCurrentLaw: analysis.analysis_details.current_law_web_used, staleReferenceWarning: Boolean(analysis.regulatory_impact?.staleReferenceWarning), regulatoryImpact: analysis.regulatory_impact?.overallImpact } });
  const state = product.operationalStateFromDocuments(await db.getState(req.orgId), await db.listDocuments(req.orgId, 300));
  res.status(201).json({ document: await db.getDocument(req.orgId, document.id, false), state });
}));

app.get('/api/documents/:id/graph', requireSession, asyncRoute(async (req, res) => {
  const document = await db.getDocument(req.orgId, req.params.id, true);
  if (!document) return res.status(404).json({ error: 'Document not found.' });
  res.json({ graph: product.buildDocumentGraph(document), clauseMemory: product.buildClauseMemory(document) });
}));

app.post('/api/documents/:id/regulatory-impact', requireSession, jsonRoute, asyncRoute(async (req, res) => {
  const document = await db.getDocument(req.orgId, req.params.id, true);
  if (!document) return res.status(404).json({ error: 'Document not found.' });
  const impact = await generateRegulatoryImpact({ document, sourceText: document.sourceText });
  await db.logAudit({ orgId: req.orgId, user: req.synesisUser, action: 'document.regulatory-impact.generated', entityType: 'document', entityId: document.id, metadata: { status: impact.status, overallImpact: impact.overallImpact, staleReferenceWarning: impact.staleReferenceWarning, citedAuthorities: impact.citedAuthorities?.length || 0, omittedAuthorities: impact.omittedApplicableAuthorities?.length || 0 } });
  res.json({ regulatoryImpact: impact, document: { id: document.id, title: document.title, jurisdiction: document.jurisdiction, matter: document.matter } });
}));

app.post('/api/documents/:id/findings/:findingId/action-pack', requireSession, jsonRoute, asyncRoute(async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'Live neural intelligence is unavailable. A pre-fed rewrite will not be returned.' });
  const document = await db.getDocument(req.orgId, req.params.id, true);
  if (!document) return res.status(404).json({ error: 'Document not found.' });
  const finding = findingById(document, req.params.findingId);
  if (!finding) return res.status(404).json({ error: 'Finding not found in this document.' });
  const exposureModel = document.analysis?.exposure_model || exposureModule.buildDocumentExposureModel(document.analysis || {}, document.sourceText || '', { jurisdiction: document.jurisdiction, matter: document.matter });
  const findingIndex = (document.analysis?.findings || []).indexOf(finding);
  const exposure = product.exposureForFinding(exposureModel, finding, findingIndex);

  let currentLaw = null;
  try {
    currentLaw = await liveModule.liveLegalResearch({
      client: openai,
      model: config.openaiLiveModel,
      question: `For the exact identified issue below, verify the current legal/regulatory position today and explain whether it makes the point worth raising, negotiable, acceptable with monitoring, or non-material. Check later amendments/supersession of any authority relied on in the clause. Do not use other matters. ISSUE: ${finding.issue}. CLAUSE: ${finding.clause_reference}.`,
      jurisdiction: document.jurisdiction,
      document,
      purpose: 'finding-level current-law and negotiation verification'
    });
  } catch (error) {
    currentLaw = { status: 'unavailable', error: error.message, answer: '', citations: [] };
  }

  const instruction = `You are a senior transactional lawyer, legal risk officer and negotiation strategist. Analyse ONE finding from ONE supplied document only. The user needs a practical decision, not generic commentary. Treat the supplied exposure-engine result as authoritative for monetary quantification: never create a different number or imply a legal maximum that is not evidenced. Current-law research may be used only to the extent shown in the supplied research result. Consider the document regulatory-impact object when deciding materiality. Return JSON keys: disposition, priority, headline, worth_raising, why, legal_materiality, commercial_materiality, operational_materiality, regulatory_materiality, compliance_impact, quantification, risk_if_accepted, mitigation_strategy, negotiation_strategy, rewrite, fallback_position, walkaway_position, questions_for_business, residual_risk, confidence, evidence_used, current_law_relevance. disposition must be one of LET_GO, ACCEPT_WITH_NOTE, MONITOR, NEGOTIATE, MUST_FIX, ESCALATE. priority must be 1 to 5. quantification must preserve the supplied engine status/label/rationale and must not invent money. rewrite must contain current_clause, preferred_text, fallback_text, drafting_rationale. mitigation_strategy must contain immediate, contractual, operational, monitoring. negotiation_strategy must contain opening_position, concession_ladder, counterparty_message, red_line.`;

  const pack = await callStructured(instruction, {
    document: { id: document.id, title: document.title, matter: document.matter, jurisdiction: document.jurisdiction, documentType: document.documentType },
    exactFinding: finding,
    exactSourceText: document.sourceText,
    exposureEngine: exposure || { quantificationStatus: 'Not reliably quantifiable', exposureLabel: 'Not reliably quantifiable', rationale: 'No reliable monetary basis was identified.' },
    regulatoryImpact: document.analysis?.regulatory_impact || null,
    currentLaw: { answer: currentLaw?.answer || '', citations: currentLaw?.citations || [], researchedAt: currentLaw?.researchedAt || null },
    userInstruction: clean(req.body?.instruction, '', 1200)
  }, 6500);

  pack.findingId = finding.id || req.params.findingId;
  pack.documentId = document.id;
  pack.currentLawCitations = currentLaw?.citations || [];
  pack.generatedAt = new Date().toISOString();
  pack.engine = `Live clause action pack (${config.openaiModel})`;
  await db.logAudit({ orgId: req.orgId, user: req.synesisUser, action: 'finding.action-pack.generated', entityType: 'document', entityId: document.id, metadata: { findingId: pack.findingId, disposition: pack.disposition, citations: pack.currentLawCitations.length } });
  res.json({ actionPack: pack });
}));

app.post('/api/documents/:id/decision-pack', requireSession, jsonRoute, asyncRoute(async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'Live neural intelligence is unavailable. SYNESIS will not generate a pre-fed clearance recommendation.' });
  const document = await db.getDocument(req.orgId, req.params.id, true);
  if (!document) return res.status(404).json({ error: 'Document not found.' });
  const analysis = document.analysis || {};
  const exposureModel = analysis.exposure_model || exposureModule.buildDocumentExposureModel(analysis, document.sourceText || '', { jurisdiction: document.jurisdiction, matter: document.matter });

  let live = null;
  try {
    live = await liveModule.liveLegalResearch({
      client: openai,
      model: config.openaiLiveModel,
      question: 'For this exact document, verify the current legal/regulatory position and identify only matters that change the clearance decision today. Check whether cited laws/circulars have been amended, superseded, repealed, withdrawn or consolidated and whether current applicable authorities are missing. Distinguish mandatory law, regulatory expectation, guidance and contractual/commercial preference.',
      jurisdiction: document.jurisdiction,
      document,
      purpose: 'document clearance decision current-law verification'
    });
  } catch (error) {
    live = { answer: '', citations: [], error: error.message };
  }

  const instruction = `Act as a senior legal counsel deciding whether this exact matter can be cleared. Do not produce a generic risk report. Regulatory/compliance impact and stale legal references can independently make a matter non-clearable even where contractual wording looks acceptable. Return JSON keys: overall_disposition, clearance_recommendation, executive_rationale, regulatory_clearance_effect, must_fix[], raise_and_negotiate[], acceptable_with_note[], let_go[], quantifiable_exposure_summary, unquantifiable_exposure_summary, top_mitigations[], compliance_conditions[], negotiation_plan, approval_conditions[], unresolved_questions[], confidence. overall_disposition must be one of CLEAR, CLEAR_WITH_CONDITIONS, NEGOTIATE_BEFORE_CLEARANCE, ESCALATE, DO_NOT_CLEAR. Every item in must_fix/raise_and_negotiate/acceptable_with_note/let_go must reference a finding id where applicable and explain why. Monetary statements must exactly respect the supplied exposure engine; never invent values.`;
  const pack = await callStructured(instruction, {
    document: { id: document.id, title: document.title, matter: document.matter, jurisdiction: document.jurisdiction, documentType: document.documentType },
    documentSummary: analysis.document_summary,
    executivePosition: analysis.executive_position,
    findings: analysis.findings || [],
    exposureModel,
    regulatoryImpact: analysis.regulatory_impact || null,
    currentLaw: { answer: live?.answer || '', citations: live?.citations || [] },
    requestedObjective: clean(req.body?.objective, 'Can this document be cleared, and which points are genuinely worth raising?', 1200)
  }, 7000);
  pack.currentLawCitations = live?.citations || [];
  pack.generatedAt = new Date().toISOString();
  pack.engine = `Live matter clearance pack (${config.openaiModel})`;
  res.json({ decisionPack: pack });
}));

app.post('/api/documents/:id/findings/:findingId/memory', requireSession, jsonRoute, asyncRoute(async (req, res) => {
  const document = await db.getDocument(req.orgId, req.params.id, true);
  if (!document) return res.status(404).json({ error: 'Document not found.' });
  const finding = findingById(document, req.params.findingId);
  if (!finding) return res.status(404).json({ error: 'Finding not found in this document.' });
  const actionPack = req.body?.actionPack || {};
  let saved;
  await db.mutateState(req.orgId, state => {
    state.clauseMemory ||= { coverage: 0, archetypes: [], edges: [], feedbackEvents: [] };
    state.clauseMemory.feedbackEvents ||= [];
    saved = {
      id: crypto.randomUUID(), documentId: document.id, findingId: finding.id || req.params.findingId,
      clauseId: clean(finding.category, 'General', 100), action: 'Human-approved clause memory',
      lesson: clean(actionPack?.drafting_rationale || actionPack?.why || finding.recommended_mitigation, 'Validated document-specific position.', 1200),
      sourceClause: clean(finding.quoted_text, '', 1800), preferredRewrite: clean(actionPack?.rewrite?.preferred_text || finding.suggested_rewrite, '', 2200),
      fallbackRewrite: clean(actionPack?.rewrite?.fallback_text, '', 2200), disposition: clean(actionPack?.disposition, product.materialityBand(finding), 60),
      recordedAt: new Date().toISOString(), source: document.title, approvedBy: req.synesisUser.email, status: 'Validated institutional memory'
    };
    state.clauseMemory.feedbackEvents.unshift(saved);
    state.clauseMemory.feedbackEvents = state.clauseMemory.feedbackEvents.slice(0, 500);
    return state;
  });
  res.status(201).json({ memory: saved });
}));

function proxy(req, res) {
  const headers = { ...req.headers, host: `127.0.0.1:${internalGatewayPort}` };
  const upstream = http.request({ hostname: '127.0.0.1', port: internalGatewayPort, path: req.originalUrl, method: req.method, headers }, upstreamRes => {
    res.statusCode = upstreamRes.statusCode || 502;
    for (const [key, value] of Object.entries(upstreamRes.headers)) if (value !== undefined) res.setHeader(key, value);
    upstreamRes.pipe(res);
  });
  upstream.on('error', error => {
    if (!res.headersSent) res.status(502).json({ error: 'SYNESIS core gateway unavailable.', detail: config.production ? undefined : error.message });
    else res.end();
  });
  req.pipe(upstream);
}

app.use(proxy);
app.use((error, req, res, next) => {
  console.error('SYNESIS v8 gateway error', error);
  if (res.headersSent) return next(error);
  res.status(error.status || 500).json({ error: error.message || 'Unexpected intelligence gateway error.' });
});

app.listen(externalPort, '0.0.0.0', () => {
  console.log(`SYNESIS Matter Intelligence v8.1 listening on ${externalPort}; cognitive gateway ${internalGatewayPort}; core ${internalCorePort}`);
});

async function runSmoke() {
  if (!openai) return;
  try {
    const response = await openai.responses.create({ model: config.openaiModel, store: false, max_output_tokens: 20, input: 'Return exactly SYNESIS_NEURAL_OK.' });
    runtimeSmoke.neural = { status: response.output_text?.includes('SYNESIS_NEURAL_OK') ? 'pass' : 'unexpected-response', checkedAt: new Date().toISOString() };
  } catch (error) {
    runtimeSmoke.neural = { status: 'fail', checkedAt: new Date().toISOString(), error: String(error.message || error).slice(0, 180) };
  }
  try {
    const result = await liveModule.liveLegalResearch({ client: openai, model: config.openaiLiveModel, question: 'Find one current official Reserve Bank of India source page and identify it. This is a connectivity smoke test only; do not provide legal advice.', jurisdiction: 'India', regulator: 'RBI', purpose: 'production live-research smoke test' });
    runtimeSmoke.liveResearch = { status: (result.citations || []).length ? 'pass' : 'no-citations', checkedAt: new Date().toISOString(), citationCount: (result.citations || []).length };
  } catch (error) {
    runtimeSmoke.liveResearch = { status: 'fail', checkedAt: new Date().toISOString(), citationCount: 0, error: String(error.message || error).slice(0, 180) };
  }
}
const smokeTimer = setTimeout(runSmoke, 6000);
smokeTimer.unref();
