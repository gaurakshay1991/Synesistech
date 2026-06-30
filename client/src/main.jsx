import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const tabs = [
  ['documents', 'Documents'],
  ['research', 'Live Legal Research'],
  ['contract', 'Contract Review'],
  ['clause', 'Clause Rewrite'],
  ['memo', 'Legal Memo'],
  ['watch', 'Regulatory Watch'],
  ['audit', 'Audit']
];

const starterDocuments = [
  {
    id: 'doc-001',
    title: 'Real Estate Financing Framework',
    category: 'Policy / Framework',
    matter: 'Bank Legal Review',
    status: 'Lawyer Review',
    risk: 'High',
    owner: 'Akshay Gaur',
    updatedAt: '2026-06-30',
    size: '428 KB',
    type: 'DOCX',
    summary: 'Review of security, SPV liability, group exposure, title diligence and bank-protective controls.',
    tags: ['RBI', 'Security', 'SPV', 'Risk']
  },
  {
    id: 'doc-002',
    title: 'Travel Remittance Supplementary Agreement',
    category: 'Agreement',
    matter: 'Outward Remittance',
    status: 'Final Approved',
    risk: 'Medium',
    owner: 'Legal Team',
    updatedAt: '2026-06-24',
    size: '212 KB',
    type: 'DOCX',
    summary: 'Product-specific addendum covering travel remittances, partner responsibilities, LRS reporting and communication channels.',
    tags: ['FEMA', 'LRS', 'AD Bank', 'Partner']
  },
  {
    id: 'doc-003',
    title: 'Vendor Storage Facility Agreement',
    category: 'Vendor Contract',
    matter: 'Secure Storage / Digitisation',
    status: 'AI Draft',
    risk: 'High',
    owner: 'Operations / Legal',
    updatedAt: '2026-06-22',
    size: '318 KB',
    type: 'PDF',
    summary: 'Document custody, insurance, confidentiality, information security, regulatory inspection and liability controls.',
    tags: ['Vendor', 'Insurance', 'Data', 'Custody']
  },
  {
    id: 'doc-004',
    title: 'Dvara Referral Term Sheet',
    category: 'Term Sheet',
    matter: 'Referral / Investment Banking',
    status: 'Source Checked',
    risk: 'Medium',
    owner: 'Investment Banking / Legal',
    updatedAt: '2026-06-19',
    size: '144 KB',
    type: 'DOCX',
    summary: 'Referral fee structure, seat/venue/jurisdiction alignment, termination triggers and sanctions protections.',
    tags: ['Referral', 'AIF', 'Arbitration', 'Sanctions']
  }
];

function App() {
  const [token, setToken] = useState(localStorage.getItem('synesis_token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('synesis_user') || 'null'));
  const [active, setActive] = useState('documents');
  if (!token) return <Login onLogin={(t, u) => { localStorage.setItem('synesis_token', t); localStorage.setItem('synesis_user', JSON.stringify(u)); setToken(t); setUser(u); }} />;
  return <Shell user={user} active={active} setActive={setActive} logout={() => { localStorage.clear(); setToken(''); setUser(null); }} token={token} />;
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@synesis.local');
  const [password, setPassword] = useState('ChangeThisAdminPassword123!');
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault(); setError('');
    const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Login failed');
    onLogin(data.token, data.user);
  }
  return <main className="login">
    <section className="card login-card">
      <div className="brand">Synesis</div>
      <h1>Private Investor LegalTech Platform</h1>
      <p>No public signup. No payment module. Private legal intelligence workspace for you and invited investors.</p>
      <form onSubmit={submit}>
        <label>Email<input value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        {error && <div className="error">{error}</div>}
        <button>Enter Synesis</button>
      </form>
    </section>
  </main>;
}

function Shell({ user, active, setActive, logout, token }) {
  return <div className="app">
    <aside>
      <div className="brand">Synesis</div>
      <p className="muted">Private investor mode</p>
      {tabs.map(([id, label]) => <button key={id} className={active === id ? 'nav active' : 'nav'} onClick={() => setActive(id)}>{label}</button>)}
      <div className="spacer" />
      <p className="muted small">{user?.email}<br />{user?.role}</p>
      <button className="nav" onClick={logout}>Logout</button>
    </aside>
    <main>
      <header><div><h1>{tabs.find(t => t[0] === active)?.[1]}</h1><p className="muted header-subtitle">Private legal workspace for research, documents, review and investor-ready outputs.</p></div><span className="pill">Private • No payments • Investor demo</span></header>
      {active === 'documents' && <Documents user={user} />}
      {active === 'research' && <Research token={token} />}
      {active === 'contract' && <Contract token={token} />}
      {active === 'clause' && <Clause token={token} />}
      {active === 'memo' && <Memo token={token} />}
      {active === 'watch' && <Watch token={token} />}
      {active === 'audit' && <Audit token={token} />}
    </main>
  </div>;
}

function Documents({ user }) {
  const [documents, setDocuments] = useState(() => JSON.parse(localStorage.getItem('synesis_documents') || 'null') || starterDocuments);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [category, setCategory] = useState('All');
  const [title, setTitle] = useState('');
  const [matter, setMatter] = useState('');
  const [uploadCategory, setUploadCategory] = useState('Agreement');

  function persist(next) {
    setDocuments(next);
    localStorage.setItem('synesis_documents', JSON.stringify(next));
  }

  function addDocument(file) {
    const cleanTitle = title.trim() || file?.name?.replace(/\.[^/.]+$/, '') || 'Untitled Legal Document';
    const size = file ? `${Math.max(1, Math.round(file.size / 1024))} KB` : 'Manual Entry';
    const type = file?.name?.split('.').pop()?.toUpperCase() || 'NOTE';
    const next = [{
      id: crypto.randomUUID(),
      title: cleanTitle,
      category: uploadCategory,
      matter: matter.trim() || 'Unassigned Matter',
      status: 'AI Draft',
      risk: 'Pending',
      owner: user?.email || 'Synesis User',
      updatedAt: new Date().toISOString().slice(0, 10),
      size,
      type,
      summary: 'Newly added to Synesis document vault. Ready for AI review, source check and lawyer sign-off.',
      tags: ['New', uploadCategory]
    }, ...documents];
    persist(next);
    setTitle('');
    setMatter('');
  }

  function updateStatus(id, nextStatus) {
    persist(documents.map(doc => doc.id === id ? { ...doc, status: nextStatus, updatedAt: new Date().toISOString().slice(0, 10) } : doc));
  }

  function removeDocument(id) {
    persist(documents.filter(doc => doc.id !== id));
  }

  const categories = ['All', ...new Set(documents.map(d => d.category))];
  const statuses = ['All', 'AI Draft', 'Source Checked', 'Lawyer Review', 'Final Approved'];
  const filtered = useMemo(() => documents.filter(doc => {
    const text = `${doc.title} ${doc.category} ${doc.matter} ${doc.summary} ${doc.tags?.join(' ')}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (status === 'All' || doc.status === status) && (category === 'All' || doc.category === category);
  }), [documents, query, status, category]);

  const total = documents.length;
  const highRisk = documents.filter(d => d.risk === 'High').length;
  const approved = documents.filter(d => d.status === 'Final Approved').length;
  const review = documents.filter(d => d.status === 'Lawyer Review').length;

  return <div className="documents-page">
    <section className="hero-card card">
      <div>
        <p className="eyebrow">Synesis Document Intelligence</p>
        <h2>Private document vault for legal review, investor demos and controlled sign-off.</h2>
        <p className="muted">Track contracts, policies, opinions and regulatory notes through AI draft, source check, lawyer review and final approval.</p>
      </div>
      <div className="hero-actions">
        <label className="upload-button">Upload document<input type="file" onChange={e => addDocument(e.target.files?.[0])} /></label>
        <button onClick={() => addDocument(null)}>Create manual record</button>
      </div>
    </section>

    <section className="stats-grid">
      <Stat label="Total documents" value={total} />
      <Stat label="High-risk files" value={highRisk} />
      <Stat label="In lawyer review" value={review} />
      <Stat label="Final approved" value={approved} />
    </section>

    <section className="card control-panel">
      <div className="control-grid">
        <label>Document title<input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Referral Agreement marked draft" /></label>
        <label>Matter / Workstream<input value={matter} onChange={e => setMatter(e.target.value)} placeholder="e.g. Investment Banking" /></label>
        <label>Category<select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)}><option>Agreement</option><option>Policy / Framework</option><option>Legal Opinion</option><option>Vendor Contract</option><option>Term Sheet</option><option>Regulatory Note</option></select></label>
      </div>
      <div className="filter-grid">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search documents, matters, tags or risks..." />
        <select value={status} onChange={e => setStatus(e.target.value)}>{statuses.map(x => <option key={x}>{x}</option>)}</select>
        <select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(x => <option key={x}>{x}</option>)}</select>
      </div>
    </section>

    <section className="document-grid">
      {filtered.map(doc => <DocumentCard key={doc.id} doc={doc} updateStatus={updateStatus} removeDocument={removeDocument} />)}
      {!filtered.length && <section className="card empty-state"><h3>No matching documents</h3><p className="muted">Change the search or filters, or add a new document record.</p></section>}
    </section>
  </div>;
}

function Stat({ label, value }) {
  return <div className="card stat"><span>{label}</span><strong>{value}</strong></div>;
}

function DocumentCard({ doc, updateStatus, removeDocument }) {
  return <article className="card document-card">
    <div className="doc-topline"><span className="doc-type">{doc.type}</span><RiskBadge risk={doc.risk} /></div>
    <h3>{doc.title}</h3>
    <p className="muted">{doc.summary}</p>
    <div className="doc-meta">
      <span>{doc.category}</span>
      <span>{doc.matter}</span>
      <span>{doc.size}</span>
      <span>Updated {doc.updatedAt}</span>
    </div>
    <div className="tag-row">{doc.tags?.map(tag => <span key={tag}>{tag}</span>)}</div>
    <div className="review-row">
      <select value={doc.status} onChange={e => updateStatus(doc.id, e.target.value)}>
        <option>AI Draft</option>
        <option>Source Checked</option>
        <option>Lawyer Review</option>
        <option>Final Approved</option>
      </select>
      <button className="secondary" onClick={() => removeDocument(doc.id)}>Remove</button>
    </div>
  </article>;
}

function RiskBadge({ risk }) {
  return <span className={`risk risk-${String(risk).toLowerCase()}`}>{risk} Risk</span>;
}

function useApi(token) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  async function call(path, payload) {
    setLoading(true); setResult(null);
    try {
      const res = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      const data = await res.json();
      setResult(data);
    } catch (e) { setResult({ output: e.message, sources: [] }); }
    setLoading(false);
  }
  return { loading, result, call };
}

function Research({ token }) {
  const [query, setQuery] = useState('What is the latest RBI position on digital lending?');
  const { loading, result, call } = useApi(token);
  return <Panel><textarea value={query} onChange={e => setQuery(e.target.value)} /><button onClick={() => call('/api/legal/research', { query, jurisdiction: 'India' })}>Run live research</button><Output loading={loading} result={result} /></Panel>;
}
function Contract({ token }) {
  const [text, setText] = useState('Paste agreement / clause text here...');
  const { loading, result, call } = useApi(token);
  return <Panel><textarea value={text} onChange={e => setText(e.target.value)} /><button onClick={() => call('/api/contracts/review', { text })}>Review contract</button><Output loading={loading} result={result} /></Panel>;
}
function Clause({ token }) {
  const [clause, setClause] = useState('Paste clause here...');
  const [stance, setStance] = useState('bank protective');
  const { loading, result, call } = useApi(token);
  return <Panel><input value={stance} onChange={e => setStance(e.target.value)} /><textarea value={clause} onChange={e => setClause(e.target.value)} /><button onClick={() => call('/api/clauses/rewrite', { clause, stance })}>Rewrite clause</button><Output loading={loading} result={result} /></Panel>;
}
function Memo({ token }) {
  const [issue, setIssue] = useState('Whether RBI approval is required for the proposed structure');
  const [facts, setFacts] = useState('Add facts here...');
  const { loading, result, call } = useApi(token);
  return <Panel><input value={issue} onChange={e => setIssue(e.target.value)} /><textarea value={facts} onChange={e => setFacts(e.target.value)} /><button onClick={() => call('/api/memo/generate', { issue, facts })}>Generate memo</button><Output loading={loading} result={result} /></Panel>;
}
function Watch({ token }) {
  const [topic, setTopic] = useState('FEMA outward remittance and AD bank compliance');
  const [regulator, setRegulator] = useState('RBI');
  const { loading, result, call } = useApi(token);
  return <Panel><input value={regulator} onChange={e => setRegulator(e.target.value)} /><textarea value={topic} onChange={e => setTopic(e.target.value)} /><button onClick={() => call('/api/regulatory/watch', { topic, regulator })}>Check updates</button><Output loading={loading} result={result} /></Panel>;
}
function Audit({ token }) {
  const [data, setData] = useState(null);
  async function load() { const res = await fetch(`${API}/api/admin/audit`, { headers: { Authorization: `Bearer ${token}` } }); setData(await res.json()); }
  return <Panel><button onClick={load}>Load audit log</button><pre>{JSON.stringify(data, null, 2)}</pre></Panel>;
}
function Panel({ children }) { return <section className="card panel">{children}</section>; }
function Output({ loading, result }) {
  if (loading) return <div className="loading">Working with live legal intelligence...</div>;
  if (!result) return null;
  return <div className="output"><div className="meta">Checked: {result.checkedAt || 'n/a'} {result.demoMode ? '• Demo mode' : ''}</div><pre>{result.output || result.error || result.detail}</pre>{result.detail && <p className="error-detail">Detail: {result.detail}</p>}{Boolean(result.sources?.length) && <div><h3>Sources</h3>{result.sources.map(s => <a key={s} href={s} target="_blank">{s}</a>)}</div>}<button onClick={() => navigator.clipboard.writeText(result.output || result.error || result.detail || '')}>Copy output</button></div>;
}

createRoot(document.getElementById('root')).render(<App />);
