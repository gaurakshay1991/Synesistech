import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BrainCircuit, ExternalLink, FileSearch2, Globe2, Link2, Plus, RefreshCw, Radar, Scale, ShieldCheck, Zap } from 'lucide-react';
import { Panel, RiskBadge, Status, formatDate } from './ui.jsx';

export function LiveBrain({ state, documents, activeDocument, request, setState, setNotice, onOpenDocument }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [researchBusy, setResearchBusy] = useState(false);
  const [question, setQuestion] = useState('What material legal or regulatory changes published recently could affect our current operations or contracts?');
  const [scope, setScope] = useState('standalone');
  const [jurisdiction, setJurisdiction] = useState('India');
  const [regulator, setRegulator] = useState('');
  const [research, setResearch] = useState(null);
  const [watchOpen, setWatchOpen] = useState(false);
  const [watch, setWatch] = useState({ name: '', url: '', regulator: '', jurisdiction: 'India', domain: '', authorityRank: 95 });
  const [documentId, setDocumentId] = useState(activeDocument?.id || documents?.[0]?.id || '');
  const [documentQuestion, setDocumentQuestion] = useState('Analyse this document independently against the law and regulatory position that is current today. What has changed, what is non-compliant or risky, and what should be revised now?');
  const [documentResearch, setDocumentResearch] = useState(null);
  const [exposure, setExposure] = useState(null);
  const [documentBusy, setDocumentBusy] = useState(false);

  async function refreshStatus() {
    try { setStatus(await request('/live/status')); } catch (error) { setNotice({ type: 'error', message: error.message }); }
  }

  useEffect(() => { refreshStatus(); }, []);
  useEffect(() => { if (activeDocument?.id) setDocumentId(activeDocument.id); }, [activeDocument?.id]);

  async function syncNow() {
    setBusy(true);
    try {
      const data = await request('/live/sync', { method: 'POST', body: '{}' });
      setState(data.state);
      await refreshStatus();
      setNotice({ type: 'success', message: `Live source sync completed. ${data.liveBrain?.lastDetectedCount || 0} new source events detected.` });
    } catch (error) { setNotice({ type: 'error', message: error.message }); }
    finally { setBusy(false); }
  }

  async function askLive(e) {
    e.preventDefault(); setResearchBusy(true);
    try {
      setResearch(await request('/live/ask', { method: 'POST', body: JSON.stringify({ question, scope, jurisdiction, regulator }) }));
    } catch (error) { setNotice({ type: 'error', message: error.message }); }
    finally { setResearchBusy(false); }
  }

  async function addWatch(e) {
    e.preventDefault();
    try {
      const data = await request('/live/watch', { method: 'POST', body: JSON.stringify(watch) });
      setState(data.state); setWatchOpen(false); setWatch({ name: '', url: '', regulator: '', jurisdiction: 'India', domain: '', authorityRank: 95 });
      await refreshStatus();
      setNotice({ type: 'success', message: 'Authoritative URL added to the independent change-monitoring watchlist.' });
    } catch (error) { setNotice({ type: 'error', message: error.message }); }
  }

  async function analyseDocumentLive(e) {
    e.preventDefault(); if (!documentId) return;
    setDocumentBusy(true); setExposure(null);
    try {
      setDocumentResearch(await request(`/documents/${documentId}/live-ask`, { method: 'POST', body: JSON.stringify({ question: documentQuestion, jurisdiction }) }));
    } catch (error) { setNotice({ type: 'error', message: error.message }); }
    finally { setDocumentBusy(false); }
  }

  async function quantifyExposure() {
    if (!documentId) return;
    setDocumentBusy(true);
    try { setExposure(await request(`/documents/${documentId}/exposure`, { method: 'POST', body: JSON.stringify({ live: true }) })); }
    catch (error) { setNotice({ type: 'error', message: error.message }); }
    finally { setDocumentBusy(false); }
  }

  const selectedDocument = useMemo(() => documents.find(item => item.id === documentId), [documents, documentId]);
  const live = status?.liveBrain || state.liveBrain || {};
  const latest = status?.latest || [];
  const sources = status?.sources || [];
  const watchlist = status?.watchlist || [];

  return <>
    <div className="module-hero regulatory-hero"><div><span className="eyebrow">SYNESIS LIVE LEGAL BRAIN</span><h2>Current law in. Independent reasoning out.</h2><p>Official source monitors detect change continuously. Every live answer performs fresh current-law research. Every document run is isolated from every other document, account and matter unless you explicitly choose institutional scope.</p></div><BrainCircuit size={78} /></div>

    <div className="metric-grid">
      <div className="metric-card"><span><Activity size={18} /> Brain status</span><strong>{live.status || 'Configured'}</strong><small>{live.lastSyncAt ? `Last sync ${formatDate(live.lastSyncAt)}` : 'Awaiting first sync'}</small></div>
      <div className="metric-card"><span><Radar size={18} /> Live changes</span><strong>{state.metrics?.liveChanges24h || 0}</strong><small>independently detected in 24h</small></div>
      <div className="metric-card"><span><Globe2 size={18} /> Sources</span><strong>{sources.length}</strong><small>{live.monitoredBackgroundSources || 0} autonomous · {live.queryTimeSources || 0} live-search</small></div>
      <div className="metric-card"><span><Link2 size={18} /> URL watches</span><strong>{watchlist.filter(item => item.enabled).length}</strong><small>content-fingerprint monitors</small></div>
    </div>

    <div className="section-head"><div><small>Autonomous regulatory nervous system</small><h2>Current authoritative source activity</h2></div><div className="form-actions"><button className="ghost" onClick={() => setWatchOpen(value => !value)}><Plus size={16} /> Monitor source URL</button><button className="primary" onClick={syncNow} disabled={busy}>{busy ? <RefreshCw className="spin" size={16} /> : <RefreshCw size={16} />} Sync now</button></div></div>

    {watchOpen && <form className="inline-workbench" onSubmit={addWatch}>
      <label>Source name<input required value={watch.name} onChange={e => setWatch({ ...watch, name: e.target.value })} placeholder="Official Gazette / regulator page" /></label>
      <label className="span-2">Official HTTPS URL<input required type="url" value={watch.url} onChange={e => setWatch({ ...watch, url: e.target.value })} placeholder="https://official-authority.example/..." /></label>
      <label>Regulator<input value={watch.regulator} onChange={e => setWatch({ ...watch, regulator: e.target.value })} /></label>
      <label>Jurisdiction<input value={watch.jurisdiction} onChange={e => setWatch({ ...watch, jurisdiction: e.target.value })} /></label>
      <label className="span-2">Legal domain<input value={watch.domain} onChange={e => setWatch({ ...watch, domain: e.target.value })} placeholder="Banking, privacy, AI, sanctions..." /></label>
      <label>Authority confidence<input type="number" min="1" max="100" value={watch.authorityRank} onChange={e => setWatch({ ...watch, authorityRank: Number(e.target.value) })} /></label>
      <div className="span-4 form-actions"><button type="button" className="ghost" onClick={() => setWatchOpen(false)}>Cancel</button><button className="primary">Add monitored authority</button></div>
    </form>}

    <div className="two-col wide-left">
      <Panel title="Live current-law research" subtitle="Fresh web-grounded answer; no pre-fed legal conclusion"><form className="compact-form" onSubmit={askLive}>
        <label>Research scope<select value={scope} onChange={e => setScope(e.target.value)}><option value="standalone">Fresh standalone — no institutional memory</option><option value="institution">Institution + fresh current law</option></select></label>
        <div className="form-pair"><label>Jurisdiction<input value={jurisdiction} onChange={e => setJurisdiction(e.target.value)} placeholder="India / EU / US / Global" /></label><label>Regulator (optional)<input value={regulator} onChange={e => setRegulator(e.target.value)} placeholder="RBI / SEBI / FCA / SEC" /></label></div>
        <label>Question<textarea required value={question} onChange={e => setQuestion(e.target.value)} /></label>
        <button className="primary" disabled={researchBusy}>{researchBusy ? <><RefreshCw className="spin" size={16} /> Researching live law…</> : <><Zap size={16} /> Ask the live brain</>}</button>
      </form>{research && <LiveResult result={research} />}</Panel>
      <Panel title="Source health" subtitle="Primary sources first; scraping only where lawful and technically configured"><div className="source-stack">{sources.map(source => <div className="source-row" key={source.id}><Globe2 /><div><strong>{source.name}</strong><small>{source.jurisdiction} · {source.type}</small></div><Status value={source.status} /></div>)}</div></Panel>
    </div>

    <div className="section-head"><div><small>Independent source events</small><h2>What changed without being manually fed</h2></div></div>
    <div className="regulatory-grid">{latest.slice(0, 24).map(item => <article key={item.id} className="regulatory-card"><header><RiskBadge value={item.severity} /><span className="eyebrow">{item.changeType}</span></header><h3>{item.title}</h3><p>{item.summary || 'Direct source event detected. Run an impact analysis to establish legal effect and applicability.'}</p><div className="regulatory-meta"><div><small>Authority</small><strong>{item.regulator}</strong></div><div><small>Jurisdiction</small><strong>{item.jurisdiction}</strong></div><div><small>First seen</small><strong>{formatDate(item.firstSeenAt || item.retrievedAt)}</strong></div><div><small>Confidence</small><strong>{item.confidence || 0}%</strong></div></div><footer><span>{item.provenance}</span>{item.sourceReference && <a className="text-button" href={item.sourceReference} target="_blank" rel="noreferrer">Primary source <ExternalLink size={14} /></a>}</footer></article>)}</div>

    <div className="section-head"><div><small>Zero cross-document contamination</small><h2>Independent document intelligence + exposure</h2></div></div>
    <div className="two-col wide-left"><Panel title="Select exactly one document" subtitle="Only the selected source text and live public authorities enter this run"><form className="compact-form" onSubmit={analyseDocumentLive}>
      <label>Document<select value={documentId} onChange={e => { setDocumentId(e.target.value); setDocumentResearch(null); setExposure(null); }}><option value="">Select document</option>{documents.map(item => <option value={item.id} key={item.id}>{item.title} · {item.jurisdiction}</option>)}</select></label>
      {selectedDocument && <div className="guardrail-list"><span><ShieldCheck />Isolation: single document only</span><span><Scale />Existing risk: {selectedDocument.overallRisk || 'Unassessed'} · score {selectedDocument.score ?? '—'}</span><span><FileSearch2 />Matter: {selectedDocument.matter || 'General review'}</span></div>}
      <label>Live analysis question<textarea required value={documentQuestion} onChange={e => setDocumentQuestion(e.target.value)} /></label>
      <div className="form-actions"><button className="primary" disabled={!documentId || documentBusy}>{documentBusy ? <RefreshCw className="spin" size={16} /> : <BrainCircuit size={16} />} Analyse independently</button><button type="button" className="ghost" disabled={!documentId || documentBusy} onClick={quantifyExposure}><AlertTriangle size={16} /> Quantify exposure</button>{selectedDocument && onOpenDocument && <button type="button" className="ghost" onClick={() => onOpenDocument(selectedDocument.id)}>Open review</button>}</div>
    </form>{documentResearch && <LiveResult result={documentResearch} />}</Panel>
    <Panel title="Exposure discipline" subtitle="No invented fines, damages or false precision">{exposure ? <ExposureResult data={exposure} /> : <div className="guardrail-list"><span><Scale />Express cap → bounded amount</span><span><AlertTriangle />Uncapped liability → contractually unbounded</span><span><Activity />No reliable amount → unquantified, not guessed</span><span><Globe2 />Statutory penalties → researched against current authority</span><span><ShieldCheck />High/Medium severity never automatically becomes a made-up monetary number</span></div>}</Panel></div>
  </>;
}

function LiveResult({ result }) {
  return <div className="answer-card"><header><div><small>LIVE RESEARCH RUN</small><strong>{result.model}</strong></div><Status value={result.liveWebUsed ? 'Live web used' : 'No live web'} /></header><p className="answer-text" style={{ whiteSpace: 'pre-wrap' }}>{result.answer}</p><div className="chip-list"><span>{result.isolation?.scope}</span><span>{result.citations?.length || 0} sources</span><span>{formatDate(result.researchedAt)}</span></div>{result.citations?.length > 0 && <div className="source-stack">{result.citations.slice(0, 16).map((source, index) => <a className="source-row" href={source.url} target="_blank" rel="noreferrer" key={`${source.url}-${index}`}><Globe2 /><div><strong>{source.title}</strong><small>{source.url}</small></div><ExternalLink size={15} /></a>)}</div>}</div>;
}

function ExposureResult({ data }) {
  const model = data.exposure;
  return <div className="exposure-result"><div className="chip-list"><span>{model.materialFindings} material findings</span><span>{model.summary.exactOrBounded} exact/bounded</span><span>{model.summary.scenario} scenario</span><span>{model.summary.unquantified} unquantified</span></div>{model.exposures.map(item => <div className="risk-row" key={item.findingId}><div><RiskBadge value={item.riskLevel} /><strong>{item.category}</strong><p>{item.issue}</p><small>{item.quantificationStatus} · confidence {item.confidence}%</small></div><div><strong>{item.exposureLabel}</strong><p>{item.rationale}</p>{item.directContractualExposure?.currency && <small>{formatExposure(item.directContractualExposure)}</small>}</div></div>)}{data.authorityResearch && <div className="answer-card"><header><strong>Current statutory / regulatory exposure research</strong><Status value="Live authority research" /></header><p style={{ whiteSpace: 'pre-wrap' }}>{data.authorityResearch.answer}</p>{data.authorityResearch.citations?.map((source,index) => <a className="text-button" key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer">{source.title} <ExternalLink size={13} /></a>)}</div>}</div>;
}

function formatExposure(value) {
  if (value.ceiling != null) return `Detected ceiling: ${value.currency} ${Number(value.ceiling).toLocaleString()}`;
  if (value.low != null) return `Scenario band: ${value.currency} ${Number(value.low).toLocaleString()} – ${Number(value.high).toLocaleString()} (base ${Number(value.base).toLocaleString()})`;
  return 'No monetary ceiling asserted.';
}
