import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BrainCircuit, CheckCircle2, ChevronRight, CircleAlert, Database, FileSearch,
  FileText, Link2, LoaderCircle, LockKeyhole, MessageSquareText, Network,
  Play, RefreshCw, ShieldCheck, Sparkles, UploadCloud, X
} from 'lucide-react';

const SESSION_KEY = 'themis-live-review-sessions-v1';

const PIPELINE = [
  ['ingest', 'Secure ingestion'],
  ['extract', 'Text and structure extraction'],
  ['map', 'Clause and obligation mapping'],
  ['reason', 'Independent risk reasoning'],
  ['quantify', 'Exposure and control analysis'],
  ['ground', 'Source-grounded findings'],
  ['complete', 'Review complete']
];

function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || '[]'); } catch { return []; }
}

function persist(sessions) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
}

function normaliseDocument(document) {
  const analysis = document?.analysis || {};
  return {
    id: document?.id || uid(),
    title: document?.title || document?.originalFileName || 'Live review',
    fileName: document?.originalFileName || document?.fileName || 'Uploaded document',
    matter: document?.matter || 'Fresh review',
    overallRisk: analysis.overall_risk || 'Not rated',
    overallScore: analysis.overall_score ?? null,
    summary: analysis.executive_summary || analysis.summary || 'Analysis completed.',
    findings: Array.isArray(analysis.findings) ? analysis.findings : [],
    engine: analysis.engine || 'Live analysis engine',
    createdAt: document?.createdAt || new Date().toISOString()
  };
}

function findingValue(finding, ...keys) {
  for (const key of keys) if (finding?.[key] !== undefined && finding?.[key] !== null) return finding[key];
  return '';
}

function RiskBadge({ value }) {
  const level = String(value || 'Unrated');
  const className = /critical|high/i.test(level) ? 'danger' : /moderate|medium/i.test(level) ? 'warn' : 'good';
  return <span className={`live-risk ${className}`}>{level}</span>;
}

export default function LiveReviewBrain() {
  const fileInput = useRef(null);
  const [sessions, setSessions] = useState(loadSessions);
  const [activeId, setActiveId] = useState(() => loadSessions()[0]?.id || null);
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('fresh');
  const [matter, setMatter] = useState('');
  const [jurisdiction, setJurisdiction] = useState('India');
  const [riskAppetite, setRiskAppetite] = useState('Conservative');
  const [linkedIds, setLinkedIds] = useState([]);
  const [stage, setStage] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);

  const active = sessions.find(item => item.id === activeId) || null;
  const selectedLinks = sessions.filter(item => linkedIds.includes(item.id));

  useEffect(() => persist(sessions), [sessions]);

  useEffect(() => {
    if (mode === 'fresh') setLinkedIds([]);
  }, [mode]);

  const progress = useMemo(() => Math.max(0, Math.round(((stage + 1) / PIPELINE.length) * 100)), [stage]);

  function updateSession(session) {
    setSessions(current => [session, ...current.filter(item => item.id !== session.id)]);
    setActiveId(session.id);
  }

  async function runReview() {
    if (!file) {
      setError('Select a document before starting the review.');
      return;
    }
    setBusy(true);
    setError('');
    setAnswer('');
    setStage(0);

    const timers = PIPELINE.slice(1, -1).map((_, index) => setTimeout(() => setStage(index + 1), 650 * (index + 1)));

    try {
      const body = new FormData();
      body.append('file', file);
      body.append('title', file.name.replace(/\.[^.]+$/, ''));
      body.append('matter', matter || 'Fresh independent review');
      body.append('jurisdiction', jurisdiction);
      body.append('riskAppetite', riskAppetite);
      body.append('reviewMode', mode);
      body.append('linkedDocumentIds', JSON.stringify(mode === 'fresh' ? [] : linkedIds));
      body.append('isolationPolicy', 'fresh-session-no-inherited-analysis');

      const response = await fetch('/api/documents/analyze', {
        method: 'POST',
        credentials: 'include',
        body
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'The live analysis service is not available.');

      const normalised = normaliseDocument(payload.document);
      const session = {
        ...normalised,
        id: normalised.id || uid(),
        reviewMode: mode,
        linkedIds: mode === 'fresh' ? [] : linkedIds,
        isolationPolicy: 'Fresh analysis; no inherited findings or conclusions',
        status: 'Complete'
      };
      setStage(PIPELINE.length - 1);
      updateSession(session);
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
    } catch (err) {
      setError(`${err.message} The interface is ready, but a configured authenticated analysis service is required for actual document reasoning.`);
      setStage(-1);
    } finally {
      timers.forEach(clearTimeout);
      setBusy(false);
    }
  }

  async function askActive() {
    if (!active || question.trim().length < 3) return;
    setAsking(true);
    setAnswer('');
    try {
      const response = await fetch(`/api/documents/${active.id}/ask`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to answer from the active document.');
      setAnswer(payload.answer || payload.response || 'No grounded answer was returned.');
    } catch (err) {
      const terms = question.toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 3);
      const relevant = (active.findings || []).filter(item => terms.some(term => JSON.stringify(item).toLowerCase().includes(term))).slice(0, 3);
      setAnswer(relevant.length
        ? relevant.map(item => `${findingValue(item, 'risk_level', 'riskLevel') || 'Finding'}: ${findingValue(item, 'issue', 'title')}\n${findingValue(item, 'recommended_mitigation', 'recommendation')}`).join('\n\n')
        : `${err.message} No answer was fabricated because the active review contains insufficient matching evidence.`);
    } finally {
      setAsking(false);
    }
  }

  return <main className="live-review-shell">
    <section className="live-review-hero">
      <div className="live-review-mark"><BrainCircuit size={30} /></div>
      <div>
        <span className="live-eyebrow">PARMA LIVE REVIEW BRAIN</span>
        <h1>Analyse every document afresh. Link memory only by explicit choice.</h1>
        <p>Each upload starts in an isolated matter session. Prior conclusions, findings and extracted text remain excluded unless the reviewer deliberately activates Connected or Institutional Review.</p>
      </div>
      <div className="live-trust-card">
        <p><LockKeyhole size={16} /><span><strong>Default isolation</strong><small>No silent reuse of earlier analyses.</small></span></p>
        <p><FileSearch size={16} /><span><strong>Source grounded</strong><small>Findings remain tied to document evidence.</small></span></p>
        <p><Network size={16} /><span><strong>Governed learning</strong><small>Memory is context, never an undisclosed answer.</small></span></p>
      </div>
    </section>

    <section className="live-review-layout">
      <div className="live-column">
        <article className="live-panel">
          <div className="live-panel-head"><div><h2>Start a new review</h2><p>A new session is independent by design.</p></div><UploadCloud size={21} /></div>

          <div className="live-mode-grid">
            {[
              ['fresh', 'Fresh Review', 'Only this upload. No prior matter context.', LockKeyhole],
              ['connected', 'Connected Review', 'Use only the prior reviews selected below.', Link2],
              ['institutional', 'Institutional Review', 'Check against approved standards and selected memory.', Database]
            ].map(([key, title, copy, Icon]) => <button key={key} className={mode === key ? 'active' : ''} onClick={() => setMode(key)}><Icon size={17} /><strong>{title}</strong><small>{copy}</small></button>)}
          </div>

          <label className="live-dropzone">
            <input ref={fileInput} type="file" accept=".pdf,.doc,.docx,.txt,.csv,.json,.md,.xml" onChange={event => setFile(event.target.files?.[0] || null)} />
            <UploadCloud size={29} />
            <strong>{file ? file.name : 'Choose a document for live analysis'}</strong>
            <span>{file ? `${Math.max(1, Math.round(file.size / 1024))} KB selected` : 'PDF, DOCX, TXT, CSV, JSON, MD or XML'}</span>
          </label>

          <div className="live-fields">
            <label><span>Matter</span><input value={matter} onChange={event => setMatter(event.target.value)} placeholder="e.g. Bilateral facility agreement" /></label>
            <label><span>Jurisdiction</span><input value={jurisdiction} onChange={event => setJurisdiction(event.target.value)} /></label>
            <label><span>Risk appetite</span><select value={riskAppetite} onChange={event => setRiskAppetite(event.target.value)}><option>Conservative</option><option>Moderate</option><option>Commercial</option></select></label>
          </div>

          {mode !== 'fresh' && <div className="live-memory-picker">
            <strong>Explicitly permitted memory</strong>
            <p>Only checked reviews may contribute context. Their conclusions remain separately attributable.</p>
            {sessions.length === 0 ? <small>No earlier reviews are stored in this browser.</small> : sessions.map(item => <label key={item.id}><input type="checkbox" checked={linkedIds.includes(item.id)} onChange={() => setLinkedIds(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])} /><span>{item.title}<small>{item.fileName}</small></span></label>)}
          </div>}

          <button className="live-run" onClick={runReview} disabled={busy}><Play size={17} />{busy ? 'Analysing live…' : 'Start independent live review'}</button>
          {error && <div className="live-error"><CircleAlert size={17} /><span>{error}</span><button onClick={() => setError('')}><X size={14} /></button></div>}
        </article>

        <article className="live-panel">
          <div className="live-panel-head"><div><h2>Live reasoning pipeline</h2><p>Visible processing states, not an unexplained black box.</p></div><Sparkles size={21} /></div>
          <div className="live-progress"><span style={{ width: `${progress}%` }} /></div>
          <div className="live-pipeline">
            {PIPELINE.map(([key, label], index) => <div key={key} className={stage > index ? 'done' : stage === index ? 'active' : ''}>{stage > index ? <CheckCircle2 size={17} /> : stage === index ? <LoaderCircle className="spin" size={17} /> : <span>{index + 1}</span>}<strong>{label}</strong></div>)}
          </div>
        </article>
      </div>

      <div className="live-column">
        <article className="live-panel live-results">
          <div className="live-panel-head"><div><h2>Active review</h2><p>{active ? active.isolationPolicy : 'Select or complete a review to inspect its findings.'}</p></div>{active && <RiskBadge value={active.overallRisk} />}</div>

          {!active ? <div className="live-empty"><BrainCircuit size={37} /><h3>No active review</h3><p>The system will not display embedded sample conclusions. Upload a real document to generate a separate analysis.</p></div> : <>
            <div className="live-summary">
              <div><small>DOCUMENT</small><strong>{active.title}</strong><span>{active.fileName}</span></div>
              <div><small>RISK SCORE</small><strong>{active.overallScore ?? '—'}</strong><span>{active.engine}</span></div>
              <div><small>MEMORY USED</small><strong>{active.linkedIds?.length || 0}</strong><span>{active.reviewMode === 'fresh' ? 'Fresh review' : `${active.reviewMode} review`}</span></div>
            </div>
            <div className="live-executive"><h3>Executive analysis</h3><p>{active.summary}</p></div>
            <div className="live-findings">
              {(active.findings || []).length === 0 ? <div className="live-empty compact"><FileText size={25} /><p>No structured findings were returned.</p></div> : active.findings.map((finding, index) => <article key={finding.id || index}>
                <header><RiskBadge value={findingValue(finding, 'risk_level', 'riskLevel', 'severity')} /><span>Finding {index + 1}</span></header>
                <h3>{findingValue(finding, 'issue', 'title') || 'Material issue'}</h3>
                <blockquote>{findingValue(finding, 'quoted_text', 'evidence', 'source_text') || 'No source quotation returned.'}</blockquote>
                <p><strong>Why it matters:</strong> {findingValue(finding, 'why_risky_for_bank', 'whyItMatters', 'analysis') || 'Not stated.'}</p>
                <p><strong>Recommended control:</strong> {findingValue(finding, 'recommended_mitigation', 'recommendation', 'mitigation') || 'Not stated.'}</p>
              </article>)}
            </div>
          </>}
        </article>

        <article className="live-panel">
          <div className="live-panel-head"><div><h2>Ask this document</h2><p>Answers are restricted to the active review unless linked memory was expressly authorised.</p></div><MessageSquareText size={21} /></div>
          <div className="live-ask"><textarea rows="3" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask about termination rights, liability, sanctions, regulatory exposure, missing controls…" /><button onClick={askActive} disabled={!active || asking}>{asking ? <LoaderCircle className="spin" size={17} /> : <ChevronRight size={17} />}</button></div>
          {answer && <pre className="live-answer">{answer}</pre>}
        </article>

        <article className="live-panel">
          <div className="live-panel-head"><div><h2>Review sessions</h2><p>Separate matter histories; never silently merged.</p></div><RefreshCw size={20} /></div>
          <div className="live-session-list">
            {sessions.length === 0 ? <small>No completed sessions.</small> : sessions.map(item => <button key={item.id} className={item.id === activeId ? 'active' : ''} onClick={() => setActiveId(item.id)}><span><strong>{item.title}</strong><small>{new Date(item.createdAt).toLocaleString()} · {item.reviewMode}</small></span><RiskBadge value={item.overallRisk} /></button>)}
          </div>
        </article>
      </div>
    </section>
  </main>;
}
