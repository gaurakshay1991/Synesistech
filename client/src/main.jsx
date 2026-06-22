import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const tabs = [
  ['research', 'Live Legal Research'],
  ['contract', 'Contract Review'],
  ['clause', 'Clause Rewrite'],
  ['memo', 'Legal Memo'],
  ['watch', 'Regulatory Watch'],
  ['audit', 'Audit']
];

function App() {
  const [token, setToken] = useState(localStorage.getItem('synesis_token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('synesis_user') || 'null'));
  const [active, setActive] = useState('research');
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
      <header><h1>{tabs.find(t => t[0] === active)?.[1]}</h1><span className="pill">Private • No payments • Investor demo</span></header>
      {active === 'research' && <Research token={token} />}
      {active === 'contract' && <Contract token={token} />}
      {active === 'clause' && <Clause token={token} />}
      {active === 'memo' && <Memo token={token} />}
      {active === 'watch' && <Watch token={token} />}
      {active === 'audit' && <Audit token={token} />}
    </main>
  </div>;
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
  return <div className="output"><div className="meta">Checked: {result.checkedAt || 'n/a'} {result.demoMode ? '• Demo mode' : ''}</div><pre>{result.output || result.error}</pre>{Boolean(result.sources?.length) && <div><h3>Sources</h3>{result.sources.map(s => <a key={s} href={s} target="_blank">{s}</a>)}</div>}<button onClick={() => navigator.clipboard.writeText(result.output || '')}>Copy output</button></div>;
}

createRoot(document.getElementById('root')).render(<App />);
