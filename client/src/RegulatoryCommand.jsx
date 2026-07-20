import { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, CheckCircle2, CircleAlert,
  ClipboardCheck, Download, FileCheck2, FileText, Gavel, Landmark, LayoutDashboard,
  ListChecks, LoaderCircle, Network, Plus, RefreshCw, ShieldCheck, Trash2, UploadCloud,
  Users, Workflow
} from 'lucide-react';

const API = '/api';
const STORE = 'live-synesis-regulatory-command-v1';
const STAGES = ['Intake', 'Impact assessment', 'Remediation', 'Approval', 'Closed'];
const APPROVALS = ['Legal', 'Compliance', 'Risk', 'Operations', 'Management'];
const OBLIGATION_STATUSES = ['Assessment required', 'Confirmed applicable', 'Not applicable', 'Implemented'];
const TASK_STATUSES = ['Open', 'In progress', 'Blocked', 'Completed'];

function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadCases() {
  try { return JSON.parse(localStorage.getItem(STORE) || '[]') || []; } catch { return []; }
}

function persist(cases) {
  localStorage.setItem(STORE, JSON.stringify(cases));
}

function cleanTitle(value) {
  return String(value || '').trim() || 'Untitled regulatory change';
}

function riskTone(value = 'Medium') {
  return String(value).toLowerCase().replace(/[^a-z]+/g, '-');
}

function download(name, content, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name.replace(/[^a-z0-9._-]+/gi, '-');
  anchor.click();
  URL.revokeObjectURL(url);
}

async function readFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') {
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
  if (extension === 'docx') {
    const module = await import('mammoth/mammoth.browser.js');
    const mammoth = module.default || module;
    return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  }
  return file.text();
}

async function analyseRegulation(text, title) {
  const response = await fetch(`${API}/public/institutional/regulatory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, title })
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: raw }; }
  if (!response.ok) throw new Error(data.detail || data.error || 'Regulatory analysis failed.');
  return data.analysis;
}

function stageIndex(status) {
  const index = STAGES.indexOf(status);
  return index < 0 ? 0 : index;
}

function closureReady(record) {
  const obligationsReady = record.obligations.length > 0 && record.obligations.every(item => ['Not applicable', 'Implemented'].includes(item.status));
  const tasksReady = record.tasks.length > 0 && record.tasks.every(item => item.status === 'Completed');
  const approvalsReady = record.approvals.every(item => item.status === 'Approved');
  const evidenceReady = record.evidence.length > 0;
  return obligationsReady && tasksReady && approvalsReady && evidenceReady;
}

function buildReport(record) {
  const lines = [
    'LIVE SYNESIS — REGULATORY IMPLEMENTATION AND CLOSURE PACK',
    '',
    `Matter: ${record.title}`,
    `Regulator / authority: ${record.regulator || 'Not specified'}`,
    `Reference: ${record.reference || 'Not specified'}`,
    `Jurisdiction: ${record.jurisdiction}`,
    `Effective date: ${record.effectiveDate || 'Not specified'}`,
    `Overall owner: ${record.owner || 'Not assigned'}`,
    `Status: ${record.status}`,
    `Created: ${new Date(record.createdAt).toLocaleString('en-IN')}`,
    `Last updated: ${new Date(record.updatedAt).toLocaleString('en-IN')}`,
    '',
    'CHANGE SUMMARY',
    record.analysis?.summary || 'No analysis summary recorded.',
    '',
    'AFFECTED AREAS',
    ...(record.impacts.length ? record.impacts.map((item, index) => `${index + 1}. ${item.area} | Control: ${item.control || 'Not mapped'} | Policy: ${item.policy || 'Not mapped'} | System/process: ${item.system || 'Not mapped'} | Owner: ${item.owner || 'Not assigned'}`) : ['None recorded.']),
    '',
    'OBLIGATION REGISTER',
    ...(record.obligations.length ? record.obligations.map((item, index) => `${index + 1}. [${item.status}] ${item.statement}\n   Owner: ${item.owner || 'Not assigned'} | Due: ${item.dueDate || 'Not specified'} | Evidence: ${item.evidenceRequired || 'Not specified'}`) : ['None recorded.']),
    '',
    'ACTION REGISTER',
    ...(record.tasks.length ? record.tasks.map((item, index) => `${index + 1}. [${item.status}] ${item.title}\n   Owner: ${item.owner || 'Not assigned'} | Priority: ${item.priority} | Due: ${item.dueDate || 'Not specified'} | Gate: ${item.approvalGate || 'Not specified'} | Completion evidence: ${item.evidenceRequired || 'Not specified'}`) : ['None recorded.']),
    '',
    'APPROVALS',
    ...record.approvals.map(item => `${item.function}: ${item.status}${item.comment ? ` — ${item.comment}` : ''}`),
    '',
    'EVIDENCE REGISTER',
    ...(record.evidence.length ? record.evidence.map((item, index) => `${index + 1}. ${item.title} | Added by: ${item.owner || 'Not specified'} | ${new Date(item.createdAt).toLocaleString('en-IN')}\n   ${item.note || ''}`) : ['None recorded.']),
    '',
    `CLOSURE TEST: ${closureReady(record) ? 'PASSED' : 'NOT PASSED'}`,
    closureReady(record) ? 'All mapped obligations, tasks, approvals and evidence requirements are complete in this record.' : 'This record must not be treated as closed until all closure conditions are satisfied.',
    '',
    'IMPORTANT',
    'This pack records the workflow and evidence entered into Synesis. Authorised personnel remain responsible for legal interpretation, applicability, implementation and final closure.'
  ];
  return lines.join('\n');
}

export default function RegulatoryCommand() {
  const initial = useMemo(loadCases, []);
  const [cases, setCases] = useState(initial);
  const [activeId, setActiveId] = useState(initial[0]?.id || null);
  const [creating, setCreating] = useState(!initial.length);
  const [notice, setNotice] = useState(null);
  const active = cases.find(item => item.id === activeId) || null;

  function commit(next) {
    setCases(next);
    persist(next);
  }

  function updateActive(patch) {
    const now = new Date().toISOString();
    commit(cases.map(item => item.id === activeId ? { ...item, ...patch, updatedAt: now } : item));
  }

  function createCase(record) {
    const now = new Date().toISOString();
    const item = {
      id: uid(),
      title: cleanTitle(record.title),
      regulator: record.regulator.trim(),
      reference: record.reference.trim(),
      jurisdiction: record.jurisdiction.trim() || 'India',
      effectiveDate: record.effectiveDate,
      owner: record.owner.trim(),
      status: 'Intake',
      createdAt: now,
      updatedAt: now,
      sourceText: '',
      sourceFile: '',
      analysis: null,
      obligations: [],
      impacts: [],
      tasks: [],
      approvals: APPROVALS.map(name => ({ function: name, status: 'Pending', comment: '', updatedAt: null })),
      evidence: [],
      decision: '',
      closureStatement: ''
    };
    const next = [item, ...cases];
    commit(next);
    setActiveId(item.id);
    setCreating(false);
    setNotice({ type: 'success', message: 'Regulatory case opened. Upload the authoritative source to begin impact assessment.' });
  }

  function removeCase(id) {
    const next = cases.filter(item => item.id !== id);
    commit(next);
    if (activeId === id) setActiveId(next[0]?.id || null);
    if (!next.length) setCreating(true);
  }

  const metrics = {
    open: cases.filter(item => item.status !== 'Closed').length,
    obligations: cases.reduce((sum, item) => sum + item.obligations.filter(obligation => !['Not applicable', 'Implemented'].includes(obligation.status)).length, 0),
    overdue: cases.reduce((sum, item) => sum + item.tasks.filter(task => task.status !== 'Completed' && task.dueDate && new Date(task.dueDate) < new Date()).length, 0),
    awaitingApproval: cases.reduce((sum, item) => sum + item.approvals.filter(approval => approval.status === 'Pending').length, 0)
  };

  return <div className="reg-shell">
    <section className="reg-hero">
      <div><small>VERTICAL SOLUTION · INDIA</small><h1>Regulatory Change-to-Control Command</h1><p>Convert a regulatory source into verified obligations, institutional impacts, controlled remediation, approvals, evidence and a closure pack.</p></div>
      <Landmark size={50} />
    </section>

    {notice && <button className={`reg-notice ${notice.type}`} onClick={() => setNotice(null)}>{notice.type === 'error' ? <CircleAlert size={18}/> : <CheckCircle2 size={18}/>}<span>{notice.message}</span></button>}

    <section className="reg-metrics">
      <Metric icon={Workflow} label="Open regulatory cases" value={metrics.open}/>
      <Metric icon={ListChecks} label="Obligations requiring action" value={metrics.obligations}/>
      <Metric icon={AlertTriangle} label="Overdue actions" value={metrics.overdue}/>
      <Metric icon={Gavel} label="Pending approvals" value={metrics.awaitingApproval}/>
    </section>

    <div className="reg-layout">
      <aside className="reg-sidebar">
        <button className="reg-new" onClick={() => setCreating(true)}><Plus size={17}/>Open regulatory case</button>
        <div className="reg-case-list">
          {cases.map(item => <button key={item.id} className={item.id === activeId && !creating ? 'active' : ''} onClick={() => { setActiveId(item.id); setCreating(false); }}>
            <span className={`reg-status ${riskTone(item.status === 'Closed' ? 'Low' : item.status === 'Approval' ? 'Medium' : 'High')}`}>{item.status}</span>
            <strong>{item.title}</strong>
            <small>{item.regulator || 'Authority not specified'} · {new Date(item.updatedAt).toLocaleDateString('en-IN')}</small>
          </button>)}
          {!cases.length && <div className="reg-empty-side"><Landmark size={22}/><p>No regulatory cases yet.</p></div>}
        </div>
      </aside>

      <main className="reg-main">
        {creating ? <NewCase onCreate={createCase} onCancel={() => { if (cases.length) setCreating(false); }}/>
          : active ? <CaseWorkspace record={active} update={updateActive} remove={() => removeCase(active.id)} notify={setNotice}/>
            : <section className="reg-empty"><LayoutDashboard size={32}/><h2>Open a regulatory case</h2><p>Start with the authoritative circular, direction, regulation, order or internal policy change.</p></section>}
      </main>
    </div>
  </div>;
}

function Metric({ icon: Icon, label, value }) {
  return <div><Icon size={20}/><span><strong>{value}</strong><small>{label}</small></span></div>;
}

function NewCase({ onCreate, onCancel }) {
  const [form, setForm] = useState({ title: '', regulator: 'RBI', reference: '', jurisdiction: 'India', effectiveDate: '', owner: 'Compliance' });
  return <section className="reg-card reg-create">
    <div className="reg-card-head"><div><small>STEP 1</small><h2>Open regulatory case</h2><p>Create the controlled record before analysis begins.</p></div></div>
    <div className="reg-fields">
      <label className="wide">Matter title<input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="e.g. RBI Digital Lending Directions implementation"/></label>
      <label>Regulator / authority<input value={form.regulator} onChange={event => setForm({ ...form, regulator: event.target.value })}/></label>
      <label>Reference<input value={form.reference} onChange={event => setForm({ ...form, reference: event.target.value })} placeholder="Circular / notification number"/></label>
      <label>Jurisdiction<input value={form.jurisdiction} onChange={event => setForm({ ...form, jurisdiction: event.target.value })}/></label>
      <label>Effective date<input type="date" value={form.effectiveDate} onChange={event => setForm({ ...form, effectiveDate: event.target.value })}/></label>
      <label className="wide">Overall accountable function<input value={form.owner} onChange={event => setForm({ ...form, owner: event.target.value })} placeholder="Compliance / Legal / Business"/></label>
    </div>
    <div className="reg-actions"><button onClick={onCancel}><ArrowLeft size={16}/>Cancel</button><button className="primary" onClick={() => onCreate(form)}><ArrowRight size={16}/>Create controlled case</button></div>
  </section>;
}

function CaseWorkspace({ record, update, remove, notify }) {
  const [tab, setTab] = useState('change');
  const tabs = [['change', 'Change brief'], ['obligations', 'Obligations'], ['impact', 'Impact map'], ['actions', 'Actions'], ['approvals', 'Approvals & evidence'], ['closure', 'Closure pack']];
  const currentStage = stageIndex(record.status);

  function updateObligation(id, patch) {
    update({ obligations: record.obligations.map(item => item.id === id ? { ...item, ...patch } : item) });
  }
  function updateImpact(id, patch) {
    update({ impacts: record.impacts.map(item => item.id === id ? { ...item, ...patch } : item) });
  }
  function updateTask(id, patch) {
    update({ tasks: record.tasks.map(item => item.id === id ? { ...item, ...patch } : item) });
  }
  function updateApproval(name, patch) {
    update({ approvals: record.approvals.map(item => item.function === name ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item) });
  }

  return <div className="reg-stack">
    <section className="reg-record-head">
      <div><span className={`reg-status ${riskTone(record.status === 'Closed' ? 'Low' : 'Medium')}`}>{record.status}</span><h2>{record.title}</h2><p>{record.regulator || 'Authority not specified'} · {record.reference || 'No reference'} · Owner: {record.owner || 'Not assigned'}</p></div>
      <div><button onClick={() => download(`${record.title}-regulatory-closure-pack.txt`, buildReport(record))}><Download size={16}/>Export</button><button className="danger" onClick={remove}><Trash2 size={16}/></button></div>
    </section>

    <section className="reg-stagebar">
      {STAGES.map((stage, index) => <button key={stage} className={index <= currentStage ? 'complete' : ''} onClick={() => update({ status: stage })}><span>{index < currentStage ? <CheckCircle2 size={15}/> : index + 1}</span><small>{stage}</small></button>)}
    </section>

    <nav className="reg-tabs">{tabs.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>

    {tab === 'change' && <ChangeBrief record={record} update={update} notify={notify}/>} 
    {tab === 'obligations' && <Obligations record={record} update={update} updateItem={updateObligation}/>} 
    {tab === 'impact' && <ImpactMap record={record} update={update} updateItem={updateImpact}/>} 
    {tab === 'actions' && <Actions record={record} update={update} updateItem={updateTask}/>} 
    {tab === 'approvals' && <ApprovalsEvidence record={record} update={update} updateApproval={updateApproval}/>} 
    {tab === 'closure' && <ClosurePack record={record} update={update}/>} 
  </div>;
}

function ChangeBrief({ record, update, notify }) {
  const [busy, setBusy] = useState(false);
  async function choose(file) {
    if (!file) return;
    setBusy(true);
    try {
      const sourceText = await readFile(file);
      update({ sourceText, sourceFile: file.name });
      notify({ type: 'success', message: `${file.name} was read. Run the controlled impact assessment.` });
    } catch (error) {
      notify({ type: 'error', message: error.message });
    } finally { setBusy(false); }
  }
  async function run() {
    if (record.sourceText.trim().length < 20) return notify({ type: 'error', message: 'Upload or paste the authoritative regulatory source.' });
    setBusy(true);
    try {
      const analysis = await analyseRegulation(record.sourceText, record.title);
      const obligations = (analysis.obligations || []).map((item, index) => ({
        id: item.id || uid(), reference: item.reference || `Extract ${index + 1}`, statement: item.obligation,
        owner: item.owner || record.owner, dueDate: item.due_date === 'Not explicit' ? '' : item.due_date,
        status: 'Assessment required', evidenceRequired: 'Implementation evidence to be defined', notes: ''
      }));
      const impacts = (analysis.affected_areas || []).map(area => ({ id: uid(), area, control: '', policy: '', system: '', owner: record.owner, status: 'Mapping required' }));
      const tasks = (analysis.action_plan || []).map(item => ({
        id: uid(), title: item.action, owner: item.owner || record.owner, priority: item.priority || 'Planned',
        dueDate: item.due_date === 'Not explicit' ? '' : item.due_date, status: 'Open', approvalGate: 'Compliance and affected control owner',
        evidenceRequired: 'Approved implementation artefact and operating evidence', notes: ''
      }));
      update({ analysis, obligations, impacts, tasks, status: 'Impact assessment' });
      notify({ type: 'success', message: `Impact assessment created ${obligations.length} obligation record(s), ${impacts.length} impact area(s) and ${tasks.length} controlled action(s).` });
    } catch (error) {
      notify({ type: 'error', message: error.message });
    } finally { setBusy(false); }
  }
  return <div className="reg-two-col">
    <section className="reg-card"><div className="reg-card-head"><div><small>AUTHORITATIVE SOURCE</small><h3>Upload or paste the change</h3></div><FileText size={22}/></div>
      <label className="reg-drop"><input type="file" accept=".pdf,.docx,.txt,.md,.xml" onChange={event => choose(event.target.files?.[0])}/>{busy ? <LoaderCircle className="spin" size={24}/> : <UploadCloud size={24}/>}<strong>{record.sourceFile || 'Upload circular, direction, order or policy'}</strong><small>PDF, DOCX, TXT, MD or XML</small></label>
      <textarea rows="16" value={record.sourceText} onChange={event => update({ sourceText: event.target.value })} placeholder="Paste the complete authoritative text…"/>
      <button className="reg-primary" onClick={run} disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <RefreshCw size={17}/>}Run controlled impact assessment</button>
    </section>
    <section className="reg-card"><div className="reg-card-head"><div><small>CHANGE INTELLIGENCE</small><h3>What the source currently indicates</h3></div><Network size={22}/></div>
      {record.analysis ? <><p className="reg-long">{record.analysis.summary}</p><div className="reg-chip-row">{(record.analysis.affected_areas || []).map(item => <span key={item}>{item}</span>)}</div><h4>Detected dates</h4><p>{(record.analysis.detected_dates || []).join(', ') || 'No date reliably extracted.'}</p><h4>Limitations</h4><ul>{(record.analysis.limitations || []).map((item, index) => <li key={index}>{item}</li>)}</ul></> : <div className="reg-empty"><FileCheck2 size={28}/><h3>No impact assessment yet</h3><p>The source must be analysed before obligations and actions are created.</p></div>}
    </section>
  </div>;
}

function Obligations({ record, update, updateItem }) {
  function add() {
    update({ obligations: [...record.obligations, { id: uid(), reference: 'Manual', statement: '', owner: record.owner, dueDate: '', status: 'Assessment required', evidenceRequired: '', notes: '' }] });
  }
  return <section className="reg-card"><div className="reg-card-head"><div><small>OBLIGATION COMPILER</small><h3>Validate applicability and implementation</h3><p>Every extracted statement remains unverified until an authorised owner confirms it.</p></div><button onClick={add}><Plus size={15}/>Add obligation</button></div>
    <div className="reg-register">{record.obligations.map((item, index) => <article key={item.id}>
      <div className="reg-register-index">{index + 1}</div><div className="reg-register-body">
        <div className="reg-inline"><input value={item.reference} onChange={event => updateItem(item.id, { reference: event.target.value })}/><select value={item.status} onChange={event => updateItem(item.id, { status: event.target.value })}>{OBLIGATION_STATUSES.map(status => <option key={status}>{status}</option>)}</select></div>
        <textarea rows="3" value={item.statement} onChange={event => updateItem(item.id, { statement: event.target.value })}/>
        <div className="reg-inline three"><label>Owner<input value={item.owner} onChange={event => updateItem(item.id, { owner: event.target.value })}/></label><label>Due date<input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate || '') ? item.dueDate : ''} onChange={event => updateItem(item.id, { dueDate: event.target.value })}/></label><label>Required evidence<input value={item.evidenceRequired} onChange={event => updateItem(item.id, { evidenceRequired: event.target.value })}/></label></div>
      </div><button className="icon danger" onClick={() => update({ obligations: record.obligations.filter(entry => entry.id !== item.id) })}><Trash2 size={15}/></button>
    </article>)}</div>
    {!record.obligations.length && <div className="reg-empty"><ListChecks size={28}/><h3>No obligations recorded</h3><p>Run the impact assessment or add an obligation manually.</p></div>}
  </section>;
}

function ImpactMap({ record, update, updateItem }) {
  function add() { update({ impacts: [...record.impacts, { id: uid(), area: '', control: '', policy: '', system: '', owner: record.owner, status: 'Mapping required' }] }); }
  return <section className="reg-card"><div className="reg-card-head"><div><small>INSTITUTIONAL IMPACT GRAPH</small><h3>Map each change to operating reality</h3><p>Connect the obligation to controls, policies, systems, processes and accountable owners.</p></div><button onClick={add}><Plus size={15}/>Add impact</button></div>
    <div className="reg-impact-grid">{record.impacts.map(item => <article key={item.id}><Network size={21}/><input value={item.area} onChange={event => updateItem(item.id, { area: event.target.value })} placeholder="Affected area"/><label>Control<input value={item.control} onChange={event => updateItem(item.id, { control: event.target.value })} placeholder="Control ID or description"/></label><label>Policy / procedure<input value={item.policy} onChange={event => updateItem(item.id, { policy: event.target.value })}/></label><label>System / process<input value={item.system} onChange={event => updateItem(item.id, { system: event.target.value })}/></label><label>Owner<input value={item.owner} onChange={event => updateItem(item.id, { owner: event.target.value })}/></label><select value={item.status} onChange={event => updateItem(item.id, { status: event.target.value })}><option>Mapping required</option><option>Impact confirmed</option><option>No impact</option><option>Remediated</option></select><button className="danger" onClick={() => update({ impacts: record.impacts.filter(entry => entry.id !== item.id) })}><Trash2 size={14}/>Remove</button></article>)}</div>
    {!record.impacts.length && <div className="reg-empty"><Network size={28}/><h3>No institutional impacts mapped</h3><p>A regulatory report without control, policy and system mapping is not an implementation record.</p></div>}
  </section>;
}

function Actions({ record, update, updateItem }) {
  function add() { update({ tasks: [...record.tasks, { id: uid(), title: '', owner: record.owner, priority: 'Planned', dueDate: '', status: 'Open', approvalGate: '', evidenceRequired: '', notes: '' }] }); }
  return <section className="reg-card"><div className="reg-card-head"><div><small>CONTROLLED REMEDIATION</small><h3>Actions, dependencies and completion evidence</h3></div><button onClick={add}><Plus size={15}/>Add action</button></div>
    <div className="reg-task-grid">{record.tasks.map((item, index) => <article key={item.id}><div className="reg-task-top"><span>{index + 1}</span><select value={item.status} onChange={event => updateItem(item.id, { status: event.target.value })}>{TASK_STATUSES.map(status => <option key={status}>{status}</option>)}</select></div><textarea rows="3" value={item.title} onChange={event => updateItem(item.id, { title: event.target.value })} placeholder="Controlled action"/><div className="reg-inline"><label>Owner<input value={item.owner} onChange={event => updateItem(item.id, { owner: event.target.value })}/></label><label>Priority<select value={item.priority} onChange={event => updateItem(item.id, { priority: event.target.value })}><option>Immediate</option><option>High</option><option>Planned</option><option>Low</option></select></label></div><label>Due date<input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate || '') ? item.dueDate : ''} onChange={event => updateItem(item.id, { dueDate: event.target.value })}/></label><label>Approval gate<input value={item.approvalGate} onChange={event => updateItem(item.id, { approvalGate: event.target.value })}/></label><label>Completion evidence<input value={item.evidenceRequired} onChange={event => updateItem(item.id, { evidenceRequired: event.target.value })}/></label><button className="danger" onClick={() => update({ tasks: record.tasks.filter(entry => entry.id !== item.id) })}><Trash2 size={14}/>Remove</button></article>)}</div>
    {!record.tasks.length && <div className="reg-empty"><ClipboardCheck size={28}/><h3>No remediation actions</h3><p>Implementation cannot be controlled until actions, owners, dates and evidence are defined.</p></div>}
  </section>;
}

function ApprovalsEvidence({ record, update, updateApproval }) {
  const [evidence, setEvidence] = useState({ title: '', owner: '', note: '' });
  function addEvidence() {
    if (!evidence.title.trim()) return;
    update({ evidence: [{ id: uid(), ...evidence, createdAt: new Date().toISOString() }, ...record.evidence] });
    setEvidence({ title: '', owner: '', note: '' });
  }
  return <div className="reg-two-col">
    <section className="reg-card"><div className="reg-card-head"><div><small>MAKER-CHECKER APPROVALS</small><h3>Authorised institutional decision</h3></div><Gavel size={22}/></div><div className="reg-approval-list">{record.approvals.map(item => <article key={item.function}><div><Users size={18}/><span><strong>{item.function}</strong><small>{item.updatedAt ? new Date(item.updatedAt).toLocaleString('en-IN') : 'No decision recorded'}</small></span></div><select value={item.status} onChange={event => updateApproval(item.function, { status: event.target.value })}><option>Pending</option><option>Approved</option><option>Approved with conditions</option><option>Returned</option><option>Rejected</option></select><textarea rows="2" value={item.comment} onChange={event => updateApproval(item.function, { comment: event.target.value })} placeholder="Approval conditions or reasons…"/></article>)}</div></section>
    <section className="reg-card"><div className="reg-card-head"><div><small>COMPLETION EVIDENCE</small><h3>Prove implementation</h3></div><ShieldCheck size={22}/></div><div className="reg-fields"><label>Evidence title<input value={evidence.title} onChange={event => setEvidence({ ...evidence, title: event.target.value })} placeholder="Approved policy, test result, filing acknowledgement…"/></label><label>Added by<input value={evidence.owner} onChange={event => setEvidence({ ...evidence, owner: event.target.value })}/></label><label className="wide">Evidence note<textarea rows="3" value={evidence.note} onChange={event => setEvidence({ ...evidence, note: event.target.value })}/></label></div><button className="reg-primary" onClick={addEvidence}><Plus size={16}/>Add evidence record</button><div className="reg-evidence-list">{record.evidence.map(item => <article key={item.id}><FileCheck2 size={18}/><div><strong>{item.title}</strong><p>{item.note}</p><small>{item.owner || 'Owner not recorded'} · {new Date(item.createdAt).toLocaleString('en-IN')}</small></div><button className="icon danger" onClick={() => update({ evidence: record.evidence.filter(entry => entry.id !== item.id) })}><Trash2 size={14}/></button></article>)}</div></section>
  </div>;
}

function ClosurePack({ record, update }) {
  const ready = closureReady(record);
  const tests = [
    ['Obligations resolved', record.obligations.length > 0 && record.obligations.every(item => ['Not applicable', 'Implemented'].includes(item.status))],
    ['Actions completed', record.tasks.length > 0 && record.tasks.every(item => item.status === 'Completed')],
    ['Required approvals obtained', record.approvals.every(item => item.status === 'Approved')],
    ['Completion evidence recorded', record.evidence.length > 0]
  ];
  function close() {
    if (!ready) return;
    update({ status: 'Closed', closureStatement: record.closureStatement || 'The mapped regulatory implementation has been completed, approved and evidenced in accordance with this controlled record.' });
  }
  return <section className="reg-card"><div className="reg-card-head"><div><small>REGULATOR-READY CLOSURE</small><h3>{ready ? 'Closure conditions satisfied' : 'Closure conditions incomplete'}</h3><p>Synesis will not treat the matter as closed merely because analysis has been produced.</p></div>{ready ? <BadgeCheck size={30}/> : <CircleAlert size={30}/>}</div>
    <div className="reg-closure-tests">{tests.map(([label, passed]) => <div key={label} className={passed ? 'passed' : ''}>{passed ? <CheckCircle2 size={19}/> : <AlertTriangle size={19}/>}<span>{label}</span></div>)}</div>
    <label className="reg-closure-statement">Authorised closure statement<textarea rows="4" value={record.closureStatement} onChange={event => update({ closureStatement: event.target.value })} placeholder="Record the authorised basis on which the implementation is considered complete…"/></label>
    <div className="reg-actions"><button onClick={() => download(`${record.title}-closure-pack.json`, JSON.stringify(record, null, 2), 'application/json')}><Download size={16}/>JSON record</button><button onClick={() => download(`${record.title}-closure-pack.txt`, buildReport(record))}><Download size={16}/>Closure report</button><button className="primary" disabled={!ready} onClick={close}><BadgeCheck size={16}/>Close regulatory matter</button></div>
    {!ready && <div className="reg-warning"><CircleAlert size={18}/><span>Closure is blocked until all obligation, action, approval and evidence tests pass.</span></div>}
  </section>;
}
