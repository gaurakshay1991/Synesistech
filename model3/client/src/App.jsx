import { useEffect, useState } from 'react';
import {
  BarChart3, BellRing, BookOpenCheck, BrainCircuit, CheckCircle2, ClipboardCheck,
  FilePlus2, FileSearch2, Gavel, Globe2, LayoutDashboard, LibraryBig, ListChecks,
  LogOut, Menu, MessageSquareText, Network, Scale, Settings2, ShieldCheck,
  UploadCloud, X, Zap
} from 'lucide-react';
import { Login, PasswordSetup, Home, MyWork, Documents, Review } from './screens-core.jsx';
import { Impact, Obligations, Decisions, Execution } from './screens-control.jsx';
import { Twin, Packs, Reports, AskSynesis } from './screens-intelligence.jsx';
import { Simulations, ControlTower, UploadModal } from './screens-strategy.jsx';
import { RegulatoryRadar, ClauseMemory, LitigationLab, GovernanceHub, VentureStudio } from './screens-neurosymbolic.jsx';
import { LiveBrain } from './screens-livebrain.jsx';
import { NeuroConsole } from './screens-neuroconsole.jsx';

const API = import.meta.env.VITE_API_URL || '/api';
const nav = [
  ['neuro', 'Neuro Console', BrainCircuit],
  ['home', 'Command Centre', LayoutDashboard], ['work', 'My Work', ListChecks],
  ['documents', 'Intake & Documents', FilePlus2], ['review', 'Review Centre', FileSearch2],
  ['livebrain', 'Live Legal Brain', BrainCircuit], ['regulatory', 'Regulatory Radar', Globe2], ['memory', 'Clause Memory Graph', BookOpenCheck],
  ['litigation', 'Litigation Lab', Gavel], ['governance', 'AI & ESG Governance', ShieldCheck],
  ['impact', 'Regulatory Impact', Globe2], ['obligations', 'Obligations & Controls', ClipboardCheck],
  ['decisions', 'Decisions & Approvals', Scale], ['execution', 'Execution & Evidence', CheckCircle2],
  ['twin', 'Institutional Twin', Network], ['packs', 'Solution Packs', LibraryBig],
  ['simulations', 'Strategy & Simulations', BrainCircuit], ['venture', 'Product & Venture Studio', BarChart3],
  ['reports', 'Reports & KPIs', BarChart3], ['ask', 'Ask Synesis', MessageSquareText],
  ['admin', 'AI Control Tower', Settings2]
];
const navKeys = new Set(nav.map(item => item[0]));

function initialPage() {
  const requested = new URLSearchParams(window.location.search).get('page');
  return navKeys.has(requested) ? requested : 'neuro';
}

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
  try { data = text ? JSON.parse(text) : {}; }
  catch {
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

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(initialPage);
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
    setState(data.state); setDocuments(data.documents); setUser(data.user);
  }

  useEffect(() => {
    request('/auth/session').then(data => {
      setUser(data.user);
      if (!data.user.mustChangePassword) return bootstrap();
    }).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const id = setTimeout(() => setNotice(null), 6500);
    return () => clearTimeout(id);
  }, [notice]);

  async function logout() {
    try { await request('/auth/logout', { method: 'POST', body: '{}' }); } catch {}
    setUser(null); setState(null); setDocuments([]); setActiveDocument(null);
  }

  function openPage(key) {
    const next = navKeys.has(key) ? key : 'neuro';
    setPage(next); setMobile(false);
    const url = new URL(window.location.href);
    url.searchParams.set('page', next);
    window.history.replaceState({}, '', url);
  }

  async function openDocument(id) {
    const data = await request(`/documents/${id}`);
    setActiveDocument(data.document);
    openPage('review');
  }

  if (loading) return <div className="splash"><div className="brand-mark"><Zap size={26} /></div><h1>SYNESIS</h1><p>Loading neuro-symbolic legal intelligence…</p></div>;
  if (!user) return <Login request={request} onLogin={async next => { setUser(next); if (!next.mustChangePassword) await bootstrap(); }} />;
  if (user.mustChangePassword) return <PasswordSetup user={user} request={request} onDone={async next => { setUser(next); await bootstrap(); }} onLogout={logout} />;
  if (!state) return <div className="splash"><Zap /><p>Building your legal intelligence command centre…</p></div>;

  const pageTitle = nav.find(item => item[0] === page)?.[1] || 'Synesis';
  const common = { state, request, setState, setNotice };
  return <div className="app-shell">
    <aside className={`sidebar ${mobile ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Zap size={22} /></div><div><strong>SYNESIS</strong><span>NEURO INTELLIGENCE v7</span></div><button className="icon mobile-only" onClick={() => setMobile(false)}><X /></button></div>
      <div className="category">Legal · Regulatory · Risk · Decision Intelligence</div>
      <nav>{nav.map(([key, label, Icon]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => openPage(key)}><Icon size={18} /><span>{label}</span>{key === 'work' && state.metrics.attention > 0 && <b>{state.metrics.attention}</b>}</button>)}</nav>
      <div className="sidebar-foot"><div className="user-mini"><div>{user.name?.slice(0, 1)}</div><span><strong>{user.name}</strong><small>{user.role}</small></span></div><button className="icon" onClick={logout} title="Log out"><LogOut size={18} /></button></div>
    </aside>
    {mobile && <div className="scrim" onClick={() => setMobile(false)} />}
    <main className="main">
      <header className="topbar"><button className="icon mobile-only" onClick={() => setMobile(true)}><Menu /></button><div><small>Evidence-scoped, current-law, governed intelligence</small><h1>{pageTitle}</h1></div><div className="top-actions"><button className="ghost" onClick={() => setUploadOpen(true)}><UploadCloud size={17} /> Analyse document</button><button className="primary" onClick={() => openPage('work')}><BellRing size={17} /> Attention queue <b>{state.metrics.attention}</b></button></div></header>
      {notice && <div className={`notice ${notice.type || 'info'}`}>{notice.message}<button onClick={() => setNotice(null)}><X size={16} /></button></div>}
      <section className="page">
        {page === 'neuro' && <NeuroConsole {...common} documents={documents} activeDocument={activeDocument} onOpenDocument={openDocument} onUpload={() => setUploadOpen(true)} openPage={openPage} />}
        {page === 'home' && <Home state={state} openPage={openPage} />}
        {page === 'work' && <MyWork {...common} />}
        {page === 'documents' && <Documents documents={documents} onOpen={openDocument} onUpload={() => setUploadOpen(true)} />}
        {page === 'review' && <Review active={activeDocument} documents={documents} onOpen={openDocument} request={request} setActive={setActiveDocument} setNotice={setNotice} />}
        {page === 'livebrain' && <LiveBrain {...common} documents={documents} activeDocument={activeDocument} onOpenDocument={openDocument} />}
        {page === 'regulatory' && <RegulatoryRadar {...common} />}
        {page === 'memory' && <ClauseMemory {...common} />}
        {page === 'litigation' && <LitigationLab {...common} />}
        {page === 'governance' && <GovernanceHub {...common} />}
        {page === 'impact' && <Impact {...common} />}
        {page === 'obligations' && <Obligations state={state} />}
        {page === 'decisions' && <Decisions {...common} />}
        {page === 'execution' && <Execution {...common} />}
        {page === 'twin' && <Twin state={state} />}
        {page === 'packs' && <Packs state={state} />}
        {page === 'simulations' && <Simulations {...common} />}
        {page === 'venture' && <VentureStudio {...common} />}
        {page === 'reports' && <Reports state={state} documents={documents} request={request} setNotice={setNotice} />}
        {page === 'ask' && <AskSynesis state={state} active={activeDocument} request={request} />}
        {page === 'admin' && <ControlTower state={state} user={user} request={request} />}
      </section>
    </main>
    {uploadOpen && <UploadModal request={request} onClose={() => setUploadOpen(false)} onComplete={({ document, state: next }) => {
      setState(next);
      setDocuments(current => [document, ...current.filter(item => item.id !== document.id)]);
      setActiveDocument(document);
      setUploadOpen(false);
      openPage('neuro');
      setNotice({ type: 'success', message: `${document.title} was independently analysed, checked against current law where available, and added as the active matter.` });
    }} />}
  </div>;
}
