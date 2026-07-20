import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { config } from '../server/src/config.js';
import { getUserById, logAudit } from '../server/src/storage.js';
import {
  deleteRegulatoryCase,
  getRegulatoryCase,
  listRegulatoryCases,
  saveRegulatoryCase
} from '../server/src/regulatory-storage.js';

const app = express();
const SESSION_COOKIE = 'synesis_session';
const allowedRoles = new Set(['admin', 'legal', 'compliance', 'risk', 'business', 'management']);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '8mb' }));
app.use(cookieParser());
app.use(rateLimit({
  windowMs: 60_000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many Regulatory Command requests. Please wait and try again.' }
}));

async function auth(req, res, next) {
  try {
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const raw = req.cookies?.[SESSION_COOKIE] || bearer;
    if (!raw) return res.status(401).json({ error: 'Enterprise workspace authentication is required.' });
    const claims = jwt.verify(raw, config.jwtSecret, {
      issuer: 'live-synesis',
      audience: 'live-synesis-web'
    });
    const user = await getUserById(claims.sub);
    if (!user?.isActive) return res.status(401).json({ error: 'This account is inactive.' });
    if (!allowedRoles.has(user.role)) return res.status(403).json({ error: 'Your role cannot access Regulatory Command.' });
    req.user = user;
    req.tenant = { organizationId: user.organizationId };
    next();
  } catch (error) {
    if (/jwt|token|expired|signature/i.test(String(error.message || ''))) {
      return res.status(401).json({ error: 'Session expired or invalid.' });
    }
    next(error);
  }
}

async function audit(req, action, entityId, metadata = {}) {
  try {
    await logAudit({
      organizationId: req.user.organizationId,
      userId: req.user.id,
      userEmail: req.user.email,
      role: req.user.role,
      action,
      entityType: 'regulatory_case',
      entityId,
      metadata,
      requestId: req.get('x-request-id') || null,
      ipAddress: String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim().slice(0, 80)
    });
  } catch (error) {
    console.error('Regulatory Command audit logging failed:', error);
  }
}

app.use(auth);

app.get('/', async (req, res, next) => {
  try {
    const cases = await listRegulatoryCases(req.tenant, {
      status: req.query.status,
      search: req.query.search
    });
    res.set('Cache-Control', 'no-store');
    res.json({ cases, persistence: 'neon-enterprise' });
  } catch (error) { next(error); }
});

app.post('/', async (req, res, next) => {
  try {
    const record = req.body?.record;
    if (!record || typeof record !== 'object') return res.status(400).json({ error: 'A regulatory case record is required.' });
    if (!String(record.title || '').trim()) return res.status(400).json({ error: 'The regulatory case title is required.' });
    const saved = await saveRegulatoryCase(record, req.tenant, req.user);
    await audit(req, record.id ? 'regulatory.case.updated' : 'regulatory.case.created', saved.id, {
      status: saved.status,
      obligations: saved.obligations.length,
      impacts: saved.impacts.length,
      tasks: saved.tasks.length,
      approvals: saved.approvals.length,
      evidence: saved.evidence.length
    });
    res.status(record.id ? 200 : 201).json({ record: saved, persistence: 'neon-enterprise' });
  } catch (error) { next(error); }
});

app.get('/:id', async (req, res, next) => {
  try {
    const record = await getRegulatoryCase(req.params.id, req.tenant, true);
    if (!record) return res.status(404).json({ error: 'Regulatory case not found.' });
    res.set('Cache-Control', 'no-store');
    res.json({ record, persistence: 'neon-enterprise' });
  } catch (error) { next(error); }
});

app.delete('/:id', async (req, res, next) => {
  try {
    const removed = await deleteRegulatoryCase(req.params.id, req.tenant);
    if (!removed) return res.status(404).json({ error: 'Regulatory case not found.' });
    await audit(req, 'regulatory.case.deleted', req.params.id);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.use((error, req, res, next) => {
  console.error('Regulatory Command enterprise API failed:', error);
  res.status(error.status || 500).json({
    error: error.status ? error.message : 'Regulatory Command enterprise request failed.',
    detail: String(error.message || '').slice(0, 300)
  });
});

export default app;
