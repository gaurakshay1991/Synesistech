import fs from 'node:fs';
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
import { extractDocumentText } from './file-parser.js';
import { analyzeDocument, compareAnalyses } from './analysis-engine.js';
import {
  addDecision,
  createUser,
  dashboardMetrics,
  deleteDocument,
  ensureOrganization,
  getDocument,
  getUserByEmail,
  getUserById,
  listAudit,
  listDocuments,
  listUsers,
  logAudit,
  platformStorageStatus,
  saveDocument,
  setUserActive,
  touchUserLogin,
  updateDocument,
  updateUserPassword,
  usingDatabase
} from './storage.js';

const app = express();
const SESSION_COOKIE = 'synesis_session';
const openai = config.openaiKey && !/(set_in|paste|replace|your_key)/i.test(config.openaiKey)
  ? new OpenAI({ apiKey: config.openaiKey, timeout: 55_000, maxRetries: 1 })
  : null;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxUploadMb * 1024 * 1024,
    files: 1,
    fields: 12
  }
});

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(256)
});
const passwordSchema = z.object({
  currentPassword: z.string().min(8).max(256),
  newPassword: z.string().min(12).max(256)
    .regex(/[A-Z]/, 'Use at least one uppercase letter.')
    .regex(/[a-z]/, 'Use at least one lowercase letter.')
    .regex(/[0-9]/, 'Use at least one number.')
    .regex(/[^A-Za-z0-9]/, 'Use at least one symbol.')
});
const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(254),
  role: z.enum(['admin', 'legal', 'compliance', 'kyc', 'management', 'risk', 'business']),
  temporaryPassword: z.string().min(12).max(256)
});
const decisionSchema = z.object({
  findingId: z.string().max(160).nullable().optional(),
  status: z.enum(['Commented', 'Assigned', 'Escalated', 'Accepted With Controls', 'Resolved', 'Rejected']),
  documentStatus: z.enum(['AI Review Complete', 'In Legal Review', 'In Compliance Review', 'Escalated', 'Final Approved', 'Rejected', 'Closed']).optional(),
  comment: z.string().trim().max(4000).default('')
});
const compareSchema = z.object({
  leftId: z.string().uuid(),
  rightId: z.string().uuid()
}).refine(value => value.leftId !== value.rightId, 'Select two different documents.');
const askSchema = z.object({
  question: z.string().trim().min(3).max(2000)
});

let platformReady;

async function initializePlatform() {
  if (platformReady) return platformReady;
  platformReady = (async () => {
    assertProductionConfig();
    const organization = await ensureOrganization({
      name: config.organizationName,
      slug: config.organizationSlug
    });
    const admin = config.bootstrapAdmin;
    let existing = admin.email ? await getUserByEmail(admin.email) : null;
    if (!existing) {
      if (!admin.email || !admin.password) {
        if (config.production) throw new Error('A bootstrap administrator is required.');
        admin.email = 'admin@synesis.local';
        admin.password = 'LocalDevOnly!Change123';
        admin.name = 'Local Administrator';
      }
      const passwordHash = await bcrypt.hash(admin.password, 12);
      existing = await createUser({
        organizationId: organization.id,
        name: admin.name,
        email: admin.email,
        role: 'admin',
        passwordHash,
        isActive: true,
        mustChangePassword: true
      });
    }
    return { organization, adminId: existing.id };
  })().catch(error => {
    platformReady = null;
    throw error;
  });
  return platformReady;
}

function parse(schema, value) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const message = result.error.issues.map(issue => issue.message).join(' ');
  const error = new Error(message || 'Invalid request.');
  error.status = 400;
  throw error;
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function issueToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      org: user.organizationId,
      email: user.email,
      role: user.role,
      name: user.name
    },
    config.jwtSecret,
    { expiresIn: '8h', issuer: 'live-synesis', audience: 'live-synesis-web' }
  );
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.production,
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/'
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: config.production,
    sameSite: 'strict',
    path: '/'
  });
}

async function auth(req, res, next) {
  try {
    await initializePlatform();
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const raw = req.cookies?.[SESSION_COOKIE] || bearer;
    if (!raw) return res.status(401).json({ error: 'Login required' });
    const claims = jwt.verify(raw, config.jwtSecret, {
      issuer: 'live-synesis',
      audience: 'live-synesis-web'
    });
    const user = await getUserById(claims.sub);
    if (!user?.isActive) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'This account is inactive.' });
    }
    req.user = user;
    req.tenant = { organizationId: user.organizationId };
    const passwordSetupRoute = ['/api/auth/session', '/api/auth/logout', '/api/auth/change-password']
      .includes(req.originalUrl.split('?')[0]);
    if (user.mustChangePassword && !passwordSetupRoute) {
      return res.status(428).json({ error: 'Change the temporary password before using the workspace.' });
    }
    next();
  } catch (error) {
    clearSessionCookie(res);
    if (/jwt|token|expired|signature/i.test(error.message)) {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }
    next(error);
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Your role cannot perform this action.' });
    }
    next();
  };
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

function optionsFromBody(body = {}, fileName = '') {
  const title = String(body.title || '').trim();
  const matter = String(body.matter || '').trim();
  return {
    title: title || String(fileName).replace(/\.[^.]+$/, '') || 'Uploaded document',
    fileName,
    documentType: String(body.documentType || 'Auto-detect').slice(0, 120),
    matter: matter || 'General review',
    jurisdiction: String(body.jurisdiction || 'India').slice(0, 100),
    riskAppetite: String(body.riskAppetite || 'Conservative').slice(0, 60)
  };
}

async function audit(req, action, details = {}) {
  await logAudit({
    organizationId: req.user?.organizationId || null,
    userId: req.user?.id || null,
    userEmail: req.user?.email || details.userEmail || 'anonymous',
    role: req.user?.role || details.role || 'unknown',
    action,
    entityType: details.entityType,
    entityId: details.entityId,
    metadata: details.metadata || {},
    requestId: req.requestId,
    ipAddress: String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim().slice(0, 80)
  });
}

function sameDocumentFallback(document, question) {
  const terms = question.toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 3);
  const findings = (document.analysis?.findings || [])
    .map(item => ({
      item,
      score: terms.reduce((sum, term) => sum + JSON.stringify(item).toLowerCase().includes(term), 0)
    }))
    .sort((a, b) => b.score - a.score)
    .filter(entry => entry.score > 0)
    .slice(0, 6)
    .map(entry => `${entry.item.risk_level}: ${entry.item.issue}\nEvidence: ${entry.item.quoted_text}\nPosition: ${entry.item.why_risky_for_bank}\nAction: ${entry.item.recommended_mitigation}`)
    .join('\n\n');
  return findings || 'The active document analysis does not contain enough evidence to answer that question reliably.';
}

app.disable('x-powered-by');
if (config.production) app.set('trust proxy', 1);
app.use((req, res, next) => {
  req.requestId = req.get('x-request-id') || crypto.randomUUID();
  res.set('x-request-id', req.requestId);
  next();
});
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));
app.use(cors({
  credentials: true,
  origin: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(originGuard);
app.use(rateLimit({
  windowMs: 60_000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => req.user?.id || req.ip,
  message: { error: 'Too many requests. Please wait and try again.' }
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' }
});

app.get('/api/health', async (req, res, next) => {
  try {
    await initializePlatform();
    res.json({
      ok: true,
      product: 'LIVE SYNESIS',
      version: '3.0.0',
      model: config.openaiModel,
      ai: openai ? 'configured-with-safe-fallback' : 'baseline-fallback',
      storage: platformStorageStatus(),
      databaseReady: usingDatabase,
      supportedUploads: ['PDF', 'DOCX', 'TXT', 'CSV', 'JSON', 'MD', 'XML'],
      maxUploadMb: config.maxUploadMb,
      time: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res, next) => {
  try {
    await initializePlatform();
    const credentials = parse(loginSchema, req.body);
    const user = await getUserByEmail(credentials.email);
    const valid = user?.isActive && await bcrypt.compare(credentials.password, user.passwordHash);
    if (!valid) {
      await logAudit({
        userEmail: credentials.email.toLowerCase(),
        role: 'unknown',
        action: 'auth.login.failed',
        metadata: {},
        requestId: req.requestId
      });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const token = issueToken(user);
    setSessionCookie(res, token);
    await touchUserLogin(user.id);
    req.user = user;
    await audit(req, 'auth.login');
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', auth, async (req, res, next) => {
  try {
    clearSessionCookie(res);
    await audit(req, 'auth.logout');
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/session', auth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post('/api/auth/change-password', auth, async (req, res, next) => {
  try {
    const values = parse(passwordSchema, req.body);
    const valid = await bcrypt.compare(values.currentPassword, req.user.passwordHash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect.' });
    const passwordHash = await bcrypt.hash(values.newPassword, 12);
    await updateUserPassword(req.user.id, req.tenant, passwordHash, false);
    await audit(req, 'auth.password.changed', { entityType: 'user', entityId: req.user.id });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/dashboard', auth, async (req, res, next) => {
  try {
    res.json(await dashboardMetrics(req.tenant));
  } catch (error) {
    next(error);
  }
});

app.get('/api/documents', auth, async (req, res, next) => {
  try {
    const documents = await listDocuments(req.tenant, {
      search: req.query.search,
      status: req.query.status,
      limit: req.query.limit
    });
    res.json({ documents });
  } catch (error) {
    next(error);
  }
});

app.get('/api/documents/:id', auth, async (req, res, next) => {
  try {
    const document = await getDocument(req.params.id, req.tenant, false);
    if (!document) return res.status(404).json({ error: 'Document not found' });
    res.json({ document });
  } catch (error) {
    next(error);
  }
});

app.post(
  '/api/documents/analyze',
  auth,
  allowRoles('admin', 'legal', 'compliance', 'kyc', 'risk'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const parsed = await extractDocumentText(req.file, req.body.text || '');
      const options = optionsFromBody(req.body, parsed.fileName);
      await audit(req, 'document.analysis.started', {
        entityType: 'document',
        metadata: {
          fileName: parsed.fileName,
          parser: parsed.parser,
          characters: parsed.text.length,
          sha256: parsed.contentSha256
        }
      });
      const analysis = await analyzeDocument({
        openai,
        model: config.openaiModel,
        text: parsed.text,
        options
      });
      const document = await saveDocument({
        title: options.title,
        matter: options.matter,
        jurisdiction: options.jurisdiction,
        riskAppetite: options.riskAppetite,
        documentType: analysis.document_type,
        originalFileName: parsed.fileName,
        mimeType: parsed.mimeType,
        sizeBytes: parsed.sizeBytes,
        parser: parsed.parser,
        truncated: Boolean(parsed.truncated),
        contentSha256: parsed.contentSha256,
        extractedText: parsed.text,
        analysis,
        uploadedById: req.user.id,
        uploadedBy: req.user.email,
        status: 'AI Review Complete'
      }, req.tenant);
      await audit(req, 'document.analysis.completed', {
        entityType: 'document',
        entityId: document.id,
        metadata: {
          risk: analysis.overall_risk,
          score: analysis.overall_score,
          findings: analysis.findings.length,
          engine: analysis.engine
        }
      });
      res.status(201).json({ document });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/api/documents/:id/reanalyze',
  auth,
  allowRoles('admin', 'legal', 'compliance', 'kyc', 'risk'),
  async (req, res, next) => {
    try {
      const current = await getDocument(req.params.id, req.tenant, true);
      if (!current) return res.status(404).json({ error: 'Document not found' });
      const options = {
        title: current.title,
        fileName: current.originalFileName,
        documentType: String(req.body.documentType || current.documentType || 'Auto-detect').slice(0, 120),
        matter: String(req.body.matter || current.matter).slice(0, 160),
        jurisdiction: String(req.body.jurisdiction || current.jurisdiction).slice(0, 100),
        riskAppetite: String(req.body.riskAppetite || current.riskAppetite).slice(0, 60)
      };
      const analysis = await analyzeDocument({
        openai,
        model: config.openaiModel,
        text: current.extractedText,
        options
      });
      const document = await updateDocument(current.id, req.tenant, {
        ...current,
        ...options,
        analysis,
        status: 'AI Review Complete'
      });
      await audit(req, 'document.reanalyzed', {
        entityType: 'document',
        entityId: current.id,
        metadata: { score: analysis.overall_score, engine: analysis.engine }
      });
      res.json({ document });
    } catch (error) {
      next(error);
    }
  }
);

app.post('/api/documents/:id/decision', auth, async (req, res, next) => {
  try {
    const values = parse(decisionSchema, req.body);
    const document = await addDecision(req.params.id, req.tenant, {
      ...values,
      user: req.user.email,
      userId: req.user.id
    });
    if (!document) return res.status(404).json({ error: 'Document not found' });
    await audit(req, 'document.decision', {
      entityType: 'document',
      entityId: req.params.id,
      metadata: {
        findingId: values.findingId,
        status: values.status,
        documentStatus: values.documentStatus
      }
    });
    res.json({ document });
  } catch (error) {
    next(error);
  }
});

app.delete(
  '/api/documents/:id',
  auth,
  allowRoles('admin', 'legal'),
  async (req, res, next) => {
    try {
      const removed = await deleteDocument(req.params.id, req.tenant);
      if (!removed) return res.status(404).json({ error: 'Document not found' });
      await audit(req, 'document.deleted', {
        entityType: 'document',
        entityId: req.params.id
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
);

app.post('/api/documents/compare', auth, async (req, res, next) => {
  try {
    const values = parse(compareSchema, req.body);
    const [left, right] = await Promise.all([
      getDocument(values.leftId, req.tenant, false),
      getDocument(values.rightId, req.tenant, false)
    ]);
    if (!left || !right) {
      return res.status(404).json({ error: 'Both documents are required for comparison.' });
    }
    const comparison = compareAnalyses(left.analysis, right.analysis);
    await audit(req, 'documents.compared', {
      entityType: 'comparison',
      metadata: {
        leftId: left.id,
        rightId: right.id,
        scoreDelta: comparison.score_delta
      }
    });
    res.json({ comparison });
  } catch (error) {
    next(error);
  }
});

app.post('/api/documents/:id/ask', auth, async (req, res, next) => {
  try {
    const document = await getDocument(req.params.id, req.tenant, true);
    if (!document) return res.status(404).json({ error: 'Document not found' });
    const { question } = parse(askSchema, req.body);
    let answer;
    let mode;
    if (!openai) {
      answer = sameDocumentFallback(document, question);
      mode = 'document-baseline';
    } else {
      try {
        const response = await openai.responses.create({
          model: config.openaiModel,
          input: [
            {
              role: 'system',
              content: [{
                type: 'input_text',
                text: 'You are LIVE SYNESIS. Answer only from the active uploaded document and its saved analysis. Clearly distinguish quoted document evidence from professional inference. If the document does not support an answer, say so. Do not invent law or citations.'
              }]
            },
            {
              role: 'user',
              content: [{
                type: 'input_text',
                text: `QUESTION\n${question}\n\nDOCUMENT\n${document.extractedText.slice(0, 110000)}\n\nSAVED ANALYSIS\n${JSON.stringify(document.analysis).slice(0, 45000)}`
              }]
            }
          ]
        });
        answer = response.output_text || 'No supported answer was returned.';
        mode = 'openai-document-grounded';
      } catch {
        answer = sameDocumentFallback(document, question);
        mode = 'document-baseline-fallback';
      }
    }
    await audit(req, 'document.question', {
      entityType: 'document',
      entityId: document.id,
      metadata: { question: question.slice(0, 300), mode }
    });
    res.json({ answer, mode });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/audit', auth, allowRoles('admin'), async (req, res, next) => {
  try {
    res.json({ audit: await listAudit(req.tenant, req.query.limit) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/users', auth, allowRoles('admin'), async (req, res, next) => {
  try {
    res.json({ users: await listUsers(req.tenant) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/users', auth, allowRoles('admin'), async (req, res, next) => {
  try {
    const values = parse(createUserSchema, req.body);
    if (await getUserByEmail(values.email)) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }
    const passwordHash = await bcrypt.hash(values.temporaryPassword, 12);
    const user = await createUser({
      organizationId: req.user.organizationId,
      name: values.name,
      email: values.email,
      role: values.role,
      passwordHash,
      isActive: true,
      mustChangePassword: true
    });
    await audit(req, 'admin.user.created', {
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email, role: user.role }
    });
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/admin/users/:id/status', auth, allowRoles('admin'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id && req.body.isActive === false) {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }
    const user = await setUserActive(req.params.id, req.tenant, Boolean(req.body.isActive));
    if (!user) return res.status(404).json({ error: 'User not found.' });
    await audit(req, 'admin.user.status.changed', {
      entityType: 'user',
      entityId: user.id,
      metadata: { isActive: user.isActive }
    });
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/users/:id/reset-password', auth, allowRoles('admin'), async (req, res, next) => {
  try {
    const temporaryPassword = String(req.body.temporaryPassword || '');
    parse(createUserSchema.pick({ temporaryPassword: true }), { temporaryPassword });
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const user = await updateUserPassword(req.params.id, req.tenant, passwordHash, true);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    await audit(req, 'admin.user.password.reset', {
      entityType: 'user',
      entityId: user.id
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist, {
    etag: true,
    maxAge: config.production ? '1h' : 0,
    index: false
  }));
  app.get('*', (req, res) => {
    res.sendFile(`${config.clientDist}/index.html`);
  });
}

app.use((error, req, res, next) => {
  const requestId = req.requestId || 'unknown';
  console.error(`[${requestId}]`, error?.stack || error?.message || error);
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: error.code === 'LIMIT_FILE_SIZE'
        ? `File exceeds the ${config.maxUploadMb} MB limit.`
        : error.message,
      requestId
    });
  }
  const knownClientError = /unsupported file|too short|upload a document|did not contain enough|invalid request|select two/i.test(error.message);
  const status = error.status || (knownClientError ? 400 : 500);
  res.status(status).json({
    error: status >= 500 ? 'LIVE SYNESIS could not complete the request.' : error.message,
    ...(!config.production && status >= 500 ? { detail: error.message } : {}),
    requestId
  });
});

export default app;
