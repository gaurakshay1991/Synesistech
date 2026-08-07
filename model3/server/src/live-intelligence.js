import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { LIVE_SOURCE_CATALOG, fetchBackgroundSource, sourceStatusView, classifyLegalChange } from './source-catalog.js';

const hash = value => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const compact = value => String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function isPrivateIp(address) {
  if (!net.isIP(address)) return true;
  if (address === '127.0.0.1' || address === '::1' || address === '0.0.0.0' || address === '::') return true;
  if (address.startsWith('10.') || address.startsWith('192.168.') || address.startsWith('169.254.')) return true;
  const parts = address.split('.').map(Number);
  if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:')) return true;
  return false;
}

export async function assertSafePublicUrl(rawUrl) {
  const parsed = new URL(String(rawUrl || ''));
  if (parsed.protocol !== 'https:') throw Object.assign(new Error('Only HTTPS monitoring URLs are permitted.'), { status: 400 });
  if (!parsed.hostname || parsed.username || parsed.password) throw Object.assign(new Error('Invalid monitoring URL.'), { status: 400 });
  if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.local')) throw Object.assign(new Error('Private or local monitoring targets are not permitted.'), { status: 400 });
  const addresses = await dns.lookup(parsed.hostname, { all: true });
  if (!addresses.length || addresses.some(item => isPrivateIp(item.address))) throw Object.assign(new Error('Monitoring target resolves to a private or reserved network.'), { status: 400 });
  return parsed;
}

export async function fetchMonitoredUrl(rawUrl, { timeoutMs = 18000, maxBytes = 1_500_000 } = {}) {
  let current = await assertSafePublicUrl(rawUrl);
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Synesis-Legal-Intelligence/5.0 (+source-change-monitor; compliance contact required by deployer)',
          'Accept': 'text/html, text/plain, application/xml, text/xml, application/json;q=0.9, application/pdf;q=0.4'
        }
      });
    } finally {
      clearTimeout(timer);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Monitoring target redirected without a location.');
      current = await assertSafePublicUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Monitoring target returned HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    const length = Number(response.headers.get('content-length') || 0);
    if (length > maxBytes) throw new Error('Monitoring target exceeds the maximum safe snapshot size.');
    if (contentType.includes('application/pdf')) {
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > maxBytes) throw new Error('PDF snapshot exceeds the maximum safe snapshot size.');
      return { url: current.toString(), contentType, contentHash: hash(bytes), text: '', byteLength: bytes.length, fetchedAt: new Date().toISOString() };
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > maxBytes) throw new Error('Monitoring target exceeds the maximum safe snapshot size.');
    const text = contentType.includes('json') ? raw.slice(0, maxBytes) : compact(raw).slice(0, maxBytes);
    return { url: current.toString(), contentType, contentHash: hash(text), text, byteLength: Buffer.byteLength(raw), fetchedAt: new Date().toISOString() };
  }
  throw new Error('Monitoring target redirected too many times.');
}

function severityHeuristic(item) {
  const value = `${item.title} ${item.summary} ${item.changeType}`.toLowerCase();
  if (/repeal|prohibit|penalt|sanction|enforcement|revocation|capital requirement|cyber|breach|anti-money|terror|systemic/.test(value)) return 'High';
  if (/amend|rule|regulation|directive|master circular|mandatory|shall|must/.test(value)) return 'Medium';
  return 'Low';
}

export async function syncAuthoritativeSources({ existingUpdates = [], sourceState = [], watchlist = [] } = {}) {
  const known = new Set(existingUpdates.map(item => item.contentHash || item.sourceReference || item.id).filter(Boolean));
  const sourceStatus = new Map(sourceState.map(item => [item.id, item]));
  const detected = [];
  const checks = [];

  for (const source of LIVE_SOURCE_CATALOG) {
    if (!source.backgroundEnabled) {
      checks.push(sourceStatusView(source, sourceStatus.get(source.id)?.lastChecked || null, 'Query-time live search configured'));
      continue;
    }
    try {
      const result = await fetchBackgroundSource(source);
      const stamp = new Date().toISOString();
      for (const item of result.items) {
        if (known.has(item.contentHash) || known.has(item.sourceReference)) continue;
        detected.push({ ...item, severity: severityHeuristic(item), firstSeenAt: stamp, independentlyDetected: true });
        known.add(item.contentHash);
      }
      checks.push(sourceStatusView(source, stamp, `Healthy — ${result.items.length} current items observed`));
    } catch (error) {
      checks.push(sourceStatusView(source, new Date().toISOString(), `Monitor error — ${error.message}`));
    }
  }

  const watchEvents = [];
  const nextWatchlist = [];
  for (const watch of watchlist) {
    if (!watch?.enabled || !watch.url) { nextWatchlist.push(watch); continue; }
    try {
      const snapshot = await fetchMonitoredUrl(watch.url);
      const changed = Boolean(watch.lastContentHash && watch.lastContentHash !== snapshot.contentHash);
      const next = { ...watch, lastCheckedAt: snapshot.fetchedAt, lastContentHash: snapshot.contentHash, lastStatus: 'Healthy', lastResolvedUrl: snapshot.url };
      if (changed) {
        const eventId = `watch-${hash(`${watch.id}|${snapshot.contentHash}`).slice(0, 24)}`;
        watchEvents.push({
          id: eventId,
          contentHash: snapshot.contentHash,
          sourceId: watch.id,
          sourceName: watch.name || watch.url,
          regulator: watch.regulator || 'Monitored authority',
          jurisdiction: watch.jurisdiction || 'Not specified',
          domain: watch.domain || 'Monitored legal source',
          authorityRank: Number(watch.authorityRank || 90),
          title: `${watch.name || 'Monitored legal source'} changed`,
          summary: 'The content hash of a monitored authoritative URL changed. A fresh independent legal-impact analysis is required before the change is treated as an operative legal conclusion.',
          sourceReference: snapshot.url,
          publishedDate: 'Change detected at retrieval time',
          effectiveDate: 'Requires legal-effective-date determination',
          changeType: 'Monitored source content modification',
          status: 'Live source changed — impact analysis required',
          severity: 'Medium',
          confidence: Number(watch.authorityRank || 90),
          retrievedAt: snapshot.fetchedAt,
          firstSeenAt: snapshot.fetchedAt,
          provenance: 'Direct monitored URL content fingerprint',
          independentlyDetected: true
        });
      }
      nextWatchlist.push(next);
    } catch (error) {
      nextWatchlist.push({ ...watch, lastCheckedAt: new Date().toISOString(), lastStatus: `Monitor error — ${error.message}` });
    }
  }

  return {
    detected: [...watchEvents, ...detected].sort((a, b) => String(b.firstSeenAt || '').localeCompare(String(a.firstSeenAt || ''))),
    sourceChecks: checks,
    watchlist: nextWatchlist,
    checkedAt: new Date().toISOString()
  };
}

function selectDomains({ jurisdiction = '', regulator = '', preferredDomains = [] } = {}) {
  if (preferredDomains.length) return [...new Set(preferredDomains)].slice(0, 20);
  const query = `${jurisdiction} ${regulator}`.toLowerCase();
  const matches = LIVE_SOURCE_CATALOG.filter(source => {
    if (!query.trim()) return false;
    return query.includes(source.jurisdiction.toLowerCase()) || query.includes(source.regulator.toLowerCase()) || source.jurisdiction.toLowerCase().includes(query.trim());
  });
  return [...new Set(matches.flatMap(source => source.allowedDomains || []))].slice(0, 20);
}

export function extractWebCitations(response) {
  const citations = [];
  const seen = new Set();
  for (const item of response?.output || []) {
    if (item?.type === 'web_search_call' && Array.isArray(item?.action?.sources)) {
      for (const source of item.action.sources) {
        const url = source?.url;
        if (!url || seen.has(url)) continue;
        seen.add(url); citations.push({ title: source.title || url, url, type: source.type || 'web_source' });
      }
    }
    if (item?.type !== 'message') continue;
    for (const content of item.content || []) {
      for (const annotation of content.annotations || []) {
        const citation = annotation?.url_citation || annotation;
        const url = citation?.url;
        if (!url || seen.has(url)) continue;
        seen.add(url); citations.push({ title: citation.title || url, url, type: 'url_citation' });
      }
    }
  }
  return citations;
}

export async function liveLegalResearch({ client, model, question, jurisdiction = '', regulator = '', document = null, organisationContext = null, preferredDomains = [], purpose = 'legal-analysis' }) {
  if (!client) throw Object.assign(new Error('Live legal research requires an active OpenAI API connection.'), { status: 503 });
  const runId = crypto.randomUUID();
  const domains = selectDomains({ jurisdiction, regulator, preferredDomains });
  const webTool = { type: 'web_search', search_context_size: 'high' };
  if (domains.length) webTool.filters = { allowed_domains: domains };

  const isolatedDocument = document ? String(document.sourceText || '').slice(0, 220000) : '';
  const organisation = organisationContext ? JSON.stringify(organisationContext).slice(0, 120000) : '';
  const scopeRule = document
    ? `STRICT ISOLATION: Analyse only DOCUMENT ${document.id}. Do not use another document, matter, account, precedent or institutional memory unless it is quoted inside this document. Public current legal sources may be searched independently.`
    : organisationContext
      ? 'SCOPE: Use only the supplied organisation context plus fresh public legal sources. Do not infer facts about unlisted accounts, documents or matters.'
      : 'SCOPE: This is a fresh standalone legal-research run. Do not rely on prior Synesis answers or stored matter memory.';

  const input = `You are the live legal-research brain inside Synesis. ${scopeRule}

CURRENTNESS REQUIREMENT:
Search the live web now. Prefer primary official authorities, gazettes, regulators, legislation databases and courts. Distinguish publication date, effective date, amendment date and current consolidated position. Never describe a proposal as operative law. If primary authority cannot be verified, say so.

EXPOSURE DISCIPLINE:
For every High or Medium legal risk discussed, separate: (1) contractual exposure, (2) statutory/regulatory exposure, (3) operational exposure, (4) litigation/enforcement exposure, and (5) evidence/confidence. State an exact monetary amount only when a source or the document supplies a legally relevant number. Otherwise state that the amount is unquantified or scenario-based and explain what facts are missing.

OUTPUT:
Lead with the current legal conclusion. Then give the controlling/current authority, what changed, applicability, independent analysis, risk level, exposure rationale, uncertainties, and concrete next action. Cite current sources in the answer.

PURPOSE: ${purpose}
JURISDICTION: ${jurisdiction || 'Determine from question/document'}
REGULATOR: ${regulator || 'Determine if relevant'}
QUESTION: ${question}
${isolatedDocument ? `\nSELECTED DOCUMENT ONLY:\n---\n${isolatedDocument}\n---` : ''}
${organisation ? `\nSUPPLIED ORGANISATION CONTEXT:\n${organisation}` : ''}`;

  const response = await client.responses.create({
    model,
    tools: [webTool],
    input,
    store: false,
    reasoning: { effort: 'high', context: 'current_turn' },
    text: { verbosity: 'medium' },
    max_output_tokens: 5000,
    include: ['web_search_call.action.sources']
  });

  return {
    runId,
    answer: response.output_text,
    citations: extractWebCitations(response),
    researchedAt: new Date().toISOString(),
    model,
    liveWebUsed: true,
    allowedDomains: domains,
    isolation: {
      scope: document ? 'single-document' : organisationContext ? 'institution-only' : 'standalone',
      documentId: document?.id || null,
      otherDocumentMemoryUsed: false,
      currentWebResearchUsed: true
    }
  };
}

export function createWatchRecord(body = {}, userEmail = '') {
  const id = `watch-${hash(`${body.url}|${Date.now()}|${Math.random()}`).slice(0, 20)}`;
  return {
    id,
    name: String(body.name || '').trim().slice(0, 180) || String(body.url || '').trim(),
    url: String(body.url || '').trim(),
    regulator: String(body.regulator || '').trim().slice(0, 140),
    jurisdiction: String(body.jurisdiction || '').trim().slice(0, 100),
    domain: String(body.domain || '').trim().slice(0, 180),
    authorityRank: Math.max(1, Math.min(100, Number(body.authorityRank || 90))),
    enabled: true,
    createdAt: new Date().toISOString(),
    createdBy: userEmail,
    lastCheckedAt: null,
    lastContentHash: null,
    lastStatus: 'Awaiting first snapshot'
  };
}

export function inferChangeType(title) {
  return classifyLegalChange(title);
}
