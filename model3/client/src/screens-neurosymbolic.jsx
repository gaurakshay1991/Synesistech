import { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, BadgeCheck, BarChart3, BookOpenCheck, BrainCircuit,
  Building2, CheckCircle2, CircleDollarSign, DatabaseZap, FileDown, Fingerprint,
  Gavel, GitBranch, Globe2, Landmark, LibraryBig, Network, Plus, RefreshCw,
  Scale, ShieldCheck, Sparkles, Target, Workflow
} from 'lucide-react';
import { downloadJson, formatDate, money, Panel, RiskBadge, Status, KeyValue, MiniProgress } from './ui.jsx';

function splitList(value) {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

export function RegulatoryRadar({ state, request, setState, setNotice }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', regulator: 'RBI', jurisdiction: 'India', publishedDate: '', effectiveDate: '',
    severity: 'High', domains: 'Banking, Contracting', summary: '', sourceReference: '', owner: 'Compliance'
  });
  const [verification, setVerification] = useState(null);
  const [verifyForm, setVerifyForm] = useState({ sourceReference: '', verificationNote: '', mappedItems: 0, confidence: 85 });

  async function register(e) {
    e.preventDefault();
    try {
      const data = await request('/regulatory-updates', { method: 'POST', body: JSON.stringify({ ...form, domains: splitList(form.domains) }) });
      setState(data.state); setShowForm(false);
      setForm({ title: '', regulator: 'RBI', jurisdiction: 'India', publishedDate: '', effectiveDate: '', severity: 'High', domains: 'Banking, Contracting', summary: '', sourceReference: '', owner: 'Compliance' });
      setNotice({ type: 'success', message: 'Regulatory proposition registered for controlled source verification.' });
    } catch (err) { setNotice({ type: 'error', message: err.message }); }
  }

  async function verify(e) {
    e.preventDefault();
    try {
      const data = await request(`/regulatory-updates/${verification.id}/verify`, { method: 'PATCH', body: JSON.stringify(verifyForm) });
      setState(data.state); setVerification(null);
      setNotice({ type: 'success', message: 'Source verification and impact mapping recorded.' });
    } catch (err) { setNotice({ type: 'error', message: err.message }); }
  }

  const open = state.regulatoryUpdates.filter(item => item.status !== 'Verified and mapped').length;
  const critical = state.regulatoryUpdates.filter(item => item.severity === 'Critical').length;
  return <>
    <div className="module-hero regulatory-hero"><div><span className="eyebrow">VERIFIED REGULATORY INTELLIGENCE</span><h2>Register, verify and propagate legal change.</h2><p>Synesis separates an unverified regulatory proposition from an authorised source conclusion. No rule is silently activated until source, scope and impact are recorded.</p></div><div className="module-kpis"><div><strong>{open}</strong><span>awaiting verification</span></div><div><strong>{critical}</strong><span>critical propositions</span></div><div><strong>{state.metrics.regulatoryUpdatesOpen}</strong><span>open mappings</span></div></div></div>
    <div className="section-head"><div><small>Regulatory change register</small><h2>Source-controlled updates</h2></div><button className="primary" onClick={() => setShowForm(value => !value)}><Plus size={17} /> Register update</button></div>
    {showForm && <form className="inline-workbench" onSubmit={register}>
      <label className="span-2">Update title<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Exact title or controlled working description" /></label>
      <label>Regulator<input required value={form.regulator} onChange={e => setForm({ ...form, regulator: e.target.value })} /></label>
      <label>Jurisdiction<input value={form.jurisdiction} onChange={e => setForm({ ...form, jurisdiction: e.target.value })} /></label>
      <label>Published date<input type="date" value={form.publishedDate} onChange={e => setForm({ ...form, publishedDate: e.target.value })} /></label>
      <label>Effective date<input type="date" value={form.effectiveDate} onChange={e => setForm({ ...form, effectiveDate: e.target.value })} /></label>
      <label>Severity<select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>{['Critical','High','Medium','Low'].map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Owner<input value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} /></label>
      <label className="span-2">Domains<input value={form.domains} onChange={e => setForm({ ...form, domains: e.target.value })} placeholder="Comma-separated" /></label>
      <label className="span-2">Source reference<input value={form.sourceReference} onChange={e => setForm({ ...form, sourceReference: e.target.value })} placeholder="Official URL, gazette identifier or licensed source reference" /></label>
      <label className="span-4">Controlled summary<textarea required value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} /></label>
      <div className="span-4 form-actions"><button type="button" className="ghost" onClick={() => setShowForm(false)}>Cancel</button><button className="primary">Register for verification</button></div>
    </form>}
    <div className="regulatory-grid">{state.regulatoryUpdates.map(item => <article key={item.id} className="regulatory-card"><header><RiskBadge value={item.severity} /><Status value={item.status} /></header><h3>{item.title}</h3><p>{item.summary}</p><div className="chip-list">{(item.domains || []).map(domain => <span key={domain}>{domain}</span>)}</div><div className="regulatory-meta"><KeyValue label="Regulator" value={item.regulator} /><KeyValue label="Jurisdiction" value={item.jurisdiction} /><KeyValue label="Effective" value={formatDate(item.effectiveDate)} /><KeyValue label="Mapped items" value={item.mappedItems || 0} /></div><footer><span>{item.confidence || 0}% source confidence</span>{item.status !== 'Verified and mapped' ? <button className="text-button" onClick={() => { setVerification(item); setVerifyForm({ sourceReference: item.sourceReference || '', verificationNote: '', mappedItems: item.mappedItems || 0, confidence: 85 }); }}>Verify and map <ArrowRight size={15} /></button> : <span className="verified-by"><BadgeCheck size={15} /> {item.verifiedBy || 'Verified'}</span>}</footer></article>)}</div>
    <div className="two-col"><Panel title="Authoritative source registry" subtitle="Connectors remain subject to licensing and human source verification">{state.sources.map(source => <div className="source-row" key={source.id}><Globe2 /><div><strong>{source.name}</strong><small>{source.jurisdiction} · {source.type}</small></div><Status value={source.status} /></div>)}</Panel><Panel title="Control doctrine" subtitle="What Synesis will not do"><div className="guardrail-list">{['No current-law conclusion from an unverified prompt','No silent activation of a new legal rule','No autonomous high-risk remediation','No redistribution of restricted regulatory content','Every verified conclusion records source, verifier and confidence'].map(item => <span key={item}><ShieldCheck />{item}</span>)}</div></Panel></div>
    {verification && <div className="modal-backdrop"><div className="modal"><header><div><small>CONTROLLED SOURCE VERIFICATION</small><h2>{verification.title}</h2></div><button className="icon" onClick={() => setVerification(null)}>×</button></header><form className="form-grid" onSubmit={verify}><label className="full">Official or licensed source reference<input required value={verifyForm.sourceReference} onChange={e => setVerifyForm({ ...verifyForm, sourceReference: e.target.value })} /></label><label className="full">Verification and scope note<textarea required value={verifyForm.verificationNote} onChange={e => setVerifyForm({ ...verifyForm, verificationNote: e.target.value })} placeholder="State what was checked, its legal scope, affected obligations and material limitations." /></label><label>Mapped institutional items<input type="number" min="0" value={verifyForm.mappedItems} onChange={e => setVerifyForm({ ...verifyForm, mappedItems: Number(e.target.value) })} /></label><label>Confidence<input type="number" min="60" max="100" value={verifyForm.confidence} onChange={e => setVerifyForm({ ...verifyForm, confidence: Number(e.target.value) })} /></label><div className="full form-actions"><button type="button" className="ghost" onClick={() => setVerification(null)}>Cancel</button><button className="primary">Record verification</button></div></form></div></div>}
  </>;
}

export function ClauseMemory({ state, request, setState, setNotice }) {
  const archetypes = state.clauseMemory?.archetypes || [];
  const [selected, setSelected] = useState(archetypes[0]?.id || '');
  const [form, setForm] = useState({ action: 'Accepted with modification', lesson: '', source: 'Authorised legal review' });
  async function record(e) {
    e.preventDefault();
    try {
      const data = await request('/clause-memory/feedback', { method: 'POST', body: JSON.stringify({ clauseId: selected, ...form }) });
      setState(data.state); setForm({ action: 'Accepted with modification', lesson: '', source: 'Authorised legal review' });
      setNotice({ type: 'success', message: 'Human-validated clause memory recorded without silently changing approved positions.' });
    } catch (err) { setNotice({ type: 'error', message: err.message }); }
  }
  return <>
    <div className="module-hero memory-hero"><div><span className="eyebrow">CLAUSE MEMORY GRAPH</span><h2>A governed memory of language, outcomes and legal position.</h2><p>Clause variants are linked to risks, regulations, negotiations, accepted wording and later outcomes. Candidate learning remains separate from validated institutional memory.</p></div><div className="module-kpis"><div><strong>{state.clauseMemory?.coverage || 0}%</strong><span>memory coverage</span></div><div><strong>{archetypes.length}</strong><span>clause archetypes</span></div><div><strong>{state.clauseMemory?.feedbackEvents?.length || 0}</strong><span>feedback events</span></div></div></div>
    <div className="memory-archetypes">{archetypes.map(item => <article key={item.id} className={selected === item.id ? 'selected' : ''} onClick={() => setSelected(item.id)}><div><LibraryBig /><RiskBadge value={item.risk || item.defaultRisk} /></div><h3>{item.name || item.title}</h3><p>{item.description || item.preferredPosition || item.lesson}</p><div className="chip-list">{(item.regulations || item.tags || item.linkedRules || []).slice(0,5).map(value => <span key={value}>{value}</span>)}</div><footer><span>{item.variants || item.variantCount || 0} variants</span><span>{item.acceptanceRate || item.confidence || 0}% confidence</span></footer></article>)}</div>
    <div className="two-col wide-left"><Panel title="Record authoritative feedback" subtitle="Human acceptance, rejection or modification becomes a versioned event"><form className="compact-form" onSubmit={record}><label>Clause archetype<select required value={selected} onChange={e => setSelected(e.target.value)}>{archetypes.map(item => <option value={item.id} key={item.id}>{item.name || item.title}</option>)}</select></label><label>Action<select value={form.action} onChange={e => setForm({ ...form, action: e.target.value })}>{['Accepted','Accepted with modification','Rejected','Escalated','Superseded'].map(item => <option key={item}>{item}</option>)}</select></label><label>Source<input value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} /></label><label>Institutional lesson<textarea required value={form.lesson} onChange={e => setForm({ ...form, lesson: e.target.value })} placeholder="Record what was accepted, why, limitations and when the position should be reused." /></label><button className="primary"><Fingerprint size={16} /> Commit validated memory</button></form></Panel><Panel title="Graph relationships" subtitle={`${state.clauseMemory?.edges?.length || 0} controlled relationships`}><div className="relationship-stack">{(state.clauseMemory?.edges || []).slice(0,12).map((edge,index) => <div key={edge.id || index}><GitBranch /><span><strong>{edge.from || edge[0]}</strong><small>{edge.relation || edge[2]}</small><strong>{edge.to || edge[1]}</strong></span></div>)}</div></Panel></div>
    <div className="section-head"><div><small>Human feedback ledger</small><h2>Recent learning events</h2></div></div><div className="audit-list">{(state.clauseMemory?.feedbackEvents || []).slice(0,30).map(item => <div key={item.id}><BookOpenCheck /><div><strong>{item.action}: {item.clauseId}</strong><small>{item.lesson} · {item.source}</small></div><span>{formatDate(item.recordedAt)}</span></div>)}</div>
  </>;
}

export function LitigationLab({ state, request, setState, setNotice }) {
  const [form, setForm] = useState({ name: '', clauseType: 'Limitation of liability', jurisdiction: 'India', event: '', probability: 30, clauseStrength: 55, evidenceStrength: 50, proceduralRisk: 45, exposure: 0 });
  const [busy, setBusy] = useState(false);
  async function run(e) {
    e.preventDefault(); setBusy(true);
    try {
      const data = await request('/litigation-simulations', { method: 'POST', body: JSON.stringify(form) });
      setState(data.state); setNotice({ type: 'success', message: 'Illustrative dispute scenario generated with explicit confidence limits.' });
      setForm(current => ({ ...current, name: '', event: '' }));
    } catch (err) { setNotice({ type: 'error', message: err.message }); } finally { setBusy(false); }
  }
  return <>
    <div className="module-hero litigation-hero"><div><span className="eyebrow">CLAUSE-LEVEL DISPUTE SIMULATION</span><h2>Stress-test drafting before relying on it.</h2><p>This module produces scenario indicators—not legal predictions. It exposes the assumptions, evidence strength, procedural risk and confidence behind each result.</p></div><Gavel size={76} /></div>
    <div className="two-col wide-left"><Panel title="Simulation inputs" subtitle="Authorised users remain responsible for facts, jurisdiction and legal advice"><form className="simulation-form" onSubmit={run}><label>Scenario name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Supplier indemnity enforcement after data breach" /></label><div className="form-pair"><label>Clause type<input value={form.clauseType} onChange={e => setForm({ ...form, clauseType: e.target.value })} /></label><label>Jurisdiction<input value={form.jurisdiction} onChange={e => setForm({ ...form, jurisdiction: e.target.value })} /></label></div><label>Trigger event<textarea required value={form.event} onChange={e => setForm({ ...form, event: e.target.value })} placeholder="Describe the assumed breach, loss, evidence and dispute posture." /></label>{[['Input probability','probability'],['Clause strength','clauseStrength'],['Evidence strength','evidenceStrength'],['Procedural risk','proceduralRisk']].map(([label,key]) => <label className="range-control" key={key}><span>{label}<b>{form[key]}%</b></span><input type="range" min="1" max="100" value={form[key]} onChange={e => setForm({ ...form, [key]: Number(e.target.value) })} /></label>)}<label>Potential exposure (INR)<input type="number" min="0" value={form.exposure} onChange={e => setForm({ ...form, exposure: Number(e.target.value) })} /></label><button className="primary" disabled={busy}>{busy ? <><RefreshCw className="spin" size={16} /> Simulating…</> : <><BrainCircuit size={16} /> Run governed simulation</>}</button></form></Panel><Panel title="Method and limitations" subtitle="Transparent assumptions"><div className="guardrail-list">{['Probability is a scenario input adjusted by evidence and procedural risk','Enforceability is an indicator, not a court-outcome forecast','No case-law authority is asserted unless separately verified','Financial exposure is user-supplied and not a damages opinion','Every result requires jurisdiction-specific authorised legal review'].map(item => <span key={item}><Scale />{item}</span>)}</div></Panel></div>
    <div className="section-head"><div><small>Simulation portfolio</small><h2>Dispute and enforcement scenarios</h2></div></div><div className="litigation-grid">{(state.litigationSimulations || []).map(item => <article key={item.id}><header><Status value={item.status} /><span>{item.confidence}% confidence</span></header><h3>{item.name}</h3><p>{item.event}</p><div className="score-pair"><div><small>Dispute probability</small><strong>{item.probability}%</strong></div><div><small>Enforceability indicator</small><strong>{item.enforceability}%</strong></div></div><KeyValue label="Clause / jurisdiction" value={`${item.clauseType} · ${item.jurisdiction}`} /><KeyValue label="Exposure input" value={money(item.exposure)} /><div className="driver-list">{(item.keyDrivers || []).map(driver => <span key={driver}>{driver}</span>)}</div><footer>{item.recommendation}</footer></article>)}</div>
  </>;
}

export function GovernanceHub({ state, request, setState, setNotice }) {
  const [drafts, setDrafts] = useState(() => Object.fromEntries((state.governanceFrameworks || []).map(item => [item.id, { readiness: item.readiness, gaps: (item.gaps || []).join(', ') }])));
  async function save(item) {
    const draft = drafts[item.id] || { readiness: item.readiness, gaps: '' };
    try {
      const data = await request(`/governance-frameworks/${item.id}`, { method: 'PATCH', body: JSON.stringify({ readiness: Number(draft.readiness), gaps: splitList(draft.gaps) }) });
      setState(data.state); setNotice({ type: 'success', message: `${item.name} assessment updated.` });
    } catch (err) { setNotice({ type: 'error', message: err.message }); }
  }
  return <>
    <div className="module-hero governance-hero"><div><span className="eyebrow">CROSS-BORDER AI, ESG & LEGAL GOVERNANCE</span><h2>Translate governance frameworks into accountable controls.</h2><p>Assess readiness, record control gaps, connect them to evidence and prevent unsupported claims about compliance maturity.</p></div><div className="readiness-dial"><strong>{state.metrics.governanceReadiness}%</strong><span>aggregate readiness</span></div></div>
    <div className="governance-grid">{(state.governanceFrameworks || []).map(item => { const draft = drafts[item.id] || { readiness: item.readiness, gaps: '' }; return <article key={item.id}><header><div><ShieldCheck /><span><strong>{item.name}</strong><small>{item.domain}</small></span></div><Status value={item.status} /></header><MiniProgress value={Number(draft.readiness)} /><label className="range-control"><span>Readiness<b>{draft.readiness}%</b></span><input type="range" min="0" max="100" value={draft.readiness} onChange={e => setDrafts(current => ({ ...current, [item.id]: { ...draft, readiness: Number(e.target.value) } }))} /></label><div className="chip-list">{(item.controls || []).map(control => <span key={control}>{control}</span>)}</div><label>Open gaps<textarea value={draft.gaps} onChange={e => setDrafts(current => ({ ...current, [item.id]: { ...draft, gaps: e.target.value } }))} /></label><button className="ghost" onClick={() => save(item)}>Save governed assessment</button></article>; })}</div>
    <div className="two-col"><Panel title="Deployment models" subtitle="Security and operational readiness by delivery mode"><div className="delivery-list">{(state.deliveryModes || []).map(item => <div key={item.name}><div><strong>{item.name}</strong><span>{item.readiness}%</span></div><MiniProgress value={item.readiness} /><small>Gaps: {(item.gaps || []).join(' · ')}</small></div>)}</div></Panel><Panel title="Sector solutions" subtitle="Reusable core with sector-specific rule and evidence packs"><div className="vertical-list">{(state.verticals || []).map(item => <div key={item.name}><Building2 /><span><strong>{item.name}</strong><small>{(item.capabilities || []).join(' · ')}</small></span><b>{item.readiness}%</b></div>)}</div></Panel></div>
  </>;
}

export function VentureStudio({ state, request, setState, setNotice }) {
  const [form, setForm] = useState({ startingRevenueCr: 1, annualGrowthPercent: 100, startingCostCr: 4, costGrowthPercent: 55 });
  const years = state.financialScenario?.years || [];
  async function model(e) {
    e.preventDefault();
    try { const data = await request('/financial-scenario', { method: 'POST', body: JSON.stringify(form) }); setState(data.state); setNotice({ type: 'success', message: 'Illustrative management scenario recalculated. It remains expressly non-forecast.' }); }
    catch (err) { setNotice({ type: 'error', message: err.message }); }
  }
  async function exportPlatform() {
    try { const data = await request('/platform/export'); downloadJson(`synesis-platform-evidence-pack-${new Date().toISOString().slice(0,10)}.json`, data.pack); setNotice({ type: 'success', message: 'Platform evidence pack exported with claim controls and provenance.' }); }
    catch (err) { setNotice({ type: 'error', message: err.message }); }
  }
  return <>
    <div className="module-hero venture-hero"><div><span className="eyebrow">PRODUCT, IP & COMMERCIAL CONTROL ROOM</span><h2>Convert the vision into a verifiable operating plan.</h2><p>This workspace separates demonstrated product capability, management assumptions, patent candidates and unsupported claims. It is not an investor offer or legal opinion.</p></div><button className="primary" onClick={exportPlatform}><FileDown size={17} /> Export evidence pack</button></div>
    <div className="two-col"><Panel title="Business model" subtitle={state.businessModel?.primary}>{(state.businessModel?.revenueStreams || []).map(item => <div className="business-row" key={item.name}><CircleDollarSign /><div><strong>{item.name}</strong><p>{item.model}</p></div><Status value={item.status} /></div>)}</Panel><Panel title="Illustrative pricing assumptions" subtitle="Management assumptions only">{(state.businessModel?.pricingAssumptions || []).map(item => <div className="key-value" key={item.tier}><span>{item.tier}<small>{item.scope}</small></span><strong>{money(item.annualInr)} / year</strong></div>)}</Panel></div>
    <div className="section-head"><div><small>Financial scenario laboratory</small><h2>Five-year illustrative model</h2></div><span className="assumption-label">Not a forecast or investment representation</span></div>
    <form className="scenario-controls" onSubmit={model}><label>Starting revenue (Cr)<input type="number" step="0.1" min="0" value={form.startingRevenueCr} onChange={e => setForm({ ...form, startingRevenueCr: Number(e.target.value) })} /></label><label>Revenue growth %<input type="number" value={form.annualGrowthPercent} onChange={e => setForm({ ...form, annualGrowthPercent: Number(e.target.value) })} /></label><label>Starting cost (Cr)<input type="number" step="0.1" min="0" value={form.startingCostCr} onChange={e => setForm({ ...form, startingCostCr: Number(e.target.value) })} /></label><label>Cost growth %<input type="number" value={form.costGrowthPercent} onChange={e => setForm({ ...form, costGrowthPercent: Number(e.target.value) })} /></label><button className="primary"><BarChart3 size={16} /> Recalculate</button></form>
    <div className="table-card"><table><thead><tr><th>Year</th><th>Revenue</th><th>Operating cost</th><th>Cash flow</th><th>Gross margin</th></tr></thead><tbody>{years.map(item => <tr key={item.year}><td>Year {item.year}</td><td>₹{item.revenueCr} Cr</td><td>₹{item.operatingCostCr} Cr</td><td className={item.cashFlowCr < 0 ? 'negative-number' : 'positive-number'}>₹{item.cashFlowCr} Cr</td><td>{item.grossMargin}%</td></tr>)}</tbody></table></div>
    <div className="two-col"><Panel title="IP concept register" subtitle="Patentability and filing strategy require qualified patent counsel">{(state.ipPortfolio || []).map(item => <div className="ip-row" key={item.id}><Fingerprint /><div><strong>{item.invention}</strong><p>{item.noveltyFocus}</p><small>{item.protection}</small></div><Status value={item.status} /></div>)}</Panel><Panel title="Claim verification register" subtitle="Unsafe investor claims are blocked until documentary proof exists"><div className="claim-register">{(state.investorReadiness?.claimRegister || []).map(item => <div key={item.claim}><AlertTriangle /><span><strong>{item.claim}</strong><small>{item.status}</small></span></div>)}</div></Panel></div>
    <div className="section-head"><div><small>Execution roadmap</small><h2>From clause intelligence to enterprise infrastructure</h2></div></div><div className="roadmap-grid">{(state.roadmap || []).map(item => <article key={item.phase}><header><span>{item.phase}</span><Status value={item.status} /></header><small>{item.horizon}</small><h3>{item.name}</h3><ul>{(item.deliverables || []).map(value => <li key={value}><CheckCircle2 />{value}</li>)}</ul></article>)}</div>
  </>;
}
