import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, BookOpenCheck, BrainCircuit, Building2,
  CheckCircle2, ChevronRight, CircleAlert, CloudCog, Database, Download, FileSearch,
  FileText, Gauge, GitBranch, History, Landmark, LayoutDashboard, LoaderCircle, Menu,
  Network, Play, RefreshCw, Scale, Search, Settings2, ShieldCheck, Sparkles, Target,
  UploadCloud, Users, WalletCards, Workflow, X, Zap
} from 'lucide-react';

const API = '/api';
const STORE_KEY = 'synesis-new-model-v1';
const DECISION_KEY = 'synesis-new-model-decisions-v1';
const AGENT_KEY = 'synesis-new-model-agents-v1';

const INSTITUTIONS = [
  { key: 'bank', label: 'Bank', description: 'Credit, treasury, AML, outsourcing, operations and regulatory controls.' },
  { key: 'amc', label: 'AMC / Fund', description: 'Investor capital, portfolio, liquidity, mandate, trustees and fund operations.' },
  { key: 'nbfc', label: 'NBFC / Fintech', description: 'Lending, collections, partners, credit risk, conduct and technology.' },
  { key: 'insurance', label: 'Insurance', description: 'Products, underwriting, claims, solvency, distribution and policyholder outcomes.' },
  { key: 'corporate', label: 'Corporate Group', description: 'Contracts, entities, procurement, risk, investigations and governance.' },
  { key: 'professional', label: 'Professional Services', description: 'Matters, conflicts, evidence, knowledge, clients and delivery.' }
];

const NAV = [
  ['home', 'Command centre', LayoutDashboard],
  ['simulation', 'Simulation lab', Zap],
  ['analysis', 'Live analysis', UploadCloud],
  ['graph', 'Intelligence graph', Network],
  ['decisions', 'Decision memory', History],
  ['agents', 'Agent studio', BrainCircuit],
  ['packs', 'Solution packs', Building2]
];

const SCENARIOS = [
  { key: 'liquidity', label: 'Liquidity shock', description: 'Redemptions, cash, disposal sequence and remaining-holder impact.', icon: WalletCards, fields: [['redemptionPercent', 'Redemption demand (%)', 20], ['priceShockPercent', 'Sale price shock (%)', 8], ['cashPercent', 'Available cash (%)', 5], ['slowLiquidityPercent', 'Slow assets (%)', 18], ['topIssuerPercent', 'Top issuer (%)', 12]] },
  { key: 'market', label: 'Market shock', description: 'Equity, rates, spreads and portfolio-value sensitivity.', icon: BarChart3, fields: [['equityShockPercent', 'Equity decline (%)', 18], ['rateShockBps', 'Rate shock (bps)', 150], ['creditSpreadBps', 'Spread shock (bps)', 250], ['equityWeight', 'Equity weight (%)', 55], ['debtWeight', 'Debt weight (%)', 40]] },
  { key: 'counterparty', label: 'Counterparty / sanctions', description: 'Frozen exposure, settlement delay, recovery and continuity.', icon: ShieldCheck, fields: [['exposurePercent', 'Institutional exposure (%)', 15], ['frozenPercent', 'Potentially frozen (%)', 70], ['recoveryPercent', 'Assumed recovery (%)', 25], ['settlementDelayDays', 'Settlement delay (days)', 14]] },
  { key: 'cyber', label: 'Cyber / vendor incident', description: 'Downtime, affected users, data sensitivity and recovery readiness.', icon: CloudCog, fields: [['downtimeHours', 'Downtime (hours)', 36], ['affectedCustomersPercent', 'Affected users (%)', 30], ['dataSensitivity', 'Data sensitivity (0–100)', 80], ['recoveryReadiness', 'Recovery readiness (0–100)', 45]] },
  { key: 'regulatory', label: 'Regulatory change', description: 'Implementation window, process impact, systems and readiness.', icon: Landmark, fields: [['implementationDays', 'Implementation days', 45], ['affectedProcesses', 'Affected processes', 8], ['affectedSystems', 'Affected systems', 4], ['currentReadiness', 'Current readiness (0–100)', 35]] },
  { key: 'contract', label: 'Contract / service failure', description: 'Operational exposure, liability cap, downtime and replacement.', icon: FileText, fields: [['annualValue', 'Annual contract value', 10000000], ['downtimeDays', 'Downtime days', 5], ['liabilityCapPercent', 'Liability cap (% annual value)', 100], ['replacementDays', 'Replacement days', 75], ['criticality', 'Criticality (0–100)', 80]] },
  { key: 'litigation', label: 'Dispute / investigation', description: 'Claim exposure, adverse probability, cost and reputation.', icon: Scale, fields: [['claimAmount', 'Claim amount', 50000000], ['adverseProbability', 'Adverse probability (%)', 40], ['legalCost', 'Estimated legal cost', 3000000], ['reputationImpact', 'Reputation impact (0–100)', 60]] },
  { key: 'product', label: 'New product launch', description: 'Readiness, dependencies, unresolved risks and launch date.', icon: Sparkles, fields: [['readiness', 'Readiness (0–100)', 50], ['criticalDependencies', 'Critical dependencies', 9], ['unresolvedRisks', 'Unresolved risks', 7], ['daysToLaunch', 'Days to launch', 30]] }
];

const ANALYSES = [
  { key: 'deep', label: 'Deep document review', description: 'Clause-level risks, evidence, mitigation, missing protections and decision position.', icon: FileSearch },
  { key: 'institutional', label: 'Institutional source analysis', description: 'Policies, proposals, reports, governance records and operating controls.', icon: Workflow },
  { key: 'portfolio', label: 'Portfolio calculation', description: 'Holdings, concentration, liquidity, credit and redemption scenarios from CSV.', icon: WalletCards },
  { key: 'mandate', label: 'Mandate restriction test', description: 'Extract percentage limits and test against the active uploaded portfolio.', icon: Target },
  { key: 'regulatory', label: 'Regulatory impact map', description: 'Obligations, affected areas, owners, deadlines and remediation evidence.', icon: Landmark }
];

const DEFAULT_AGENTS = [
  { id: 'a1', name: 'Deep Review Agent', objective: 'Review documents and produce evidence-linked findings.', source: 'Uploaded document only', approval: 'Professional review', enabled: true },
  { id: 'a2', name: 'Simulation Orchestrator', objective: 'Run cross-functional scenarios and prepare action plans.', source: 'User inputs + active context', approval: 'Decision owner', enabled: true },
  { id: 'a3', name: 'Regulatory Impact Agent', objective: 'Map regulatory text to obligations, owners and remediation.', source: 'Uploaded regulatory source', approval: 'Compliance validation', enabled: true },
  { id: 'a4', name: 'Portfolio and Mandate Agent', objective: 'Calculate portfolio metrics and test extracted restrictions.', source: 'Uploaded CSV + mandate', approval: 'Risk / Fund Manager', enabled: true },
  { id: 'a5', name: 'Institutional Memory Agent', objective: 'Retrieve comparable decisions and their rationale.', source: 'Approved decision ledger', approval: 'Access-controlled', enabled: false }
];

const SOLUTION_PACKS = {
  bank: ['Credit and covenant intelligence', 'Treasury and counterparty risk', 'KYC / AML and sanctions', 'Third-party and outsourcing oversight', 'Regulatory change-to-control', 'Legal and contract command', 'Operational resilience', 'Board and management decisions'],
  amc: ['Investment research and decision memory', 'Portfolio and mandate intelligence', 'Liquidity and redemption simulation', 'Investor-interest assessment', 'Trustee and committee command', 'Fund operations and NAV exceptions', 'Service-provider oversight', 'Regulatory evidence'],
  nbfc: ['Credit policy and underwriting', 'Collections and conduct', 'Partner and sourcing oversight', 'Fraud and anomaly intelligence', 'Borrowing and liquidity', 'Regulatory reporting', 'Customer complaints', 'Product governance'],
  insurance: ['Product and policy wording', 'Underwriting governance', 'Claims intelligence', 'Distribution conduct', 'Solvency and investment controls', 'Policyholder communications', 'Fraud and investigations', 'Regulatory change'],
  corporate: ['Contract and obligation intelligence', 'Enterprise risk and controls', 'Entity and authority graph', 'Procurement and vendors', 'Investigations and evidence', 'Board governance', 'Regulatory obligations', 'Operational incidents'],
  professional: ['Matter intake and triage', 'Conflict checks and ethical walls', 'Document and research intelligence', 'Investigation storybuilding', 'Client workspace', 'Outside expert management', 'Knowledge and precedent memory', 'Delivery analytics']
};

const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const formatDate = value => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const riskClass = value => `snm-risk ${String(value || 'Low').toLowerCase()}`;

function loadJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'SYNESIS NEW MODEL could not complete the request.');
  return data;
}

async function readFile(file) {
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

export default function NewModelApp() {
  const saved = useMemo(() => loadJson(STORE_KEY, {}), []);
  const [institution, setInstitution] = useState(saved.institution || 'bank');
  const [page, setPage] = useState('home');
  const [mobile, setMobile] = useState(false);
  const [health, setHealth] = useState(null);
  const [notice, setNotice] = useState(null);
  const [context, setContext] = useState(saved.context || {});
  const [simulations, setSimulations] = useState(saved.simulations || []);
  const [analyses, setAnalyses] = useState(saved.analyses || []);
  const [decisions, setDecisions] = useState(() => loadJson(DECISION_KEY, []));
  const [agents, setAgents] = useState(() => loadJson(AGENT_KEY, DEFAULT_AGENTS));

  useEffect(() => { api('/health').then(setHealth).catch(error => setHealth({ ok: false, error: error.message })); }, []);
  useEffect(() => { localStorage.setItem(STORE_KEY, JSON.stringify({ institution, context, simulations: simulations.slice(0, 30), analyses: analyses.slice(0, 40) })); }, [institution, context, simulations, analyses]);
  useEffect(() => { localStorage.setItem(DECISION_KEY, JSON.stringify(decisions)); }, [decisions]);
  useEffect(() => { localStorage.setItem(AGENT_KEY, JSON.stringify(agents)); }, [agents]);
  useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(null), 7000); return () => clearTimeout(timer); }, [notice]);

  const activeInstitution = INSTITUTIONS.find(item => item.key === institution) || INSTITUTIONS[0];
  const attention = useMemo(() => {
    const items = [];
    simulations.slice(0, 5).forEach(item => items.push({ risk: item.riskLevel, title: item.title, detail: item.decisionPosition, source: 'Simulation' }));
    analyses.slice(0, 5).forEach(item => {
      const result = item.result || {};
      items.push({ risk: result.overall_risk || (result.breach_count ? 'High' : 'Medium'), title: item.title, detail: result.summary || result.executive_position || result.document_summary || 'Live source analysis completed.', source: item.mode });
    });
    return items.slice(0, 8);
  }, [simulations, analyses]);

  function navigate(next) { setPage(next); setMobile(false); }
  function reset() {
    localStorage.removeItem(STORE_KEY); localStorage.removeItem(DECISION_KEY); localStorage.removeItem(AGENT_KEY);
    setContext({}); setSimulations([]); setAnalyses([]); setDecisions([]); setAgents(DEFAULT_AGENTS); setPage('home');
    setNotice({ type: 'success', message: 'SYNESIS NEW MODEL prototype data was reset.' });
  }

  return <div className="snm-shell">
    {mobile && <button className="snm-scrim" onClick={() => setMobile(false)} />}
    <aside className={`snm-sidebar ${mobile ? 'open' : ''}`}>
      <div className="snm-brand"><span>SN</span><div><strong>SYNESIS</strong><small>NEW MODEL</small></div><button onClick={() => setMobile(false)}><X size={19} /></button></div>
      <label className="snm-institution"><small>INSTITUTION PROFILE</small><select value={institution} onChange={event => setInstitution(event.target.value)}>{INSTITUTIONS.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select><p>{activeInstitution.description}</p></label>
      <nav>{NAV.map(([key, label, Icon]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => navigate(key)}><Icon size={18} /><span>{label}</span><ChevronRight size={15} /></button>)}</nav>
      <div className="snm-system"><p><span className={health?.ok ? 'dot live' : 'dot'} /><strong>{health?.ok ? 'Prototype live' : 'Checking runtime'}</strong></p><small>{health?.aiConfigured ? `AI configured · ${health.model}` : 'Deterministic engines active; external AI unavailable'}</small><button onClick={reset}><RefreshCw size={14} />Reset prototype</button></div>
    </aside>

    <section className="snm-main">
      <header className="snm-topbar"><button className="snm-menu" onClick={() => setMobile(true)}><Menu size={22} /></button><div><h1>{NAV.find(item => item[0] === page)?.[1]}</h1><p>{activeInstitution.label} · intelligence, simulation, governance and execution</p></div><button className="snm-primary compact" onClick={() => navigate('simulation')}><Play size={16} />Run scenario</button></header>
      {notice && <button className={`snm-notice ${notice.type}`} onClick={() => setNotice(null)}>{notice.type === 'error' ? <CircleAlert size={18} /> : <CheckCircle2 size={18} />}<span>{notice.message}</span><X size={16} /></button>}
      <main className="snm-page">
        {page === 'home' && <CommandCentre institution={activeInstitution} attention={attention} context={context} simulations={simulations} analyses={analyses} decisions={decisions} navigate={navigate} health={health} />}
        {page === 'simulation' && <SimulationLab institution={activeInstitution} context={context} simulations={simulations} setSimulations={setSimulations} notify={setNotice} />}
        {page === 'analysis' && <LiveAnalysis context={context} setContext={setContext} analyses={analyses} setAnalyses={setAnalyses} notify={setNotice} />}
        {page === 'graph' && <IntelligenceGraph institution={activeInstitution} context={context} simulations={simulations} decisions={decisions} />}
        {page === 'decisions' && <DecisionMemory decisions={decisions} setDecisions={setDecisions} context={context} simulations={simulations} />}
        {page === 'agents' && <AgentStudio agents={agents} setAgents={setAgents} health={health} />}
        {page === 'packs' && <SolutionPacks institution={institution} setInstitution={setInstitution} navigate={navigate} />}
      </main>
    </section>
  </div>;
}

function CommandCentre({ institution, attention, context, simulations, analyses, decisions, navigate, health }) {
  const high = attention.filter(item => /high|critical/i.test(item.risk)).length;
  return <div className="snm-stack">
    <section className="snm-hero"><div><span>INSTITUTIONAL DECISION OS</span><h2>See the consequence before making the decision.</h2><p>SYNESIS NEW MODEL connects documents, data, obligations, risks, people and institutional memory—then simulates what happens next and routes approved action.</p><div><button className="snm-light" onClick={() => navigate('simulation')}><Zap size={18} />Open simulation lab</button><button className="snm-ghost" onClick={() => navigate('analysis')}>Upload live source<ArrowRight size={17} /></button></div></div><div className="snm-orbit"><Network size={54} /><small>{institution.label}</small></div></section>
    <section className="snm-metrics"><Metric icon={AlertTriangle} label="High-priority items" value={high} /><Metric icon={Activity} label="Live analyses" value={analyses.length} /><Metric icon={Zap} label="Simulations" value={simulations.length} /><Metric icon={BookOpenCheck} label="Decisions recorded" value={decisions.length} /><Metric icon={Database} label="Connected contexts" value={Object.keys(context).length} /></section>
    <section className="snm-grid two-one"><article className="snm-panel"><PanelHeader title="What needs attention" subtitle="Generated from user analyses and scenario runs" />{attention.length ? attention.map((item, index) => <div className="snm-attention" key={`${item.title}-${index}`}><span className={riskClass(item.risk)}>{item.risk}</span><div><small>{item.source}</small><strong>{item.title}</strong><p>{item.detail}</p></div><ChevronRight size={17} /></div>) : <Empty title="No live attention item" text="Upload a source or run a scenario. Nothing is fabricated to populate the dashboard." />}</article><aside className="snm-panel"><PanelHeader title="Operating status" /><Status label="Runtime" active={health?.ok} value={health?.ok ? 'Reachable' : health?.error || 'Checking'} /><Status label="External AI" active={health?.aiConfigured} value={health?.aiConfigured ? health.model : 'Unavailable or unfunded'} /><Status label="Simulation engine" active value="8 scenario families" /><Status label="Evidence boundary" active value="Uploaded and calculated facts only" /><Status label="High-risk execution" active value="Human approval required" /></aside></section>
    <section className="snm-grid equal"><article className="snm-panel"><PanelHeader title="Connected intelligence" subtitle="Active user-uploaded context" /><Context label="Deep document" value={context.deep?.title} /><Context label="Institutional source" value={context.institutional?.title} /><Context label="Portfolio" value={context.portfolio?.title} /><Context label="Mandate" value={context.mandate?.title} /><Context label="Regulatory update" value={context.regulatory?.title} /></article><article className="snm-panel"><PanelHeader title="What makes the model different" /><Feature icon={Network} title="Cross-domain impact graph" text="A change in one source can surface consequences across capital, regulation, contracts, operations and governance." /><Feature icon={Zap} title="Decision simulation" text="Users test scenarios before approving action instead of receiving only a static risk summary." /><Feature icon={History} title="Institutional memory" text="The platform records what was decided, why, against which evidence and under which conditions." /><Feature icon={BrainCircuit} title="Governed agents" text="Agents are permissioned, evidence-bound and subject to approval gates." /></article></section>
  </div>;
}

function SimulationLab({ institution, context, simulations, setSimulations, notify }) {
  const [type, setType] = useState('regulatory');
  const selected = SCENARIOS.find(item => item.key === type) || SCENARIOS[0];
  const [input, setInput] = useState(() => Object.fromEntries(selected.fields.map(([key,, value]) => [key, value])));
  const [busy, setBusy] = useState(false);
  const active = simulations[0] || null;
  useEffect(() => { setInput(Object.fromEntries(selected.fields.map(([key,, value]) => [key, value]))); }, [type]);
  async function run() {
    setBusy(true);
    try {
      const data = await api('/public/new-model/simulate', { method: 'POST', body: JSON.stringify({ type, input, context, institutionType: institution.label }) });
      setSimulations(current => [data.simulation, ...current]);
      notify({ type: 'success', message: `${data.simulation.title} completed from the supplied assumptions.` });
    } catch (error) { notify({ type: 'error', message: error.message }); }
    finally { setBusy(false); }
  }
  return <div className="snm-stack"><section className="snm-simulation-head"><div><span>SIMULATION OPERATING LAYER</span><h2>Model an institutional event before it becomes an incident.</h2><p>Choose a scenario, edit the assumptions and run a server-side simulation linked to active uploaded context where available.</p></div><div><strong>{SCENARIOS.length}</strong><small>scenario families</small></div></section>
    <section className="snm-scenario-grid">{SCENARIOS.map(item => <button key={item.key} className={type === item.key ? 'active' : ''} onClick={() => setType(item.key)}><item.icon size={21} /><div><strong>{item.label}</strong><small>{item.description}</small></div></button>)}</section>
    <section className="snm-grid two-one"><article className="snm-panel"><PanelHeader title={selected.label} subtitle="Editable assumptions — no hidden market or legal facts" /><div className="snm-input-grid">{selected.fields.map(([key, label]) => <label key={key}>{label}<input type="number" value={input[key]} onChange={event => setInput({ ...input, [key]: event.target.value })} /></label>)}</div><div className="snm-linked"><strong>Linked active context</strong><span>{Object.values(context).filter(Boolean).map(item => item.title).join(' · ') || 'No uploaded context; simulation will use only supplied assumptions.'}</span></div><button className="snm-primary wide" disabled={busy} onClick={run}>{busy ? <><LoaderCircle className="spin" size={18} />Running simulation…</> : <><Play size={18} />Run live scenario</>}</button></article><aside className="snm-panel"><PanelHeader title="Approval boundary" /><Feature icon={ShieldCheck} title="No autonomous execution" text="The result can recommend controls but cannot execute a trade, filing, payment, notification or termination." /><Feature icon={Database} title="Transparent inputs" text="Every metric is calculated from visible assumptions and linked uploaded context." /><Feature icon={Users} title="Named ownership" text="Outputs identify responsible functions and required approval gates." /></aside></section>
    {active ? <SimulationResult simulation={active} /> : <Empty title="No simulation result yet" text="Run the first scenario to generate impact metrics, findings, owners, approval gates and action sequence." />}
  </div>;
}

function SimulationResult({ simulation }) {
  return <section className="snm-panel snm-result"><header><div><span>LAST SCENARIO · {formatDate(simulation.generatedAt)}</span><h2>{simulation.title}</h2><p>{simulation.institutionType}</p></div><div className={`snm-score ${String(simulation.riskLevel).toLowerCase()}`}><strong>{simulation.riskScore}</strong><small>{simulation.riskLevel}</small></div></header><div className="snm-result-metrics">{simulation.metrics.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div><div className="snm-grid equal"><article><h3>Decision position</h3><p className="decision-position">{simulation.decisionPosition}</p><h3>Findings</h3>{simulation.findings.map(item => <div className="snm-finding" key={item}><CircleAlert size={16} /><span>{item}</span></div>)}</article><article><h3>Controlled action sequence</h3>{simulation.actions.map((item, index) => <div className="snm-action" key={item.id}><span>{index + 1}</span><div><small>{item.priority} · {item.owner}</small><strong>{item.action}</strong><p>{item.gate}</p></div></div>)}</article></div><footer><div><strong>Owners</strong><span>{simulation.owners.join(' · ')}</span></div><div><strong>Approval gates</strong><span>{simulation.approvalGates.join(' · ')}</span></div></footer></section>;
}

function LiveAnalysis({ context, setContext, analyses, setAnalyses, notify }) {
  const [mode, setMode] = useState('deep');
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const selected = ANALYSES.find(item => item.key === mode);
  const stages = ['Read source', 'Classify', 'Extract evidence', 'Map risks and relationships', 'Generate decision output'];
  useEffect(() => { setFile(null); setText(''); setTitle(''); setStage(0); }, [mode]);
  useEffect(() => { if (!busy) return undefined; const timer = setInterval(() => setStage(current => Math.min(4, current + 1)), 800); return () => clearInterval(timer); }, [busy]);
  async function selectFile(selectedFile) {
    if (!selectedFile) return;
    setBusy(true); setStage(0);
    try { const value = await readFile(selectedFile); if (value.trim().length < 20) throw new Error('The file does not contain enough readable content.'); setFile(selectedFile); setText(value.slice(0, mode === 'portfolio' ? 600000 : 180000)); setTitle(selectedFile.name.replace(/\.[^.]+$/, '')); notify({ type: 'success', message: `${selectedFile.name} was extracted.` }); }
    catch (error) { notify({ type: 'error', message: error.message }); }
    finally { setBusy(false); setStage(0); }
  }
  async function submit(event) {
    event.preventDefault(); if (text.trim().length < 20) return notify({ type: 'error', message: 'Upload or paste a readable source.' });
    setBusy(true); setStage(0);
    try {
      let path; let payload = { title: title || file?.name || `New ${mode} analysis`, text };
      if (mode === 'deep') { path = '/public/analyze'; payload = { ...payload, fileName: file?.name || '', matter: 'Institutional review', documentType: 'Auto-detect', jurisdiction: 'India', riskAppetite: 'Conservative', department: 'Institutional Review' }; }
      if (mode === 'institutional') path = '/public/institutional/document';
      if (mode === 'portfolio') path = '/public/institutional/portfolio';
      if (mode === 'mandate') { path = '/public/institutional/mandate'; payload.portfolio = context.portfolio || null; }
      if (mode === 'regulatory') path = '/public/institutional/regulatory';
      const data = await api(path, { method: 'POST', body: JSON.stringify(payload) });
      const result = data.analysis;
      const record = { id: uid(), mode, title: payload.title, at: new Date().toISOString(), result };
      setAnalyses(current => [record, ...current]); setContext(current => ({ ...current, [mode]: { ...result, title: payload.title } }));
      notify({ type: 'success', message: `${payload.title} was analysed from the uploaded source.` });
    } catch (error) { notify({ type: 'error', message: error.message }); }
    finally { setBusy(false); setStage(0); }
  }
  const latest = analyses.find(item => item.mode === mode);
  return <div className="snm-stack"><section className="snm-grid two-one"><form className="snm-panel" onSubmit={submit}><PanelHeader title="Live source analysis" subtitle="Each run processes the newly supplied document or dataset" /><div className="snm-analysis-types">{ANALYSES.map(item => <button type="button" key={item.key} className={mode === item.key ? 'active' : ''} onClick={() => setMode(item.key)}><item.icon size={20} /><span><strong>{item.label}</strong><small>{item.description}</small></span></button>)}</div><label className="snm-drop"><input type="file" accept={mode === 'portfolio' ? '.csv,.txt' : '.pdf,.docx,.txt,.csv,.json,.md,.xml'} onChange={event => selectFile(event.target.files?.[0])} /><UploadCloud size={30} /><strong>{file?.name || 'Choose source file'}</strong><small>PDF, DOCX and text-based formats. Portfolio mode expects CSV.</small></label><label className="snm-field">Analysis title<input value={title} onChange={event => setTitle(event.target.value)} /></label><label className="snm-field">Extracted source<textarea rows="13" value={text} onChange={event => setText(event.target.value)} placeholder="Extracted or pasted source appears here…" /></label><button className="snm-primary wide" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18} />Analysing source…</> : <><Sparkles size={18} />Run live analysis</>}</button></form><aside className="snm-panel snm-progress"><PanelHeader title="Processing trace" subtitle="Visible stages rather than a fake instant result" />{stages.map((label, index) => <div key={label} className={busy && index <= stage ? 'active' : ''}><span>{index < stage ? <CheckCircle2 size={16} /> : busy && index === stage ? <LoaderCircle className="spin" size={16} /> : index + 1}</span><p><strong>{label}</strong><small>{index < stage ? 'Completed' : busy && index === stage ? 'In progress' : 'Pending'}</small></p></div>)}<Feature icon={ShieldCheck} title="Evidence discipline" text="Missing information is reported. Unavailable market, legal or regulatory facts are not invented." /></aside></section>{latest && <AnalysisResult record={latest} />}</div>;
}

function AnalysisResult({ record }) {
  const result = record.result || {};
  const findings = result.findings || result.flags || result.tests || result.obligations || [];
  return <section className="snm-panel"><PanelHeader title={record.title} subtitle={`${record.mode} · ${formatDate(record.at)} · ${result.engine || 'analysis engine'}`} action={<span className={riskClass(result.overall_risk || (result.breach_count ? 'High' : 'Medium'))}>{result.overall_risk || (result.breach_count ? 'High' : 'Completed')}</span>} /><p className="snm-summary">{result.executive_position || result.summary || result.document_summary || 'Analysis completed from the supplied source.'}</p><div className="snm-analysis-list">{findings.slice(0, 12).map((item, index) => <article key={item.id || index}><span className={riskClass(item.risk_level || item.severity || (item.status === 'Breach' ? 'High' : 'Medium'))}>{item.risk_level || item.severity || item.status || 'Finding'}</span><div><strong>{item.issue || item.title || item.label || item.obligation || `Finding ${index + 1}`}</strong><small>{item.clause_reference || item.reference || item.category || ''}</small><p>{item.why_risky_for_bank || item.action || item.explanation || item.evidence || ''}</p></div></article>)}</div></section>;
}

function IntelligenceGraph({ institution, context, simulations, decisions }) {
  const nodes = [
    { id: 'org', label: institution.label, type: 'Institution' },
    ...Object.entries(context).filter(([, value]) => value).map(([key, value]) => ({ id: key, label: value.title || key, type: key })),
    ...simulations.slice(0, 4).map((item, index) => ({ id: `sim-${index}`, label: item.title, type: 'Simulation' })),
    ...decisions.slice(0, 4).map((item, index) => ({ id: `dec-${index}`, label: item.title, type: 'Decision' }))
  ];
  return <div className="snm-stack"><section className="snm-panel"><PanelHeader title="Institutional intelligence graph" subtitle="Prototype graph linking the organisation, uploaded sources, scenario runs and decisions" /><div className="snm-graph"><div className="snm-graph-core"><Building2 size={30} /><strong>{institution.label}</strong></div>{nodes.slice(1).map((node, index) => <div key={node.id} className={`snm-node n${index % 8}`}><span>{node.type}</span><strong>{node.label}</strong></div>)}</div></section><section className="snm-grid equal"><article className="snm-panel"><PanelHeader title="Connected questions" />{['Which obligations and decisions are affected by this source?', 'What scenario changes the current decision?', 'Why was a similar risk accepted previously?', 'Which owner and approval gate must act next?', 'What evidence is still missing?'].map(item => <div className="snm-question" key={item}><Search size={16} /><span>{item}</span></div>)}</article><article className="snm-panel"><PanelHeader title="Graph evolution" /><Feature icon={GitBranch} title="Versioned relationships" text="Production design will preserve when a relationship was created, changed or superseded." /><Feature icon={Database} title="Source provenance" text="Every edge should trace back to uploaded evidence, a calculation or an authorised decision." /><Feature icon={Network} title="Impact propagation" text="Changes can trigger recalculation of affected risks, tasks, controls and approvals." /></article></section></div>;
}

function DecisionMemory({ decisions, setDecisions, context, simulations }) {
  const [form, setForm] = useState({ title: '', outcome: 'Approved with conditions', owner: 'Decision Committee', rationale: '', conditions: '' });
  function save(event) { event.preventDefault(); if (!form.title.trim() || !form.rationale.trim()) return; setDecisions(current => [{ id: uid(), ...form, at: new Date().toISOString(), linked: [...Object.values(context).filter(Boolean).map(item => item.title), simulations[0]?.title].filter(Boolean) }, ...current]); setForm({ title: '', outcome: 'Approved with conditions', owner: 'Decision Committee', rationale: '', conditions: '' }); }
  return <div className="snm-grid equal snm-decision-layout"><form className="snm-panel" onSubmit={save}><PanelHeader title="Record decision rationale" subtitle="Capture what was decided, why, using which evidence and under what conditions" /><label className="snm-field">Decision title<input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label><div className="snm-input-grid"><label>Outcome<select value={form.outcome} onChange={event => setForm({ ...form, outcome: event.target.value })}><option>Approved</option><option>Approved with conditions</option><option>Deferred</option><option>Rejected</option><option>Escalated</option></select></label><label>Owner<input value={form.owner} onChange={event => setForm({ ...form, owner: event.target.value })} /></label></div><label className="snm-field">Rationale<textarea rows="7" value={form.rationale} onChange={event => setForm({ ...form, rationale: event.target.value })} /></label><label className="snm-field">Conditions / review triggers<textarea rows="4" value={form.conditions} onChange={event => setForm({ ...form, conditions: event.target.value })} /></label><button className="snm-primary wide"><BookOpenCheck size={18} />Save to decision memory</button></form><section className="snm-panel"><PanelHeader title="Decision ledger" subtitle="Browser-local prototype memory" />{decisions.length ? <div className="snm-decisions">{decisions.map(item => <article key={item.id}><header><span className={riskClass(item.outcome === 'Rejected' ? 'High' : item.outcome === 'Approved' ? 'Low' : 'Medium')}>{item.outcome}</span><small>{formatDate(item.at)}</small></header><h3>{item.title}</h3><p>{item.rationale}</p>{item.conditions && <blockquote>{item.conditions}</blockquote>}<footer><strong>{item.owner}</strong><small>{item.linked.join(' · ')}</small></footer></article>)}</div> : <Empty title="No recorded decision" text="Save the first evidence-linked decision." />}</section></div>;
}

function AgentStudio({ agents, setAgents, health }) {
  const [form, setForm] = useState({ name: '', objective: '', source: 'Approved uploaded sources', approval: 'Human approval required' });
  function add(event) { event.preventDefault(); if (!form.name.trim() || !form.objective.trim()) return; setAgents(current => [...current, { id: uid(), ...form, enabled: false }]); setForm({ name: '', objective: '', source: 'Approved uploaded sources', approval: 'Human approval required' }); }
  return <div className="snm-stack"><section className="snm-metrics"><Metric icon={BrainCircuit} label="Configured agents" value={agents.length} /><Metric icon={CheckCircle2} label="Enabled" value={agents.filter(item => item.enabled).length} /><Metric icon={ShieldCheck} label="Approval-gated" value={agents.filter(item => /approval/i.test(item.approval)).length} /><Metric icon={Activity} label="External AI" value={health?.aiConfigured ? 'Configured' : 'Unavailable'} /></section><section className="snm-grid two-one"><article className="snm-panel"><PanelHeader title="Governed agent inventory" subtitle="Purpose, permitted source and approval boundary" /><div className="snm-agents">{agents.map(item => <div key={item.id}><span><BrainCircuit size={18} /></span><div><strong>{item.name}</strong><p>{item.objective}</p><small>Source: {item.source} · Gate: {item.approval}</small></div><button className={item.enabled ? 'enabled' : ''} onClick={() => setAgents(current => current.map(agent => agent.id === item.id ? { ...agent, enabled: !agent.enabled } : agent))}>{item.enabled ? 'Enabled' : 'Disabled'}</button></div>)}</div></article><form className="snm-panel" onSubmit={add}><PanelHeader title="Create agent configuration" subtitle="Prototype configuration; new agents start disabled" /><label className="snm-field">Agent name<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label className="snm-field">Objective<textarea rows="4" value={form.objective} onChange={event => setForm({ ...form, objective: event.target.value })} /></label><label className="snm-field">Permitted source<input value={form.source} onChange={event => setForm({ ...form, source: event.target.value })} /></label><label className="snm-field">Approval gate<input value={form.approval} onChange={event => setForm({ ...form, approval: event.target.value })} /></label><button className="snm-primary wide"><Settings2 size={18} />Add disabled agent</button></form></section></div>;
}

function SolutionPacks({ institution, setInstitution, navigate }) {
  return <div className="snm-stack"><section className="snm-pack-hero"><span>SOLUTION ARCHITECTURE</span><h2>One operating core. Sector-specific intelligence packs.</h2><p>Synesis is not restricted to legal, compliance or asset management. The common platform connects evidence, decisions, simulations, workflows, agents and institutional memory; each sector pack adds its own data, rules and operating language.</p></section><section className="snm-pack-grid">{INSTITUTIONS.map(item => <article key={item.key} className={institution === item.key ? 'active' : ''}><header><span><Building2 size={21} /></span><div><h3>{item.label}</h3><p>{item.description}</p></div></header><div>{SOLUTION_PACKS[item.key].map(feature => <p key={feature}><CheckCircle2 size={15} />{feature}</p>)}</div><button onClick={() => { setInstitution(item.key); navigate('home'); }}>Activate profile<ArrowRight size={16} /></button></article>)}</section></div>;
}

function Metric({ icon: Icon, label, value }) { return <div className="snm-metric">{Icon && <span><Icon size={19} /></span>}<strong>{value}</strong><small>{label}</small></div>; }
function PanelHeader({ title, subtitle, action }) { return <header className="snm-panel-head"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action}</header>; }
function Status({ label, active, value }) { return <div className="snm-status"><span className={active ? 'dot live' : 'dot'} /><div><strong>{label}</strong><small>{value}</small></div></div>; }
function Context({ label, value }) { return <div className="snm-context"><small>{label}</small><strong>{value || 'Not connected'}</strong></div>; }
function Feature({ icon: Icon, title, text }) { return <div className="snm-feature"><span><Icon size={18} /></span><p><strong>{title}</strong><small>{text}</small></p></div>; }
function Empty({ title, text }) { return <div className="snm-empty"><Search size={27} /><h3>{title}</h3><p>{text}</p></div>; }
