import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleDot,
  Download,
  FilePlus2,
  FileText,
  Files,
  GitCompareArrows,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
  X
} from 'lucide-react';

const DOCUMENTS_KEY = 'live-synesis-public-documents-v1';
const DEPARTMENT_KEY = 'live-synesis-public-department';

const DEPARTMENTS = [
  { key: 'legal', label: 'Legal', description: 'Contracts, opinions, drafting and disputes', icon: FileText },
  { key: 'compliance', label: 'Compliance', description: 'Regulatory obligations and control checks', icon: ShieldCheck },
  { key: 'risk', label: 'Risk', description: 'Risk identification, mitigation and escalation', icon: Activity },
  { key: 'kyc', label: 'KYC / AML', description: 'Onboarding, AML, sanctions and due diligence', icon: Users },
  { key: 'business', label: 'Business & Operations', description: 'Commercial execution and operational workflows', icon: Building2 },
  { key: 'management', label: 'Management', description: 'Executive summaries and decision oversight', icon: BarChart3 },
  { key: 'credit', label: 'Credit', description: 'Financing terms, covenants and credit protections', icon: CircleDot },
  { key: 'cyber', label: 'IT & Cybersecurity', description: 'Technology, data security and vendor controls', icon: Shield },
  { key: 'procurement', label: 'Procurement', description: 'Vendor contracts, SLAs and commercial safeguards', icon: Files }
];

const REVIEW_TABS = [
  ['overview', 'Overview'],
  ['issues', 'Issues'],
  ['missing', 'Missing protections'],
  ['scenarios', 'Scenarios'],
  ['regulatory', 'Regulatory'],
  ['assistant', 'Ask Synesis'],
  ['report', 'Report']
];

const CLAUSE_RULES = [
  {
    pattern: /(?:aggregate|total) liability.{0,120}(?:fees paid|amount paid|charges paid|preceding|twelve months)/i,
    level: 'High',
    issue: 'Liability is capped by reference to limited fees',
    why: 'A low fee-linked cap may be materially below the Bank’s actual loss, regulatory exposure or remediation cost.',
    mitigation: 'Carve out confidentiality, data, fraud, wilful misconduct, regulatory penalties, IP infringement and indemnity claims from the cap.',
    rewrite: 'The liability cap shall not apply to fraud, wilful misconduct, gross negligence, breach of confidentiality or data obligations, infringement, indemnity claims or regulatory liabilities.',
    owners: ['Legal', 'Risk']
  },
  {
    pattern: /(?:no|not) liable.{0,90}(?:indirect|consequential|special|incidental)/i,
    level: 'Medium',
    issue: 'Broad exclusion of consequential and indirect loss',
    why: 'The wording may exclude foreseeable operational, remediation and third-party costs even where the supplier caused the event.',
    mitigation: 'Clarify that direct remediation, investigation, restoration, third-party and regulatory costs remain recoverable.',
    rewrite: 'For clarity, direct losses include reasonable investigation, restoration, customer remediation, third-party and regulatory response costs.',
    owners: ['Legal', 'Risk']
  },
  {
    pattern: /(?:terminate|termination).{0,130}(?:only|solely|material breach|thirty|30|sixty|60) days/i,
    level: 'Medium',
    issue: 'Termination rights may be delayed or too narrow',
    why: 'The institution may be forced to continue a risky arrangement during a cure period or regulatory concern.',
    mitigation: 'Add immediate termination for regulatory direction, sanctions, data breach, insolvency, fraud and serious control failure.',
    rewrite: 'The institution may terminate immediately upon regulatory direction, sanctions exposure, material security incident, fraud, insolvency or a serious compliance failure.',
    owners: ['Legal', 'Compliance']
  },
  {
    pattern: /(?:data|personal data|confidential information).{0,160}(?:outside|transfer|subprocessor|third party|affiliate)/i,
    level: 'High',
    issue: 'Data transfer or onward-sharing exposure',
    why: 'Uncontrolled transfer or access can conflict with confidentiality, privacy, outsourcing and localisation requirements.',
    mitigation: 'Require documented instructions, approved locations, need-to-know access, equivalent safeguards and prior approval for subprocessors.',
    rewrite: 'Data shall be processed only on documented instructions, at approved locations, by authorised personnel and approved subprocessors subject to equivalent obligations.',
    owners: ['Compliance', 'IT & Cybersecurity', 'Legal']
  },
  {
    pattern: /(?:indemnif|hold harmless).{0,160}(?:all|any|whatsoever|arising out of)/i,
    level: 'High',
    issue: 'Indemnity allocation may be one-sided or overly broad',
    why: 'An uncapped or causally remote indemnity can transfer risks beyond the party’s control or insurable exposure.',
    mitigation: 'Tie indemnity to breach, negligence, misconduct, infringement, confidentiality, data and third-party claims caused by the indemnifying party.',
    rewrite: 'Each party shall indemnify the other against third-party claims and direct losses to the extent caused by its breach, negligence, wilful misconduct or infringement.',
    owners: ['Legal', 'Risk']
  },
  {
    pattern: /(?:assign|assignment|novation|subcontract).{0,120}(?:without consent|affiliate|any third party)/i,
    level: 'Medium',
    issue: 'Assignment or subcontracting is insufficiently controlled',
    why: 'Performance or sensitive information may move to an unassessed entity without institutional approval.',
    mitigation: 'Require prior written consent and preserve full responsibility of the original contracting party.',
    rewrite: 'No assignment, novation or material subcontracting is permitted without prior written consent, and the original party remains fully responsible.',
    owners: ['Legal', 'Procurement']
  },
  {
    pattern: /(?:governing law|jurisdiction|arbitration).{0,160}(?:new york|england|singapore|united states|exclusive)/i,
    level: 'Medium',
    issue: 'Foreign dispute forum or law may increase enforcement risk',
    why: 'A foreign seat or exclusive court may increase cost, delay, sanctions exposure and enforcement complexity.',
    mitigation: 'Select a commercially workable governing law, neutral seat and enforceable interim-relief mechanism.',
    rewrite: 'The governing law, dispute forum and arbitral seat shall be mutually agreed and shall permit effective interim and enforcement remedies.',
    owners: ['Legal']
  },
  {
    pattern: /(?:sanction|embargo|restricted party|ofac|sdn)/i,
    level: 'High',
    issue: 'Sanctions obligations require precise allocation',
    why: 'Overbroad sanctions clauses may import foreign restrictions unnecessarily, while weak clauses may leave the institution exposed.',
    mitigation: 'Define applicable sanctions, knowledge standards, screening obligations and immediate suspension or termination rights.',
    rewrite: 'Each party shall comply with sanctions legally applicable to it and shall promptly notify the other of a restriction materially affecting performance.',
    owners: ['Compliance', 'Legal', 'KYC / AML']
  },
  {
    pattern: /(?:service level|uptime|availability).{0,130}(?:target|commercially reasonable|best efforts)/i,
    level: 'Medium',
    issue: 'Service levels may lack measurable remedies',
    why: 'A non-binding target does not provide a reliable operational control or consequence for repeated failure.',
    mitigation: 'Add measurable availability, response and resolution times, service credits, chronic-failure termination and reporting.',
    rewrite: 'Service levels shall be measurable, reported monthly and supported by service credits and termination rights for repeated or material failure.',
    owners: ['Business & Operations', 'IT & Cybersecurity', 'Procurement']
  },
  {
    pattern: /(?:audit|inspect|records).{0,120}(?:reasonable notice|once per year|business hours)/i,
    level: 'Medium',
    issue: 'Audit rights may be operationally restricted',
    why: 'Notice, frequency or scope limits can prevent timely verification after incidents or regulatory requests.',
    mitigation: 'Permit risk-based, incident-driven and regulator-requested audits with access to relevant records and remediation evidence.',
    rewrite: 'Audit restrictions shall not apply to regulatory requests, material incidents, suspected breach or verification of remediation.',
    owners: ['Compliance', 'Risk', 'Internal Audit']
  },
  {
    pattern: /(?:force majeure).{0,180}(?:payment|cyber|subcontractor|indefinite|continue)/i,
    level: 'Medium',
    issue: 'Force-majeure relief may be broader than appropriate',
    why: 'The clause may excuse foreseeable control failures or permit indefinite non-performance without exit rights.',
    mitigation: 'Exclude preventable security failures and subcontractor default, require mitigation and allow termination after a defined period.',
    rewrite: 'Force majeure excludes events reasonably preventable through required controls and permits termination if material non-performance continues beyond the agreed period.',
    owners: ['Legal', 'Business & Operations']
  },
  {
    pattern: /(?:fees|charges|payment).{0,140}(?:non-refundable|advance|automatic increase|sole discretion)/i,
    level: 'Medium',
    issue: 'Payment terms may permit unearned or unilateral charges',
    why: 'Non-refundable advances or unilateral increases can create financial exposure without corresponding performance.',
    mitigation: 'Link payment to accepted deliverables, require prior approval for changes and provide pro-rata refunds on early termination.',
    rewrite: 'Fees are payable against accepted deliverables; changes require written agreement and prepaid unused amounts shall be refunded pro rata.',
    owners: ['Business & Operations', 'Procurement', 'Legal']
  }
];

const EXPECTED_PROTECTIONS = [
  { pattern: /confidential/i, clause: 'Confidentiality and permitted disclosure', reason: 'Defines protected information, permitted use, compelled disclosure and survival.', language: 'Each party shall protect confidential information, use it only for the agreed purpose and disclose it solely on a need-to-know basis.' },
  { pattern: /data protection|personal data|privacy/i, clause: 'Data protection and security', reason: 'Allocates privacy, security, incident and subprocessor obligations.', language: 'The service provider shall apply appropriate technical and organisational safeguards and notify material incidents without undue delay.' },
  { pattern: /business continuity|disaster recovery/i, clause: 'Business continuity and disaster recovery', reason: 'Protects critical service availability and recoverability.', language: 'The service provider shall maintain, test and evidence business continuity and disaster-recovery arrangements proportionate to the services.' },
  { pattern: /audit|inspection/i, clause: 'Audit and regulatory access', reason: 'Allows verification and regulator access.', language: 'The institution, its auditors and regulators may inspect relevant systems, records and controls on a risk-based basis.' },
  { pattern: /indemn/i, clause: 'Indemnity for defined third-party and compliance losses', reason: 'Allocates losses caused by breach, infringement, data events or misconduct.', language: 'The responsible party shall indemnify the other for defined third-party claims and direct losses caused by its breach or misconduct.' },
  { pattern: /termination assistance|exit assistance|transition/i, clause: 'Exit and transition assistance', reason: 'Avoids operational lock-in and supports orderly migration.', language: 'On expiry or termination, the provider shall provide reasonable transition assistance, data return and secure deletion.' },
  { pattern: /insurance/i, clause: 'Adequate insurance', reason: 'Supports recovery for professional, cyber and operational losses.', language: 'The provider shall maintain insurance appropriate to the nature and value of the services and provide evidence upon request.' }
];

function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadDocuments() {
  try {
    const value = JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function excerpt(text, index, length = 280) {
  const start = Math.max(0, index - 70);
  return text.slice(start, start + length).replace(/\s+/g, ' ').trim();
}

function analyseText(text, options) {
  const normalized = text.replace(/\u0000/g, ' ').replace(/\s+/g, ' ').trim();
  const findings = CLAUSE_RULES.flatMap(rule => {
    const match = normalized.match(rule.pattern);
    if (!match) return [];
    return [{
      id: uid(),
      risk_level: rule.level,
      issue: rule.issue,
      clause_reference: `Detected language near character ${match.index + 1}`,
      quoted_text: excerpt(normalized, match.index),
      why_risky_for_bank: rule.why,
      how_risk_may_materialise: 'The identified drafting may be relied upon during performance failure, dispute, incident response or regulatory review.',
      recommended_mitigation: rule.mitigation,
      suggested_rewrite: rule.rewrite,
      review_owner: rule.owners
    }];
  });

  const missing = EXPECTED_PROTECTIONS
    .filter(item => !item.pattern.test(normalized))
    .map(item => ({
      id: uid(),
      risk_level: 'Medium',
      clause: item.clause,
      why_needed: item.reason,
      recommended_language: item.language
    }));

  const high = findings.filter(item => item.risk_level === 'High').length;
  const medium = findings.filter(item => item.risk_level === 'Medium').length;
  const score = Math.min(96, Math.max(12, 18 + high * 17 + medium * 8 + missing.length * 3));
  const overallRisk = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low';
  const decision = high >= 2 ? 'Do not proceed without material amendments and control-owner approval.' : high === 1 ? 'Proceed only after resolving the high-risk issue and documenting compensating controls.' : medium ? 'Proceed subject to targeted amendments and owner confirmation.' : 'Proceed, subject to standard operational verification.';

  const regulatory = [];
  if (/personal data|privacy|data protection/i.test(normalized)) regulatory.push({ area: 'Data protection', relevance: 'The document concerns processing, access or transfer of personal or confidential data.', action: 'Confirm applicable privacy notices, processing instructions, security controls, retention and breach response.' });
  if (/outsourc|service provider|vendor|subcontract/i.test(normalized)) regulatory.push({ area: 'Outsourcing and third-party risk', relevance: 'Material services or controls may be performed by an external provider.', action: 'Confirm due diligence, audit, continuity, subcontracting, concentration and exit controls.' });
  if (/sanction|aml|money laundering|restricted party/i.test(normalized)) regulatory.push({ area: 'AML and sanctions', relevance: 'The arrangement contains financial-crime or restricted-party exposure.', action: 'Confirm applicable screening, escalation, suspension and record-retention requirements.' });
  if (/foreign exchange|fema|remittance|cross-border/i.test(normalized)) regulatory.push({ area: 'Foreign exchange and cross-border activity', relevance: 'The arrangement may involve cross-border payment, remittance or foreign-exchange obligations.', action: 'Confirm product permissibility, reporting, purpose codes, documentation and regulatory approvals.' });
  if (!regulatory.length) regulatory.push({ area: 'General regulated-institution controls', relevance: 'The document should be tested against the institution’s applicable policies and regulatory perimeter.', action: 'Confirm ownership, approvals, records, operational controls and escalation before execution.' });

  return {
    document_type: options.documentType === 'Auto-detect' ? 'Agreement / legal document' : options.documentType,
    overall_risk: overallRisk,
    overall_score: score,
    recommended_decision: decision,
    executive_position: `${findings.length} material drafting issue${findings.length === 1 ? '' : 's'} and ${missing.length} missing protection${missing.length === 1 ? '' : 's'} were identified. ${decision}`,
    document_summary: normalized.slice(0, 650) || 'No readable document text was available.',
    findings,
    missing_clauses: missing,
    scenarios: findings.slice(0, 5).map(item => ({
      scenario: item.issue,
      trigger: item.quoted_text,
      consequence: item.why_risky_for_bank,
      response: item.recommended_mitigation
    })),
    regulatory_touchpoints: regulatory,
    assumptions_and_limits: [
      'This browser-based review is an automated issue-spotting aid and not a substitute for final professional review.',
      'The analysis is based only on text successfully extracted or pasted into this workspace.',
      'Current law, internal policy and transaction-specific facts must be verified independently.'
    ],
    engine: 'Browser-local baseline analysis',
    analysed_at: new Date().toISOString()
  };
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
      pages.push(content.items.map(item => item.str).join(' '));
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

function downloadFile(name, value) {
  const url = URL.createObjectURL(new Blob([value], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function reportText(document) {
  const analysis = document.analysis;
  const lines = [
    'LIVE SYNESIS — DECISION REPORT', '',
    `Department: ${document.departmentLabel}`,
    `Document: ${document.title}`,
    `Matter: ${document.matter}`,
    `Document type: ${document.documentType}`,
    `Jurisdiction: ${document.jurisdiction}`,
    `Overall risk: ${analysis.overall_risk} (${analysis.overall_score}/100)`,
    `Recommended decision: ${analysis.recommended_decision}`, '',
    'EXECUTIVE POSITION', analysis.executive_position, '',
    'ISSUES'
  ];
  analysis.findings.forEach((finding, index) => lines.push('', `${index + 1}. [${finding.risk_level}] ${finding.issue}`, `Evidence: ${finding.quoted_text}`, `Why it matters: ${finding.why_risky_for_bank}`, `Mitigation: ${finding.recommended_mitigation}`, `Suggested language: ${finding.suggested_rewrite}`));
  lines.push('', 'MISSING PROTECTIONS');
  analysis.missing_clauses.forEach(item => lines.push('', `[${item.risk_level}] ${item.clause}`, item.why_needed, item.recommended_language));
  lines.push('', 'ASSUMPTIONS AND LIMITATIONS', ...analysis.assumptions_and_limits.map(item => `- ${item}`));
  return lines.join('\n');
}

export default function PublicApp() {
  const [department, setDepartment] = useState(() => localStorage.getItem(DEPARTMENT_KEY) || '');
  const [documents, setDocuments] = useState(loadDocuments);
  const [page, setPage] = useState('home');
  const [activeId, setActiveId] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents));
    } catch {
      setNotice({ type: 'error', message: 'Browser storage is full. Delete older reviews before saving another large document.' });
    }
  }, [documents]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const departmentInfo = DEPARTMENTS.find(item => item.key === department);
  const active = documents.find(item => item.id === activeId) || null;

  function chooseDepartment(value) {
    localStorage.setItem(DEPARTMENT_KEY, value);
    setDepartment(value);
    setPage('home');
  }

  function changeDepartment() {
    localStorage.removeItem(DEPARTMENT_KEY);
    setDepartment('');
    setPage('home');
    setActiveId(null);
  }

  function saveDocument(document) {
    setDocuments(current => [document, ...current.filter(item => item.id !== document.id)]);
    setActiveId(document.id);
    setPage('review');
    setNotice({ type: 'success', message: 'Analysis completed and saved in this browser.' });
  }

  function updateDocument(id, updater) {
    setDocuments(current => current.map(item => item.id === id ? updater(item) : item));
  }

  function removeDocument(id) {
    if (!window.confirm('Delete this locally saved review?')) return;
    setDocuments(current => current.filter(item => item.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setPage('documents');
    }
  }

  if (!departmentInfo) return <DepartmentGate choose={chooseDepartment} />;

  const navigate = value => {
    setPage(value);
    setMobileNav(false);
  };

  return (
    <div className="public-app-shell">
      {mobileNav && <button className="public-nav-scrim" aria-label="Close menu" onClick={() => setMobileNav(false)} />}
      <aside className={`public-sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="public-brand"><span>S</span><div><strong>LIVE SYNESIS</strong><small>Open institutional workspace</small></div><button className="public-mobile-close" onClick={() => setMobileNav(false)}><X size={20} /></button></div>
        <div className="department-chip"><departmentInfo.icon size={18} /><div><small>ACTIVE DEPARTMENT</small><strong>{departmentInfo.label}</strong></div></div>
        <nav>
          {[
            ['home', 'Command centre', LayoutDashboard],
            ['new', 'New review', FilePlus2],
            ['documents', 'Documents', Files],
            ['compare', 'Compare', GitCompareArrows]
          ].map(([key, label, Icon]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => navigate(key)}><Icon size={19} /><span>{label}</span>{page === key && <ChevronRight size={16} />}</button>)}
        </nav>
        <div className="public-sidebar-bottom"><div><ShieldCheck size={17} /><span><strong>No login required</strong><small>Data stays in this browser</small></span></div><button onClick={changeDepartment}>Change department</button></div>
      </aside>

      <div className="public-main">
        <header className="public-topbar"><button className="public-menu" onClick={() => setMobileNav(true)}><Menu size={22} /></button><div><h1>{page === 'home' ? 'Command centre' : page === 'new' ? 'New document review' : page === 'documents' ? 'Document library' : page === 'compare' ? 'Compare documents' : active?.title || 'Review workspace'}</h1><p>{departmentInfo.label} workspace · credential-free access</p></div><button className="public-primary compact" onClick={() => navigate('new')}><FilePlus2 size={17} />New review</button></header>
        {notice && <button className={`public-toast ${notice.type}`} onClick={() => setNotice(null)}>{notice.type === 'error' ? <CircleAlert size={18} /> : <CheckCircle2 size={18} />}<span>{notice.message}</span><X size={16} /></button>}
        <main className="public-page">
          {page === 'home' && <Dashboard department={departmentInfo} documents={documents} navigate={navigate} openDocument={id => { setActiveId(id); setPage('review'); }} />}
          {page === 'new' && <NewReview department={departmentInfo} saveDocument={saveDocument} setNotice={setNotice} />}
          {page === 'documents' && <DocumentLibrary documents={documents} openDocument={id => { setActiveId(id); setPage('review'); }} removeDocument={removeDocument} />}
          {page === 'compare' && <Compare documents={documents} />}
          {page === 'review' && <Review document={active} updateDocument={updateDocument} removeDocument={removeDocument} navigate={navigate} />}
        </main>
      </div>
    </div>
  );
}

function DepartmentGate({ choose }) {
  return <div className="department-gate"><div className="gate-hero"><div className="gate-brand"><span>S</span><div><strong>LIVE SYNESIS</strong><small>Legal & Compliance Intelligence</small></div></div><div><small>OPEN INSTITUTIONAL WORKSPACE</small><h1>Select your department and begin.</h1><p>No email, password or account is required. Each department enters the same document-intelligence platform with a relevant working identity.</p></div><div className="gate-points"><span><ShieldCheck size={19} />No credentials</span><span><Sparkles size={19} />Live browser analysis</span><span><Files size={19} />Local document library</span></div></div><div className="gate-panel"><div className="gate-title"><small>CHOOSE WORKSPACE</small><h2>Which department are you working from?</h2><p>You can change departments at any time.</p></div><div className="department-grid">{DEPARTMENTS.map(item => { const Icon = item.icon; return <button key={item.key} onClick={() => choose(item.key)}><span><Icon size={22} /></span><div><strong>{item.label}</strong><small>{item.description}</small></div><ArrowRight size={18} /></button>; })}</div><div className="gate-note"><Shield size={16} />Documents and analysis are stored only in the current browser unless central database persistence is enabled later.</div></div></div>;
}

function Dashboard({ department, documents, navigate, openDocument }) {
  const highRisk = documents.filter(item => item.analysis.overall_risk === 'High');
  const findings = documents.reduce((sum, item) => sum + item.analysis.findings.length, 0);
  return <div className="public-stack"><section className="public-welcome"><div><small>{department.label.toUpperCase()} WORKSPACE</small><h2>What needs a decision today?</h2><p>Upload a document and receive evidence-linked issue spotting, missing protections, scenarios and a decision report without creating an account.</p><div><button className="public-white" onClick={() => navigate('new')}><UploadCloud size={18} />Upload & analyse</button><button className="public-ghost" onClick={() => navigate('documents')}>Open library<ArrowRight size={17} /></button></div></div><span className="welcome-mark"><Sparkles size={34} /></span></section><section className="public-metrics"><Metric icon={Files} label="Documents reviewed" value={documents.length} /><Metric icon={AlertTriangle} label="High-risk matters" value={highRisk.length} /><Metric icon={CircleDot} label="Issues identified" value={findings} /><Metric icon={ShieldCheck} label="Department" value={department.label} text /></section><section className="public-card"><Header title="Recently reviewed" subtitle="Reviews stored in this browser" action={<button className="public-link" onClick={() => navigate('documents')}>View all<ArrowRight size={15} /></button>} />{documents.length ? <div className="public-document-list">{documents.slice(0, 6).map(item => <button key={item.id} onClick={() => openDocument(item.id)}><RiskBadge risk={item.analysis.overall_risk} score={item.analysis.overall_score} /><span><strong>{item.title}</strong><small>{item.matter} · {formatDate(item.updatedAt)}</small></span><ChevronRight size={18} /></button>)}</div> : <Empty icon={FilePlus2} title="No reviews yet" text="Start with an agreement, policy, note or other document." action={<button className="public-primary" onClick={() => navigate('new')}>Start a review<ArrowRight size={17} /></button>} />}</section></div>;
}

function Metric({ icon: Icon, label, value, text }) {
  return <div className="public-metric"><span><Icon size={20} /></span><div><strong className={text ? 'metric-text' : ''}>{value}</strong><small>{label}</small></div></div>;
}

function NewReview({ department, saveDocument, setNotice }) {
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: '', matter: 'Vendor onboarding', documentType: 'Auto-detect', jurisdiction: 'India', riskAppetite: 'Conservative' });

  async function selectFile(selected) {
    if (!selected) return;
    if (!/\.(pdf|docx|txt|csv|json|md|xml)$/i.test(selected.name)) return setNotice({ type: 'error', message: 'Use PDF, DOCX, TXT, CSV, JSON, Markdown or XML.' });
    setBusy(true);
    try {
      const extracted = await extractFileText(selected);
      if (extracted.trim().length < 20) throw new Error('The file did not contain enough readable text. Paste the text manually if it is a scanned document.');
      setFile(selected);
      setText(extracted.slice(0, 180000));
      setForm(current => ({ ...current, title: current.title || selected.name.replace(/\.[^.]+$/, '') }));
      setNotice({ type: 'success', message: `${selected.name} was read successfully.` });
    } catch (error) {
      setNotice({ type: 'error', message: error.message || 'The file could not be read.' });
    } finally {
      setBusy(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    if (text.trim().length < 20) return setNotice({ type: 'error', message: 'Upload a document or paste enough document text.' });
    setBusy(true);
    setTimeout(() => {
      const analysis = analyseText(text, form);
      const now = new Date().toISOString();
      saveDocument({ id: uid(), ...form, title: form.title || file?.name.replace(/\.[^.]+$/, '') || 'Untitled document', documentType: analysis.document_type, originalFileName: file?.name || '', extractedText: text.slice(0, 180000), department: department.key, departmentLabel: department.label, analysis, decisions: [], status: 'Browser Review Complete', createdAt: now, updatedAt: now });
      setBusy(false);
    }, 500);
  }

  return <div className="new-public-layout"><form className="public-card public-form" onSubmit={submit}><Header title="1. Add the document" subtitle="PDF, DOCX or text is analysed within this browser." /><label className="public-drop"><input type="file" accept=".pdf,.docx,.txt,.csv,.json,.md,.xml" onChange={event => selectFile(event.target.files?.[0])} /><UploadCloud size={30} /><strong>{file ? file.name : 'Choose or drop a document'}</strong><small>{busy ? 'Reading document…' : 'PDF, DOCX, TXT, CSV, JSON, MD or XML'}</small></label><div className="public-divider"><span>OR PASTE TEXT</span></div><textarea rows="11" value={text} onChange={event => setText(event.target.value)} placeholder="Paste agreement, policy, term sheet or other document text…" /><Header title="2. Add review context" subtitle="Context calibrates the issue-spotting result." /><div className="public-fields"><label>Document title<input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Document title" /></label><label>Matter<input value={form.matter} onChange={event => setForm({ ...form, matter: event.target.value })} /></label><label>Document type<select value={form.documentType} onChange={event => setForm({ ...form, documentType: event.target.value })}><option>Auto-detect</option><option>Agreement</option><option>NDA</option><option>Policy</option><option>Legal opinion</option><option>Term sheet</option><option>Service level agreement</option></select></label><label>Jurisdiction<input value={form.jurisdiction} onChange={event => setForm({ ...form, jurisdiction: event.target.value })} /></label><label>Risk appetite<select value={form.riskAppetite} onChange={event => setForm({ ...form, riskAppetite: event.target.value })}><option>Conservative</option><option>Balanced</option><option>Commercial</option></select></label></div><button className="public-primary wide" disabled={busy}>{busy ? <><RefreshCw className="spin" size={18} />Analysing…</> : <><Sparkles size={18} />Analyse document</>}</button></form><aside className="public-card review-guide"><Header title="What the review produces" subtitle={`${department.label} decision support`} /><div><span>1</span><p><strong>Evidence-linked issues</strong><small>Each finding includes the detected language and impact.</small></p></div><div><span>2</span><p><strong>Protective drafting</strong><small>Mitigation and suggested language for material gaps.</small></p></div><div><span>3</span><p><strong>Decision-ready report</strong><small>Executive position, scenarios and regulatory touchpoints.</small></p></div><div className="local-note"><ShieldCheck size={18} /><p><strong>Browser-local processing</strong><small>No login and no document is sent to the failed authentication server.</small></p></div></aside></div>;
}

function DocumentLibrary({ documents, openDocument, removeDocument }) {
  const [search, setSearch] = useState('');
  const filtered = documents.filter(item => `${item.title} ${item.matter} ${item.documentType}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="public-card"><Header title="Document library" subtitle={`${filtered.length} locally stored review${filtered.length === 1 ? '' : 's'}`} action={<label className="public-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search documents" /></label>} />{filtered.length ? <div className="library-table">{filtered.map(item => <div key={item.id}><button onClick={() => openDocument(item.id)}><RiskBadge risk={item.analysis.overall_risk} score={item.analysis.overall_score} /><span><strong>{item.title}</strong><small>{item.matter} · {item.documentType}</small></span><span className="library-date">{formatDate(item.updatedAt)}</span><ChevronRight size={18} /></button><button className="delete-row" onClick={() => removeDocument(item.id)} aria-label="Delete"><Trash2 size={17} /></button></div>)}</div> : <Empty icon={Files} title="No matching documents" text="Upload a document to create the first browser-local review." />}</section>;
}

function Review({ document, updateDocument, removeDocument, navigate }) {
  const [tab, setTab] = useState('overview');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [decision, setDecision] = useState('Commented');
  const [comment, setComment] = useState('');
  if (!document) return <Empty icon={FileText} title="No document selected" text="Open a saved review from the document library." action={<button className="public-primary" onClick={() => navigate('documents')}>Open library</button>} />;
  const analysis = document.analysis;

  function ask() {
    const terms = question.toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 3);
    const matches = analysis.findings.filter(item => terms.some(term => JSON.stringify(item).toLowerCase().includes(term))).slice(0, 5);
    if (matches.length) setAnswer(matches.map(item => `${item.risk_level}: ${item.issue}\nEvidence: ${item.quoted_text}\nAction: ${item.recommended_mitigation}`).join('\n\n'));
    else {
      const text = document.extractedText.toLowerCase();
      const found = terms.find(term => text.includes(term));
      setAnswer(found ? `The document contains “${found}”. Review the source text and related findings before relying on it for a final position.` : 'The saved document and analysis do not contain enough evidence to answer that question reliably.');
    }
  }

  function recordDecision() {
    if (!comment.trim()) return;
    updateDocument(document.id, current => ({ ...current, decisions: [...current.decisions, { id: uid(), status: decision, comment: comment.trim(), department: current.departmentLabel, createdAt: new Date().toISOString() }], updatedAt: new Date().toISOString() }));
    setComment('');
  }

  return <div className="review-public"><section className="public-card review-summary"><div><RiskBadge risk={analysis.overall_risk} score={analysis.overall_score} large /><span><small>RECOMMENDED DECISION</small><strong>{analysis.recommended_decision}</strong></span></div><button className="public-danger-link" onClick={() => removeDocument(document.id)}><Trash2 size={16} />Delete</button></section><div className="review-tabs">{REVIEW_TABS.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</div>{tab === 'overview' && <section className="public-card review-content"><Header title="Executive position" subtitle={`${document.departmentLabel} · ${document.matter}`} /><p className="executive-text">{analysis.executive_position}</p><div className="overview-grid"><div><small>DOCUMENT SUMMARY</small><p>{analysis.document_summary}</p></div><div><small>ANALYSIS BASIS</small><p>{analysis.engine}. The review uses text extracted or pasted in this browser.</p></div></div><Header title="Record a decision" subtitle="Keep a browser-local decision trail" /><div className="decision-box"><select value={decision} onChange={event => setDecision(event.target.value)}><option>Commented</option><option>Assigned</option><option>Escalated</option><option>Accepted With Controls</option><option>Resolved</option><option>Rejected</option></select><textarea rows="3" value={comment} onChange={event => setComment(event.target.value)} placeholder="Decision, owner, control or next step…" /><button className="public-primary" onClick={recordDecision}>Record decision</button></div>{document.decisions.length > 0 && <div className="decision-list">{document.decisions.map(item => <div key={item.id}><strong>{item.status}</strong><p>{item.comment}</p><small>{item.department} · {formatDate(item.createdAt)}</small></div>)}</div>}</section>}{tab === 'issues' && <section className="review-list">{analysis.findings.length ? analysis.findings.map((item, index) => <article className="public-card finding" key={item.id}><div><span className={`risk-label ${item.risk_level.toLowerCase()}`}>{item.risk_level}</span><small>ISSUE {index + 1}</small></div><h3>{item.issue}</h3><blockquote>{item.quoted_text}</blockquote><div className="finding-grid"><div><small>WHY IT MATTERS</small><p>{item.why_risky_for_bank}</p></div><div><small>MITIGATION</small><p>{item.recommended_mitigation}</p></div></div><div className="rewrite"><small>SUGGESTED LANGUAGE</small><p>{item.suggested_rewrite}</p></div></article>) : <Empty icon={CheckCircle2} title="No configured issue pattern was triggered" text="A professional reviewer should still verify the document and transaction context." />}</section>}{tab === 'missing' && <section className="review-list">{analysis.missing_clauses.map(item => <article className="public-card missing" key={item.id}><span className="risk-label medium">{item.risk_level}</span><h3>{item.clause}</h3><p>{item.why_needed}</p><div className="rewrite"><small>RECOMMENDED LANGUAGE</small><p>{item.recommended_language}</p></div></article>)}</section>}{tab === 'scenarios' && <section className="review-list">{analysis.scenarios.map((item, index) => <article className="public-card scenario" key={index}><span>{index + 1}</span><div><h3>{item.scenario}</h3><small>TRIGGER</small><p>{item.trigger}</p><small>CONSEQUENCE</small><p>{item.consequence}</p><small>RESPONSE</small><p>{item.response}</p></div></article>)}</section>}{tab === 'regulatory' && <section className="review-list">{analysis.regulatory_touchpoints.map((item, index) => <article className="public-card regulatory" key={index}><ShieldCheck size={22} /><div><h3>{item.area}</h3><p>{item.relevance}</p><strong>Action: {item.action}</strong></div></article>)}</section>}{tab === 'assistant' && <section className="public-card assistant-box"><Header title="Ask Synesis" subtitle="Search this saved document and its findings" /><div className="ask-row"><input value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => event.key === 'Enter' && ask()} placeholder="Ask about liability, termination, data, sanctions…" /><button className="public-primary" onClick={ask}><MessageSquareText size={17} />Ask</button></div>{answer && <pre>{answer}</pre>}</section>}{tab === 'report' && <section className="public-card report-box"><Header title="Decision report" subtitle="Export the current browser-generated review" action={<button className="public-primary" onClick={() => downloadFile(`${document.title.replace(/[^a-z0-9]+/gi, '-')}-report.txt`, reportText(document))}><Download size={17} />Download report</button>} /><pre>{reportText(document)}</pre></section>}</div>;
}

function Compare({ documents }) {
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const left = documents.find(item => item.id === leftId);
  const right = documents.find(item => item.id === rightId);
  return <section className="public-card compare-box"><Header title="Compare documents" subtitle="Review risk movement between two locally saved analyses" /><div className="compare-selects"><label>First document<select value={leftId} onChange={event => setLeftId(event.target.value)}><option value="">Select document</option>{documents.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>Second document<select value={rightId} onChange={event => setRightId(event.target.value)}><option value="">Select document</option>{documents.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label></div>{left && right ? <div className="comparison-result"><CompareCard document={left} /><div className="score-delta"><small>SCORE MOVEMENT</small><strong>{right.analysis.overall_score - left.analysis.overall_score > 0 ? '+' : ''}{right.analysis.overall_score - left.analysis.overall_score}</strong><span>{right.analysis.overall_score > left.analysis.overall_score ? 'Risk increased' : right.analysis.overall_score < left.analysis.overall_score ? 'Risk reduced' : 'No score change'}</span></div><CompareCard document={right} /></div> : <Empty icon={GitCompareArrows} title="Select two documents" text="Both documents must already have a saved browser analysis." />}</section>;
}

function CompareCard({ document }) {
  return <div className="compare-card"><RiskBadge risk={document.analysis.overall_risk} score={document.analysis.overall_score} large /><h3>{document.title}</h3><p>{document.analysis.executive_position}</p><small>{document.analysis.findings.length} issues · {document.analysis.missing_clauses.length} missing protections</small></div>;
}

function Header({ title, subtitle, action }) {
  return <div className="public-card-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>;
}

function RiskBadge({ risk, score, large }) {
  return <span className={`risk-badge ${risk.toLowerCase()} ${large ? 'large' : ''}`}><strong>{score}</strong><small>{risk}</small></span>;
}

function Empty({ icon: Icon, title, text, action }) {
  return <div className="public-empty"><span><Icon size={27} /></span><h3>{title}</h3><p>{text}</p>{action}</div>;
}
