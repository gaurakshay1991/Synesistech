import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDot,
  Copy,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Files,
  GitCompareArrows,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  MessageSquareText,
  Printer,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  UserPlus,
  Users,
  X
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';
const ROLE_LABELS = {
  admin: 'Administrator',
  legal: 'Legal',
  compliance: 'Compliance',
  kyc: 'KYC / AML',
  management: 'Management',
  risk: 'Risk',
  business: 'Business'
};

const REVIEW_TABS = [
  ['overview', 'Overview'],
  ['issues', 'Issues'],
  ['missing', 'Missing protections'],
  ['scenarios', 'Scenarios'],
  ['regulatory', 'Regulatory'],
  ['assistant', 'Ask Synesis'],
  ['report', 'Report']
];

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatSize(bytes = 0) {
  if (!bytes) return 'Text entry';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function riskTone(value = 'Low') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function safeFilename(value = 'LIVE-SYNESIS') {
  return value.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function download(name, value, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function readResponse(response) {
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Unexpected server response.' };
  }
  if (!response.ok) {
    const error = new Error(data.error || data.detail || 'Request failed.');
    error.status = response.status;
    error.requestId = data.requestId;
    throw error;
  }
  return data;
}

function reportText(document) {
  const analysis = document?.analysis || {};
  const lines = [
    'LIVE SYNESIS — DECISION REPORT',
    '',
    `Document: ${document.title}`,
    `Matter: ${document.matter}`,
    `Document type: ${document.documentType}`,
    `Jurisdiction: ${document.jurisdiction}`,
    `Status: ${document.status}`,
    `Overall risk: ${analysis.overall_risk} (${analysis.overall_score}/100)`,
    `Recommended decision: ${analysis.recommended_decision}`,
    `Analysis engine: ${analysis.engine}`,
    '',
    'EXECUTIVE POSITION',
    analysis.executive_position || '',
    '',
    'SUMMARY',
    analysis.document_summary || '',
    '',
    'ISSUES'
  ];
  (analysis.findings || []).forEach((finding, index) => {
    lines.push(
      '',
      `${index + 1}. [${finding.risk_level}] ${finding.issue}`,
      `Reference: ${finding.clause_reference}`,
      `Evidence: ${finding.quoted_text}`,
      `Why it matters: ${finding.why_risky_for_bank}`,
      `How it may occur: ${finding.how_risk_may_materialise}`,
      `Mitigation: ${finding.recommended_mitigation}`,
      `Suggested language: ${finding.suggested_rewrite}`,
      `Owners: ${(finding.review_owner || []).join(', ')}`
    );
  });
  lines.push('', 'MISSING PROTECTIONS');
  (analysis.missing_clauses || []).forEach(item => {
    lines.push('', `[${item.risk_level}] ${item.clause}`, item.why_needed, item.recommended_language);
  });
  lines.push('', 'REGULATORY TOUCHPOINTS');
  (analysis.regulatory_touchpoints || []).forEach(item => {
    lines.push('', item.area, item.relevance, `Action: ${item.action}`);
  });
  lines.push('', 'ASSUMPTIONS AND LIMITATIONS');
  (analysis.assumptions_and_limits || []).forEach(item => lines.push(`- ${item}`));
  return lines.join('\n');
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState('home');
  const [documents, setDocuments] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [active, setActive] = useState(null);
  const [audit, setAudit] = useState([]);
  const [users, setUsers] = useState([]);
  const [notice, setNotice] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers
      }
    });
    try {
      return await readResponse(response);
    } catch (error) {
      if (error.status === 401) setUser(null);
      throw error;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [documentData, dashboardData] = await Promise.all([
      request('/documents?limit=200'),
      request('/dashboard')
    ]);
    setDocuments(documentData.documents);
    setMetrics(dashboardData);
    setActive(current => {
      if (!current) {
        const savedId = sessionStorage.getItem('synesis-active-document');
        return documentData.documents.find(item => item.id === savedId) || null;
      }
      return documentData.documents.find(item => item.id === current.id) || current;
    });
  }, [request, user]);

  useEffect(() => {
    request('/auth/session')
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, [request]);

  useEffect(() => {
    if (!user) return;
    refresh().catch(error => setNotice({ type: 'error', message: error.message }));
  }, [user, refresh]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6500);
    return () => clearTimeout(timer);
  }, [notice]);

  function openDocument(document, tab = 'overview') {
    setActive({ ...document, preferredTab: tab });
    sessionStorage.setItem('synesis-active-document', document.id);
    setPage('review');
    setMobileNav(false);
  }

  async function loadAdmin() {
    if (user?.role !== 'admin') return;
    const [auditData, userData] = await Promise.all([
      request('/admin/audit?limit=400'),
      request('/admin/users')
    ]);
    setAudit(auditData.audit);
    setUsers(userData.users);
  }

  async function logout() {
    try {
      await request('/auth/logout', { method: 'POST', body: '{}' });
    } catch {
      // The local session is cleared even if the server is already unavailable.
    }
    sessionStorage.removeItem('synesis-active-document');
    setUser(null);
    setActive(null);
  }

  if (authLoading) return <LoadingScreen />;
  if (!user) return <Login onLogin={setUser} />;
  if (user.mustChangePassword) {
    return (
      <PasswordSetup
        user={user}
        request={request}
        logout={logout}
        completed={() => setUser(current => ({ ...current, mustChangePassword: false }))}
      />
    );
  }

  const navigate = next => {
    setPage(next);
    setMobileNav(false);
    if (next === 'admin') {
      loadAdmin().catch(error => setNotice({ type: 'error', message: error.message }));
    }
  };

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        page={page}
        navigate={navigate}
        open={mobileNav}
        close={() => setMobileNav(false)}
        logout={logout}
      />
      <div className="app-main">
        <Topbar
          user={user}
          page={page}
          active={active}
          openMenu={() => setMobileNav(true)}
          navigate={navigate}
        />
        {notice && (
          <button className={`toast ${notice.type || 'info'}`} onClick={() => setNotice(null)}>
            {notice.type === 'error' ? <CircleAlert size={18} /> : <CircleCheck size={18} />}
            <span>{notice.message}</span>
            <X size={16} />
          </button>
        )}
        <main className="page-wrap">
          {page === 'home' && (
            <Dashboard
              user={user}
              metrics={metrics}
              documents={documents}
              navigate={navigate}
              openDocument={openDocument}
            />
          )}
          {page === 'new' && (
            <NewReview
              user={user}
              onComplete={document => {
                setNotice({ type: 'success', message: 'Live document analysis completed and saved.' });
                refresh();
                openDocument(document);
              }}
              onError={message => setNotice({ type: 'error', message })}
            />
          )}
          {page === 'documents' && (
            <DocumentsPage
              documents={documents}
              openDocument={openDocument}
              navigate={navigate}
            />
          )}
          {page === 'review' && (
            <ReviewWorkspace
              active={active}
              role={user.role}
              documents={documents}
              request={request}
              refresh={refresh}
              openDocument={openDocument}
              navigate={navigate}
              setNotice={setNotice}
              clearActive={() => {
                setActive(null);
                sessionStorage.removeItem('synesis-active-document');
              }}
            />
          )}
          {page === 'compare' && <Comparison documents={documents} request={request} />}
          {page === 'admin' && user.role === 'admin' && (
            <Administration
              users={users}
              audit={audit}
              request={request}
              reload={loadAdmin}
              setNotice={setNotice}
            />
          )}
          {page === 'settings' && (
            <ProfileSettings user={user} request={request} setNotice={setNotice} />
          )}
        </main>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="brand-glyph large">S</div>
      <div className="pulse-line" />
      <p>Opening your secure workspace…</p>
    </div>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await readResponse(response);
      onLogin(data.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-layout">
      <section className="login-story">
        <div className="login-brand">
          <span className="brand-glyph">S</span>
          <div>
            <strong>LIVE SYNESIS</strong>
            <small>Legal & Compliance Intelligence</small>
          </div>
        </div>
        <div className="story-copy">
          <span className="eyebrow light">DOCUMENT-FIRST REVIEW</span>
          <h1>From uploaded agreement to decision-ready advice.</h1>
          <p>
            Evidence-linked risks, Bank-specific reasoning, protective drafting,
            scenario testing and institutional memory—inside one controlled workflow.
          </p>
          <div className="story-points">
            <div><ShieldCheck size={20} /><span>Private, role-controlled workspace</span></div>
            <div><Sparkles size={20} /><span>Live analysis of every new document</span></div>
            <div><Activity size={20} /><span>Complete decisions and audit history</span></div>
          </div>
        </div>
        <small className="story-foot">Built for banks and regulated institutions</small>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="login-lock"><LockKeyhole size={22} /></div>
          <span className="eyebrow">PRIVATE ACCESS</span>
          <h2>Sign in to your workspace</h2>
          <p>Use your institutional LIVE SYNESIS account.</p>
          <label>
            Work email
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="name@organisation.com"
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <div className="form-error"><AlertTriangle size={17} />{error}</div>}
          <button className="button primary wide" disabled={busy}>
            {busy ? <><RefreshCw className="spin" size={18} />Signing in…</> : <>Sign in<ArrowRight size={18} /></>}
          </button>
          <div className="security-note">
            <Shield size={16} />
            <span>Sessions are secure and activity is auditable.</span>
          </div>
        </form>
      </section>
    </div>
  );
}

function Sidebar({ user, page, navigate, open, close, logout }) {
  const items = [
    ['home', 'Command centre', LayoutDashboard],
    ['new', 'New review', FilePlus2],
    ['documents', 'Documents', Files],
    ['compare', 'Compare', GitCompareArrows]
  ];
  if (user.role === 'admin') items.push(['admin', 'Administration', Users]);
  items.push(['settings', 'Settings', Settings]);
  return (
    <>
      {open && <button className="nav-scrim" aria-label="Close menu" onClick={close} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-glyph">S</span>
          <div><strong>LIVE SYNESIS</strong><small>Enterprise workspace</small></div>
          <button className="icon-button mobile-only" onClick={close}><X size={20} /></button>
        </div>
        <div className="organisation-chip">
          <Building2 size={17} />
          <span><small>ORGANISATION</small><strong>{user.organizationName || 'Synesis'}</strong></span>
        </div>
        <nav className="side-nav">
          <small className="nav-label">WORKSPACE</small>
          {items.map(([key, label, Icon]) => (
            <button key={key} className={page === key ? 'active' : ''} onClick={() => navigate(key)}>
              <Icon size={19} />
              <span>{label}</span>
              {page === key && <ChevronRight size={16} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="signed-user">
            <span className="avatar">{(user.name || user.email).slice(0, 1).toUpperCase()}</span>
            <span><strong>{user.name || user.email}</strong><small>{ROLE_LABELS[user.role] || user.role}</small></span>
          </div>
          <button className="logout-button" onClick={logout}><KeyRound size={17} />Sign out</button>
        </div>
      </aside>
    </>
  );
}

function Topbar({ page, active, openMenu, navigate }) {
  const titles = {
    home: ['Command centre', 'Your matters, priorities and recent decisions'],
    new: ['New document review', 'Upload once. Review from evidence.'],
    documents: ['Document library', 'Search every saved review and decision'],
    review: [active?.title || 'Review workspace', active ? `${active.matter} · ${active.documentType}` : 'Select a document'],
    compare: ['Compare documents', 'See material risk movement side by side'],
    admin: ['Administration', 'Users, roles and complete activity history'],
    settings: ['Account settings', 'Security and profile preferences']
  };
  const [title, subtitle] = titles[page] || titles.home;
  return (
    <header className="topbar">
      <button className="icon-button menu-button" onClick={openMenu}><Menu size={22} /></button>
      <div><h1>{title}</h1><p>{subtitle}</p></div>
      <button className="button primary compact" onClick={() => navigate('new')}>
        <FilePlus2 size={17} />New review
      </button>
    </header>
  );
}

function Dashboard({ user, metrics, documents, navigate, openDocument }) {
  const firstName = (user.name || 'there').split(' ')[0];
  const priority = documents
    .filter(item => item.analysis?.overall_risk === 'High')
    .slice(0, 4);
  return (
    <div className="stack page-enter">
      <section className="welcome-card">
        <div>
          <span className="eyebrow light">GOOD TO SEE YOU, {firstName.toUpperCase()}</span>
          <h2>What needs a decision today?</h2>
          <p>Start with a document. LIVE SYNESIS turns its actual language into a review path your teams can act on.</p>
          <div className="welcome-actions">
            <button className="button white" onClick={() => navigate('new')}><UploadCloud size={18} />Upload & analyse</button>
            <button className="button ghost-light" onClick={() => navigate('documents')}>Open library<ArrowRight size={17} /></button>
          </div>
        </div>
        <div className="welcome-visual">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <span><Sparkles size={32} /></span>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard label="Documents reviewed" value={metrics?.totalDocuments || 0} icon={Files} tone="blue" />
        <MetricCard label="High-risk matters" value={metrics?.highRisk || 0} icon={AlertTriangle} tone="red" />
        <MetricCard label="Open decisions" value={metrics?.open || 0} icon={CircleDot} tone="amber" />
        <MetricCard label="Issues identified" value={metrics?.totalFindings || 0} icon={ShieldCheck} tone="green" />
      </section>

      <div className="dashboard-grid">
        <section className="card">
          <CardHeader
            title="Priority review"
            subtitle="High-risk documents requiring attention"
            action={<button className="text-button" onClick={() => navigate('documents')}>View all<ArrowRight size={15} /></button>}
          />
          <div className="priority-list">
            {priority.length ? priority.map(document => (
              <button key={document.id} className="priority-row" onClick={() => openDocument(document, 'issues')}>
                <RiskScore score={document.analysis?.overall_score} risk={document.analysis?.overall_risk} compact />
                <span className="grow"><strong>{document.title}</strong><small>{document.matter} · {document.analysis?.findings?.length || 0} issues</small></span>
                <StatusBadge value={document.status} />
                <ChevronRight size={18} />
              </button>
            )) : <EmptyState icon={CheckCircle2} title="No high-risk matters" text="Your priority queue is currently clear." />}
          </div>
        </section>
        <section className="card quick-start">
          <CardHeader title="Review in three steps" subtitle="A simpler path from file to decision" />
          <div className="step-list">
            <div><span>1</span><p><strong>Upload the agreement</strong><small>PDF, DOCX or text becomes the source of truth.</small></p></div>
            <div><span>2</span><p><strong>Resolve material issues</strong><small>Work from evidence, impact and protective language.</small></p></div>
            <div><span>3</span><p><strong>Record the decision</strong><small>Save controls, approvals and the final report.</small></p></div>
          </div>
          <button className="button secondary wide" onClick={() => navigate('new')}>Start a review<ArrowRight size={17} /></button>
        </section>
      </div>

      <section className="card">
        <CardHeader
          title="Recently reviewed"
          subtitle="Continue where your team left off"
          action={<button className="text-button" onClick={() => navigate('documents')}>Document library<ArrowRight size={15} /></button>}
        />
        <DocumentTable documents={documents.slice(0, 6)} openDocument={openDocument} />
      </section>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, tone }) {
  return (
    <div className="metric-card">
      <span className={`metric-icon ${tone}`}><Icon size={20} /></span>
      <div><strong>{value}</strong><small>{label}</small></div>
      <BarChart3 className="metric-watermark" size={42} />
    </div>
  );
}

function NewReview({ onComplete, onError }) {
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [form, setForm] = useState({
    title: '',
    matter: 'Vendor onboarding',
    documentType: 'Auto-detect',
    jurisdiction: 'India',
    riskAppetite: 'Conservative'
  });

  function choose(selected) {
    if (!selected) return;
    const allowed = /\.(pdf|docx|txt|csv|json|md|xml)$/i.test(selected.name);
    if (!allowed) return onError('Use PDF, DOCX, TXT, CSV, JSON, Markdown or XML.');
    setFile(selected);
    if (!form.title) setForm(current => ({ ...current, title: selected.name.replace(/\.[^.]+$/, '') }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!file && text.trim().length < 20) return onError('Upload a document or paste enough document text.');
    setBusy(true);
    setPhase(1);
    const timer = setInterval(() => setPhase(current => Math.min(3, current + 1)), 2600);
    try {
      const body = new FormData();
      if (file) body.append('file', file);
      body.append('text', text);
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      const response = await fetch(`${API}/documents/analyze`, {
        method: 'POST',
        credentials: 'include',
        body
      });
      const data = await readResponse(response);
      setPhase(4);
      onComplete(data.document);
    } catch (error) {
      onError(error.message);
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  }

  return (
    <div className="new-review-layout page-enter">
      <form className="card review-form" onSubmit={submit}>
        <CardHeader title="1. Add the document" subtitle="The uploaded content controls every finding, scenario and answer." />
        <div
          className={`drop-zone ${dragging ? 'dragging' : ''} ${file ? 'selected' : ''}`}
          onDragOver={event => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={event => {
            event.preventDefault();
            setDragging(false);
            choose(event.dataTransfer.files?.[0]);
          }}
        >
          <input id="synesis-document-file" type="file" accept=".pdf,.docx,.txt,.csv,.json,.md,.xml" onChange={event => choose(event.target.files?.[0])} />
          <label htmlFor="synesis-document-file">
            {file ? (
              <>
                <span className="file-icon"><FileText size={27} /></span>
                <div><strong>{file.name}</strong><small>{formatSize(file.size)} · Ready for secure analysis</small></div>
              </>
            ) : (
              <>
                <span className="upload-icon"><UploadCloud size={30} /></span>
                <strong>Drop your document here</strong>
                <p>or click to choose a file</p>
                <small>PDF, DOCX, TXT, CSV, JSON, MD or XML · up to 15 MB</small>
              </>
            )}
          </label>
          {file && <button type="button" aria-label="Remove selected file" className="icon-button" onClick={() => setFile(null)}><X size={18} /></button>}
        </div>
        <div className="or-divider"><span>OR PASTE TEXT</span></div>
        <label>
          Document text
          <textarea value={text} onChange={event => setText(event.target.value)} rows={7} placeholder="Paste the agreement or clause text here…" />
        </label>

        <CardHeader title="2. Give the review context" subtitle="A little context improves classification without overriding the document." />
        <div className="form-grid">
          <label>
            Review title
            <input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="e.g. Cloud Services Agreement" />
          </label>
          <label>
            Matter / transaction
            <input value={form.matter} onChange={event => setForm({ ...form, matter: event.target.value })} />
          </label>
          <label>
            Document type
            <select value={form.documentType} onChange={event => setForm({ ...form, documentType: event.target.value })}>
              <option>Auto-detect</option>
              <option>Vendor / Outsourcing Agreement</option>
              <option>NDA / Confidentiality Agreement</option>
              <option>Finance Agreement</option>
              <option>Technology / SaaS Agreement</option>
              <option>Data Processing Agreement</option>
              <option>Referral / Distribution Agreement</option>
              <option>Commercial Agreement</option>
            </select>
          </label>
          <label>
            Jurisdiction
            <select value={form.jurisdiction} onChange={event => setForm({ ...form, jurisdiction: event.target.value })}>
              <option>India</option><option>India / Cross-border</option><option>Multi-jurisdiction</option><option>Other</option>
            </select>
          </label>
          <label>
            Risk appetite
            <select value={form.riskAppetite} onChange={event => setForm({ ...form, riskAppetite: event.target.value })}>
              <option>Conservative</option><option>Balanced</option><option>Commercial</option>
            </select>
          </label>
        </div>
        <button className="button primary wide large" disabled={busy}>
          {busy ? <><RefreshCw className="spin" size={19} />Analysing the actual document…</> : <><Sparkles size={19} />Run live review</>}
        </button>
      </form>
      <aside className="analysis-guide">
        <div className="guide-card">
          <span className="guide-icon"><ShieldCheck size={24} /></span>
          <h3>What LIVE SYNESIS will produce</h3>
          <ul>
            <li><CheckCircle2 size={16} />Clause-linked issues and risk scores</li>
            <li><CheckCircle2 size={16} />Why each issue matters to the Bank</li>
            <li><CheckCircle2 size={16} />Legal, regulatory and operational impact</li>
            <li><CheckCircle2 size={16} />Mitigation and protective drafting</li>
            <li><CheckCircle2 size={16} />Missing clauses and contradictions</li>
            <li><CheckCircle2 size={16} />Document-grounded scenarios and report</li>
          </ul>
        </div>
        {busy && (
          <div className="guide-card analysis-progress">
            <span className="eyebrow">LIVE REVIEW</span>
            {['Securely receiving file', 'Extracting document text', 'Analysing clauses and gaps', 'Saving the decision record'].map((item, index) => (
              <div key={item} className={phase > index ? 'done' : phase === index ? 'current' : ''}>
                <span>{phase > index ? <CheckCircle2 size={16} /> : <CircleDot size={16} />}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        )}
        <div className="privacy-card">
          <LockKeyhole size={19} />
          <div><strong>Private by design</strong><p>Source text is encrypted before persistence. Original files are not retained by the application.</p></div>
        </div>
      </aside>
    </div>
  );
}

function DocumentsPage({ documents, openDocument, navigate }) {
  const [query, setQuery] = useState('');
  const [risk, setRisk] = useState('All');
  const filtered = useMemo(() => documents.filter(document => {
    const matchesText = !query || [document.title, document.matter, document.documentType, document.originalFileName]
      .join(' ').toLowerCase().includes(query.toLowerCase());
    const matchesRisk = risk === 'All' || document.analysis?.overall_risk === risk;
    return matchesText && matchesRisk;
  }), [documents, query, risk]);
  return (
    <div className="stack page-enter">
      <section className="library-banner">
        <div><span className="eyebrow">INSTITUTIONAL MEMORY</span><h2>Every review stays useful.</h2><p>Find the document, reopen its exact analysis and continue the decision trail.</p></div>
        <button className="button primary" onClick={() => navigate('new')}><FilePlus2 size={18} />New review</button>
      </section>
      <section className="card">
        <div className="library-tools">
          <label className="search-field"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title, matter, type or filename…" /></label>
          <div className="segmented">
            {['All', 'High', 'Medium', 'Low'].map(value => (
              <button key={value} className={risk === value ? 'active' : ''} onClick={() => setRisk(value)}>{value}</button>
            ))}
          </div>
          <span className="result-count">{filtered.length} document{filtered.length === 1 ? '' : 's'}</span>
        </div>
        <DocumentTable documents={filtered} openDocument={openDocument} emptyText="No documents match these filters." />
      </section>
    </div>
  );
}

function DocumentTable({ documents, openDocument, emptyText = 'No documents reviewed yet.' }) {
  if (!documents.length) return <EmptyState icon={Files} title={emptyText} text="Start a live review to create the first decision record." />;
  return (
    <div className="document-table">
      <div className="document-row table-head"><span>Document</span><span>Risk</span><span>Status</span><span>Updated</span><span /></div>
      {documents.map(document => (
        <button className="document-row" key={document.id} onClick={() => openDocument(document)}>
          <span className="document-name">
            <span className="doc-icon"><FileText size={19} /></span>
            <span><strong>{document.title}</strong><small>{document.matter} · {document.documentType}</small></span>
          </span>
          <span><RiskPill risk={document.analysis?.overall_risk} score={document.analysis?.overall_score} /></span>
          <span><StatusBadge value={document.status} /></span>
          <span className="muted">{formatDate(document.updatedAt)}</span>
          <ChevronRight size={18} />
        </button>
      ))}
    </div>
  );
}

function ReviewWorkspace({ active, role, documents, request, refresh, openDocument, navigate, setNotice, clearActive }) {
  const [tab, setTab] = useState(active?.preferredTab || 'overview');
  const [decisionFinding, setDecisionFinding] = useState(null);
  const [reanalyzing, setReanalyzing] = useState(false);

  useEffect(() => {
    setTab(active?.preferredTab || 'overview');
  }, [active?.id, active?.preferredTab]);

  if (!active) {
    return (
      <section className="card document-picker page-enter">
        <EmptyState icon={Eye} title="Choose a document to review" text="Open a saved review or start with a new upload." />
        <div className="picker-grid">
          {documents.slice(0, 8).map(document => (
            <button key={document.id} onClick={() => openDocument(document)}>
              <FileText size={20} /><span><strong>{document.title}</strong><small>{document.matter}</small></span><RiskPill risk={document.analysis?.overall_risk} score={document.analysis?.overall_score} />
            </button>
          ))}
        </div>
        <button className="button primary" onClick={() => navigate('new')}>Start a new review</button>
      </section>
    );
  }

  const analysis = active.analysis || {};
  const canModify = ['admin', 'legal', 'compliance', 'kyc', 'risk'].includes(role);

  async function reanalyze() {
    setReanalyzing(true);
    try {
      const data = await request(`/documents/${active.id}/reanalyze`, { method: 'POST', body: '{}' });
      await refresh();
      openDocument(data.document);
      setNotice({ type: 'success', message: 'The document was reanalysed from its encrypted source text.' });
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setReanalyzing(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${active.title}” from the active library? The audit event will be retained.`)) return;
    try {
      await request(`/documents/${active.id}`, { method: 'DELETE' });
      clearActive();
      await refresh();
      navigate('documents');
      setNotice({ type: 'success', message: 'Document removed from the active library.' });
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    }
  }

  return (
    <div className="stack page-enter">
      <section className="review-hero">
        <RiskScore risk={analysis.overall_risk} score={analysis.overall_score} />
        <div className="review-hero-copy">
          <div className="review-kickers"><RiskPill risk={analysis.overall_risk} /><StatusBadge value={active.status} /><span>{analysis.engine === 'openai-structured-output' ? 'Live AI analysis' : 'Baseline analysis'}</span></div>
          <h2>{active.title}</h2>
          <p>{analysis.document_summary}</p>
          <div className="metadata-row">
            <span><strong>Matter</strong>{active.matter}</span>
            <span><strong>Type</strong>{active.documentType}</span>
            <span><strong>Jurisdiction</strong>{active.jurisdiction}</span>
            <span><strong>Reviewed</strong>{formatDate(active.updatedAt)}</span>
          </div>
        </div>
        <div className="review-actions">
          {canModify && <button className="button secondary" onClick={reanalyze} disabled={reanalyzing}><RefreshCw className={reanalyzing ? 'spin' : ''} size={17} />Reanalyse</button>}
          {['admin', 'legal'].includes(role) && <button className="icon-button danger" onClick={remove} title="Delete document"><Trash2 size={18} /></button>}
        </div>
      </section>

      <div className="review-tabs" role="tablist">
        {REVIEW_TABS.map(([key, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {label}
            {key === 'issues' && <span>{analysis.findings?.length || 0}</span>}
            {key === 'missing' && <span>{analysis.missing_clauses?.length || 0}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview active={active} setTab={setTab} />}
      {tab === 'issues' && <Issues active={active} onDecision={setDecisionFinding} />}
      {tab === 'missing' && <MissingProtections active={active} />}
      {tab === 'scenarios' && <Scenarios active={active} />}
      {tab === 'regulatory' && <Regulatory active={active} />}
      {tab === 'assistant' && <Assistant active={active} request={request} />}
      {tab === 'report' && <Report active={active} />}

      {decisionFinding && (
        <DecisionModal
          active={active}
          finding={decisionFinding}
          request={request}
          close={() => setDecisionFinding(null)}
          saved={async document => {
            setDecisionFinding(null);
            await refresh();
            openDocument(document, 'issues');
            setNotice({ type: 'success', message: 'Review decision saved to the audit trail.' });
          }}
        />
      )}
    </div>
  );
}

function Overview({ active, setTab }) {
  const analysis = active.analysis || {};
  const high = (analysis.findings || []).filter(item => item.risk_level === 'High').length;
  const medium = (analysis.findings || []).filter(item => item.risk_level === 'Medium').length;
  return (
    <div className="overview-grid">
      <section className="card executive-card">
        <span className="eyebrow">EXECUTIVE POSITION</span>
        <h3>{analysis.recommended_decision}</h3>
        <p>{analysis.executive_position}</p>
        <div className="decision-strip">
          <span><AlertTriangle size={18} /><strong>{high}</strong> high</span>
          <span><CircleAlert size={18} /><strong>{medium}</strong> medium</span>
          <span><ShieldCheck size={18} /><strong>{analysis.missing_clauses?.length || 0}</strong> missing protections</span>
        </div>
        <button className="button primary" onClick={() => setTab('issues')}>Review material issues<ArrowRight size={17} /></button>
      </section>
      <section className="card">
        <CardHeader title="Review coverage" subtitle="What was assessed from this document" />
        <div className="coverage-list">
          {[
            ['Clause-level risks', analysis.findings?.length || 0],
            ['Missing protections', analysis.missing_clauses?.length || 0],
            ['Contradictions', analysis.contradictions?.length || 0],
            ['Regulatory touchpoints', analysis.regulatory_touchpoints?.length || 0],
            ['Scenario tests', analysis.scenario_tests?.length || 0]
          ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div>
      </section>
      <section className="card full-span">
        <CardHeader title="Recorded decisions" subtitle="Actions, escalations and accepted controls for this document" />
        <div className="decision-history">
          {active.decisions?.length ? active.decisions.map(item => (
            <div key={item.id}><span className="timeline-dot" /><div><strong>{item.status}</strong><p>{item.comment || 'No comment recorded.'}</p><small>{item.user} · {formatDate(item.at)}</small></div></div>
          )) : <EmptyState icon={Activity} title="No decisions recorded yet" text="Use an issue’s “Record decision” action to begin the review trail." />}
        </div>
      </section>
    </div>
  );
}

function Issues({ active, onDecision }) {
  const findings = active.analysis?.findings || [];
  const [severity, setSeverity] = useState('All');
  const [expanded, setExpanded] = useState(findings[0]?.id || null);
  const filtered = findings.filter(item => severity === 'All' || item.risk_level === severity);
  return (
    <section className="card issue-panel">
      <div className="section-toolbar">
        <div><h3>Clause-level issues</h3><p>Every issue is anchored to evidence from the active document.</p></div>
        <div className="segmented">
          {['All', 'High', 'Medium', 'Low'].map(value => <button key={value} className={severity === value ? 'active' : ''} onClick={() => setSeverity(value)}>{value}</button>)}
        </div>
      </div>
      <div className="issue-list">
        {filtered.length ? filtered.map((finding, index) => (
          <article key={finding.id} className={`finding-card ${riskTone(finding.risk_level)}`}>
            <button className="finding-summary" onClick={() => setExpanded(expanded === finding.id ? null : finding.id)}>
              <span className="finding-number">{String(index + 1).padStart(2, '0')}</span>
              <span className="grow"><small>{finding.clause_reference} · {finding.risk_category}</small><strong>{finding.issue}</strong></span>
              <RiskPill risk={finding.risk_level} score={finding.risk_score} />
              <ChevronDown className={expanded === finding.id ? 'rotated' : ''} size={19} />
            </button>
            {expanded === finding.id && (
              <div className="finding-body">
                <div className="evidence-box"><span>DOCUMENT EVIDENCE</span><blockquote>“{finding.quoted_text}”</blockquote></div>
                <div className="finding-two">
                  <InfoBlock title="Why this is risky for the Bank" icon={AlertTriangle} text={finding.why_risky_for_bank} />
                  <InfoBlock title="How the risk may materialise" icon={Activity} text={finding.how_risk_may_materialise} />
                </div>
                <div className="impact-grid">
                  {Object.entries(finding.impact || {}).map(([key, value]) => (
                    <div key={key}><small>{key.replace('_', ' / ')}</small><p>{value}</p></div>
                  ))}
                </div>
                <div className="mitigation-box">
                  <span className="box-label"><ShieldCheck size={17} />RECOMMENDED MITIGATION</span>
                  <p>{finding.recommended_mitigation}</p>
                </div>
                <div className="rewrite-box">
                  <div><span className="box-label"><Sparkles size={17} />BANK-PROTECTIVE LANGUAGE</span><button className="copy-button" onClick={() => navigator.clipboard.writeText(finding.suggested_rewrite)}><Copy size={15} />Copy</button></div>
                  <p>{finding.suggested_rewrite}</p>
                </div>
                <div className="finding-footer">
                  <span>Owners: <strong>{(finding.review_owner || []).join(', ')}</strong></span>
                  <span>Confidence: <strong>{finding.confidence}%</strong></span>
                  <button className="button secondary compact" onClick={() => onDecision(finding)}><Activity size={16} />Record decision</button>
                </div>
              </div>
            )}
          </article>
        )) : <EmptyState icon={CheckCircle2} title="No issues in this filter" text="Choose another severity or return to the overview." />}
      </div>
    </section>
  );
}

function MissingProtections({ active }) {
  const missing = active.analysis?.missing_clauses || [];
  return (
    <section className="card">
      <CardHeader title="Missing protections" subtitle="Material clauses not found in the uploaded document." />
      <div className="protection-grid">
        {missing.length ? missing.map((item, index) => (
          <article className="protection-card" key={`${item.clause}-${index}`}>
            <div><RiskPill risk={item.risk_level} /><span>{String(index + 1).padStart(2, '0')}</span></div>
            <h3>{item.clause}</h3>
            <p>{item.why_needed}</p>
            <div className="suggested-clause"><small>SUGGESTED LANGUAGE</small><p>{item.recommended_language}</p><button onClick={() => navigator.clipboard.writeText(item.recommended_language)}><Copy size={15} />Copy</button></div>
          </article>
        )) : <EmptyState icon={ShieldCheck} title="No missing protection identified" text="Final professional review is still required before execution." />}
      </div>
    </section>
  );
}

function Scenarios({ active }) {
  const scenarios = active.analysis?.scenario_tests || [];
  return (
    <section className="card">
      <CardHeader title="Document-grounded scenarios" subtitle="How actual contract language may behave under stress." />
      <div className="scenario-list">
        {scenarios.length ? scenarios.map((scenario, index) => (
          <article key={`${scenario.title}-${index}`}>
            <div className="scenario-head"><span>{index + 1}</span><div><RiskPill risk={scenario.risk_level} /><h3>{scenario.title}</h3></div></div>
            <div className="scenario-flow">
              <div><small>DOCUMENT TRIGGER</small><p>{scenario.trigger_from_document}</p></div>
              <ArrowRight size={19} />
              <div><small>EVENT</small><p>{scenario.event}</p></div>
              <ArrowRight size={19} />
              <div><small>LIKELY OUTCOME</small><p>{scenario.likely_outcome}</p></div>
            </div>
            <div className="scenario-control"><ShieldCheck size={17} /><p><strong>Control:</strong> {scenario.recommended_control}</p></div>
          </article>
        )) : <EmptyState icon={Activity} title="No material scenario generated" text="Scenario tests are produced only when the document provides a defensible trigger." />}
      </div>
    </section>
  );
}

function Regulatory({ active }) {
  const items = active.analysis?.regulatory_touchpoints || [];
  return (
    <section className="card">
      <CardHeader title="Regulatory & control map" subtitle="Areas requiring validation by the appropriate control function." />
      <div className="regulatory-grid">
        {items.map((item, index) => (
          <article key={`${item.area}-${index}`}>
            <span className="reg-icon"><Shield size={21} /></span>
            <div><span className="eyebrow">{item.verification_required ? 'VERIFICATION REQUIRED' : 'CONTROL AREA'}</span><h3>{item.area}</h3><p>{item.relevance}</p><div><strong>Required action</strong><p>{item.action}</p></div></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Assistant({ active, request }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: `Ask me about “${active.title}”. I will answer only from this document and its saved analysis.` }
  ]);
  const [busy, setBusy] = useState(false);
  async function ask(event) {
    event.preventDefault();
    const value = question.trim();
    if (!value || busy) return;
    setQuestion('');
    setMessages(current => [...current, { role: 'user', text: value }]);
    setBusy(true);
    try {
      const data = await request(`/documents/${active.id}/ask`, {
        method: 'POST',
        body: JSON.stringify({ question: value })
      });
      setMessages(current => [...current, { role: 'assistant', text: data.answer, mode: data.mode }]);
    } catch (error) {
      setMessages(current => [...current, { role: 'assistant', text: error.message, error: true }]);
    } finally {
      setBusy(false);
    }
  }
  const prompts = ['What are the top three deal breakers?', 'Which clauses should Legal negotiate first?', 'Summarise the regulatory exposure.', 'What protections are missing?'];
  return (
    <section className="assistant-layout">
      <div className="assistant-context">
        <span><FileText size={20} /></span><div><small>ACTIVE SOURCE</small><strong>{active.title}</strong><p>{active.analysis?.findings?.length || 0} issues · {active.analysis?.missing_clauses?.length || 0} missing protections</p></div>
        <ShieldCheck size={20} />
      </div>
      <div className="chat-card">
        <div className="chat-messages">
          {messages.map((message, index) => (
            <div key={index} className={`chat-message ${message.role} ${message.error ? 'error' : ''}`}>
              {message.role === 'assistant' && <span className="chat-avatar"><Sparkles size={16} /></span>}
              <div><p>{message.text}</p>{message.mode && <small>{message.mode.replaceAll('-', ' ')}</small>}</div>
            </div>
          ))}
          {busy && <div className="chat-message assistant"><span className="chat-avatar"><Sparkles size={16} /></span><div className="typing"><span /><span /><span /></div></div>}
        </div>
        {messages.length === 1 && <div className="prompt-chips">{prompts.map(item => <button key={item} onClick={() => setQuestion(item)}>{item}</button>)}</div>}
        <form className="chat-input" onSubmit={ask}>
          <textarea value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask a question about this document…" rows={2} />
          <button className="button primary" disabled={busy || !question.trim()}><Send size={18} />Ask</button>
        </form>
      </div>
    </section>
  );
}

function Report({ active }) {
  const analysis = active.analysis || {};
  return (
    <section className="report-layout">
      <div className="report-actions card">
        <div><span className="report-icon"><FileText size={23} /></span><div><h3>Decision-ready report</h3><p>Download, share internally or save as PDF.</p></div></div>
        <div>
          <button className="button secondary" onClick={() => download(`${safeFilename(active.title)}-report.txt`, reportText(active))}><Download size={17} />Text report</button>
          <button className="button secondary" onClick={() => download(`${safeFilename(active.title)}-analysis.json`, JSON.stringify(active, null, 2), 'application/json')}><Download size={17} />JSON</button>
          <button className="button primary" onClick={() => window.print()}><Printer size={17} />Print / Save PDF</button>
        </div>
      </div>
      <article className="report-paper">
        <header><div className="report-logo"><span className="brand-glyph">S</span><div><strong>LIVE SYNESIS</strong><small>LEGAL & COMPLIANCE INTELLIGENCE</small></div></div><span>CONFIDENTIAL</span></header>
        <div className="report-title"><span>DECISION REPORT</span><h1>{active.title}</h1><p>{active.matter} · {active.documentType}</p></div>
        <div className="report-score"><RiskScore risk={analysis.overall_risk} score={analysis.overall_score} /><div><small>RECOMMENDED DECISION</small><h2>{analysis.recommended_decision}</h2><p>{analysis.executive_position}</p></div></div>
        <section><h3>Executive summary</h3><p>{analysis.document_summary}</p></section>
        <section><h3>Material issues</h3>{(analysis.findings || []).slice(0, 10).map((item, index) => <div className="report-finding" key={item.id}><span>{index + 1}</span><div><h4>{item.issue}</h4><p>{item.why_risky_for_bank}</p><small>{item.clause_reference} · {item.risk_level} · {item.risk_score}/100</small></div></div>)}</section>
        <footer>Generated {formatDate(analysis.generated_at || active.updatedAt)} · Final authorised review remains required.</footer>
      </article>
    </section>
  );
}

function DecisionModal({ active, finding, request, close, saved }) {
  const [status, setStatus] = useState('Commented');
  const [documentStatus, setDocumentStatus] = useState(active.status);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await request(`/documents/${active.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ findingId: finding.id, status, documentStatus, comment })
      });
      await saved(data.document);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && close()}>
      <form className="modal-card" onSubmit={submit}>
        <div className="modal-head"><div><span className="eyebrow">REVIEW DECISION</span><h3>{finding.issue}</h3></div><button type="button" aria-label="Close decision dialog" className="icon-button" onClick={close}><X size={19} /></button></div>
        <label>Action<select value={status} onChange={event => setStatus(event.target.value)}><option>Commented</option><option>Assigned</option><option>Escalated</option><option>Accepted With Controls</option><option>Resolved</option><option>Rejected</option></select></label>
        <label>Document status<select value={documentStatus} onChange={event => setDocumentStatus(event.target.value)}><option>AI Review Complete</option><option>In Legal Review</option><option>In Compliance Review</option><option>Escalated</option><option>Final Approved</option><option>Rejected</option><option>Closed</option></select></label>
        <label>Decision note<textarea value={comment} onChange={event => setComment(event.target.value)} rows={5} placeholder="Record the negotiated position, owner, control or reason…" /></label>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions"><button type="button" className="button ghost" onClick={close}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save decision'}</button></div>
      </form>
    </div>
  );
}

function Comparison({ documents, request }) {
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function compare(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await request('/documents/compare', { method: 'POST', body: JSON.stringify({ leftId, rightId }) });
      setResult(data.comparison);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack page-enter">
      <section className="compare-banner"><GitCompareArrows size={34} /><div><span className="eyebrow light">RISK MOVEMENT</span><h2>Compare the substance, not just the files.</h2><p>See which version or agreement carries greater overall and high-risk exposure.</p></div></section>
      <form className="card compare-form" onSubmit={compare}>
        <label>First document<select value={leftId} onChange={event => setLeftId(event.target.value)} required><option value="">Choose a document</option>{documents.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <span className="versus">VS</span>
        <label>Second document<select value={rightId} onChange={event => setRightId(event.target.value)} required><option value="">Choose a document</option>{documents.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <button className="button primary" disabled={busy || !leftId || !rightId}>{busy ? 'Comparing…' : 'Compare risk'}</button>
      </form>
      {error && <div className="form-error"><AlertTriangle size={17} />{error}</div>}
      {result && (
        <section className="comparison-result card">
          <div className="comparison-side"><small>FIRST DOCUMENT</small><h3>{result.left.title}</h3><RiskScore risk={result.left.risk} score={result.left.score} /><p><strong>{result.left.high_findings}</strong> high-risk · <strong>{result.left.findings}</strong> total issues</p></div>
          <div className="comparison-delta"><GitCompareArrows size={26} /><strong>{Math.abs(result.score_delta)}</strong><span>point difference</span></div>
          <div className="comparison-side"><small>SECOND DOCUMENT</small><h3>{result.right.title}</h3><RiskScore risk={result.right.risk} score={result.right.score} /><p><strong>{result.right.high_findings}</strong> high-risk · <strong>{result.right.findings}</strong> total issues</p></div>
          <div className="comparison-conclusion"><Sparkles size={18} /><p>{result.conclusion}</p></div>
        </section>
      )}
    </div>
  );
}

function Administration({ users, audit, request, reload, setNotice }) {
  const [tab, setTab] = useState('users');
  const [showCreate, setShowCreate] = useState(false);
  return (
    <div className="stack page-enter">
      <div className="admin-tabs"><button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}><Users size={18} />Users & roles</button><button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}><Activity size={18} />Audit trail</button></div>
      {tab === 'users' ? (
        <section className="card">
          <CardHeader title="Workspace access" subtitle="Create role-controlled accounts and manage active access." action={<button className="button primary compact" onClick={() => setShowCreate(true)}><UserPlus size={17} />Add user</button>} />
          <div className="user-table">
            <div className="user-row table-head"><span>User</span><span>Role</span><span>Last login</span><span>Status</span><span /></div>
            {users.map(user => <div className="user-row" key={user.id}><span className="document-name"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></span><span>{ROLE_LABELS[user.role] || user.role}</span><span className="muted">{formatDate(user.lastLoginAt)}</span><span><StatusBadge value={user.isActive ? 'Active' : 'Inactive'} /></span><button className="text-button" onClick={async () => { try { await request(`/admin/users/${user.id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive: !user.isActive }) }); await reload(); } catch (error) { setNotice({ type: 'error', message: error.message }); } }}>{user.isActive ? 'Deactivate' : 'Activate'}</button></div>)}
          </div>
        </section>
      ) : (
        <section className="card">
          <CardHeader title="Immutable activity view" subtitle="Security and decision events across the organisation." />
          <div className="audit-list">
            {audit.map(event => <div key={event.id}><span className="audit-icon"><Activity size={16} /></span><div><strong>{event.action.replaceAll('.', ' ')}</strong><p>{event.user} · {event.role}</p></div><small>{formatDate(event.at)}</small></div>)}
          </div>
        </section>
      )}
      {showCreate && <CreateUserModal request={request} close={() => setShowCreate(false)} saved={async () => { setShowCreate(false); await reload(); setNotice({ type: 'success', message: 'User account created.' }); }} />}
    </div>
  );
}

function CreateUserModal({ request, close, saved }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'legal', temporaryPassword: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await request('/admin/users', { method: 'POST', body: JSON.stringify(form) });
      saved();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop"><form className="modal-card" onSubmit={submit}><div className="modal-head"><div><span className="eyebrow">WORKSPACE ACCESS</span><h3>Add a user</h3></div><button type="button" className="icon-button" onClick={close}><X size={19} /></button></div><label>Full name<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required /></label><label>Work email<input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required /></label><label>Role<select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}>{Object.entries(ROLE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Temporary password<input type="password" value={form.temporaryPassword} onChange={event => setForm({ ...form, temporaryPassword: event.target.value })} minLength={12} required /><small>At least 12 characters. The user will be asked to replace it.</small></label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button ghost" onClick={close}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Creating…' : 'Create user'}</button></div></form></div>
  );
}

function ProfileSettings({ user, request, setNotice }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) return setNotice({ type: 'error', message: 'New passwords do not match.' });
    setBusy(true);
    try {
      await request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }) });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setNotice({ type: 'success', message: 'Password updated successfully.' });
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-grid page-enter">
      <section className="card profile-card"><span className="avatar large">{(user.name || user.email).slice(0, 1).toUpperCase()}</span><h2>{user.name}</h2><p>{user.email}</p><RoleBadge role={user.role} /><div><span>Organisation<strong>{user.organizationName}</strong></span><span>Account status<strong>{user.isActive ? 'Active' : 'Inactive'}</strong></span><span>Last login<strong>{formatDate(user.lastLoginAt)}</strong></span></div></section>
      <form className="card password-card" onSubmit={submit}><CardHeader title="Change password" subtitle="Use a strong password unique to LIVE SYNESIS." /><label>Current password<input type="password" autoComplete="current-password" value={form.currentPassword} onChange={event => setForm({ ...form, currentPassword: event.target.value })} required /></label><label>New password<input type="password" autoComplete="new-password" value={form.newPassword} onChange={event => setForm({ ...form, newPassword: event.target.value })} required /></label><label>Confirm new password<input type="password" autoComplete="new-password" value={form.confirmPassword} onChange={event => setForm({ ...form, confirmPassword: event.target.value })} required /></label><small>Minimum 12 characters with uppercase, lowercase, number and symbol.</small><button className="button primary" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></form>
    </div>
  );
}

function PasswordSetup({ user, request, completed, logout }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await request('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword })
      });
      completed();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-screen password-setup-screen">
      <section className="login-panel password-setup-panel">
        <div className="login-logo"><span className="brand-glyph">S</span><div><strong>LIVE SYNESIS</strong><small>SECURE ACCOUNT SETUP</small></div></div>
        <div className="login-heading"><span className="eyebrow">WELCOME, {user.name?.toUpperCase()}</span><h1>Replace your temporary password</h1><p>This one-time step protects the legal workspace before access is enabled.</p></div>
        <form onSubmit={submit}>
          <label>Temporary password<input type="password" autoComplete="current-password" value={form.currentPassword} onChange={event => setForm({ ...form, currentPassword: event.target.value })} required /></label>
          <label>New password<input type="password" autoComplete="new-password" value={form.newPassword} onChange={event => setForm({ ...form, newPassword: event.target.value })} required /></label>
          <label>Confirm new password<input type="password" autoComplete="new-password" value={form.confirmPassword} onChange={event => setForm({ ...form, confirmPassword: event.target.value })} required /></label>
          <small>Use at least 12 characters with uppercase, lowercase, number and symbol.</small>
          {error && <div className="form-error">{error}</div>}
          <button className="button primary large wide" disabled={busy}>{busy ? 'Securing account…' : 'Set password and continue'}</button>
          <button type="button" className="text-button password-setup-signout" onClick={logout}>Sign out</button>
        </form>
      </section>
    </div>
  );
}

function CardHeader({ title, subtitle, action }) {
  return <div className="card-header"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}

function RiskScore({ score = 0, risk = 'Low', compact = false }) {
  return <div className={`risk-score ${riskTone(risk)} ${compact ? 'compact' : ''}`} style={{ '--score': `${score * 3.6}deg` }}><div><strong>{score}</strong>{!compact && <small>/100</small>}</div></div>;
}

function RiskPill({ risk = 'Low', score }) {
  return <span className={`risk-pill ${riskTone(risk)}`}><i />{risk}{score !== undefined && <b>{score}</b>}</span>;
}

function RoleBadge({ role }) {
  return <span className="role-badge"><ShieldCheck size={14} />{ROLE_LABELS[role] || role}</span>;
}

function StatusBadge({ value = 'Open' }) {
  const completed = /approved|closed|active|resolved/i.test(value);
  const danger = /rejected|inactive|escalated/i.test(value);
  return <span className={`status-badge ${completed ? 'complete' : danger ? 'danger' : ''}`}><i />{value}</span>;
}

function InfoBlock({ title, icon: Icon, text }) {
  return <div className="info-block"><span><Icon size={18} /></span><div><h4>{title}</h4><p>{text}</p></div></div>;
}

function EmptyState({ icon: Icon, title, text }) {
  return <div className="empty-state"><span><Icon size={27} /></span><h3>{title}</h3><p>{text}</p></div>;
}
