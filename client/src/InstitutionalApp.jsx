import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, BarChart3, Building2, CheckCircle2,
  ChevronRight, CircleAlert, ClipboardCheck, Download, FilePlus2, FileSearch, FileText,
  Files, GitCompareArrows, Gavel, Landmark, LayoutDashboard, ListChecks, LoaderCircle,
  Menu, MessageSquareText, Network, Scale, Search, Shield, ShieldCheck, Sparkles,
  Target, Trash2, UploadCloud, Users, X, Zap
} from 'lucide-react';

const API = '/api';
const STORAGE_KEY = 'live-synesis-institutional-memory-v4';
const CONTEXT_KEY = 'live-synesis-institution-context-v4';

const TASKS = [
  { key: 'agreement', label: 'Review an agreement', description: 'Find rights, duties, exposure, leverage, value leakage and negotiation priorities.', icon: FileSearch, documentType: 'Commercial Agreement', matter: 'Contract review' },
  { key: 'regulation', label: 'Assess a regulatory change', description: 'Map affected obligations, controls, owners, evidence and remediation actions.', icon: Landmark, documentType: 'Regulatory / Policy Document', matter: 'Regulatory change assessment', currentSources: true },
  { key: 'approval', label: 'Prepare an approval', description: 'Identify the decision, authority, conditions, dependencies and completion evidence.', icon: ClipboardCheck, documentType: 'Board / Governance Document', matter: 'Institutional approval' },
  { key: 'incident', label: 'Investigate an incident', description: 'Build the issue thesis, affected parties, evidence gaps, control failures and response plan.', icon: Activity, documentType: 'Incident / Investigation Record', matter: 'Incident investigation' },
  { key: 'capital', label: 'Assess capital or mandate risk', description: 'Test mandate, investor interests, liquidity, valuation, conflicts and decision rationale.', icon: Target, documentType: 'Asset Management / Investment Document', matter: 'Capital and mandate decision' },
  { key: 'matter', label: 'Open any institutional matter', description: 'Analyse an agreement, policy, opinion, term sheet, report or governance record.', icon: Files, documentType: 'Auto-detect', matter: 'Institutional matter' }
];

const FUNCTIONS = [
  'Enterprise / Institution', 'Legal', 'Compliance', 'Risk', 'Investment / Asset Management',
  'KYC / AML', 'Operations', 'Governance / Company Secretariat', 'Finance / Credit',
  'IT / Cybersecurity', 'Procurement', 'Management'
];

const REVIEW_TABS = [
  ['brief', 'Decision brief'],
  ['decision', 'Decision model'],
  ['risks', 'Risks'],
  ['obligations', 'Obligations'],
  ['actions', 'Actions & gates'],
  ['gaps', 'Gaps'],
  ['scenarios', 'Scenarios'],
  ['sources', 'Regulatory & sources'],
  ['assistant', 'Ask Synesis'],
  ['report', 'Report']
];

function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function riskTone(value = 'Low') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function download(name, value, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name.replace(/[^a-z0-9._-]+/gi, '-');
  anchor.click();
  URL.revokeObjectURL(url);
}

async function readResponse(response) {
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; }
  catch { data = { error: text || 'Unexpected server response.' }; }
  if (!response.ok) throw new Error(data.detail || data.error || 'LIVE SYNESIS request failed.');
  return data;
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  return readResponse(response);
}

async function extractFileText(file) {
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

function reportText(document) {
  const analysis = document.analysis || {};
  const decision = analysis.decision_intelligence || {};
  const details = analysis.analysis_details || {};
  const lines = [
    'LIVE SYNESIS — INSTITUTIONAL DECISION INTELLIGENCE REPORT', '',
    `Document: ${document.title}`,
    `Work: ${document.workType}`,
    `Institutional function: ${document.institutionFunction}`,
    `Matter: ${document.matter}`,
    `Document type: ${analysis.document_type || document.documentType}`,
    `Jurisdiction: ${document.jurisdiction}`,
    `Overall risk: ${analysis.overall_risk} (${analysis.overall_score}/100)`,
    `Recommended decision: ${analysis.recommended_decision}`,
    `Analysis engine: ${analysis.engine}`,
    `Live AI used: ${details.live_ai_used ? 'Yes' : 'No'}`,
    `Independent passes: ${details.independent_passes ?? 0}`,
    `Model: ${details.model || 'Not recorded'}`,
    `Generated: ${analysis.generated_at || document.updatedAt}`, '',
    'EXECUTIVE POSITION', analysis.executive_position || '', '',
    'DOCUMENT SUMMARY', analysis.document_summary || '', '',
    'INSTITUTIONAL THESIS', decision.institutional_thesis || 'Not generated.', '',
    'AFFECTED AREAS', ...(decision.affected_areas || []).map(item => `- ${item}`), '',
    'DECISIONS REQUIRED', ...(decision.decision_questions || []).map(item => `- ${item}`), '',
    'UNRESOLVED QUESTIONS', ...(decision.unresolved_questions || []).map(item => `- ${item}`), '',
    'PARTIES AND ENTITIES'
  ];
  (decision.parties_and_entities || []).forEach(item => lines.push('', `${item.name} — ${item.role}`, `Interests: ${item.interests}`, `Exposure: ${item.exposure}`));
  lines.push('', 'OBLIGATIONS');
  (decision.obligations || []).forEach((item, index) => lines.push('', `${index + 1}. ${item.actor}: ${item.obligation}`, `Trigger: ${item.trigger}`, `Deadline/frequency: ${item.deadline_or_frequency}`, `Evidence: ${item.evidence_required}`, `Consequence: ${item.consequence}`, `Owner: ${item.owner}`));
  lines.push('', 'ACTION PLAN');
  (decision.action_plan || []).forEach((item, index) => lines.push('', `${index + 1}. [${item.priority}] ${item.action}`, `Owner: ${item.owner}`, `Approval gate: ${item.approval_gate}`, `Completion evidence: ${item.completion_evidence}`));
  lines.push('', 'RISKS');
  (analysis.findings || []).forEach((finding, index) => lines.push('', `${index + 1}. [${finding.risk_level} ${finding.risk_score}/100] ${finding.issue}`, `Reference: ${finding.clause_reference}`, `Evidence: ${finding.quoted_text}`, `Why it matters: ${finding.why_risky_for_bank}`, `How it may occur: ${finding.how_risk_may_materialise}`, `Mitigation: ${finding.recommended_mitigation}`, `Suggested language: ${finding.suggested_rewrite}`, `Owners: ${(finding.review_owner || []).join(', ')}`));
  lines.push('', 'MISSING PROTECTIONS');
  (analysis.missing_clauses || []).forEach(item => lines.push('', `[${item.risk_level}] ${item.clause}`, item.why_needed || '', item.recommended_language || ''));
  lines.push('', 'CONTRADICTIONS');
  (analysis.contradictions || []).forEach(item => lines.push('', `[${item.risk_level}] ${item.issue}`, `Locations: ${(item.locations || []).join(', ')}`, `Resolution: ${item.resolution}`));
  lines.push('', 'EVIDENCE GAPS', ...(decision.evidence_gaps || []).map(item => `- ${item}`));
  lines.push('', 'SCENARIOS');
  (analysis.scenario_tests || []).forEach(item => lines.push('', `[${item.risk_level}] ${item.title}`, `Trigger: ${item.trigger_from_document}`, `Event: ${item.event}`, `Likely outcome: ${item.likely_outcome}`, `Control: ${item.recommended_control}`));
  lines.push('', 'CURRENT-SOURCE VERIFICATION', analysis.source_verification?.summary || 'Not requested or unavailable.');
  (analysis.source_verification?.sources || []).forEach(item => lines.push(`- ${item.title}: ${item.url}`));
  lines.push('', 'ASSUMPTIONS AND LIMITS', ...(analysis.assumptions_and_limits || []).map(item => `- ${item}`));
  return lines.join('\n');
}

export default function InstitutionalApp() {
  const [documents, setDocuments] = useState(() => loadJson(STORAGE_KEY, []));
  const [context, setContext] = useState(() => loadJson(CONTEXT_KEY, { institutionName: 'My Institution', institutionFunction: 'Enterprise / Institution' }));
  const [page, setPage] = useState('command');
  const [preset, setPreset] = useState(TASKS[0]);
  const [activeId, setActiveId] = useState(null);
  const [mobile, setMobile] = useState(false);
  const [notice, setNotice] = useState(null);
  const active = documents.find(item => item.id === activeId) || null;

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(documents)); }
    catch { setNotice({ type: 'error', message: 'Browser storage is full. Export and remove older matters.' }); }
  }, [documents]);

  useEffect(() => { localStorage.setItem(CONTEXT_KEY, JSON.stringify(context)); }, [context]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 7500);
    return () => clearTimeout(timer);
  }, [notice]);

  function navigate(next) { setPage(next); setMobile(false); }
  function start(task) { setPreset(task); navigate('new'); }
  function open(id) { setActiveId(id); navigate('review'); }
  function save(document) {
    setDocuments(current => [document, ...current.filter(item => item.id !== document.id)]);
    setActiveId(document.id);
    setPage('review');
    const live = document.analysis?.analysis_details?.live_ai_used;
    setNotice({ type: live ? 'success' : 'error', message: live ? `Deep analysis completed using ${document.analysis.analysis_details.independent_passes} reasoning pass(es).` : 'Live AI analysis failed. The saved result is an emergency fallback and is not a completed Synesis analysis.' });
  }
  function remove(id) {
    if (!window.confirm('Delete this matter from browser memory?')) return;
    setDocuments(current => current.filter(item => item.id !== id));
    if (activeId === id) { setActiveId(null); navigate('memory'); }
  }

  const titles = {
    command: 'Decision Command Centre', new: preset.label, memory: 'Institutional Memory',
    compare: 'Compare Decisions', review: active?.title || 'Decision Workspace'
  };

  return <div className="inst-shell">
    {mobile && <button className="inst-scrim" onClick={() => setMobile(false)} aria-label="Close navigation" />}
    <aside className={`inst-sidebar ${mobile ? 'open' : ''}`}>
      <div className="inst-brand"><span>LS</span><div><strong>LIVE SYNESIS</strong><small>Institutional Intelligence & Execution</small></div><button onClick={() => setMobile(false)}><X size={19} /></button></div>
      <nav>
        {[
          ['command', 'Command centre', LayoutDashboard], ['new', 'Start work', FilePlus2],
          ['memory', 'Decision memory', Network], ['compare', 'Compare', GitCompareArrows]
        ].map(([key, label, Icon]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => navigate(key)}><Icon size={18} /><span>{label}</span><ChevronRight size={15} /></button>)}
      </nav>
      <div className="inst-context">
        <small>ACTIVE CONTEXT</small>
        <input value={context.institutionName} onChange={event => setContext({ ...context, institutionName: event.target.value })} aria-label="Institution name" />
        <select value={context.institutionFunction} onChange={event => setContext({ ...context, institutionFunction: event.target.value })}>{FUNCTIONS.map(item => <option key={item}>{item}</option>)}</select>
      </div>
      <div className="inst-sidebar-note"><ShieldCheck size={17} /><div><strong>Governed by design</strong><small>High-risk actions remain subject to authorised approval.</small></div></div>
    </aside>
    <section className="inst-main">
      <header className="inst-topbar">
        <button className="inst-menu" onClick={() => setMobile(true)}><Menu size={21} /></button>
        <div><h1>{titles[page]}</h1><p>{context.institutionName} · {context.institutionFunction}</p></div>
        <button className="inst-primary compact" onClick={() => start(TASKS[5])}><Zap size={16} />Start work</button>
      </header>
      {notice && <button className={`inst-toast ${notice.type}`} onClick={() => setNotice(null)}>{notice.type === 'error' ? <CircleAlert size={18} /> : <CheckCircle2 size={18} />}<span>{notice.message}</span><X size={15} /></button>}
      <main className="inst-page">
        {page === 'command' && <CommandCentre documents={documents} start={start} open={open} />}
        {page === 'new' && <NewWork preset={preset} context={context} save={save} notify={setNotice} />}
        {page === 'memory' && <Memory documents={documents} open={open} remove={remove} />}
        {page === 'compare' && <Compare documents={documents} />}
        {page === 'review' && <DecisionWorkspace document={active} remove={remove} navigate={navigate} />}
      </main>
    </section>
  </div>;
}

function CommandCentre({ documents, start, open }) {
  const decisions = documents.reduce((sum, item) => sum + (item.analysis?.decision_intelligence?.decision_questions?.length || 0), 0);
  const actions = documents.reduce((sum, item) => sum + (item.analysis?.decision_intelligence?.action_plan?.length || 0), 0);
  const high = documents.filter(item => item.analysis?.overall_risk === 'High').length;
  return <div className="inst-stack">
    <section className="inst-hero"><div><small>INSTITUTIONAL DECISION INTELLIGENCE</small><h2>What requires a decision, action or proof of completion?</h2><p>Start with the work. Synesis reads the evidence, connects risk and obligation, identifies who is affected, builds the approval path and records the institutional decision.</p></div><Sparkles size={46} /></section>
    <section className="inst-task-grid">{TASKS.map(task => <button key={task.key} onClick={() => start(task)}><span><task.icon size={23} /></span><div><strong>{task.label}</strong><p>{task.description}</p></div><ArrowRight size={18} /></button>)}</section>
    <section className="inst-metrics">{[
      ['Matters analysed', documents.length, Files], ['High-risk matters', high, AlertTriangle],
      ['Decisions surfaced', decisions, Gavel], ['Controlled actions', actions, ListChecks]
    ].map(([label, value, Icon]) => <div key={label}><span><Icon size={20} /></span><strong>{value}</strong><small>{label}</small></div>)}</section>
    <section className="inst-card"><CardHeader title="What requires attention" subtitle="Recent matters and their current decision posture" />
      {documents.length ? <div className="inst-list">{documents.slice(0, 8).map(item => <button key={item.id} onClick={() => open(item.id)}><RiskBadge risk={item.analysis?.overall_risk} score={item.analysis?.overall_score} /><span><strong>{item.title}</strong><small>{item.workType} · {formatDate(item.updatedAt)}</small></span><StatusPill live={item.analysis?.analysis_details?.live_ai_used} /><ChevronRight size={17} /></button>)}</div> : <Empty title="No institutional matters analysed" text="Choose a task above and upload the evidence that requires a decision." />}
    </section>
  </div>;
}

function NewWork({ preset, context, save, notify }) {
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [form, setForm] = useState(() => ({
    workType: preset.label, title: '', matter: preset.matter, documentType: preset.documentType,
    jurisdiction: 'India', stakeholderLens: 'Institution, customers/investors, regulators and affected operations',
    riskAppetite: 'Conservative', analysisMode: 'deep', useCurrentSources: Boolean(preset.currentSources),
    institutionFunction: context.institutionFunction
  }));

  useEffect(() => {
    setForm(current => ({ ...current, workType: preset.label, matter: preset.matter, documentType: preset.documentType, useCurrentSources: Boolean(preset.currentSources) }));
  }, [preset.key]);

  async function selectFile(selected) {
    if (!selected) return;
    if (!/\.(pdf|docx|txt|csv|json|md|xml)$/i.test(selected.name)) return notify({ type: 'error', message: 'Use PDF, DOCX, TXT, CSV, JSON, Markdown or XML.' });
    setBusy(true);
    try {
      const extracted = await extractFileText(selected);
      if (extracted.trim().length < 20) throw new Error('The file did not contain enough readable text. Paste text for scanned documents.');
      setFile(selected);
      setText(extracted.slice(0, 180000));
      setForm(current => ({ ...current, title: current.title || selected.name.replace(/\.[^.]+$/, '') }));
      notify({ type: 'success', message: `${selected.name} was extracted and is ready for analysis.` });
    } catch (error) { notify({ type: 'error', message: error.message || 'The document could not be read.' }); }
    finally { setBusy(false); }
  }

  async function submit(event) {
    event.preventDefault();
    if (text.trim().length < 20) return notify({ type: 'error', message: 'Upload a document or paste enough readable evidence.' });
    setBusy(true); setPhase(1);
    const timer = setInterval(() => setPhase(current => Math.min(5, current + 1)), 3000);
    try {
      const title = form.title || file?.name.replace(/\.[^.]+$/, '') || 'Untitled matter';
      const result = await api('/public/analyze', {
        method: 'POST',
        body: JSON.stringify({
          ...form, title, fileName: file?.name || '', department: form.institutionFunction,
          text: text.slice(0, 180000), countryCode: 'IN', city: 'New Delhi', region: 'Delhi', timezone: 'Asia/Kolkata'
        })
      });
      const now = new Date().toISOString();
      save({ id: uid(), ...form, title, institutionName: context.institutionName, originalFileName: file?.name || '', analysis: result.analysis, processing: result.processing, status: result.analysis?.analysis_details?.live_ai_used ? 'Analysis Complete' : 'Fallback — Review Incomplete', createdAt: now, updatedAt: now });
    } catch (error) { notify({ type: 'error', message: error.message }); }
    finally { clearInterval(timer); setBusy(false); }
  }

  const phases = ['Securely reading evidence', 'Primary institutional analysis', 'Decision and obligation modelling', 'Independent challenge review', 'Reconciling findings', 'Preparing action record'];
  return <div className="inst-new-grid">
    <form className="inst-card inst-form" onSubmit={submit}>
      <CardHeader title="1. Add the evidence" subtitle="The uploaded document controls the analysis; no fixed answer library is used for the primary result." />
      <label className="inst-drop"><input type="file" accept=".pdf,.docx,.txt,.csv,.json,.md,.xml" onChange={event => selectFile(event.target.files?.[0])} /><UploadCloud size={30} /><strong>{file?.name || 'Choose a document'}</strong><small>{file ? 'Text extracted below' : 'PDF, DOCX, TXT, CSV, JSON, MD or XML · up to the public workspace limit'}</small></label>
      <textarea rows="11" value={text} onChange={event => setText(event.target.value)} placeholder="Paste an agreement, circular, policy, approval note, mandate, incident record, opinion, term sheet or other institutional evidence…" />
      <CardHeader title="2. Define the decision context" subtitle="Context calibrates the analysis but cannot override the evidence." />
      <div className="inst-fields">
        <label>Work type<select value={form.workType} onChange={event => setForm({ ...form, workType: event.target.value })}>{TASKS.map(item => <option key={item.key}>{item.label}</option>)}</select></label>
        <label>Title<input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
        <label>Matter<input value={form.matter} onChange={event => setForm({ ...form, matter: event.target.value })} /></label>
        <label>Institutional function<select value={form.institutionFunction} onChange={event => setForm({ ...form, institutionFunction: event.target.value })}>{FUNCTIONS.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Document type<select value={form.documentType} onChange={event => setForm({ ...form, documentType: event.target.value })}>{['Auto-detect','Commercial Agreement','Vendor / Outsourcing Agreement','NDA / Confidentiality Agreement','Finance Agreement','Asset Management / Investment Document','Regulatory / Policy Document','Board / Governance Document','Incident / Investigation Record','Legal Opinion','Term Sheet'].map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Jurisdiction<input value={form.jurisdiction} onChange={event => setForm({ ...form, jurisdiction: event.target.value })} /></label>
        <label>Risk appetite<select value={form.riskAppetite} onChange={event => setForm({ ...form, riskAppetite: event.target.value })}><option>Conservative</option><option>Balanced</option><option>Commercial</option></select></label>
        <label>Analysis depth<select value={form.analysisMode} onChange={event => setForm({ ...form, analysisMode: event.target.value })}><option value="deep">Deep — primary + decision + challenge</option><option value="standard">Standard — primary + decision</option><option value="quick">Quick — primary analysis</option></select></label>
        <label className="wide">Stakeholder lens<input value={form.stakeholderLens} onChange={event => setForm({ ...form, stakeholderLens: event.target.value })} /></label>
        <label className="inst-check wide"><input type="checkbox" checked={form.useCurrentSources} onChange={event => setForm({ ...form, useCurrentSources: event.target.checked })} /><span><strong>Verify current regulatory propositions</strong><small>Runs a separate current-source check after document analysis; official and primary sources are preferred.</small></span></label>
      </div>
      <button className="inst-primary wide large" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18} />Running institutional analysis…</> : <><Sparkles size={18} />Analyse and build decision path</>}</button>
    </form>
    <aside className="inst-analysis-side">
      <section className="inst-card"><CardHeader title="What Synesis will determine" subtitle="Not merely a clause checklist" />{['What the document means institutionally','Who and what are affected','Rights, duties, triggers and deadlines','Material risks and value leakage','Decisions and unresolved questions','Dependencies and failure paths','Actions, owners and approval gates','Completion evidence and stakeholder impact'].map((item, index) => <div className="inst-guide-row" key={item}><span>{index + 1}</span><p>{item}</p></div>)}</section>
      {busy && <section className="inst-card inst-progress"><small>LIVE MULTIPASS ANALYSIS</small>{phases.map((item, index) => <div key={item} className={phase > index ? 'done' : phase === index + 1 ? 'current' : ''}>{phase > index ? <CheckCircle2 size={16} /> : <Activity size={16} />}<p>{item}</p></div>)}</section>}
      <section className="inst-card inst-boundary"><Shield size={20} /><div><strong>Controlled, not autonomous</strong><p>Synesis recommends action and approval gates. It does not execute high-risk legal, regulatory, investment or customer actions without authorised approval.</p></div></section>
    </aside>
  </div>;
}

function Memory({ documents, open, remove }) {
  const [query, setQuery] = useState('');
  const [risk, setRisk] = useState('All');
  const filtered = useMemo(() => documents.filter(item => {
    const match = `${item.title} ${item.matter} ${item.workType} ${item.documentType}`.toLowerCase().includes(query.toLowerCase());
    return match && (risk === 'All' || item.analysis?.overall_risk === risk);
  }), [documents, query, risk]);
  return <section className="inst-card"><CardHeader title="Institutional decision memory" subtitle="Reopen the evidence, analysis provenance, decisions and action path." action={<div className="inst-memory-tools"><label><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search matters" /></label><select value={risk} onChange={event => setRisk(event.target.value)}><option>All</option><option>High</option><option>Medium</option><option>Low</option></select></div>} />
    {filtered.length ? <div className="inst-table">{filtered.map(item => <div key={item.id}><button onClick={() => open(item.id)}><RiskBadge risk={item.analysis?.overall_risk} score={item.analysis?.overall_score} /><span><strong>{item.title}</strong><small>{item.workType} · {item.matter}</small></span><StatusPill live={item.analysis?.analysis_details?.live_ai_used} /><small>{formatDate(item.updatedAt)}</small><ChevronRight size={17} /></button><button className="inst-delete" onClick={() => remove(item.id)} aria-label="Delete"><Trash2 size={16} /></button></div>)}</div> : <Empty title="No matching matters" text="Start a new institutional analysis or change the filters." />}
  </section>;
}

function Compare({ documents }) {
  const [left, setLeft] = useState(documents[0]?.id || '');
  const [right, setRight] = useState(documents[1]?.id || '');
  const a = documents.find(item => item.id === left);
  const b = documents.find(item => item.id === right);
  if (documents.length < 2) return <Empty title="Two analysed matters are required" text="Complete at least two analyses before comparison." />;
  const delta = a && b ? a.analysis.overall_score - b.analysis.overall_score : 0;
  return <div className="inst-stack"><section className="inst-card"><CardHeader title="Compare institutional decisions" subtitle="Risk, decisions, obligations, actions and analysis provenance" /><div className="inst-compare-select"><select value={left} onChange={event => setLeft(event.target.value)}>{documents.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><GitCompareArrows size={24} /><select value={right} onChange={event => setRight(event.target.value)}>{documents.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div></section>{a && b && <section className="inst-compare-grid"><CompareCard document={a} /><div className="inst-delta"><strong>{Math.abs(delta)}</strong><small>risk-score difference</small><p>{delta === 0 ? 'Equivalent numerical risk; compare the decision models.' : delta > 0 ? `${a.title} is higher risk.` : `${b.title} is higher risk.`}</p></div><CompareCard document={b} /></section>}</div>;
}

function CompareCard({ document }) {
  const a = document.analysis || {};
  const d = a.decision_intelligence || {};
  return <article className="inst-card"><RiskBadge risk={a.overall_risk} score={a.overall_score} /><h2>{document.title}</h2><p>{a.executive_position}</p><dl><div><dt>Findings</dt><dd>{a.findings?.length || 0}</dd></div><div><dt>Decisions</dt><dd>{d.decision_questions?.length || 0}</dd></div><div><dt>Obligations</dt><dd>{d.obligations?.length || 0}</dd></div><div><dt>Actions</dt><dd>{d.action_plan?.length || 0}</dd></div><div><dt>Decision</dt><dd>{a.recommended_decision}</dd></div><div><dt>Analysis</dt><dd>{a.analysis_details?.live_ai_used ? `${a.analysis_details.independent_passes} live passes` : 'Fallback'}</dd></div></dl></article>;
}

function DecisionWorkspace({ document, remove, navigate }) {
  const [tab, setTab] = useState('brief');
  const [selected, setSelected] = useState(0);
  const [question, setQuestion] = useState('What decision must be made now, by whom, and what evidence is required before action?');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  if (!document) return <Empty title="No active matter" text="Open Decision Memory or start new work." />;
  const analysis = document.analysis || {};
  const decision = analysis.decision_intelligence || {};
  const finding = analysis.findings?.[selected];
  const live = analysis.analysis_details?.live_ai_used;

  async function ask() {
    setAsking(true); setAnswer('');
    try { setAnswer((await api('/public/ask', { method: 'POST', body: JSON.stringify({ question, analysis }) })).answer); }
    catch (error) { setAnswer(error.message); }
    finally { setAsking(false); }
  }

  return <div className="inst-stack">
    {!live && <section className="inst-fallback-warning"><CircleAlert size={23} /><div><strong>This is not a completed LIVE SYNESIS analysis.</strong><p>The live reasoning pipeline failed or was unavailable. The displayed result is an emergency deterministic fallback. Reanalyse after restoring the API connection before relying on it.</p><small>{analysis.analysis_details?.failure}</small></div></section>}
    <section className="inst-review-head"><button onClick={() => navigate('memory')}><ArrowLeft size={16} />Memory</button><div><RiskBadge risk={analysis.overall_risk} score={analysis.overall_score} /><h2>{document.title}</h2><p>{document.workType} · {analysis.document_type} · {document.matter}</p></div><div><StatusPill live={live} /><button onClick={() => download(`${document.title}-decision-report.txt`, reportText(document))}><Download size={16} />Report</button><button className="inst-delete" onClick={() => remove(document.id)}><Trash2 size={16} /></button></div></section>
    <section className="inst-provenance"><span><strong>{live ? 'Live institutional analysis' : 'Emergency fallback'}</strong>{analysis.engine}</span><span><strong>Mode</strong>{analysis.analysis_details?.mode || 'Not recorded'}</span><span><strong>Independent passes</strong>{analysis.analysis_details?.independent_passes ?? 0}</span><span><strong>Model</strong>{analysis.analysis_details?.model || 'Not recorded'}</span><span><strong>Evidence reviewed</strong>{(analysis.analysis_details?.document_characters_reviewed || 0).toLocaleString()} characters</span></section>
    <nav className="inst-tabs">{REVIEW_TABS.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>

    {tab === 'brief' && <div className="inst-brief-grid"><section className="inst-card inst-decision-card"><small>RECOMMENDED INSTITUTIONAL POSITION</small><h3>{analysis.recommended_decision}</h3><p>{analysis.executive_position}</p></section><section className="inst-card"><CardHeader title="Document intelligence" subtitle="What the evidence means" /><p className="inst-long">{analysis.document_summary}</p></section><section className="inst-card full"><CardHeader title="Institutional thesis" subtitle="Economic, operational, governance and stakeholder meaning" /><p className="inst-long">{decision.institutional_thesis || 'Decision intelligence was not generated.'}</p><div className="inst-tags">{(decision.affected_areas || []).map(item => <span key={item}>{item}</span>)}</div></section><section className="inst-metrics full">{[['Risks',analysis.findings?.length||0],['Decisions',decision.decision_questions?.length||0],['Obligations',decision.obligations?.length||0],['Actions',decision.action_plan?.length||0],['Evidence gaps',decision.evidence_gaps?.length||0]].map(([label,value])=><div key={label}><strong>{value}</strong><small>{label}</small></div>)}</section><StakeholderImpact impact={decision.stakeholder_impact} /></div>}

    {tab === 'decision' && <div className="inst-decision-grid"><section className="inst-card"><CardHeader title="Decisions required" subtitle="Questions for authorised personnel" />{(decision.decision_questions || []).length ? <NumberedList items={decision.decision_questions} /> : <Empty title="No decision question generated" text="Review the fallback status and source evidence." />}</section><section className="inst-card"><CardHeader title="Unresolved questions" subtitle="Facts or drafting points preventing reliable action" />{(decision.unresolved_questions || []).length ? <NumberedList items={decision.unresolved_questions} warning /> : <Empty title="No unresolved question recorded" text="Authorised review remains required." />}</section><section className="inst-card full"><CardHeader title="Parties and entities" subtitle="Roles, interests and exposure" /><div className="inst-entity-grid">{(decision.parties_and_entities || []).map((item,index)=><article key={`${item.name}-${index}`}><Users size={19}/><h3>{item.name}</h3><small>{item.role}</small><p><strong>Interests:</strong> {item.interests}</p><p><strong>Exposure:</strong> {item.exposure}</p></article>)}</div></section><section className="inst-card full"><CardHeader title="Dependencies and failure effects" subtitle="What must be true before the next action" /><div className="inst-dependency-list">{(decision.dependencies || []).map((item,index)=><article key={index}><Network size={18}/><div><strong>{item.dependency}</strong><p>Affects: {item.affected_item}</p><small>Failure effect: {item.failure_effect}</small></div></article>)}</div></section></div>}

    {tab === 'risks' && <div className="inst-risks"><section className="inst-card inst-risk-list">{(analysis.findings || []).length ? analysis.findings.map((item,index)=><button key={item.id||index} className={selected===index?'active':''} onClick={()=>setSelected(index)}><span className={`inst-risk ${riskTone(item.risk_level)}`}>{item.risk_level}</span><strong>{item.issue}</strong><small>{item.risk_category} · {item.risk_score}/100 · {item.clause_reference}</small></button>) : <Empty title="No material finding generated" text="Check whether the result is live analysis or fallback." />}</section><section className="inst-card inst-risk-detail">{finding ? <><span className={`inst-risk ${riskTone(finding.risk_level)}`}>{finding.risk_level} · {finding.risk_score}/100</span><h2>{finding.issue}</h2><small>{finding.clause_reference} · confidence {finding.confidence}%</small><h4>Evidence</h4><blockquote>{finding.quoted_text}</blockquote><h4>Why it matters institutionally</h4><p>{finding.why_risky_for_bank}</p><h4>Failure path</h4><p>{finding.how_risk_may_materialise}</p><h4>Impact</h4><div className="inst-impact">{Object.entries(finding.impact||{}).map(([key,value])=><div key={key}><strong>{key.replace('_',' / ')}</strong><p>{value}</p></div>)}</div><h4>Mitigation</h4><p>{finding.recommended_mitigation}</p><h4>Document-specific language</h4><div className="inst-rewrite">{finding.suggested_rewrite}</div><div className="inst-tags">{(finding.review_owner||[]).map(item=><span key={item}>{item}</span>)}</div></> : null}</section></div>}

    {tab === 'obligations' && <section className="inst-card"><CardHeader title="Obligation register" subtitle="Actor, trigger, deadline, evidence, consequence and owner" />{(decision.obligations || []).length ? <div className="inst-obligation-list">{decision.obligations.map((item,index)=><article key={index}><span>{index+1}</span><div><h3>{item.obligation}</h3><small>{item.actor} · Owner: {item.owner}</small><dl><div><dt>Trigger</dt><dd>{item.trigger}</dd></div><div><dt>Deadline / frequency</dt><dd>{item.deadline_or_frequency}</dd></div><div><dt>Evidence required</dt><dd>{item.evidence_required}</dd></div><div><dt>Consequence</dt><dd>{item.consequence}</dd></div></dl></div></article>)}</div> : <Empty title="No obligation model generated" text="Use deep or standard live analysis for the decision and execution model." />}</section>}

    {tab === 'actions' && <section className="inst-card"><CardHeader title="Controlled action plan" subtitle="Actions do not execute until their approval gate is satisfied" />{(decision.action_plan || []).length ? <div className="inst-action-grid">{decision.action_plan.map((item,index)=><article key={index}><div><span>{item.priority}</span><strong>{item.owner}</strong></div><h3>{item.action}</h3><p><Gavel size={16}/><strong>Approval gate:</strong> {item.approval_gate}</p><p><CheckCircle2 size={16}/><strong>Completion evidence:</strong> {item.completion_evidence}</p></article>)}</div> : <Empty title="No controlled action plan generated" text="A live decision-intelligence pass is required." />}</section>}

    {tab === 'gaps' && <div className="inst-gap-grid"><section className="inst-card"><CardHeader title="Missing protections" subtitle="Expected clauses or controls not found" /><div className="inst-card-grid">{(analysis.missing_clauses||[]).map((item,index)=><article key={index}><span className={`inst-risk ${riskTone(item.risk_level)}`}>{item.risk_level}</span><h3>{item.clause}</h3><p>{item.why_needed}</p><div className="inst-rewrite">{item.recommended_language}</div></article>)}</div></section><section className="inst-card"><CardHeader title="Contradictions" subtitle="Internal conflict requiring resolution" />{(analysis.contradictions||[]).length ? (analysis.contradictions||[]).map((item,index)=><article className="inst-gap-item" key={index}><span className={`inst-risk ${riskTone(item.risk_level)}`}>{item.risk_level}</span><h3>{item.issue}</h3><p>{(item.locations||[]).join(', ')}</p><div className="inst-rewrite">{item.resolution}</div></article>) : <Empty title="No contradiction recorded" text="Cross-document conflict is outside a single-document review unless comparison evidence is supplied." />}</section><section className="inst-card full"><CardHeader title="Evidence gaps" subtitle="Information absent from the document that blocks a reliable decision" />{(decision.evidence_gaps||[]).length ? <NumberedList items={decision.evidence_gaps} warning /> : <Empty title="No evidence gap recorded" text="This does not eliminate the need for factual verification." />}</section></div>}

    {tab === 'scenarios' && <section className="inst-card"><CardHeader title="Document-grounded stress scenarios" subtitle="Triggers, events, consequences and controls derived from the evidence" /><div className="inst-card-grid">{(analysis.scenario_tests||[]).length ? analysis.scenario_tests.map((item,index)=><article key={index}><span className={`inst-risk ${riskTone(item.risk_level)}`}>{item.risk_level}</span><h3>{item.title}</h3><h4>Document trigger</h4><blockquote>{item.trigger_from_document}</blockquote><h4>Event</h4><p>{item.event}</p><h4>Likely outcome</h4><p>{item.likely_outcome}</p><h4>Control</h4><div className="inst-rewrite">{item.recommended_control}</div></article>) : <Empty title="No material scenario supported" text="Scenario tests are generated only when evidence supports a defensible trigger." />}</div></section>}

    {tab === 'sources' && <div className="inst-source-grid"><section className="inst-card"><CardHeader title="Regulatory and control map" subtitle="Areas requiring the appropriate control owner" /><div className="inst-card-grid">{(analysis.regulatory_touchpoints||[]).map((item,index)=><article key={index}><Shield size={19}/><h3>{item.area}</h3><p>{item.relevance}</p><div className="inst-rewrite">{item.action}</div>{item.verification_required&&<small>Current-source verification required</small>}</article>)}</div></section><section className="inst-card"><CardHeader title="Current-source verification" subtitle={analysis.source_verification?.checked_at ? `Checked ${formatDate(analysis.source_verification.checked_at)}` : 'Not requested or unavailable'} /><p className="inst-long">{analysis.source_verification?.summary || 'Enable current-source verification when the decision depends on current law, regulation, directions or official guidance.'}</p><div className="inst-source-list">{(analysis.source_verification?.sources||[]).map((item,index)=><a key={index} href={item.url} target="_blank" rel="noreferrer"><Landmark size={17}/><span>{item.title}</span><ArrowRight size={15}/></a>)}</div></section></div>}

    {tab === 'assistant' && <section className="inst-card inst-assistant"><CardHeader title="Ask the active decision record" subtitle="The answer is grounded in this analysis, obligation model, action plan and source verification" /><textarea rows="4" value={question} onChange={event=>setQuestion(event.target.value)} /><button className="inst-primary" onClick={ask} disabled={asking}>{asking?<><LoaderCircle className="spin" size={17}/>Reviewing the decision record…</>:<><MessageSquareText size={17}/>Ask LIVE SYNESIS</>}</button>{answer&&<pre>{answer}</pre>}</section>}

    {tab === 'report' && <section className="inst-card"><CardHeader title="Institutional decision report" subtitle="Export the evidence-led analysis and execution model" action={<div className="inst-actions"><button onClick={()=>download(`${document.title}.json`,JSON.stringify(document,null,2),'application/json')}><Download size={15}/>JSON</button><button className="inst-primary" onClick={()=>download(`${document.title}-decision-report.txt`,reportText(document))}><Download size={15}/>Report</button></div>} /><pre className="inst-report">{reportText(document)}</pre></section>}
  </div>;
}

function StakeholderImpact({ impact }) {
  if (!impact) return null;
  const labels = { customers_or_unit_holders: 'Customers / investors / unit-holders', regulators: 'Regulators', management: 'Management', operations: 'Operations', capital_or_financial: 'Capital / financial' };
  return <section className="inst-card full"><CardHeader title="Stakeholder impact" subtitle="Who bears the consequence of the decision" /><div className="inst-impact stakeholder">{Object.entries(impact).map(([key,value])=><div key={key}><strong>{labels[key]||key}</strong><p>{value}</p></div>)}</div></section>;
}

function NumberedList({ items, warning }) {
  return <div className={`inst-numbered ${warning?'warning':''}`}>{items.map((item,index)=><div key={`${item}-${index}`}><span>{index+1}</span><p>{item}</p></div>)}</div>;
}

function RiskBadge({ risk = 'Low', score }) {
  return <span className={`inst-risk-badge ${riskTone(risk)}`}><strong>{risk}</strong>{Number.isFinite(score)&&<small>{score}/100</small>}</span>;
}

function StatusPill({ live }) {
  return <span className={`inst-status ${live?'live':'fallback'}`}>{live?<><Zap size={13}/>Live AI</>:<><CircleAlert size={13}/>Fallback</>}</span>;
}

function CardHeader({ title, subtitle, action }) {
  return <div className="inst-card-head"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>;
}

function Empty({ title, text }) {
  return <div className="inst-empty"><FileText size={25}/><strong>{title}</strong><p>{text}</p></div>;
}
