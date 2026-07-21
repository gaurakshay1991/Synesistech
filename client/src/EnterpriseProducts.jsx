import { useMemo, useState } from 'react';
import {
  Archive, Bot, CheckCircle2, CircleAlert, Database, Download, FileCheck2, FileText,
  Gauge, GitBranch, Landmark, Plus, PlugZap, Scale, ShieldAlert, Trash2, Workflow
} from 'lucide-react';

const PRODUCT_DEFINITIONS = {
  regulatory: {
    title: 'Regulatory Decision Assurance',
    icon: Landmark,
    proposition: 'Convert regulatory change into applicability, obligations, institutional impact, owners, decisions, actions, evidence and closure.',
    recordName: 'regulatory obligation',
    statuses: ['Identified', 'Applicability review', 'Implementation', 'Evidence review', 'Closed'],
    fields: [
      ['regulator', 'Regulator / authority', 'text'], ['reference', 'Instrument / reference', 'text'],
      ['obligation', 'Obligation or change', 'textarea'], ['owner', 'Accountable owner', 'text'],
      ['affectedObject', 'Affected product, policy, control or system', 'text'], ['dueDate', 'Implementation date', 'date'],
      ['evidence', 'Required completion evidence', 'textarea']
    ],
    controls: ['Applicability confirmation', 'Obligation register', 'Impact mapping', 'Maker-checker approval', 'Evidence-based closure']
  },
  contracts: {
    title: 'Contract Value Assurance',
    icon: FileText,
    proposition: 'Keep signed contracts alive by tracking rights, obligations, service levels, renewals, claims, penalties and value leakage.',
    recordName: 'contract commitment',
    statuses: ['Extracted', 'Owner assigned', 'Monitoring', 'At risk', 'Satisfied', 'Waived'],
    fields: [
      ['agreement', 'Agreement / matter', 'text'], ['counterparty', 'Counterparty', 'text'],
      ['commitment', 'Right, obligation or service level', 'textarea'], ['owner', 'Business owner', 'text'],
      ['value', 'Financial or strategic value', 'text'], ['triggerDate', 'Trigger / renewal date', 'date'],
      ['evidence', 'Performance evidence', 'textarea']
    ],
    controls: ['Renewal and termination alerts', 'SLA and deliverable monitoring', 'Claim and penalty tracking', 'Right-preservation evidence', 'Value-leakage register']
  },
  counterparty: {
    title: 'Counterparty Event Command',
    icon: ShieldAlert,
    proposition: 'Map enforcement, sanctions, insolvency, ownership, cyber and conduct events to exposure, contracts, rights and controlled response.',
    recordName: 'counterparty event',
    statuses: ['Reported', 'Verification', 'Exposure mapping', 'Decision required', 'Response active', 'Closed'],
    fields: [
      ['counterparty', 'Counterparty / group', 'text'], ['eventType', 'Event type', 'select', ['Enforcement', 'Sanctions', 'Insolvency', 'Cyber', 'Ownership change', 'Adverse media', 'Other']],
      ['event', 'Verified event or allegation', 'textarea'], ['exposure', 'Financial / operational exposure', 'text'],
      ['contractRights', 'Relevant rights and triggers', 'textarea'], ['owner', 'Response owner', 'text'],
      ['nextAction', 'Controlled next action', 'textarea']
    ],
    controls: ['Source verification', 'Entity and group mapping', 'Contract-right extraction', 'Exposure aggregation', 'Approval-controlled response']
  },
  memory: {
    title: 'Decision Memory',
    icon: Database,
    proposition: 'Preserve what was decided, why, by whom, on which facts, subject to which conditions and with what outcome.',
    recordName: 'institutional decision',
    statuses: ['Proposed', 'Approved', 'Approved with conditions', 'Rejected', 'Superseded', 'Expired'],
    fields: [
      ['matter', 'Matter / decision title', 'text'], ['decision', 'Decision taken or required', 'textarea'],
      ['rationale', 'Rationale and evidence relied upon', 'textarea'], ['authority', 'Approving authority', 'text'],
      ['conditions', 'Conditions / reservations', 'textarea'], ['validUntil', 'Review or expiry date', 'date'],
      ['outcome', 'Observed outcome / learning', 'textarea']
    ],
    controls: ['Decision lineage', 'Authority record', 'Facts and assumptions', 'Conditions and expiry', 'Outcome feedback loop']
  },
  governance: {
    title: 'Governance & Authority',
    icon: Scale,
    proposition: 'Map legal entities, committees, delegations, signatories, approval limits, resolutions and authority validity.',
    recordName: 'authority record',
    statuses: ['Draft', 'Verified', 'Active', 'Restricted', 'Expired', 'Revoked'],
    fields: [
      ['entity', 'Legal entity / business unit', 'text'], ['authorityType', 'Authority type', 'select', ['Board authority', 'Committee mandate', 'Delegation', 'Authorised signatory', 'Power of attorney', 'Approval limit']],
      ['holder', 'Authority holder', 'text'], ['scope', 'Permitted scope', 'textarea'],
      ['limit', 'Financial / decision limit', 'text'], ['effectiveDate', 'Effective date', 'date'],
      ['expiryDate', 'Expiry / review date', 'date']
    ],
    controls: ['Entity-specific authority', 'Delegation chain', 'Approval-limit validation', 'Expiry monitoring', 'Resolution and instrument evidence']
  },
  control: {
    title: 'AI Control Tower',
    icon: Gauge,
    proposition: 'Govern models, providers, prompts, agents, permissions, evaluation performance, spend, failures and release decisions.',
    recordName: 'AI use case',
    statuses: ['Proposed', 'Risk review', 'Approved', 'Restricted', 'Suspended', 'Retired'],
    fields: [
      ['useCase', 'AI use case', 'text'], ['model', 'Model / provider', 'text'],
      ['owner', 'Business and technical owner', 'text'], ['riskTier', 'Risk tier', 'select', ['Low', 'Moderate', 'High', 'Prohibited']],
      ['dataScope', 'Permitted data and users', 'textarea'], ['evaluation', 'Required evaluation / threshold', 'textarea'],
      ['monthlyLimit', 'Spend or usage limit', 'text']
    ],
    controls: ['Model and prompt registry', 'Use-case permissions', 'Risk-tier approval', 'Evaluation release gate', 'Emergency disable and audit trail']
  },
  agents: {
    title: 'Agent Studio',
    icon: Bot,
    proposition: 'Create controlled institutional agents with defined objectives, tools, data boundaries, approval gates and evaluation tests.',
    recordName: 'controlled agent',
    statuses: ['Draft', 'Testing', 'Approved', 'Deployed', 'Paused', 'Retired'],
    fields: [
      ['name', 'Agent name', 'text'], ['objective', 'Objective and permitted outcome', 'textarea'],
      ['tools', 'Permitted tools and systems', 'textarea'], ['dataScope', 'Data boundary', 'textarea'],
      ['approvalGate', 'Human approval gate', 'textarea'], ['escalation', 'Escalation conditions', 'textarea'],
      ['evaluation', 'Required tests and thresholds', 'textarea']
    ],
    controls: ['Least-privilege tools', 'Data boundary', 'Mandatory human gates', 'Versioned instructions', 'Evaluation before deployment']
  },
  evaluation: {
    title: 'Evaluation Lab',
    icon: FileCheck2,
    proposition: 'Benchmark analysis quality, citation support, omissions, false positives, false negatives and prompt or model regressions.',
    recordName: 'evaluation case',
    statuses: ['Designed', 'Ready', 'Running', 'Passed', 'Failed', 'Remediation'],
    fields: [
      ['benchmark', 'Benchmark / test case', 'text'], ['workflow', 'Workflow under test', 'text'],
      ['expected', 'Expected findings or outcome', 'textarea'], ['modelVersion', 'Model / prompt version', 'text'],
      ['score', 'Observed score / result', 'text'], ['defect', 'Material defect or omission', 'textarea'],
      ['releaseDecision', 'Release decision and remediation', 'textarea']
    ],
    controls: ['Golden test sets', 'Citation verification', 'False-negative tracking', 'Prompt regression testing', 'Release blocking thresholds']
  },
  integrations: {
    title: 'Integration Hub',
    icon: PlugZap,
    proposition: 'Register and govern connections with Microsoft 365, DMS, GRC, ServiceNow, Jira, market data and institutional systems.',
    recordName: 'integration',
    statuses: ['Planned', 'Security review', 'Development', 'Testing', 'Live', 'Degraded', 'Disabled'],
    fields: [
      ['system', 'System / provider', 'text'], ['integrationType', 'Integration type', 'select', ['API', 'Webhook', 'File transfer', 'Email', 'Database', 'Identity / SSO']],
      ['owner', 'Integration owner', 'text'], ['dataFlow', 'Permitted data flow', 'textarea'],
      ['authentication', 'Authentication and secret handling', 'textarea'], ['health', 'Health / last successful sync', 'text'],
      ['fallback', 'Failure and fallback procedure', 'textarea']
    ],
    controls: ['Connector registry', 'Data-flow approval', 'Secret governance', 'Retry and failure history', 'Health and ownership monitoring']
  },
  evidence: {
    title: 'Evidence & Audit Command',
    icon: Archive,
    proposition: 'Link completion evidence to obligations, controls, tasks, decisions and audit requirements so closure can be proved.',
    recordName: 'evidence requirement',
    statuses: ['Required', 'Requested', 'Submitted', 'Rejected', 'Verified', 'Expired'],
    fields: [
      ['matter', 'Matter / obligation / control', 'text'], ['requirement', 'Evidence requirement', 'textarea'],
      ['owner', 'Evidence owner', 'text'], ['evidenceType', 'Evidence type', 'select', ['Approval', 'System record', 'Policy or procedure', 'Contract', 'Testing result', 'Filing or return', 'Other']],
      ['location', 'Repository / reference / hash', 'text'], ['validUntil', 'Validity / expiry date', 'date'],
      ['reviewNote', 'Reviewer note', 'textarea']
    ],
    controls: ['Evidence-to-obligation linkage', 'Reviewer acceptance', 'Expiry and refresh', 'Immutable metadata', 'Audit-pack export']
  }
};

function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function load(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function exportJson(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function Field({ field, value, onChange }) {
  const [key, label, type, options] = field;
  if (type === 'textarea') return <label className="themis-field themis-field-wide"><span>{label}</span><textarea rows="3" value={value || ''} onChange={event => onChange(key, event.target.value)} /></label>;
  if (type === 'select') return <label className="themis-field"><span>{label}</span><select value={value || ''} onChange={event => onChange(key, event.target.value)}><option value="">Select…</option>{options.map(option => <option key={option}>{option}</option>)}</select></label>;
  return <label className="themis-field"><span>{label}</span><input type={type} value={value || ''} onChange={event => onChange(key, event.target.value)} /></label>;
}

export function getProductDefinition(productKey) {
  return PRODUCT_DEFINITIONS[productKey];
}

export function EnterpriseProduct({ productKey }) {
  const definition = PRODUCT_DEFINITIONS[productKey] || PRODUCT_DEFINITIONS.contracts;
  const Icon = definition.icon;
  const storageKey = `themis-product-${productKey}-v1`;
  const [records, setRecords] = useState(() => load(storageKey));
  const [draft, setDraft] = useState({ status: definition.statuses[0] });
  const [query, setQuery] = useState('');

  const save = next => { setRecords(next); localStorage.setItem(storageKey, JSON.stringify(next)); };
  const visible = useMemo(() => records.filter(record => JSON.stringify(record).toLowerCase().includes(query.toLowerCase())), [records, query]);
  const complete = records.filter(record => ['Closed', 'Satisfied', 'Verified', 'Passed', 'Live', 'Deployed', 'Approved'].includes(record.status)).length;
  const attention = records.filter(record => /risk|fail|reject|degrad|suspend|expire|restrict|remediation/i.test(record.status)).length;

  function createRecord(event) {
    event.preventDefault();
    const hasContent = definition.fields.some(([key]) => String(draft[key] || '').trim());
    if (!hasContent) return;
    const record = { id: uid(), ...draft, status: draft.status || definition.statuses[0], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    save([record, ...records]);
    setDraft({ status: definition.statuses[0] });
  }

  function updateStatus(id, status) {
    save(records.map(record => record.id === id ? { ...record, status, updatedAt: new Date().toISOString() } : record));
  }

  function remove(id) { save(records.filter(record => record.id !== id)); }

  return <main className="themis-product-shell">
    <section className="themis-product-hero">
      <div className="themis-product-icon"><Icon size={26} /></div>
      <div><h1>{definition.title}</h1><p>{definition.proposition}</p></div>
    </section>

    <section className="themis-product-metrics">
      <article><strong>{records.length}</strong><span>Total records</span></article>
      <article><strong>{complete}</strong><span>Controlled / complete</span></article>
      <article><strong>{attention}</strong><span>Needs attention</span></article>
      <article><strong>{definition.controls.length}</strong><span>Embedded controls</span></article>
    </section>

    <div className="themis-product-grid">
      <form className="themis-panel" onSubmit={createRecord}>
        <div className="themis-panel-heading"><div><h2>Add {definition.recordName}</h2><p>Create a structured institutional record. Records persist in this browser until enterprise database activation.</p></div><Plus size={20} /></div>
        <div className="themis-form-grid">{definition.fields.map(field => <Field key={field[0]} field={field} value={draft[field[0]]} onChange={(key, value) => setDraft(current => ({ ...current, [key]: value }))} />)}</div>
        <label className="themis-field"><span>Workflow status</span><select value={draft.status || definition.statuses[0]} onChange={event => setDraft(current => ({ ...current, status: event.target.value }))}>{definition.statuses.map(status => <option key={status}>{status}</option>)}</select></label>
        <button className="themis-primary" type="submit"><Plus size={16} /> Add record</button>
        <div className="themis-control-list"><h3>Controls covered</h3>{definition.controls.map(control => <p key={control}><CheckCircle2 size={15} />{control}</p>)}</div>
      </form>

      <section className="themis-panel">
        <div className="themis-panel-heading"><div><h2>Active register</h2><p>Search, progress and export the institutional record.</p></div><button className="themis-icon-button" onClick={() => exportJson(definition.title, records)} title="Export JSON"><Download size={17} /></button></div>
        <input className="themis-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search records…" />
        <div className="themis-records">
          {!visible.length && <div className="themis-empty"><CircleAlert size={24} /><p>No records yet. Add the first controlled record from the form.</p></div>}
          {visible.map(record => <article className="themis-record" key={record.id}>
            <div className="themis-record-top"><span className={`themis-status ${/closed|satisfied|verified|passed|live|deployed|approved$/i.test(record.status) ? 'good' : /risk|fail|reject|degrad|suspend|expire|restrict|remediation/i.test(record.status) ? 'danger' : 'active'}`}>{record.status}</span><button onClick={() => remove(record.id)} title="Delete"><Trash2 size={15} /></button></div>
            <h3>{record[definition.fields[0][0]] || definition.recordName}</h3>
            <p>{record[definition.fields.find(field => field[2] === 'textarea')?.[0]] || 'No narrative supplied.'}</p>
            <div className="themis-record-meta">{definition.fields.slice(1, 5).map(([key, label]) => record[key] ? <span key={key}><strong>{label}:</strong> {record[key]}</span> : null)}</div>
            <label className="themis-record-status"><span>Progress</span><select value={record.status} onChange={event => updateStatus(record.id, event.target.value)}>{definition.statuses.map(status => <option key={status}>{status}</option>)}</select></label>
          </article>)}
        </div>
      </section>
    </div>
  </main>;
}

export const ENTERPRISE_PRODUCTS = Object.entries(PRODUCT_DEFINITIONS).map(([key, value]) => ({ key, ...value }));
