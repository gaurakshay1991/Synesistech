import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, BookOpenCheck, BrainCircuit, Building2,
  CheckCircle2, ChevronRight, CircleAlert, Database, Download, FileSearch, FileText,
  Gauge, History, Landmark, LayoutDashboard, LoaderCircle, Menu, Network, RefreshCw,
  Scale, Search, Settings2, ShieldCheck, Sparkles, Target, UploadCloud, Users, WalletCards, X
} from 'lucide-react';

const API = '/api';
const STATE_KEY = 'synesis-institutional-prototype-v1';
const DECISIONS_KEY = 'synesis-institutional-decisions-v1';

const DEMO_PORTFOLIO = {
  demo: true,
  kind: 'portfolio',
  title: 'Demonstration Balanced Opportunities Fund',
  generated_at: '2026-07-20T05:30:00.000Z',
  engine: 'demonstration-data',
  source_rows: 18,
  overall_risk: 'Medium',
  overall_score: 54,
  metrics: {
    holdings: 18,
    cash_weight: 4.8,
    top_holding_weight: 11.6,
    top_sector_weight: 31.4,
    below_aa_weight: 7.2,
    unlisted_weight: 0,
    slow_liquidity_weight: 12.5,
    missing_liquidity_weight: 0
  },
  top_holdings: [
    { security: 'Orion Financial Services', issuer: 'Orion Financial Services', sector: 'Financials', assetClass: 'Equity', weight: 11.6, rating: 'Not supplied', liquidityDays: 2 },
    { security: 'National Infrastructure Bond 2031', issuer: 'National Infrastructure Corp', sector: 'Infrastructure', assetClass: 'Debt', weight: 9.8, rating: 'AA+', liquidityDays: 4 },
    { security: 'Arka Digital Systems', issuer: 'Arka Digital Systems', sector: 'Technology', assetClass: 'Equity', weight: 8.7, rating: 'Not supplied', liquidityDays: 3 },
    { security: 'Cash and money market', issuer: 'Cash', sector: 'Cash', assetClass: 'Cash', weight: 4.8, rating: 'A1+', liquidityDays: 0 }
  ],
  issuer_exposure: [
    { name: 'Orion Financial Services', weight: 11.6 },
    { name: 'National Infrastructure Corp', weight: 9.8 },
    { name: 'Arka Digital Systems', weight: 8.7 },
    { name: 'Meridian Consumer Products', weight: 7.4 }
  ],
  sector_exposure: [
    { name: 'Financials', weight: 31.4 },
    { name: 'Technology', weight: 18.6 },
    { name: 'Infrastructure', weight: 15.2 },
    { name: 'Consumer', weight: 12.8 },
    { name: 'Cash', weight: 4.8 }
  ],
  rating_distribution: [
    { name: 'Not supplied', weight: 62.1 },
    { name: 'AAA', weight: 15.9 },
    { name: 'AA+', weight: 9.8 },
    { name: 'AA-', weight: 5.0 },
    { name: 'A+', weight: 2.4 },
    { name: 'A1+', weight: 4.8 }
  ],
  asset_class_distribution: [
    { name: 'Equity', weight: 62.1 },
    { name: 'Debt', weight: 33.1 },
    { name: 'Cash', weight: 4.8 }
  ],
  flags: [
    { id: 'demo-1', severity: 'Medium', category: 'Issuer concentration', title: 'Orion Financial Services represents 11.6% of the portfolio', evidence: 'Demonstration holding data.', action: 'Validate the applicable issuer limit and consider rebalancing.' },
    { id: 'demo-2', severity: 'Medium', category: 'Sector concentration', title: 'Financials sector exposure is 31.4%', evidence: 'Demonstration sector aggregation.', action: 'Run correlated financial-sector stress scenarios.' },
    { id: 'demo-3', severity: 'Medium', category: 'Liquidity', title: '12.5% is marked above five liquidation days', evidence: 'Demonstration liquidity attributes.', action: 'Review stressed redemption capacity.' }
  ],
  data_gaps: [],
  redemption_scenarios: [5, 10, 20, 30].map((value, index) => ({
    redemption_percent: value,
    executable: true,
    uncovered_percent: 0,
    estimated_slow_asset_sales_percent: index < 2 ? 0 : index === 2 ? 3.1 : 8.4,
    post_redemption_top_holding: { security: 'Orion Financial Services', weight: 11.6 + index * 0.7 },
    sale_plan: [
      { security: 'Cash and money market', sell_weight: Math.min(4.8, value), liquidity_days: 0 },
      ...(value > 4.8 ? [{ security: 'Large-cap liquid basket', sell_weight: Number((value - 4.8).toFixed(1)), liquidity_days: 2 }] : [])
    ],
    warnings: index >= 2 ? ['The remaining portfolio becomes more concentrated after the simulated sales.'] : []
  })),
  assumptions: ['Demonstration record only. Upload a portfolio CSV for calculated results.']
};

const DEMO_REGULATORY = {
  demo: true,
  kind: 'regulatory',
  title: 'Demonstration liquidity risk update',
  generated_at: '2026-07-20T05:30:00.000Z',
  engine: 'demonstration-data',
  summary: 'Demonstration only: three obligation-like statements affect liquidity, trustee reporting and investor disclosure.',
  affected_areas: ['Liquidity and redemption risk', 'Governance and approvals', 'Investor servicing and disclosure'],
  obligations: [
    { id: 'ro1', reference: 'Demo extract 1', obligation: 'The AMC must document periodic liquidity stress testing and escalation thresholds.', owner: 'Risk / Fund Management', due_date: 'Not explicit', status: 'Assessment required' },
    { id: 'ro2', reference: 'Demo extract 2', obligation: 'Material liquidity exceptions shall be reported to the trustees.', owner: 'Compliance / Operations', due_date: 'Not explicit', status: 'Assessment required' }
  ],
  action_plan: [
    { priority: 'Immediate', owner: 'Risk / Fund Management', action: 'Map current liquidity testing to the updated requirement.', due_date: 'Not explicit' },
    { priority: 'Immediate', owner: 'Compliance / Operations', action: 'Validate trustee escalation and evidence retention.', due_date: 'Not explicit' }
  ],
  evidence_pack: ['Source update', 'Obligation register', 'Control mapping', 'Closure evidence'],
  limitations: ['Demonstration record only.']
};

const NAV = [
  ['home', 'Command centre', LayoutDashboard],
  ['analyse', 'Upload & analyse', UploadCloud],
  ['portfolio', 'Portfolio intelligence', WalletCards],
  ['mandate', 'Mandate & restrictions', Target],
  ['regulatory', 'Regulatory impact', Landmark],
  ['decisions', 'Decision memory', History],
  ['control', 'AI control tower', BrainCircuit]
];

const ANALYSIS_TYPES = [
  { key: 'document', label: 'Institutional document', icon: FileSearch, description: 'Policies, proposals, reports, service-provider documents and governance records.' },
  { key: 'portfolio', label: 'Portfolio CSV', icon: BarChart3, description: 'Calculate exposures, concentrations, liquidity indicators and redemption scenarios.' },
  { key: 'mandate', label: 'Scheme mandate', icon: Target, description: 'Extract quantitative restrictions and test them against the active portfolio.' },
  { key: 'regulatory', label: 'Regulatory update', icon: Landmark, description: 'Map obligations, affected areas, owners and remediation actions.' }
];

function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadState() {
  try {
    const value = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function loadDecisions() {
  try {
    const value = JSON.parse(localStorage.getItem(DECISIONS_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
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

function riskClass(value = 'Low') {
  return `risk-badge ${String(value).toLowerCase()}`;
}

function download(name, value, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Synesis could not complete this request.');
  return data;
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
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }
  return file.text();
}

export default function InstitutionalApp() {
  const stored = useMemo(loadState, []);
  const [page, setPage] = useState('home');
  const [mobile, setMobile] = useState(false);
  const [notice, setNotice] = useState(null);
  const [health, setHealth] = useState(null);
  const [documentResult, setDocumentResult] = useState(stored.document || null);
  const [portfolio, setPortfolio] = useState(stored.portfolio || DEMO_PORTFOLIO);
  const [mandate, setMandate] = useState(stored.mandate || null);
  const [regulatory, setRegulatory] = useState(stored.regulatory || DEMO_REGULATORY);
  const [decisions, setDecisions] = useState(loadDecisions);
  const [recent, setRecent] = useState(stored.recent || []);

  useEffect(() => {
    api('/health').then(setHealth).catch(error => setHealth({ ok: false, error: error.message }));
  }, []);

  useEffect(() => {
    localStorage.setItem(STATE_KEY, JSON.stringify({ document: documentResult, portfolio, mandate, regulatory, recent: recent.slice(0, 30) }));
  }, [documentResult, portfolio, mandate, regulatory, recent]);

  useEffect(() => {
    localStorage.setItem(DECISIONS_KEY, JSON.stringify(decisions));
  }, [decisions]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(timer);
  }, [notice]);

  const attention = useMemo(() => {
    const items = [];
    (portfolio?.flags || []).slice(0, 5).forEach(item => items.push({ ...item, source: portfolio.demo ? 'Demonstration portfolio' : portfolio.title }));
    (mandate?.tests || []).filter(item => item.status === 'Breach').forEach(item => items.push({ severity: 'High', category: 'Mandate breach', title: `${item.label}: actual ${item.actual}% against ${item.limit}%`, action: item.explanation, source: mandate.title }));
    (documentResult?.findings || []).filter(item => item.severity === 'High').slice(0, 4).forEach(item => items.push({ severity: item.severity, category: item.category, title: item.title, action: item.action, source: documentResult.title }));
    (regulatory?.action_plan || []).filter(item => item.priority === 'Immediate').slice(0, 4).forEach(item => items.push({ severity: 'Medium', category: 'Regulatory action', title: item.action, action: `Owner: ${item.owner}`, source: regulatory.demo ? 'Demonstration update' : regulatory.title }));
    return items.slice(0, 12);
  }, [portfolio, mandate, documentResult, regulatory]);

  function navigate(value) {
    setPage(value);
    setMobile(false);
  }

  function saveResult(type, result) {
    if (type === 'document') setDocumentResult(result);
    if (type === 'portfolio') setPortfolio(result);
    if (type === 'mandate') setMandate(result);
    if (type === 'regulatory') setRegulatory(result);
    setRecent(current => [{ id: uid(), type, title: result.title, risk: result.overall_risk || (result.breach_count ? 'High' : 'Low'), at: result.generated_at, demo: false }, ...current]);
    setNotice({ type: 'success', message: `${result.title} was analysed from the uploaded source.` });
  }

  function resetDemo() {
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(DECISIONS_KEY);
    setDocumentResult(null);
    setPortfolio(DEMO_PORTFOLIO);
    setMandate(null);
    setRegulatory(DEMO_REGULATORY);
    setDecisions([]);
    setRecent([]);
    setNotice({ type: 'success', message: 'Prototype data was reset. Demonstration records are active.' });
    setPage('home');
  }

  return (
    <div className="institutional-shell">
      {mobile && <button className="screen-scrim" onClick={() => setMobile(false)} aria-label="Close navigation" />}
      <aside className={`institutional-sidebar ${mobile ? 'open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark">S</div>
          <div><strong>SYNESIS</strong><small>Institutional Intelligence</small></div>
          <button className="mobile-close" onClick={() => setMobile(false)}><X size={19} /></button>
        </div>
        <div className="client-chip">
          <Building2 size={18} />
          <div><small>ACTIVE ORGANISATION</small><strong>Synesis Demonstration AMC</strong></div>
        </div>
        <nav>
          {NAV.map(([key, label, Icon]) => (
            <button key={key} className={page === key ? 'active' : ''} onClick={() => navigate(key)}>
              <Icon size={19} /><span>{label}</span><ChevronRight size={15} />
            </button>
          ))}
        </nav>
        <div className="sidebar-status">
          <p><span className={health?.ok ? 'status-dot live' : 'status-dot'} /><strong>{health?.ok ? 'System reachable' : 'Checking system'}</strong></p>
          <small>{health?.aiConfigured ? `AI configured · ${health.model}` : 'External AI unavailable or not funded · deterministic engines remain active'}</small>
          <button onClick={resetDemo}><RefreshCw size={15} />Reset prototype</button>
        </div>
      </aside>

      <section className="institutional-main">
        <header className="institutional-topbar">
          <button className="menu-button" onClick={() => setMobile(true)}><Menu size={22} /></button>
          <div>
            <h1>{NAV.find(item => item[0] === page)?.[1] || 'Synesis'}</h1>
            <p>Capital · risk · regulation · governance · operations · evidence</p>
          </div>
          <button className="primary-button compact" onClick={() => navigate('analyse')}><UploadCloud size={17} />New analysis</button>
        </header>

        {notice && (
          <button className={`notice ${notice.type}`} onClick={() => setNotice(null)}>
            {notice.type === 'error' ? <CircleAlert size={18} /> : <CheckCircle2 size={18} />}
            <span>{notice.message}</span><X size={16} />
          </button>
        )}

        <main className="institutional-page">
          {page === 'home' && <CommandCentre attention={attention} portfolio={portfolio} regulatory={regulatory} mandate={mandate} documentResult={documentResult} recent={recent} health={health} navigate={navigate} />}
          {page === 'analyse' && <AnalysisWorkspace portfolio={portfolio} saveResult={saveResult} notify={setNotice} navigate={navigate} />}
          {page === 'portfolio' && <PortfolioWorkspace portfolio={portfolio} navigate={navigate} />}
          {page === 'mandate' && <MandateWorkspace mandate={mandate} portfolio={portfolio} navigate={navigate} />}
          {page === 'regulatory' && <RegulatoryWorkspace regulatory={regulatory} navigate={navigate} />}
          {page === 'decisions' && <DecisionMemory decisions={decisions} setDecisions={setDecisions} context={{ portfolio, mandate, documentResult, regulatory }} />}
          {page === 'control' && <ControlTower health={health} recent={recent} />}
        </main>
      </section>
    </div>
  );
}

function CommandCentre({ attention, portfolio, regulatory, mandate, documentResult, recent, health, navigate }) {
  const high = attention.filter(item => item.severity === 'High').length;
  return (
    <div className="page-stack">
      <section className="command-hero">
        <div>
          <span className="eyebrow">INSTITUTIONAL COMMAND</span>
          <h2>What requires a decision now?</h2>
          <p>Synesis converts uploaded institutional information into calculated exposures, mapped restrictions, evidence-linked risks and controlled next actions.</p>
          <div className="hero-actions">
            <button className="light-button" onClick={() => navigate('analyse')}><UploadCloud size={18} />Upload and analyse</button>
            <button className="ghost-button" onClick={() => navigate('portfolio')}>Review portfolio<ArrowRight size={17} /></button>
          </div>
        </div>
        <div className="hero-orbit"><Network size={50} /><span>Connected decision context</span></div>
      </section>

      <section className="metric-grid">
        <Metric icon={Gauge} label="Portfolio risk" value={`${portfolio?.overall_score ?? '—'}/100`} sub={portfolio?.demo ? 'Demonstration' : 'Uploaded calculation'} />
        <Metric icon={AlertTriangle} label="High-priority items" value={high} sub={`${attention.length} total attention items`} />
        <Metric icon={Target} label="Mandate breaches" value={mandate?.breach_count ?? '—'} sub={mandate ? `${mandate.rules?.length || 0} rules extracted` : 'No uploaded mandate'} />
        <Metric icon={Activity} label="System status" value={health?.ok ? 'Live' : 'Check'} sub={health?.aiConfigured ? 'AI and calculation engines' : 'Calculation engines active'} />
      </section>

      <section className="content-grid two-one">
        <article className="panel attention-panel">
          <PanelHeader title="Attention queue" subtitle="Generated from active uploaded analyses and clearly labelled demonstration data" />
          {attention.length ? attention.map((item, index) => (
            <div className="attention-item" key={`${item.title}-${index}`}>
              <span className={riskClass(item.severity)}>{item.severity}</span>
              <div><small>{item.category} · {item.source}</small><strong>{item.title}</strong><p>{item.action}</p></div>
              <ChevronRight size={18} />
            </div>
          )) : <Empty title="No active attention item" text="Upload a portfolio, mandate, document or regulatory update." />}
        </article>

        <aside className="panel system-panel">
          <PanelHeader title="Active institutional context" subtitle="One connected operating view" />
          <ContextRow icon={WalletCards} label="Portfolio" value={portfolio?.title || 'Not loaded'} demo={portfolio?.demo} />
          <ContextRow icon={Target} label="Mandate" value={mandate?.title || 'Not loaded'} />
          <ContextRow icon={Landmark} label="Regulatory" value={regulatory?.title || 'Not loaded'} demo={regulatory?.demo} />
          <ContextRow icon={FileText} label="Document" value={documentResult?.title || 'Not loaded'} />
          <button className="secondary-button wide" onClick={() => navigate('analyse')}>Update context<ArrowRight size={16} /></button>
        </aside>
      </section>

      <section className="content-grid equal">
        <article className="panel">
          <PanelHeader title="Portfolio snapshot" subtitle={portfolio?.demo ? 'Demonstration data — upload CSV for calculated results' : `Calculated from ${portfolio?.source_rows || 0} uploaded rows`} action={<button className="text-button" onClick={() => navigate('portfolio')}>Open<ArrowRight size={15} /></button>} />
          <div className="snapshot-list">
            <Snapshot label="Top issuer" value={`${portfolio?.issuer_exposure?.[0]?.name || '—'} · ${portfolio?.issuer_exposure?.[0]?.weight || 0}%`} />
            <Snapshot label="Top sector" value={`${portfolio?.sector_exposure?.[0]?.name || '—'} · ${portfolio?.sector_exposure?.[0]?.weight || 0}%`} />
            <Snapshot label="Cash / liquid" value={`${portfolio?.metrics?.cash_weight ?? 0}%`} />
            <Snapshot label="Slow liquidity" value={`${portfolio?.metrics?.slow_liquidity_weight ?? 0}%`} />
          </div>
        </article>
        <article className="panel">
          <PanelHeader title="Recent live analyses" subtitle="Stored only in this browser for the public prototype" />
          {recent.length ? recent.slice(0, 6).map(item => (
            <div className="recent-row" key={item.id}><span className={riskClass(item.risk || 'Low')}>{item.risk || 'Info'}</span><div><strong>{item.title}</strong><small>{item.type} · {formatDate(item.at)}</small></div></div>
          )) : <Empty title="No user analysis yet" text="Demonstration records do not count as a user analysis." />}
        </article>
      </section>
    </div>
  );
}

function AnalysisWorkspace({ portfolio, saveResult, notify, navigate }) {
  const [type, setType] = useState('portfolio');
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const stages = type === 'portfolio'
    ? ['Reading CSV', 'Normalising holdings', 'Calculating exposures', 'Running liquidity scenarios', 'Generating attention items']
    : ['Reading source', 'Classifying content', 'Extracting evidence', 'Mapping risks and obligations', 'Generating next actions'];

  useEffect(() => {
    setFile(null);
    setText('');
    setTitle('');
    setStage(0);
  }, [type]);

  useEffect(() => {
    if (!busy) return undefined;
    const timer = setInterval(() => setStage(current => Math.min(stages.length - 1, current + 1)), 850);
    return () => clearInterval(timer);
  }, [busy, stages.length]);

  async function selectFile(selected) {
    if (!selected) return;
    const allowed = type === 'portfolio' ? /\.(csv|txt)$/i : /\.(pdf|docx|txt|csv|json|md|xml)$/i;
    if (!allowed.test(selected.name)) {
      notify({ type: 'error', message: type === 'portfolio' ? 'Use a CSV file for portfolio analysis.' : 'Use PDF, DOCX, TXT, CSV, JSON, Markdown or XML.' });
      return;
    }
    setBusy(true);
    setStage(0);
    try {
      const extracted = await extractFileText(selected);
      if (extracted.trim().length < 20) throw new Error('The uploaded file does not contain enough readable content.');
      setFile(selected);
      setText(extracted.slice(0, type === 'portfolio' ? 600000 : 180000));
      setTitle(selected.name.replace(/\.[^.]+$/, ''));
      notify({ type: 'success', message: `${selected.name} was read from the uploaded file.` });
    } catch (error) {
      notify({ type: 'error', message: error.message });
    } finally {
      setBusy(false);
      setStage(0);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (text.trim().length < 20) {
      notify({ type: 'error', message: 'Upload a file or paste enough source content.' });
      return;
    }
    setBusy(true);
    setStage(0);
    try {
      const path = `/public/institutional/${type}`;
      const payload = { title: title || file?.name || `New ${type} analysis`, text };
      if (type === 'mandate') payload.portfolio = portfolio?.demo ? null : portfolio;
      const result = await api(path, { method: 'POST', body: JSON.stringify(payload) });
      saveResult(type, result.analysis);
      navigate(type === 'document' ? 'home' : type);
    } catch (error) {
      notify({ type: 'error', message: error.message });
    } finally {
      setBusy(false);
      setStage(0);
    }
  }

  return (
    <div className="analysis-layout">
      <section className="panel analysis-form-panel">
        <PanelHeader title="Choose the institutional task" subtitle="Each result is generated from the newly supplied source" />
        <div className="analysis-type-grid">
          {ANALYSIS_TYPES.map(item => (
            <button key={item.key} className={type === item.key ? 'active' : ''} onClick={() => setType(item.key)}>
              <item.icon size={22} /><div><strong>{item.label}</strong><small>{item.description}</small></div><ChevronRight size={17} />
            </button>
          ))}
        </div>
        <form onSubmit={submit}>
          <label className="file-drop">
            <input type="file" accept={type === 'portfolio' ? '.csv,.txt' : '.pdf,.docx,.txt,.csv,.json,.md,.xml'} onChange={event => selectFile(event.target.files?.[0])} />
            <UploadCloud size={32} />
            <strong>{file?.name || `Choose a ${type === 'portfolio' ? 'portfolio CSV' : 'source document'}`}</strong>
            <small>{type === 'portfolio' ? 'Weights or market value are required. Sector, rating and liquidity fields improve analysis.' : 'The extracted source remains visible and editable before analysis.'}</small>
          </label>
          <label className="field-label">Analysis title<input value={title} onChange={event => setTitle(event.target.value)} placeholder="Name this portfolio, mandate or review" /></label>
          <label className="field-label">Extracted source<textarea rows="13" value={text} onChange={event => setText(event.target.value)} placeholder={type === 'portfolio' ? 'issuer,security,sector,asset_class,market_value,weight,rating,liquidity_days' : 'Paste source text here…'} /></label>
          <button className="primary-button wide" disabled={busy}>
            {busy ? <><LoaderCircle className="spin" size={18} />Processing uploaded source…</> : <><Sparkles size={18} />Run live analysis</>}
          </button>
        </form>
      </section>

      <aside className="panel live-progress-panel">
        <PanelHeader title="Live processing" subtitle="No preset answer is substituted for the uploaded source" />
        <div className="progress-list">
          {stages.map((label, index) => (
            <div key={label} className={busy && index <= stage ? 'active' : index === 0 && text ? 'ready' : ''}>
              <span>{busy && index === stage ? <LoaderCircle className="spin" size={16} /> : index < stage ? <CheckCircle2 size={16} /> : index + 1}</span>
              <p><strong>{label}</strong><small>{index < stage ? 'Completed' : busy && index === stage ? 'In progress' : 'Pending'}</small></p>
            </div>
          ))}
        </div>
        <div className="boundary-note"><ShieldCheck size={18} /><p><strong>Evidence boundary</strong><span>Uploaded facts, calculated results and inferences are separated. Missing data is reported rather than invented.</span></p></div>
        {type === 'mandate' && <div className="context-warning"><Target size={18} /><p><strong>{portfolio?.demo ? 'No user portfolio linked' : 'Active portfolio linked'}</strong><span>{portfolio?.demo ? 'Upload a portfolio first to test extracted limits against actual holdings.' : portfolio.title}</span></p></div>}
      </aside>
    </div>
  );
}

function PortfolioWorkspace({ portfolio, navigate }) {
  const [scenarioIndex, setScenarioIndex] = useState(1);
  if (!portfolio) return <Empty title="No portfolio loaded" text="Upload a portfolio CSV to calculate exposures and scenarios." action={<button className="primary-button" onClick={() => navigate('analyse')}>Upload portfolio</button>} />;
  const scenario = portfolio.redemption_scenarios?.[scenarioIndex];
  return (
    <div className="page-stack">
      <section className="workspace-header">
        <div><span className="eyebrow">{portfolio.demo ? 'DEMONSTRATION RECORD' : 'UPLOADED PORTFOLIO'}</span><h2>{portfolio.title}</h2><p>{portfolio.demo ? 'This record illustrates the interface only. Upload a CSV for calculated results.' : `Calculated from ${portfolio.source_rows} uploaded rows at ${formatDate(portfolio.generated_at)}.`}</p></div>
        <div className="workspace-actions"><span className={riskClass(portfolio.overall_risk)}>{portfolio.overall_risk} · {portfolio.overall_score}/100</span><button className="secondary-button" onClick={() => download(`${portfolio.title}.json`, JSON.stringify(portfolio, null, 2))}><Download size={16} />Export</button></div>
      </section>
      <section className="metric-grid six">
        <Metric label="Holdings" value={portfolio.metrics?.holdings ?? 0} />
        <Metric label="Top issuer" value={`${portfolio.metrics?.top_holding_weight ?? 0}%`} />
        <Metric label="Top sector" value={`${portfolio.metrics?.top_sector_weight ?? 0}%`} />
        <Metric label="Cash / liquid" value={`${portfolio.metrics?.cash_weight ?? 0}%`} />
        <Metric label="Below AA-" value={`${portfolio.metrics?.below_aa_weight ?? 0}%`} />
        <Metric label="Slow liquidity" value={`${portfolio.metrics?.slow_liquidity_weight ?? 0}%`} />
      </section>
      <section className="content-grid equal">
        <Distribution title="Issuer concentration" items={portfolio.issuer_exposure} />
        <Distribution title="Sector exposure" items={portfolio.sector_exposure} />
      </section>
      <section className="content-grid two-one">
        <article className="panel">
          <PanelHeader title="Portfolio attention items" subtitle="Calculated from uploaded holdings and available fields" />
          {(portfolio.flags || []).length ? portfolio.flags.map(item => <FindingRow key={item.id} item={item} />) : <Empty title="No material threshold signal" text="This does not certify compliance; connect a mandate for rule testing." />}
        </article>
        <aside className="panel">
          <PanelHeader title="Data quality" subtitle="Reliability depends on supplied fields" />
          {(portfolio.data_gaps || []).length ? portfolio.data_gaps.map(item => <div className="gap-row" key={item}><CircleAlert size={17} /><span>{item}</span></div>) : <div className="positive-state"><CheckCircle2 size={24} /><strong>No major mapped data gap</strong><p>Available fields supported the current calculations.</p></div>}
        </aside>
      </section>
      <section className="panel">
        <PanelHeader title="Liquidity and redemption simulator" subtitle="Uses uploaded liquidity indicators and clearly stated assumptions" />
        <div className="scenario-tabs">{portfolio.redemption_scenarios?.map((item, index) => <button key={item.redemption_percent} className={scenarioIndex === index ? 'active' : ''} onClick={() => setScenarioIndex(index)}>{item.redemption_percent}% redemption</button>)}</div>
        {scenario && <div className="scenario-grid">
          <div className="scenario-summary"><span className={riskClass(scenario.warnings?.length ? 'Medium' : 'Low')}>{scenario.executable ? 'Mapped' : 'Incomplete'}</span><h3>{scenario.redemption_percent}% redemption scenario</h3><p>Slow-asset sales: <strong>{scenario.estimated_slow_asset_sales_percent}%</strong></p><p>Post-redemption top holding: <strong>{scenario.post_redemption_top_holding?.security || '—'} · {scenario.post_redemption_top_holding?.weight || 0}%</strong></p>{scenario.warnings?.map(item => <div className="inline-warning" key={item}><AlertTriangle size={16} />{item}</div>)}</div>
          <div className="sale-plan"><h3>Indicative sale sequence</h3>{scenario.sale_plan?.slice(0, 8).map((item, index) => <div key={`${item.security}-${index}`}><span>{index + 1}</span><p><strong>{item.security}</strong><small>Sell {item.sell_weight}% · {item.liquidity_days ?? 'No'} liquidity days</small></p></div>)}</div>
        </div>}
      </section>
      <section className="panel holdings-table-panel"><PanelHeader title="Top uploaded holdings" subtitle="Directly derived from source rows" /><div className="data-table"><div className="data-head"><span>Security</span><span>Issuer</span><span>Sector</span><span>Asset class</span><span>Weight</span><span>Liquidity</span></div>{portfolio.top_holdings?.map(item => <div key={`${item.row}-${item.security}`}><span><strong>{item.security}</strong><small>Row {item.row || 'demo'}</small></span><span>{item.issuer}</span><span>{item.sector}</span><span>{item.assetClass}</span><span>{item.weight}%</span><span>{item.liquidityDays || '—'} days</span></div>)}</div></section>
    </div>
  );
}

function MandateWorkspace({ mandate, portfolio, navigate }) {
  if (!mandate) return <Empty title="No mandate analysed" text="Upload a Scheme Information Document, investment mandate or internal limit policy. Synesis will extract supported percentage restrictions and test them against the active uploaded portfolio." action={<button className="primary-button" onClick={() => navigate('analyse')}>Analyse mandate</button>} />;
  return (
    <div className="page-stack">
      <section className="workspace-header"><div><span className="eyebrow">MANDATE COMPLIANCE</span><h2>{mandate.title}</h2><p>{mandate.summary}</p></div><span className={riskClass(mandate.overall_risk)}>{mandate.breach_count} breach{mandate.breach_count === 1 ? '' : 'es'}</span></section>
      <section className="metric-grid"><Metric label="Rules extracted" value={mandate.rules?.length || 0} /><Metric label="Rules tested" value={mandate.tests?.filter(item => item.status !== 'Not testable').length || 0} /><Metric label="Breaches" value={mandate.breach_count || 0} /><Metric label="Active portfolio" value={portfolio?.demo ? 'Demo only' : portfolio?.title || 'None'} /></section>
      <section className="panel"><PanelHeader title="Restriction tests" subtitle="Every test shows source evidence, actual metric and test result" />{mandate.tests?.length ? <div className="mandate-tests">{mandate.tests.map(item => <article key={item.id}><div><span className={item.status === 'Breach' ? riskClass('High') : item.status === 'Compliant' ? riskClass('Low') : riskClass('Medium')}>{item.status}</span><h3>{item.label}</h3><small>{item.reference}</small></div><blockquote>{item.evidence}</blockquote><dl><div><dt>Limit</dt><dd>{item.limit}%</dd></div><div><dt>Actual</dt><dd>{item.actual === null ? 'Not available' : `${item.actual}%`}</dd></div><div><dt>Variance</dt><dd>{item.variance === null ? '—' : `${item.variance}%`}</dd></div></dl><p>{item.explanation}</p></article>)}</div> : <Empty title="No supported quantitative rule extracted" text="The document may use a table, image or drafting style that requires manual rule configuration." />}</section>
      <section className="content-grid equal"><article className="panel"><PanelHeader title="Required actions" />{mandate.actions?.length ? mandate.actions.map((item, index) => <div className="action-row" key={index}><span>{index + 1}</span><div><strong>{item.action}</strong><small>{item.owner}</small><p>{item.evidence}</p></div></div>) : <div className="positive-state"><CheckCircle2 size={24} /><strong>No calculated breach in extracted rules</strong><p>Manual and qualitative mandate review remains required.</p></div>}</article><article className="panel"><PanelHeader title="Missing information" />{mandate.missing_information?.length ? mandate.missing_information.map(item => <div className="gap-row" key={item}><CircleAlert size={17} /><span>{item}</span></div>) : <div className="positive-state"><CheckCircle2 size={24} /><strong>Required mapped context available</strong></div>}</article></section>
    </div>
  );
}

function RegulatoryWorkspace({ regulatory, navigate }) {
  if (!regulatory) return <Empty title="No regulatory update analysed" text="Upload a circular, direction or policy update to map obligations, owners and remediation actions." action={<button className="primary-button" onClick={() => navigate('analyse')}>Analyse update</button>} />;
  return (
    <div className="page-stack">
      <section className="workspace-header"><div><span className="eyebrow">{regulatory.demo ? 'DEMONSTRATION RECORD' : 'UPLOADED REGULATORY SOURCE'}</span><h2>{regulatory.title}</h2><p>{regulatory.summary}</p></div><button className="secondary-button" onClick={() => download(`${regulatory.title}.json`, JSON.stringify(regulatory, null, 2))}><Download size={16} />Export pack</button></section>
      <section className="content-grid two-one"><article className="panel"><PanelHeader title="Obligations extracted" subtitle="Obligation-like statements are retained with source references" />{regulatory.obligations?.map(item => <article className="obligation-card" key={item.id}><div><span className={riskClass('Medium')}>{item.status}</span><small>{item.reference}</small></div><p>{item.obligation}</p><footer><span><Users size={15} />{item.owner}</span><span><Activity size={15} />Due: {item.due_date}</span></footer></article>)}</article><aside className="panel"><PanelHeader title="Affected operating areas" />{regulatory.affected_areas?.map(area => <div className="area-row" key={area}><Network size={17} /><span>{area}</span></div>)}<PanelHeader title="Detected dates" />{regulatory.detected_dates?.length ? regulatory.detected_dates.map(date => <span className="date-chip" key={date}>{date}</span>) : <p className="muted">No explicit supported date was extracted.</p>}</aside></section>
      <section className="panel"><PanelHeader title="Remediation plan" subtitle="High-risk execution remains subject to authorised approval" /><div className="remediation-grid">{regulatory.action_plan?.map((item, index) => <article key={index}><span className={item.priority === 'Immediate' ? riskClass('High') : riskClass('Medium')}>{item.priority}</span><h3>{item.action}</h3><p>{item.owner}</p><small>Due: {item.due_date}</small></article>)}</div></section>
      <section className="panel"><PanelHeader title="Regulator-ready evidence pack" /> <div className="evidence-grid">{regulatory.evidence_pack?.map((item, index) => <div key={item}><span>{index + 1}</span><strong>{item}</strong></div>)}</div></section>
    </div>
  );
}

function DecisionMemory({ decisions, setDecisions, context }) {
  const [form, setForm] = useState({ title: '', decision: 'Approved with conditions', owner: 'Investment Committee', rationale: '', conditions: '' });
  function submit(event) {
    event.preventDefault();
    if (!form.title.trim() || !form.rationale.trim()) return;
    const record = {
      id: uid(), ...form, created_at: new Date().toISOString(),
      context: {
        portfolio: context.portfolio?.title || null,
        mandate: context.mandate?.title || null,
        document: context.documentResult?.title || null,
        regulatory: context.regulatory?.title || null
      }
    };
    setDecisions(current => [record, ...current]);
    setForm({ title: '', decision: 'Approved with conditions', owner: 'Investment Committee', rationale: '', conditions: '' });
  }
  return (
    <div className="content-grid equal decision-layout">
      <form className="panel decision-form" onSubmit={submit}>
        <PanelHeader title="Record an institutional decision" subtitle="Preserve what was decided, why, by whom and against which active evidence" />
        <label className="field-label">Decision title<input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="e.g. Increase exposure subject to liquidity cap" /></label>
        <div className="field-row"><label className="field-label">Outcome<select value={form.decision} onChange={event => setForm({ ...form, decision: event.target.value })}><option>Approved</option><option>Approved with conditions</option><option>Deferred</option><option>Rejected</option><option>Escalated</option></select></label><label className="field-label">Decision owner<input value={form.owner} onChange={event => setForm({ ...form, owner: event.target.value })} /></label></div>
        <label className="field-label">Rationale<textarea rows="7" value={form.rationale} onChange={event => setForm({ ...form, rationale: event.target.value })} placeholder="State the evidence considered, alternatives, risk accepted and investor-interest rationale." /></label>
        <label className="field-label">Conditions and review triggers<textarea rows="4" value={form.conditions} onChange={event => setForm({ ...form, conditions: event.target.value })} placeholder="Conditions, limits, review date or thesis-breaking trigger." /></label>
        <div className="linked-context"><strong>Linked context</strong><span>{[context.portfolio?.title, context.mandate?.title, context.documentResult?.title, context.regulatory?.title].filter(Boolean).join(' · ')}</span></div>
        <button className="primary-button wide"><BookOpenCheck size={18} />Save decision record</button>
      </form>
      <section className="panel"><PanelHeader title="Institutional decision memory" subtitle="Browser-local prototype ledger" />{decisions.length ? <div className="decision-list">{decisions.map(item => <article key={item.id}><header><span className={item.decision === 'Rejected' ? riskClass('High') : item.decision === 'Approved' ? riskClass('Low') : riskClass('Medium')}>{item.decision}</span><small>{formatDate(item.created_at)}</small></header><h3>{item.title}</h3><p>{item.rationale}</p>{item.conditions && <blockquote>{item.conditions}</blockquote>}<footer><span>{item.owner}</span><small>{Object.values(item.context).filter(Boolean).join(' · ')}</small></footer></article>)}</div> : <Empty title="No decision recorded" text="Create the first evidence-linked institutional decision." />}</section>
    </div>
  );
}

function ControlTower({ health, recent }) {
  const agents = [
    { name: 'Portfolio Risk Agent', source: 'Uploaded holdings', permission: 'Calculate and recommend', approval: 'Required for action', active: true },
    { name: 'Mandate Compliance Agent', source: 'Mandate + active portfolio', permission: 'Extract and test rules', approval: 'Required for override', active: true },
    { name: 'Regulatory Impact Agent', source: 'Uploaded regulatory source', permission: 'Map obligations and tasks', approval: 'Required for closure', active: true },
    { name: 'Investment Committee Agent', source: 'Connected decision context', permission: 'Prepare proposal only', approval: 'Committee decision', active: false },
    { name: 'Operational Exception Agent', source: 'Incident and control data', permission: 'Prototype configuration', approval: 'Owner validation', active: false }
  ];
  return (
    <div className="page-stack">
      <section className="metric-grid"><Metric icon={BrainCircuit} label="Configured agents" value={agents.length} /><Metric icon={CheckCircle2} label="Active agents" value={agents.filter(item => item.active).length} /><Metric icon={Activity} label="Recorded analyses" value={recent.length} /><Metric icon={Database} label="Persistence" value="Browser-local" sub="Public prototype" /></section>
      <section className="content-grid equal"><article className="panel"><PanelHeader title="Connection and engine status" subtitle="No unavailable service is represented as live" /><StatusRow label="Public API" active={Boolean(health?.ok)} value={health?.ok ? 'Reachable' : health?.error || 'Unavailable'} /><StatusRow label="External AI" active={Boolean(health?.aiConfigured)} value={health?.aiConfigured ? `${health.model} configured` : 'Unavailable, invalid or out of quota'} /><StatusRow label="Portfolio calculation engine" active value="Server-calculated deterministic analysis" /><StatusRow label="Mandate mapping engine" active value="Server-side extraction and testing" /><StatusRow label="Regulatory impact engine" active value="Server-side source mapping" /><StatusRow label="Private database workspace" active={health?.privateWorkspace === 'configured-separately'} value={health?.privateWorkspace || 'Not configured'} /></article><article className="panel"><PanelHeader title="Governance boundaries" /><div className="governance-list"><Governance icon={ShieldCheck} title="Human approval" text="Recommendations do not execute trades, filings, investor communications or policy changes." /><Governance icon={Scale} title="Evidence separation" text="Uploaded facts, calculations, external configuration and inference are labelled separately." /><Governance icon={Database} title="Public prototype storage" text="Uploaded source text is processed for the request; saved result records remain in this browser." /><Governance icon={Settings2} title="Administrative disable" text="Inactive prototype agents cannot execute analysis until enabled in a production control plane." /></div></article></section>
      <section className="panel"><PanelHeader title="Agent inventory" subtitle="Prototype configuration with purpose, source, permissions and approval boundary" /><div className="agent-table"><div className="agent-head"><span>Agent</span><span>Permitted source</span><span>Permission</span><span>Approval</span><span>Status</span></div>{agents.map(item => <div key={item.name}><span><BrainCircuit size={17} /><strong>{item.name}</strong></span><span>{item.source}</span><span>{item.permission}</span><span>{item.approval}</span><span className={item.active ? 'agent-live' : 'agent-off'}>{item.active ? 'Enabled' : 'Disabled'}</span></div>)}</div></section>
    </div>
  );
}

function Distribution({ title, items = [] }) {
  const max = Math.max(1, ...items.map(item => item.weight || 0));
  return <article className="panel"><PanelHeader title={title} /><div className="distribution-list">{items.slice(0, 8).map(item => <div key={item.name}><header><span>{item.name}</span><strong>{item.weight}%</strong></header><div><span style={{ width: `${Math.max(2, (item.weight / max) * 100)}%` }} /></div></div>)}</div></article>;
}

function Metric({ icon: Icon, label, value, sub }) {
  return <div className="metric-card">{Icon && <span><Icon size={20} /></span>}<strong>{value}</strong><small>{label}</small>{sub && <p>{sub}</p>}</div>;
}

function PanelHeader({ title, subtitle, action }) {
  return <header className="panel-header"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action}</header>;
}

function ContextRow({ icon: Icon, label, value, demo }) {
  return <div className="context-row"><span><Icon size={18} /></span><div><small>{label}{demo ? ' · DEMO' : ''}</small><strong>{value}</strong></div></div>;
}

function Snapshot({ label, value }) {
  return <div><small>{label}</small><strong>{value}</strong></div>;
}

function FindingRow({ item }) {
  return <div className="finding-row"><span className={riskClass(item.severity)}>{item.severity}</span><div><small>{item.category}</small><strong>{item.title}</strong><p>{item.action}</p><blockquote>{item.evidence}</blockquote></div></div>;
}

function StatusRow({ label, active, value }) {
  return <div className="status-row"><span className={active ? 'status-dot live' : 'status-dot'} /><div><strong>{label}</strong><small>{value}</small></div></div>;
}

function Governance({ icon: Icon, title, text }) {
  return <div><span><Icon size={19} /></span><p><strong>{title}</strong><small>{text}</small></p></div>;
}

function Empty({ title, text, action }) {
  return <div className="empty-state"><div><Search size={28} /></div><h3>{title}</h3><p>{text}</p>{action}</div>;
}
