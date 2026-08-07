import crypto from 'node:crypto';
import { config } from './config.js';
import { getState, mutateState, getDocument, logAudit } from './db.js';
import { LIVE_SOURCE_CATALOG, sourceStatusView } from './source-catalog.js';
import { syncAuthoritativeSources, liveLegalResearch, createWatchRecord, assertSafePublicUrl } from './live-intelligence.js';
import { buildDocumentExposureModel } from './exposure.js';

const clean = (value, fallback = '', max = 2000) => String(value ?? fallback).trim().slice(0, max);

function asStoredUpdate(item) {
  return {
    ...item,
    domains: item.domain ? [item.domain] : [],
    affectedClauseTypes: [],
    mappedItems: 0,
    owner: 'Legal / Compliance',
    createdAt: item.firstSeenAt || item.retrievedAt || new Date().toISOString(),
    createdBy: 'Synesis autonomous source monitor',
    sourceReference: item.sourceReference,
    status: item.status || 'Live source detected — impact analysis required'
  };
}

function updateLiveMetrics(state) {
  state.metrics ||= {};
  state.regulatoryUpdates ||= [];
  state.metrics.regulatoryUpdatesOpen = state.regulatoryUpdates.filter(item => !['Verified and mapped', 'Closed'].includes(item.status)).length;
  state.metrics.liveSources = (state.sources || []).filter(item => /Healthy|configured/i.test(item.status || '')).length;
  state.metrics.liveChanges24h = state.regulatoryUpdates.filter(item => {
    const stamp = new Date(item.firstSeenAt || item.createdAt || 0).getTime();
    return stamp && Date.now() - stamp < 86_400_000 && item.independentlyDetected;
  }).length;
  return state;
}

export async function performSync(orgId) {
  const current = await getState(orgId);
  const result = await syncAuthoritativeSources({
    existingUpdates: current.regulatoryUpdates || [],
    sourceState: current.sources || [],
    watchlist: current.liveWatchlist || []
  });

  return mutateState(orgId, state => {
    state.liveWatchlist = result.watchlist;
    const internalSources = (state.sources || []).filter(source => !LIVE_SOURCE_CATALOG.some(catalog => catalog.id === source.id));
    state.sources = [...result.sourceChecks, ...internalSources].slice(0, 100);
    state.regulatoryUpdates ||= [];
    const existing = new Set(state.regulatoryUpdates.map(item => item.contentHash || item.sourceReference || item.id).filter(Boolean));
    const added = [];
    for (const item of result.detected) {
      const key = item.contentHash || item.sourceReference || item.id;
      if (existing.has(key)) continue;
      const record = asStoredUpdate(item);
      state.regulatoryUpdates.unshift(record);
      existing.add(key);
      added.push(record);
      if (['High', 'Critical'].includes(record.severity)) {
        state.alerts ||= [];
        state.alerts.unshift({
          id: crypto.randomUUID(), severity: record.severity, title: record.title,
          owner: 'Legal / Compliance', due: 'Immediate triage',
          why: `Independently detected from ${record.sourceName || record.regulator}.`,
          next: 'Run live impact analysis and verify applicability', regulatoryUpdateId: record.id
        });
      }
    }
    state.regulatoryUpdates = state.regulatoryUpdates.slice(0, 1200);
    state.alerts = (state.alerts || []).slice(0, 1000);
    state.liveBrain = {
      ...(state.liveBrain || {}),
      status: 'Online',
      lastSyncAt: result.checkedAt,
      lastDetectedCount: added.length,
      monitoredBackgroundSources: result.sourceChecks.filter(item => item.backgroundEnabled).length,
      queryTimeSources: result.sourceChecks.filter(item => !item.backgroundEnabled).length,
      watchedUrls: result.watchlist.filter(item => item.enabled).length,
      isolationPolicy: 'Every document live-analysis run is isolated from every other document and matter.'
    };
    return updateLiveMetrics(state);
  });
}

function auditSystem(orgId, action, metadata = {}) {
  return logAudit({
    orgId,
    user: { id: null, email: 'synesis-live-brain@system', role: 'system' },
    action,
    entityType: 'live-intelligence',
    entityId: orgId,
    metadata
  });
}

export function registerLiveRoutes({ app, auth, allow, route, openai }) {
  app.get('/api/live/status', auth, route(async (req, res) => {
    let state = await getState(req.orgId);
    const lastSync = new Date(state.liveBrain?.lastSyncAt || 0).getTime();
    if (!lastSync || Date.now() - lastSync > config.liveSyncMinutes * 60_000) state = await performSync(req.orgId);
    const catalog = LIVE_SOURCE_CATALOG.map(source => {
      const known = (state.sources || []).find(item => item.id === source.id);
      return sourceStatusView(source, known?.lastChecked || null, known?.status || null);
    });
    res.json({
      liveBrain: state.liveBrain || { status: 'Configured — awaiting first autonomous sync' },
      sources: catalog,
      watchlist: state.liveWatchlist || [],
      latest: (state.regulatoryUpdates || []).filter(item => item.independentlyDetected).slice(0, 80),
      model: config.openaiLiveModel,
      capabilities: {
        currentWebResearch: Boolean(openai),
        autonomousOfficialFeeds: true,
        independentDocumentIsolation: true,
        monitoredUrlFingerprinting: true,
        exposureQuantification: true
      }
    });
  }));

  app.post('/api/live/sync', auth, allow('admin', 'legal', 'compliance', 'risk', 'audit', 'management'), route(async (req, res) => {
    const state = await performSync(req.orgId);
    await logAudit({ orgId: req.orgId, user: req.user, action: 'live.sources.synced', entityType: 'live-intelligence', entityId: req.orgId, metadata: { lastSyncAt: state.liveBrain?.lastSyncAt, detected: state.liveBrain?.lastDetectedCount } });
    res.json({ state, liveBrain: state.liveBrain });
  }));

  app.post('/api/system/live-sync', route(async (req, res) => {
    const supplied = String(req.get('x-synesis-sync-token') || '');
    const expected = Buffer.from(config.syncToken);
    const actual = Buffer.from(supplied);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return res.status(401).json({ error: 'Invalid sync credential.' });
    const state = await performSync((await import('./db.js')).organizationId);
    await auditSystem((await import('./db.js')).organizationId, 'live.sources.autonomous-sync', { lastSyncAt: state.liveBrain?.lastSyncAt, detected: state.liveBrain?.lastDetectedCount });
    res.json({ ok: true, liveBrain: state.liveBrain });
  }));

  app.post('/api/live/watch', auth, allow('admin', 'legal', 'compliance', 'risk', 'audit', 'management'), route(async (req, res) => {
    const url = clean(req.body?.url, '', 1200);
    if (!url) return res.status(400).json({ error: 'An official HTTPS source URL is required.' });
    await assertSafePublicUrl(url);
    const watch = createWatchRecord({ ...req.body, url }, req.user.email);
    const state = await mutateState(req.orgId, current => {
      current.liveWatchlist ||= [];
      if (current.liveWatchlist.some(item => item.url === watch.url && item.enabled)) throw Object.assign(new Error('This source URL is already being monitored.'), { status: 409 });
      current.liveWatchlist.unshift(watch);
      current.liveWatchlist = current.liveWatchlist.slice(0, 150);
      return updateLiveMetrics(current);
    });
    await logAudit({ orgId: req.orgId, user: req.user, action: 'live.watch.created', entityType: 'source-watch', entityId: watch.id, metadata: { url: watch.url, regulator: watch.regulator, jurisdiction: watch.jurisdiction } });
    res.status(201).json({ watch, state });
  }));

  app.delete('/api/live/watch/:id', auth, allow('admin', 'legal', 'compliance', 'risk', 'audit', 'management'), route(async (req, res) => {
    let found = false;
    const state = await mutateState(req.orgId, current => {
      current.liveWatchlist = (current.liveWatchlist || []).map(item => {
        if (item.id !== req.params.id) return item;
        found = true;
        return { ...item, enabled: false, disabledAt: new Date().toISOString(), disabledBy: req.user.email };
      });
      return updateLiveMetrics(current);
    });
    if (!found) return res.status(404).json({ error: 'Monitored source not found.' });
    await logAudit({ orgId: req.orgId, user: req.user, action: 'live.watch.disabled', entityType: 'source-watch', entityId: req.params.id, metadata: {} });
    res.json({ state });
  }));

  app.post('/api/live/ask', auth, route(async (req, res) => {
    const question = clean(req.body?.question, '', 5000);
    if (question.length < 3) return res.status(400).json({ error: 'Question is required.' });
    const scope = req.body?.scope === 'institution' ? 'institution' : 'standalone';
    const organisationContext = scope === 'institution' ? await getState(req.orgId) : null;
    const result = await liveLegalResearch({
      client: openai,
      model: config.openaiLiveModel,
      question,
      jurisdiction: clean(req.body?.jurisdiction, '', 120),
      regulator: clean(req.body?.regulator, '', 160),
      organisationContext,
      purpose: scope === 'institution' ? 'current institutional legal-impact research' : 'fresh current-law research'
    });
    await logAudit({ orgId: req.orgId, user: req.user, action: 'live.question.answered', entityType: 'live-research', entityId: result.runId, metadata: { scope, jurisdiction: req.body?.jurisdiction || '', citations: result.citations.length } });
    res.json(result);
  }));

  app.post('/api/documents/:id/live-ask', auth, route(async (req, res) => {
    const question = clean(req.body?.question, '', 5000);
    if (question.length < 3) return res.status(400).json({ error: 'Question is required.' });
    const document = await getDocument(req.orgId, req.params.id, true);
    if (!document) return res.status(404).json({ error: 'Document not found.' });
    const result = await liveLegalResearch({
      client: openai,
      model: config.openaiLiveModel,
      question,
      jurisdiction: clean(req.body?.jurisdiction || document.jurisdiction, document.jurisdiction, 120),
      regulator: clean(req.body?.regulator, '', 160),
      document,
      purpose: 'independent single-document current-law analysis'
    });
    await logAudit({ orgId: req.orgId, user: req.user, action: 'document.live-question.answered', entityType: 'document', entityId: document.id, metadata: { runId: result.runId, isolation: 'single-document', citations: result.citations.length } });
    res.json(result);
  }));

  app.post('/api/documents/:id/exposure', auth, route(async (req, res) => {
    const document = await getDocument(req.orgId, req.params.id, true);
    if (!document) return res.status(404).json({ error: 'Document not found.' });
    const exposure = buildDocumentExposureModel(document.analysis || {}, document.sourceText || '', { jurisdiction: document.jurisdiction, matter: document.matter });
    let authorityResearch = null;
    if (req.body?.live !== false && openai) {
      const material = exposure.exposures.slice(0, 12).map(item => ({ category: item.category, riskLevel: item.riskLevel, issue: item.issue, quantificationStatus: item.quantificationStatus, contractualExposure: item.directContractualExposure })).map(item => JSON.stringify(item)).join('\n');
      authorityResearch = await liveLegalResearch({
        client: openai,
        model: config.openaiLiveModel,
        question: `Determine the CURRENT statutory, regulatory and enforcement exposure relevant to the material risks below. State current penalty/fine/damages maxima only when a current primary authority supplies them. Distinguish maximum statutory exposure from likely/actual exposure and explain applicability.\n${material}`,
        jurisdiction: document.jurisdiction,
        document,
        purpose: 'current-authority exposure quantification'
      });
    }
    const response = { exposure, authorityResearch, generatedAt: new Date().toISOString(), document: { id: document.id, title: document.title, jurisdiction: document.jurisdiction, matter: document.matter } };
    await logAudit({ orgId: req.orgId, user: req.user, action: 'document.exposure.generated', entityType: 'document', entityId: document.id, metadata: { materialFindings: exposure.materialFindings, liveAuthorityResearch: Boolean(authorityResearch) } });
    res.json(response);
  }));
}
