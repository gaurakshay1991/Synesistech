import {
  ArrowRight, BrainCircuit, Building2, ChartNoAxesCombined, CheckCircle2, CircleDot,
  Database, FileCheck2, GitBranch, Network, Orbit, ShieldCheck, Sparkles, Target, Workflow
} from 'lucide-react';
import { ENTERPRISE_PRODUCTS } from './EnterpriseProducts.jsx';

const FOUNDATION = [
  {
    key: 'decision',
    icon: BrainCircuit,
    title: 'Decision OS',
    description: 'Upload and analyse institutional documents, identify obligations and risks, model decisions, define controlled actions and preserve the reasoning record.',
    status: 'Live workspace'
  },
  {
    key: 'lab',
    icon: ChartNoAxesCombined,
    title: 'Capital & Scenario Lab',
    description: 'Calculate portfolio exposure, test mandate restrictions and simulate cross-functional events using supplied data and disclosed assumptions.',
    status: 'Live workspace'
  },
  {
    key: 'twin',
    icon: Network,
    title: 'Institutional Decision Twin',
    description: 'Create the living graph that connects obligations, contracts, controls, products, systems, entities, owners, decisions, tasks and evidence.',
    status: 'Functional prototype'
  }
];

const CORE = [
  ['Open Intelligence', Sparkles, 'Evidence-led document reasoning, current-source research, uncertainty separation and decision-grade analysis.'],
  ['Institutional Impact', Network, 'Connect obligations and events to products, controls, systems, contracts, owners, capital and stakeholders.'],
  ['Decision Memory', Database, 'Preserve decisions, authority, rationale, assumptions, conditions, evidence and observed outcomes.'],
  ['Controlled Execution', Workflow, 'Turn recommendations into assigned actions, approval gates, evidence requirements, escalation and verified closure.'],
  ['Institutional Twin', Orbit, 'Maintain a living representation of institutional duties, dependencies and decision lineage.'],
  ['Governed AI', ShieldCheck, 'Keep high-risk decisions human-controlled, source-traceable, evaluated and auditable.']
];

const GAPS = [
  ['Central enterprise persistence', 'Prepared architecture; Neon activation and organisation-scoped access remain required.'],
  ['Identity and access', 'SSO, SAML, MFA, ethical walls and customer identity-provider integration remain external deployment work.'],
  ['Authoritative data', 'Licensed legal, regulatory, sanctions and market-data sources require customer or provider agreements.'],
  ['System integrations', 'Connector framework is represented; production credentials and customer APIs remain required.'],
  ['Security assurance', 'Independent penetration testing, SOC 2 and ISO 27001 cannot be created by product code alone.'],
  ['Commercial proof', 'Paid design partners, validated ROI, implementation playbooks and reference customers remain business execution requirements.']
];

function ProductCard({ product, onNavigate }) {
  const Icon = product.icon;
  return <button className="themis-home-product" onClick={() => onNavigate(product.key)}>
    <div><span className="themis-home-icon"><Icon size={21} /></span><small>{product.status || 'Functional prototype'}</small></div>
    <h3>{product.title}</h3>
    <p>{product.description || product.proposition}</p>
    <span>Open workspace <ArrowRight size={15} /></span>
  </button>;
}

export default function ThemisHome({ onNavigate }) {
  return <main className="themis-home">
    <section className="themis-home-hero">
      <div>
        <h1>The institutional decision and execution operating system.</h1>
        <p>Themis connects evidence, obligations, contracts, capital, risk, governance, operations, decisions, actions and proof of completion. Legal intelligence is a horizontal capability—not the category of the platform.</p>
        <div className="themis-home-actions"><button onClick={() => onNavigate('decision')}>Start institutional work <ArrowRight size={16} /></button><button className="secondary" onClick={() => onNavigate('twin')}>Build the Decision Twin</button></div>
      </div>
      <div className="themis-loop" aria-label="Themis institutional decision loop">
        <article><span>1</span><div><strong>Understand</strong><small>Evidence, context, obligations and exposure</small></div></article>
        <ArrowRight size={17} />
        <article><span>2</span><div><strong>Decide</strong><small>Options, challenge, authority and approval</small></div></article>
        <ArrowRight size={17} />
        <article><span>3</span><div><strong>Execute</strong><small>Owners, actions, controls and dependencies</small></div></article>
        <ArrowRight size={17} />
        <article><span>4</span><div><strong>Prove and learn</strong><small>Evidence, closure, outcome and memory</small></div></article>
      </div>
    </section>

    <section className="themis-home-section">
      <div className="themis-home-heading"><div><h2>Platform foundation</h2><p>The existing capabilities remain intact and form the base for every additional product.</p></div><Building2 size={27} /></div>
      <div className="themis-home-grid foundation">{FOUNDATION.map(product => <ProductCard key={product.key} product={product} onNavigate={onNavigate} />)}</div>
    </section>

    <section className="themis-home-section">
      <div className="themis-home-heading"><div><h2>Additional product workspaces</h2><p>These are operational registers and workflow prototypes, not empty roadmap labels. Each supports structured records, status progression, search and export.</p></div><GitBranch size={27} /></div>
      <div className="themis-home-grid">{ENTERPRISE_PRODUCTS.map(product => <ProductCard key={product.key} product={{ ...product, status: 'Functional prototype' }} onNavigate={onNavigate} />)}</div>
    </section>

    <section className="themis-home-section themis-common-layer">
      <div className="themis-home-heading"><div><h2>One common intelligence layer</h2><p>The moat is not the model. It is the institutional ontology, Decision Memory, controlled execution, evaluation data and embedded workflow.</p></div><ShieldCheck size={27} /></div>
      <div className="themis-capability-grid">{CORE.map(([title, Icon, description]) => <article key={title}><Icon size={19} /><div><h3>{title}</h3><p>{description}</p></div></article>)}</div>
    </section>

    <section className="themis-wedge">
      <div><Target size={25} /><div><h2>Initial commercial wedge</h2><p>Obligation-to-decision-to-execution for banks, NBFCs, AMCs, fintechs and other regulated financial institutions in India.</p></div></div>
      <div>
        <p><CheckCircle2 size={16} /><span><strong>Not another legal chatbot.</strong> Themis connects legal and regulatory intelligence to controls, capital, operations and governance.</span></p>
        <p><CheckCircle2 size={16} /><span><strong>Not another dashboard.</strong> Themis creates accountable work and requires proof before closure.</span></p>
        <p><CheckCircle2 size={16} /><span><strong>Not a collection of disconnected modules.</strong> Every workspace should operate over the same Institutional Twin and Decision Memory.</span></p>
      </div>
    </section>

    <section className="themis-home-section">
      <div className="themis-home-heading"><div><h2>Known enterprise gaps</h2><p>The platform displays these explicitly so prototype capability is not confused with completed enterprise readiness.</p></div><CircleDot size={27} /></div>
      <div className="themis-gap-list">{GAPS.map(([title, detail], index) => <article key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{title}</h3><p>{detail}</p></div></article>)}</div>
    </section>

    <section className="themis-revolution">
      <div><FileCheck2 size={25} /><span>THE CATEGORY-DEFINING CAPABILITY</span></div>
      <h2>A continuously updated Institutional Decision Twin</h2>
      <p>Every regulation, contract, incident, counterparty event or governance decision should update what the institution must do, what is affected, who can decide, what must happen next and what evidence proves completion.</p>
      <div><span>Change or event</span><ArrowRight size={15} /><span>Institutional impact</span><ArrowRight size={15} /><span>Controlled decision</span><ArrowRight size={15} /><span>Execution</span><ArrowRight size={15} /><span>Evidence and memory</span></div>
    </section>
  </main>;
}
