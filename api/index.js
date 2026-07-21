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
import {
  enrichAnalysisWithOpenIntelligence,
  mergeSourceSets,
  researchActiveMatter
} from '../server/src/themis-open-intelligence.js';
import { runSimulation } from '../server/src/new-model-engine.js';

const gateway = express();
const directOpenAIKey = config.openaiKey && !/(set_in|paste|replace|your_key)/i.test(config.openaiKey)
  ? config.openaiKey
  : '';
const aiGatewayKey = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || '';
const usingAIGateway = !directOpenAIKey && Boolean(aiGatewayKey);
const activeModel = usingAIGateway
  ? (process.env.AI_GATEWAY_MODEL || `openai/${config.openaiModel}`)
  : config.openaiModel;
const openai = directOpenAIKey
  ? new OpenAI({ apiKey: directOpenAIKey, timeout: 110_000, maxRetries: 1 })
  : aiGatewayKey
    ? new OpenAI({ apiKey: aiGatewayKey, baseURL: 'https://ai-gateway.vercel.sh/v1', timeout: 110_000, maxRetries: 1 })
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

function cleanString(value, fallback, max) {
  return String(value ?? fallback).trim().slice(0, max);
}

function booleanValue(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function analysisMode(value) {
  const mode = String(value || '').toLowerCase();
  return ['quick', 'standard', 'deep'].includes(mode) ? mode : 'deep';
}

function sourceText(req, maximum = 180000) {
  const text = String(req.body?.text || '').replace(/\u0000/g, '').trim();
  if (text.length < 20) {
    const error = new Error('Upload or paste enough readable source content.');
    error.status = 400;
    throw error;
  }
  if (text.length > maximum) {
    const error = new Error(`The uploaded source exceeds the ${maximum.toLocaleString('en-IN')}-character workspace limit.`);
    error.status = 413;
    throw error;
  }
  return text;
}

function sendAnalysis(res, analysis, extra = {}) {
  res.set('Cache-Control', 'no-store');
  res.json({
    analysis,
    processing: {
      generatedAt: new Date().toISOString(),
      serverStored: false,
      sourceSpecific: true,
      engine: analysis.engine,
      ...extra
    }
  });
}

function institutionalFailure(res, error, fallback = 'LIVE SYNESIS could not analyse this institutional source.') {
  console.error('Institutional analysis failed:', error);
  res.status(error.status || 500).json({ error: error.status ? error.message : fallback, detail: String(error.message || '').slice(0, 240) });
}

function fallbackAnswer(analysis, question) {
  const terms = question.toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 3);
  const corpus = [
    ...(Array.isArray(analysis.findings) ? analysis.findings : []),
    ...(Array.isArray(analysis.missing_clauses) ? analysis.missing_clauses : []),
    ...(Array.isArray(analysis.contradictions) ? analysis.contradictions : []),
    ...(Array.isArray(analysis.regulatory_touchpoints) ? analysis.regulatory_touchpoints : []),
    ...(Array.isArray(analysis.decision_intelligence?.obligations) ? analysis.decision_intelligence.obligations : []),
    ...(Array.isArray(analysis.decision_intelligence?.action_plan) ? analysis.decision_intelligence.action_plan : []),
    ...(Array.isArray(analysis.decision_intelligence?.decision_questions)
      ? analysis.decision_intelligence.decision_questions.map(item => ({ question: item }))
      : [])
  ];
  const answer = corpus
    .map(item => ({ item, score: terms.reduce((sum, term) => sum + Number(JSON.stringify(item).toLowerCase().includes(term)), 0) }))
    .sort((a, b) => b.score - a.score)
    .filter(entry => entry.score > 0)
    .slice(0, 8)
    .map(entry => JSON.stringify(entry.item, null, 2))
    .join('\n\n');
  return answer || 'The active analysis does not contain enough evidence to answer that question reliably.';
}

function researchOptions(req, fallback = {}) {
  return {
    jurisdiction: cleanString(req.body?.jurisdiction, fallback.jurisdiction || 'India', 100),
    countryCode: cleanString(req.body?.countryCode, fallback.countryCode || 'IN', 2).toUpperCase(),
    city: cleanString(req.body?.city, fallback.city || 'New Delhi', 100),
    region: cleanString(req.body?.region, fallback.region || 'Delhi', 100),
    timezone: cleanString(req.body?.timezone, fallback.timezone || 'Asia/Kolkata', 80),
    institutionName: cleanString(req.body?.institutionName, fallback.institutionName || 'Institution', 200),
    institutionFunction: cleanString(req.body?.institutionFunction, fallback.institutionFunction || 'Enterprise / Institution', 120)
  };
}

gateway.disable('x-powered-by');
gateway.set('trust proxy', 1);
gateway.use(express.json({ limit: '8mb' }));

gateway.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    product: 'LIVE SYNESIS',
    version: '4.3.0-themis-open-intelligence',
    institutionalWorkspace: true,
    product: 'SYNESIS NEW MODEL',
    version: '1.0.0-prototype',
    institutionalPrototype: true,
    universalInstitutionTypes: ['Bank', 'AMC / Fund', 'NBFC', 'Insurance', 'Corporate', 'Professional Services'],
    publicWorkspace: true,
    analysis: 'live-multipass-decision-intelligence-plus-open-world-research-calculation-and-simulation',
    aiConfigured: Boolean(openai),
    aiProvider: usingAIGateway ? 'vercel-ai-gateway' : directOpenAIKey ? 'openai-direct' : 'not-configured',
    model: activeModel,
    openWorldAnalysis: true,
    themis: {
      active: Boolean(openai),
      capabilities: ['document reasoning', 'current external research', 'evidence-inference separation', 'decision implications', 'controlled action planning']
    },
    persistence: 'browser-local-for-public-workspace',
    privateWorkspace: config.databaseUrl ? 'configured-separately' : 'not-configured',
    supportedUploads: ['PDF', 'DOCX', 'TXT', 'CSV', 'JSON', 'MD', 'XML'],
    analysisModes: ['quick', 'standard', 'deep'],
    activeEngines: [
      'deep-document-reasoning',
      'decision-and-obligation-modelling',
      'independent-challenge-review',
      'themis-open-intelligence',
      'current-source-verification',
      'institutional-simulation',
      'portfolio-calculation',
      'redemption-simulation',
      'mandate-mapping',
      'regulatory-impact',
      'institutional-document-analysis'
    ],
    scenarioCatalogue,
    activeEngines: ['deep-document-review', 'portfolio-calculation', 'redemption-simulation', 'mandate-mapping', 'regulatory-impact', 'institutional-document-analysis', 'universal-scenario-simulation'],
    time: new Date().toISOString()
  });
});

gateway.post('/api/public/institutional/simulate', publicLimiter, (req, res) => {
  try {
    sendAnalysis(res, simulateInstitutionalScenario(req.body || {}));
  } catch (error) {
    institutionalFailure(res, error, 'LIVE SYNESIS could not run this institutional simulation.');
gateway.post('/api/public/new-model/simulate', publicLimiter, (req, res) => {
  try {
    const simulation = runSimulation(req.body || {});
    res.set('Cache-Control', 'no-store');
    res.json({ simulation, processing: { serverStored: false, engine: simulation.engine, generatedAt: simulation.generatedAt } });
  } catch (error) {
    console.error('Simulation failed:', error);
    res.status(400).json({ error: error.message || 'Synesis could not run this simulation.' });
  }
});

gateway.post('/api/public/institutional/portfolio', publicLimiter, (req, res) => {
  try {
    const text = sourceText(req, 600000);
    const analysis = analyzePortfolioCsv(text, {
      title: cleanString(req.body?.title, 'Uploaded portfolio', 200),
      currency: cleanString(req.body?.currency, 'As supplied', 40)
    });
    sendAnalysis(res, analysis, { calculationEngine: true });
  } catch (error) {
    institutionalFailure(res, error, 'LIVE SYNESIS could not calculate this portfolio.');
  }
});

gateway.post('/api/public/institutional/document', publicLimiter, (req, res) => {
  try {
    const text = sourceText(req);
    sendAnalysis(res, analyzeInstitutionalDocument(text, {
      title: cleanString(req.body?.title, 'Uploaded institutional document', 200)
    }));
  } catch (error) {
    institutionalFailure(res, error);
  }
});

gateway.post('/api/public/institutional/mandate', publicLimiter, (req, res) => {
  try {
    const text = sourceText(req);
    const portfolio = req.body?.portfolio && typeof req.body.portfolio === 'object' ? req.body.portfolio : null;
    const analysis = analyzeMandate(text, portfolio, {
      title: cleanString(req.body?.title, 'Mandate compliance review', 200)
    });
    sendAnalysis(res, analysis, { calculationEngine: true });
  } catch (error) {
    institutionalFailure(res, error, 'LIVE SYNESIS could not map this mandate.');
  }
});

gateway.post('/api/public/institutional/regulatory', publicLimiter, (req, res) => {
  try {
    const text = sourceText(req);
    sendAnalysis(res, analyzeRegulatoryChange(text, {
      title: cleanString(req.body?.title, 'Regulatory change assessment', 200)
    }));
  } catch (error) {
    institutionalFailure(res, error, 'LIVE SYNESIS could not map this regulatory update.');
  }
});

gateway.post('/api/public/institutional/ask', publicLimiter, async (req, res) => {
  const question = String(req.body?.question || '').trim();
  const context = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};
  if (question.length < 3) return res.status(400).json({ error: 'Enter a question about the active uploaded context.' });
  const fallback = answerFromInstitutionalContext(question, context);
  if (!openai) {
    res.set('Cache-Control', 'no-store');
    return res.json({ answer: `${fallback}\n\nLive external intelligence is unavailable because no model provider is configured.`, engine: 'institutional-grounded-fallback', sources: [] });
  }
  try {
    const result = await researchActiveMatter({
      client: analysisOpenAI,
      model: activeModel,
      question,
      context,
      contextLabel: 'ACTIVE INSTITUTIONAL CONTEXT',
      options: researchOptions(req)
    const response = await openai.responses.create({
      model: config.openaiModel,
      store: false,
      input: `You are SYNESIS NEW MODEL, an institutional decision-intelligence assistant. Answer only from the supplied uploaded and calculated context. Separate source facts, calculations and inference. Never invent market data, law, issuer facts, portfolio holdings, approvals or completed actions. If evidence is insufficient, say so.\n\nQUESTION\n${question}\n\nACTIVE CONTEXT\n${JSON.stringify(context).slice(0, 120000)}`
    });
    res.set('Cache-Control', 'no-store');
    return res.json(result);
  } catch (error) {
    console.error('Themis institutional research fell back:', error);
    res.set('Cache-Control', 'no-store');
    return res.json({ answer: `${fallback}\n\nThemis could not complete live external research for this request.`, engine: 'institutional-grounded-fallback', sources: [] });
  }
});

gateway.post('/api/public/analyze', publicLimiter, async (req, res) => {
  const text = String(req.body?.text || '').replace(/\u0000/g, '').trim();
  if (text.length < 20) return res.status(400).json({ error: 'Upload or paste enough readable document text.' });
  if (text.length > 180000) return res.status(413).json({ error: 'Document exceeds the 180,000-character public review limit.' });

  const options = {
    title: cleanString(req.body?.title, 'Uploaded document', 200),
    fileName: cleanString(req.body?.fileName, '', 260),
    matter: cleanString(req.body?.matter, 'General review', 200),
    documentType: cleanString(req.body?.documentType, 'Auto-detect', 120),
    jurisdiction: cleanString(req.body?.jurisdiction, 'India', 100),
    riskAppetite: cleanString(req.body?.riskAppetite, 'Conservative', 60),
    department: cleanString(req.body?.department, 'Institutional', 100),
    institutionName: cleanString(req.body?.institutionName, 'Institution', 200),
    institutionFunction: cleanString(req.body?.institutionFunction, req.body?.department || 'Enterprise / Institution', 120),
    workType: cleanString(req.body?.workType, 'Review this document', 120),
    analysisObjective: cleanString(req.body?.analysisObjective, 'Determine what the evidence means, what is affected, what decision is required and what controlled action should follow.', 1000),
    stakeholderLens: cleanString(req.body?.stakeholderLens, 'Organisation and affected stakeholders', 160),
    analysisMode: analysisMode(req.body?.analysisMode),
    useCurrentSources: true,
    countryCode: cleanString(req.body?.countryCode, 'IN', 2).toUpperCase(),
    city: cleanString(req.body?.city, 'New Delhi', 100),
    region: cleanString(req.body?.region, 'Delhi', 100),
    timezone: cleanString(req.body?.timezone, 'Asia/Kolkata', 80)
  };

  try {
    let analysis = await analyzeDocument({ openai: analysisOpenAI, model: activeModel, text, options });
    let openIntelligence = null;

    if (openai && analysis.analysis_details?.live_ai_used) {
      try {
        openIntelligence = await enrichAnalysisWithOpenIntelligence({
          client: analysisOpenAI,
          model: activeModel,
          text,
          analysis,
          options
        });
        const existingVerification = analysis.source_verification || {};
        analysis = {
          ...analysis,
          external_intelligence: openIntelligence,
          source_verification: {
            checked_at: openIntelligence.checked_at,
            summary: [
              existingVerification.summary,
              'THEMIS OPEN INTELLIGENCE',
              openIntelligence.summary
            ].filter(Boolean).join('\n\n'),
            sources: mergeSourceSets(existingVerification.sources, openIntelligence.sources)
          },
          analysis_details: {
            ...analysis.analysis_details,
            open_intelligence_used: true,
            external_sources_reviewed: openIntelligence.sources.length,
            answer_scope: 'uploaded evidence plus current external intelligence'
          }
        };
      } catch (error) {
        console.error('Themis open-intelligence enrichment failed:', error);
        analysis = {
          ...analysis,
          analysis_details: {
            ...analysis.analysis_details,
            open_intelligence_used: false,
            open_intelligence_failure: String(error.message || 'External research failed').slice(0, 320)
          }
        };
      }
    }

    sendAnalysis(res, analysis, {
      aiConfigured: Boolean(openai),
      aiProvider: usingAIGateway ? 'vercel-ai-gateway' : directOpenAIKey ? 'openai-direct' : 'not-configured',
      mode: analysis.analysis_details?.mode || options.analysisMode,
      liveAiUsed: Boolean(analysis.analysis_details?.live_ai_used),
      openIntelligenceUsed: Boolean(analysis.analysis_details?.open_intelligence_used),
      independentPasses: analysis.analysis_details?.independent_passes || 0,
      currentSourcesRequested: true
    });
  } catch (error) {
    institutionalFailure(res, error, 'LIVE SYNESIS could not analyse this document.');
    title: String(req.body?.title || 'Uploaded document').trim().slice(0, 200),
    fileName: String(req.body?.fileName || '').trim().slice(0, 260),
    matter: String(req.body?.matter || 'General review').trim().slice(0, 200),
    documentType: String(req.body?.documentType || 'Auto-detect').trim().slice(0, 120),
    jurisdiction: String(req.body?.jurisdiction || 'India').trim().slice(0, 100),
    riskAppetite: String(req.body?.riskAppetite || 'Conservative').trim().slice(0, 60),
    department: String(req.body?.department || 'Institutional Review').trim().slice(0, 100)
  };

  try {
    const analysis = await analyzeDocument({ openai: analysisOpenAI, model: config.openaiModel, text, options });
    res.set('Cache-Control', 'no-store');
    res.json({ analysis, processing: { serverStored: false, engine: analysis.engine, aiConfigured: Boolean(openai) } });
  } catch (error) {
    console.error('Public analysis failed:', error);
    res.status(500).json({ error: 'SYNESIS NEW MODEL could not analyse this document.' });
  }
});

gateway.post('/api/public/ask', publicLimiter, async (req, res) => {
  const question = String(req.body?.question || '').trim();
  const analysis = req.body?.analysis;
  if (question.length < 3) return res.status(400).json({ error: 'Enter a question about the active document.' });
  if (!analysis || typeof analysis !== 'object') return res.status(400).json({ error: 'Active document analysis is required.' });

  if (!openai) {
    res.set('Cache-Control', 'no-store');
    return res.json({
      answer: `${fallbackAnswer(analysis, question)}\n\nLive external intelligence is unavailable because no model provider is configured.`,
      engine: 'emergency-analysis-grounded-answer',
      sources: []
    });
  }

  try {
    const result = await researchActiveMatter({
      client: analysisOpenAI,
      model: activeModel,
      question,
      context: analysis,
      contextLabel: 'ACTIVE DOCUMENT ANALYSIS AND DECISION MODEL',
      options: researchOptions(req, {
        jurisdiction: analysis.jurisdiction || 'India'
      })
    });
    res.set('Cache-Control', 'no-store');
    return res.json(result);
  } catch (error) {
    console.error('Themis active-matter research fell back:', error);
    res.set('Cache-Control', 'no-store');
    return res.json({
      answer: `${fallbackAnswer(analysis, question)}\n\nThemis could not complete live external research for this request.`,
      engine: 'emergency-analysis-grounded-answer',
      sources: []
    });
  const findings = Array.isArray(analysis.findings) ? analysis.findings : [];
  const fallback = () => {
    const terms = question.toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 3);
    const answer = findings
      .map(item => ({ item, score: terms.reduce((sum, term) => sum + Number(JSON.stringify(item).toLowerCase().includes(term)), 0) }))
      .sort((a, b) => b.score - a.score)
      .filter(entry => entry.score > 0)
      .slice(0, 6)
      .map(entry => `${entry.item.risk_level}: ${entry.item.issue}\nEvidence: ${entry.item.quoted_text}\nPosition: ${entry.item.why_risky_for_bank}\nAction: ${entry.item.recommended_mitigation}`)
      .join('\n\n');
    return answer || 'The active analysis does not contain enough evidence to answer that question reliably.';
  };

  if (!openai) {
    res.set('Cache-Control', 'no-store');
    return res.json({ answer: fallback(), engine: 'baseline-grounded-answer' });
  }

  try {
    const response = await openai.responses.create({
      model: config.openaiModel,
      store: false,
      input: `You are SYNESIS NEW MODEL. Answer only from the supplied active-document analysis. Do not invent clauses, law, facts or citations. State uncertainty clearly.\n\nQUESTION\n${question}\n\nACTIVE ANALYSIS\n${JSON.stringify(analysis).slice(0, 90000)}`
    });
    res.set('Cache-Control', 'no-store');
    res.json({ answer: response.output_text || fallback(), engine: 'openai-grounded-answer' });
  } catch {
    res.set('Cache-Control', 'no-store');
    res.json({ answer: fallback(), engine: 'baseline-grounded-answer' });
  }
});

const { default: privateApp } = await import('../server/src/app.js');
gateway.use(privateApp);

export default gateway;
