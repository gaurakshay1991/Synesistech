import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import OpenAI from 'openai';
import { extractDocumentText } from './file-parser.js';
import { analyzeDocument, compareAnalyses } from './analysis-engine.js';
import {
  addDecision,
  dashboardMetrics,
  deleteDocument,
  getDocument,
  listAudit,
  listDocuments,
  logAudit,
  saveDocument,
  updateDocument
} from './storage.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../..');
const CLIENT_DIST = path.join(ROOT_DIR, 'client', 'dist');
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_change_me_now';
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 25);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const openai = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('paste_your')
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

if (IS_PRODUCTION && JWT_SECRET === 'dev_change_me_now') {
  console.warn('SECURITY WARNING: Set JWT_SECRET in Replit Secrets before sharing LIVE SYNESIS.');
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 }
});

const users = [
  { role: 'admin', email: process.env.ADMIN_EMAIL || 'admin@synesis.local', password: process.env.ADMIN_PASSWORD || 'ChangeThisAdminPassword123!' },
  { role: 'legal', email: process.env.LEGAL_EMAIL || 'legal@synesis.local', password: process.env.LEGAL_PASSWORD || 'LegalDemoOnly123!' },
  { role: 'compliance', email: process.env.COMPLIANCE_EMAIL || 'compliance@synesis.local', password: process.env.COMPLIANCE_PASSWORD || 'ComplianceDemoOnly123!' },
  { role: 'kyc', email: process.env.KYC_EMAIL || 'kyc@synesis.local', password: process.env.KYC_PASSWORD || 'KycDemoOnly123!' },
  { role: 'management', email: process.env.MANAGEMENT_EMAIL || 'management@synesis.local', password: process.env.MANAGEMENT_PASSWORD || 'ManagementDemoOnly123!' }
];

app.disable('x-powered-by');
if (IS_PRODUCTION) app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));
app.use(rateLimit({
  windowMs: 60_000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait and try again.' }
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' }
});

function issueToken(user) {
  return jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '8h',
    issuer: 'live-synesis'
  });
}

function auth(req, res, next) {
  try {
    const raw = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!raw) return res.status(401).json({ error: 'Login required' });
    req.user = jwt.verify(raw, JWT_SECRET, { issuer: 'live-synesis' });
    next();
  } catch {
    res.status(401).json({ error: 'Session expired or invalid' });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) return res.status(403).json({ error: 'Your role cannot perform this action.' });
    next();
  };
}

function optionsFromBody(body = {}, fileName = '') {
  return {
    title: body.title?.trim() || fileName.replace(/\.[^.]+$/, '') || 'Uploaded document',
    fileName,
    documentType: body.documentType || 'Auto-detect',
    matter: body.matter || 'Unassigned matter',
    jurisdiction: body.jurisdiction || 'India',
    riskAppetite: body.riskAppetite || 'Conservative'
  };
}

async function audit(req, action, meta = {}) {
  await logAudit({
    user: req.user?.email || 'anonymous',
    role: req.user?.role || 'unknown',
    action,
    meta
  });
}

app.get('/api/health', (_, res) => {
  res.json({
    ok: true,
    product: 'LIVE SYNESIS',
    version: '2.1.0',
    model: MODEL,
    openaiConfigured: Boolean(openai),
    storageEncryption: true,
    supportedUploads: ['PDF', 'DOCX', 'TXT', 'CSV', 'JSON', 'MD'],
    maxUploadMb: MAX_UPLOAD_MB
  });
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = users.find(item => item.email.toLowerCase() === email && item.password === password);
  if (!user) {
    await logAudit({ user: email || 'unknown', role: 'unknown', action: 'auth.login.failed', meta: {} });
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  await logAudit({ user: user.email, role: user.role, action: 'auth.login', meta: {} });
  res.json({ token: issueToken(user), user: { email: user.email, role: user.role } });
});

app.get('/api/dashboard', auth, async (req, res, next) => {
  try {
    res.json(await dashboardMetrics());
  } catch (error) {
    next(error);
  }
});

app.get('/api/documents', auth, async (req, res, next) => {
  try {
    res.json({ documents: await listDocuments() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/documents/:id', auth, async (req, res, next) => {
  try {
    const document = await getDocument(req.params.id, false);
    if (!document) return res.status(404).json({ error: 'Document not found' });
    res.json({ document });
  } catch (error) {
    next(error);
  }
});

app.post(
  '/api/documents/analyze',
  auth,
  allowRoles('admin', 'legal', 'compliance', 'kyc'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const parsed = await extractDocumentText(req.file, req.body.text || '');
      const options = optionsFromBody(req.body, parsed.fileName);
      await audit(req, 'document.analysis.started', {
        fileName: parsed.fileName,
        parser: parsed.parser,
        chars: parsed.text.length
      });

      const analysis = await analyzeDocument({ openai, model: MODEL, text: parsed.text, options });
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
        extractedText: parsed.text,
        analysis,
        uploadedBy: req.user.email,
        status: 'AI Review Complete'
      });

      await audit(req, 'document.analysis.completed', {
        documentId: document.id,
        risk: analysis.overall_risk,
        score: analysis.overall_score,
        findings: analysis.findings.length,
        engine: analysis.engine
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
  allowRoles('admin', 'legal', 'compliance', 'kyc'),
  async (req, res, next) => {
    try {
      const current = await getDocument(req.params.id, true);
      if (!current) return res.status(404).json({ error: 'Document not found' });
      const options = {
        title: current.title,
        fileName: current.originalFileName,
        documentType: req.body.documentType || current.documentType || 'Auto-detect',
        matter: req.body.matter || current.matter,
        jurisdiction: req.body.jurisdiction || current.jurisdiction,
        riskAppetite: req.body.riskAppetite || current.riskAppetite
      };
      const analysis = await analyzeDocument({ openai, model: MODEL, text: current.extractedText, options });
      const document = await updateDocument(current.id, { ...current, analysis, status: 'AI Review Complete' });
      await audit(req, 'document.reanalyzed', {
        documentId: current.id,
        score: analysis.overall_score,
        engine: analysis.engine
      });
      res.json({ document });
    } catch (error) {
      next(error);
    }
  }
);

app.post('/api/documents/:id/decision', auth, async (req, res, next) => {
  try {
    const document = await addDecision(req.params.id, {
      findingId: req.body.findingId,
      status: req.body.status,
      comment: req.body.comment,
      user: req.user.email
    });
    if (!document) return res.status(404).json({ error: 'Document not found' });
    await audit(req, 'document.decision', {
      documentId: req.params.id,
      findingId: req.body.findingId,
      status: req.body.status
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
      const removed = await deleteDocument(req.params.id);
      if (!removed) return res.status(404).json({ error: 'Document not found' });
      await audit(req, 'document.deleted', { documentId: req.params.id });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
);

app.post('/api/documents/compare', auth, async (req, res, next) => {
  try {
    const left = await getDocument(req.body.leftId, false);
    const right = await getDocument(req.body.rightId, false);
    if (!left || !right) return res.status(404).json({ error: 'Both documents are required for comparison' });
    const comparison = compareAnalyses(left.analysis, right.analysis);
    await audit(req, 'documents.compared', {
      leftId: left.id,
      rightId: right.id,
      scoreDelta: comparison.score_delta
    });
    res.json({ comparison });
  } catch (error) {
    next(error);
  }
});

app.post('/api/documents/:id/ask', auth, async (req, res, next) => {
  try {
    const document = await getDocument(req.params.id, true);
    if (!document) return res.status(404).json({ error: 'Document not found' });
    const question = String(req.body.question || '').trim();
    if (!question) return res.status(400).json({ error: 'Question is required' });

    if (!openai) {
      const findings = document.analysis?.findings || [];
      const fallback = findings
        .slice(0, 8)
        .map(item => `${item.risk_level}: ${item.issue} — ${item.why_risky_for_bank}`)
        .join('\n');
      return res.json({ answer: fallback || 'No findings are available for the active document.', mode: 'baseline' });
    }

    const response = await openai.responses.create({
      model: MODEL,
      input: `You are LIVE SYNESIS. Answer only from the active uploaded document and its analysis. Refer to the customer as the Bank. Distinguish document evidence from professional inference. If the document does not support the answer, say so.\n\nQUESTION\n${question}\n\nDOCUMENT TEXT\n${document.extractedText.slice(0, 100000)}\n\nCURRENT FINDINGS\n${JSON.stringify(document.analysis, null, 2).slice(0, 50000)}`
    });
    await audit(req, 'document.question', { documentId: document.id, question });
    res.json({ answer: response.output_text || 'No answer returned.', mode: 'openai' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/audit', auth, allowRoles('admin'), async (req, res, next) => {
  try {
    res.json({ audit: await listAudit() });
  } catch (error) {
    next(error);
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST, {
    etag: true,
    maxAge: IS_PRODUCTION ? '1h' : 0,
    index: false
  }));
  app.get('*', (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
} else {
  app.get('/', (_, res) => {
    res.status(503).send('LIVE SYNESIS frontend is not built. Run npm run build.');
  });
}

app.use((error, req, res, next) => {
  console.error(error);
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: error.code === 'LIMIT_FILE_SIZE'
        ? `File exceeds ${MAX_UPLOAD_MB} MB limit`
        : error.message
    });
  }
  const status = /unsupported file|too short|upload a document|did not contain enough/i.test(error.message)
    ? 400
    : 500;
  res.status(status).json({
    error: 'LIVE SYNESIS request failed',
    ...(IS_PRODUCTION ? {} : { detail: error.message })
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`LIVE SYNESIS running on port ${PORT}`);
  console.log(`OpenAI analysis: ${openai ? `enabled with ${MODEL}` : 'not configured; baseline engine active'}`);
  console.log(`Frontend: ${fs.existsSync(CLIENT_DIST) ? 'served by LIVE SYNESIS' : 'not built'}`);
});

function shutdown(signal) {
  console.log(`${signal} received. Closing LIVE SYNESIS.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
