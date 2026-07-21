import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Archive, ArrowRight, BarChart3, BellRing, Bot, BrainCircuit,
  Building2, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, Database, FileCheck2,
  FilePlus2, FileSearch2, FileText, Fingerprint, Gauge, GitBranch, Globe2, KeyRound,
  LayoutDashboard, LibraryBig, Link2, ListChecks, LogOut, Menu, MessageSquareText,
  Network, Play, Plus, RefreshCw, Scale, Search, Send, Settings2, ShieldCheck, Sparkles,
  Target, UploadCloud, UserCog, Users, X, Zap
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';
const nav = [
  ['home', 'Command Centre', LayoutDashboard], ['work', 'My Work', ListChecks],
  ['documents', 'Intake & Documents', FilePlus2], ['review', 'Review Centre', FileSearch2],
  ['impact', 'Regulatory Impact', Globe2], ['obligations', 'Obligations & Controls', ClipboardCheck],
  ['decisions', 'Decisions & Approvals', Scale], ['execution', 'Execution & Evidence', CheckCircle2],
  ['twin', 'Institutional Twin', Network], ['packs', 'Solution Packs', LibraryBig],
  ['reports', 'Reports & KPIs', BarChart3], ['ask', 'Ask Synesis', MessageSquareText],
  ['simulations', 'Strategy & Simulations', BrainCircuit], ['admin', 'AI Control Tower', Settings2]
];

function isCorporateFileTransferBlock(text, contentType = '') {
  const sample = String(text || '').toLowerCase();
  return sample.includes('file transfer blocked') ||
    (sample.includes('blocked in accordance with company policy') && sample.includes('file name:')) ||
    (contentType.includes('text/html') && sample.includes('contact your system administrator') && sample.includes('blocked'));
}

function blockedFileName(text) {
  return String(text || '').match(/<b>\s*File name:\s*<\/b>\s*([^<]+)/i)?.[1]?.trim() || null;
}

async function readResponse(response) {
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (isCorporateFileTransferBlock(text, contentType)) {
    const fileName = blockedFileName(text);
    const error = new Error(
      `Your organisation's security gateway blocked${fileName ? ` “${fileName}”` : ' the selected file'} before it reached Synesis. ` +
      'Use the approved text-entry route only where policy permits, or ask IT/Cyber to allow the Synesis domain. Synesis cannot override company DLP controls.'
    );
    error.status = response.status || 403;
    error.code = 'CORPORATE_FILE_TRANSFER_BLOCKED';
    error.blockedFileName = fileName;
    throw error;
  }

  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (contentType.includes('text/html')) {
      const error = new Error('A network security or login gateway returned an HTML page instead of the Synesis API response.');
      error.status = response.status || 502;
      error.code = 'UNEXPECTED_HTML_RESPONSE';
      throw error;
    }
    data = { error: text || 'Unexpected response.' };
  }
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed.');
    error.status = response.status;
    throw error;
  }
  return data;
}

import { Login, PasswordSetup, Home, MyWork, Documents, Review } from './screens-core.jsx';
import { Impact, Obligations, Decisions, Execution } from './screens-control.jsx';
import { Twin, Packs, Reports, AskSynesis } from './screens-intelligence.jsx';
import { Simulations, ControlTower, UploadModal } from './screens-strategy.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('home');
  const [state, setState] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [activeDocument, setActiveDocument] = useState(null);
  const [notice, setNotice] = useState(null);
  const [mobile, setMobile] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const request = async (path, options = {}) => readResponse(await fetch(`${API}${path}`, {
    credentials: 'include', ...options,
    headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) }
  }));

  async function bootstrap() {
    const data = await request('/bootstrap');
    setState(data.state);
    setDocuments(data.documents);
    setUser(data.user);
  }

  useEffect(() => {
    request('/auth/session').then(data => {
      setUser(data.user);
      if (!data.user.mustChangePassword) return bootstrap();
    }).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 6500);
    return () => clearTimeout(id);
  }, [notice]);

  async function logout() {
    try { await request('/auth/logout', { method: 'POST', body: '{}' }); } catch {}
    setUser(null); setState(null); setDocuments([]); setActiveDocument(null);
  }

  function openPage(key) { setPage(key); setMobile(false); }

  async function openDocument(id) {
    const data = await request(`/documents/${id}`);
    setActiveDocument(data.document);
    setPage('review');
  }

  if (loading) return <div className="splash"><div className="brand-mark"><Zap size={26} /></div><h1>SYNESIS</h1><p>Loading the institutional decision layer…</p></div>;
  if (!user) return <Login request={request} onLogin={async next => { setUser(next); if (!next.mustChangePassword) await bootstrap(); }} />;
  if (user.mustChangePassword) return <PasswordSetup user={user} request={request} onDone={async next => { setUser(next); await bootstrap(); }} onLogout={logout} />;
  if (!state) return <div className="splash"><RefreshCw className="spin" /><p>Building your command centre…</p></div>;

  const pageTitle = nav.find(item => item[0] === page)?.[1] || 'Synesis';
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? 'open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Zap size={22} /></div><div><strong>SYNESIS</strong><span>NEW MODEL 3.0</span></div><button className="icon mobile-only" onClick={() => setMobile(false)}><X /></button></div>
        <div className="category">Regulatory Decision Assurance</div>
        <nav>{nav.map(([key, label, Icon]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => openPage(key)}><Icon size={18} /><span>{label}</span>{key === 'work' && state.metrics.attention > 0 && <b>{state.metrics.attention}</b>}</button>)}</nav>
        <div className="sidebar-foot"><div className="user-mini"><div>{user.name?.slice(0, 1)}</div><span><strong>{user.name}</strong><small>{user.role}</small></span></div><button className="icon" onClick={logout} title="Log out"><LogOut size={18} /></button></div>
      </aside>
      {mobile && <div className="scrim" onClick={() => setMobile(false)} />}

      <main className="main">
        <header className="topbar">
          <button className="icon mobile-only" onClick={() => setMobile(true)}><Menu /></button>
          <div><small>Institutional operating layer</small><h1>{pageTitle}</h1></div>
          <div className="top-actions"><button className="ghost" onClick={() => setUploadOpen(true)}><UploadCloud size={17} /> Analyse document</button><button className="primary" onClick={() => openPage('work')}><BellRing size={17} /> Attention queue <b>{state.metrics.attention}</b></button></div>
        </header>

        {notice && <div className={`notice ${notice.type || 'info'}`}>{notice.message}<button onClick={() => setNotice(null)}><X size={16} /></button></div>}

        <section className="page">
          {page === 'home' && <Home state={state} openPage={openPage} />}
          {page === 'work' && <MyWork state={state} request={request} setState={setState} setNotice={setNotice} />}
          {page === 'documents' && <Documents documents={documents} onOpen={openDocument} onUpload={() => setUploadOpen(true)} />}
          {page === 'review' && <Review active={activeDocument} documents={documents} onOpen={openDocument} request={request} setActive={setActiveDocument} setNotice={setNotice} />}
          {page === 'impact' && <Impact state={state} request={request} setState={setState} setNotice={setNotice} />}
          {page === 'obligations' && <Obligations state={state} />}
          {page === 'decisions' && <Decisions state={state} request={request} setState={setState} setNotice={setNotice} />}
          {page === 'execution' && <Execution state={state} request={request} setState={setState} setNotice={setNotice} />}
          {page === 'twin' && <Twin state={state} />}
          {page === 'packs' && <Packs state={state} />}
          {page === 'reports' && <Reports state={state} documents={documents} request={request} setNotice={setNotice} />}
          {page === 'ask' && <AskSynesis state={state} active={activeDocument} request={request} />}
          {page === 'simulations' && <Simulations state={state} request={request} setState={setState} setNotice={setNotice} />}
          {page === 'admin' && <ControlTower state={state} user={user} request={request} />}
        </section>
      </main>

      {uploadOpen && <UploadModal request={request} onClose={() => setUploadOpen(false)} onComplete={({ document, state: next }) => { setState(next); setDocuments(current => [document, ...current]); setActiveDocument(document); setUploadOpen(false); setPage('review'); setNotice({ type: 'success', message: `${document.title} was analysed and compiled into the Institutional Twin.` }); }} />}
    </div>
  );
}