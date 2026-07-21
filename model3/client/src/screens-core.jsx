import { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Archive, ArrowRight, BarChart3, BellRing, Bot, BrainCircuit,
  Building2, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, Database, FileCheck2,
  FilePlus2, FileSearch2, FileText, Fingerprint, Gauge, GitBranch, Globe2, KeyRound,
  LayoutDashboard, LibraryBig, Link2, ListChecks, LogOut, Menu, MessageSquareText,
  Network, Play, Plus, RefreshCw, Scale, Search, Send, Settings2, ShieldCheck, Sparkles,
  Target, UploadCloud, UserCog, Users, X, Zap
} from 'lucide-react';

function formatDate(value) {
  if (!value || value === 'Event driven' || value === 'Continuous' || value === 'Daily' || value === 'To be determined') return value || '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
}

function downloadJson(filename, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function tone(value = '') { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-'); }

export function Login({ request, onLogin }) {
  const [email, setEmail] = useState(import.meta.env.DEV ? 'admin@synesis.local' : '');
  const [password, setPassword] = useState(import.meta.env.DEV ? 'ChangeMe!12345' : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); await onLogin(data.user); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="auth-page"><div className="auth-panel"><div className="auth-copy"><div className="brand-mark large"><Zap /></div><span className="eyebrow">SYNESIS NEW MODEL 3.0</span><h1>From fragmented evidence to governed institutional action.</h1><p>Compile obligations. Propagate impact. Challenge decisions. Prove completion. Preserve institutional memory.</p><div className="auth-pill"><ShieldCheck /> Human-governed high-risk execution</div></div><form className="auth-card" onSubmit={submit}><div><small>Secure institutional workspace</small><h2>Sign in</h2></div><label>Email<input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="username" required /></label><label>Password<input value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete="current-password" required /></label>{error && <div className="form-error">{error}</div>}<button className="primary large-button" disabled={busy}>{busy ? 'Signing in…' : 'Enter Synesis'}<ArrowRight size={18} /></button>{import.meta.env.DEV && <p className="dev-note">Local development credentials are prefilled. Change the password immediately.</p>}</form></div></div>;
}

export function PasswordSetup({ user, request, onDone, onLogout }) {
  const [currentPassword, setCurrent] = useState('ChangeMe!12345');
  const [newPassword, setNext] = useState('Synesis!Secure2026');
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault(); setError('');
    try { const data = await request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }); await onDone(data.user); }
    catch (err) { setError(err.message); }
  }
  return <div className="auth-page"><form className="auth-card narrow" onSubmit={submit}><KeyRound size={32} /><small>First login security</small><h2>Create your permanent password</h2><p>{user.name}, temporary passwords cannot access institutional data.</p><label>Current password<input type="password" value={currentPassword} onChange={e => setCurrent(e.target.value)} /></label><label>New password<input type="password" value={newPassword} onChange={e => setNext(e.target.value)} /></label>{error && <div className="form-error">{error}</div>}<button className="primary large-button">Secure account</button><button type="button" className="text-button" onClick={onLogout}>Sign out</button></form></div>;
}

export function Home({ state, openPage }) {
  const flow = ['Source / event', 'Extract & verify', 'Compile obligations', 'Map impact', 'Challenge decision', 'Approve', 'Execute', 'Verify evidence', 'Remember & re-evaluate'];
  return <>
    <div className="hero-grid"><div className="hero-card"><span className="eyebrow">INSTITUTIONAL DECISION TWIN</span><h2>Know what must happen next—and prove why.</h2><p>Synesis connects evidence, obligations, controls, approvals, actions and outcomes into one defensible decision path.</p><div className="hero-actions"><button className="primary" onClick={() => openPage('work')}>Open attention queue <ArrowRight size={17} /></button><button className="ghost" onClick={() => openPage('twin')}>Explore the Twin <Network size={17} /></button></div></div><div className="assurance-card"><div className="pulse-ring"><Fingerprint /></div><div><small>Evidence assurance coverage</small><strong>{state.metrics.evidenceCoverage}%</strong><p>Completion evidence verified against active obligations and controls.</p></div></div></div>
    <MetricGrid metrics={state.metrics} />
    <div className="section-head"><div><small>What requires attention</small><h2>Decision and execution queue</h2></div><button className="text-button" onClick={() => openPage('work')}>View all <ArrowRight size={16} /></button></div>
    <div className="attention-list">{state.alerts.slice(0, 4).map(alert => <div className="attention-row" key={alert.id}><RiskBadge value={alert.severity} /><div className="grow"><strong>{alert.title}</strong><p>{alert.why}</p></div><div><small>Owner</small><span>{alert.owner}</span></div><div><small>Due</small><span>{formatDate(alert.due)}</span></div><button className="ghost" onClick={() => openPage('work')}>{alert.next}<ChevronRight size={16} /></button></div>)}</div>
    <div className="section-head"><div><small>Connected operating loop</small><h2>From source change to institutional memory</h2></div></div>
    <div className="flow-strip">{flow.map((item, index) => <div key={item}><span>{index + 1}</span><strong>{item}</strong>{index < flow.length - 1 && <ChevronRight />}</div>)}</div>
    <div className="two-col"><Panel title="Control pressure" subtitle="Controls with the largest assurance gap"><div className="control-list">{state.controls.map(control => <ProgressRow key={control.id} label={control.name} value={control.effectiveness} meta={`${control.owner} · ${control.status}`} />)}</div></Panel><Panel title="Decision memory" subtitle="Analogous prior decisions surfaced for current matters"><div className="memory-list">{state.memories.map(memory => <div key={memory.id}><div><strong>{memory.title}</strong><span>{memory.outcome}</span></div><p>{memory.lesson}</p><b>{memory.similarity}% analogous</b></div>)}</div></Panel></div>
  </>;
}

function MetricGrid({ metrics }) {
  const items = [
    ['Attention now', metrics.attention, AlertTriangle, 'Requires ownership or decision'],
    ['Critical exposure', metrics.critical, ShieldCheck, 'High-consequence active items'],
    ['Decisions pending', metrics.decisionsPending, Scale, 'Waiting for authorised approval'],
    ['Controls at risk', metrics.controlsAtRisk, Gauge, 'Below assurance threshold'],
    ['Avg. cycle time', `${metrics.averageCycleDays}d`, Clock3, 'Intake to governed disposition'],
    ['Prevented exposure', money(metrics.preventedExposure), Target, 'Modelled protected value']
  ];
  return <div className="metric-grid">{items.map(([label, value, Icon, note]) => <div className="metric" key={label}><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div><Icon /></div>)}</div>;
}

export function MyWork({ state, request, setState, setNotice }) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const items = state.tasks.filter(item => (filter === 'All' || item.priority === filter) && (!needle || [item.title, item.owner, item.blocker, ...(item.evidenceRequired || [])].join(' ').toLowerCase().includes(needle)));
  async function update(task, status) {
    try { const data = await request(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); setState(data.state); setNotice({ type: 'success', message: `${task.title}: ${status}` }); }
    catch (err) { setNotice({ type: 'error', message: err.message }); }
  }
  return <><div className="toolbar"><div className="segmented">{['All', 'Critical', 'High', 'Medium'].map(item => <button className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div><div className="search-box"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search work, owners or blockers" /></div></div><div className="task-board">{['Not started', 'Ready', 'In progress', 'Blocked', 'Evidence review', 'Completed'].map(status => <div className="task-column" key={status}><div className="column-head"><strong>{status}</strong><span>{items.filter(item => item.status === status).length}</span></div>{items.filter(item => item.status === status).map(task => <div className="task-card" key={task.id}><RiskBadge value={task.priority} /><h3>{task.title}</h3><p>{task.blocker || 'No blocker recorded.'}</p><div className="task-meta"><span>{task.owner}</span><span>{formatDate(task.due)}</span></div><small>Evidence: {(task.evidenceRequired || []).join(' · ') || 'Define at closure'}</small><select value={task.status} onChange={e => update(task, e.target.value)}>{['Not started', 'Ready', 'In progress', 'Blocked', 'Evidence review', 'Completed'].map(value => <option key={value}>{value}</option>)}</select></div>)}</div>)}</div></>;
}

export function Documents({ documents, onOpen, onUpload }) {
  return <><div className="page-intro"><div><span className="eyebrow">LIVE SOURCE INTAKE</span><h2>Actual evidence—not preset answers.</h2><p>Upload a document to run multipass analysis and compile its obligations, decisions, actions and evidence requirements into the Twin.</p></div><button className="primary" onClick={onUpload}><UploadCloud size={18} /> New analysis</button></div>{documents.length ? <div className="table-card"><table><thead><tr><th>Document / matter</th><th>Status</th><th>Risk</th><th>Engine</th><th>Created</th><th /></tr></thead><tbody>{documents.map(doc => <tr key={doc.id}><td><strong>{doc.title}</strong><small>{doc.matter} · {doc.documentType}</small></td><td><Status value={doc.status} /></td><td><RiskBadge value={doc.overallRisk} /></td><td><span className="engine">{doc.engine}</span></td><td>{formatDate(doc.createdAt)}</td><td><button className="text-button" onClick={() => onOpen(doc.id)}>Open <ChevronRight size={15} /></button></td></tr>)}</tbody></table></div> : <Empty icon={FileText} title="No institutional evidence has been analysed" text="Upload an agreement, policy, regulation, control file or case pack to begin." action={onUpload} />}</>;
}

export function Review({ active, documents, onOpen, request, setActive, setNotice }) {
  const [tab, setTab] = useState('position');
  if (!active) return <div><div className="section-head"><div><small>Review centre</small><h2>Select an analysed document</h2></div></div><div className="doc-picker">{documents.map(doc => <button key={doc.id} onClick={() => onOpen(doc.id)}><FileText /><span><strong>{doc.title}</strong><small>{doc.matter}</small></span><ChevronRight /></button>)}</div></div>;
  const a = active.analysis || {};
  async function statusChange(status) {
    try { const data = await request(`/documents/${active.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); setActive({ ...active, ...data.document }); setNotice({ type: 'success', message: `Document status changed to ${status}.` }); }
    catch (err) { setNotice({ type: 'error', message: err.message }); }
  }
  const tabs = [['position', 'Executive position'], ['issues', `Issues (${a.findings?.length || 0})`], ['obligations', `Compiled obligations (${a.obligations?.length || 0})`], ['decision', 'Decision path'], ['impact', 'Impact map'], ['challenge', 'Senior challenge'], ['provenance', 'Provenance']];
  return <><div className="review-head"><div><span className="eyebrow">ACTIVE MATTER</span><h2>{active.title}</h2><p>{active.matter} · {active.documentType} · {active.jurisdiction}</p></div><div className="review-score"><RiskBadge value={a.overall_risk} /><strong>{a.overall_score}<small>/100</small></strong><select value={active.status} onChange={e => statusChange(e.target.value)}>{['AI Review Complete', 'In Legal Review', 'In Compliance Review', 'Escalated', 'Final Approved', 'Rejected', 'Closed'].map(s => <option key={s}>{s}</option>)}</select></div></div><div className="tabbar">{tabs.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === 'position' && <div className="two-col wide-left"><Panel title="Recommended decision" subtitle={a.engine}><div className="decision-callout"><Sparkles /><div><strong>{a.recommended_decision}</strong><p>{a.executive_position}</p></div></div><h3>Document summary</h3><p className="long-copy">{a.document_summary}</p></Panel><Panel title="Decision controls" subtitle="Human accountability remains mandatory"><KeyValue label="Overall risk" value={a.overall_risk} /><KeyValue label="Independent passes" value={a.analysis_details?.independent_passes ?? 0} /><KeyValue label="Live AI used" value={a.analysis_details?.live_ai_used ? 'Yes' : 'No — fallback'} /><KeyValue label="Source verification" value={a.source_verification?.status || 'Not recorded'} /></Panel></div>}
    {tab === 'issues' && <div className="finding-list">{(a.findings || []).map((item, index) => <article className="finding" key={item.id || index}><div className="finding-top"><RiskBadge value={item.risk_level} /><span>{item.confidence}% confidence</span><b>{item.clause_reference}</b></div><h3>{item.issue}</h3><blockquote>{item.quoted_text || 'No quoted text returned.'}</blockquote><div className="finding-grid"><div><small>Institutional impact</small><p>{item.institutional_impact}</p></div><div><small>How it materialises</small><p>{item.how_risk_may_materialise}</p></div><div><small>Mitigation</small><p>{item.recommended_mitigation}</p></div><div><small>Suggested language</small><p>{item.suggested_rewrite}</p></div></div><footer>Owners: {(item.review_owner || []).join(', ')} · Stakeholders: {(item.affected_stakeholders || []).join(', ') || 'To be mapped'}</footer></article>)}</div>}
    {tab === 'obligations' && <div className="cards-grid">{(a.obligations || []).map((item, index) => <div className="info-card" key={index}><RiskBadge value={item.risk} /><h3>{item.title}</h3><KeyValue label="Type" value={item.type} /><KeyValue label="Owner" value={item.owner} /><KeyValue label="Trigger" value={item.trigger} /><KeyValue label="Deadline" value={item.deadline} /><p><small>Source</small>{item.source_reference}</p><p><small>Completion evidence</small>{(item.evidence_required || []).join(' · ') || 'Not specified'}</p></div>)}</div>}
    {tab === 'decision' && <div className="two-col"><Panel title="Decision questions" subtitle="Questions that require accountable disposition"><div className="stack-list">{(a.decision_questions || []).map((item, index) => <div key={index}><span>{index + 1}</span><div><strong>{item.question}</strong><p>{item.owner} · {item.urgency}</p></div></div>)}</div></Panel><Panel title="Approval gates" subtitle="No autonomous high-risk execution"><div className="stack-list">{(a.approval_gates || []).map((item, index) => <div key={index}><ShieldCheck /><div><strong>{item.gate}</strong><p>{(item.required_roles || []).join(', ')} · {item.risk}</p></div></div>)}</div></Panel></div>}
    {tab === 'impact' && <div className="impact-grid">{[['Entities', a.affected_entities], ['Controls', a.affected_controls], ['Products', a.affected_products], ['Processes', a.affected_processes], ['Systems', a.affected_systems], ['Teams', a.affected_teams]].map(([label, values]) => <Panel key={label} title={label} subtitle={`${values?.length || 0} mapped`}><div className="chip-list">{(values || []).map((item, index) => <span key={index}>{typeof item === 'string' ? item : item.name || item.title || JSON.stringify(item)}</span>)}</div></Panel>)}</div>}
    {tab === 'challenge' && <div className="two-col"><Panel title="Independent senior challenge" subtitle={`${a.challenge?.confidence || '—'} confidence`}><div className="decision-callout warning"><AlertTriangle /><div><strong>{a.challenge?.conclusion}</strong><p>{a.challenge?.dissent}</p></div></div><h3>Possible omissions</h3><ul>{(a.challenge?.omissions || []).map((item, index) => <li key={index}>{item}</li>)}</ul></Panel><Panel title="Approval conditions" subtitle="Required before final disposition"><ol>{(a.challenge?.approval_conditions || []).map((item, index) => <li key={index}>{item}</li>)}</ol></Panel></div>}
    {tab === 'provenance' && <div className="two-col"><Panel title="Analysis provenance" subtitle="Explainability and model-risk controls"><KeyValue label="Engine" value={a.engine} /><KeyValue label="Model" value={a.analysis_details?.model || 'Deterministic fallback'} /><KeyValue label="Generated" value={a.analysis_details?.generated_at} /><KeyValue label="Characters reviewed" value={a.analysis_details?.characters_reviewed} /><KeyValue label="Independent passes" value={a.analysis_details?.independent_passes} /></Panel><Panel title="Assumptions and limits" subtitle={a.source_verification?.limitation}>{(a.assumptions_and_limits || []).map((item, index) => <p key={index}>• {item}</p>)}</Panel></div>}
  </>;
}

function Panel({ title, subtitle, children }) { return <article className="panel"><header><div><h3>{title}</h3><p>{subtitle}</p></div></header>{children}</article>; }
function RiskBadge({ value }) { return <span className={`risk ${tone(value)}`}>{value || 'Unrated'}</span>; }
function Status({ value }) { return <span className={`status ${tone(value)}`}>{value || '—'}</span>; }
function KeyValue({ label, value }) { return <div className="key-value"><span>{label}</span><strong>{value ?? '—'}</strong></div>; }
function ProgressRow({ label, value, meta }) { return <div className="progress-row"><div><strong>{label}</strong><small>{meta}</small></div><div><i style={{ width: `${value}%` }} /></div><b>{value}%</b></div>; }
function Empty({ icon: Icon, title, text, action }) { return <div className="empty"><Icon /><h2>{title}</h2><p>{text}</p><button className="primary" onClick={action}>Start live analysis</button></div>; }
