import express from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../server/src/config.js';
import { analyzeDocument } from '../server/src/analysis-engine.js';
import {
  enrichAnalysisWithOpenIntelligence,
  mergeSourceSets,
  researchActiveMatter
} from '../server/src/themis-open-intelligence.js';
import { createResilientAI } from '../server/src/resilient-ai.js';

const app = express();
const ai = createResilientAI();
const model = config.openaiModel;

const limiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Public analysis limit reached. Please wait and try again.' }
});

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '8mb' }));

function clean(value, fallback, maximum) {
  return String(value ?? fallback).trim().slice(0, maximum);
}

function mode(value) {
  const requested = String(value || '').toLowerCase();
  return ['quick', 'standard', 'deep'].includes(requested) ? requested : 'deep';
}

function researchOptions(body = {}) {
  return {
    jurisdiction: clean(body.jurisdiction, 'India', 100),
    countryCode: clean(body.countryCode, 'IN', 2).toUpperCase(),
    city: clean(body.city, 'New Delhi', 100),
    region: clean(body.region, 'Delhi', 100),
    timezone: clean(body.timezone, 'Asia/Kolkata', 80),
    institutionName: clean(body.institutionName, 'Institution', 200),
    institutionFunction: clean(body.institutionFunction, body.department || 'Enterprise / Institution', 120)
  };
}

app.get('/api/health/ai', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    ok: true,
    service: 'Themis AI Gateway',
    version: '4.3.2',
    provider: ai.preferredProvider,
    model,
    configured: ai.isConfigured
  });
});

app.get('/api/health/ai-smoke-20260720', limiter, async (req, res) => {
  try {
    const response = await ai.responses.create({
      model,
      max_output_tokens: 20,
      input: 'Return exactly the word OK.'
    });
    res.set('Cache-Control', 'no-store');
    res.json({
      ok: response.output_text?.trim() === 'OK',
      output: response.output_text?.trim(),
      provider: ai.getLastProvider()
    });
  } catch (error) {
    res.status(error.status || 500).json({
      ok: false,
      error: String(error.message || error).slice(0, 320)
    });
  }
});

app.post('/api/public/analyze', limiter, async (req, res) => {
  const text = String(req.body?.text || '').replace(/\u0000/g, '').trim();
  if (text.length < 20) return res.status(400).json({ error: 'Upload or paste enough readable document text.' });
  if (text.length > 180000) return res.status(413).json({ error: 'Document exceeds the 180,000-character public review limit.' });

  const options = {
    title: clean(req.body?.title, 'Uploaded document', 200),
    fileName: clean(req.body?.fileName, '', 260),
    matter: clean(req.body?.matter, 'General review', 200),
    documentType: clean(req.body?.documentType, 'Auto-detect', 120),
    jurisdiction: clean(req.body?.jurisdiction, 'India', 100),
    riskAppetite: clean(req.body?.riskAppetite, 'Conservative', 60),
    department: clean(req.body?.department, 'Institutional', 100),
    institutionName: clean(req.body?.institutionName, 'Institution', 200),
    institutionFunction: clean(req.body?.institutionFunction, req.body?.department || 'Enterprise / Institution', 120),
    workType: clean(req.body?.workType, 'Review this document', 120),
    analysisObjective: clean(req.body?.analysisObjective, 'Determine what the evidence means, what is affected, what decision is required and what controlled action should follow.', 1000),
    stakeholderLens: clean(req.body?.stakeholderLens, 'Organisation and affected stakeholders', 160),
    analysisMode: mode(req.body?.analysisMode),
    useCurrentSources: true,
    ...researchOptions(req.body)
  };

  try {
    let analysis = await analyzeDocument({ openai: ai, model, text, options });

    if (!analysis.analysis_details?.live_ai_used) {
      return res.status(502).json({
        error: 'The live AI provider did not complete the analysis.',
        detail: analysis.analysis_details?.failure || 'The request fell back before completion.'
      });
    }

    try {
      const intelligence = await enrichAnalysisWithOpenIntelligence({
        client: ai,
        model,
        text,
        analysis,
        options
      });
      const existing = analysis.source_verification || {};
      analysis = {
        ...analysis,
        external_intelligence: intelligence,
        source_verification: {
          checked_at: intelligence.checked_at,
          summary: [existing.summary, 'THEMIS OPEN INTELLIGENCE', intelligence.summary].filter(Boolean).join('\n\n'),
          sources: mergeSourceSets(existing.sources, intelligence.sources)
        },
        analysis_details: {
          ...analysis.analysis_details,
          provider: ai.getLastProvider(),
          open_intelligence_used: true,
          external_sources_reviewed: intelligence.sources.length,
          answer_scope: 'uploaded evidence plus current external intelligence'
        }
      };
    } catch (error) {
      analysis = {
        ...analysis,
        analysis_details: {
          ...analysis.analysis_details,
          provider: ai.getLastProvider(),
          open_intelligence_used: false,
          open_intelligence_failure: String(error.message || error).slice(0, 320)
        }
      };
    }

    res.set('Cache-Control', 'no-store');
    res.json({
      analysis,
      processing: {
        generatedAt: new Date().toISOString(),
        serverStored: false,
        sourceSpecific: true,
        engine: analysis.engine,
        aiConfigured: true,
        aiProvider: ai.getLastProvider(),
        liveAiUsed: true,
        openIntelligenceUsed: Boolean(analysis.analysis_details?.open_intelligence_used),
        independentPasses: analysis.analysis_details?.independent_passes || 0,
        currentSourcesRequested: true
      }
    });
  } catch (error) {
    console.error('Gateway-backed analysis failed:', error);
    res.status(error.status || 500).json({
      error: 'LIVE SYNESIS could not complete the live analysis.',
      detail: String(error.message || error).slice(0, 320)
    });
  }
});

app.post('/api/public/ask', limiter, async (req, res) => {
  const question = String(req.body?.question || '').trim();
  const analysis = req.body?.analysis;
  if (question.length < 3) return res.status(400).json({ error: 'Enter a question about the active document.' });
  if (!analysis || typeof analysis !== 'object') return res.status(400).json({ error: 'Active document analysis is required.' });

  try {
    const result = await researchActiveMatter({
      client: ai,
      model,
      question,
      context: analysis,
      contextLabel: 'ACTIVE DOCUMENT ANALYSIS AND DECISION MODEL',
      options: researchOptions(req.body)
    });
    res.set('Cache-Control', 'no-store');
    res.json({ ...result, provider: ai.getLastProvider() });
  } catch (error) {
    res.status(error.status || 500).json({
      error: 'Themis could not complete live research for this question.',
      detail: String(error.message || error).slice(0, 320)
    });
  }
});

export default app;
