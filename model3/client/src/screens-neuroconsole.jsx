import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, BrainCircuit, CheckCircle2, ChevronRight, FilePlus2,
  FileSearch2, Globe2, Network, RefreshCw, Scale, Send, ShieldCheck, Sparkles,
  UploadCloud, Zap
} from 'lucide-react';
import { Panel, RiskBadge, Status, formatDate } from './ui.jsx';

function confidenceLabel(value) {
  const n = Number(value || 0);
  if (n >= 80) return 'High confidence';
  if (n >= 60) return 'Moderate confidence';
  return 'Low confidence / challenge required';
}

function materialFindings(analysis = {}) {
  return (analysis.findings || []).filter(item => ['Critical', 'High', 'Medium'].includes(item.risk_level || item.risk || item.severity));
}

export function NeuroConsole({ state, documents, activeDocument, request, setNotice, onOpenDocument, onUpload, openPage }) {
  const [brain, setBrain] = useState(null);
  const [controls, setControls] = useState(null);
  const [scope, setScope] = useState(activeDocument?.id || documents?.[0]?.id ? 'document' : 'institution');
  const [documentId, setDocumentId] = useState(activeDocument?.id || documents?.[0]?.id || '');
  const [detail, setDetail] = useState(activeDocument || null);
  const [question, setQuestion] = useState('What requires my attention now, what changed in current law, what is the real exposure, and what should I do next?');
  const [jurisdiction, setJurisdiction] = useState(activeDocument?.jurisdiction || 'India');
  const [dataClass, setDataClass] = useState('internal');
  const [mode, setMode] = useState('governed');
  const [requestedAction, setRequestedAction] = useState('');
  const [result, setResult] = useState(null);
  const [exposure, setExposure] = useState(null);
  const [busy, setBusy] = useState(false);
  const [exposureBusy, setExposureBusy] = useState(false);

  async function loadSystem() {
    const settled = await Promise.allSettled([request('/live/status'), request('/cognitive/control-plane')]);
    if (settled[0].status === 'fulfilled') setBrain(settled[0].value);
    if (settled[1].status === 'fulfilled') setControls(settled[1].value);
  }

  useEffect(() => { loadSystem(); }, []);
  useEffect(() => {
    if (activeDocument?.id) {
      setDocumentId(activeDocument.id);
      setDetail(activeDocument);
      setScope('document');
      if (activeDocument.jurisdiction) setJurisdiction(activeDocument.jurisdiction);
    }
  }, [activeDocument?.id]);

  useEffect(() => {
    if (!documentId) { setDetail(null); return; }
    if (activeDocument?.id === documentId) { setDetail(activeDocument); return; }
    request(`/documents/${documentId}`).then(data => {
      setDetail(data.document);
      if (data.document?.jurisdiction) setJurisdiction(data.document.jurisdiction);
    }).catch(error => setNotice({ type: 'error', message: error.message }));
  }, [documentId]);

  const analysis = detail?.analysis || {};
  const findings = materialFindings(analysis);
  const relevantTasks = useMemo(() => {
    const all = state.tasks || [];
    return scope === 'document' && documentId ? all.filter(item => item.documentId === documentId) : all;
  }, [state.tasks, scope, documentId]);
  const latest = brain?.latest || [];
  const sources = brain?.sources || [];
  const liveBrain = brain?.liveBrain || state.liveBrain || {};

  async function run(e) {
    e.preventDefault();
    setBusy(true); setResult(null);
    try {
      const body = {
        question,
        mode,
        dataClass,
        jurisdiction,
        requestedAction,
        scope: scope === 'document' ? `document:${documentId}` : 'institution',
        documentId: scope === 'document' ? documentId : undefined
      };
      const data = await request('/cognitive/run', { method: 'POST', body: JSON.stringify(body) });
      setResult(data);
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally { setBusy(false); }
  }

  async function quantify() {
    if (!documentId) return;
    setExposureBusy(true);
    try {
      setExposure(await request(`/documents/${documentId}/exposure`, { method: 'POST', body: JSON.stringify({ live: true }) }));
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally { setExposureBusy(false); }
  }

  const deterministic = result?.deterministic;
  const probabilistic = result?.probabilistic;
  const intelligence = result?.intelligence;
  const policy = controls?.controls || {};

  return <>
    <div className="module-hero regulatory-hero">
      <div>
        <span className="eyebrow">SYNESIS NEURO INTELLIGENCE CORE</span>
        <h2>One brain for evidence, current law, exposure, decisions and action.</h2>
        <p>Upload a real document, isolate the matter, analyse it against current authoritative law, quantify only defensible exposure, challenge the answer probabilistically, and keep consequential actions behind deterministic human-controlled gates.</p>
        <div className="form-actions" style={{ marginTop: 16 }}>
          <button className="primary" onClick={onUpload}><UploadCloud size={17} /> Analyse a document</button>
          <button className="ghost" onClick={() => openPage('livebrain')}><Globe2 size={17} /> Open live legal brain</button>
          <button className="ghost" onClick={() => openPage('work')}><AlertTriangle size={17} /> Attention queue</button>
        </div>
      </div>
      <BrainCircuit size={82} />
    </div>

    <div className="metric-grid">
      <div className="metric-card"><span><FileSearch2 size={18} /> Matters</span><strong>{documents.length}</strong><small>independently analysed sources</small></div>
      <div className="metric-card"><span><AlertTriangle size={18} /> Attention</span><strong>{state.metrics?.attention || 0}</strong><small>owned risks, blockers or decisions</small></div>
      <div className="metric-card"><span><Globe2 size={18} /> Live sources</span><strong>{sources.length}</strong><small>{liveBrain.monitoredBackgroundSources || 0} autonomous monitors</small></div>
      <div className="metric-card"><span><Network size={18} /> Institutional graph</span><strong>{state.graph?.nodes?.length || 0}</strong><small>{state.graph?.edges?.length || 0} linked relationships</small></div>
    </div>

    <div className="two-col wide-left">
      <Panel title="Natural-language command" subtitle="TAU-like central interaction, with enterprise control over information flow and action">
        <form className="compact-form" onSubmit={run}>
          <div className="form-pair">
            <label>Scope<select value={scope} onChange={e => setScope(e.target.value)}><option value="document">One document only</option><option value="institution">Institutional state</option></select></label>
            <label>Mode<select value={mode} onChange={e => setMode(e.target.value)}><option value="governed">Governed hybrid</option><option value="probabilistic">Probabilistic + governed</option><option value="deterministic">Deterministic only</option></select></label>
          </div>
          {scope === 'document' && <label>Selected matter<select value={documentId} onChange={e => { setDocumentId(e.target.value); setResult(null); setExposure(null); }}><option value="">Select a document</option>{documents.map(doc => <option value={doc.id} key={doc.id}>{doc.title} · {doc.jurisdiction}</option>)}</select></label>}
          <div className="form-pair">
            <label>Jurisdiction<input value={jurisdiction} onChange={e => setJurisdiction(e.target.value)} /></label>
            <label>Information class<select value={dataClass} onChange={e => setDataClass(e.target.value)}><option value="public">Public</option><option value="internal">Internal</option><option value="confidential">Confidential</option><option value="restricted">Restricted</option></select></label>
          </div>
          <label>Ask Synesis<textarea value={question} onChange={e => setQuestion(e.target.value)} required /></label>
          <label>Requested real-world action (optional)<input value={requestedAction} onChange={e => setRequestedAction(e.target.value)} placeholder="e.g. approve, execute, escalate, suspend, negotiate" /></label>
          <div className="form-actions"><button className="primary" disabled={busy || (scope === 'document' && !documentId)}>{busy ? <><RefreshCw className="spin" size={16} /> Reasoning…</> : <><Send size={16} /> Run governed analysis</>}</button>{scope === 'document' && <button type="button" className="ghost" disabled={!documentId || exposureBusy} onClick={quantify}><Scale size={16} /> {exposureBusy ? 'Quantifying…' : 'Quantify exposure'}</button>}</div>
        </form>

        {result && <div className="answer-card" style={{ marginTop: 16 }}>
          <header><div><small>GOVERNED COGNITIVE RUN</small><strong>{result.runId}</strong></div><RiskBadge value={deterministic?.riskLevel} /></header>
          <div className="chip-list"><span>{result.scope?.type}</span><span>{result.mode?.effective}</span><span>{result.informationFlow?.externalResearchAllowed ? 'live research allowed' : 'research constrained'}</span><span>{result.governor?.required ? 'human approval required' : 'decision support only'}</span></div>
          <p className="answer-text" style={{ whiteSpace: 'pre-wrap' }}>{intelligence?.answer || result.governor?.disposition || 'No external model output was used; deterministic governance result returned.'}</p>
          {intelligence?.citations?.length > 0 && <div className="source-stack">{intelligence.citations.slice(0, 12).map((source, index) => <a className="source-row" href={source.url} target="_blank" rel="noreferrer" key={`${source.url}-${index}`}><Globe2 /><div><strong>{source.title}</strong><small>{source.url}</small></div><ChevronRight size={15} /></a>)}</div>}
        </div>}
      </Panel>

      <Panel title="Control state" subtitle="The model proposes; the governor controls what may flow, persist or execute">
        <div className="guardrail-list">
          <span><ShieldCheck />Safe mode: {policy.safeMode === false ? 'OFF' : 'ON'}</span>
          <span><Zap />Kill switch: {policy.killSwitch ? 'ACTIVE' : 'ready'}</span>
          <span><Globe2 />External research: {policy.externalResearch === false ? 'blocked' : 'policy-controlled'}</span>
          <span><BrainCircuit />External models: {policy.externalModels === false ? 'blocked' : 'policy-controlled'}</span>
          <span><Network />Durable memory promotion: {policy.allowMemoryPromotion ? 'authorised by policy' : 'manual approval only'}</span>
          <span><Scale />Abstention threshold: {policy.abstentionThreshold ?? '—'}</span>
        </div>
        <button className="text-button" style={{ marginTop: 12 }} onClick={() => openPage('admin')}>Open AI Control Tower <ChevronRight size={15} /></button>
      </Panel>
    </div>

    <div className="section-head"><div><small>SNEH workflow + SYNESIS intelligence</small><h2>Current matter</h2></div><button className="text-button" onClick={onUpload}>Analyse another document <FilePlus2 size={15} /></button></div>
    {detail ? <div className="two-col wide-left">
      <Panel title={detail.title} subtitle={`${detail.matter || 'General matter'} · ${detail.documentType || 'Document'} · ${detail.jurisdiction || 'Jurisdiction not set'}`}>
        <div className="review-head" style={{ marginBottom: 12 }}><div><span className="eyebrow">INDEPENDENT MATTER</span><p>{analysis.document_summary || analysis.summary || 'Independent document analysis.'}</p></div><div className="review-score"><RiskBadge value={analysis.overall_risk || detail.overallRisk} /><strong>{analysis.overall_score ?? detail.score ?? '—'}<small>/100</small></strong></div></div>
        <div className="guardrail-list"><span><ShieldCheck />Cross-document memory: excluded</span><span><BrainCircuit />Engine: {analysis.engine || detail.engine || 'Synesis'}</span><span><Globe2 />Current-law pass: {analysis.analysis_details?.current_law_web_used ? 'used' : analysis.live_current_law?.liveWebUsed ? 'used' : 'not recorded'}</span></div>
        <div className="form-actions" style={{ marginTop: 12 }}><button className="primary" onClick={() => onOpenDocument(detail.id)}>Open full analysis <ChevronRight size={15} /></button><button className="ghost" onClick={quantify} disabled={exposureBusy}><Scale size={15} /> Exposure</button></div>
      </Panel>
      <Panel title="Material findings" subtitle={`${findings.length} Critical / High / Medium issues`}>
        <div className="source-stack">{findings.slice(0, 6).map((item, index) => <div className="source-row" key={item.id || index}><RiskBadge value={item.risk_level || item.risk || item.severity} /><div><strong>{item.issue || item.title}</strong><small>{item.clause_reference || item.clause_label || item.category} · {confidenceLabel(item.confidence || item.confidence_score)}</small></div></div>)}</div>
      </Panel>
    </div> : <Panel title="No selected matter" subtitle="Create the evidence before asking the brain to reason about it"><div className="empty-state"><UploadCloud size={28} /><h3>Upload the agreement, policy, circular, case file or evidence pack</h3><p>Synesis will extract it, analyse it independently, verify current law, map risks and obligations, and expose the reasoning trace.</p><button className="primary" onClick={onUpload}>Analyse first document</button></div></Panel>}

    {exposure?.exposure && <div className="section-head"><div><small>Evidence-based quantification</small><h2>Organisation exposure for this matter</h2></div></div>}
    {exposure?.exposure && <Panel title="Exposure model" subtitle="Risk severity and monetary exposure are deliberately separate">{exposure.exposure.exposures?.map(item => <div className="risk-row" key={item.findingId}><div><RiskBadge value={item.riskLevel} /><strong>{item.category}</strong><p>{item.issue}</p></div><div><strong>{item.exposureLabel}</strong><p>{item.rationale}</p><small>{item.quantificationStatus} · confidence {item.confidence}%</small></div></div>)}{exposure.authorityResearch?.answer && <div className="answer-card"><header><strong>Current statutory / regulatory exposure research</strong><Status value="Live authority research" /></header><p style={{ whiteSpace: 'pre-wrap' }}>{exposure.authorityResearch.answer}</p></div>}</Panel>}

    <div className="section-head"><div><small>What needs action</small><h2>Inbox, tasks and live change</h2></div></div>
    <div className="three-col">
      <Panel title="Attention inbox" subtitle="Material risk signals"><div className="source-stack">{(state.alerts || []).slice(0, 6).map(item => <div className="source-row" key={item.id}><RiskBadge value={item.severity} /><div><strong>{item.title}</strong><small>{item.owner} · {formatDate(item.due)}</small></div></div>)}</div></Panel>
      <Panel title="Owned actions" subtitle={scope === 'document' ? 'Tasks generated from selected matter' : 'Institutional work queue'}><div className="source-stack">{relevantTasks.slice(0, 6).map(item => <div className="source-row" key={item.id}><CheckCircle2 /><div><strong>{item.title}</strong><small>{item.owner} · {item.status} · {item.priority}</small></div></div>)}</div></Panel>
      <Panel title="Live regulatory pulse" subtitle={`${latest.length} independently observed source events`}><div className="source-stack">{latest.slice(0, 6).map(item => <a className="source-row" href={item.sourceReference} target="_blank" rel="noreferrer" key={item.id}><Activity /><div><strong>{item.title}</strong><small>{item.regulator} · {item.changeType} · {formatDate(item.firstSeenAt || item.retrievedAt)}</small></div></a>)}</div></Panel>
    </div>

    {probabilistic?.options?.length > 0 && <><div className="section-head"><div><small>Probabilistic decision support</small><h2>Competing courses of action</h2></div></div><Panel title="Decision distribution" subtitle="Analytical weights, not fabricated real-world probabilities"><div className="source-stack">{probabilistic.options.map(item => <div className="source-row" key={item.option}><BrainCircuit /><div><strong>{item.option}</strong><small>{Math.round(Number(item.probability || 0) * 100)}% analytical weight</small></div></div>)}</div></Panel></>}
  </>;
}
