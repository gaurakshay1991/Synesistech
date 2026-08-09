import React, { useEffect, useMemo, useState } from 'react';
import {
  BrainCircuit, ChevronRight, Copy, FilePlus2, FileText, Fingerprint, Globe2, LogOut, RefreshCw,
  Scale, Send, ShieldCheck, Sparkles, UploadCloud, X, Zap
} from 'lucide-react';
import './product-v8.css';

const API = '/api';

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData) && options.body !== undefined && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API}${path}`, { credentials: 'include', ...options, headers });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text || `HTTP ${response.status}` }; }
  if (!response.ok) {
    const error = new Error(body.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function riskClass(value = '') { return String(value).toLowerCase().replace(/[^a-z]+/g, '-'); }
function Risk({ value = 'Unassessed' }) { return <span className={`v8-risk ${riskClass(value)}`}>{value}</span>; }
function Tag({ children, tone = '' }) { return <span className={`v8-tag ${tone}`}>{children}</span>; }
function Empty({ title, text, action, actionLabel = 'Start' }) { return <div className="v8-empty"><BrainCircuit /><h3>{title}</h3><p>{text}</p>{action && <button className="v8-primary" onClick={action}>{actionLabel}</button>}</div>; }
function Section({ title, subtitle, action, children, className = '' }) { return <section className={`v8-card ${className}`}><header className="v8-card-head"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action}</header>{children}</section>; }
function Loader({ label = 'Working…' }) { return <div className="v8-loader"><RefreshCw className="spin" />{label}</div>; }
function Json({ value }) { return <pre className="v8-json">{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</pre>; }

export default function ProductV8() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [boot, setBoot] = useState(null);
  const [activeId, setActiveId] = useState('');
  const [detail, setDetail] = useState(null);
  const [graph, setGraph] = useState(null);
  const [tab, setTab] = useState('matter');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    Promise.allSettled([api('/auth/session'), fetch(`${API}/product-v8/health`).then(r => r.json())]).then(([session, h]) => {
      if (session.status === 'fulfilled') setUser(session.value.user);
      if (h.status === 'fulfilled') setHealth(h.value);
      setAuthChecked(true);
    });
  }, []);

  async function refresh(preferredId) {
    const data = await api('/bootstrap');
    setBoot(data);
    const next = preferredId || activeId || data.documents?.[0]?.id || '';
    if (next) await openDocument(next, data);
    else { setActiveId(''); setDetail(null); setGraph(null); }
  }

  useEffect(() => { if (user && !user.mustChangePassword) refresh().catch(showError); }, [user?.id, user?.mustChangePassword]);

  function showError(error) { setNotice({ type: 'error', text: error.message || String(error), detail: error.body?.diagnostic }); }
  function showSuccess(text) { setNotice({ type: 'success', text }); }

  async function openDocument(id, bootOverride = null) {
    setActiveId(id);
    setTab('matter');
    const [doc, graphData] = await Promise.all([api(`/documents/${id}`), api(`/documents/${id}/graph`)]);
    setDetail(doc.document);
    setGraph(graphData);
    if (!bootOverride && !boot) await refresh(id);
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null); setBoot(null); setDetail(null); setActiveId('');
  }

  if (!authChecked) return <div className="v8-shell center"><Loader label="Opening SYNESIS…" /></div>;
  if (!user) return <Login onDone={setUser} />;
  if (user.mustChangePassword) return <PasswordSetup user={user} onDone={setUser} onLogout={logout} />;

  const documents = boot?.documents || [];
  const state = boot?.state || {};
  const analysis = detail?.analysis || {};
  const regulatoryImpact = analysis.regulatory_impact || {};
  const liveReady = health?.runtimeSmoke?.neural?.status === 'pass';
  const webReady = health?.runtimeSmoke?.liveResearch?.status === 'pass';

  return <div className="v8-shell">
    <aside className="v8-sidebar">
      <div className="v8-brand"><div className="v8-logo"><Zap /></div><div><strong>SYNESIS</strong><small>MATTER INTELLIGENCE</small></div></div>
      <button className="v8-upload" onClick={() => setUploadOpen(true)}><UploadCloud /> Analyse document</button>
      <div className="v8-side-title"><span>Matters</span><b>{documents.length}</b></div>
      <div className="v8-doc-list">
        {documents.map(doc => <button key={doc.id} className={activeId === doc.id ? 'active' : ''} onClick={() => openDocument(doc.id).catch(showError)}>
          <FileText /><span><strong>{doc.title}</strong><small>{doc.matter || doc.documentType || 'Matter'}</small></span><Risk value={doc.overallRisk} />
        </button>)}
        {!documents.length && <p className="v8-muted">No uploaded matters. Demo matters are excluded.</p>}
      </div>
      <div className="v8-runtime">
        <span><i className={liveReady ? 'ok' : 'bad'} />Neural model {liveReady ? 'live' : health?.runtimeSmoke?.neural?.status || 'checking'}</span>
        <span><i className={webReady ? 'ok' : 'warn'} />Current-law web {webReady ? 'live' : health?.runtimeSmoke?.liveResearch?.status || 'checking'}</span>
        <span><ShieldCheck />Document isolation + stale-law audit</span>
      </div>
      <button className="v8-logout" onClick={logout}><LogOut /> Sign out</button>
    </aside>

    <main className="v8-main">
      <header className="v8-topbar">
        <div><small>DOCUMENT-DERIVED · CURRENT-LAW · COMPLIANCE IMPACT</small><h1>{detail?.title || 'Matter Intelligence Workbench'}</h1></div>
        <div className="v8-top-actions"><button onClick={() => refresh().catch(showError)}><RefreshCw /> Refresh</button><button className="primary" onClick={() => setUploadOpen(true)}><FilePlus2 /> New matter</button></div>
      </header>

      {notice && <div className={`v8-notice ${notice.type}`}><div><strong>{notice.text}</strong>{notice.detail && <small>{notice.detail}</small>}</div><button onClick={() => setNotice(null)}><X /></button></div>}

      {!detail ? <Empty title="Give SYNESIS a real document" text="It will independently analyse the matter, verify cited and omitted current authorities, assess regulatory/compliance impact, quantify only defensible exposure and let you work each clause." action={() => setUploadOpen(true)} actionLabel="Upload first document" /> : <>
        <div className="v8-status-strip">
          <div><span>Risk</span><Risk value={analysis.overall_risk || detail.overallRisk} /></div>
          <div><span>Score</span><strong>{analysis.overall_score ?? detail.score ?? '—'}/100</strong></div>
          <div><span>Regulatory impact</span><Risk value={regulatoryImpact.overallImpact || 'UNASSESSED'} /></div>
          <div><span>Stale authority</span><strong>{regulatoryImpact.staleReferenceWarning ? 'WARNING' : regulatoryImpact.status === 'COMPLETE' ? 'NONE FOUND' : 'NOT VERIFIED'}</strong></div>
          <div><span>Isolation</span><strong>ONE DOCUMENT</strong></div>
        </div>

        <nav className="v8-tabs">
          {[['matter','Clear / raise / let go'],['findings',`Clause review (${analysis.findings?.length || 0})`],['regulatory','Regulatory + compliance'],['exposure','Exposure'],['graph','Clause memory graph'],['brain','Ask this matter'],['law','Current law'],['work','Actions']].map(([key,label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}
        </nav>

        {tab === 'matter' && <MatterDecision detail={detail} analysis={analysis} showError={showError} />}
        {tab === 'findings' && <FindingWorkbench detail={detail} showError={showError} showSuccess={showSuccess} />}
        {tab === 'regulatory' && <RegulatoryImpactView detail={detail} initial={regulatoryImpact} showError={showError} />}
        {tab === 'exposure' && <ExposureView detail={detail} analysis={analysis} showError={showError} />}
        {tab === 'graph' && <GraphView graph={graph?.graph} memories={graph?.clauseMemory || []} />}
        {tab === 'brain' && <MatterBrain detail={detail} showError={showError} />}
        {tab === 'law' && <CurrentLaw analysis={analysis} />}
        {tab === 'work' && <WorkView tasks={(state.tasks || []).filter(item => item.documentId === detail.id)} onChanged={() => refresh(detail.id)} showError={showError} />}
      </>}
    </main>

    {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onDone={async doc => { setUploadOpen(false); await refresh(doc.id); showSuccess('Live document, current-law and compliance-impact analysis completed.'); }} showError={showError} />}
  </div>;
}

function Login({ onDone }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(e) { e.preventDefault(); setBusy(true); setError(''); try { const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); onDone(data.user); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <div className="v8-auth"><div className="v8-auth-copy"><div className="v8-logo large"><Zap /></div><small>SYNESIS v8.1</small><h1>Work the matter. Verify the law behind it.</h1><p>Upload the document, decide what matters, detect stale legal references, quantify what can be quantified, rewrite the clause and preserve only human-approved memory.</p></div><form className="v8-auth-card" onSubmit={submit}><h2>Sign in</h2><label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>{error && <div className="v8-form-error">{error}</div>}<button className="v8-primary" disabled={busy}>{busy ? 'Signing in…' : 'Enter SYNESIS'}</button></form></div>;
}

function PasswordSetup({ user, onDone, onLogout }) {
  const [currentPassword, setCurrent] = useState(''); const [newPassword, setNext] = useState(''); const [error, setError] = useState('');
  async function submit(e) { e.preventDefault(); setError(''); try { const data = await api('/auth/change-password', { method:'POST', body:JSON.stringify({ currentPassword, newPassword }) }); onDone(data.user); } catch (err) { setError(err.message); } }
  return <div className="v8-auth"><form className="v8-auth-card" onSubmit={submit}><small>FIRST LOGIN SECURITY</small><h2>Create your permanent password</h2><p>{user.name}</p><label>Temporary password<input type="password" value={currentPassword} onChange={e => setCurrent(e.target.value)} required /></label><label>New password<input type="password" value={newPassword} onChange={e => setNext(e.target.value)} required /></label>{error && <div className="v8-form-error">{error}</div>}<button className="v8-primary">Secure account</button><button type="button" className="v8-link" onClick={onLogout}>Sign out</button></form></div>;
}

function UploadModal({ onClose, onDone, showError }) {
  const [file, setFile] = useState(null); const [text, setText] = useState(''); const [jurisdiction, setJurisdiction] = useState('India'); const [matter, setMatter] = useState('');
  const [objective, setObjective] = useState('Decide what is worth raising, what can be accepted, whether cited law/circulars are current, identify omitted applicable authority, quantify defensible exposure, mitigate regulatory/compliance risk and draft exact protective wording.');
  const [busy, setBusy] = useState(false); const [drag, setDrag] = useState(false);
  async function submit(e) {
    e.preventDefault(); if (!file && text.trim().length < 20) return;
    setBusy(true);
    try {
      const form = new FormData(); if (file) form.append('file', file); if (text.trim()) form.append('text', text); form.append('jurisdiction', jurisdiction); form.append('matter', matter); form.append('objective', objective);
      const data = await api('/documents/analyze', { method:'POST', body:form }); onDone(data.document);
    } catch (err) { showError(err); } finally { setBusy(false); }
  }
  function drop(e) { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]); }
  return <div className="v8-modal-back"><form className="v8-modal" onSubmit={submit}><header><div><small>LIVE MULTIPASS + REGULATORY FRESHNESS</small><h2>Analyse one document independently</h2></div><button type="button" onClick={onClose}><X /></button></header><div className={`v8-drop ${drag ? 'drag' : ''}`} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={drop}><UploadCloud /><strong>{file ? file.name : 'Drop PDF, DOCX or supported text file'}</strong><input type="file" onChange={e => setFile(e.target.files?.[0] || null)} /></div><div className="v8-or">or paste text</div><textarea value={text} onChange={e => setText(e.target.value)} placeholder="Paste agreement, policy, circular, legal opinion, case material or regulatory document…" /><div className="v8-form-row"><label>Jurisdiction<input value={jurisdiction} onChange={e => setJurisdiction(e.target.value)} /></label><label>Matter / transaction<input value={matter} onChange={e => setMatter(e.target.value)} placeholder="Optional" /></label></div><label>What should SYNESIS optimise for?<textarea className="short" value={objective} onChange={e => setObjective(e.target.value)} /></label><div className="v8-modal-foot"><span><ShieldCheck />A named law/circular is not assumed current merely because the document cites it. Live verification must support that conclusion.</span><button className="v8-primary" disabled={busy || (!file && text.trim().length < 20)}>{busy ? <><RefreshCw className="spin" /> Analysing matter + authority versions…</> : <><BrainCircuit /> Analyse now</>}</button></div></form></div>;
}

function MatterDecision({ detail, analysis, showError }) {
  const [pack, setPack] = useState(null); const [busy, setBusy] = useState(false);
  async function run() { setBusy(true); try { const data = await api(`/documents/${detail.id}/decision-pack`, { method:'POST', body:JSON.stringify({ objective:'Can this matter be cleared? Treat stale law, missing regulatory obligations and compliance gaps as clearance issues. Separate must-fix, worth-raising, acceptable and let-go points.' }) }); setPack(data.decisionPack); } catch (err) { showError(err); } finally { setBusy(false); } }
  return <div className="v8-grid two">
    <Section title="Current analysis" subtitle={analysis.engine || 'Live matter analysis'}><div className="v8-decision"><Sparkles /><div><strong>{analysis.recommended_decision || 'Run the clearance decision.'}</strong><p>{analysis.executive_position || analysis.document_summary}</p>{analysis.regulatory_impact?.staleReferenceWarning && <p><strong>Stale legal/regulatory reference warning:</strong> this can independently block clearance.</p>}</div></div><button className="v8-primary full" onClick={run} disabled={busy}>{busy ? <><RefreshCw className="spin" /> Re-evaluating current law + compliance…</> : <><Scale /> Can this be cleared?</>}</button></Section>
    <Section title="Clearance decision" subtitle="Contract, regulatory, compliance and current-law decision"><>{!pack && !busy && <p className="v8-muted">Run clearance to classify genuinely material points into must-fix, negotiate, accept-with-note or let-go.</p>}{busy && <Loader label="Building clearance pack…" />}{pack && <div className="v8-pack"><div className="v8-pack-head"><Risk value={pack.overall_disposition} /><strong>{pack.clearance_recommendation}</strong></div><p>{pack.executive_rationale}</p>{pack.regulatory_clearance_effect && <><h4>Regulatory clearance effect</h4><p>{pack.regulatory_clearance_effect}</p></>}<DispositionGroup title="Must fix" items={pack.must_fix} tone="critical"/><DispositionGroup title="Raise / negotiate" items={pack.raise_and_negotiate} tone="high"/><DispositionGroup title="Accept with note" items={pack.acceptable_with_note} tone="medium"/><DispositionGroup title="Let go" items={pack.let_go} tone="low"/>{pack.compliance_conditions?.length > 0 && <><h4>Compliance conditions</h4><Json value={pack.compliance_conditions}/></>}<h4>Negotiation plan</h4><Json value={pack.negotiation_plan}/></div>}</></Section>
  </div>;
}

function DispositionGroup({ title, items = [], tone }) { if (!items?.length) return null; return <div className={`v8-disposition ${tone}`}><h4>{title}</h4>{items.map((item,index) => <div key={item.finding_id || item.findingId || index}><strong>{item.issue || item.finding || item.title || item.finding_id}</strong><p>{item.why || item.rationale || item.reason}</p></div>)}</div>; }

function FindingWorkbench({ detail, showError, showSuccess }) {
  const findings = detail.analysis?.findings || [];
  const [openId, setOpenId] = useState(''); const [packs, setPacks] = useState({}); const [busy, setBusy] = useState(''); const [instruction, setInstruction] = useState({});
  async function actionPack(finding, index) {
    const id = finding.id || `finding-${index + 1}`; setBusy(id);
    try { const data = await api(`/documents/${detail.id}/findings/${encodeURIComponent(id)}/action-pack`, { method:'POST', body:JSON.stringify({ instruction: instruction[id] || '' }) }); setPacks(value => ({ ...value, [id]: data.actionPack })); setOpenId(id); }
    catch (err) { showError(err); } finally { setBusy(''); }
  }
  async function saveMemory(finding, index) {
    const id = finding.id || `finding-${index + 1}`; const pack = packs[id]; if (!pack) return;
    try { await api(`/documents/${detail.id}/findings/${encodeURIComponent(id)}/memory`, { method:'POST', body:JSON.stringify({ actionPack: pack }) }); showSuccess('Clause position saved as human-approved institutional memory.'); }
    catch (err) { showError(err); }
  }
  return <div className="v8-findings">{findings.map((finding,index) => {
    const id = finding.id || `finding-${index + 1}`; const pack = packs[id]; const open = openId === id;
    return <article className="v8-finding" key={id}><div className="v8-finding-head"><Risk value={finding.risk_level || finding.risk}/><div><h3>{finding.issue}</h3><p>{finding.clause_reference || finding.category} · {finding.confidence || '—'}% confidence · {finding.reasoning_source || 'Analysis'}</p></div></div><blockquote>{finding.quoted_text || 'No exact quoted evidence returned.'}</blockquote><div className="v8-finding-columns"><div><small>Why it matters</small><p>{finding.institutional_impact || 'Not stated.'}</p></div><div><small>Existing mitigation signal</small><p>{finding.recommended_mitigation || 'Generate a live action pack.'}</p></div></div><input className="v8-instruction" value={instruction[id] || ''} onChange={e => setInstruction(v => ({ ...v, [id]: e.target.value }))} placeholder="Optional instruction: bank-favourable, mutual wording, preserve deal, specific fallback…"/><div className="v8-actions"><button className="v8-primary" disabled={busy === id} onClick={() => actionPack(finding,index)}>{busy === id ? <RefreshCw className="spin"/> : <Sparkles/>} Assess + rewrite + strategy</button>{pack && <button onClick={() => setOpenId(open ? '' : id)}>{open ? 'Hide' : 'Open'} action pack <ChevronRight/></button>}</div>{open && pack && <ActionPack pack={pack} onSave={() => saveMemory(finding,index)} />}</article>;
  })}{!findings.length && <Empty title="No findings returned" text="The live analysis did not return clause findings. Re-run the matter rather than relying on a generic template." />}</div>;
}

function ActionPack({ pack, onSave }) {
  const rewrite = pack.rewrite || {};
  function copy(value) { navigator.clipboard?.writeText(String(value || '')); }
  return <div className="v8-action-pack"><div className="v8-action-summary"><div><small>Disposition</small><strong>{pack.disposition}</strong></div><div><small>Priority</small><strong>{pack.priority}/5</strong></div><div><small>Confidence</small><strong>{pack.confidence ?? '—'}%</strong></div></div><h4>{pack.headline}</h4><p>{pack.why}</p><div className="v8-grid two"><div><h5>Worth raising?</h5><Json value={pack.worth_raising}/><h5>Compliance impact</h5><Json value={pack.compliance_impact || 'No distinct compliance impact returned.'}/><h5>Risk if accepted</h5><Json value={pack.risk_if_accepted}/></div><div><h5>Quantification</h5><Json value={pack.quantification}/><h5>Current-law relevance</h5><Json value={pack.current_law_relevance}/><h5>Residual risk</h5><Json value={pack.residual_risk}/></div></div><div className="v8-rewrite"><div className="v8-rewrite-head"><h5>Exact rewrite</h5><button onClick={() => copy(rewrite.preferred_text)}><Copy/> Copy preferred</button></div><label>Current clause<textarea readOnly value={rewrite.current_clause || ''}/></label><label>Preferred wording<textarea value={rewrite.preferred_text || ''} readOnly/></label><label>Fallback wording<textarea value={rewrite.fallback_text || ''} readOnly/></label><p>{rewrite.drafting_rationale}</p></div><div className="v8-grid two"><div><h5>Mitigation strategy</h5><Json value={pack.mitigation_strategy}/></div><div><h5>Negotiation strategy</h5><Json value={pack.negotiation_strategy}/></div></div>{pack.currentLawCitations?.length > 0 && <div className="v8-citations"><h5>Current-law sources</h5>{pack.currentLawCitations.map((c,i) => <a href={c.url} target="_blank" rel="noreferrer" key={`${c.url}-${i}`}><Globe2/><span>{c.title || c.url}</span><ChevronRight/></a>)}</div>}<button className="v8-memory" onClick={onSave}><Fingerprint/> Save this validated position to clause memory</button></div>;
}

function RegulatoryImpactView({ detail, initial, showError }) {
  const [impact, setImpact] = useState(initial || {}); const [busy, setBusy] = useState(false);
  useEffect(() => setImpact(initial || {}), [detail.id]);
  async function refreshImpact() { setBusy(true); try { const data = await api(`/documents/${detail.id}/regulatory-impact`, { method:'POST', body:'{}' }); setImpact(data.regulatoryImpact); } catch (err) { showError(err); } finally { setBusy(false); } }
  const refs = impact.citedAuthorities || []; const omitted = impact.omittedApplicableAuthorities || []; const compliance = impact.complianceImpacts || [];
  return <div className="v8-grid two"><div>
    <Section title="Authority freshness" subtitle="Every cited instrument is independently checked; citation in the document is not proof it is still current" action={<button className="v8-primary" onClick={refreshImpact} disabled={busy}>{busy ? <RefreshCw className="spin"/> : <RefreshCw/>} Re-check now</button>}><div className="v8-pack-head"><Risk value={impact.overallImpact || 'UNASSESSED'} /><strong>{impact.staleReferenceWarning ? 'STALE / CHANGED AUTHORITY FOUND' : impact.status === 'COMPLETE' ? 'No stale reference identified in verified set' : impact.status || 'Not verified'}</strong></div><p>{impact.executiveConclusion || impact.decisionEffect || 'No regulatory-impact conclusion recorded.'}</p>{refs.map((item,index) => <div className={`v8-disposition ${['SUPERSEDED','REPEALED','WITHDRAWN','AMENDED'].includes(item.currentStatus) ? 'critical' : 'low'}`} key={item.referenceId || index}><h4>{item.documentReference}</h4><div><Risk value={item.currentStatus}/><p><strong>Current instrument:</strong> {item.currentInstrument || 'Not identified'}</p><p>{item.amendmentOrSupersession || item.impact}</p><small>Effective: {item.effectiveDate || 'Not established'} · Transition: {item.transitionDate || 'None identified'}</small></div></div>)}{!refs.length && <p className="v8-muted">No named authority was reliably extracted, but omitted applicable law can still be identified below.</p>}</Section>
    <Section title="Applicable law the document omitted" subtitle="Current material authority that applies even though the drafter did not cite it">{omitted.map((item,index) => <div className="v8-disposition high" key={index}><h4>{item.authority || item.currentInstrument || item.title || 'Applicable authority'}</h4><p>{item.whyApplicable || item.applicability || item.why}</p><p>{item.impact || item.requiredAction}</p></div>)}{!omitted.length && <p className="v8-muted">No omitted applicable authority recorded.</p>}</Section>
  </div><div>
    <Section title="Compliance impact" subtitle="What changes operationally because of current law/regulation">{compliance.map((item,index) => <div className="v8-exposure" key={index}><Risk value={item.impactLevel || 'Medium'}/><div><strong>{item.dimension || 'Compliance'}</strong><p>{item.requirement}</p><small>{item.ownerFunction || 'Owner not determined'} · Trigger: {item.trigger || 'Applicability'}</small></div><div className="v8-exposure-value"><strong>{item.deadline || 'No explicit deadline established'}</strong><p>{item.controlChange || item.mitigation}</p><small>Evidence: {Array.isArray(item.evidenceRequired) ? item.evidenceRequired.join(', ') : item.evidenceRequired || 'To be determined'}</small></div></div>)}{!compliance.length && <p className="v8-muted">No structured compliance-impact item recorded.</p>}</Section>
    <Section title="Transition, deadlines and remediation" subtitle="Effective dates, implementation windows, approvals and actions"><h4>Transition / deadlines</h4><Json value={impact.transitionAndDeadlines || []}/><h4>Required actions</h4><Json value={impact.requiredActions || []}/><h4>Approvals / escalations</h4><Json value={impact.approvalsAndEscalations || []}/>{impact.currentLawCitations?.length > 0 && <div className="v8-citations"><h5>Primary/current sources</h5>{impact.currentLawCitations.map((c,i) => <a href={c.url} target="_blank" rel="noreferrer" key={`${c.url}-${i}`}><Globe2/><span>{c.title || c.url}</span><ChevronRight/></a>)}</div>}</Section>
  </div></div>;
}

function ExposureView({ detail, analysis, showError }) {
  const [remote, setRemote] = useState(null); const [busy, setBusy] = useState(false);
  const model = remote?.exposure || analysis.exposure_model || {}; const items = model.exposures || model.findings || [];
  async function refreshExposure(){setBusy(true);try{setRemote(await api(`/documents/${detail.id}/exposure`,{method:'POST',body:JSON.stringify({live:true})}));}catch(err){showError(err);}finally{setBusy(false);}}
  return <Section title="Exposure: what can actually be quantified?" subtitle="Severity is not converted into money unless the selected document or verified authority provides a defensible monetary basis" action={<button className="v8-primary" onClick={refreshExposure} disabled={busy}>{busy?<RefreshCw className="spin"/>:<RefreshCw/>} Refresh</button>}><div className="v8-exposure-list">{items.map((item,index) => <div className="v8-exposure" key={item.findingId || index}><Risk value={item.riskLevel || item.risk}/><div><strong>{item.category || item.issue}</strong><p>{item.issue}</p><small>{item.quantificationStatus}</small></div><div className="v8-exposure-value"><strong>{item.exposureLabel || item.financialExposure || 'Not reliably quantifiable'}</strong><p>{item.rationale}</p><small>Confidence {item.confidence ?? '—'}%. Scenario bands are assumptions, not legal maxima or expected loss.</small></div></div>)}</div>{remote?.authorityResearch && <Section title="Current statutory / regulatory overlay" subtitle={remote.authorityResearch.status || (remote.authorityResearch.liveWebUsed ? 'Live authority research used' : 'Unavailable')}><p>{remote.authorityResearch.answer || remote.authorityResearch.error || 'No overlay returned.'}</p></Section>}{!items.length && <Empty title="No exposure model recorded" text="This matter needs a fresh analysis before financial exposure can be assessed."/>}</Section>;
}

function GraphView({ graph, memories }) {
  const [selected, setSelected] = useState(null);
  const nodes = graph?.nodes || []; const edges = graph?.edges || [];
  const positions = useMemo(() => {
    const types = [...new Set(nodes.map(n => n.type))]; const map = {};
    types.forEach((type, col) => { const subset = nodes.filter(n => n.type === type); subset.forEach((n,row) => { map[n.id] = { x: 90 + col * 185, y: 70 + row * 95 }; }); }); return map;
  }, [graph]);
  const width = Math.max(720, ([...new Set(nodes.map(n => n.type))].length || 1) * 190 + 80); const height = Math.max(420, Math.max(1, ...Object.values(positions).map(p => p.y)) + 80);
  return <div className="v8-grid two graph-layout"><Section title="Document-derived graph" subtitle={`${nodes.length} nodes · ${edges.length} relationships · click any node`}><div className="v8-graph-scroll"><svg width={width} height={height} className="v8-graph">{edges.map((e,i) => { const a=positions[e.from], b=positions[e.to]; return a&&b ? <g key={i}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><text x={(a.x+b.x)/2} y={(a.y+b.y)/2-4}>{e.relation}</text></g> : null; })}{nodes.map(node => { const p=positions[node.id]; return <g key={node.id} className="node" onClick={() => setSelected(node)}><circle cx={p.x} cy={p.y} r="28"/><text x={p.x} y={p.y+4} textAnchor="middle">{node.type.slice(0,3).toUpperCase()}</text><text className="label" x={p.x} y={p.y+45} textAnchor="middle">{String(node.label||'').slice(0,24)}</text></g>; })}</svg></div></Section><div><Section title="Selected node" subtitle="Exact graph object from this matter">{selected ? <Json value={selected}/> : <p className="v8-muted">Click a node in the graph.</p>}</Section><Section title="Clause-memory candidates" subtitle="Not durable memory until explicitly approved"><div className="v8-memory-list">{(memories||[]).map(m => <div key={m.id}><Risk value={m.risk}/><div><strong>{m.category}</strong><p>{m.issue}</p><small>{m.status}</small></div></div>)}</div></Section></div></div>;
}

function MatterBrain({ detail, showError }) {
  const [q,setQ]=useState('What is genuinely worth raising in this exact document, what can be let go, and is any cited law or circular stale or incomplete?'); const [answer,setAnswer]=useState(null); const [busy,setBusy]=useState(false);
  async function ask(e){e.preventDefault();setBusy(true);try{setAnswer(await api(`/documents/${detail.id}/ask`,{method:'POST',body:JSON.stringify({question:q})}));}catch(err){showError(err);}finally{setBusy(false);}}
  return <Section title="Ask only this matter" subtitle="The selected document is the source scope; other matter memory is excluded"><form className="v8-brain-form" onSubmit={ask}><textarea value={q} onChange={e=>setQ(e.target.value)}/><button className="v8-primary" disabled={busy}>{busy?<RefreshCw className="spin"/>:<Send/>} Ask</button></form>{busy&&<Loader label="Researching and reasoning…"/>}{answer&&<div className="v8-answer"><Tag tone="live">{answer.engine}</Tag><p>{answer.answer}</p>{answer.live?.citations?.map((c,i)=><a href={c.url} target="_blank" rel="noreferrer" key={i}>{c.title||c.url}</a>)}</div>}</Section>;
}

function CurrentLaw({ analysis }) {
  const live = analysis.live_current_law || {};
  return <Section title="Current-law verification" subtitle={live.researchedAt ? `Researched ${new Date(live.researchedAt).toLocaleString()}` : 'Status from the last document analysis'}><div className="v8-answer"><Tag tone={live.liveWebUsed ? 'live':'warn'}>{live.liveWebUsed ? 'LIVE WEB USED' : live.status || 'NOT VERIFIED'}</Tag><p>{live.answer || live.error || 'No current-law answer is recorded.'}</p>{(live.citations||[]).map((c,i)=><a href={c.url} target="_blank" rel="noreferrer" key={i}><Globe2/> {c.title||c.url}</a>)}</div></Section>;
}

function WorkView({ tasks, onChanged, showError }) {
  async function change(task,status){try{await api(`/tasks/${task.id}`,{method:'PATCH',body:JSON.stringify({status})});onChanged();}catch(err){showError(err);}}
  return <Section title="Actions generated from this matter" subtitle="Includes document and regulatory-remediation tasks; no seeded institutional cards"><div className="v8-work">{tasks.map(t=><div key={t.id}><Risk value={t.priority}/><div><strong>{t.title}</strong><p>{t.owner} · {t.due}</p></div><select value={t.status} onChange={e=>change(t,e.target.value)}>{['Not started','Ready','In progress','Blocked','Evidence review','Completed'].map(s=><option key={s}>{s}</option>)}</select></div>)}</div>{!tasks.length&&<p className="v8-muted">No actions were generated for this document.</p>}</Section>;
}
