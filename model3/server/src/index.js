import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import OpenAI from 'openai';
import { z } from 'zod';
import { config, assertProductionConfig } from './config.js';
import {
  organizationId,
  initializeStorage,
  getUserByEmail,
  getUserById,
  touchLogin,
  updatePassword,
  listUsers,
  createUser,
  setUserActive,
  getState,
  mutateState,
  saveDocument,
  listDocuments,
  getDocument,
  updateDocumentStatus,
  logAudit,
  listAudit,
  healthStorage
} from './db.js';
import { extractText, analyzeDocument, answerDocumentQuestion } from './analysis.js';
import { registerLiveRoutes } from './live-routes.js';

assertProductionConfig();
await initializeStorage();

const app = express();
const SESSION_COOKIE = 'synesis_model3_session';
const openai = config.openaiKey ? new OpenAI({ apiKey: config.openaiKey, timeout: 90_000, maxRetries: 1 }) : null;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1, fields: 20 } });
const allowedRoles = ['admin', 'legal', 'compliance', 'kyc', 'risk', 'business', 'operations', 'cyber', 'procurement', 'audit', 'management'];
const route = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8).max(256) });
const passwordSchema = z.object({
  currentPassword: z.string().min(8).max(256),
  newPassword: z.string().min(12).max(256).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/)
});
const userSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().email(), role: z.enum(allowedRoles), temporaryPassword: z.string().min(12).max(256) });
const questionSchema = z.object({ question: z.string().trim().min(3).max(2000) });

function parse(schema, value) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw Object.assign(new Error(result.error.issues.map(item => item.message).join(' ')), { status: 400 });
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    organizationId: user.organization_id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: Boolean(user.is_active),
    mustChangePassword: Boolean(user.must_change_password),
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at
  };
}

function issueToken(user) {
  return jwt.sign({ sub: user.id, org: user.organization_id, role: user.role, email: user.email, name: user.name }, config.jwtSecret, {
    expiresIn: '8h', issuer: 'synesis-model3', audience: 'synesis-model3-web'
  });
}

function setCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, secure: config.secureCookie, sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000, path: '/' });
}

function clearCookie(res) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: config.secureCookie, sameSite: 'strict', path: '/' });
}

async function auth(req, res, next) {
  try {
    const raw = req.cookies?.[SESSION_COOKIE] || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!raw) return res.status(401).json({ error: 'Login required.' });
    const claims = jwt.verify(raw, config.jwtSecret, { issuer: 'synesis-model3', audience: 'synesis-model3-web' });
    const user = await getUserById(claims.sub);
    if (!user?.is_active) return res.status(401).json({ error: 'Account is inactive.' });
    req.user = user;
    req.orgId = user.organization_id;
    const setupRoute = ['/api/auth/session', '/api/auth/logout', '/api/auth/change-password'].includes(req.path);
    if (user.must_change_password && !setupRoute) return res.status(428).json({ error: 'Change the temporary password before using Synesis.' });
    next();
  } catch (error) {
    clearCookie(res);
    if (/jwt|token|expired|signature/i.test(error.message)) return res.status(401).json({ error: 'Session expired or invalid.' });
    next(error);
  }
}


function originGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  try {
    const originHost = new URL(origin).host;
    const requestHost = req.get('x-forwarded-host') || req.get('host');
    const explicitlyAllowed = config.clientOrigins.some(item => new URL(item).host === originHost);
    if (originHost === requestHost || explicitlyAllowed) return next();
  } catch {
    // Invalid origins are rejected below.
  }
  return res.status(403).json({ error: 'Request origin is not allowed.' });
}

function allow(...roles) {
  return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Your role cannot perform this action.' });
}

function audit(req, action, entityType, entityId, metadata = {}) {
  return logAudit({ orgId: req.orgId, user: req.user, action, entityType, entityId, metadata });
}

function clean(value, fallback = '', max = 300) {
  return String(value ?? fallback).trim().slice(0, max);
}

function isOverdue(value) {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const end = new Date(parsed);
  end.setHours(23, 59, 59, 999);
  return end.getTime() < Date.now();
}

function recalculateState(state) {
  state.metrics ||= {};
  state.alerts ||= [];
  state.obligations ||= [];
  state.decisions ||= [];
  state.tasks ||= [];
  state.controls ||= [];
  state.evidence ||= [];
  state.regulatoryUpdates ||= [];
  state.litigationSimulations ||= [];
  state.governanceFrameworks ||= [];
  state.clauseMemory ||= { coverage: 0, archetypes: [], edges: [], feedbackEvents: [] };
  state.metrics.attention = state.alerts.length + state.decisions.filter(item => !['Approved', 'Rejected', 'Closed'].includes(item.status)).length;
  state.metrics.critical = state.obligations.filter(item => item.risk === 'Critical' && item.status !== 'Completed').length;
  state.metrics.decisionsPending = state.decisions.filter(item => ['Pending', 'Challenge', 'Deferred'].includes(item.status)).length;
  state.metrics.overdue = state.tasks.filter(item => item.status !== 'Completed' && isOverdue(item.due)).length;
  state.metrics.controlsAtRisk = state.controls.filter(item => Number(item.effectiveness || 0) < 70).length;
  state.metrics.evidenceCoverage = state.evidence.length ? Math.round(state.evidence.filter(item => item.status === 'Verified').length / state.evidence.length * 100) : 0;
  state.metrics.regulatoryUpdatesOpen = state.regulatoryUpdates.filter(item => item.status !== 'Verified and mapped').length;
  state.metrics.clauseMemoryCoverage = Number(state.clauseMemory.coverage || 0);
  state.metrics.governanceReadiness = state.governanceFrameworks.length ? Math.round(state.governanceFrameworks.reduce((sum, item) => sum + Number(item.readiness || 0), 0) / state.governanceFrameworks.length) : 0;
  state.metrics.simulationCount = (state.simulations?.length || 0) + state.litigationSimulations.length;
  return state;
}

async function appendAnalysisToTwin(orgId, document, analysis) {
  return mutateState(orgId, state => {
    recalculateState(state);
    const stamp = Date.now().toString(36);
    (analysis.obligations || []).slice(0, 15).forEach((item, index) => {
      state.obligations.unshift({
        id: `doc-ob-${stamp}-${index}`,
        title: clean(item.title, `Obligation from ${document.title}`, 240),
        type: clean(item.type, 'Document', 80),
        source: document.title,
        sourceRef: clean(item.source_reference, 'Document evidence', 240),
        owner: clean(item.owner, 'Matter owner', 120),
        due: clean(item.deadline, 'To be determined', 80),
        status: clean(item.status, 'Proposed', 60),
        risk: clean(item.risk, analysis.overall_risk, 30),
        evidence: 0,
        controls: [],
        documentId: document.id
      });
    });
    (analysis.decision_questions || []).slice(0, 8).forEach((item, index) => {
      state.decisions.unshift({
        id: `doc-dec-${stamp}-${index}`,
        title: clean(item.question, `Decision required for ${document.title}`, 260),
        matter: document.matter,
        risk: clean(item.risk, analysis.overall_risk, 30),
        status: 'Pending',
        owner: clean(item.owner, 'Matter owner', 120),
        due: clean(item.urgency, 'Review now', 80),
        rationale: analysis.recommended_decision,
        approvals: [{ role: 'Legal', status: 'Pending' }, { role: 'Compliance', status: 'Pending' }],
        documentId: document.id
      });
    });
    (analysis.required_actions || []).slice(0, 12).forEach((item, index) => {
      state.tasks.unshift({
        id: `doc-task-${stamp}-${index}`,
        title: clean(item.title, `Action for ${document.title}`, 260),
        owner: clean(item.owner, 'Matter owner', 120),
        due: clean(item.due, 'To be scheduled', 80),
        status: 'Not started',
        priority: analysis.overall_risk,
        blocker: '',
        documentId: document.id,
        evidenceRequired: Array.isArray(item.evidence_required) ? item.evidence_required : []
      });
    });

    const documentNodeId = `doc-${document.id}`;
    if (!state.graph.nodes.some(item => item.id === documentNodeId)) state.graph.nodes.push({ id: documentNodeId, label: document.title, type: 'Document', risk: analysis.overall_risk });
    const symbolicRules = analysis.neuro_symbolic?.symbolic?.rules_fired || [];
    symbolicRules.slice(0, 12).forEach(rule => {
      const ruleNodeId = `rule-${rule.id}`;
      if (!state.graph.nodes.some(item => item.id === ruleNodeId)) state.graph.nodes.push({ id: ruleNodeId, label: rule.issue, type: 'Legal rule', risk: rule.risk_level });
      if (!state.graph.edges.some(edge => edge[0] === ruleNodeId && edge[1] === documentNodeId)) state.graph.edges.push([ruleNodeId, documentNodeId, 'flags']);
    });

    (analysis.clause_memory_candidates || []).slice(0, 12).forEach((candidate, index) => {
      state.clauseMemory.feedbackEvents.unshift({
        id: `analysis-memory-${stamp}-${index}`,
        clauseId: clean(candidate.category, 'Unclassified', 100),
        action: 'Analysis candidate',
        lesson: clean(candidate.proposedLesson || candidate.lesson, 'Review and validate the proposed clause position.', 500),
        recordedAt: new Date().toISOString(),
        source: document.title,
        documentId: document.id,
        fingerprint: candidate.fingerprint || analysis.analysis_details?.clause_fingerprint,
        status: 'Human validation required'
      });
    });
    state.clauseMemory.feedbackEvents = state.clauseMemory.feedbackEvents.slice(0, 250);

    if (analysis.litigation_risk) {
      state.litigationSimulations.unshift({
        id: `analysis-lit-${stamp}`,
        name: `Clause-level dispute indicator: ${document.title}`,
        clauseType: 'Document-wide',
        jurisdiction: document.jurisdiction,
        event: 'Potential dispute arising from identified contractual exposures',
        probability: Number(analysis.litigation_risk.dispute_probability_indicator || 0),
        enforceability: Number(analysis.litigation_risk.enforceability_indicator || 0),
        exposure: 0,
        confidence: Number(analysis.litigation_risk.confidence || 0),
        status: analysis.litigation_risk.status,
        keyDrivers: analysis.litigation_risk.drivers || [],
        recommendation: analysis.recommended_decision,
        documentId: document.id,
        generatedAt: new Date().toISOString()
      });
    }

    return recalculateState(state);
  });
}

async function answerInstitutionalQuestion(state, question) {
  if (openai) {
    const response = await openai.responses.create({
      model: config.openaiModel,
      max_output_tokens: 1400,
      input: `You are Synesis institutional intelligence. Answer only from the supplied organisation state. Identify evidence, uncertainty, accountable owners and the next governed action. Do not invent laws or facts.\n\nQUESTION: ${question}\n\nSTATE: ${JSON.stringify(state)}`
    });
    return { answer: response.output_text, engine: `Synesis institutional intelligence (${config.openaiModel})`, liveAiUsed: true };
  }
  const lower = question.toLowerCase();
  let answer;
  if (/block|closure|stuck/.test(lower)) {
    answer = state.tasks.filter(item => item.blocker || item.status === 'Blocked').map(item => `${item.title}: ${item.blocker || 'Blocked without a recorded reason.'}`).join('\n') || 'No explicit blockers are recorded.';
  } else if (/evidence|proof|missing/.test(lower)) {
    const pending = state.evidence.filter(item => item.status !== 'Verified');
    answer = pending.length ? pending.map(item => `${item.title} — ${item.status} — linked to ${item.entity}`).join('\n') : 'All registered evidence is verified.';
  } else if (/control|weak/.test(lower)) {
    answer = [...state.controls].sort((a, b) => a.effectiveness - b.effectiveness).slice(0, 5).map(item => `${item.id} ${item.name}: ${item.effectiveness}% effectiveness; owner ${item.owner}.`).join('\n');
  } else if (/regulat|law change|source/.test(lower)) {
    answer = state.regulatoryUpdates.slice(0, 6).map(item => `${item.title} — ${item.status}; ${item.mappedItems || 0} mapped items; owner ${item.owner}.`).join('\n') || 'No regulatory updates are registered.';
  } else if (/clause memory|precedent|market position/.test(lower)) {
    answer = state.clauseMemory.archetypes.slice(0, 6).map(item => `${item.name}: ${item.preferredPosition} (${item.outcomeConfidence}% memory confidence).`).join('\n');
  } else if (/litigation|dispute|enforce/.test(lower)) {
    answer = state.litigationSimulations.slice(0, 5).map(item => `${item.name}: probability indicator ${item.probability}%, enforceability indicator ${item.enforceability}%, confidence ${item.confidence}%. ${item.status}`).join('\n');
  } else if (/governance|esg|ai act|model risk/.test(lower)) {
    answer = state.governanceFrameworks.map(item => `${item.name}: ${item.readiness}% readiness; gaps: ${(item.gaps || []).join(', ') || 'none recorded'}.`).join('\n');
  } else {
    answer = `${state.metrics.attention} items require attention, including ${state.metrics.critical} critical exposures, ${state.metrics.decisionsPending} pending decisions and ${state.metrics.overdue} overdue tasks. Regulatory updates open: ${state.metrics.regulatoryUpdatesOpen}; governance readiness: ${state.metrics.governanceReadiness}%.`;
  }
  return { answer, engine: 'Deterministic institutional-state assistant', liveAiUsed: false };
}

app.disable('x-powered-by');
if (config.production) app.set('trust proxy', 1);
app.use((req, res, next) => { req.requestId = req.get('x-request-id') || crypto.randomUUID(); res.set('x-request-id', req.requestId); next(); });
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-origin' }, contentSecurityPolicy: false }));
app.use(cors({ credentials: true, origin: true }));
app.use(originGuard);
app.use(cookieParser());
app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ extended: true, limit: '3mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }));

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 15, standardHeaders: true, legacyHeaders: false });

app.get('/api/health', (req, res) => res.json({
  ok: true,
  product: 'SYNESIS Neuro-Symbolic Legal Intelligence Platform',
  version: '4.0.0',
  category: 'Neuro-symbolic legal, regulatory, clause-memory and governed simulation platform',
  ai: openai ? `configured (${config.openaiModel})` : 'emergency fallback only',
  storage: healthStorage(),
  time: new Date().toISOString()
}));

app.post('/api/auth/login', loginLimiter, route(async (req, res) => {
  const credentials = parse(loginSchema, req.body);
  const user = await getUserByEmail(credentials.email);
  if (!user?.is_active || !bcrypt.compareSync(credentials.password, user.password_hash)) {
    await logAudit({ orgId: organizationId, user: { email: credentials.email, role: 'unknown' }, action: 'auth.login.failed', metadata: { requestId: req.requestId } });
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  await touchLogin(user.id);
  setCookie(res, issueToken(user));
  await logAudit({ orgId: user.organization_id, user, action: 'auth.login.success', metadata: { requestId: req.requestId } });
  res.json({ user: publicUser(await getUserById(user.id)) });
}));

app.get('/api/auth/session', auth, (req, res) => res.json({ user: publicUser(req.user) }));
app.post('/api/auth/logout', auth, route(async (req, res) => { await audit(req, 'auth.logout'); clearCookie(res); res.json({ ok: true }); }));
app.post('/api/auth/change-password', auth, route(async (req, res) => {
  const body = parse(passwordSchema, req.body);
  if (!bcrypt.compareSync(body.currentPassword, req.user.password_hash)) return res.status(400).json({ error: 'Current password is incorrect.' });
  await updatePassword(req.user.id, bcrypt.hashSync(body.newPassword, 12));
  const user = await getUserById(req.user.id);
  setCookie(res, issueToken(user));
  await audit(req, 'auth.password.changed', 'user', user.id);
  res.json({ user: publicUser(user) });
}));

app.get('/api/bootstrap', auth, route(async (req, res) => {
  res.json({ state: recalculateState(await getState(req.orgId)), documents: await listDocuments(req.orgId), user: publicUser(req.user), organization: { id: req.orgId, name: config.organizationName } });
}));

app.get('/api/documents', auth, route(async (req, res) => res.json({ documents: await listDocuments(req.orgId, Math.min(300, Number(req.query.limit || 100))) })));
app.get('/api/documents/:id', auth, route(async (req, res) => {
  const document = await getDocument(req.orgId, req.params.id, false);
  if (!document) return res.status(404).json({ error: 'Document not found.' });
  res.json({ document });
}));

app.post('/api/documents/analyze', auth, allow(...allowedRoles), upload.single('file'), route(async (req, res) => {
  const extracted = await extractText(req.file, req.body.text);
  const options = {
    title: clean(req.body.title, extracted.fileName.replace(/\.[^.]+$/, '') || 'Pasted document', 200),
    matter: clean(req.body.matter, 'General institutional review', 200),
    documentType: clean(req.body.documentType, 'Auto-detect', 100),
    jurisdiction: clean(req.body.jurisdiction, 'India', 100),
    riskAppetite: clean(req.body.riskAppetite, 'Conservative', 80),
    analysisMode: clean(req.body.analysisMode, 'Deep', 30),
    objective: clean(req.body.objective, 'Identify decisions, obligations, impacts, controls and governed actions.', 800)
  };
  const analysis = await analyzeDocument({ client: openai, model: config.openaiModel, text: extracted.text, options });
  const document = await saveDocument({ orgId: req.orgId, userId: req.user.id, title: options.title, fileName: extracted.fileName, mimeType: extracted.mimeType, hash: extracted.hash, documentType: options.documentType, jurisdiction: options.jurisdiction, matter: options.matter, sourceText: extracted.text, analysis });
  const state = await appendAnalysisToTwin(req.orgId, document, analysis);
  await audit(req, 'document.analysis.completed', 'document', document.id, { engine: analysis.engine, risk: analysis.overall_risk, score: analysis.overall_score, liveAi: analysis.analysis_details.live_ai_used });
  res.status(201).json({ document: await getDocument(req.orgId, document.id, false), state });
}));

app.post('/api/documents/:id/ask', auth, route(async (req, res) => {
  const { question } = parse(questionSchema, req.body);
  const document = await getDocument(req.orgId, req.params.id, true);
  if (!document) return res.status(404).json({ error: 'Document not found.' });
  const answer = await answerDocumentQuestion({ client: openai, model: config.openaiModel, document, question });
  await audit(req, 'document.question.answered', 'document', document.id, { question: question.slice(0, 200) });
  res.json({ answer, engine: openai ? `Document intelligence (${config.openaiModel})` : 'Document-analysis fallback' });
}));

app.post('/api/ask', auth, route(async (req, res) => {
  const { question } = parse(questionSchema, req.body);
  const result = await answerInstitutionalQuestion(await getState(req.orgId), question);
  await audit(req, 'institution.question.answered', 'organization', req.orgId, { question: question.slice(0, 200), engine: result.engine });
  res.json(result);
}));

registerLiveRoutes({ app, auth, allow, route, openai });

app.patch('/api/documents/:id/status', auth, route(async (req, res) => {
  const allowed = ['AI Review Complete', 'In Legal Review', 'In Compliance Review', 'Escalated', 'Final Approved', 'Rejected', 'Closed'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Invalid document status.' });
  const document = await updateDocumentStatus(req.orgId, req.params.id, req.body.status);
  if (!document) return res.status(404).json({ error: 'Document not found.' });
  await audit(req, 'document.status.changed', 'document', document.id, { status: req.body.status });
  res.json({ document });
}));

app.patch('/api/decisions/:id', auth, route(async (req, res) => {
  const { status, rationale = '', approvalNote = '' } = req.body || {};
  const valid = ['Pending', 'Challenge', 'Approved with controls', 'Approved', 'Rejected', 'Deferred'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid decision status.' });
  let found;
  const state = await mutateState(req.orgId, current => {
    const decision = current.decisions.find(item => item.id === req.params.id);
    if (!decision) return current;
    if (decision.risk === 'Critical' && status === 'Approved' && !['management', 'admin'].includes(req.user.role)) throw Object.assign(new Error('Critical decisions require Management or Administrator approval.'), { status: 403 });
    if (decision.risk === 'Critical' && status.startsWith('Approved') && clean(approvalNote).length < 20) throw Object.assign(new Error('Critical approvals require a substantive approval note.'), { status: 400 });
    decision.status = status;
    if (clean(rationale)) decision.rationale = clean(rationale, decision.rationale, 2000);
    decision.updatedAt = new Date().toISOString();
    decision.lastActionBy = req.user.email;
    decision.approvalNote = clean(approvalNote, '', 2000);
    found = decision;
    return recalculateState(current);
  });
  if (!found) return res.status(404).json({ error: 'Decision not found.' });
  await audit(req, 'decision.status.changed', 'decision', found.id, { status, risk: found.risk });
  res.json({ decision: found, state });
}));

app.patch('/api/tasks/:id', auth, route(async (req, res) => {
  const valid = ['Not started', 'Ready', 'In progress', 'Blocked', 'Evidence review', 'Completed'];
  const status = req.body.status;
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid task status.' });
  let found;
  const state = await mutateState(req.orgId, current => {
    const task = current.tasks.find(item => item.id === req.params.id);
    if (!task) return current;
    task.status = status;
    task.blocker = clean(req.body.blocker, task.blocker, 500);
    task.updatedAt = new Date().toISOString();
    found = task;
    return recalculateState(current);
  });
  if (!found) return res.status(404).json({ error: 'Task not found.' });
  await audit(req, 'task.status.changed', 'task', found.id, { status });
  res.json({ task: found, state });
}));

app.post('/api/evidence', auth, route(async (req, res) => {
  const title = clean(req.body.title, '', 200);
  const entity = clean(req.body.entity, '', 120);
  if (!title || !entity) return res.status(400).json({ error: 'Evidence title and linked entity are required.' });
  const evidence = { id: crypto.randomUUID(), title, entity, status: 'Pending verification', verifiedBy: '', date: new Date().toISOString().slice(0, 10), note: clean(req.body.note, '', 1000) };
  const state = await mutateState(req.orgId, current => { current.evidence.unshift(evidence); return recalculateState(current); });
  await audit(req, 'evidence.added', 'evidence', evidence.id, { entity });
  res.status(201).json({ evidence, state });
}));

app.patch('/api/evidence/:id', auth, allow('admin', 'legal', 'compliance', 'risk', 'audit', 'management'), route(async (req, res) => {
  const status = clean(req.body.status, '', 40);
  if (!['Verified', 'Rejected', 'Pending verification'].includes(status)) return res.status(400).json({ error: 'Invalid evidence status.' });
  let found;
  const state = await mutateState(req.orgId, current => {
    const item = current.evidence.find(value => value.id === req.params.id);
    if (!item) return current;
    item.status = status;
    item.verifiedBy = status === 'Pending verification' ? '' : req.user.email;
    item.verificationNote = clean(req.body.note, '', 1000);
    item.verifiedAt = status === 'Pending verification' ? null : new Date().toISOString();
    found = item;
    return recalculateState(current);
  });
  if (!found) return res.status(404).json({ error: 'Evidence not found.' });
  await audit(req, 'evidence.status.changed', 'evidence', found.id, { status });
  res.json({ evidence: found, state });
}));

app.post('/api/simulations', auth, route(async (req, res) => {
  const name = clean(req.body.name, '', 200);
  if (!name) return res.status(400).json({ error: 'Scenario name is required.' });
  const probability = Math.max(1, Math.min(100, Number(req.body.probability || 30)));
  const impact = Math.max(1, Math.min(100, Number(req.body.impact || 70)));
  const state0 = await getState(req.orgId);
  const readiness = Math.max(5, Math.min(95, Math.round((state0.metrics.evidenceCoverage + (100 - state0.metrics.controlsAtRisk * 5)) / 2)));
  const simulation = { id: crypto.randomUUID(), name, probability, impact, readiness, recommendation: impact > readiness ? 'Create an approved response playbook, close control gaps and pre-position completion evidence.' : 'Maintain monitoring and test the response controls on the next assurance cycle.', generatedAt: new Date().toISOString() };
  const state = await mutateState(req.orgId, current => { current.simulations.unshift(simulation); return recalculateState(current); });
  await audit(req, 'simulation.created', 'simulation', simulation.id, { probability, impact, readiness });
  res.status(201).json({ simulation, state });
}));

app.post('/api/simulations/:id/response-plan', auth, route(async (req, res) => {
  let simulation;
  const state = await mutateState(req.orgId, current => {
    simulation = current.simulations.find(item => item.id === req.params.id);
    if (!simulation) return current;
    const stamp = Date.now().toString(36);
    current.decisions.unshift({ id: `sim-dec-${stamp}`, title: `Approve response plan: ${simulation.name}`, matter: 'Scenario response governance', risk: simulation.impact >= 80 ? 'Critical' : 'High', status: 'Pending', owner: 'Risk / Management', due: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), rationale: simulation.recommendation, approvals: [{ role: 'Risk', status: 'Pending' }, { role: 'Management', status: 'Pending' }], simulationId: simulation.id });
    ['Validate trigger and decision rights', 'Test operational response playbook', 'Pre-position completion evidence'].forEach((title, index) => current.tasks.unshift({ id: `sim-task-${stamp}-${index}`, title: `${title}: ${simulation.name}`, owner: index === 0 ? 'Risk' : index === 1 ? 'Operations' : 'Compliance', due: new Date(Date.now() + (index + 2) * 86400000).toISOString().slice(0, 10), status: 'Not started', priority: simulation.impact >= 80 ? 'Critical' : 'High', blocker: '', simulationId: simulation.id, evidenceRequired: ['Owner confirmation', 'Test result', 'Approval record'] }));
    return recalculateState(current);
  });
  if (!simulation) return res.status(404).json({ error: 'Simulation not found.' });
  await audit(req, 'simulation.response-plan.created', 'simulation', simulation.id, {});
  res.status(201).json({ state });
}));

app.post('/api/regulatory-change', auth, allow('admin', 'legal', 'compliance', 'risk', 'audit', 'management'), route(async (req, res) => {
  const title = clean(req.body.title, '', 240);
  if (!title) return res.status(400).json({ error: 'Change title is required.' });
  const impact = { id: crypto.randomUUID(), title, source: clean(req.body.source, 'Controlled source registry', 160), effectiveDate: clean(req.body.effectiveDate, 'To be confirmed', 40), severity: clean(req.body.severity, 'High', 30), status: 'New impact assessment', affected: { documents: 0, controls: 0, products: 0, vendors: 0, systems: 0, teams: 0 }, confidence: 50, verification: 'Human source verification required' };
  const state = await mutateState(req.orgId, current => { current.impacts.unshift(impact); current.alerts.unshift({ id: crypto.randomUUID(), severity: impact.severity, title: impact.title, owner: 'Compliance', due: impact.effectiveDate, why: 'New source change requires mapping and verification.', next: 'Verify source and launch impact assessment' }); return recalculateState(current); });
  await audit(req, 'regulatory.change.registered', 'impact', impact.id, { source: impact.source });
  res.status(201).json({ impact, state });
}));


app.post('/api/regulatory-updates', auth, allow('admin', 'legal', 'compliance', 'risk', 'audit', 'management'), route(async (req, res) => {
  const title = clean(req.body.title, '', 240);
  const regulator = clean(req.body.regulator, '', 120);
  if (!title || !regulator) return res.status(400).json({ error: 'Title and regulator are required.' });
  const update = {
    id: crypto.randomUUID(),
    title,
    regulator,
    jurisdiction: clean(req.body.jurisdiction, 'Not specified', 100),
    publishedDate: clean(req.body.publishedDate, 'Unverified', 40),
    effectiveDate: clean(req.body.effectiveDate, 'To be confirmed', 40),
    status: 'Source verification required',
    severity: ['Critical', 'High', 'Medium', 'Low'].includes(req.body.severity) ? req.body.severity : 'High',
    domains: Array.isArray(req.body.domains) ? req.body.domains.map(value => clean(value, '', 80)).filter(Boolean).slice(0, 12) : clean(req.body.domains, '', 500).split(',').map(value => value.trim()).filter(Boolean).slice(0, 12),
    summary: clean(req.body.summary, 'Awaiting verified source analysis.', 1500),
    sourceReference: clean(req.body.sourceReference, '', 1000),
    affectedClauseTypes: Array.isArray(req.body.affectedClauseTypes) ? req.body.affectedClauseTypes.slice(0, 20) : [],
    mappedItems: 0,
    confidence: 25,
    owner: clean(req.body.owner, 'Compliance', 100),
    createdAt: new Date().toISOString(),
    createdBy: req.user.email
  };
  const state = await mutateState(req.orgId, current => {
    current.regulatoryUpdates.unshift(update);
    current.alerts.unshift({ id: crypto.randomUUID(), severity: update.severity, title: update.title, owner: update.owner, due: update.effectiveDate, why: 'A registered regulatory proposition requires source verification and impact mapping.', next: 'Verify source and map impact' });
    return recalculateState(current);
  });
  await audit(req, 'regulatory.update.registered', 'regulatory-update', update.id, { regulator, jurisdiction: update.jurisdiction });
  res.status(201).json({ update, state });
}));

app.patch('/api/regulatory-updates/:id/verify', auth, allow('admin', 'legal', 'compliance', 'risk', 'audit', 'management'), route(async (req, res) => {
  const verificationNote = clean(req.body.verificationNote, '', 2000);
  const sourceReference = clean(req.body.sourceReference, '', 1000);
  if (verificationNote.length < 20 || sourceReference.length < 8) return res.status(400).json({ error: 'A substantive verification note and source reference are required.' });
  let found;
  const state = await mutateState(req.orgId, current => {
    found = current.regulatoryUpdates.find(item => item.id === req.params.id);
    if (!found) return current;
    found.status = 'Verified and mapped';
    found.verificationNote = verificationNote;
    found.sourceReference = sourceReference;
    found.confidence = Math.max(60, Math.min(100, Number(req.body.confidence || 85)));
    found.mappedItems = Math.max(0, Number(req.body.mappedItems || found.mappedItems || 0));
    found.verifiedBy = req.user.email;
    found.verifiedAt = new Date().toISOString();
    return recalculateState(current);
  });
  if (!found) return res.status(404).json({ error: 'Regulatory update not found.' });
  await audit(req, 'regulatory.update.verified', 'regulatory-update', found.id, { confidence: found.confidence, mappedItems: found.mappedItems });
  res.json({ update: found, state });
}));

app.post('/api/clause-memory/feedback', auth, allow('admin', 'legal', 'compliance', 'risk', 'management'), route(async (req, res) => {
  const clauseId = clean(req.body.clauseId, '', 120);
  const action = clean(req.body.action, '', 80);
  const lesson = clean(req.body.lesson, '', 1200);
  if (!clauseId || !action || lesson.length < 12) return res.status(400).json({ error: 'Clause, action and a substantive lesson are required.' });
  const event = { id: crypto.randomUUID(), clauseId, action, lesson, recordedAt: new Date().toISOString(), source: clean(req.body.source, 'User-validated feedback', 200), recordedBy: req.user.email, status: 'Validated human feedback' };
  const state = await mutateState(req.orgId, current => {
    current.clauseMemory.feedbackEvents.unshift(event);
    current.clauseMemory.feedbackEvents = current.clauseMemory.feedbackEvents.slice(0, 500);
    current.clauseMemory.coverage = Math.min(100, Number(current.clauseMemory.coverage || 0) + 1);
    return recalculateState(current);
  });
  await audit(req, 'clause-memory.feedback.recorded', 'clause-memory', event.id, { clauseId, action });
  res.status(201).json({ event, state });
}));

app.post('/api/litigation-simulations', auth, route(async (req, res) => {
  const name = clean(req.body.name, '', 220);
  const event = clean(req.body.event, '', 1200);
  if (!name || !event) return res.status(400).json({ error: 'Scenario name and event are required.' });
  const baseProbability = Math.max(1, Math.min(95, Number(req.body.probability || 30)));
  const clauseStrength = Math.max(1, Math.min(100, Number(req.body.clauseStrength || 55)));
  const evidenceStrength = Math.max(1, Math.min(100, Number(req.body.evidenceStrength || 50)));
  const proceduralRisk = Math.max(1, Math.min(100, Number(req.body.proceduralRisk || 45)));
  const probability = Math.round(Math.max(2, Math.min(95, baseProbability * 0.55 + proceduralRisk * 0.25 + (100 - evidenceStrength) * 0.2)));
  const enforceability = Math.round(Math.max(5, Math.min(95, clauseStrength * 0.65 + evidenceStrength * 0.25 + (100 - proceduralRisk) * 0.1)));
  const confidence = Math.round(Math.max(20, Math.min(75, 30 + Math.abs(clauseStrength - 50) * 0.12 + Math.abs(evidenceStrength - 50) * 0.12)));
  const simulation = {
    id: crypto.randomUUID(), name,
    clauseType: clean(req.body.clauseType, 'Document-wide', 120),
    jurisdiction: clean(req.body.jurisdiction, 'Not specified', 120),
    event,
    probability,
    enforceability,
    exposure: Math.max(0, Number(req.body.exposure || 0)),
    confidence,
    status: 'Illustrative — not legal prediction',
    keyDrivers: ['Clause strength', 'Evidence strength', 'Procedural risk', 'Input probability'],
    recommendation: enforceability < 60 ? 'Strengthen drafting, evidence and dispute-response mechanics before relying on this position.' : 'Retain supporting evidence and obtain jurisdiction-specific authorised advice before acting.',
    inputs: { baseProbability, clauseStrength, evidenceStrength, proceduralRisk },
    generatedAt: new Date().toISOString(),
    generatedBy: req.user.email
  };
  const state = await mutateState(req.orgId, current => { current.litigationSimulations.unshift(simulation); return recalculateState(current); });
  await audit(req, 'litigation.simulation.created', 'litigation-simulation', simulation.id, simulation.inputs);
  res.status(201).json({ simulation, state });
}));

app.patch('/api/governance-frameworks/:id', auth, allow('admin', 'legal', 'compliance', 'risk', 'cyber', 'audit', 'management'), route(async (req, res) => {
  const readiness = Math.max(0, Math.min(100, Number(req.body.readiness)));
  let found;
  const state = await mutateState(req.orgId, current => {
    found = current.governanceFrameworks.find(item => item.id === req.params.id);
    if (!found) return current;
    found.readiness = readiness;
    found.status = readiness < 55 ? 'At risk' : readiness < 75 ? 'Attention' : 'Prepared';
    if (Array.isArray(req.body.gaps)) found.gaps = req.body.gaps.map(value => clean(value, '', 200)).filter(Boolean).slice(0, 20);
    found.assessedBy = req.user.email;
    found.assessedAt = new Date().toISOString();
    return recalculateState(current);
  });
  if (!found) return res.status(404).json({ error: 'Governance framework not found.' });
  await audit(req, 'governance.framework.assessed', 'governance-framework', found.id, { readiness });
  res.json({ framework: found, state });
}));

app.post('/api/financial-scenario', auth, allow('admin', 'management'), route(async (req, res) => {
  const startingRevenueCr = Math.max(0, Number(req.body.startingRevenueCr || 1));
  const annualGrowthPercent = Math.max(-50, Math.min(500, Number(req.body.annualGrowthPercent || 100)));
  const startingCostCr = Math.max(0, Number(req.body.startingCostCr || 4));
  const costGrowthPercent = Math.max(-50, Math.min(300, Number(req.body.costGrowthPercent || 55)));
  const years = [];
  let revenue = startingRevenueCr;
  let cost = startingCostCr;
  for (let year = 1; year <= 5; year += 1) {
    years.push({ year, revenueCr: Number(revenue.toFixed(2)), operatingCostCr: Number(cost.toFixed(2)), cashFlowCr: Number((revenue - cost).toFixed(2)), grossMargin: Math.max(0, Math.min(95, Math.round(55 + year * 7))) });
    revenue *= 1 + annualGrowthPercent / 100;
    cost *= 1 + costGrowthPercent / 100;
  }
  const state = await mutateState(req.orgId, current => {
    current.financialScenario = { ...current.financialScenario, label: 'Illustrative management scenario — not a forecast or investment representation', years, assumptions: { startingRevenueCr, annualGrowthPercent, startingCostCr, costGrowthPercent }, generatedAt: new Date().toISOString(), generatedBy: req.user.email };
    return recalculateState(current);
  });
  await audit(req, 'financial.scenario.generated', 'financial-scenario', req.orgId, { startingRevenueCr, annualGrowthPercent, startingCostCr, costGrowthPercent });
  res.json({ scenario: state.financialScenario, state });
}));

app.get('/api/platform/export', auth, allow('admin', 'legal', 'compliance', 'risk', 'audit', 'management'), route(async (req, res) => {
  const state = recalculateState(await getState(req.orgId));
  const pack = {
    generatedAt: new Date().toISOString(),
    product: state.product,
    metrics: state.metrics,
    regulatoryUpdates: state.regulatoryUpdates,
    clauseMemory: state.clauseMemory,
    litigationSimulations: state.litigationSimulations,
    governanceFrameworks: state.governanceFrameworks,
    businessModel: state.businessModel,
    financialScenario: state.financialScenario,
    ipPortfolio: state.ipPortfolio,
    roadmap: state.roadmap,
    deliveryModes: state.deliveryModes,
    verticals: state.verticals,
    investorReadiness: state.investorReadiness,
    provenance: { generatedBy: req.user.email, autonomousHighRiskExecution: false, verifiedClaimsOnly: true }
  };
  await audit(req, 'platform.export.generated', 'organization', req.orgId, {});
  res.json({ pack });
}));

app.get('/api/reports/assurance-pack', auth, allow('admin', 'legal', 'compliance', 'risk', 'audit', 'management'), route(async (req, res) => {
  const state = await getState(req.orgId);
  const documents = await listDocuments(req.orgId, 300);
  const report = {
    generatedAt: new Date().toISOString(),
    organization: config.organizationName,
    metrics: state.metrics,
    criticalObligations: state.obligations.filter(item => item.risk === 'Critical'),
    pendingDecisions: state.decisions.filter(item => ['Pending', 'Challenge'].includes(item.status)),
    overdueTasks: state.tasks.filter(item => item.status !== 'Completed' && isOverdue(item.due)),
    unverifiedEvidence: state.evidence.filter(item => item.status !== 'Verified'),
    regulatoryUpdates: state.regulatoryUpdates,
    clauseMemoryCoverage: state.clauseMemory.coverage,
    litigationSimulations: state.litigationSimulations,
    governanceFrameworks: state.governanceFrameworks,
    documents,
    provenance: { generatedBy: req.user.email, storage: healthStorage(), autonomousHighRiskExecution: false, verifiedClaimsOnly: true }
  };
  await audit(req, 'report.assurance-pack.generated', 'organization', req.orgId, { documents: documents.length });
  res.json({ report });
}));

app.get('/api/admin/users', auth, allow('admin'), route(async (req, res) => res.json({ users: (await listUsers(req.orgId)).map(publicUser) })));
app.post('/api/admin/users', auth, allow('admin'), route(async (req, res) => {
  const value = parse(userSchema, req.body);
  if (await getUserByEmail(value.email)) return res.status(409).json({ error: 'A user with that email already exists.' });
  const user = await createUser({ orgId: req.orgId, name: value.name, email: value.email, role: value.role, passwordHash: bcrypt.hashSync(value.temporaryPassword, 12) });
  await audit(req, 'admin.user.created', 'user', user.id, { role: user.role });
  res.status(201).json({ user: publicUser(user) });
}));
app.patch('/api/admin/users/:id', auth, allow('admin'), route(async (req, res) => {
  if (req.params.id === req.user.id && req.body.isActive === false) return res.status(400).json({ error: 'You cannot deactivate your own account.' });
  await setUserActive(req.params.id, Boolean(req.body.isActive));
  const user = await getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  await audit(req, 'admin.user.status.changed', 'user', user.id, { isActive: Boolean(req.body.isActive) });
  res.json({ user: publicUser(user) });
}));
app.get('/api/admin/audit', auth, allow('admin', 'audit', 'management'), route(async (req, res) => res.json({ audit: await listAudit(req.orgId, Math.min(500, Number(req.query.limit || 300))) })));

if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist, { index: false, maxAge: config.production ? '1h' : 0 }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(config.clientDist, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((error, req, res, next) => {
  console.error(`[${req.requestId}]`, error);
  const status = error.status || (error.code === '23505' ? 409 : 500);
  res.status(status).json({ error: status >= 500 ? 'The request could not be completed.' : error.message, detail: config.production ? undefined : String(error.stack || error), requestId: req.requestId });
});

app.listen(config.port, () => {
  console.log(`SYNESIS Neuro-Symbolic Platform v4 listening on http://localhost:${config.port}`);
});
