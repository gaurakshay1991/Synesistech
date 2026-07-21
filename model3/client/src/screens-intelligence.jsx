import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Archive, ArrowRight, BarChart3, BellRing, Bot, BrainCircuit,
  Building2, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, Database, FileCheck2,
  FilePlus2, FileSearch2, FileText, Fingerprint, Gauge, GitBranch, Globe2, KeyRound,
  LayoutDashboard, LibraryBig, Link2, ListChecks, LogOut, Menu, MessageSquareText,
  Network, Play, Plus, RefreshCw, Scale, Search, Send, Settings2, ShieldCheck, Sparkles,
  Target, UploadCloud, UserCog, Users, X, Zap
} from 'lucide-react';
import { formatDate, money, downloadJson, tone, Modal, Panel, RiskBadge, Status, KeyValue, MiniProgress, ProgressRow } from './ui.jsx';

export function Twin({ state }) {
  const nodes = state.graph.nodes;
  return <><div className="page-intro"><div><span className="eyebrow">INSTITUTIONAL DECISION TWIN</span><h2>A living model of what the institution is, must do and has decided.</h2><p>The graph connects entities, products, vendors, obligations, controls, decisions, systems and evidence. Every relationship is intended to be traceable to source.</p></div><div className="twin-stats"><span><strong>{nodes.length}</strong> visible nodes</span><span><strong>{state.graph.edges.length}</strong> relationships</span></div></div><div className="graph-canvas">{nodes.map((node, index) => { const positions = [[12,42],[30,18],[32,68],[52,12],[55,47],[76,28],[78,70]]; const [left, top] = positions[index] || [50,50]; return <div className={`graph-node ${tone(node.type)} ${tone(node.risk)}`} style={{ left: `${left}%`, top: `${top}%` }} key={node.id}><Network size={16} /><strong>{node.label}</strong><span>{node.type}</span></div>; })}<svg className="graph-lines" viewBox="0 0 1000 560" preserveAspectRatio="none">{[[150,250,320,120],[150,250,330,390],[330,390,550,75],[550,75,560,260],[560,260,770,160],[770,160,800,400]].map((line,index)=><line key={index} x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} />)}</svg><div className="graph-legend">{['Organisation','Product','Third party','Obligation','Control','Decision','Evidence'].map(item => <span key={item}><i className={tone(item)} />{item}</span>)}</div></div><div className="relationship-list">{state.graph.edges.map((edge, index) => <div key={index}><strong>{nodes.find(n => n.id === edge[0])?.label}</strong><span>{edge[2]}</span><strong>{nodes.find(n => n.id === edge[1])?.label}</strong></div>)}</div></>;
}

export function Packs({ state }) { return <><div className="page-intro"><div><span className="eyebrow">CONNECTED SOLUTION PACKS</span><h2>One core. Multiple regulated workflows.</h2><p>Each pack uses the same source, obligation, impact, decision, execution, evidence and memory primitives. No disconnected dashboards.</p></div></div><div className="pack-grid">{state.packs.map((pack, index) => <article key={pack.id}><div className="pack-icon">{[FileSearch2, Globe2, Building2, Users, ShieldCheck, Gauge, GitBranch, Archive][index] && (() => { const I = [FileSearch2, Globe2, Building2, Users, ShieldCheck, Gauge, GitBranch, Archive][index]; return <I />; })()}</div><h3>{pack.name}</h3><p>{pack.description}</p><MiniProgress value={pack.maturity} /><footer><span>{pack.maturity}% model maturity</span><button className="text-button">Open pack <ChevronRight size={15} /></button></footer></article>)}</div></>;
}

export function Reports({ state, documents, request, setNotice }) {
  const riskCounts = ['Critical','High','Medium','Low'].map(risk => ({ risk, count: state.obligations.filter(item => item.risk === risk).length }));
  async function generate(item) { try { const data = await request('/reports/assurance-pack'); downloadJson(`synesis-assurance-pack-${new Date().toISOString().slice(0,10)}.json`, { requestedReport: item, ...data.report }); setNotice({ type: 'success', message: `${item} generated from governed institutional data.` }); } catch (err) { setNotice({ type: 'error', message: err.message }); } }
  return <><MetricGrid metrics={state.metrics} /><div className="two-col"><Panel title="Obligation risk distribution" subtitle={`${state.obligations.length} mapped obligations`}><div className="report-bars">{riskCounts.map(item => <div key={item.risk}><span>{item.risk}</span><div><i className={tone(item.risk)} style={{ width: `${Math.max(4, item.count * 18)}%` }} /></div><strong>{item.count}</strong></div>)}</div></Panel><Panel title="Operating assurance" subtitle="Management-level indicators"><KeyValue label="Evidence coverage" value={`${state.metrics.evidenceCoverage}%`} /><KeyValue label="Control gaps" value={state.metrics.controlsAtRisk} /><KeyValue label="Average decision cycle" value={`${state.metrics.averageCycleDays} days`} /><KeyValue label="Analysed documents" value={documents.length} /><KeyValue label="Modelled prevented exposure" value={money(state.metrics.preventedExposure)} /></Panel></div><div className="report-grid">{['Regulator-ready evidence pack', 'Board risk and decision report', 'Open obligation register', 'Third-party concentration view', 'Decision rationale and dissent log', 'AI provenance and model-risk pack'].map(item => <button key={item} onClick={() => generate(item)}><FileCheck2 /><span><strong>{item}</strong><small>Generate from governed institutional data</small></span><ArrowRight /></button>)}</div></>;
}

function MetricGrid({ metrics }) {
  const items = [
    ['Attention now', metrics.attention, AlertTriangle, 'Requires ownership or decision'],
    ['Critical exposure', metrics.critical, ShieldCheck, 'High-consequence active items'],
    ['Decisions pending', metrics.decisionsPending, Scale, 'Waiting for authorised approval'],
    ['Controls at risk', metrics.controlsAtRisk, Gauge, 'Below assurance threshold'],
    ['Avg. cycle time', `${metrics.averageCycleDays}d`, Clock3, 'Intake to governed disposition'],
    ['Prevented exposure', money(metrics.preventedExposure), Target, 'Modelled protected value']
  ];
  return <div className="metric-grid">{items.map(([label, value, Icon, note]) => <div className="metric" key={label}><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div><Icon /></div>)}</div>;
}

export function AskSynesis({ state, active, request }) {
  const [question, setQuestion] = useState('What requires management attention today and why?');
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'I can explain the active document using its evidence, or analyse the current institutional decision and execution state. I distinguish recorded evidence from inference.' }]);
  const [busy, setBusy] = useState(false);
  async function ask(e) { e.preventDefault(); if (!question.trim()) return; const q = question; setMessages(m => [...m, { role: 'user', text: q }]); setQuestion(''); setBusy(true); try { const result = active ? await request(`/documents/${active.id}/ask`, { method: 'POST', body: JSON.stringify({ question: q }) }) : await request('/ask', { method: 'POST', body: JSON.stringify({ question: q }) }); setMessages(m => [...m, { role: 'assistant', text: `${result.answer}\n\nEngine: ${result.engine || 'Synesis'}` }]); } catch (err) { setMessages(m => [...m, { role: 'assistant', text: `I could not complete that request: ${err.message}` }]); } finally { setBusy(false); } }
  return <div className="chat-layout"><aside><Bot /><h2>Ask Synesis</h2><p>Evidence-scoped institutional intelligence with provenance and uncertainty.</p><div className="scope"><small>Current scope</small><strong>{active ? active.title : 'Institutional command data'}</strong></div><div className="suggestions">{['What blocks closure?', 'Which controls are weakest?', 'Show analogous decisions', 'What evidence is missing?'].map(item => <button key={item} onClick={() => setQuestion(item)}>{item}</button>)}</div></aside><div className="chat"><div className="messages">{messages.map((message,index) => <div className={message.role} key={index}><div>{message.role === 'assistant' ? <Zap size={16} /> : 'You'}</div><p>{message.text}</p></div>)}{busy && <div className="assistant"><div><RefreshCw className="spin" size={16} /></div><p>Reading the active evidence and decision state…</p></div>}</div><form onSubmit={ask}><textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask about the active evidence, obligations, decisions or execution state" /><button className="primary"><Send size={17} /></button></form></div></div>;
}

function offlineInstitutionAnswer(state, question) {
  const q = question.toLowerCase();
  if (q.includes('control')) return `The weakest active controls are ${state.controls.slice().sort((a,b)=>a.effectiveness-b.effectiveness).slice(0,3).map(x=>`${x.id} ${x.name} (${x.effectiveness}%)`).join('; ')}. The immediate management issue is whether owners have an approved remediation path and verifiable evidence.`;
  if (q.includes('evidence')) return `${state.evidence.filter(x=>x.status!=='Verified').length} evidence items are not verified. Overall evidence coverage is ${state.metrics.evidenceCoverage}%. Priority should follow critical obligations and decisions awaiting final approval.`;
  if (q.includes('analog') || q.includes('memory')) return state.memories.map(x=>`${x.similarity}%: ${x.title} — ${x.lesson}`).join('\n\n');
  if (q.includes('block')) return state.tasks.filter(x=>x.blocker).map(x=>`${x.title}: ${x.blocker}`).join('\n') || 'No explicit blockers are recorded.';
  return `${state.metrics.attention} items require attention, including ${state.metrics.critical} critical exposures and ${state.metrics.decisionsPending} pending decisions. The highest-priority path is to resolve critical approval gates, complete blocked control remediation and verify closure evidence.`;
}
