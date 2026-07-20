import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, BrainCircuit, CheckCircle2, CircleAlert,
  CircleDot, ClipboardCheck, Download, FileCheck2, FileText, Gauge, Landmark,
  LoaderCircle, Network, PlayCircle, RefreshCw, Scale, ShieldCheck, Target,
  UploadCloud, Users, Workflow
} from 'lucide-react';

const API = '/api';
const STORE = 'live-synesis-institutional-command-v1';
const FUNCTIONS = ['Compliance', 'Legal', 'Risk', 'Investment / Treasury', 'Operations', 'Technology', 'Finance / Credit', 'Management', 'Board / Trustees', 'Procurement'];
const SOURCE_TYPES = ['Regulatory change', 'Contract or legal document', 'Portfolio or mandate event', 'Vendor or counterparty event', 'Audit or control finding', 'Cyber or operational incident', 'Management decision'];

function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadWorkspace() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE) || '{}');
    return {
      events: Array.isArray(parsed.events) ? parsed.events : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
      activeEventId: parsed.activeEventId || null
    };
  } catch {
    return { events: [], decisions: [], actions: [], evidence: [], activeEventId: null };
  }
}

function persistWorkspace(value) {
  localStorage.setItem(STORE, JSON.stringify(value));
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function riskTone(value = 'Low') {
  return `os-risk ${String(value).toLowerCase().replace(/[^a-z]+/g, '-')}`;
}

function download(name, value, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function api(path, body) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!response.ok) throw new Error(data.detail || data.error || 'LIVE SYNESIS request failed.');
  return data;
}

async function extract(file) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(`PAGE ${pageNumber}\n${content.items.map(item => item.str).join(' ')}`);
    }
    return pages.join('\n\n');
  }
  if (ext === 'docx') {
    const module = await import('mammoth/mammoth.browser.js');
    const mammoth = module.default || module;
    return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  }
  return file.text();
}

function buildBundle(analysis, form) {
  const eventId = uid();
  const intelligence = analysis.decision_intelligence || {};
  const now = new Date().toISOString();
  const questions = Array.isArray(intelligence.decision_questions) ? intelligence.decision_questions : [];
  const plan = Array.isArray(intelligence.action_plan) ? intelligence.action_plan : [];
  const obligations = Array.isArray(intelligence.obligations) ? intelligence.obligations : [];
  const affectedAreas = Array.isArray(intelligence.affected_areas) ? intelligence.affected_areas : [];
  const evidenceGaps = Array.isArray(intelligence.evidence_gaps) ? intelligence.evidence_gaps : [];
  const verifiedSources = analysis.source_verification?.sources || analysis.external_intelligence?.sources || [];
  const live = Boolean(analysis.analysis_details?.live_ai_used);

  const decisions = questions.map((question, index) => ({
    id: uid(), eventId, question, status: 'Pending', owner: form.functionName,
    approvalGate: plan[index]?.approval_gate || 'Authorised owner approval', comment: '', createdAt: now, updatedAt: now
  }));

  const actions = plan.map(item => ({
    id: uid(), eventId, title: item.action, owner: item.owner || form.functionName,
    priority: item.priority || 'Before Approval', approvalGate: item.approval_gate || 'Authorised owner approval',
    evidenceRequired: item.completion_evidence || 'Documented completion evidence', status: 'Open',
    createdAt: now, updatedAt: now
  }));

  const event = {
    id: eventId,
    title: form.title.trim() || analysis.document_title || 'Institutional event',
    sourceType: form.sourceType,
    functionName: form.functionName,
    createdAt: now,
    status: live ? (questions.length || actions.length ? 'Decision Required' : 'Under Review') : 'Verification Required',
    overallRisk: analysis.overall_risk || 'Medium',
    overallScore: Number.isFinite(analysis.overall_score) ? analysis.overall_score : null,
    recommendedDecision: analysis.recommended_decision || 'Authorised review required',
    executivePosition: analysis.executive_position || analysis.document_summary || '',
    summary: analysis.document_summary || '',
    affectedAreas,
    obligations,
    evidenceGaps,
    stakeholders: intelligence.stakeholder_impact || {},
    dependencies: intelligence.dependencies || [],
    findings: analysis.findings || [],
    verifiedSources,
    engine: analysis.engine,
    liveAnalysis: live,
    rawAnalysis: analysis
  };

  return { event, decisions, actions };
}

export default function InstitutionalCommand() {
  const initial = useMemo(loadWorkspace, []);
  const [workspace, setWorkspace] = useState(initial);
  const [tab, setTab] = useState('command');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [evidenceForm, setEvidenceForm] = useState({ title: '', note: '' });
  const [form, setForm] = useState({
    title: '', sourceType: 'Regulatory change', functionName: 'Compliance', text: ''
  });

  useEffect(() => persistWorkspace(workspace), [workspace]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(timer);
  }, [notice]);

  const activeEvent = workspace.events.find(item => item.id === workspace.activeEventId) || workspace.events[0] || null;
  const activeDecisions = workspace.decisions.filter(item => item.eventId === activeEvent?.id);
  const activeActions = workspace.actions.filter(item => item.eventId === activeEvent?.id);
  const activeEvidence = workspace.evidence.filter(item => item.eventId === activeEvent?.id);
  const openActions = workspace.actions.filter(item => !['Completed', 'Cancelled'].includes(item.status));
  const pendingDecisions = workspace.decisions.filter(item => item.status === 'Pending');
  const criticalEvents = workspace.events.filter(item => item.overallRisk === 'High' && item.status !== 'Closed');

  function chooseEvent(id) {
    setWorkspace(current => ({ ...current, activeEventId: id }));
  }

  async function chooseFile(file) {
    if (!file) return;
    setFileBusy(true);
    try {
      const text = await extract(file);
      setForm(current => ({ ...current, title: current.title || file.name.replace(/\.[^.]+$/, ''), text }));
      setNotice({ type: 'success', message: 'Source read successfully. Run institutional impact analysis when ready.' });
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setFileBusy(false);
    }
  }

  async function runAnalysis() {
    if (form.text.trim().length < 20) {
      setNotice({ type: 'error', message: 'Upload or paste the actual source before running analysis.' });
      return;
    }
    setBusy(true);
    try {
      const response = await api('/public/analyze', {
        text: form.text,
        title: form.title || 'Institutional event',
        matter: form.sourceType,
        documentType: form.sourceType === 'Regulatory change' ? 'Regulatory / Policy Document' : 'Auto-detect',
        jurisdiction: 'India',
        riskAppetite: 'Conservative',
        department: form.functionName,
        institutionFunction: form.functionName,
        workType: 'Calculate institutional impact and compile controlled execution',
        analysisObjective: 'Determine what changed, what is affected, what decision is required, who must act, which approvals apply and what evidence proves completion.',
        stakeholderLens: 'Institution, regulators, customers or investors, management, operations and capital',
        analysisMode: 'deep',
        useCurrentSources: true,
        countryCode: 'IN', city: 'New Delhi', region: 'Delhi', timezone: 'Asia/Kolkata'
      });
      const bundle = buildBundle(response.analysis, form);
      setWorkspace(current => ({
        ...current,
        events: [bundle.event, ...current.events],
        decisions: [...bundle.decisions, ...current.decisions],
        actions: [...bundle.actions, ...current.actions],
        activeEventId: bundle.event.id
      }));
      setTab('command');
      setNotice({
        type: bundle.event.liveAnalysis ? 'success' : 'error',
        message: bundle.event.liveAnalysis
          ? 'Institutional impact, decisions and controlled actions were compiled from the uploaded source.'
          : 'The live model was unavailable. The matter is marked Verification Required and must not be treated as completed analysis.'
      });
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setBusy(false);
    }
  }

  function updateDecision(id, status) {
    const now = new Date().toISOString();
    setWorkspace(current => ({
      ...current,
      decisions: current.decisions.map(item => item.id === id ? { ...item, status, updatedAt: now } : item)
    }));
  }

  function updateAction(id, status) {
    const now = new Date().toISOString();
    setWorkspace(current => ({
      ...current,
      actions: current.actions.map(item => item.id === id ? { ...item, status, updatedAt: now } : item)
    }));
  }

  function addEvidence(event) {
    event.preventDefault();
    if (!activeEvent || !evidenceForm.title.trim()) return;
    const item = {
      id: uid(), eventId: activeEvent.id, title: evidenceForm.title.trim(), note: evidenceForm.note.trim(),
      addedAt: new Date().toISOString(), status: 'Recorded'
    };
    setWorkspace(current => ({ ...current, evidence: [item, ...current.evidence] }));
    setEvidenceForm({ title: '', note: '' });
    setNotice({ type: 'success', message: 'Completion evidence recorded in the matter history.' });
  }

  function closeMatter() {
    if (!activeEvent) return;
    const unresolvedDecision = activeDecisions.some(item => item.status === 'Pending');
    const unresolvedAction = activeActions.some(item => !['Completed', 'Cancelled'].includes(item.status));
    if (unresolvedDecision || unresolvedAction || activeEvidence.length === 0) {
      setNotice({ type: 'error', message: 'Resolve decisions, complete or cancel all actions, and record closure evidence before closing the matter.' });
      return;
    }
    setWorkspace(current => ({
      ...current,
      events: current.events.map(item => item.id === activeEvent.id ? { ...item, status: 'Closed', closedAt: new Date().toISOString() } : item)
    }));
    setNotice({ type: 'success', message: 'Matter closed with a complete decision, action and evidence trail.' });
  }

  function removeMatter() {
    if (!activeEvent) return;
    setWorkspace(current => {
      const events = current.events.filter(item => item.id !== activeEvent.id);
      return {
        ...current,
        events,
        decisions: current.decisions.filter(item => item.eventId !== activeEvent.id),
        actions: current.actions.filter(item => item.eventId !== activeEvent.id),
        evidence: current.evidence.filter(item => item.eventId !== activeEvent.id),
        activeEventId: events[0]?.id || null
      };
    });
  }

  return <div className="os-shell">
    <section className="os-hero">
      <div><small>INSTITUTIONAL DECISION & EXECUTION OPERATING SYSTEM</small><h1>Know what changed. Calculate what is affected. Control what happens next.</h1><p>LIVE SYNESIS converts uploaded evidence into impact, decisions, accountable actions, approval gates and closure evidence. High-risk actions remain human-controlled.</p></div>
      <div className="os-hero-mark"><BrainCircuit size={50}/><span>Impact → Decision → Execution → Evidence</span></div>
    </section>

    {notice && <button className={`os-notice ${notice.type}`} onClick={() => setNotice(null)}>{notice.type === 'error' ? <CircleAlert size={18}/> : <CheckCircle2 size={18}/>}<span>{notice.message}</span></button>}

    <section className="os-metrics">
      <Metric icon={Landmark} label="Active institutional events" value={workspace.events.filter(item => item.status !== 'Closed').length}/>
      <Metric icon={AlertTriangle} label="High-risk matters" value={criticalEvents.length}/>
      <Metric icon={Scale} label="Decisions pending" value={pendingDecisions.length}/>
      <Metric icon={Workflow} label="Actions open" value={openActions.length}/>
      <Metric icon={FileCheck2} label="Evidence records" value={workspace.evidence.length}/>
    </section>

    <nav className="os-tabs">
      <button className={tab === 'command' ? 'active' : ''} onClick={() => setTab('command')}><Gauge size={17}/>Command centre</button>
      <button className={tab === 'ingest' ? 'active' : ''} onClick={() => setTab('ingest')}><UploadCloud size={17}/>Analyse new event</button>
      <button className={tab === 'decisions' ? 'active' : ''} onClick={() => setTab('decisions')}><Scale size={17}/>Decisions</button>
      <button className={tab === 'actions' ? 'active' : ''} onClick={() => setTab('actions')}><Workflow size={17}/>Actions</button>
      <button className={tab === 'evidence' ? 'active' : ''} onClick={() => setTab('evidence')}><ClipboardCheck size={17}/>Evidence & closure</button>
    </nav>

    {tab === 'command' && <CommandCentre events={workspace.events} activeEvent={activeEvent} decisions={activeDecisions} actions={activeActions} evidence={activeEvidence} chooseEvent={chooseEvent} setTab={setTab} closeMatter={closeMatter} removeMatter={removeMatter}/>} 
    {tab === 'ingest' && <Ingest form={form} setForm={setForm} chooseFile={chooseFile} fileBusy={fileBusy} run={runAnalysis} busy={busy}/>} 
    {tab === 'decisions' && <DecisionRegister items={workspace.decisions} events={workspace.events} update={updateDecision} chooseEvent={chooseEvent}/>} 
    {tab === 'actions' && <ActionRegister items={workspace.actions} events={workspace.events} update={updateAction} chooseEvent={chooseEvent}/>} 
    {tab === 'evidence' && <EvidenceRegister activeEvent={activeEvent} items={activeEvidence} form={evidenceForm} setForm={setEvidenceForm} add={addEvidence} gaps={activeEvent?.evidenceGaps || []} closeMatter={closeMatter}/>} 

    <footer className="os-footer"><span>Workspace data is retained locally in this public prototype. The private enterprise deployment uses the connected institutional database and controlled access.</span><button onClick={() => download('live-synesis-institutional-workspace.json', JSON.stringify(workspace, null, 2))}><Download size={15}/>Export workspace</button></footer>
  </div>;
}

function Metric({ icon: Icon, label, value }) {
  return <article><Icon size={20}/><div><strong>{value}</strong><small>{label}</small></div></article>;
}

function CommandCentre({ events, activeEvent, decisions, actions, evidence, chooseEvent, setTab, closeMatter, removeMatter }) {
  return <div className="os-command-grid">
    <section className="os-card os-queue">
      <div className="os-card-head"><div><small>EVENT QUEUE</small><h2>What requires attention</h2></div><button onClick={() => setTab('ingest')}><UploadCloud size={15}/>New event</button></div>
      {events.length ? <div className="os-event-list">{events.map(item => <button key={item.id} className={activeEvent?.id === item.id ? 'active' : ''} onClick={() => chooseEvent(item.id)}><span className={riskTone(item.overallRisk)}>{item.overallRisk}</span><span><strong>{item.title}</strong><small>{item.sourceType} · {item.status}</small></span><ArrowRight size={16}/></button>)}</div> : <Empty icon={Network} title="No institutional events yet" text="Upload a regulatory source, agreement, mandate, incident or control finding. Synesis will calculate its institutional impact and compile the execution path."/>}
    </section>

    <section className="os-card os-active">
      {activeEvent ? <>
        <div className="os-card-head"><div><small>ACTIVE MATTER</small><h2>{activeEvent.title}</h2><p>{activeEvent.sourceType} · {formatDate(activeEvent.createdAt)}</p></div><span className={riskTone(activeEvent.overallRisk)}>{activeEvent.overallRisk}{Number.isFinite(activeEvent.overallScore) ? ` ${activeEvent.overallScore}/100` : ''}</span></div>
        {!activeEvent.liveAnalysis && <div className="os-warning"><CircleAlert size={18}/><span>Emergency fallback only. Independent authorised verification is required.</span></div>}
        <div className="os-decision-banner"><Target size={22}/><div><small>RECOMMENDED POSITION</small><strong>{activeEvent.recommendedDecision}</strong><p>{activeEvent.executivePosition}</p></div></div>
        <div className="os-summary-grid"><Summary label="Decisions" value={decisions.filter(item => item.status === 'Pending').length} detail={`${decisions.length} compiled`}/><Summary label="Actions" value={actions.filter(item => !['Completed','Cancelled'].includes(item.status)).length} detail={`${actions.length} total`}/><Summary label="Evidence" value={evidence.length} detail={`${activeEvent.evidenceGaps.length} gaps identified`}/><Summary label="Status" value={activeEvent.status} detail={activeEvent.engine || 'Analysis engine'}/></div>
        <h3>Institutional blast radius</h3>
        <div className="os-impact-map">{activeEvent.affectedAreas.length ? activeEvent.affectedAreas.map((item, index) => <span key={index}><CircleDot size={13}/>{item}</span>) : <span><CircleDot size={13}/>Affected areas require authorised confirmation</span>}</div>
        <div className="os-two-column">
          <div><h3>Priority actions</h3>{actions.length ? <div className="os-mini-list">{actions.slice(0, 5).map(item => <article key={item.id}><span className={`os-status ${item.status.toLowerCase().replaceAll(' ','-')}`}>{item.status}</span><div><strong>{item.title}</strong><small>{item.owner} · {item.priority}</small></div></article>)}</div> : <p className="os-muted">No actions were compiled from this source.</p>}</div>
          <div><h3>Evidence gaps</h3>{activeEvent.evidenceGaps.length ? <ul className="os-gap-list">{activeEvent.evidenceGaps.slice(0, 6).map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="os-muted">No express evidence gaps were identified.</p>}</div>
        </div>
        {activeEvent.verifiedSources.length > 0 && <><h3>Current authoritative-source checks</h3><div className="os-sources">{activeEvent.verifiedSources.slice(0, 6).map((item, index) => <a key={index} href={item.url} target="_blank" rel="noreferrer">{item.title || item.url}<ArrowRight size={13}/></a>)}</div></>}
        <div className="os-matter-actions"><button onClick={() => setTab('decisions')}><Scale size={16}/>Resolve decisions</button><button onClick={() => setTab('actions')}><Workflow size={16}/>Control actions</button><button onClick={() => setTab('evidence')}><FileCheck2 size={16}/>Record evidence</button><button className="primary" onClick={closeMatter}><CheckCircle2 size={16}/>Close with proof</button><button className="danger" onClick={removeMatter}>Remove matter</button></div>
      </> : <Empty icon={BrainCircuit} title="Select or create an institutional matter" text="The active matter will display impact, decisions, accountable actions, evidence gaps and verified current sources."/>}
    </section>
  </div>;
}

function Summary({ label, value, detail }) {
  return <article><small>{label}</small><strong>{value}</strong><span>{detail}</span></article>;
}

function Ingest({ form, setForm, chooseFile, fileBusy, run, busy }) {
  return <div className="os-ingest-grid">
    <section className="os-card">
      <div className="os-card-head"><div><small>SOURCE OF TRUTH</small><h2>Analyse a live institutional event</h2></div><Activity size={24}/></div>
      <p>Use the actual circular, agreement, mandate, incident report, audit finding or management paper. Synesis starts from that evidence and independently checks current external intelligence where relevant.</p>
      <label>Event title<input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="e.g. SEBI circular affecting scheme disclosures"/></label>
      <div className="os-form-row"><label>Source type<select value={form.sourceType} onChange={event => setForm(current => ({ ...current, sourceType: event.target.value }))}>{SOURCE_TYPES.map(item => <option key={item}>{item}</option>)}</select></label><label>Primary function<select value={form.functionName} onChange={event => setForm(current => ({ ...current, functionName: event.target.value }))}>{FUNCTIONS.map(item => <option key={item}>{item}</option>)}</select></label></div>
      <label className="os-drop"><input type="file" accept=".pdf,.docx,.txt,.md,.xml,.json,.csv" onChange={event => chooseFile(event.target.files?.[0])}/>{fileBusy ? <LoaderCircle className="spin" size={27}/> : <UploadCloud size={27}/>}<strong>{fileBusy ? 'Reading source…' : 'Upload the actual source'}</strong><small>PDF, DOCX, TXT, MD, XML, JSON or CSV</small></label>
      <label>Extracted or pasted source<textarea rows="15" value={form.text} onChange={event => setForm(current => ({ ...current, text: event.target.value }))} placeholder="Paste the full source text here…"/></label>
      <button className="os-primary wide" onClick={run} disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18}/>Calculating institutional impact…</> : <><PlayCircle size={18}/>Analyse, calculate impact and compile execution</>}</button>
    </section>
    <section className="os-card os-method"><small>CONTROLLED ANALYSIS METHOD</small><h2>One source becomes an executable institutional matter</h2><div><span>1</span><p><strong>Evidence-led reasoning</strong><small>Read clauses, obligations, thresholds, exceptions, dependencies and missing facts.</small></p></div><div><span>2</span><p><strong>Institutional blast radius</strong><small>Identify affected functions, stakeholders, controls, portfolios, contracts and capital.</small></p></div><div><span>3</span><p><strong>Decision compilation</strong><small>Convert ambiguity into explicit questions and authorised approval gates.</small></p></div><div><span>4</span><p><strong>Controlled execution</strong><small>Assign actions, owners, priorities and required completion evidence.</small></p></div><div><span>5</span><p><strong>Proof of closure</strong><small>Do not close until decisions, actions and evidence are complete.</small></p></div><div className="os-control-note"><ShieldCheck size={20}/><span>Synesis recommends and orchestrates. High-risk actions remain subject to configurable human approval.</span></div></section>
  </div>;
}

function DecisionRegister({ items, events, update, chooseEvent }) {
  return <section className="os-card"><div className="os-card-head"><div><small>DECISION REGISTER</small><h2>Questions requiring authorised judgement</h2></div><Scale size={24}/></div>{items.length ? <div className="os-register">{items.map(item => { const matter = events.find(event => event.id === item.eventId); return <article key={item.id}><button className="os-matter-link" onClick={() => chooseEvent(item.eventId)}>{matter?.title || 'Institutional matter'}<ArrowRight size={13}/></button><h3>{item.question}</h3><p>Owner: {item.owner} · Gate: {item.approvalGate}</p><div className="os-choice-row"><span className={`os-status ${item.status.toLowerCase().replaceAll(' ','-')}`}>{item.status}</span><button onClick={() => update(item.id, 'Approved')}><CheckCircle2 size={14}/>Approve</button><button onClick={() => update(item.id, 'Escalated')}><AlertTriangle size={14}/>Escalate</button><button onClick={() => update(item.id, 'Rejected')}><CircleAlert size={14}/>Reject</button><button onClick={() => update(item.id, 'Pending')}><RefreshCw size={14}/>Reopen</button></div></article>; })}</div> : <Empty icon={Scale} title="No compiled decisions" text="Analyse an institutional source to create an evidence-linked decision register."/>}</section>;
}

function ActionRegister({ items, events, update, chooseEvent }) {
  return <section className="os-card"><div className="os-card-head"><div><small>CONTROLLED ACTION REGISTER</small><h2>Accountability from decision to implementation</h2></div><Workflow size={24}/></div>{items.length ? <div className="os-register">{items.map(item => { const matter = events.find(event => event.id === item.eventId); return <article key={item.id}><button className="os-matter-link" onClick={() => chooseEvent(item.eventId)}>{matter?.title || 'Institutional matter'}<ArrowRight size={13}/></button><h3>{item.title}</h3><p>Owner: {item.owner} · Priority: {item.priority}</p><small>Approval gate: {item.approvalGate}</small><small>Completion evidence: {item.evidenceRequired}</small><div className="os-choice-row"><span className={`os-status ${item.status.toLowerCase().replaceAll(' ','-')}`}>{item.status}</span><button onClick={() => update(item.id, 'In Progress')}><Activity size={14}/>Start</button><button onClick={() => update(item.id, 'Blocked')}><AlertTriangle size={14}/>Block</button><button onClick={() => update(item.id, 'Completed')}><CheckCircle2 size={14}/>Complete</button><button onClick={() => update(item.id, 'Open')}><RefreshCw size={14}/>Reopen</button></div></article>; })}</div> : <Empty icon={Workflow} title="No controlled actions" text="Action plans generated from live analysis will appear here with owners, gates and evidence requirements."/>}</section>;
}

function EvidenceRegister({ activeEvent, items, form, setForm, add, gaps, closeMatter }) {
  return <div className="os-evidence-grid"><section className="os-card"><div className="os-card-head"><div><small>EVIDENCE LEDGER</small><h2>{activeEvent ? activeEvent.title : 'Select a matter'}</h2></div><FileCheck2 size={24}/></div>{activeEvent ? <><form className="os-evidence-form" onSubmit={add}><label>Evidence title<input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="e.g. Revised policy approved by Compliance Committee"/></label><label>Record or verification note<textarea rows="4" value={form.note} onChange={event => setForm(current => ({ ...current, note: event.target.value }))} placeholder="Describe what was completed, where the record is stored and who verified it."/></label><button className="os-primary"><FileCheck2 size={16}/>Record completion evidence</button></form><div className="os-evidence-list">{items.map(item => <article key={item.id}><FileCheck2 size={18}/><div><strong>{item.title}</strong><p>{item.note || 'No additional note.'}</p><small>{formatDate(item.addedAt)}</small></div></article>)}</div><button className="os-close-button" onClick={closeMatter}><CheckCircle2 size={17}/>Validate and close matter</button></> : <Empty icon={FileCheck2} title="No active matter" text="Select a matter from the command centre before recording evidence."/>}</section><section className="os-card"><div className="os-card-head"><div><small>REQUIRED PROOF</small><h2>Evidence gaps identified by Synesis</h2></div><ClipboardCheck size={24}/></div>{gaps.length ? <ul className="os-gap-list large">{gaps.map((item, index) => <li key={index}>{item}</li>)}</ul> : <Empty icon={ClipboardCheck} title="No express gaps identified" text="Authorised reviewers should still confirm that all implementation and approval records are complete."/>}</section></div>;
}

function Empty({ icon: Icon, title, text }) {
  return <div className="os-empty"><Icon size={32}/><strong>{title}</strong><p>{text}</p></div>;
}
