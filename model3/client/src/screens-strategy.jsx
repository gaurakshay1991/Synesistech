import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, Archive, ArrowRight, BarChart3, BellRing, Bot, BrainCircuit,
  Building2, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, Database, FileCheck2,
  FilePlus2, FileSearch2, FileText, Fingerprint, Gauge, GitBranch, Globe2, KeyRound,
  LayoutDashboard, LibraryBig, Link2, ListChecks, LogOut, Menu, MessageSquareText,
  Network, Play, Plus, RefreshCw, Scale, Search, Send, Settings2, ShieldCheck, Sparkles,
  Target, UploadCloud, UserCog, Users, X, Zap
} from 'lucide-react';
import { formatDate, money, downloadJson, tone, Modal, Panel, RiskBadge, Status, KeyValue, MiniProgress, ProgressRow } from './ui.jsx';

export function Simulations({ state, request, setState, setNotice }) {
  const [form, setForm] = useState({ name: '', probability: 30, impact: 80 });
  async function run(e) { e.preventDefault(); try { const data = await request('/simulations', { method: 'POST', body: JSON.stringify(form) }); setState(data.state); setNotice({ type: 'success', message: `Simulation completed: readiness ${data.simulation.readiness}%.` }); setForm({ name: '', probability: 30, impact: 80 }); } catch (err) { setNotice({ type: 'error', message: err.message }); } }
  async function createPlan(sim) { try { const data = await request(`/simulations/${sim.id}/response-plan`, { method: 'POST', body: '{}' }); setState(data.state); setNotice({ type: 'success', message: `Governed response plan created for ${sim.name}.` }); } catch (err) { setNotice({ type: 'error', message: err.message }); } }
  return <><div className="simulation-hero"><div><span className="eyebrow">UNIVERSAL SCENARIO ENGINE</span><h2>Stress the institution before reality does.</h2><p>Model a regulatory, vendor, cyber, capital, operational or contractual event against current controls, decisions, dependencies and evidence readiness.</p></div><form onSubmit={run}><label>Scenario<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Critical cloud vendor becomes unavailable" /></label><label>Probability<input type="range" min="1" max="100" value={form.probability} onChange={e => setForm({ ...form, probability: Number(e.target.value) })} /><span>{form.probability}%</span></label><label>Impact<input type="range" min="1" max="100" value={form.impact} onChange={e => setForm({ ...form, impact: Number(e.target.value) })} /><span>{form.impact}%</span></label><button className="primary"><Play size={17} /> Run simulation</button></form></div><div className="simulation-grid">{state.simulations.map(sim => <article key={sim.id}><div className="sim-score"><div><small>Readiness</small><strong>{sim.readiness}%</strong></div><Gauge /></div><h3>{sim.name}</h3><div className="sim-metrics"><span>Probability <b>{sim.probability}%</b></span><span>Impact <b>{sim.impact}%</b></span></div><p>{sim.recommendation}</p><footer><Status value={sim.readiness < 55 ? 'At risk' : sim.readiness < 75 ? 'Attention' : 'Prepared'} /><button className="text-button" onClick={() => createPlan(sim)}>Create response plan <ArrowRight size={15} /></button></footer></article>)}</div></>;
}

export function ControlTower({ state, user, request }) {
  const [audit, setAudit] = useState([]);
  const [users, setUsers] = useState([]);
  useEffect(() => { if (['admin','audit','management'].includes(user.role)) request('/admin/audit?limit=80').then(d => setAudit(d.audit)).catch(()=>{}); if (user.role === 'admin') request('/admin/users').then(d => setUsers(d.users)).catch(()=>{}); }, []);
  return <><div className="control-grid"><Panel title="AI runtime" subtitle="Governed analysis configuration"><KeyValue label="Mode" value="Live multipass when provider configured" /><KeyValue label="Fallback policy" value="Explicit emergency fallback only" /><KeyValue label="Autonomous high-risk action" value="Disabled" /><KeyValue label="Source verification" value="Controlled registry / licensed connectors" /></Panel><Panel title="Data controls" subtitle="Current build"><KeyValue label="Tenant boundary" value="Organisation scoped" /><KeyValue label="Sensitive source text" value="AES-256-GCM encrypted" /><KeyValue label="Session" value="HttpOnly signed cookie" /><KeyValue label="Persistence" value="PostgreSQL on hosted deployments; encrypted local fallback" /></Panel><Panel title="Model-risk controls" subtitle="Required for institutional deployment"><div className="check-list">{['Prompt and model version register','Evaluation and regression suite','Human approval gates','Failure and fallback disclosure','Source provenance','Cost and latency telemetry','Access and audit trail','No silent policy changes'].map(x=><span key={x}><CheckCircle2 />{x}</span>)}</div></Panel><Panel title="Source registry" subtitle="Authoritative or controlled sources only">{state.sources.map(source => <div className="source-row" key={source.id}><Globe2 /><div><strong>{source.name}</strong><small>{source.jurisdiction} · {source.type}</small></div><Status value={source.status} /></div>)}</Panel></div>{users.length > 0 && <><div className="section-head"><div><small>Access administration</small><h2>Users and roles</h2></div></div><div className="table-card"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last login</th></tr></thead><tbody>{users.map(item => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.email}</small></td><td>{item.role}</td><td><Status value={item.isActive ? 'Active' : 'Inactive'} /></td><td>{formatDate(item.lastLoginAt)}</td></tr>)}</tbody></table></div></>}{audit.length > 0 && <><div className="section-head"><div><small>Immutable accountability layer</small><h2>Recent audit activity</h2></div></div><div className="audit-list">{audit.map(item => <div key={item.id}><Activity /><div><strong>{item.action}</strong><small>{item.userEmail} · {item.role}</small></div><span>{formatDate(item.createdAt)}</span></div>)}</div></>}</>;
}

export function UploadModal({ request, onClose, onComplete }) {
  const [form, setForm] = useState({ title: '', matter: '', documentType: 'Auto-detect', jurisdiction: 'India', riskAppetite: 'Conservative', analysisMode: 'Deep', objective: 'Identify decisions, obligations, impacts, controls and governed actions.', text: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [policyBlock, setPolicyBlock] = useState(null);
  const textRef = useRef(null);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!file && !form.text.trim()) {
      setError('Choose a permitted file or paste the document text before starting analysis.');
      textRef.current?.focus();
      return;
    }
    setBusy(true);
    const body = new FormData();
    Object.entries(form).forEach(([key,value]) => body.append(key,value));
    if (file) body.append('file', file);
    try {
      const data = await request('/documents/analyze', { method: 'POST', body });
      onComplete(data);
    } catch (err) {
      if (err.code === 'CORPORATE_FILE_TRANSFER_BLOCKED') {
        setPolicyBlock({ fileName: err.blockedFileName || file?.name || 'Selected file' });
        setFile(null);
        setTimeout(() => textRef.current?.focus(), 0);
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return <Modal title="Analyse and compile institutional evidence" onClose={onClose} wide><form className="form-grid" onSubmit={submit}><label className="full upload-drop"><UploadCloud /><strong>{file ? file.name : 'Choose PDF, DOCX, TXT, CSV, JSON, Markdown or XML'}</strong><span>Uploads remain subject to your organisation's DLP and external-transfer policy. Synesis cannot bypass those controls.</span><input type="file" accept=".pdf,.docx,.txt,.csv,.json,.md,.xml" onChange={e => { setFile(e.target.files?.[0] || null); setPolicyBlock(null); }} /></label>{policyBlock && <div className="form-error full"><AlertTriangle size={18} /><div><strong>File transfer stopped by your organisation</strong><p>{policyBlock.fileName} did not reach Synesis. The platform has removed the blocked file from this form and retained your other entries. Paste text only where your organisation permits external processing; otherwise request domain allowlisting or an internal deployment.</p><button type="button" className="text-button" onClick={() => textRef.current?.focus()}>Go to approved text entry <ArrowRight size={15} /></button></div></div>}<label>Title<input value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="Optional; inferred from file name" /></label><label>Matter<input required value={form.matter} onChange={e => setForm({...form,matter:e.target.value})} placeholder="e.g. Vendor onboarding agreement" /></label><label>Document type<select value={form.documentType} onChange={e => setForm({...form,documentType:e.target.value})}>{['Auto-detect','Agreement','Policy','Regulation / circular','Legal opinion','Control evidence','Investigation pack','Transaction document'].map(x=><option key={x}>{x}</option>)}</select></label><label>Jurisdiction<input value={form.jurisdiction} onChange={e => setForm({...form,jurisdiction:e.target.value})} /></label><label>Risk appetite<select value={form.riskAppetite} onChange={e => setForm({...form,riskAppetite:e.target.value})}>{['Conservative','Balanced','Commercially calibrated'].map(x=><option key={x}>{x}</option>)}</select></label><label>Analysis mode<select value={form.analysisMode} onChange={e => setForm({...form,analysisMode:e.target.value})}>{['Deep','Standard','Quick'].map(x=><option key={x}>{x}</option>)}</select></label><label className="full">Analysis objective<textarea value={form.objective} onChange={e => setForm({...form,objective:e.target.value})} /></label><div className="divider full"><span>or use approved text entry</span></div><label className="full">Pasted source text<textarea ref={textRef} className="large-text" value={form.text} onChange={e => setForm({...form,text:e.target.value})} placeholder="Paste document text only where your organisation permits external processing" /></label>{error && <div className="form-error full">{error}</div>}<div className="form-actions full"><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? <><RefreshCw className="spin" size={17} /> Running multipass analysis…</> : <><Sparkles size={17} /> Analyse and compile</>}</button></div></form></Modal>;
}