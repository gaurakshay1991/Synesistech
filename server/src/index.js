import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import OpenAI from 'openai';

const app = express();
const PORT = process.env.PORT || 8080;
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_change_me';
const openai = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'paste_your_openai_project_key_here'
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const users = [
  { role: 'admin', email: process.env.ADMIN_EMAIL || 'admin@synesis.local', password: process.env.ADMIN_PASSWORD || 'ChangeThisAdminPassword123!' },
  { role: 'investor', email: process.env.INVESTOR_EMAIL || 'investor@synesis.local', password: process.env.INVESTOR_PASSWORD || 'InvestorDemoOnly123!' },
  { role: 'reviewer', email: process.env.REVIEWER_EMAIL || 'reviewer@synesis.local', password: process.env.REVIEWER_PASSWORD || 'ReviewerDemoOnly123!' }
];

const audit = [];
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '8mb' }));
app.use(rateLimit({ windowMs: 60000, max: 100 }));

function token(user) { return jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' }); }
function auth(req, res, next) {
  try {
    const raw = (req.headers.authorization || '').replace('Bearer ', '');
    if (!raw) return res.status(401).json({ error: 'Login required' });
    req.user = jwt.verify(raw, JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Session expired' }); }
}
function log(req, action, meta = {}) { audit.unshift({ at: new Date().toISOString(), user: req.user?.email, action, meta }); }
function rules() {
  return 'You are Synesis, a private legal intelligence platform. Prefer official Indian legal/regulatory sources including RBI, SEBI, MCA, India Code, eGazette, CBIC, Income Tax and courts. Give direct answer, legal basis, analysis, risk rating, action points, open issues, checked date and lawyer-review flag. Do not give unsupported legal conclusions.';
}
async function run(prompt, live = false) {
  if (!openai) return { output: 'Backend is running, but OpenAI is not configured. Add OPENAI_API_KEY in server environment and restart.', sources: [], checkedAt: new Date().toISOString(), demoMode: true };
  const response = await openai.responses.create({ model: MODEL, tools: live ? [{ type: 'web_search' }] : [], input: prompt });
  const text = response.output_text || '';
  const urls = [...JSON.stringify(response).matchAll(/https?:\/\/[^\s\")\]}]+/g)].map(x => x[0]);
  return { output: text, sources: [...new Set(urls)].slice(0, 20), checkedAt: new Date().toISOString(), demoMode: false };
}

app.get('/api/health', (_, res) => res.json({ ok: true, privateMode: true, payments: false }));
app.post('/api/auth/login', (req, res) => {
  const user = users.find(u => u.email === req.body.email && u.password === req.body.password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ token: token(user), user: { email: user.email, role: user.role } });
});
app.get('/api/admin/audit', auth, (req, res) => req.user.role === 'admin' ? res.json({ audit }) : res.status(403).json({ error: 'Admin only' }));

app.post('/api/legal/research', auth, async (req, res, next) => {
  try { const { query, jurisdiction = 'India' } = req.body; log(req, 'legal.research', { query }); res.json(await run(`${rules()}\nModule: Live legal research. Jurisdiction: ${jurisdiction}. Question: ${query}`, true)); } catch (e) { next(e); }
});
app.post('/api/contracts/review', auth, async (req, res, next) => {
  try { const { text = '' } = req.body; log(req, 'contracts.review', { chars: text.length }); res.json(await run(`${rules()}\nModule: Contract review. Return red flags, clause table, missing protections, suggested drafting and sign-off position. Agreement:\n${text.slice(0, 45000)}`, true)); } catch (e) { next(e); }
});
app.post('/api/clauses/rewrite', auth, async (req, res, next) => {
  try { const { clause, stance = 'balanced but firm', context = '' } = req.body; log(req, 'clauses.rewrite', { stance }); res.json(await run(`${rules()}\nModule: Clause rewrite. Stance: ${stance}. Context: ${context}. Clause: ${clause}`, false)); } catch (e) { next(e); }
});
app.post('/api/memo/generate', auth, async (req, res, next) => {
  try { const { issue, facts = '', audience = 'management' } = req.body; log(req, 'memo.generate', { issue }); res.json(await run(`${rules()}\nModule: Legal memo. Audience: ${audience}. Issue: ${issue}. Facts: ${facts}`, true)); } catch (e) { next(e); }
});
app.post('/api/regulatory/watch', auth, async (req, res, next) => {
  try { const { topic, regulator = 'RBI/SEBI/MCA' } = req.body; log(req, 'regulatory.watch', { topic }); res.json(await run(`${rules()}\nModule: Regulatory watch. Regulator: ${regulator}. Topic: ${topic}. Return developments, impact, action, risk and sources.`, true)); } catch (e) { next(e); }
});
app.post('/api/export/text', auth, (req, res) => {
  const name = String(req.body.title || 'Synesis_Output').replace(/[^a-z0-9]/gi, '_');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.txt"`);
  res.send(`${req.body.title || 'Synesis Output'}\n\n${req.body.content || ''}`);
});
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Synesis request failed', detail: err.message }); });
app.listen(PORT, () => console.log(`Synesis server running on ${PORT}`));
