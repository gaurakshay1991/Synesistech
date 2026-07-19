import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, BarChart3, Building2, CheckCircle2,
  ChevronRight, CircleAlert, Download, FilePlus2, FileText, Files, GitCompareArrows,
  LayoutDashboard, LoaderCircle, Menu, MessageSquareText, RefreshCw, Search, Shield,
  ShieldCheck, Sparkles, Trash2, UploadCloud, Users, X
} from 'lucide-react';

const API = '/api';
const DOCUMENTS_KEY = 'live-synesis-live-documents-v2';
const DEPARTMENT_KEY = 'live-synesis-live-department-v2';

const DEPARTMENTS = [
  ['legal', 'Legal', 'Contracts, opinions, drafting and disputes', FileText],
  ['compliance', 'Compliance', 'Regulatory obligations and control checks', ShieldCheck],
  ['risk', 'Risk', 'Risk identification, mitigation and escalation', Activity],
  ['kyc', 'KYC / AML', 'Onboarding, AML, sanctions and due diligence', Users],
  ['business', 'Business & Operations', 'Commercial execution and operational workflows', Building2],
  ['management', 'Management', 'Executive summaries and decision oversight', BarChart3],
  ['credit', 'Credit', 'Financing terms, covenants and lender protections', Shield],
  ['cyber', 'IT & Cybersecurity', 'Technology, data security and vendor controls', Shield],
  ['procurement', 'Procurement', 'Vendor contracts, SLAs and commercial safeguards', Files]
].map(([key, label, description, icon]) => ({ key, label, description, icon }));

const REVIEW_TABS = [
  ['overview', 'Overview'], ['issues', 'Issues'], ['missing', 'Missing protections'],
  ['scenarios', 'Scenarios'], ['regulatory', 'Regulatory'], ['assistant', 'Ask Synesis'], ['report', 'Report']
];

function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadDocuments() {
  try {
    const value = JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function formatDate(value) {
  try { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return String(value || ''); }
}

function riskClass(value = 'Low') { return `live-risk ${String(value).toLowerCase()}`; }

function download(name, value, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
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
      pages.push(content.items.map(item => item.str).join(' '));
    }
    return pages.join('\n\n');
  }
  if (extension === 'docx') {
    const module = await import('mammoth/mammoth.browser.js');
    const mammoth = module.default || module;
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }
  return file.text();
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'LIVE SYNESIS request failed.');
  return data;
}

function reportText(document) {
  const analysis = document.analysis || {};
  const lines = [
    'LIVE SYNESIS — DOCUMENT DECISION REPORT', '',
    `Department: ${document.departmentLabel}`,
    `Document: ${document.title}`,
    `Matter: ${document.matter}`,
    `Document type: ${analysis.document_type || document.documentType}`,
    `Jurisdiction: ${document.jurisdiction}`,
    `Analysis engine: ${analysis.engine || 'Not recorded'}`,
    `Overall risk: ${analysis.overall_risk} (${analysis.overall_score}/100)`,
    `Recommended decision: ${analysis.recommended_decision}`, '',
    'EXECUTIVE POSITION', analysis.executive_position || '', '',
    'DOCUMENT SUMMARY', analysis.document_summary || '', '',
    'ISSUES'
  ];
  (analysis.findings || []).forEach((finding, index) => lines.push(
    '', `${index + 1}. [${finding.risk_level} ${finding.risk_score ?? ''}/100] ${finding.issue}`,
    `Clause/reference: ${finding.clause_reference || ''}`,
    `Evidence: ${finding.quoted_text || ''}`,
    `Why risky for the Bank: ${finding.why_risky_for_bank || ''}`,
    `How it may materialise: ${finding.how_risk_may_materialise || ''}`,
    `Mitigation: ${finding.recommended_mitigation || ''}`,
    `Suggested rewrite: ${finding.suggested_rewrite || ''}`,
    `Owners: ${(finding.review_owner || []).join(', ')}`
  ));
  lines.push('', 'MISSING PROTECTIONS');
  (analysis.missing_clauses || []).forEach(item => lines.push('', `[${item.risk_level}] ${item.clause}`, item.why_needed || '', item.recommended_language || ''));
  lines.push('', 'SCENARIO TESTS');
  (analysis.scenario_tests || []).forEach(item => lines.push('', `[${item.risk_level}] ${item.title}`, `Trigger: ${item.trigger_from_document}`, `Event: ${item.event}`, `Outcome: ${item.likely_outcome}`, `Control: ${item.recommended_control}`));
  lines.push('', 'ASSUMPTIONS AND LIMITATIONS', ...(analysis.assumptions_and_limits || []).map(item => `- ${item}`));
  return lines.join('\n');
}

export default function LivePublicApp() {
  const [department, setDepartment] = useState(() => localStorage.getItem(DEPARTMENT_KEY) || '');
  const [documents, setDocuments] = useState(loadDocuments);
  const [page, setPage] = useState('home');
  const [activeId, setActiveId] = useState(null);
  const [mobile, setMobile] = useState(false);
  const [notice, setNotice] = useState(null);
  const departmentInfo = DEPARTMENTS.find(item => item.key === department);
  const active = documents.find(item => item.id === activeId) || null;

  useEffect(() => {
    try { localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents)); }
    catch { setNotice({ type: 'error', message: 'Browser storage is full. Remove older reviews.' }); }
  }, [documents]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 6500);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!departmentInfo) return <DepartmentGate choose={value => { localStorage.setItem(DEPARTMENT_KEY, value); setDepartment(value); }} />;

  function navigate(value) { setPage(value); setMobile(false); }
  function open(id) { setActiveId(id); setPage('review'); }
  function save(document) {
    setDocuments(current => [document, ...current.filter(item => item.id !== document.id)]);
    open(document.id);
    setNotice({ type: 'success', message: `Review completed using ${document.analysis.engine}.` });
  }
  function remove(id) {
    if (!window.confirm('Delete this review from this browser?')) return;
    setDocuments(current => current.filter(item => item.id !== id));
    if (activeId === id) { setActiveId(null); setPage('documents'); }
  }

  return <div className="live-shell">
    {mobile && <button className="live-scrim" onClick={() => setMobile(false)} aria-label="Close navigation" />}
    <aside className={`live-sidebar ${mobile ? 'open' : ''}`}>
      <div className="live-brand"><span>LS</span><div><strong>LIVE SYNESIS</strong><small>Legal & Compliance Intelligence</small></div><button onClick={() => setMobile(false)}><X size={20} /></button></div>
      <div className="live-department"><departmentInfo.icon size={20} /><div><small>ACTIVE DEPARTMENT</small><strong>{departmentInfo.label}</strong></div></div>
      <nav>{[
        ['home', 'Command centre', LayoutDashboard], ['new', 'New review', FilePlus2],
        ['documents', 'Documents', Files], ['compare', 'Compare', GitCompareArrows]
      ].map(([key, label, Icon]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => navigate(key)}><Icon size={19} /><span>{label}</span><ChevronRight size={16} /></button>)}</nav>
      <div className="live-sidebar-bottom"><p><ShieldCheck size={18} /><span><strong>Private by design</strong><small>Public reviews are not saved on the server.</small></span></p><button onClick={() => { localStorage.removeItem(DEPARTMENT_KEY); setDepartment(''); setPage('home'); }}>Change department</button></div>
    </aside>
    <section className="live-main">
      <header className="live-topbar"><button className="live-menu" onClick={() => setMobile(true)}><Menu size={22} /></button><div><h1>{page === 'home' ? 'Command centre' : page === 'new' ? 'New document review' : page === 'documents' ? 'Document library' : page === 'compare' ? 'Compare documents' : active?.title || 'Review workspace'}</h1><p>{departmentInfo.label} · live document-specific intelligence</p></div><button className="live-primary compact" onClick={() => navigate('new')}><FilePlus2 size={17} />New review</button></header>
      {notice && <button className={`live-toast ${notice.type}`} onClick={() => setNotice(null)}>{notice.type === 'error' ? <CircleAlert size={18} /> : <CheckCircle2 size={18} />}<span>{notice.message}</span><X size={16} /></button>}
      <main className="live-page">
        {page === 'home' && <Dashboard department={departmentInfo} documents={documents} navigate={navigate} open={open} />}
        {page === 'new' && <NewReview department={departmentInfo} save={save} notify={setNotice} />}
        {page === 'documents' && <Library documents={documents} open={open} remove={remove} />}
        {page === 'compare' && <Compare documents={documents} />}
        {page === 'review' && <Review document={active} remove={remove} navigate={navigate} />}
      </main>
    </section>
  </div>;
}

function DepartmentGate({ choose }) {
  return <div className="live-gate"><section><div className="live-gate-brand"><span>LS</span><div><strong>LIVE SYNESIS</strong><small>Document-led institutional intelligence</small></div></div><small>OPEN WORKSPACE</small><h1>Select your department. Upload a document. Get a decision-ready review.</h1><p>LIVE SYNESIS reads the actual document, identifies evidence-linked risks and missing protections, explains how they may affect the institution, proposes mitigation and produces protective drafting.</p><div className="live-gate-points"><span><Sparkles size={19} />Structured AI analysis</span><span><ShieldCheck size={19} />No server document retention</span><span><Files size={19} />Browser-local library</span></div></section><section className="live-gate-panel"><small>CHOOSE WORKSPACE</small><h2>Which department are you working from?</h2><div className="live-department-grid">{DEPARTMENTS.map(item => <button key={item.key} onClick={() => choose(item.key)}><span><item.icon size={22} /></span><div><strong>{item.label}</strong><small>{item.description}</small></div><ArrowRight size={18} /></button>)}</div><p className="live-privacy-note"><Shield size={17} />Document text is sent for live analysis but is not persisted by LIVE SYNESIS in this public workspace. Saved reviews remain in this browser.</p></section></div>;
}

function Dashboard({ department, documents, navigate, open }) {
  const high = documents.filter(item => item.analysis?.overall_risk === 'High').length;
  const findings = documents.reduce((sum, item) => sum + (item.analysis?.findings?.length || 0), 0);
  return <div className="live-stack"><section className="live-hero"><div><small>{department.label.toUpperCase()} WORKSPACE</small><h2>What needs a decision today?</h2><p>Upload an agreement, policy, opinion, term sheet or other document. Receive evidence, severity, impact, mitigation, suggested wording, scenarios and a report.</p><div><button className="live-white" onClick={() => navigate('new')}><UploadCloud size={18} />Upload & analyse</button><button className="live-ghost" onClick={() => navigate('documents')}>Open library<ArrowRight size={17} /></button></div></div><Sparkles size={42} /></section><section className="live-metrics">{[['Documents', documents.length, Files], ['High-risk matters', high, AlertTriangle], ['Issues identified', findings, Activity], ['Department', department.label, ShieldCheck]].map(([label, value, Icon]) => <div key={label}><span><Icon size={20} /></span><strong>{value}</strong><small>{label}</small></div>)}</section><section className="live-card"><CardHeader title="Recently reviewed" subtitle="Saved in this browser" />{documents.length ? <div className="live-list">{documents.slice(0, 7).map(item => <button key={item.id} onClick={() => open(item.id)}><RiskBadge risk={item.analysis.overall_risk} score={item.analysis.overall_score} /><span><strong>{item.title}</strong><small>{item.matter} · {formatDate(item.updatedAt)}</small></span><ChevronRight size={18} /></button>)}</div> : <Empty title="No reviews yet" text="Start with a document that requires a decision." action={<button className="live-primary" onClick={() => navigate('new')}>Start review<ArrowRight size={17} /></button>} />}</section></div>;
}

function NewReview({ department, save, notify }) {
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: '', matter: 'General review', documentType: 'Auto-detect', jurisdiction: 'India', riskAppetite: 'Conservative' });

  async function selectFile(selected) {
    if (!selected) return;
    if (!/\.(pdf|docx|txt|csv|json|md|xml)$/i.test(selected.name)) return notify({ type: 'error', message: 'Use PDF, DOCX, TXT, CSV, JSON, Markdown or XML.' });
    setBusy(true);
    try {
      const extracted = await extractFileText(selected);
      if (extracted.trim().length < 20) throw new Error('The document did not contain enough readable text. Paste the text if it is a scanned document.');
      setFile(selected); setText(extracted.slice(0, 180000));
      setForm(current => ({ ...current, title: current.title || selected.name.replace(/\.[^.]+$/, '') }));
      notify({ type: 'success', message: `${selected.name} was extracted successfully.` });
    } catch (error) { notify({ type: 'error', message: error.message || 'The document could not be read.' }); }
    finally { setBusy(false); }
  }

  async function submit(event) {
    event.preventDefault();
    if (text.trim().length < 20) return notify({ type: 'error', message: 'Upload a document or paste enough readable text.' });
    setBusy(true);
    try {
      const title = form.title || file?.name.replace(/\.[^.]+$/, '') || 'Untitled document';
      const result = await api('/public/analyze', { method: 'POST', body: JSON.stringify({ ...form, title, fileName: file?.name || '', department: department.label, text: text.slice(0, 180000) }) });
      const now = new Date().toISOString();
      save({ id: uid(), ...form, title, documentType: result.analysis.document_type, originalFileName: file?.name || '', department: department.key, departmentLabel: department.label, analysis: result.analysis, processing: result.processing, status: 'Review Complete', createdAt: now, updatedAt: now });
    } catch (error) { notify({ type: 'error', message: error.message }); }
    finally { setBusy(false); }
  }

  return <div className="live-new-grid"><form className="live-card live-form" onSubmit={submit}><CardHeader title="1. Add the actual document" subtitle="PDF, DOCX, TXT, CSV, JSON, Markdown or XML" /><label className="live-drop"><input type="file" accept=".pdf,.docx,.txt,.csv,.json,.md,.xml" onChange={event => selectFile(event.target.files?.[0])} /><UploadCloud size={30} /><strong>{file?.name || 'Choose or drop a document'}</strong><small>{busy ? 'Reading document…' : 'The extracted text will appear below'}</small></label><textarea rows="12" value={text} onChange={event => setText(event.target.value)} placeholder="Paste agreement, policy, term sheet, opinion or other document text…" /><CardHeader title="2. Set review context" subtitle="Context calibrates document classification and risk analysis" /><div className="live-fields"><label>Title<input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label><label>Matter<input value={form.matter} onChange={event => setForm({ ...form, matter: event.target.value })} /></label><label>Document type<select value={form.documentType} onChange={event => setForm({ ...form, documentType: event.target.value })}><option>Auto-detect</option><option>Vendor / Outsourcing Agreement</option><option>NDA / Confidentiality Agreement</option><option>Finance Agreement</option><option>Employment Agreement</option><option>Policy / Regulatory Document</option><option>Legal Opinion</option><option>Term Sheet</option></select></label><label>Jurisdiction<input value={form.jurisdiction} onChange={event => setForm({ ...form, jurisdiction: event.target.value })} /></label><label>Risk appetite<select value={form.riskAppetite} onChange={event => setForm({ ...form, riskAppetite: event.target.value })}><option>Conservative</option><option>Balanced</option><option>Commercial</option></select></label></div><button className="live-primary wide" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18} />Analysing actual document…</> : <><Sparkles size={18} />Analyse document</>}</button></form><aside className="live-card live-guide"><CardHeader title="Review output" subtitle={`${department.label} decision support`} />{['Evidence-linked clause issues', 'High/Medium/Low severity and score', 'Why and how each risk materialises', 'Legal, regulatory, operational and cyber impact', 'Mitigation and Bank-protective rewrite', 'Missing protections and contradictions', 'Document-specific stress scenarios', 'Regulatory touchpoints and final decision'].map((item, index) => <div key={item}><span>{index + 1}</span><p>{item}</p></div>)}<p className="live-privacy-note"><Shield size={17} />This public mode does not retain the original document on the server. The resulting review is saved only in this browser.</p></aside></div>;
}

function Library({ documents, open, remove }) {
  const [search, setSearch] = useState('');
  const filtered = documents.filter(item => `${item.title} ${item.matter} ${item.documentType}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="live-card"><CardHeader title="Document library" subtitle="Reviews stored in this browser" action={<label className="live-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search" /></label>} />{filtered.length ? <div className="live-table">{filtered.map(item => <div key={item.id}><button onClick={() => open(item.id)}><RiskBadge risk={item.analysis.overall_risk} score={item.analysis.overall_score} /><span><strong>{item.title}</strong><small>{item.documentType} · {item.matter}</small></span><small>{formatDate(item.updatedAt)}</small><ChevronRight size={18} /></button><button className="live-delete" onClick={() => remove(item.id)} aria-label="Delete"><Trash2 size={17} /></button></div>)}</div> : <Empty title="No matching documents" text="Upload a document or change the search." />}</section>;
}

function Compare({ documents }) {
  const [left, setLeft] = useState(documents[0]?.id || '');
  const [right, setRight] = useState(documents[1]?.id || '');
  const a = documents.find(item => item.id === left); const b = documents.find(item => item.id === right);
  if (documents.length < 2) return <Empty title="Two reviews required" text="Analyse at least two documents before comparison." />;
  const delta = a && b ? a.analysis.overall_score - b.analysis.overall_score : 0;
  return <div className="live-stack"><section className="live-card"><CardHeader title="Compare reviewed documents" subtitle="Risk posture, findings and decision position" /><div className="live-compare-select"><select value={left} onChange={event => setLeft(event.target.value)}>{documents.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><GitCompareArrows size={24} /><select value={right} onChange={event => setRight(event.target.value)}>{documents.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div></section>{a && b && <section className="live-compare-grid"><CompareCard document={a} /><div className="live-delta"><strong>{Math.abs(delta)}</strong><small>score-point difference</small><p>{delta === 0 ? 'Equivalent numerical risk; compare the issues.' : delta > 0 ? `${a.title} is higher risk.` : `${b.title} is higher risk.`}</p></div><CompareCard document={b} /></section>}</div>;
}

function CompareCard({ document }) { const a = document.analysis; return <article className="live-card"><RiskBadge risk={a.overall_risk} score={a.overall_score} /><h2>{document.title}</h2><p>{a.executive_position}</p><dl><div><dt>High findings</dt><dd>{a.findings.filter(item => item.risk_level === 'High').length}</dd></div><div><dt>Total findings</dt><dd>{a.findings.length}</dd></div><div><dt>Missing protections</dt><dd>{a.missing_clauses.length}</dd></div><div><dt>Decision</dt><dd>{a.recommended_decision}</dd></div></dl></article>; }

function Review({ document, remove, navigate }) {
  const [tab, setTab] = useState('overview');
  const [selected, setSelected] = useState(0);
  const [question, setQuestion] = useState('What are the three most serious risks for the Bank and what must be negotiated?');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  if (!document) return <Empty title="No active document" text="Open a saved review or analyse a new document." action={<button className="live-primary" onClick={() => navigate('documents')}>Open library</button>} />;
  const analysis = document.analysis;
  const finding = analysis.findings?.[selected];

  async function ask() {
    setAsking(true); setAnswer('');
    try { const result = await api('/public/ask', { method: 'POST', body: JSON.stringify({ question, analysis }) }); setAnswer(result.answer); }
    catch (error) { setAnswer(error.message); }
    finally { setAsking(false); }
  }

  return <div className="live-stack"><section className="live-review-head"><button onClick={() => navigate('documents')}><ArrowLeft size={17} />Library</button><div><RiskBadge risk={analysis.overall_risk} score={analysis.overall_score} /><h2>{document.title}</h2><p>{analysis.document_type} · {document.matter} · {analysis.engine}</p></div><div><button onClick={() => download(`${document.title}-report.txt`, reportText(document))}><Download size={17} />Report</button><button className="live-delete" onClick={() => remove(document.id)}><Trash2 size={17} /></button></div></section><nav className="live-tabs">{REVIEW_TABS.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {tab === 'overview' && <div className="live-overview"><section className="live-card live-score"><RiskBadge risk={analysis.overall_risk} score={analysis.overall_score} /><h3>{analysis.recommended_decision}</h3><p>{analysis.executive_position}</p></section><section className="live-card"><CardHeader title="Document summary" subtitle="Generated from the uploaded document" /><p className="live-long">{analysis.document_summary}</p></section><section className="live-metrics">{[['Findings', analysis.findings.length], ['High risk', analysis.findings.filter(item => item.risk_level === 'High').length], ['Missing clauses', analysis.missing_clauses.length], ['Scenarios', analysis.scenario_tests?.length || 0]].map(([label, value]) => <div key={label}><strong>{value}</strong><small>{label}</small></div>)}</section></div>}
    {tab === 'issues' && <div className="live-issues"><section className="live-card live-finding-list">{analysis.findings.length ? analysis.findings.map((item, index) => <button key={item.id || index} className={selected === index ? 'active' : ''} onClick={() => setSelected(index)}><span className={riskClass(item.risk_level)}>{item.risk_level}</span><strong>{item.issue}</strong><small>{item.risk_category} · {item.risk_score}/100 · {item.clause_reference}</small></button>) : <Empty title="No material findings" text="The analysis did not detect a material risk trigger." />}</section><section className="live-card live-finding-detail">{finding ? <><span className={riskClass(finding.risk_level)}>{finding.risk_level} · {finding.risk_score}/100</span><h2>{finding.issue}</h2><small>{finding.clause_reference}</small><h4>Document evidence</h4><blockquote>{finding.quoted_text}</blockquote><h4>Why risky for the Bank</h4><p>{finding.why_risky_for_bank}</p><h4>How it may materialise</h4><p>{finding.how_risk_may_materialise}</p>{finding.impact && <><h4>Impact</h4><div className="live-impact">{Object.entries(finding.impact).map(([key, value]) => <div key={key}><strong>{key.replace('_', ' ')}</strong><p>{value}</p></div>)}</div></>}<h4>Mitigation</h4><p>{finding.recommended_mitigation}</p><h4>Suggested Bank-protective rewrite</h4><div className="live-rewrite">{finding.suggested_rewrite}</div><div className="live-owners">{(finding.review_owner || []).map(owner => <span key={owner}>{owner}</span>)}</div></> : null}</section></div>}
    {tab === 'missing' && <section className="live-card"><CardHeader title="Missing protections" subtitle="Clauses or controls not located in the document" /><div className="live-card-grid">{analysis.missing_clauses.length ? analysis.missing_clauses.map((item, index) => <article key={`${item.clause}-${index}`}><span className={riskClass(item.risk_level)}>{item.risk_level}</span><h3>{item.clause}</h3><p>{item.why_needed}</p><div className="live-rewrite">{item.recommended_language}</div></article>) : <Empty title="No expected protection flagged as missing" text="Final professional review remains required." />}</div></section>}
    {tab === 'scenarios' && <section className="live-card"><CardHeader title="Document-specific stress scenarios" subtitle="Each scenario is anchored to an identified document risk" /><div className="live-card-grid">{(analysis.scenario_tests || []).length ? analysis.scenario_tests.map((item, index) => <article key={index}><span className={riskClass(item.risk_level)}>{item.risk_level}</span><h3>{item.title}</h3><h4>Document trigger</h4><blockquote>{item.trigger_from_document}</blockquote><h4>Event</h4><p>{item.event}</p><h4>Likely outcome</h4><p>{item.likely_outcome}</p><h4>Recommended control</h4><div className="live-rewrite">{item.recommended_control}</div></article>) : <Empty title="No scenario generated" text="No high-risk scenario was supported by the document evidence." />}</div></section>}
    {tab === 'regulatory' && <section className="live-card"><CardHeader title="Regulatory and control touchpoints" subtitle="Verify current official sources before final reliance" /><div className="live-card-grid">{(analysis.regulatory_touchpoints || []).map((item, index) => <article key={index}><h3>{item.area}</h3><p>{item.relevance}</p><div className="live-rewrite">{item.action}</div>{item.verification_required && <small>Current-source verification required</small>}</article>)}</div></section>}
    {tab === 'assistant' && <section className="live-card live-assistant"><CardHeader title="Ask the active document" subtitle="Answers are constrained to the saved analysis" /><textarea rows="4" value={question} onChange={event => setQuestion(event.target.value)} /><button className="live-primary" onClick={ask} disabled={asking}>{asking ? <><LoaderCircle className="spin" size={18} />Reviewing evidence…</> : <><MessageSquareText size={18} />Ask LIVE SYNESIS</>}</button>{answer && <pre>{answer}</pre>}</section>}
    {tab === 'report' && <section className="live-card"><CardHeader title="Decision report" subtitle="Downloadable review record" action={<div className="live-actions"><button onClick={() => download(`${document.title}.json`, JSON.stringify(document, null, 2), 'application/json')}><Download size={16} />JSON</button><button className="live-primary" onClick={() => download(`${document.title}-report.txt`, reportText(document))}><Download size={16} />Report</button></div>} /><pre className="live-report">{reportText(document)}</pre></section>}
  </div>;
}

function RiskBadge({ risk, score }) { return <span className={riskClass(risk)}>{risk} · {score}/100</span>; }
function CardHeader({ title, subtitle, action }) { return <div className="live-card-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>; }
function Empty({ title, text, action }) { return <div className="live-empty"><FileText size={30} /><h3>{title}</h3><p>{text}</p>{action}</div>; }
