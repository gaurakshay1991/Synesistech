import http from 'node:http';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';

const externalPort = Number(process.env.PORT || 3000);
const innerPort = externalPort + 60 <= 65534 ? externalPort + 60 : externalPort - 60;
process.env.PORT = String(innerPort);
await import('./production-front-gateway.js');
process.env.PORT = String(externalPort);

const [{ config }, db, analysisModule, exposureModule, liveModule, product, regulatory, providers] = await Promise.all([
  import('./config.js'),
  import('./db.js'),
  import('./analysis.js'),
  import('./exposure.js'),
  import('./live-intelligence.js'),
  import('./product-intelligence.js'),
  import('./regulatory-impact.js'),
  import('./ai-provider.js')
]);

const app = express();
app.disable('x-powered-by');
if (config.production) app.set('trust proxy', 1);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1, fields: 20 } });
const jsonRoute = express.json({ limit: '4mb' });
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const clean = (value, fallback = '', max = 1000) => String(value ?? fallback).trim().slice(0, max);

function forwardedHeaders(req, extra = {}) {
  const headers = { ...req.headers, host: `127.0.0.1:${innerPort}`, ...extra };
  const publicHost = req.headers['x-forwarded-host'] || req.headers.host;
  if (publicHost) headers['x-forwarded-host'] = publicHost;
  return headers;
}

async function innerJson(req, pathname, options = {}) {
  const headers = forwardedHeaders(req, options.headers || {});
  const response = await fetch(`http://127.0.0.1:${innerPort}${pathname}`, { ...options, headers });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text || `HTTP ${response.status}` }; }
  return { ok: response.ok, status: response.status, body };
}

async function requireSession(req, res, next) {
  try {
    const session = await innerJson(req, '/api/auth/session');
    if (!session.ok || !session.body?.user) return res.status(session.status || 401).json({ error: session.body?.error || 'Login required.' });
    req.synesisUser = session.body.user;
    req.orgId = session.body.user.organizationId;
    next();
  } catch (error) {
    res.status(503).json({ error: 'SYNESIS authentication runtime is unavailable.', detail: config.production ? undefined : error.message });
  }
}

function allowProviderAdmin(req, res, next) {
  return ['admin', 'management'].includes(String(req.synesisUser?.role || '').toLowerCase()) ? next() : res.status(403).json({ error: 'Only an administrator or management user can change the AI provider.' });
}

async function activeAI(req) {
  const ai = await providers.resolveProvider(req.orgId);
  if (!ai.client) throw Object.assign(new Error('No working AI provider is configured. Open /provider and activate a provider.'), { status: 503 });
  return ai;
}

function parseJsonOutput(value) {
  const raw = String(value || '').trim();
  try { return JSON.parse(raw); } catch {}
  const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
  throw Object.assign(new Error('The active AI provider returned invalid structured output.'), { status: 502 });
}

async function callStructured(ai, instruction, payload, maxOutput = 6000) {
  const response = await ai.client.responses.create({
    model: ai.model,
    store: false,
    max_output_tokens: maxOutput,
    input: `${instruction}\n\nCONTROLLED INPUT:\n${JSON.stringify(payload)}\n\nReturn one valid JSON object only. Do not use markdown.`
  });
  return parseJsonOutput(response.output_text);
}

function findingById(document, findingId) {
  const findings = document.analysis?.findings || [];
  return findings.find((item, index) => String(item.id || `finding-${index + 1}`) === String(findingId));
}

async function regulatoryImpact(ai, document, sourceText, currentLaw = null) {
  const referenceInventory = regulatory.extractLegalReferences(sourceText || document?.sourceText || '');
  let research = currentLaw;
  try {
    research = research || await liveModule.liveLegalResearch({
      client: ai.client,
      model: ai.liveModel,
      question: regulatory.regulatoryImpactResearchQuestion(referenceInventory),
      jurisdiction: document.jurisdiction,
      document: { ...document, sourceText: sourceText || document.sourceText },
      purpose: 'regulatory reference freshness, amendment, supersession and compliance impact audit'
    });
  } catch (error) {
    return regulatory.emptyRegulatoryImpact(referenceInventory, `Live regulatory verification unavailable: ${error.message}`);
  }
  try {
    const pack = await callStructured(ai, `You are the regulatory change, compliance-impact and stale-law verification engine inside SYNESIS. Use ONLY the selected document, extracted references and supplied current-source research. Never invent an amendment, effective date, regulator, penalty or citation. Return JSON keys: overallImpact, staleReferenceWarning, executiveConclusion, citedAuthorities[], omittedApplicableAuthorities[], complianceImpacts[], transitionAndDeadlines[], requiredActions[], approvalsAndEscalations[], missingFacts[], decisionEffect. overallImpact: NONE, LOW, MEDIUM, HIGH or CRITICAL. Each citedAuthorities item: referenceId, documentReference, currentStatus, currentInstrument, amendmentOrSupersession, effectiveDate, transitionDate, impact, sourceUrls[]. currentStatus: CURRENT, AMENDED, SUPERSEDED, REPEALED, WITHDRAWN, PARTIALLY_EFFECTIVE, NOT_YET_EFFECTIVE, UNCLEAR or NOT_VERIFIED. Each complianceImpacts item: dimension, impactLevel, requirement, applicability, ownerFunction, trigger, deadline, evidenceRequired, controlChange, consequenceOfFailure, mitigation. Distinguish mandatory law from regulatory expectation, guidance, contractual preference and proposals.`, {
      document: { id: document.id, title: document.title, matter: document.matter, jurisdiction: document.jurisdiction, documentType: document.documentType },
      referenceInventory,
      complianceDimensions: regulatory.COMPLIANCE_IMPACT_DIMENSIONS,
      liveResearch: { answer: research.answer || '', citations: research.citations || [], researchedAt: research.researchedAt || null },
      sourceText: sourceText || document.sourceText
    }, 7500);
    return regulatory.normalizeRegulatoryImpact(pack, referenceInventory, research);
  } catch (error) {
    const fallback = regulatory.emptyRegulatoryImpact(referenceInventory, `Regulatory impact structuring failed: ${error.message}`);
    fallback.status = 'RESEARCH_COMPLETE_STRUCTURING_FAILED';
    fallback.currentLawCitations = research?.citations || [];
    fallback.researchedAt = research?.researchedAt || new Date().toISOString();
    fallback.liveWebUsed = Boolean(research?.liveWebUsed);
    return fallback;
  }
}

async function appendWork(orgId, document, analysis) {
  await db.mutateState(orgId, state => {
    state.tasks ||= []; state.obligations ||= []; state.decisions ||= [];
    const stamp = Date.now().toString(36);
    (analysis.obligations || []).slice(0, 20).forEach((item, index) => state.obligations.unshift({
      id: `doc-ob-${stamp}-${index}`, documentId: document.id, title: clean(item.title, `Obligation from ${document.title}`, 240), type: clean(item.type, 'Document', 80),
      source: document.title, sourceRef: clean(item.source_reference, 'Document evidence', 240), owner: clean(item.owner, 'Matter owner', 120), due: clean(item.deadline, 'To be determined', 80), status: clean(item.status, 'Proposed', 60), risk: clean(item.risk, analysis.overall_risk, 30), evidence: 0, controls: []
    }));
    (analysis.decision_questions || []).slice(0, 12).forEach((item, index) => state.decisions.unshift({
      id: `doc-dec-${stamp}-${index}`, documentId: document.id, title: clean(item.question, `Decision required for ${document.title}`, 260), matter: document.matter,
      risk: clean(item.risk, analysis.overall_risk, 30), status: 'Pending', owner: clean(item.owner, 'Matter owner', 120), due: clean(item.urgency, 'Review now', 80), rationale: analysis.recommended_decision, approvals: [{ role: 'Legal', status: 'Pending' }]
    }));
    (analysis.required_actions || []).slice(0, 20).forEach((item, index) => state.tasks.unshift({
      id: `doc-task-${stamp}-${index}`, documentId: document.id, title: clean(item.title, `Action for ${document.title}`, 260), owner: clean(item.owner, 'Matter owner', 120), due: clean(item.due, 'To be scheduled', 80), status: 'Not started', priority: analysis.overall_risk, blocker: '', evidenceRequired: Array.isArray(item.evidence_required) ? item.evidence_required : []
    }));
    (analysis.regulatory_impact?.requiredActions || []).slice(0, 20).forEach((item, index) => state.tasks.unshift({
      id: `reg-task-${stamp}-${index}`, documentId: document.id, title: clean(item.title || item.action || item.requirement, `Regulatory remediation for ${document.title}`, 260), owner: clean(item.ownerFunction || item.owner, 'Legal / Compliance', 120), due: clean(item.deadline || item.due, 'Review now', 80), status: 'Not started', priority: clean(item.priority || analysis.regulatory_impact?.overallImpact, 'High', 30), blocker: '', evidenceRequired: Array.isArray(item.evidenceRequired) ? item.evidenceRequired : []
    }));
    return state;
  });
}

app.get('/provider', (req, res) => {
  res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>SYNESIS AI Provider</title><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#071014;color:#edf5f7;margin:0;padding:28px}.box{max-width:720px;margin:auto;background:#0e1c21;border:1px solid #294249;border-radius:22px;padding:24px}h1{font-size:32px}label{display:block;margin:16px 0 6px;color:#9fb3ba}input,select{width:100%;box-sizing:border-box;padding:14px;border-radius:12px;border:1px solid #39545d;background:#071014;color:#fff;font-size:16px}button{margin-top:20px;width:100%;padding:15px;border:0;border-radius:13px;background:#69d3cf;font-weight:800;font-size:17px}.note{padding:12px;border-radius:12px;background:#19272c;color:#c6d6da;margin:14px 0}.warn{background:#38251d;color:#ffd7c5}a{color:#72ddd7}#status{white-space:pre-wrap;margin-top:14px}</style></head><body><div class="box"><h1>SYNESIS Brain Provider</h1><div class="note">This changes the neural provider only. Your matters, document isolation, exposure engine, clause memory and database remain in SYNESIS.</div><div class="note warn">For confidential production data, use a provider/project whose data terms meet your organisation's requirements. Google currently states Gemini free-tier content may be used to improve its products.</div><p><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Create/view a Gemini API key in Google AI Studio</a></p><form id="f"><label>Provider</label><select id="provider"><option value="gemini">Google Gemini</option><option value="openai">OpenAI</option></select><label>API key</label><input id="key" type="password" autocomplete="off" placeholder="Paste once — encrypted server-side"><label>Analysis model</label><input id="model" value="gemini-2.5-flash"><label>Live-law model</label><input id="live" value="gemini-2.5-flash"><button>Test and activate</button></form><div id="status">Checking current provider…</div><p><a href="/">← Back to SYNESIS</a></p></div><script>const s=document.getElementById('status');async function load(){const r=await fetch('/api/ai-provider',{credentials:'include'});const b=await r.json();s.textContent=r.ok?'Current: '+JSON.stringify(b,null,2):(b.error||'Sign in to SYNESIS first.');}load();document.getElementById('provider').onchange=e=>{const g=e.target.value==='gemini';document.getElementById('model').value=g?'gemini-2.5-flash':'gpt-5.6-terra';document.getElementById('live').value=g?'gemini-2.5-flash':'gpt-5.6-sol';};document.getElementById('f').onsubmit=async e=>{e.preventDefault();s.textContent='Testing provider before activation…';const r=await fetch('/api/ai-provider',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({provider:provider.value,apiKey:key.value,model:model.value,liveModel:live.value})});const b=await r.json();s.textContent=(r.ok?'ACTIVE\n':'FAILED\n')+JSON.stringify(b,null,2);if(r.ok)key.value='';};</script></body></html>`);
});

app.get('/api/ai-provider', requireSession, asyncRoute(async (req, res) => res.json(await providers.getProviderProfile(req.orgId))));
app.post('/api/ai-provider', requireSession, allowProviderAdmin, jsonRoute, asyncRoute(async (req, res) => {
  const profile = await providers.saveProviderProfile(req.orgId, req.synesisUser, req.body || {});
  await db.logAudit({ orgId: req.orgId, user: req.synesisUser, action: 'ai.provider.activated', entityType: 'ai-provider', entityId: profile.provider, metadata: { provider: profile.provider, model: profile.model, liveModel: profile.liveModel, test: profile.lastTest } });
  res.json(profile);
}));
app.delete('/api/ai-provider', requireSession, allowProviderAdmin, asyncRoute(async (req, res) => res.json(await providers.clearProviderProfile(req.orgId))));

app.get('/api/provider-health', requireSession, asyncRoute(async (req, res) => {
  const ai = await providers.resolveProvider(req.orgId);
  res.json({ ok: Boolean(ai.client), ...ai.profile, providerLayer: 'v9' });
}));

app.post('/api/documents/analyze', requireSession, upload.single('file'), asyncRoute(async (req, res) => {
  const ai = await activeAI(req);
  const extracted = await analysisModule.extractText(req.file, req.body.text);
  const options = {
    title: clean(req.body.title, extracted.fileName.replace(/\.[^.]+$/, '') || 'Pasted document', 200), matter: clean(req.body.matter, 'General institutional review', 200), documentType: clean(req.body.documentType, 'Auto-detect', 100), jurisdiction: clean(req.body.jurisdiction, 'India', 100), riskAppetite: clean(req.body.riskAppetite, 'Conservative', 80), analysisMode: `Live multipass via ${ai.provider}`, objective: clean(req.body.objective, 'Determine what is material, what can be accepted, what must be raised, defensible exposure, mitigation, regulatory/compliance impact and exact drafting.', 1200)
  };
  const analysis = await analysisModule.analyzeDocument({ client: ai.client, model: ai.model, text: extracted.text, options });
  if (analysis.analysis_details?.live_ai_used !== true) return res.status(502).json({ error: `The ${ai.provider} neural analysis failed. No completed review was saved.`, diagnostic: analysis.analysis_details?.failure || analysis.assumptions_and_limits?.find(value => /Live AI|provider|API/i.test(value)) || 'Unknown provider failure' });
  analysis.exposure_model = exposureModule.buildDocumentExposureModel(analysis, extracted.text, options);
  analysis.analysis_details ||= {}; analysis.analysis_details.document_isolation = 'single-document'; analysis.analysis_details.ai_provider = ai.provider;
  const provisionalDocument = { id: `upload-${extracted.hash.slice(0,16)}`, title: options.title, jurisdiction: options.jurisdiction, matter: options.matter, documentType: options.documentType, sourceText: extracted.text };
  try {
    analysis.live_current_law = await liveModule.liveLegalResearch({ client: ai.client, model: ai.liveModel, question: 'Verify this exact selected document against current law, regulations, rules, circulars, guidelines, orders and authoritative amendments today. Identify cited authority later amended, superseded, repealed, withdrawn, consolidated or partly/not-yet effective, and material current authority omitted. Distinguish operative law from proposal/guidance and do not invent monetary exposure.', jurisdiction: options.jurisdiction, document: provisionalDocument, purpose: 'automatic independent current-law document analysis' });
    analysis.analysis_details.current_law_web_used = true;
  } catch (error) {
    analysis.live_current_law = { status: 'Current-law verification unavailable', error: error.message, researchedAt: new Date().toISOString(), liveWebUsed: false, citations: [], isolation: { scope: 'single-document', otherDocumentMemoryUsed: false } };
    analysis.analysis_details.current_law_web_used = false;
  }
  analysis.regulatory_impact = await regulatoryImpact(ai, provisionalDocument, extracted.text, analysis.live_current_law?.liveWebUsed ? analysis.live_current_law : null);
  const provisional = { id: `pending-${extracted.hash.slice(0,12)}`, title: options.title, matter: options.matter, jurisdiction: options.jurisdiction, analysis };
  analysis.document_graph = product.buildDocumentGraph(provisional); analysis.clause_memory = product.buildClauseMemory(provisional);
  const document = await db.saveDocument({ orgId: req.orgId, userId: req.synesisUser.id, title: options.title, fileName: extracted.fileName, mimeType: extracted.mimeType, hash: extracted.hash, documentType: options.documentType, jurisdiction: options.jurisdiction, matter: options.matter, sourceText: extracted.text, analysis });
  await appendWork(req.orgId, document, analysis);
  await db.logAudit({ orgId: req.orgId, user: req.synesisUser, action: 'document.analysis.completed.provider-v9', entityType: 'document', entityId: document.id, metadata: { provider: ai.provider, model: ai.model, liveCurrentLaw: Boolean(analysis.live_current_law?.liveWebUsed), regulatoryImpact: analysis.regulatory_impact?.overallImpact } });
  res.status(201).json({ document: await db.getDocument(req.orgId, document.id, false), provider: ai.profile });
}));

app.post('/api/documents/:id/regulatory-impact', requireSession, jsonRoute, asyncRoute(async (req, res) => {
  const ai = await activeAI(req); const document = await db.getDocument(req.orgId, req.params.id, true);
  if (!document) return res.status(404).json({ error: 'Document not found.' });
  const impact = await regulatoryImpact(ai, document, document.sourceText);
  res.json({ regulatoryImpact: impact, provider: ai.profile, document: { id: document.id, title: document.title, jurisdiction: document.jurisdiction, matter: document.matter } });
}));

app.post('/api/documents/:id/findings/:findingId/action-pack', requireSession, jsonRoute, asyncRoute(async (req, res) => {
  const ai = await activeAI(req); const document = await db.getDocument(req.orgId, req.params.id, true);
  if (!document) return res.status(404).json({ error: 'Document not found.' });
  const finding = findingById(document, req.params.findingId); if (!finding) return res.status(404).json({ error: 'Finding not found in this document.' });
  const exposureModel = document.analysis?.exposure_model || exposureModule.buildDocumentExposureModel(document.analysis || {}, document.sourceText || '', { jurisdiction: document.jurisdiction, matter: document.matter });
  const findingIndex = (document.analysis?.findings || []).indexOf(finding); const exposure = product.exposureForFinding(exposureModel, finding, findingIndex);
  let currentLaw = { answer: '', citations: [] };
  try { currentLaw = await liveModule.liveLegalResearch({ client: ai.client, model: ai.liveModel, question: `For this exact issue, verify the current legal/regulatory position today and whether it is worth raising, negotiable, acceptable with monitoring or non-material. Check later amendment/supersession of authority relied on. ISSUE: ${finding.issue}. CLAUSE: ${finding.clause_reference}.`, jurisdiction: document.jurisdiction, document, purpose: 'finding-level current-law and negotiation verification' }); } catch (error) { currentLaw.error = error.message; }
  const pack = await callStructured(ai, `You are a senior transactional lawyer, legal risk officer and negotiation strategist. Analyse ONE finding from ONE document. Return JSON keys: disposition, priority, headline, worth_raising, why, legal_materiality, commercial_materiality, operational_materiality, regulatory_materiality, compliance_impact, quantification, risk_if_accepted, mitigation_strategy, negotiation_strategy, rewrite, fallback_position, walkaway_position, questions_for_business, residual_risk, confidence, evidence_used, current_law_relevance. disposition: LET_GO, ACCEPT_WITH_NOTE, MONITOR, NEGOTIATE, MUST_FIX or ESCALATE. quantification must preserve the supplied exposure-engine result and never invent money. rewrite: current_clause, preferred_text, fallback_text, drafting_rationale. mitigation_strategy: immediate, contractual, operational, monitoring. negotiation_strategy: opening_position, concession_ladder, counterparty_message, red_line.`, { document: { id: document.id, title: document.title, matter: document.matter, jurisdiction: document.jurisdiction }, exactFinding: finding, exactSourceText: document.sourceText, exposureEngine: exposure || { quantificationStatus: 'Not reliably quantifiable', exposureLabel: 'Not reliably quantifiable' }, regulatoryImpact: document.analysis?.regulatory_impact || null, currentLaw: { answer: currentLaw.answer || '', citations: currentLaw.citations || [] }, userInstruction: clean(req.body?.instruction, '', 1200) }, 7000);
  pack.findingId = finding.id || req.params.findingId; pack.documentId = document.id; pack.currentLawCitations = currentLaw.citations || []; pack.generatedAt = new Date().toISOString(); pack.engine = `${ai.provider} clause action pack (${ai.model})`;
  res.json({ actionPack: pack, provider: ai.profile });
}));

app.post('/api/documents/:id/decision-pack', requireSession, jsonRoute, asyncRoute(async (req, res) => {
  const ai = await activeAI(req); const document = await db.getDocument(req.orgId, req.params.id, true); if (!document) return res.status(404).json({ error: 'Document not found.' });
  const analysis = document.analysis || {}; const exposureModel = analysis.exposure_model || exposureModule.buildDocumentExposureModel(analysis, document.sourceText || '', { jurisdiction: document.jurisdiction, matter: document.matter });
  let live = { answer: '', citations: [] };
  try { live = await liveModule.liveLegalResearch({ client: ai.client, model: ai.liveModel, question: 'For this exact document, verify current legal/regulatory position and only matters that change clearance today. Check cited laws/circulars for amendment, supersession, repeal, withdrawal or consolidation and identify missing applicable authority. Distinguish mandatory law, regulatory expectation, guidance and contractual preference.', jurisdiction: document.jurisdiction, document, purpose: 'document clearance decision current-law verification' }); } catch (error) { live.error = error.message; }
  const pack = await callStructured(ai, `Act as senior legal counsel deciding whether this exact matter can be cleared. Return JSON keys: overall_disposition, clearance_recommendation, executive_rationale, regulatory_clearance_effect, must_fix[], raise_and_negotiate[], acceptable_with_note[], let_go[], quantifiable_exposure_summary, unquantifiable_exposure_summary, top_mitigations[], compliance_conditions[], negotiation_plan, approval_conditions[], unresolved_questions[], confidence. overall_disposition: CLEAR, CLEAR_WITH_CONDITIONS, NEGOTIATE_BEFORE_CLEARANCE, ESCALATE or DO_NOT_CLEAR. Every item must explain why. Monetary statements must exactly respect the supplied exposure model.`, { document: { id: document.id, title: document.title, matter: document.matter, jurisdiction: document.jurisdiction }, documentSummary: analysis.document_summary, executivePosition: analysis.executive_position, findings: analysis.findings || [], exposureModel, regulatoryImpact: analysis.regulatory_impact || null, currentLaw: { answer: live.answer || '', citations: live.citations || [] }, requestedObjective: clean(req.body?.objective, 'Can this document be cleared, and which points are genuinely worth raising?', 1200) }, 7500);
  pack.currentLawCitations = live.citations || []; pack.generatedAt = new Date().toISOString(); pack.engine = `${ai.provider} matter clearance pack (${ai.model})`;
  res.json({ decisionPack: pack, provider: ai.profile });
}));

app.post('/api/documents/:id/ask', requireSession, jsonRoute, asyncRoute(async (req, res) => {
  const ai = await activeAI(req); const document = await db.getDocument(req.orgId, req.params.id, true); if (!document) return res.status(404).json({ error: 'Document not found.' });
  const question = clean(req.body?.question, '', 5000); if (question.length < 3) return res.status(400).json({ error: 'Question is required.' });
  const answer = await analysisModule.answerDocumentQuestion({ client: ai.client, model: ai.model, document, question });
  let live = null;
  if (/current|today|law|circular|regulat|amend|supersed|repeal|compliance/i.test(question)) {
    try { live = await liveModule.liveLegalResearch({ client: ai.client, model: ai.liveModel, question, jurisdiction: document.jurisdiction, document, purpose: 'single-document question with current-law verification' }); } catch (error) { live = { error: error.message, citations: [] }; }
  }
  res.json({ answer: live?.answer ? `${answer}\n\nCURRENT-LAW CHECK:\n${live.answer}` : answer, engine: `${ai.provider} isolated document brain (${ai.model})`, live, provider: ai.profile });
}));

app.post('/api/documents/:id/exposure', requireSession, jsonRoute, asyncRoute(async (req, res) => {
  const ai = await activeAI(req); const document = await db.getDocument(req.orgId, req.params.id, true); if (!document) return res.status(404).json({ error: 'Document not found.' });
  const exposure = exposureModule.buildDocumentExposureModel(document.analysis || {}, document.sourceText || '', { jurisdiction: document.jurisdiction, matter: document.matter });
  let authorityResearch = null;
  if (req.body?.live !== false) {
    const material = exposure.exposures.slice(0,12).map(item => JSON.stringify({ category: item.category, riskLevel: item.riskLevel, issue: item.issue, quantificationStatus: item.quantificationStatus, contractualExposure: item.directContractualExposure })).join('\n');
    try { authorityResearch = await liveModule.liveLegalResearch({ client: ai.client, model: ai.liveModel, question: `Determine CURRENT statutory, regulatory and enforcement exposure relevant to the material risks below. State exact maxima only when a current primary authority supplies them. Distinguish statutory maximum from likely/actual exposure and explain applicability.\n${material}`, jurisdiction: document.jurisdiction, document, purpose: 'current-authority exposure quantification' }); } catch (error) { authorityResearch = { status: 'Live authority overlay unavailable', error: error.message, citations: [], liveWebUsed: false, researchedAt: new Date().toISOString() }; }
  }
  res.json({ exposure, authorityResearch, generatedAt: new Date().toISOString(), provider: ai.profile, document: { id: document.id, title: document.title, jurisdiction: document.jurisdiction, matter: document.matter } });
}));

function proxy(req, res) {
  const headers = forwardedHeaders(req);
  const upstream = http.request({ hostname: '127.0.0.1', port: innerPort, path: req.originalUrl, method: req.method, headers }, upstreamRes => {
    res.statusCode = upstreamRes.statusCode || 502;
    for (const [key, value] of Object.entries(upstreamRes.headers)) if (value !== undefined) res.setHeader(key, value);
    upstreamRes.pipe(res);
  });
  upstream.on('error', error => { if (!res.headersSent) res.status(502).json({ error: 'SYNESIS inner runtime unavailable.', detail: config.production ? undefined : error.message }); else res.end(); });
  req.pipe(upstream);
}
app.use(proxy);
app.use((error, req, res, next) => { console.error('SYNESIS provider gateway error', error); if (res.headersSent) return next(error); res.status(error.status || 500).json({ error: error.message || 'Unexpected provider gateway error.' }); });

app.listen(externalPort, '0.0.0.0', () => console.log(`SYNESIS provider-control gateway v9 listening on ${externalPort}; resilient matter runtime on loopback:${innerPort}`));
