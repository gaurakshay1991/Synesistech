import { useEffect, useMemo, useState } from 'react';

const API = import.meta.env.VITE_API_URL || '/api';
const BASE_NAV = [
  'Command Center',
  'Upload & Analyse',
  'Review Center',
  'Document Comparison',
  'Scenario Testing',
  'Regulatory & KYC',
  'Reports',
  'Document Assistant',
  'Institutional Memory'
];

function riskClass(value = 'Low') {
  return `risk ${String(value).toLowerCase()}`;
}

function safeFilename(value = 'LIVE-SYNESIS') {
  return String(value).replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '') || 'LIVE-SYNESIS';
}

function download(name, value, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeFilename(name);
  anchor.click();
  URL.revokeObjectURL(url);
}

async function readResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text || `Request failed with status ${response.status}` };
  }
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('legal@synesis.local');
  const [password, setPassword] = useState('LegalDemoOnly123!');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch(`${API}/health`)
      .then(readResponse)
      .then(setHealth)
      .catch(() => setHealth({ ok: false }));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.error || 'Login failed');
      onLogin(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="mark">LS</div>
        <h1>LIVE SYNESIS</h1>
        <p>Document-led legal and compliance intelligence for the Bank.</p>
        <div className={`system-status ${health?.ok ? 'online' : 'offline'}`}>
          <span>{health?.ok ? 'System online' : 'Checking system'}</span>
          {health?.openaiConfigured !== undefined && (
            <small>{health.openaiConfigured ? `AI enabled · ${health.model}` : 'Baseline engine active'}</small>
          )}
        </div>
        <label>
          Email
          <input value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <small>Private controlled-access build. Credentials and final approvals remain organisation-controlled.</small>
      </form>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('live-synesis-session') || 'null');
    } catch {
      return null;
    }
  });
  const [view, setView] = useState('Command Center');
  const [documents, setDocuments] = useState([]);
  const [active, setActive] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [notice, setNotice] = useState('');
  const [audit, setAudit] = useState([]);
  const token = session?.token;

  const nav = useMemo(
    () => session?.user?.role === 'management'
      ? BASE_NAV.filter(item => item !== 'Upload & Analyse')
      : BASE_NAV,
    [session?.user?.role]
  );

  async function request(path, options = {}) {
    const isForm = options.body instanceof FormData;
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${token}`,
        ...options.headers
      }
    });
    const data = await readResponse(response);
    if (response.status === 401) {
      logout();
      throw new Error('Your session expired. Sign in again.');
    }
    if (!response.ok) throw new Error(data.detail || data.error || 'Request failed');
    return data;
  }

  async function refresh(preferredId = active?.id) {
    if (!token) return;
    try {
      const [documentData, metricData] = await Promise.all([
        request('/documents'),
        request('/dashboard')
      ]);
      setDocuments(documentData.documents || []);
      setMetrics(metricData);
      if (preferredId) {
        const selected = documentData.documents?.find(document => document.id === preferredId);
        setActive(selected || null);
      }
      if (session.user.role === 'admin') {
        const auditData = await request('/admin/audit');
        setAudit(auditData.audit || []);
      }
    } catch (requestError) {
      setNotice(requestError.message);
    }
  }

  useEffect(() => {
    refresh();
  }, [token]);

  function login(data) {
    localStorage.setItem('live-synesis-session', JSON.stringify(data));
    setSession(data);
  }

  function logout() {
    localStorage.removeItem('live-synesis-session');
    setSession(null);
    setActive(null);
    setDocuments([]);
  }

  if (!session) return <Login onLogin={login} />;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="mark small">LS</span>
          <div>
            <b>LIVE SYNESIS</b>
            <small>Bank Legal & Compliance OS</small>
          </div>
        </div>
        <nav>
          {nav.map(item => (
            <button key={item} className={view === item ? 'active' : ''} onClick={() => setView(item)}>
              {item}
            </button>
          ))}
        </nav>
        <div className="active-doc">
          <small>ACTIVE DOCUMENT</small>
          <b>{active?.title || 'None selected'}</b>
          <span>
            {active
              ? `${active.analysis?.overall_risk} risk · ${active.analysis?.overall_score}/100`
              : 'Upload or select a document'}
          </span>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <h1>{view}</h1>
            <p>
              {active
                ? `Working from: ${active.title}`
                : 'Start by uploading or selecting the document that should control the analysis.'}
            </p>
          </div>
          <div className="user">
            <span>{session.user.role}</span>
            <b>{session.user.email}</b>
            <button onClick={logout}>Sign out</button>
          </div>
        </header>

        {notice && <div className="notice" onClick={() => setNotice('')}>{notice}</div>}

        {view === 'Command Center' && (
          <Dashboard metrics={metrics} documents={documents} setActive={setActive} setView={setView} />
        )}
        {view === 'Upload & Analyse' && (
          <Upload
            token={token}
            onDone={document => {
              setActive(document);
              setView('Review Center');
              refresh(document.id);
            }}
            setNotice={setNotice}
          />
        )}
        {view === 'Review Center' && (
          <Review
            active={active}
            role={session.user.role}
            request={request}
            onUpdated={document => {
              setActive(document);
              refresh(document.id);
            }}
            onDeleted={() => {
              setActive(null);
              setView('Command Center');
              refresh(null);
            }}
            setNotice={setNotice}
          />
        )}
        {view === 'Document Comparison' && (
          <Comparison documents={documents} request={request} />
        )}
        {view === 'Scenario Testing' && <Scenarios active={active} />}
        {view === 'Regulatory & KYC' && <Regulatory active={active} />}
        {view === 'Reports' && <Reports active={active} />}
        {view === 'Document Assistant' && <Assistant active={active} request={request} />}
        {view === 'Institutional Memory' && (
          <Memory documents={documents} audit={audit} setActive={setActive} setView={setView} />
        )}
      </main>
    </div>
  );
}

function Dashboard({ metrics, documents, setActive, setView }) {
  const cards = [
    ['Documents', metrics?.totalDocuments || 0],
    ['High-risk matters', metrics?.highRisk || 0],
    ['Open matters', metrics?.open || 0],
    ['Findings', metrics?.totalFindings || 0],
    ['Scenarios', metrics?.totalScenarios || 0]
  ];

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">DOCUMENT-FIRST WORKFLOW</span>
          <h2>Know what is risky, why it matters and what the Bank should do next.</h2>
          <p>Evidence, risk scoring, mitigation, rewrites, scenarios and reports all follow the selected uploaded document.</p>
        </div>
        <button className="primary" onClick={() => setView('Upload & Analyse')}>Upload a document</button>
      </section>
      <div className="metrics">
        {cards.map(([label, value]) => (
          <div className="metric" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="section-head">
          <div>
            <h3>Recent documents</h3>
            <p>Select a document to make it active across every analysis module.</p>
          </div>
        </div>
        <div className="table">
          {documents.length ? documents.slice(0, 10).map(document => (
            <button
              className="row"
              key={document.id}
              onClick={() => {
                setActive(document);
                setView('Review Center');
              }}
            >
              <span>
                <b>{document.title}</b>
                <small>{document.documentType} · {document.matter}</small>
              </span>
              <span className={riskClass(document.analysis?.overall_risk)}>{document.analysis?.overall_risk}</span>
              <strong>{document.analysis?.overall_score}/100</strong>
              <small>{document.status}</small>
            </button>
          )) : <Empty text="No documents analysed yet." />}
        </div>
      </section>
    </>
  );
}

function Upload({ token, onDone, setNotice }) {
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: '',
    matter: 'Vendor onboarding',
    documentType: 'Auto-detect',
    jurisdiction: 'India',
    riskAppetite: 'Conservative'
  });

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setNotice('Extracting and analysing the actual document…');
    try {
      const body = new FormData();
      if (file) body.append('file', file);
      body.append('text', text);
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      const response = await fetch(`${API}/documents/analyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body
      });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.detail || data.error || 'Analysis failed');
      setNotice(`Analysis completed using ${data.document.analysis.engine}.`);
      onDone(data.document);
    } catch (requestError) {
      setNotice(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Upload the actual document</h2>
          <p>PDF, DOCX, TXT, CSV, JSON or Markdown. Its extracted content becomes the active source of truth.</p>
        </div>
      </div>
      <form className="upload-form" onSubmit={submit}>
        <label className="drop">
          <input
            type="file"
            accept=".pdf,.docx,.txt,.csv,.json,.md"
            onChange={event => setFile(event.target.files?.[0] || null)}
          />
          <b>{file?.name || 'Choose document'}</b>
          <span>{file ? `${Math.round(file.size / 1024)} KB` : 'Click to select a supported file'}</span>
        </label>
        <div className="form-grid">
          <label>Title<input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Optional; otherwise filename" /></label>
          <label>Matter<input value={form.matter} onChange={event => setForm({ ...form, matter: event.target.value })} /></label>
          <label>
            Document type
            <select value={form.documentType} onChange={event => setForm({ ...form, documentType: event.target.value })}>
              <option>Auto-detect</option>
              <option>Vendor / Outsourcing Agreement</option>
              <option>NDA / Confidentiality Agreement</option>
              <option>Finance Agreement</option>
              <option>Employment Agreement</option>
              <option>Policy / Regulatory Document</option>
            </select>
          </label>
          <label>Jurisdiction<input value={form.jurisdiction} onChange={event => setForm({ ...form, jurisdiction: event.target.value })} /></label>
          <label>
            Risk appetite
            <select value={form.riskAppetite} onChange={event => setForm({ ...form, riskAppetite: event.target.value })}>
              <option>Conservative</option>
              <option>Balanced</option>
              <option>Commercial</option>
            </select>
          </label>
        </div>
        <label>
          Optional pasted text or context
          <textarea value={text} onChange={event => setText(event.target.value)} placeholder="Paste document text when no file is available, or add limited factual context." />
        </label>
        <button className="primary" disabled={busy || (!file && !text.trim())}>
          {busy ? 'Analysing actual document…' : 'Upload and analyse'}
        </button>
      </form>
    </section>
  );
}

function Review({ active, role, request, onUpdated, onDeleted, setNotice }) {
  const [selected, setSelected] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setSelected(0), [active?.id]);

  if (!active) return <Empty text="Select or upload a document first." />;
  const analysis = active.analysis || {};
  const finding = analysis.findings?.[selected];
  const mayDelete = ['admin', 'legal'].includes(role);
  const mayReanalyse = ['admin', 'legal', 'compliance', 'kyc'].includes(role);

  async function decide(status) {
    if (!finding) return;
    setBusy(true);
    try {
      const data = await request(`/documents/${active.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ findingId: finding.id, status, comment })
      });
      onUpdated(data.document);
      setComment('');
      setNotice(`Decision recorded: ${status}.`);
    } catch (requestError) {
      setNotice(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function reanalyse() {
    setBusy(true);
    setNotice('Reanalysing the stored source document…');
    try {
      const data = await request(`/documents/${active.id}/reanalyze`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      onUpdated(data.document);
      setNotice(`Reanalysis completed using ${data.document.analysis.engine}.`);
    } catch (requestError) {
      setNotice(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${active.title}” and its saved analysis? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await request(`/documents/${active.id}`, { method: 'DELETE' });
      setNotice('Document deleted.');
      onDeleted();
    } catch (requestError) {
      setNotice(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="summary">
        <div><small>OVERALL RISK</small><strong className={riskClass(analysis.overall_risk)}>{analysis.overall_risk}</strong></div>
        <div><small>SCORE</small><strong>{analysis.overall_score}/100</strong></div>
        <div><small>DECISION</small><strong>{analysis.recommended_decision}</strong></div>
        <div><small>ENGINE</small><strong>{analysis.engine}</strong></div>
      </div>
      <section className="panel">
        <div className="section-head">
          <div><h3>{active.title}</h3><p>{analysis.executive_position}</p></div>
          <div className="actions">
            {mayReanalyse && <button disabled={busy} onClick={reanalyse}>Reanalyse</button>}
            {mayDelete && <button className="danger" disabled={busy} onClick={remove}>Delete</button>}
          </div>
        </div>
      </section>
      <div className="review-grid">
        <section className="panel findings">
          <h3>Findings ({analysis.findings?.length || 0})</h3>
          {analysis.findings?.length ? analysis.findings.map((item, index) => (
            <button className={selected === index ? 'finding active' : 'finding'} key={item.id} onClick={() => setSelected(index)}>
              <span className={riskClass(item.risk_level)}>{item.risk_level}</span>
              <b>{item.issue}</b>
              <small>{item.risk_category} · {item.risk_score}/100</small>
            </button>
          )) : <Empty text="No clause-level finding was generated." />}
        </section>
        <section className="panel detail">
          {finding ? (
            <>
              <div className="section-head">
                <div>
                  <span className={riskClass(finding.risk_level)}>{finding.risk_level} · {finding.risk_score}/100</span>
                  <h2>{finding.issue}</h2>
                  <p>{finding.clause_reference}</p>
                </div>
              </div>
              <h4>Document evidence</h4>
              <blockquote>{finding.quoted_text}</blockquote>
              <h4>Why this is risky for the Bank</h4>
              <p>{finding.why_risky_for_bank}</p>
              <h4>How it may materialise</h4>
              <p>{finding.how_risk_may_materialise}</p>
              <h4>Mitigation</h4>
              <p>{finding.recommended_mitigation}</p>
              <h4>Suggested Bank-protective rewrite</h4>
              <div className="rewrite">{finding.suggested_rewrite}</div>
              <div className="owners">{finding.review_owner?.map(owner => <span key={owner}>{owner}</span>)}</div>
              <textarea value={comment} onChange={event => setComment(event.target.value)} placeholder="Decision note or negotiation instruction" />
              <div className="actions">
                <button disabled={busy} onClick={() => decide('Assigned for Revision')}>Assign revision</button>
                <button disabled={busy} onClick={() => decide('Escalated')}>Escalate</button>
                <button className="primary" disabled={busy} onClick={() => decide('Accepted with Controls')}>Accept with controls</button>
              </div>
            </>
          ) : <Empty text="No finding selected." />}
        </section>
      </div>
      <section className="panel">
        <h3>Potentially missing protections</h3>
        <div className="cards">
          {analysis.missing_clauses?.length ? analysis.missing_clauses.map(item => (
            <article key={item.clause}>
              <span className={riskClass(item.risk_level)}>{item.risk_level}</span>
              <h4>{item.clause}</h4>
              <p>{item.why_needed}</p>
              <div className="rewrite">{item.recommended_language}</div>
            </article>
          )) : <p>No missing control detected by the current analysis.</p>}
        </div>
      </section>
    </>
  );
}

function Comparison({ documents, request }) {
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!leftId && documents[0]) setLeftId(documents[0].id);
    if (!rightId && documents[1]) setRightId(documents[1].id);
  }, [documents, leftId, rightId]);

  async function compare() {
    if (!leftId || !rightId || leftId === rightId) {
      setError('Select two different documents.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await request('/documents/compare', {
        method: 'POST',
        body: JSON.stringify({ leftId, rightId })
      });
      setComparison(data.comparison);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (documents.length < 2) return <Empty text="Analyse at least two documents to compare risk movement." />;

  return (
    <section className="panel">
      <div className="section-head">
        <div><h2>Compare document risk</h2><p>Use this to prove that clause changes materially alter the analysis.</p></div>
      </div>
      <div className="compare-controls">
        <label>
          First document
          <select value={leftId} onChange={event => setLeftId(event.target.value)}>
            {documents.map(document => <option key={document.id} value={document.id}>{document.title}</option>)}
          </select>
        </label>
        <label>
          Second document
          <select value={rightId} onChange={event => setRightId(event.target.value)}>
            {documents.map(document => <option key={document.id} value={document.id}>{document.title}</option>)}
          </select>
        </label>
        <button className="primary" disabled={busy} onClick={compare}>{busy ? 'Comparing…' : 'Compare'}</button>
      </div>
      {error && <div className="error">{error}</div>}
      {comparison && (
        <div className="comparison-result">
          <article>
            <span className={riskClass(comparison.left.risk)}>{comparison.left.risk}</span>
            <h3>{comparison.left.title}</h3>
            <strong>{comparison.left.score}/100</strong>
            <p>{comparison.left.high_findings} high-risk · {comparison.left.findings} total findings</p>
          </article>
          <div className="delta">
            <small>SCORE DELTA</small>
            <strong>{comparison.score_delta > 0 ? '+' : ''}{comparison.score_delta}</strong>
            <span>{comparison.high_risk_delta > 0 ? '+' : ''}{comparison.high_risk_delta} high-risk findings</span>
          </div>
          <article>
            <span className={riskClass(comparison.right.risk)}>{comparison.right.risk}</span>
            <h3>{comparison.right.title}</h3>
            <strong>{comparison.right.score}/100</strong>
            <p>{comparison.right.high_findings} high-risk · {comparison.right.findings} total findings</p>
          </article>
          <p className="comparison-conclusion">{comparison.conclusion}</p>
        </div>
      )}
    </section>
  );
}

function Scenarios({ active }) {
  if (!active) return <Empty text="Select a document first." />;
  const scenarios = active.analysis?.scenario_tests || [];
  return (
    <section className="panel">
      <h2>Document-specific stress tests</h2>
      <p>Each scenario is derived from evidence and a risk in {active.title}; no generic scenario library is displayed.</p>
      <div className="cards">
        {scenarios.length ? scenarios.map((scenario, index) => (
          <article key={`${scenario.title}-${index}`}>
            <span className={riskClass(scenario.risk_level)}>{scenario.risk_level}</span>
            <h3>{scenario.title}</h3>
            <h4>Document trigger</h4>
            <blockquote>{scenario.trigger_from_document}</blockquote>
            <h4>Event</h4>
            <p>{scenario.event}</p>
            <h4>Likely outcome</h4>
            <p>{scenario.likely_outcome}</p>
            <h4>Control</h4>
            <p>{scenario.recommended_control}</p>
          </article>
        )) : <Empty text="No high-risk scenario was generated for this document." />}
      </div>
    </section>
  );
}

function Regulatory({ active }) {
  if (!active) return <Empty text="Select a document first." />;
  const analysis = active.analysis || {};
  const kyc = analysis.findings?.filter(item =>
    item.risk_category === 'KYC/AML' || /kyc|aml|sanction|beneficial/i.test(`${item.issue} ${item.quoted_text}`)
  ) || [];
  return (
    <div className="two-col">
      <section className="panel">
        <h2>Regulatory touchpoints</h2>
        {analysis.regulatory_touchpoints?.map((item, index) => (
          <article className="item" key={`${item.area}-${index}`}>
            <h3>{item.area}</h3>
            <p>{item.relevance}</p>
            <div className="rewrite">{item.action}</div>
            {item.verification_required && <small>Current official-source verification remains required before final reliance.</small>}
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>KYC / AML relevance</h2>
        {kyc.length ? kyc.map(item => (
          <article className="item" key={item.id}>
            <span className={riskClass(item.risk_level)}>{item.risk_level}</span>
            <h3>{item.issue}</h3>
            <p>{item.why_risky_for_bank}</p>
          </article>
        )) : <Empty text="No specific KYC/AML finding detected in the active document." />}
      </section>
    </div>
  );
}

function reportText(document) {
  const analysis = document.analysis;
  return `LIVE SYNESIS DOCUMENT REVIEW REPORT

Document: ${document.title}
Type: ${document.documentType}
Matter: ${document.matter}
Overall risk: ${analysis.overall_risk} (${analysis.overall_score}/100)
Recommended decision: ${analysis.recommended_decision}
Analysis engine: ${analysis.engine}

EXECUTIVE POSITION
${analysis.executive_position}

FINDINGS
${(analysis.findings || []).map((finding, index) => `${index + 1}. [${finding.risk_level} ${finding.risk_score}/100] ${finding.issue}
Evidence: ${finding.quoted_text}
Why risky for the Bank: ${finding.why_risky_for_bank}
How it may materialise: ${finding.how_risk_may_materialise}
Mitigation: ${finding.recommended_mitigation}
Rewrite: ${finding.suggested_rewrite}
Owners: ${(finding.review_owner || []).join(', ')}`).join('\n\n')}

MISSING PROTECTIONS
${(analysis.missing_clauses || []).map(item => `- [${item.risk_level}] ${item.clause}: ${item.why_needed}
  Suggested language: ${item.recommended_language}`).join('\n')}

REGULATORY TOUCHPOINTS
${(analysis.regulatory_touchpoints || []).map(item => `- ${item.area}: ${item.relevance}
  Action: ${item.action}`).join('\n')}

SCENARIOS
${(analysis.scenario_tests || []).map(item => `- ${item.title}: ${item.event}
  Control: ${item.recommended_control}`).join('\n')}

HUMAN DECISIONS
${(document.decisions || []).map(item => `- ${item.at}: ${item.status} by ${item.user}${item.comment ? ` — ${item.comment}` : ''}`).join('\n')}

ASSUMPTIONS AND LIMITS
${(analysis.assumptions_and_limits || []).map(item => `- ${item}`).join('\n')}`;
}

function Reports({ active }) {
  if (!active) return <Empty text="Select a document first." />;
  return (
    <section className="panel report-panel">
      <div className="section-head">
        <div><h2>Decision-ready report</h2><p>Generated only from the active document and its saved analysis.</p></div>
        <div className="actions no-print">
          <button onClick={() => download(`${active.title}.json`, JSON.stringify(active, null, 2), 'application/json')}>Download JSON</button>
          <button onClick={() => download(`${active.title}-report.txt`, reportText(active))}>Download text</button>
          <button className="primary" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      </div>
      <pre className="report">{reportText(active)}</pre>
    </section>
  );
}

function Assistant({ active, request }) {
  const [question, setQuestion] = useState('What are the three most serious risks for the Bank and what should be negotiated?');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  if (!active) return <Empty text="Select a document first." />;

  async function ask() {
    setBusy(true);
    try {
      const data = await request(`/documents/${active.id}/ask`, {
        method: 'POST',
        body: JSON.stringify({ question })
      });
      setAnswer(data.answer);
    } catch (requestError) {
      setAnswer(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Ask the active document</h2>
      <p>The assistant is restricted to {active.title}, its source text and its saved findings.</p>
      <textarea value={question} onChange={event => setQuestion(event.target.value)} />
      <button className="primary" onClick={ask} disabled={busy || !question.trim()}>
        {busy ? 'Reviewing document…' : 'Ask LIVE SYNESIS'}
      </button>
      {answer && <pre className="answer">{answer}</pre>}
    </section>
  );
}

function Memory({ documents, audit, setActive, setView }) {
  return (
    <div className="two-col">
      <section className="panel">
        <h2>Institutional memory</h2>
        <p>Saved documents, findings and human decisions form the initial precedent and memory layer.</p>
        {documents.length ? documents.map(document => (
          <button
            className="memory-row"
            key={document.id}
            onClick={() => {
              setActive(document);
              setView('Review Center');
            }}
          >
            <span>
              <b>{document.title}</b>
              <small>{document.decisions?.length || 0} saved decisions · {document.updatedAt?.slice(0, 10)}</small>
            </span>
            <span className={riskClass(document.analysis?.overall_risk)}>{document.analysis?.overall_risk}</span>
          </button>
        )) : <Empty text="No institutional memory has been created yet." />}
      </section>
      <section className="panel">
        <h2>Audit trail</h2>
        {audit.length ? audit.slice(0, 60).map(item => (
          <div className="audit" key={item.id}>
            <b>{item.action}</b>
            <span>{item.user} · {item.role}</span>
            <small>{new Date(item.at).toLocaleString()}</small>
          </div>
        )) : <p>Detailed audit records are visible to Admin users.</p>}
      </section>
    </div>
  );
}

function Empty({ text }) {
  return <div className="empty"><b>Nothing to display</b><p>{text}</p></div>;
}
