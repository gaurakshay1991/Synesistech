import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
const NAV = ['Command Center','Upload & Analyse','Review Center','Scenario Testing','Regulatory & KYC','Reports','Document Assistant','Institutional Memory'];

function riskClass(value='Low'){ return `risk ${value.toLowerCase()}`; }
function download(name, value, type='text/plain'){
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([value],{type})); a.download=name; a.click(); URL.revokeObjectURL(a.href);
}

function Login({onLogin}){
  const [email,setEmail]=useState('legal@synesis.local');
  const [password,setPassword]=useState('LegalDemoOnly123!');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  async function submit(e){
    e.preventDefault(); setBusy(true); setError('');
    try{
      const r=await fetch(`${API}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
      const data=await r.json(); if(!r.ok) throw new Error(data.error||'Login failed'); onLogin(data);
    }catch(e){setError(e.message)} finally{setBusy(false)}
  }
  return <div className="login-page"><form className="login-card" onSubmit={submit}>
    <div className="mark">LS</div><h1>LIVE SYNESIS</h1><p>Document-led legal and compliance intelligence for the Bank.</p>
    <label>Email<input value={email} onChange={e=>setEmail(e.target.value)} /></label>
    <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} /></label>
    {error&&<div className="error">{error}</div>}<button className="primary" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
    <small>Private MVP. Replace demo credentials and authentication before external use.</small>
  </form></div>
}

export default function App(){
  const [session,setSession]=useState(()=>JSON.parse(localStorage.getItem('live-synesis-session')||'null'));
  const [view,setView]=useState('Command Center');
  const [documents,setDocuments]=useState([]);
  const [active,setActive]=useState(null);
  const [metrics,setMetrics]=useState(null);
  const [notice,setNotice]=useState('');
  const [audit,setAudit]=useState([]);
  const token=session?.token;

  async function request(path,options={}){
    const r=await fetch(`${API}${path}`,{...options,headers:{...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),Authorization:`Bearer ${token}`,...options.headers}});
    const data=await r.json(); if(!r.ok) throw new Error(data.detail||data.error||'Request failed'); return data;
  }
  async function refresh(){
    if(!token)return;
    try{
      const [d,m]=await Promise.all([request('/documents'),request('/dashboard')]); setDocuments(d.documents); setMetrics(m);
      if(active){ const found=d.documents.find(x=>x.id===active.id); if(found)setActive(found); }
      if(session.user.role==='admin'){ const a=await request('/admin/audit'); setAudit(a.audit); }
    }catch(e){ setNotice(e.message); }
  }
  useEffect(()=>{refresh()},[token]);
  function login(data){localStorage.setItem('live-synesis-session',JSON.stringify(data));setSession(data)}
  function logout(){localStorage.removeItem('live-synesis-session');setSession(null);setActive(null)}
  if(!session)return <Login onLogin={login}/>;

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="mark small">LS</span><div><b>LIVE SYNESIS</b><small>Bank Legal & Compliance OS</small></div></div>
      <nav>{NAV.map(item=><button key={item} className={view===item?'active':''} onClick={()=>setView(item)}>{item}</button>)}</nav>
      <div className="active-doc"><small>ACTIVE DOCUMENT</small><b>{active?.title||'None selected'}</b><span>{active?`${active.analysis?.overall_risk} risk · ${active.analysis?.overall_score}/100`:'Upload or select a document'}</span></div>
    </aside>
    <main>
      <header><div><h1>{view}</h1><p>{active?`Working from: ${active.title}`:'Start by uploading the document that should control the analysis.'}</p></div><div className="user"><span>{session.user.role}</span><b>{session.user.email}</b><button onClick={logout}>Sign out</button></div></header>
      {notice&&<div className="notice" onClick={()=>setNotice('')}>{notice}</div>}
      {view==='Command Center'&&<Dashboard metrics={metrics} documents={documents} setActive={setActive} setView={setView}/>} 
      {view==='Upload & Analyse'&&<Upload token={token} onDone={doc=>{setActive(doc);setView('Review Center');refresh()}} setNotice={setNotice}/>} 
      {view==='Review Center'&&<Review active={active} request={request} onUpdated={doc=>{setActive(doc);refresh()}}/>}
      {view==='Scenario Testing'&&<Scenarios active={active}/>} 
      {view==='Regulatory & KYC'&&<Regulatory active={active}/>} 
      {view==='Reports'&&<Reports active={active}/>} 
      {view==='Document Assistant'&&<Assistant active={active} request={request}/>} 
      {view==='Institutional Memory'&&<Memory documents={documents} audit={audit} setActive={setActive} setView={setView}/>} 
    </main>
  </div>
}

function Dashboard({metrics,documents,setActive,setView}){
  const cards=[['Documents',metrics?.totalDocuments||0],['High-risk matters',metrics?.highRisk||0],['Open matters',metrics?.open||0],['Findings',metrics?.totalFindings||0],['Scenarios',metrics?.totalScenarios||0]];
  return <><section className="hero"><div><span className="eyebrow">DOCUMENT-FIRST WORKFLOW</span><h2>Know what is risky, why it matters and what the Bank should do next.</h2><p>Every output follows the selected uploaded document—evidence, risk scores, mitigation, rewrites, scenarios and reports.</p></div><button className="primary" onClick={()=>setView('Upload & Analyse')}>Upload a document</button></section>
  <div className="metrics">{cards.map(([a,b])=><div className="metric" key={a}><small>{a}</small><strong>{b}</strong></div>)}</div>
  <section className="panel"><div className="section-head"><div><h3>Recent documents</h3><p>Select a document to make it active across the platform.</p></div></div>
    <div className="table">{documents.length?documents.slice(0,8).map(doc=><button className="row" key={doc.id} onClick={()=>{setActive(doc);setView('Review Center')}}><span><b>{doc.title}</b><small>{doc.documentType} · {doc.matter}</small></span><span className={riskClass(doc.analysis?.overall_risk)}>{doc.analysis?.overall_risk}</span><strong>{doc.analysis?.overall_score}/100</strong><small>{doc.status}</small></button>):<Empty text="No documents analysed yet."/>}</div>
  </section></>
}

function Upload({token,onDone,setNotice}){
  const [file,setFile]=useState(null); const [text,setText]=useState(''); const [busy,setBusy]=useState(false);
  const [form,setForm]=useState({title:'',matter:'Vendor onboarding',documentType:'Auto-detect',jurisdiction:'India',riskAppetite:'Conservative'});
  async function submit(e){e.preventDefault();setBusy(true);setNotice('Extracting and analysing the uploaded document…');
    try{const body=new FormData();if(file)body.append('file',file);body.append('text',text);Object.entries(form).forEach(([k,v])=>body.append(k,v));
      const r=await fetch(`${API}/documents/analyze`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body});const data=await r.json();if(!r.ok)throw new Error(data.detail||data.error);setNotice(`Analysis completed using ${data.document.analysis.engine}.`);onDone(data.document);
    }catch(e){setNotice(e.message)}finally{setBusy(false)}}
  return <section className="panel"><div className="section-head"><div><h2>Upload the actual document</h2><p>PDF, DOCX, TXT, CSV, JSON or Markdown. The extracted content becomes the sole active analysis context.</p></div></div>
    <form className="upload-form" onSubmit={submit}><label className="drop"><input type="file" accept=".pdf,.docx,.txt,.csv,.json,.md" onChange={e=>setFile(e.target.files[0])}/><b>{file?.name||'Choose document'}</b><span>{file?`${Math.round(file.size/1024)} KB`:'Click to select a supported file'}</span></label>
      <div className="form-grid"><label>Title<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Optional; otherwise filename"/></label><label>Matter<input value={form.matter} onChange={e=>setForm({...form,matter:e.target.value})}/></label><label>Document type<select value={form.documentType} onChange={e=>setForm({...form,documentType:e.target.value})}><option>Auto-detect</option><option>Vendor / Outsourcing Agreement</option><option>NDA / Confidentiality Agreement</option><option>Finance Agreement</option><option>Employment Agreement</option><option>Policy / Regulatory Document</option></select></label><label>Jurisdiction<input value={form.jurisdiction} onChange={e=>setForm({...form,jurisdiction:e.target.value})}/></label><label>Risk appetite<select value={form.riskAppetite} onChange={e=>setForm({...form,riskAppetite:e.target.value})}><option>Conservative</option><option>Balanced</option><option>Commercial</option></select></label></div>
      <label>Optional pasted text or context<textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Paste document text when no file is available, or add contextual instructions."/></label>
      <button className="primary" disabled={busy||(!file&&!text.trim())}>{busy?'Analysing actual document…':'Upload and analyse'}</button></form></section>
}

function Review({active,request,onUpdated}){
  const [selected,setSelected]=useState(0); const [comment,setComment]=useState('');
  if(!active)return <Empty text="Select or upload a document first."/>;
  const a=active.analysis||{}; const finding=a.findings?.[selected];
  async function decide(status){if(!finding)return;const data=await request(`/documents/${active.id}/decision`,{method:'POST',body:JSON.stringify({findingId:finding.id,status,comment})});onUpdated(data.document);setComment('')}
  return <><div className="summary"><div><small>OVERALL RISK</small><strong className={riskClass(a.overall_risk)}>{a.overall_risk}</strong></div><div><small>SCORE</small><strong>{a.overall_score}/100</strong></div><div><small>DECISION</small><strong>{a.recommended_decision}</strong></div><div><small>ENGINE</small><strong>{a.engine}</strong></div></div>
    <section className="panel"><h3>{active.title}</h3><p>{a.executive_position}</p></section>
    <div className="review-grid"><section className="panel findings"><h3>Findings ({a.findings?.length||0})</h3>{a.findings?.map((f,i)=><button className={selected===i?'finding active':'finding'} key={f.id} onClick={()=>setSelected(i)}><span className={riskClass(f.risk_level)}>{f.risk_level}</span><b>{f.issue}</b><small>{f.risk_category} · {f.risk_score}/100</small></button>)}</section>
    <section className="panel detail">{finding?<><div className="section-head"><div><span className={riskClass(finding.risk_level)}>{finding.risk_level} · {finding.risk_score}/100</span><h2>{finding.issue}</h2><p>{finding.clause_reference}</p></div></div><h4>Document evidence</h4><blockquote>{finding.quoted_text}</blockquote><h4>Why this is risky for the Bank</h4><p>{finding.why_risky_for_bank}</p><h4>How it may materialise</h4><p>{finding.how_risk_may_materialise}</p><h4>Mitigation</h4><p>{finding.recommended_mitigation}</p><h4>Suggested Bank-protective rewrite</h4><div className="rewrite">{finding.suggested_rewrite}</div><div className="owners">{finding.review_owner?.map(x=><span key={x}>{x}</span>)}</div><textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Decision note or negotiation instruction"/><div className="actions"><button onClick={()=>decide('Assigned for Revision')}>Assign revision</button><button onClick={()=>decide('Escalated')}>Escalate</button><button className="primary" onClick={()=>decide('Accepted with Controls')}>Accept with controls</button></div></>:<Empty text="No finding selected."/>}</section></div>
    <section className="panel"><h3>Potentially missing protections</h3><div className="cards">{a.missing_clauses?.length?a.missing_clauses.map(x=><article key={x.clause}><span className={riskClass(x.risk_level)}>{x.risk_level}</span><h4>{x.clause}</h4><p>{x.why_needed}</p><div className="rewrite">{x.recommended_language}</div></article>):<p>No missing control detected by the current analysis.</p>}</div></section></>
}

function Scenarios({active}){if(!active)return <Empty text="Select a document first."/>;return <section className="panel"><h2>Document-specific stress tests</h2><p>Each scenario is derived from evidence and a risk in {active.title}; no generic scenario library is displayed.</p><div className="cards">{active.analysis?.scenario_tests?.length?active.analysis.scenario_tests.map((s,i)=><article key={i}><span className={riskClass(s.risk_level)}>{s.risk_level}</span><h3>{s.title}</h3><h4>Document trigger</h4><blockquote>{s.trigger_from_document}</blockquote><h4>Event</h4><p>{s.event}</p><h4>Likely outcome</h4><p>{s.likely_outcome}</p><h4>Control</h4><p>{s.recommended_control}</p></article>):<Empty text="No high-risk scenario was generated for this document."/>}</div></section>}

function Regulatory({active}){if(!active)return <Empty text="Select a document first."/>;const a=active.analysis;const kyc=a.findings?.filter(x=>x.risk_category==='KYC/AML'||/kyc|aml|sanction|beneficial/i.test(`${x.issue} ${x.quoted_text}`));return <div className="two-col"><section className="panel"><h2>Regulatory touchpoints</h2>{a.regulatory_touchpoints?.map((x,i)=><article className="item" key={i}><h3>{x.area}</h3><p>{x.relevance}</p><div className="rewrite">{x.action}</div>{x.verification_required&&<small>Current official-source verification required.</small>}</article>)}</section><section className="panel"><h2>KYC / AML relevance</h2>{kyc?.length?kyc.map(x=><article className="item" key={x.id}><span className={riskClass(x.risk_level)}>{x.risk_level}</span><h3>{x.issue}</h3><p>{x.why_risky_for_bank}</p></article>):<Empty text="No specific KYC/AML finding detected in the active document."/>}</section></div>}

function reportText(doc){const a=doc.analysis;return `LIVE SYNESIS DOCUMENT REVIEW REPORT\n\nDocument: ${doc.title}\nType: ${doc.documentType}\nMatter: ${doc.matter}\nOverall risk: ${a.overall_risk} (${a.overall_score}/100)\nRecommended decision: ${a.recommended_decision}\n\nEXECUTIVE POSITION\n${a.executive_position}\n\nFINDINGS\n${(a.findings||[]).map((f,i)=>`${i+1}. [${f.risk_level} ${f.risk_score}/100] ${f.issue}\nEvidence: ${f.quoted_text}\nWhy risky for the Bank: ${f.why_risky_for_bank}\nHow it may materialise: ${f.how_risk_may_materialise}\nMitigation: ${f.recommended_mitigation}\nRewrite: ${f.suggested_rewrite}\nOwners: ${(f.review_owner||[]).join(', ')}`).join('\n\n')}\n\nMISSING PROTECTIONS\n${(a.missing_clauses||[]).map(x=>`- [${x.risk_level}] ${x.clause}: ${x.why_needed}\n  Suggested language: ${x.recommended_language}`).join('\n')}\n\nSCENARIOS\n${(a.scenario_tests||[]).map(x=>`- ${x.title}: ${x.event}\n  Control: ${x.recommended_control}`).join('\n')}\n\nLIMITS\n${(a.assumptions_and_limits||[]).map(x=>`- ${x}`).join('\n')}`}
function Reports({active}){if(!active)return <Empty text="Select a document first."/>;return <section className="panel"><div className="section-head"><div><h2>Decision-ready report</h2><p>Generated only from the active document and its saved analysis.</p></div><div className="actions"><button onClick={()=>download(`${active.title}.json`,JSON.stringify(active,null,2),'application/json')}>Download JSON</button><button className="primary" onClick={()=>download(`${active.title}-report.txt`,reportText(active))}>Download report</button></div></div><pre className="report">{reportText(active)}</pre></section>}

function Assistant({active,request}){const [q,setQ]=useState('What are the three most serious risks for the Bank and what should be negotiated?');const [answer,setAnswer]=useState('');const [busy,setBusy]=useState(false);if(!active)return <Empty text="Select a document first."/>;async function ask(){setBusy(true);try{const data=await request(`/documents/${active.id}/ask`,{method:'POST',body:JSON.stringify({question:q})});setAnswer(data.answer)}catch(e){setAnswer(e.message)}finally{setBusy(false)}}return <section className="panel"><h2>Ask the active document</h2><p>The assistant is restricted to {active.title} and its current findings.</p><textarea value={q} onChange={e=>setQ(e.target.value)}/><button className="primary" onClick={ask} disabled={busy}>{busy?'Reviewing document…':'Ask LIVE SYNESIS'}</button>{answer&&<pre className="answer">{answer}</pre>}</section>}

function Memory({documents,audit,setActive,setView}){return <div className="two-col"><section className="panel"><h2>Institutional memory</h2><p>Saved documents, findings and human decisions form the initial memory layer.</p>{documents.map(doc=><button className="memory-row" key={doc.id} onClick={()=>{setActive(doc);setView('Review Center')}}><span><b>{doc.title}</b><small>{doc.decisions?.length||0} saved decisions · {doc.updatedAt?.slice(0,10)}</small></span><span className={riskClass(doc.analysis?.overall_risk)}>{doc.analysis?.overall_risk}</span></button>)}</section><section className="panel"><h2>Audit trail</h2>{audit.length?audit.slice(0,40).map(x=><div className="audit" key={x.id}><b>{x.action}</b><span>{x.user} · {x.role}</span><small>{new Date(x.at).toLocaleString()}</small></div>):<p>Audit details are available to Admin users.</p>}</section></div>}
function Empty({text}){return <div className="empty"><b>Nothing to display</b><p>{text}</p></div>}
