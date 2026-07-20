import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, BookOpenCheck, BrainCircuit, BriefcaseBusiness,
  Building2, CheckCircle2, ChevronRight, CircleAlert, ClipboardCheck, Cpu, Database, Download,
  FileSearch, FileText, Gauge, History, Landmark, Layers3, LayoutDashboard, LoaderCircle, Menu,
  Network, PlayCircle, RefreshCw, Scale, Search, Settings2, Shield, ShieldCheck, Sparkles, Target,
  UploadCloud, Users, WalletCards, X, Zap
} from 'lucide-react';

const API = '/api';
const STATE_KEY = 'synesis-unified-institutional-v1';
const MEMORY_KEY = 'synesis-unified-memory-v1';

const NAV = [
  ['command', 'Command centre', LayoutDashboard],
  ['work', 'Analyse & work', UploadCloud],
  ['simulation', 'Simulation lab', PlayCircle],
  ['graph', 'Institutional graph', Network],
  ['memory', 'Decision memory', History],
  ['agents', 'Agent studio', BrainCircuit],
  ['control', 'AI control tower', ShieldCheck]
];

const TASKS = [
  { key: 'agreement', label: 'Review an agreement', detail: 'Rights, obligations, value leakage, negotiation position and operational dependency.', icon: FileSearch, type: 'document' },
  { key: 'regulation', label: 'Assess regulatory change', detail: 'Obligations, affected controls, owners, remediation and evidence.', icon: Landmark, type: 'regulatory' },
  { key: 'approval', label: 'Prepare an approval', detail: 'Decision thesis, authority, conditions, dependencies and completion evidence.', icon: ClipboardCheck, type: 'document' },
  { key: 'incident', label: 'Investigate an incident', detail: 'Fact pattern, affected stakeholders, control failure, response and escalation.', icon: Activity, type: 'document' },
  { key: 'capital', label: 'Assess capital or mandate risk', detail: 'Portfolio, liquidity, mandate, valuation, conflict and investor-interest implications.', icon: WalletCards, type: 'portfolio' },
  { key: 'service', label: 'Assess service-provider exposure', detail: 'SLA, concentration, continuity, cyber, exit and contractual remedy.', icon: Building2, type: 'document' },
  { key: 'cyber', label: 'Assess cyber or data event', detail: 'Data, systems, operations, notifications, stakeholders and recovery.', icon: Cpu, type: 'document' },
  { key: 'matter', label: 'Open any institutional matter', detail: 'Analyse any institutional document, dataset, event or decision context.', icon: Layers3, type: 'document' }
];

const ANALYSIS_TYPES = [
  { key: 'document', label: 'Institutional document', icon: FileText, description: 'Agreement, policy, proposal, incident record, opinion, report or governance material.' },
  { key: 'portfolio', label: 'Portfolio or exposure CSV', icon: BarChart3, description: 'Holdings, counterparties, business exposures or any weighted institutional dataset.' },
  { key: 'mandate', label: 'Mandate or restriction document', icon: Target, description: 'Extract testable restrictions and compare with an active uploaded portfolio.' },
  { key: 'regulatory', label: 'Regulatory or policy update', icon: Landmark, description: 'Map obligations, affected functions, owners, actions and evidence.' }
];

const SCENARIO_TYPES = [
  ['regulatory', 'Regulatory change or supervisory action'],
  ['liquidity', 'Liquidity, redemption or funding stress'],
  ['cyber', 'Cyber, data or technology incident'],
  ['counterparty', 'Counterparty, issuer or service-provider failure'],
  ['contract', 'Contract termination, breach or value leakage'],
  ['sanctions', 'Sanctions, AML or prohibited-party event'],
  ['litigation', 'Litigation, enforcement or investigation'],
  ['governance', 'Governance, authority or conflict event'],
  ['market', 'Market, valuation or portfolio shock'],
  ['operational', 'Operational outage or control failure'],
  ['generic', 'Cross-functional institutional event']
];

const FUNCTIONS = [
  'Investment / Asset Management', 'Risk', 'Compliance', 'Legal', 'Operations', 'Finance / Credit',
  'Treasury', 'KYC / AML', 'Technology', 'Information Security', 'Data Protection', 'Procurement',
  'Company Secretariat', 'Board / Trustees', 'Investor / Customer Relations', 'Management'
];

function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStored(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
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
  const normalised = String(value).toLowerCase();
  if (normalised === 'critical') return 'risk-badge high';
  return `risk-badge ${normalised}`;
}

function download(name, value, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name.replace(/[^a-z0-9._-]+/gi, '-');
  anchor.click();
  URL.revokeObjectURL(url);
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; }
  catch { data = { error: text || 'Unexpected response.' }; }
  if (!response.ok) throw new Error(data.error || data.detail || 'Synesis could not complete this request.');
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
    return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  }
  return file.text();
}

export default function InstitutionalApp() {
  const stored = useMemo(() => readStored(STATE_KEY, {}), []);
  const initialPage = globalThis.location?.pathname === '/simulation' ? 'simulation' : 'command';
  const [page, setPage] = useState(initialPage);
  const [mobile, setMobile] = useState(false);
  const [health, setHealth] = useState(null);
  const [notice, setNotice] = useState(null);
  const [analysisType, setAnalysisType] = useState('document');
  const [portfolio, setPortfolio] = useState(stored.portfolio || null);
  const [mandate, setMandate] = useState(stored.mandate || null);
  const [documentResult, setDocumentResult] = useState(stored.document || null);
  const [regulatory, setRegulatory] = useState(stored.regulatory || null);
  const [simulations, setSimulations] = useState(stored.simulations || []);
  const [recent, setRecent] = useState(stored.recent || []);
  const [memory, setMemory] = useState(() => readStored(MEMORY_KEY, []));

  useEffect(() => {
    api('/health').then(setHealth).catch(error => setHealth({ ok: false, error: error.message }));
  }, []);

  useEffect(() => {
    localStorage.setItem(STATE_KEY, JSON.stringify({ portfolio, mandate, document: documentResult, regulatory, simulations: simulations.slice(0, 20), recent: recent.slice(0, 40) }));
  }, [portfolio, mandate, documentResult, regulatory, simulations, recent]);

  useEffect(() => { localStorage.setItem(MEMORY_KEY, JSON.stringify(memory)); }, [memory]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(timer);
  }, [notice]);

  const context = useMemo(() => ({ portfolio, mandate, document: documentResult, regulatory }), [portfolio, mandate, documentResult, regulatory]);
  const activeSimulation = simulations[0] || null;

  const attention = useMemo(() => {
    const items = [];
    (documentResult?.findings || []).slice(0, 5).forEach(item => items.push({
      severity: item.severity || item.risk_level || 'Medium',
      area: item.category || 'Institutional document',
      title: item.title || item.issue,
      action: item.action || item.recommended_mitigation,
      source: documentResult.title
    }));
    (portfolio?.flags || []).slice(0, 5).forEach(item => items.push({ severity: item.severity, area: item.category, title: item.title, action: item.action, source: portfolio.title }));
    (mandate?.tests || []).filter(item => item.status === 'Breach').forEach(item => items.push({ severity: 'High', area: 'Mandate breach', title: `${item.label}: ${item.actual}% against ${item.limit}%`, action: item.explanation, source: mandate.title }));
    (regulatory?.action_plan || []).filter(item => item.priority === 'Immediate').slice(0, 4).forEach(item => items.push({ severity: 'Medium', area: 'Regulatory action', title: item.action, action: `Owner: ${item.owner}`, source: regulatory.title }));
    (activeSimulation?.actions || []).filter(item => item.priority === 'Immediate').slice(0, 3).forEach(item => items.push({ severity: activeSimulation.overall_level === 'Critical' ? 'High' : 'Medium', area: 'Simulation action', title: item.action, action: `Approval: ${item.approval_gate}`, source: activeSimulation.title }));
    return items.slice(0, 14);
  }, [documentResult, portfolio, mandate, regulatory, activeSimulation]);

  function navigate(next) {
    setPage(next);
    setMobile(false);
    const path = next === 'simulation' ? '/simulation' : '/';
    if (globalThis.location?.pathname !== path) globalThis.history?.replaceState({}, '', path);
  }

  function startTask(task) {
    setAnalysisType(task.type);
    navigate(task.type === 'portfolio' ? 'work' : 'work');
  }

  function saveAnalysis(type, result) {
    if (type === 'document') setDocumentResult(result);
    if (type === 'portfolio') setPortfolio(result);
    if (type === 'mandate') setMandate(result);
    if (type === 'regulatory') setRegulatory(result);
    setRecent(current => [{ id: uid(), type, title: result.title, risk: result.overall_risk || (result.breach_count ? 'High' : 'Low'), at: result.generated_at }, ...current]);
    setNotice({ type: 'success', message: `${result.title} was generated from the newly supplied source.` });
  }

  function resetPrototype() {
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(MEMORY_KEY);
    setPortfolio(null);
    setMandate(null);
    setDocumentResult(null);
    setRegulatory(null);
    setSimulations([]);
    setRecent([]);
    setMemory([]);
    navigate('command');
    setNotice({ type: 'success', message: 'Prototype data was reset.' });
  }

  const title = NAV.find(item => item[0] === page)?.[1] || 'Synesis';

  return (
    <div className="institutional-shell">
      {mobile && <button className="screen-scrim" onClick={() => setMobile(false)} aria-label="Close navigation" />}
      <aside className={`institutional-sidebar ${mobile ? 'open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark">S</div>
          <div><strong>SYNESIS</strong><small>Institutional Intelligence</small></div>
          <button className="mobile-close" onClick={() => setMobile(false)}><X size={19} /></button>
        </div>
        <div className="client-chip"><BriefcaseBusiness size={18} /><div><small>PLATFORM CATEGORY</small><strong>Decision intelligence and execution</strong></div></div>
        <nav>{NAV.map(([key, label, Icon]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => navigate(key)}><Icon size={19} /><span>{label}</span><ChevronRight size={15} /></button>)}</nav>
        <div className="sidebar-status">
          <p><span className={health?.ok ? 'status-dot live' : 'status-dot'} /><strong>{health?.ok ? 'Platform reachable' : 'Checking platform'}</strong></p>
          <small>{health?.activeEngines?.length || 0} institutional engines · {health?.aiConfigured ? `AI configured (${health.model})` : 'AI unavailable; deterministic engines active'}</small>
          <button onClick={resetPrototype}><RefreshCw size={15} />Reset prototype</button>
        </div>
      </aside>

      <section className="institutional-main">
        <header className="institutional-topbar">
          <button className="menu-button" onClick={() => setMobile(true)}><Menu size={22} /></button>
          <div><h1>{title}</h1><p>Capital · contracts · risk · regulation · governance · operations · evidence</p></div>
          <button className="primary-button compact" onClick={() => navigate('work')}><Zap size={16} />Start work</button>
        </header>

        {notice && <button className={`notice ${notice.type}`} onClick={() => setNotice(null)}>{notice.type === 'error' ? <CircleAlert size={18} /> : <CheckCircle2 size={18} />}<span>{notice.message}</span><X size={16} /></button>}

        <main className="institutional-page">
          {page === 'command' && <CommandCentre attention={attention} context={context} simulation={activeSimulation} recent={recent} health={health} startTask={startTask} navigate={navigate} />}
          {page === 'work' && <WorkStudio initialType={analysisType} setInitialType={setAnalysisType} context={context} saveAnalysis={saveAnalysis} notify={setNotice} />}
          {page === 'simulation' && <SimulationLab context={context} simulations={simulations} setSimulations={setSimulations} notify={setNotice} />}
          {page === 'graph' && <InstitutionalGraph context={context} simulation={activeSimulation} navigate={navigate} />}
          {page === 'memory' && <DecisionMemory memory={memory} setMemory={setMemory} recent={recent} simulations={simulations} context={context} />}
          {page === 'agents' && <AgentStudio context={context} />}
          {page === 'control' && <ControlTower health={health} recent={recent} simulations={simulations} />}
        </main>
      </section>
    </div>
  );
}

function CommandCentre({ attention, context, simulation, recent, health, startTask, navigate }) {
  const activeContext = [context.document, context.portfolio, context.mandate, context.regulatory].filter(Boolean).length;
  return <div className="page-stack">
    <section className="command-hero"><div><span className="eyebrow">UNIFIED INSTITUTIONAL OPERATING LAYER</span><h2>Start with the decision, not the department.</h2><p>Synesis connects documents, data, obligations, entities, controls, evidence, capital and institutional memory. Asset management is one solution pack within a wider platform for banks, NBFCs, funds, insurers, corporates and regulated teams.</p><div className="hero-actions"><button className="light-button" onClick={() => navigate('work')}><UploadCloud size={18} />Upload and analyse</button><button className="ghost-button" onClick={() => navigate('simulation')}><PlayCircle size={18} />Run a simulation</button></div></div><div className="hero-orbit"><Network size={50} /><span>Connected institutional context</span></div></section>
    <section className="metric-grid"><Metric icon={Gauge} label="Attention items" value={attention.length} sub="Across all active contexts" /><Metric icon={Database} label="Connected contexts" value={activeContext} sub="Document, portfolio, mandate, regulation" /><Metric icon={PlayCircle} label="Latest simulation" value={simulation ? `${simulation.overall_score}/100` : 'Not run'} sub={simulation?.overall_level || 'No scenario yet'} /><Metric icon={Activity} label="Platform status" value={health?.ok ? 'Live' : 'Check'} sub={`${health?.activeEngines?.length || 0} engines reported`} /></section>
    <section className="panel"><PanelHeader title="What do you need to do?" subtitle="One platform, multiple institutional work types" /><div className="task-grid">{TASKS.map(task => <button key={task.key} onClick={() => startTask(task)}><span><task.icon size={22} /></span><div><strong>{task.label}</strong><small>{task.detail}</small></div><ArrowRight size={17} /></button>)}</div></section>
    <section className="content-grid two-one"><article className="panel"><PanelHeader title="What needs attention" subtitle="Evidence-linked items from active analyses and simulations" />{attention.length ? attention.map((item, index) => <div className="attention-item" key={`${item.title}-${index}`}><span className={riskClass(item.severity)}>{item.severity}</span><div><small>{item.area} · {item.source}</small><strong>{item.title}</strong><p>{item.action}</p></div><ChevronRight size={17} /></div>) : <Empty title="No active attention item" text="Upload institutional material or run a simulation." />}</article><aside className="panel"><PanelHeader title="Active context" subtitle="Used by simulations and grounded analysis" /><ContextRow icon={FileText} label="Institutional document" value={context.document?.title || 'Not loaded'} /><ContextRow icon={WalletCards} label="Portfolio / exposure data" value={context.portfolio?.title || 'Not loaded'} /><ContextRow icon={Target} label="Mandate / restrictions" value={context.mandate?.title || 'Not loaded'} /><ContextRow icon={Landmark} label="Regulatory update" value={context.regulatory?.title || 'Not loaded'} /><button className="secondary-button wide" onClick={() => navigate('work')}>Update context<ArrowRight size={16} /></button></aside></section>
    <section className="content-grid equal"><article className="panel"><PanelHeader title="Latest simulation" subtitle="Cross-functional scenario result" action={<button className="text-button" onClick={() => navigate('simulation')}>Open lab<ArrowRight size={15} /></button>} />{simulation ? <><div className="simulation-summary-mini"><span className={riskClass(simulation.overall_level)}>{simulation.overall_level}</span><h3>{simulation.title}</h3><p>{simulation.executive_position}</p><dl><div><dt>Score</dt><dd>{simulation.overall_score}/100</dd></div><div><dt>Context lift</dt><dd>{simulation.context_used?.context_risk_lift || 0}</dd></div><div><dt>Immediate gates</dt><dd>{simulation.actions?.filter(item => item.priority === 'Immediate').length || 0}</dd></div></dl></div></> : <Empty title="No simulation yet" text="Model a regulatory, market, cyber, sanctions, contractual, governance or operational event." />}</article><article className="panel"><PanelHeader title="Recent activity" subtitle="Public prototype records stored in this browser" />{recent.length ? recent.slice(0, 7).map(item => <div className="recent-row" key={item.id}><span className={riskClass(item.risk || 'Low')}>{item.risk || 'Info'}</span><div><strong>{item.title}</strong><small>{item.type} · {formatDate(item.at)}</small></div></div>) : <Empty title="No user analysis yet" text="Start with any institutional task." />}</article></section>
  </div>;
}

function WorkStudio({ initialType, setInitialType, context, saveAnalysis, notify }) {
  const [type, setType] = useState(initialType || 'document');
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const stages = type === 'portfolio' ? ['Read dataset', 'Normalise rows', 'Calculate exposures', 'Run liquidity scenarios', 'Generate attention items'] : ['Read source', 'Classify evidence', 'Extract institutional signals', 'Map decisions and actions', 'Generate result'];

  useEffect(() => { setType(initialType || 'document'); }, [initialType]);
  useEffect(() => { setInitialType(type); setFile(null); setTitle(''); setText(''); setStage(0); }, [type, setInitialType]);
  useEffect(() => { if (!busy) return undefined; const timer = setInterval(() => setStage(current => Math.min(stages.length - 1, current + 1)), 800); return () => clearInterval(timer); }, [busy, stages.length]);

  async function selectFile(selected) {
    if (!selected) return;
    const allowed = type === 'portfolio' ? /\.(csv|txt)$/i : /\.(pdf|docx|txt|csv|json|md|xml)$/i;
    if (!allowed.test(selected.name)) return notify({ type: 'error', message: type === 'portfolio' ? 'Use a CSV or text dataset.' : 'Use PDF, DOCX, TXT, CSV, JSON, Markdown or XML.' });
    setBusy(true);
    try {
      const extracted = await extractFileText(selected);
      if (extracted.trim().length < 20) throw new Error('The file does not contain enough readable content.');
      setFile(selected); setText(extracted.slice(0, type === 'portfolio' ? 600000 : 180000)); setTitle(selected.name.replace(/\.[^.]+$/, ''));
      notify({ type: 'success', message: `${selected.name} was read from the uploaded source.` });
    } catch (error) { notify({ type: 'error', message: error.message }); }
    finally { setBusy(false); setStage(0); }
  }

  async function submit(event) {
    event.preventDefault();
    if (text.trim().length < 20) return notify({ type: 'error', message: 'Upload a file or paste enough source content.' });
    setBusy(true); setStage(0);
    try {
      const payload = { title: title || file?.name || `New ${type} analysis`, text };
      if (type === 'mandate') payload.portfolio = context.portfolio;
      const result = await api(`/public/institutional/${type}`, { method: 'POST', body: JSON.stringify(payload) });
      saveAnalysis(type, result.analysis);
    } catch (error) { notify({ type: 'error', message: error.message }); }
    finally { setBusy(false); setStage(0); }
  }

  return <div className="analysis-layout"><section className="panel analysis-form-panel"><PanelHeader title="Analyse live institutional material" subtitle="The output is generated from the newly supplied source, not from stored sample answers" /><div className="analysis-type-grid">{ANALYSIS_TYPES.map(item => <button key={item.key} className={type === item.key ? 'active' : ''} onClick={() => setType(item.key)}><item.icon size={22} /><div><strong>{item.label}</strong><small>{item.description}</small></div><ChevronRight size={17} /></button>)}</div><form onSubmit={submit}><label className="file-drop"><input type="file" accept={type === 'portfolio' ? '.csv,.txt' : '.pdf,.docx,.txt,.csv,.json,.md,.xml'} onChange={event => selectFile(event.target.files?.[0])} /><UploadCloud size={32} /><strong>{file?.name || 'Choose or drop a source'}</strong><small>{type === 'portfolio' ? 'Use weights or market values. Optional sector, rating and liquidity fields improve analysis.' : 'The extracted source remains visible before analysis.'}</small></label><label className="field-label">Analysis title<input value={title} onChange={event => setTitle(event.target.value)} /></label><label className="field-label">Extracted source<textarea rows="14" value={text} onChange={event => setText(event.target.value)} placeholder={type === 'portfolio' ? 'issuer,security,sector,asset_class,market_value,weight,rating,liquidity_days' : 'Paste institutional source text…'} /></label><button className="primary-button wide" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18} />Processing source…</> : <><Sparkles size={18} />Run live analysis</>}</button></form></section><aside className="panel live-progress-panel"><PanelHeader title="Live processing" subtitle="Visible source-bound stages" /><div className="progress-list">{stages.map((label, index) => <div key={label} className={busy && index <= stage ? 'active' : index === 0 && text ? 'ready' : ''}><span>{busy && index === stage ? <LoaderCircle className="spin" size={16} /> : index < stage ? <CheckCircle2 size={16} /> : index + 1}</span><p><strong>{label}</strong><small>{index < stage ? 'Completed' : busy && index === stage ? 'In progress' : 'Pending'}</small></p></div>)}</div><div className="boundary-note"><ShieldCheck size={18} /><p><strong>Evidence boundary</strong><span>Source facts, calculations, inferences and missing data are kept distinct.</span></p></div>{type === 'mandate' && <div className="context-warning"><Target size={18} /><p><strong>{context.portfolio ? 'Active portfolio linked' : 'No portfolio linked'}</strong><span>{context.portfolio?.title || 'Upload portfolio data first to test extracted restrictions.'}</span></p></div>}</aside></div>;
}

function SimulationLab({ context, simulations, setSimulations, notify }) {
  const [form, setForm] = useState({ scenarioType: 'regulatory', title: 'Regulatory change affecting multiple institutional functions', probability: 3, severity: 4, speed: 3, durationDays: 30, controlStrength: 2, financialExposure: '', trigger: '', affectedFunctions: ['Risk', 'Compliance', 'Operations', 'Management'], controlsText: '' });
  const [busy, setBusy] = useState(false);
  const [variantIndex, setVariantIndex] = useState(1);
  const simulation = simulations[0] || null;
  const variant = simulation?.variants?.[variantIndex];

  function toggleFunction(value) {
    setForm(current => ({ ...current, affectedFunctions: current.affectedFunctions.includes(value) ? current.affectedFunctions.filter(item => item !== value) : [...current.affectedFunctions, value] }));
  }

  async function run(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, financialExposure: Number(form.financialExposure || 0), controls: form.controlsText.split('\n').map(item => item.trim()).filter(Boolean), context };
      const result = await api('/public/institutional/simulate', { method: 'POST', body: JSON.stringify(payload) });
      setSimulations(current => [result.analysis, ...current].slice(0, 20));
      setVariantIndex(1);
      notify({ type: 'success', message: `Simulation completed: ${result.analysis.overall_level} adverse-case impact.` });
    } catch (error) { notify({ type: 'error', message: error.message }); }
    finally { setBusy(false); }
  }

  return <div className="simulation-lab"><section className="panel simulation-builder"><PanelHeader title="Build institutional scenario" subtitle="Model any cross-functional event against active uploaded context" /><form onSubmit={run}><label className="field-label">Scenario type<select value={form.scenarioType} onChange={event => setForm({ ...form, scenarioType: event.target.value })}>{SCENARIO_TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="field-label">Scenario title<input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label><label className="field-label">Trigger and factual assumptions<textarea rows="5" value={form.trigger} onChange={event => setForm({ ...form, trigger: event.target.value })} placeholder="Describe what happens, which object is affected and what is known or assumed." /></label><div className="slider-grid"><Slider label="Probability" value={form.probability} onChange={value => setForm({ ...form, probability: value })} /><Slider label="Severity" value={form.severity} onChange={value => setForm({ ...form, severity: value })} /><Slider label="Speed of impact" value={form.speed} onChange={value => setForm({ ...form, speed: value })} /><Slider label="Control strength" value={form.controlStrength} onChange={value => setForm({ ...form, controlStrength: value })} /></div><div className="field-row"><label className="field-label">Duration (days)<input type="number" min="1" max="3650" value={form.durationDays} onChange={event => setForm({ ...form, durationDays: Number(event.target.value) })} /></label><label className="field-label">Financial exposure, optional<input type="number" min="0" value={form.financialExposure} onChange={event => setForm({ ...form, financialExposure: event.target.value })} placeholder="Use source currency" /></label></div><label className="field-label">Affected functions</label><div className="function-chips">{FUNCTIONS.map(item => <button type="button" key={item} className={form.affectedFunctions.includes(item) ? 'active' : ''} onClick={() => toggleFunction(item)}>{item}</button>)}</div><label className="field-label">Existing controls, one per line<textarea rows="4" value={form.controlsText} onChange={event => setForm({ ...form, controlsText: event.target.value })} placeholder="Incident response plan\nLiquidity buffer\nTermination assistance\nBoard escalation protocol" /></label><div className="linked-context"><strong>Linked active context</strong><span>{[context.document?.title, context.portfolio?.title, context.mandate?.title, context.regulatory?.title].filter(Boolean).join(' · ') || 'No uploaded context linked'}</span></div><button className="primary-button wide" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18} />Running institutional model…</> : <><PlayCircle size={18} />Run live simulation</>}</button></form></section><section className="simulation-output">{simulation ? <><section className="workspace-header simulation-head"><div><span className="eyebrow">{simulation.scenario_label.toUpperCase()}</span><h2>{simulation.title}</h2><p>{simulation.executive_position}</p></div><div className="workspace-actions"><span className={riskClass(simulation.overall_level)}>{simulation.overall_level} · {simulation.overall_score}/100</span><button className="secondary-button" onClick={() => download(`${simulation.title}.json`, JSON.stringify(simulation, null, 2))}><Download size={16} />Export</button></div></section><section className="panel"><div className="scenario-tabs">{simulation.variants.map((item, index) => <button key={item.name} className={variantIndex === index ? 'active' : ''} onClick={() => setVariantIndex(index)}>{item.name}</button>)}</div>{variant && <div className="metric-grid six"><Metric label="Impact score" value={`${variant.overall_score}/100`} /><Metric label="Impact level" value={variant.level} /><Metric label="Time to critical" value={`${variant.time_to_critical_hours}h`} /><Metric label="Continuity" value={`${variant.continuity_index}/100`} /><Metric label="Stakeholder impact" value={`${variant.stakeholder_impact_index}/100`} /><Metric label="Regulatory urgency" value={`${variant.regulatory_urgency_index}/100`} /></div>}</section><section className="content-grid equal"><article className="panel"><PanelHeader title="Affected domains" subtitle="Calculated from scenario parameters, controls and active context" /><div className="distribution-list">{variant?.affected_domains?.map(item => <div key={item.domain}><header><span>{item.domain.replaceAll('_', ' ')}</span><strong>{item.score.toFixed(1)}</strong></header><div><span style={{ width: `${Math.max(2, item.score)}%` }} /></div></div>)}</div></article><article className="panel"><PanelHeader title="Cascade path" subtitle="Likely sequence requiring controlled institutional response" /><div className="cascade-list">{simulation.cascade.map(item => <div key={item.id}><span>{item.sequence}</span><p><strong>{item.event}</strong><small>{item.state} · starts about {item.estimated_start_hours}h · {item.owner}</small></p></div>)}</div></article></section><section className="content-grid two-one"><article className="panel"><PanelHeader title="Decision gates and controlled actions" subtitle="No action is represented as completed" />{simulation.actions.map(item => <div className="action-row" key={item.id}><span>{item.priority === 'Immediate' ? '!' : item.priority === 'High' ? 'H' : 'P'}</span><div><strong>{item.action}</strong><small>{item.owner} · {item.approval_gate}</small><p>Completion evidence: {item.completion_evidence}</p></div></div>)}</article><aside className="panel"><PanelHeader title="Evidence gaps" subtitle="Missing facts that reduce reliability" />{simulation.evidence_gaps.length ? simulation.evidence_gaps.map(item => <div className="gap-row" key={item}><CircleAlert size={17} /><span>{item}</span></div>) : <div className="positive-state"><CheckCircle2 size={24} /><strong>No major input gap detected</strong></div>}<PanelHeader title="Model boundary" />{simulation.assumptions.map(item => <div className="gap-row neutral" key={item}><Shield size={17} /><span>{item}</span></div>)}</aside></section></> : <Empty title="Build and run a scenario" text="The simulation can combine document findings, portfolio exposure, mandate breaches and regulatory actions with your scenario assumptions." action={<PlayCircle size={32} />} />}</section></div>;
}

function InstitutionalGraph({ context, simulation, navigate }) {
  const nodes = [
    { label: 'Institution', type: 'core', detail: 'Decision and accountability centre' },
    context.document && { label: context.document.title, type: 'document', detail: `${context.document.findings?.length || 0} finding(s)` },
    context.portfolio && { label: context.portfolio.title, type: 'capital', detail: `${context.portfolio.metrics?.holdings || 0} mapped exposure(s)` },
    context.mandate && { label: context.mandate.title, type: 'mandate', detail: `${context.mandate.breach_count || 0} breach(es)` },
    context.regulatory && { label: context.regulatory.title, type: 'regulatory', detail: `${context.regulatory.obligations?.length || 0} obligation(s)` },
    simulation && { label: simulation.title, type: 'simulation', detail: `${simulation.overall_level} · ${simulation.overall_score}/100` },
    { label: 'People & authority', type: 'people', detail: 'Owners, approvers and decision gates' },
    { label: 'Controls & evidence', type: 'controls', detail: 'Preventive, detective and closure evidence' },
    { label: 'Stakeholders', type: 'stakeholder', detail: 'Customers, investors, regulators and management' }
  ].filter(Boolean);
  return <div className="page-stack"><section className="workspace-header"><div><span className="eyebrow">CONNECTED INSTITUTIONAL MODEL</span><h2>Institutional graph</h2><p>This prototype links current uploaded and calculated context into one decision view. A production graph would resolve entities, obligations, systems, controls, people, contracts, capital and evidence across enterprise systems.</p></div><button className="secondary-button" onClick={() => navigate('work')}>Add context<ArrowRight size={16} /></button></section><section className="panel graph-panel"><div className="graph-canvas">{nodes.map((node, index) => <article key={`${node.label}-${index}`} className={`graph-node ${node.type}`} style={{ '--i': index }}><span>{index + 1}</span><strong>{node.label}</strong><small>{node.detail}</small></article>)}<svg viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true"><line x1="500" y1="270" x2="180" y2="120" /><line x1="500" y1="270" x2="500" y2="75" /><line x1="500" y1="270" x2="820" y2="120" /><line x1="500" y1="270" x2="150" y2="360" /><line x1="500" y1="270" x2="850" y2="360" /><line x1="500" y1="270" x2="310" y2="490" /><line x1="500" y1="270" x2="690" y2="490" /></svg></div></section><section className="content-grid equal"><article className="panel"><PanelHeader title="Graph-enabled questions" /><div className="question-list">{['What is affected if this regulation changes?', 'Which decisions created this exposure?', 'Which people can approve the next action?', 'Which contracts, controls and systems depend on this provider?', 'Which investors or customers may be affected?', 'What evidence proves remediation was completed?'].map(item => <div key={item}><Search size={16} /><span>{item}</span></div>)}</div></article><article className="panel"><PanelHeader title="Current graph coverage" /><ContextRow icon={FileText} label="Document intelligence" value={context.document?.title || 'No active source'} /><ContextRow icon={WalletCards} label="Capital and exposure" value={context.portfolio?.title || 'No active data'} /><ContextRow icon={Target} label="Mandate and limits" value={context.mandate?.title || 'No active mandate'} /><ContextRow icon={Landmark} label="Regulation and obligations" value={context.regulatory?.title || 'No active update'} /></article></section></div>;
}

function DecisionMemory({ memory, setMemory, recent, simulations, context }) {
  const [form, setForm] = useState({ title: '', outcome: 'Approved with conditions', owner: 'Authorised decision-maker', rationale: '', conditions: '' });
  function submit(event) {
    event.preventDefault();
    if (!form.title.trim() || !form.rationale.trim()) return;
    setMemory(current => [{ id: uid(), ...form, at: new Date().toISOString(), linked: [context.document?.title, context.portfolio?.title, context.mandate?.title, context.regulatory?.title, simulations[0]?.title].filter(Boolean) }, ...current]);
    setForm({ title: '', outcome: 'Approved with conditions', owner: 'Authorised decision-maker', rationale: '', conditions: '' });
  }
  return <div className="content-grid equal decision-layout"><form className="panel decision-form" onSubmit={submit}><PanelHeader title="Record institutional decision" subtitle="Preserve what was decided, why, by whom and against which evidence" /><label className="field-label">Decision title<input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label><div className="field-row"><label className="field-label">Outcome<select value={form.outcome} onChange={event => setForm({ ...form, outcome: event.target.value })}><option>Approved</option><option>Approved with conditions</option><option>Deferred</option><option>Rejected</option><option>Escalated</option></select></label><label className="field-label">Decision owner<input value={form.owner} onChange={event => setForm({ ...form, owner: event.target.value })} /></label></div><label className="field-label">Rationale<textarea rows="7" value={form.rationale} onChange={event => setForm({ ...form, rationale: event.target.value })} placeholder="Facts, alternatives, stakeholder interest, risk accepted and reasons." /></label><label className="field-label">Conditions and review triggers<textarea rows="4" value={form.conditions} onChange={event => setForm({ ...form, conditions: event.target.value })} /></label><div className="linked-context"><strong>Linked context</strong><span>{[context.document?.title, context.portfolio?.title, context.mandate?.title, context.regulatory?.title, simulations[0]?.title].filter(Boolean).join(' · ') || 'No active context'}</span></div><button className="primary-button wide"><BookOpenCheck size={18} />Save decision</button></form><section className="panel"><PanelHeader title="Institutional memory" subtitle={`${memory.length} decision(s) · ${recent.length} analysis record(s) · ${simulations.length} simulation(s)`} />{memory.length ? <div className="decision-list">{memory.map(item => <article key={item.id}><header><span className={riskClass(item.outcome === 'Rejected' ? 'High' : item.outcome === 'Approved' ? 'Low' : 'Medium')}>{item.outcome}</span><small>{formatDate(item.at)}</small></header><h3>{item.title}</h3><p>{item.rationale}</p>{item.conditions && <blockquote>{item.conditions}</blockquote>}<footer><span>{item.owner}</span><small>{item.linked.join(' · ')}</small></footer></article>)}</div> : <Empty title="No decision recorded" text="Create the first evidence-linked decision record." />}</section></div>;
}

function AgentStudio({ context }) {
  const agents = [
    ['Institutional Intake Agent', 'Classifies work, identifies missing context and routes the matter.', 'Documents and user input', 'Human confirms scope'],
    ['Regulatory Impact Agent', 'Maps change to obligations, controls, systems, owners and evidence.', 'Regulatory source and enterprise graph', 'Compliance approves interpretation'],
    ['Contract Command Agent', 'Reviews rights, duties, value, risk, negotiation and post-signature obligations.', 'Agreements and playbooks', 'Legal approves position'],
    ['Capital & Mandate Agent', 'Assesses holdings, liquidity, limits, conflicts and investor-interest impact.', 'Portfolio, mandate and market inputs', 'Investment/Risk approval'],
    ['Investigation Agent', 'Builds chronology, evidence gaps, persons, control failures and response plan.', 'Incident and evidence set', 'Legal/Compliance approval'],
    ['Simulation Agent', 'Models cross-functional cascade, decisions, actions and evidence.', 'Scenario inputs and active context', 'Authorised owner validates assumptions'],
    ['Service Provider Agent', 'Tracks SLA, continuity, incidents, concentration, remedies and exit readiness.', 'Vendor data and contracts', 'Operations/Risk approval'],
    ['Decision Memory Agent', 'Finds comparable decisions and preserves rationale and outcomes.', 'Approved institutional memory', 'Access-controlled retrieval']
  ];
  return <div className="page-stack"><section className="workspace-header"><div><span className="eyebrow">GOVERNED AGENTIC OPERATING MODEL</span><h2>Agent studio</h2><p>Agents are reusable institutional capabilities with defined objectives, permitted sources, action boundaries, approval gates, evaluation and execution traces.</p></div><span className="risk-badge low">Prototype configuration</span></section><section className="agent-card-grid">{agents.map(([name, purpose, source, approval], index) => <article className="panel agent-card" key={name}><header><span><BrainCircuit size={21} /></span><div><small>AGENT {String(index + 1).padStart(2, '0')}</small><h3>{name}</h3></div><span className={index < 6 ? 'agent-live' : 'agent-off'}>{index < 6 ? 'Configured' : 'Planned'}</span></header><p>{purpose}</p><dl><div><dt>Permitted source</dt><dd>{source}</dd></div><div><dt>Approval boundary</dt><dd>{approval}</dd></div><div><dt>Active context</dt><dd>{[context.document, context.portfolio, context.mandate, context.regulatory].filter(Boolean).length} connected source(s)</dd></div></dl></article>)}</section></div>;
}

function ControlTower({ health, recent, simulations }) {
  return <div className="page-stack"><section className="metric-grid"><Metric icon={BrainCircuit} label="Active engines" value={health?.activeEngines?.length || 0} /><Metric icon={Activity} label="Analyses" value={recent.length} /><Metric icon={PlayCircle} label="Simulations" value={simulations.length} /><Metric icon={Database} label="Public persistence" value="Browser-local" /></section><section className="content-grid equal"><article className="panel"><PanelHeader title="Connection and engine status" subtitle="Unavailable services are not represented as live" /><StatusRow label="Public application" active={Boolean(health?.ok)} value={health?.ok ? 'Reachable' : health?.error || 'Unavailable'} /><StatusRow label="External AI" active={Boolean(health?.aiConfigured)} value={health?.aiConfigured ? `${health.model} configured` : 'Unavailable or invalid'} /><StatusRow label="Institutional simulation" active={health?.activeEngines?.includes('institutional-simulation')} value="Server-side cross-functional model" /><StatusRow label="Document intelligence" active={health?.activeEngines?.includes('institutional-document-analysis')} value="Source-specific analysis" /><StatusRow label="Capital and mandate" active={health?.activeEngines?.includes('portfolio-calculation')} value="Portfolio, liquidity and rule mapping" /><StatusRow label="Private workspace" active={health?.privateWorkspace === 'configured-separately'} value={health?.privateWorkspace || 'Not configured'} /></article><article className="panel"><PanelHeader title="Governance controls" /><div className="governance-list"><Governance icon={ShieldCheck} title="Human approval" text="High-risk actions are recommendations until an authorised person approves and evidence confirms execution." /><Governance icon={Scale} title="Source and inference separation" text="Uploaded facts, calculations, assumptions and professional inference remain distinguishable." /><Governance icon={Database} title="Data boundary" text="The public prototype processes source content for the request and keeps saved records in the browser." /><Governance icon={Settings2} title="Model and agent controls" text="Production deployment requires versioning, evaluations, permissions, monitoring, cost controls and kill switches." /></div></article></section><section className="panel"><PanelHeader title="Engine inventory" subtitle="Unified platform capabilities" /><div className="engine-grid">{(health?.activeEngines || []).map(engine => <div key={engine}><span><Cpu size={18} /></span><strong>{engine.replaceAll('-', ' ')}</strong><small>Active · server-side</small></div>)}</div></section></div>;
}

function Slider({ label, value, onChange }) {
  return <label><span>{label}</span><div><input type="range" min="1" max="5" value={value} onChange={event => onChange(Number(event.target.value))} /><strong>{value}/5</strong></div></label>;
}
function Metric({ icon: Icon, label, value, sub }) { return <div className="metric-card">{Icon && <span><Icon size={20} /></span>}<strong>{value}</strong><small>{label}</small>{sub && <p>{sub}</p>}</div>; }
function PanelHeader({ title, subtitle, action }) { return <header className="panel-header"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action}</header>; }
function ContextRow({ icon: Icon, label, value }) { return <div className="context-row"><span><Icon size={18} /></span><div><small>{label}</small><strong>{value}</strong></div></div>; }
function StatusRow({ label, active, value }) { return <div className="status-row"><span className={active ? 'status-dot live' : 'status-dot'} /><div><strong>{label}</strong><small>{value}</small></div></div>; }
function Governance({ icon: Icon, title, text }) { return <div><span><Icon size={19} /></span><p><strong>{title}</strong><small>{text}</small></p></div>; }
function Empty({ title, text, action }) { return <div className="empty-state"><div>{action || <Search size={28} />}</div><h3>{title}</h3><p>{text}</p></div>; }
