import 'dotenv/config';
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
  getDocument,
  listAudit,
  listDocuments,
  logAudit,
  saveDocument,
  updateDocument
} from './storage.js';

const app = express();
const PORT = Number(process.env.PORT || 8080);
const MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_change_me_now';
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 25);
const openai = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('paste_your')
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

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

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));

function issueToken(user) {
  return jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
}

function auth(req, res, next) {
  try {
    const raw = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!raw) return res.status(401).json({ error: 'Login required' });
    req.user = jwt.verify(raw, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired or invalid' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
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
  await logAudit({ user: req.user?.email || 'anonymous', role: req.user?.role || 'unknown', action, meta });
}

app.get('/api/health', async (_, res) => {
  res.json({
    ok: true,
    product: 'LIVE SYNESIS',
    model: MODEL,
    openaiConfigured: Boolean(openai),
    supportedUploads: ['PDF', 'DOCX', 'TXT', 'CSV', 'JSON', 'MD'],
    maxUploadMb: MAX_UPLOAD_MB
  });
});

app.post('/api/auth/login', async (req, res) => {
  const user = users.find(item => item.email === req.body.email && item.password === req.body.password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
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

app.post('/api/documents/analyze', auth, upload.single('file'), async (req, res, next) => {
  try {
    const parsed = await extractDocumentText(req.file, req.body.text || '');
    const options = optionsFromBody(req.body, parsed.fileName);
    await audit(req, 'document.analysis.started', { fileName: parsed.fileName, parser: parsed.parser, chars: parsed.text.length });

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
});

app.post('/api/documents/:id/reanalyze', auth, async (req, res, next) => {
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
    await audit(req, 'document.reanalyzed', { documentId: current.id, score: analysis.overall_score, engine: analysis.engine });
    res.json({ document });
  } catch (error) {
    next(error);
  }
});

app.post('/api/documents/:id/decision', auth, async (req, res, next) => {
  try {
    const document = await addDecision(req.params.id, {
      findingId: req.body.findingId,
      status: req.body.status,
      comment: req.body.comment,
      user: req.user.email
    });
    if (!document) return res.status(404).json({ error: 'Document not found' });
    await audit(req, 'document.decision', { documentId: req.params.id, findingId: req.body.findingId, status: req.body.status });
    res.json({ document });
  } catch (error) {
    next(error);
  }
});

app.post('/api/documents/compare', auth, async (req, res, next) => {
  try {
    const left = await getDocument(req.body.leftId, false);
    const right = await getDocument(req.body.rightId, false);
    if (!left || !right) return res.status(404).json({ error: 'Both documents are required for comparison' });
    const comparison = compareAnalyses(left.analysis, right.analysis);
    await audit(req, 'documents.compared', { leftId: left.id, rightId: right.id, scoreDelta: comparison.score_delta });
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
      const fallback = findings.slice(0, 8).map(item => `${item.risk_level}: ${item.issue} — ${item.why_risky_for_bank}`).join('\n');
      return res.json({ answer: fallback || 'No findings are available for the active document.', mode: 'baseline' });
    }

    const response = await openai.responses.create({
      model: MODEL,
      input: `You are LIVE SYNESIS. Answer only from the active uploaded document and its analysis. Refer to the customer as the Bank. If the document does not support the answer, say so.\n\nQUESTION\n${question}\n\nDOCUMENT TEXT\n${document.extractedText.slice(0, 100000)}\n\nCURRENT FINDINGS\n${JSON.stringify(document.analysis, null, 2).slice(0, 50000)}`
    });
    await audit(req, 'document.question', { documentId: document.id, question });
    res.json({ answer: response.output_text || 'No answer returned.', mode: 'openai' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/audit', auth, adminOnly, async (req, res, next) => {
  try {
    res.json({ audit: await listAudit() });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? `File exceeds ${MAX_UPLOAD_MB} MB limit` : error.message });
  }
  const status = /unsupported file|too short|upload a document|did not contain enough/i.test(error.message) ? 400 : 500;
  res.status(status).json({ error: 'LIVE SYNESIS request failed', detail: error.message });
});

app.listen(PORT, () => {
  console.log(`LIVE SYNESIS server running on ${PORT}`);
  console.log(`OpenAI analysis: ${openai ? `enabled with ${MODEL}` : 'not configured; baseline engine active'}`);
});
