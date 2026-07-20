import express from 'express';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import { config } from '../server/src/config.js';
import { analyzeDocument } from '../server/src/analysis-engine.js';
import {
  analyzeInstitutionalDocument,
  analyzeMandate,
  analyzePortfolioCsv,
  analyzeRegulatoryChange,
  answerFromInstitutionalContext
} from '../server/src/institutional-engine.js';
import { scenarioCatalogue, simulateInstitutionalScenario } from '../server/src/simulation-engine.js';

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
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Public analysis limit reached. Please wait and try again.' }
});

function sourceText(req, maximum = 180000) {
  const text = String(req.body?.text || '').replace(/\u0000/g, '').trim();
  if (text.length < 20) {
    const error = new Error('Upload or paste enough readable source content.');
    error.status = 400;
    throw error;
  }
  if (text.length > maximum) {
    const error = new Error(`The uploaded source exceeds the ${maximum.toLocaleString('en-IN')}-character prototype limit.`);
    error.status = 413;
    throw error;
  }
  return text;
}

function sendAnalysis(res, analysis) {
  res.set('Cache-Control', 'no-store');
  res.json({
    analysis,
    processing: {
      generatedAt: new Date().toISOString(),
      serverStored: false,
      sourceSpecific: true,
      engine: analysis.engine
    }
  });
}

function institutionalFailure(res, error, fallback = 'Synesis could not analyse this institutional source.') {
  console.error('Institutional analysis failed:', error);
  res.status(error.status || 500).json({ error: error.status ? error.message : fallback });
}

gateway.disable('x-powered-by');
gateway.set('trust proxy', 1);
gateway.use(express.json({ limit: '8mb' }));

gateway.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    product: 'SYNESIS',
    version: '4.1.0-unified-prototype',
    institutionalPrototype: true,
    publicWorkspace: true,
    analysis: 'source-specific-cross-functional-institutional-engines',
    aiConfigured: Boolean(openai),
    model: config.openaiModel,
    persistence: 'browser-local-for-public-workspace',
    privateWorkspace: config.databaseUrl ? 'configured-separately' : 'not-configured',
    supportedUploads: ['PDF', 'DOCX', 'TXT', 'CSV', 'JSON', 'MD', 'XML'],
    activeEngines: ['institutional-simulation', 'portfolio-calculation', 'redemption-simulation', 'mandate-mapping', 'regulatory-impact', 'institutional-document-analysis'],
    scenarioCatalogue,
    time: new Date().toISOString()
  });
});

gateway.post('/api/public/institutional/simulate', publicLimiter, (req, res) => {
  try {
    const analysis = simulateInstitutionalScenario(req.body || {});
    sendAnalysis(res, analysis);
  } catch (error) {
    institutionalFailure(res, error, 'Synesis could not run this institutional simulation.');
  }
});

gateway.post('/api/public/institutional/portfolio', publicLimiter, (req, res) => {
  try {
    const text = sourceText(req, 600000);
    const analysis = analyzePortfolioCsv(text, {
      title: String(req.body?.title || 'Uploaded portfolio').trim().slice(0, 200),
      currency: String(req.body?.currency || 'As supplied').trim().slice(0, 40)
    });
    sendAnalysis(res, analysis);
  } catch (error) {
    institutionalFailure(res, error, 'Synesis could not calculate this portfolio.');
  }
});

gateway.post('/api/public/institutional/document', publicLimiter, (req, res) => {
  try {
    const text = sourceText(req);
    const analysis = analyzeInstitutionalDocument(text, {
      title: String(req.body?.title || 'Uploaded institutional document').trim().slice(0, 200)
    });
    sendAnalysis(res, analysis);
  } catch (error) {
    institutionalFailure(res, error);
  }
});

gateway.post('/api/public/institutional/mandate', publicLimiter, (req, res) => {
  try {
    const text = sourceText(req);
    const portfolio = req.body?.portfolio && typeof req.body.portfolio === 'object' ? req.body.portfolio : null;
    const analysis = analyzeMandate(text, portfolio, {
      title: String(req.body?.title || 'Mandate compliance review').trim().slice(0, 200)
    });
    sendAnalysis(res, analysis);
  } catch (error) {
    institutionalFailure(res, error, 'Synesis could not map this mandate.');
  }
});

gateway.post('/api/public/institutional/regulatory', publicLimiter, (req, res) => {
  try {
    const text = sourceText(req);
    const analysis = analyzeRegulatoryChange(text, {
      title: String(req.body?.title || 'Regulatory change assessment').trim().slice(0, 200)
    });
    sendAnalysis(res, analysis);
  } catch (error) {
    institutionalFailure(res, error, 'Synesis could not map this regulatory update.');
  }
});

gateway.post('/api/public/institutional/ask', publicLimiter, async (req, res) => {
  const question = String(req.body?.question || '').trim();
  const context = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};
  if (question.length < 3) return res.status(400).json({ error: 'Enter a question about the active uploaded context.' });
  const fallback = answerFromInstitutionalContext(question, context);
  if (!openai) {
    res.set('Cache-Control', 'no-store');
    return res.json({ answer: fallback, engine: 'institutional-grounded-answer' });
  }
  try {
    const response = await openai.responses.create({
      model: config.openaiModel,
      store: false,
      input: `You are SYNESIS, an institutional decision-intelligence assistant. Answer only from the supplied uploaded and calculated context. Separate source facts, calculations and inference. Never invent market data, law, issuer facts, portfolio holdings, approvals or completed actions. If evidence is insufficient, say so.\n\nQUESTION\n${question}\n\nACTIVE CONTEXT\n${JSON.stringify(context).slice(0, 120000)}`
    });
    res.set('Cache-Control', 'no-store');
    return res.json({ answer: response.output_text || fallback, engine: 'openai-institutional-grounded-answer' });
  } catch (error) {
    console.error('Institutional grounded answer fell back:', error);
    res.set('Cache-Control', 'no-store');
    return res.json({ answer: fallback, engine: 'institutional-grounded-answer' });
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
    department: String(req.body?.department || 'Institutional').trim().slice(0, 100)
  };

  try {
    const analysis = await analyzeDocument({
      openai: analysisOpenAI,
      model: config.openaiModel,
      text,
      options
    });
    res.set('Cache-Control', 'no-store');
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
    res.status(500).json({ error: 'SYNESIS could not analyse this document.' });
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
    res.set('Cache-Control', 'no-store');
    return res.json({ answer: answer || 'The active analysis does not contain enough evidence to answer that question reliably.', engine: 'baseline-grounded-answer' });
  }

  try {
    const response = await openai.responses.create({
      model: config.openaiModel,
      store: false,
      input: `You are SYNESIS. Answer only from the supplied active-document analysis. Do not invent clauses, law, facts or citations. State uncertainty clearly.\n\nQUESTION\n${question}\n\nACTIVE ANALYSIS\n${JSON.stringify(analysis).slice(0, 90000)}`
    });
    res.set('Cache-Control', 'no-store');
    res.json({ answer: response.output_text || 'No answer was returned.', engine: 'openai-grounded-answer' });
  } catch (error) {
    const terms = question.toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 3);
    const answer = findings
      .map(item => ({ item, score: terms.reduce((sum, term) => sum + Number(JSON.stringify(item).toLowerCase().includes(term)), 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(entry => `${entry.item.risk_level}: ${entry.item.issue}\nEvidence: ${entry.item.quoted_text}\nPosition: ${entry.item.why_risky_for_bank}\nAction: ${entry.item.recommended_mitigation}`)
      .join('\n\n');
    res.set('Cache-Control', 'no-store');
    res.json({ answer: answer || 'The active analysis does not contain enough evidence to answer that question reliably.', engine: 'baseline-grounded-answer' });
  }
});

const { default: privateApp } = await import('../server/src/app.js');
gateway.use(privateApp);

export default gateway;
