import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, BadgeIndianRupee, Building2, CheckCircle2, FileSearch, Gauge, LayoutDashboard, Plus, Scale, ShieldCheck, Sparkles } from 'lucide-react';
import './parma.css';

const FACTORS = [
  ['regulatory', 'Regulatory exposure', 20],
  ['financial', 'Financial exposure', 20],
  ['counterparty', 'Counterparty strength', 15],
  ['contractual', 'Contractual protection', 15],
  ['operational', 'Operational dependency', 10],
  ['reputational', 'Reputational sensitivity', 10],
  ['data', 'Data / cyber exposure', 10]
];

const SAMPLE = [
  { title: 'Cross-border tuition remittance partner', type: 'Transaction', value: 18500000, score: 78, status: 'Decision required', owner: 'Legal & Compliance' },
  { title: 'Air purification system procurement', type: 'Procurement', value: 4200000, score: 42, status: 'Controls proposed', owner: 'Procurement' },
  { title: 'Data-provider subscription renewal', type: 'Advisory', value: 1250000, score: 27, status: 'Ready to approve', owner: 'Business' }
];

const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

function classify(score) {
  if (score >= 75) return { label: 'Critical', tone: 'critical', multiplier: 0.65 };
  if (score >= 50) return { label: 'High', tone: 'high', multiplier: 0.4 };
  if (score >= 25) return { label: 'Medium', tone: 'medium', multiplier: 0.18 };
  return { label: 'Low', tone: 'low', multiplier: 0.06 };
}

export default function ParmaApp() {
  const [view, setView] = useState('command');
  const [name, setName] = useState('');
  const [dealType, setDealType] = useState('Transaction');
  const [value, setValue] = useState(10000000);
  const [controls, setControls] = useState(30);
  const [scores, setScores] = useState({ regulatory: 70, financial: 65, counterparty: 55, contractual: 60, operational: 35, reputational: 45, data: 30 });

  const result = useMemo(() => {
    const gross = FACTORS.reduce((sum, [key, , weight]) => sum + (scores[key] * weight / 100), 0);
    const residual = Math.max(0, Math.round(gross * (1 - controls / 100)));
    const band = classify(residual);
    const exposure = Math.round(Number(value || 0) * band.multiplier * (residual / 100));
    return { gross: Math.round(gross), residual, band, exposure };
  }, [scores, controls, value]);

  return <div className="parma-app">
    <aside className="parma-sidebar">
      <div className="parma-logo"><span>P</span><div><strong>PARMA</strong><small>Risk Decision OS</small></div></div>
      <button className={view === 'command' ? 'active' : ''} onClick={() => setView('command')}><LayoutDashboard size={17}/> Command centre</button>
      <button className={view === 'assess' ? 'active' : ''} onClick={() => setView('assess')}><Gauge size={17}/> Assess risk</button>
      <button><FileSearch size={17}/> Analyse documents</button>
      <button><Scale size={17}/> Decisions</button>
      <button><Building2 size={17}/> Counterparties</button>
      <div className="parma-sidebar-note"><ShieldCheck size={18}/><strong>Explainable by design</strong><small>Every rating shows its basis, controls and monetary exposure.</small></div>
    </aside>

    <main>
      <header className="parma-header"><div><small>INSTITUTIONAL RISK INTELLIGENCE</small><h1>{view === 'assess' ? 'New risk assessment' : 'What needs attention today?'}</h1></div><button className="primary" onClick={() => setView('assess')}><Plus size={16}/> Assess a matter</button></header>

      {view === 'command' ? <>
        <section className="hero-card"><div><span className="eyebrow"><Sparkles size={14}/> Decision intelligence</span><h2>Know why a deal is risky, how risky it is, and what the exposure could cost.</h2><p>PARMA converts legal, regulatory, financial, counterparty, operational and reputational judgement into a consistent, auditable decision structure.</p><button className="primary" onClick={() => setView('assess')}>Start an assessment <ArrowRight size={16}/></button></div><div className="hero-metric"><strong>₹1.34 Cr</strong><span>modelled exposure requiring attention</span><small>Across active matters</small></div></section>
        <section className="metric-grid"><article><small>Open matters</small><strong>18</strong><span>5 require decisions</span></article><article><small>High-risk exposure</small><strong>₹4.8 Cr</strong><span>Before mitigants</span></article><article><small>Residual risk</small><strong>₹1.34 Cr</strong><span>After controls</span></article><article><small>Overdue actions</small><strong>7</strong><span>Across 4 owners</span></article></section>
        <section className="panel"><div className="panel-head"><div><small>PRIORITISED MATTERS</small><h3>Risk queue</h3></div><button>View all</button></div>{SAMPLE.map(item => { const band = classify(item.score); return <div className="matter" key={item.title}><div className={`risk-dot ${band.tone}`}></div><div className="matter-main"><strong>{item.title}</strong><span>{item.type} · {item.owner}</span></div><div><small>Transaction value</small><strong>{money(item.value)}</strong></div><div><small>Risk score</small><strong>{item.score}/100</strong></div><span className={`pill ${band.tone}`}>{band.label}</span><button className="icon"><ArrowRight size={17}/></button></div>})}</section>
      </> : <section className="assessment-layout">
        <div className="panel form-panel"><div className="panel-head"><div><small>STRUCTURED ASSESSMENT</small><h3>Matter profile</h3></div></div>
          <label>Matter name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Vendor onboarding or lending transaction"/></label>
          <div className="two"><label>Type<select value={dealType} onChange={e => setDealType(e.target.value)}><option>Transaction</option><option>Deal</option><option>Procurement</option><option>Contract</option><option>Advisory</option></select></label><label>Value in INR<input type="number" value={value} onChange={e => setValue(e.target.value)}/></label></div>
          <h4>Risk drivers</h4>{FACTORS.map(([key, label, weight]) => <label className="slider" key={key}><span><b>{label}</b><small>{weight}% model weight</small></span><input type="range" min="0" max="100" value={scores[key]} onChange={e => setScores({ ...scores, [key]: Number(e.target.value) })}/><output>{scores[key]}</output></label>)}
          <label className="slider controls"><span><b>Control effectiveness</b><small>Strength of contractual, approval and operational mitigants</small></span><input type="range" min="0" max="80" value={controls} onChange={e => setControls(Number(e.target.value))}/><output>{controls}%</output></label>
        </div>
        <aside className="result-card"><span className="eyebrow"><BadgeIndianRupee size={14}/> Quantified assessment</span><div className={`score-ring ${result.band.tone}`}><strong>{result.residual}</strong><small>/100</small></div><h2>{result.band.label} residual risk</h2><p>Gross inherent risk is <b>{result.gross}/100</b>. Applied controls reduce the modelled score to <b>{result.residual}/100</b>.</p><div className="exposure"><small>Indicative monetary exposure</small><strong>{money(result.exposure)}</strong><span>Modelled downside range based on matter value, residual score and risk band.</span></div><div className="why"><h4>Why this rating?</h4>{FACTORS.filter(([key]) => scores[key] >= 60).slice(0,3).map(([key,label]) => <div key={key}><AlertTriangle size={15}/><span><b>{label}</b> is elevated at {scores[key]}/100 and materially contributes to the score.</span></div>)}{result.residual < 50 && <div><CheckCircle2 size={15}/><span>Controls reduce the inherent exposure by {controls}%.</span></div>}</div><button className="primary full">Create decision record</button><small className="disclaimer">This is an explainable decision-support estimate, not an accounting provision or legal conclusion.</small></aside>
      </section>}
    </main>
  </div>;
}
