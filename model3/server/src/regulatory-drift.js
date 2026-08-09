import crypto from 'node:crypto';

const STOP = new Set(['the','and','for','with','from','under','into','this','that','shall','rule','rules','act','code','circular','notification','direction','directions','master','guideline','guidelines','regulation','regulations','order','dated','india','indian','government','of','to','in','on','a','an','no','new','amendment','amended']);
const clean = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = value => [...new Set(clean(value).split(' ').filter(word => word.length >= 3 && !STOP.has(word)))];
const hash = value => crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 24);

function authoritySignals(document = {}) {
  const impact = document.analysis?.regulatory_impact || {};
  const values = [];
  for (const item of impact.referenceInventory || []) values.push(item.reference);
  for (const item of impact.citedAuthorities || []) values.push(item.documentReference, item.currentInstrument);
  for (const item of impact.omittedApplicableAuthorities || []) values.push(item.authority, item.currentInstrument, item.title);
  for (const item of document.analysis?.regulatory_touchpoints || []) values.push(typeof item === 'string' ? item : item?.authority || item?.name || item?.title);
  return [...new Set(values.map(value => String(value || '').trim()).filter(value => value.length >= 4))].slice(0, 160);
}

function eventText(update = {}) {
  return [update.title, update.summary, update.regulator, update.sourceName, update.domain, update.changeType].filter(Boolean).join(' ');
}

export function scoreRegulatoryDrift(document = {}, update = {}) {
  const signals = authoritySignals(document);
  const source = clean(eventText(update));
  const sourceTokens = new Set(tokens(source));
  const reasons = [];
  let score = 0;

  const jurisdiction = clean(document.jurisdiction);
  const updateJurisdiction = clean(update.jurisdiction);
  if (jurisdiction && updateJurisdiction && (jurisdiction.includes(updateJurisdiction) || updateJurisdiction.includes(jurisdiction))) {
    score += 10;
    reasons.push('same jurisdiction');
  }

  const regulator = clean(`${update.regulator || ''} ${update.sourceName || ''}`);
  for (const signal of signals) {
    const normalized = clean(signal);
    if (!normalized) continue;
    if (normalized.length >= 12 && source.includes(normalized)) {
      score = Math.max(score, 82);
      reasons.push(`exact authority/reference match: ${signal}`);
      continue;
    }
    const sigTokens = tokens(normalized);
    const common = sigTokens.filter(token => sourceTokens.has(token));
    if (common.length >= 3) {
      score += Math.min(45, 12 + common.length * 6);
      reasons.push(`reference token match: ${common.slice(0, 6).join(', ')}`);
    } else if (common.length === 2 && sigTokens.length <= 5) {
      score += 18;
      reasons.push(`short reference match: ${common.join(', ')}`);
    }
    const authorityWords = sigTokens.filter(token => /rbi|sebi|irdai|ifsca|pfrda|fiu|dgft|mca|meity|cbic|cbdt|competition|supreme|reserve|securities|insurance|pension/.test(token));
    if (authorityWords.some(token => regulator.includes(token))) {
      score += 22;
      reasons.push(`same authority: ${authorityWords.find(token => regulator.includes(token))}`);
    }
  }

  const matterTokens = tokens(`${document.title || ''} ${document.matter || ''} ${document.documentType || ''}`);
  const matterCommon = matterTokens.filter(token => sourceTokens.has(token));
  if (matterCommon.length >= 3) {
    score += 12;
    reasons.push(`matter-topic match: ${matterCommon.slice(0, 5).join(', ')}`);
  }

  return { score: Math.min(100, score), reasons: [...new Set(reasons)].slice(0, 10), signals };
}

export function mapRegulatoryDrift(documents = [], updates = [], { threshold = 55 } = {}) {
  const candidates = [];
  for (const update of updates || []) {
    if (!update?.id || !update?.sourceReference) continue;
    for (const document of documents || []) {
      if (!document?.id || !document?.analysis) continue;
      const match = scoreRegulatoryDrift(document, update);
      if (match.score < threshold) continue;
      candidates.push({
        id: `drift-${hash(`${document.id}|${update.id}`)}`,
        documentId: document.id,
        documentTitle: document.title,
        matter: document.matter,
        jurisdiction: document.jurisdiction,
        regulatoryUpdateId: update.id,
        sourceReference: update.sourceReference,
        sourceName: update.sourceName || update.regulator,
        regulator: update.regulator,
        changeTitle: update.title,
        changeType: update.changeType,
        publishedDate: update.publishedDate,
        effectiveDate: update.effectiveDate,
        detectedAt: update.firstSeenAt || update.retrievedAt || new Date().toISOString(),
        matchScore: match.score,
        matchReasons: match.reasons,
        matchedAuthoritySignals: match.signals,
        priorDecision: document.analysis?.recommended_decision || null,
        priorCurrentLawAt: document.analysis?.live_current_law?.researchedAt || null,
        status: 'REVALIDATION_REQUIRED',
        impactConclusion: 'Not yet determined. The official-source change is relevant enough to invalidate silent reliance on the previous legal-currentness check; a fresh matter-specific impact analysis is required.',
        automaticLegalConclusionMade: false
      });
    }
  }
  return candidates.sort((a, b) => b.matchScore - a.matchScore);
}

export function applyRegulatoryDrift(state = {}, candidates = []) {
  state.regulatoryDrift ||= [];
  state.alerts ||= [];
  state.tasks ||= [];
  const existing = new Set(state.regulatoryDrift.map(item => item.id));
  for (const candidate of candidates) {
    if (existing.has(candidate.id)) continue;
    state.regulatoryDrift.unshift(candidate);
    existing.add(candidate.id);
    state.alerts.unshift({
      id: `alert-${candidate.id}`,
      documentId: candidate.documentId,
      regulatoryDriftId: candidate.id,
      regulatoryUpdateId: candidate.regulatoryUpdateId,
      severity: candidate.matchScore >= 82 ? 'High' : 'Medium',
      title: `Regulatory drift: revalidate ${candidate.documentTitle}`,
      owner: 'Legal / Compliance',
      due: 'Review now',
      why: `${candidate.changeTitle}. Match confidence ${candidate.matchScore}/100. Previous legal-currentness should not be relied on until revalidated.`,
      next: 'Run the document Regulatory + compliance re-check and reassess clearance.'
    });
    state.tasks.unshift({
      id: `task-${candidate.id}`,
      documentId: candidate.documentId,
      regulatoryDriftId: candidate.id,
      title: `Revalidate regulatory impact — ${candidate.documentTitle}`,
      owner: 'Legal / Compliance',
      due: 'Review now',
      status: 'Not started',
      priority: candidate.matchScore >= 82 ? 'High' : 'Medium',
      blocker: 'A potentially relevant official-source change was detected after/against the matter legal-currentness baseline.',
      evidenceRequired: [candidate.sourceReference]
    });
  }
  state.regulatoryDrift = state.regulatoryDrift.slice(0, 1500);
  state.alerts = state.alerts.slice(0, 1000);
  state.tasks = state.tasks.slice(0, 2000);
  state.metrics ||= {};
  state.metrics.regulatoryDriftOpen = state.regulatoryDrift.filter(item => !['REVALIDATED_NO_IMPACT','REVALIDATED_IMPACTED','CLOSED'].includes(item.status)).length;
  return state;
}

export function resolveDocumentDrift(state = {}, documentId, { status = 'REVALIDATED_IMPACTED', note = '', by = '' } = {}) {
  const allowed = new Set(['REVALIDATED_NO_IMPACT','REVALIDATED_IMPACTED','CLOSED']);
  const nextStatus = allowed.has(status) ? status : 'REVALIDATED_IMPACTED';
  const now = new Date().toISOString();
  state.regulatoryDrift = (state.regulatoryDrift || []).map(item => item.documentId === documentId && item.status === 'REVALIDATION_REQUIRED'
    ? { ...item, status: nextStatus, revalidatedAt: now, revalidatedBy: by, revalidationNote: note }
    : item);
  state.tasks = (state.tasks || []).map(item => item.documentId === documentId && item.regulatoryDriftId && item.status !== 'Completed'
    ? { ...item, status: 'Completed', completedAt: now }
    : item);
  state.metrics ||= {};
  state.metrics.regulatoryDriftOpen = (state.regulatoryDrift || []).filter(item => item.status === 'REVALIDATION_REQUIRED').length;
  return state;
}
