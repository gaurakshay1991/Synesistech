import express from 'express';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import { config } from '../server/src/config.js';
import { analyzeDocument } from '../server/src/analysis-engine.js';

const gateway = express();
const openai = config.openaiKey && !/(set_in|paste|replace|your_key)/i.test(config.openaiKey)
  ? new OpenAI({ apiKey: config.openaiKey, timeout: 55_000, maxRetries: 1 })
  : null;
const analysisOpenAI = openai ? {
  responses: {
    create: parameters => openai.responses.create({ ...parameters, store: false })
  }
} : null;

const publicLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Public analysis limit reached. Please wait and try again.' }
});

gateway.disable('x-powered-by');
gateway.set('trust proxy', 1);
gateway.use(express.json({ limit: '6mb' }));

gateway.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    product: 'LIVE SYNESIS',
    version: '3.1.1',
    publicWorkspace: true,
    ai: openai ? 'openai-structured-output-with-baseline-fallback' : 'document-specific-baseline',
    model: config.openaiModel,
    persistence: 'browser-local-for-public-workspace',
    privateWorkspace: config.databaseUrl ? 'configured-separately' : 'not-configured',
    supportedUploads: ['PDF', 'DOCX', 'TXT', 'CSV', 'JSON', 'MD', 'XML'],
    time: new Date().toISOString()
  });
});

gateway.get('/api/self-test', publicLimiter, async (req, res) => {
  try {
    const analysis = await analyzeDocument({
      openai: analysisOpenAI,
      model: config.openaiModel,
      text: 'Vendor may use Bank Data for model training and investor demonstrations. Vendor shall notify a data breach within thirty business days. Bank and regulators shall not have audit rights. Vendor liability shall not exceed INR 50,000. Vendor may subcontract without approval and shall not be liable for subcontractors.',
      options: {
        title: 'LIVE SYNESIS production self-test',
        fileName: 'self-test.txt',
        matter: 'Production verification',
        documentType: 'Vendor / Outsourcing Agreement',
        jurisdiction: 'India',
        riskAppetite: 'Conservative',
        department: 'Legal'
      }
    });
    res.json({
      ok: true,
      engine: analysis.engine,
      risk: analysis.overall_risk,
      score: analysis.overall_score,
      findings: analysis.findings?.length || 0,
      highRiskFindings: (analysis.findings || []).filter(item => item.risk_level === 'High').length,
      decision: analysis.recommended_decision
    });
  } catch (error) {
    console.error('Production self-test failed:', error);
    res.status(500).json({ ok: false, error: 'Production analysis self-test failed.' });
  }
});

gateway.post('/api/public/analyze', publicLimiter, async (req, res) => {
  const text = String(req.body?.text || '').replace(/\u0000/g, '').trim();
  if (text.length < 20) return res.status(400).json({ error: 'Upload or paste enough readable document text.' });
  if (text.length > 180000) return res.status(413).json({ error: 'Document exceeds the 180,000-character public review limit.' });

  const options = {
    title: String(req.body?.title || 'Uploaded document').trim().slice(0, 200),
    fileName: String(req.body?.fileName || '').trim().slice(0, 260),
    matter: String(req.body?.matter || 'General review').trim().slice(0, 200),
    documentType: String(req.body?.documentType || 'Auto-detect').trim().slice(0, 120),
    jurisdiction: String(req.body?.jurisdiction || 'India').trim().slice(0, 100),
    riskAppetite: String(req.body?.riskAppetite || 'Conservative').trim().slice(0, 60),
    department: String(req.body?.department || 'Legal').trim().slice(0, 100)
  };

  try {
    const analysis = await analyzeDocument({
      openai: analysisOpenAI,
      model: config.openaiModel,
      text,
      options
    });
    res.json({
      analysis,
      processing: {
        serverStored: false,
        engine: analysis.engine,
        aiConfigured: Boolean(openai)
      }
    });
  } catch (error) {
    console.error('Public analysis failed:', error);
    res.status(500).json({ error: 'LIVE SYNESIS could not analyse this document.' });
  }
});

gateway.post('/api/public/ask', publicLimiter, async (req, res) => {
  const question = String(req.body?.question || '').trim();
  const analysis = req.body?.analysis;
  if (question.length < 3) return res.status(400).json({ error: 'Enter a question about the active document.' });
  if (!analysis || typeof analysis !== 'object') return res.status(400).json({ error: 'Active document analysis is required.' });

  const findings = Array.isArray(analysis.findings) ? analysis.findings : [];
  if (!openai) {
    const terms = question.toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 3);
    const answer = findings
      .map(item => ({ item, score: terms.reduce((sum, term) => sum + Number(JSON.stringify(item).toLowerCase().includes(term)), 0) }))
      .sort((a, b) => b.score - a.score)
      .filter(entry => entry.score > 0)
      .slice(0, 6)
      .map(entry => `${entry.item.risk_level}: ${entry.item.issue}\nEvidence: ${entry.item.quoted_text}\nPosition: ${entry.item.why_risky_for_bank}\nAction: ${entry.item.recommended_mitigation}`)
      .join('\n\n');
    return res.json({ answer: answer || 'The active analysis does not contain enough evidence to answer that question reliably.', engine: 'baseline-grounded-answer' });
  }

  try {
    const response = await openai.responses.create({
      model: config.openaiModel,
      store: false,
      input: `You are LIVE SYNESIS. Answer only from the supplied active-document analysis. Do not invent clauses, law, facts or citations. State uncertainty clearly. Address the institution as the Bank.\n\nQUESTION\n${question}\n\nACTIVE ANALYSIS\n${JSON.stringify(analysis).slice(0, 90000)}`
    });
    res.json({ answer: response.output_text || 'No answer was returned.', engine: 'openai-grounded-answer' });
  } catch (error) {
    console.error('Public question failed:', error);
    res.status(500).json({ error: 'LIVE SYNESIS could not answer from the active document.' });
  }
});

const { default: privateApp } = await import('../server/src/app.js');
gateway.use(privateApp);

export default gateway;
