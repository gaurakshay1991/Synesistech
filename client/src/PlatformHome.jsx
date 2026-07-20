import {
  ArrowRight, BrainCircuit, Building2, ChartNoAxesCombined, CheckCircle2, CircleDot,
  DatabaseZap, FileCheck2, GitBranch, Landmark, Network, Orbit, Scale, ShieldCheck,
  Sparkles, Target, Workflow
} from 'lucide-react';

const LIVE_SOLUTIONS = [
  {
    key: 'decision',
    icon: BrainCircuit,
    title: 'Decision OS',
    description: 'Upload and analyse institutional documents, identify risks and obligations, model decisions, define actions and preserve the reasoning record.',
    status: 'Live',
    action: 'Open Decision OS'
  },
  {
    key: 'regulatory',
    icon: Landmark,
    title: 'Regulatory Command',
    description: 'Convert a regulatory change into obligations, institutional impacts, owners, remediation, approvals, evidence and controlled closure.',
    status: 'Vertical release',
    action: 'Open Regulatory Command'
  },
  {
    key: 'lab',
    icon: ChartNoAxesCombined,
    title: 'Capital & Scenario Lab',
    description: 'Calculate portfolio exposure, test mandate restrictions and simulate cross-functional institutional events from supplied evidence and assumptions.',
    status: 'Live',
    action: 'Open Scenario Lab'
  }
];

const CORE = [
  ['Themis Intelligence', Sparkles, 'Evidence-led document reasoning, current-source research, uncertainty separation and decision-grade analysis.'],
  ['Institutional Impact', Network, 'Connect obligations and events to products, controls, systems, contracts, owners, capital and stakeholders.'],
  ['Decision Memory', DatabaseZap, 'Preserve what was decided, why it was decided, who approved it, what evidence supported it and what happened next.'],
  ['Controlled Execution', Workflow, 'Turn recommendations into assigned actions, approval gates, evidence requirements, escalation and verified closure.'],
  ['Institutional Twin', Orbit, 'Build a living representation of obligations, controls, entities, systems, decisions, evidence and dependencies.'],
  ['Governed AI', ShieldCheck, 'Keep high-risk decisions human-controlled, source-traceable, auditable and subject to configurable authority.']
];

const ROADMAP = [
  ['Contract Value Assurance', 'Track negotiated rights, obligations, service levels, renewals, claims, penalties and value leakage after execution.'],
  ['Counterparty Event Command', 'Map enforcement, sanctions, insolvency, cyber and ownership events to contracts, exposure, rights and controlled response.'],
  ['AI Control Tower', 'Govern models, agents, prompts, permissions, evaluations, spend, failures, security and release approvals.'],
  ['Agent Studio', 'Create reusable institutional agents with defined tools, data boundaries, approval gates and evaluation tests.'],
  ['Governance & Authority Graph', 'Map entities, delegations, signatories, committees, approval limits, resolutions and statutory obligations.'],
  ['Enterprise Connectors', 'Integrate Microsoft 365, ServiceNow, Jira, DMS, GRC, market data and customer systems through controlled APIs.']
];

function SolutionCard({ solution, onNavigate }) {
  const Icon = solution.icon;
  return <button className="platform-solution" onClick={() => onNavigate(solution.key)}>
    <div className="platform-solution-top"><span className="platform-icon"><Icon size={21} /></span><span className="platform-status live">{solution.status}</span></div>
    <h3>{solution.title}</h3>
    <p>{solution.description}</p>
    <span className="platform-open">{solution.action}<ArrowRight size={15} /></span>
  </button>;
}

export default function PlatformHome({ onNavigate }) {
  return <main className="platform-home">
    <section className="platform-hero">
      <div className="platform-hero-copy">
        <span className="platform-eyebrow"><Building2 size={15} /> SYNESIS INSTITUTIONAL OPERATING PLATFORM</span>
        <h1>Understand the institution. Decide with control. Execute and prove completion.</h1>
        <p>Synesis is an AI-native institutional decision intelligence and execution platform for organisations managing capital, risk, regulation, operations, governance and stakeholder obligations. Legal intelligence is a horizontal capability—not the category of the platform.</p>
        <div className="platform-hero-actions">
          <button onClick={() => onNavigate('decision')}>Start institutional work <ArrowRight size={16} /></button>
          <button className="secondary" onClick={() => onNavigate('regulatory')}>Open the first vertical</button>
        </div>
      </div>
      <div className="platform-loop" aria-label="Synesis decision loop">
        <div><span>1</span><strong>Understand</strong><small>Evidence, context, obligations and exposure</small></div>
        <ArrowRight size={18} />
        <div><span>2</span><strong>Decide</strong><small>Options, challenge, authority and approval</small></div>
        <ArrowRight size={18} />
        <div><span>3</span><strong>Execute</strong><small>Actions, controls, owners and dependencies</small></div>
        <ArrowRight size={18} />
        <div><span>4</span><strong>Prove & learn</strong><small>Evidence, closure, outcome and memory</small></div>
      </div>
    </section>

    <section className="platform-section">
      <div className="platform-section-head">
        <div><span>WORK-FIRST PLATFORM</span><h2>Live solution packs</h2></div>
        <p>Regulatory Command is one focused vertical. It does not replace the broader Decision OS, capital intelligence or future enterprise capabilities.</p>
      </div>
      <div className="platform-solutions">{LIVE_SOLUTIONS.map(solution => <SolutionCard key={solution.key} solution={solution} onNavigate={onNavigate} />)}</div>
    </section>

    <section className="platform-section platform-core-section">
      <div className="platform-section-head">
        <div><span>COMMON INTELLIGENCE LAYER</span><h2>What makes Synesis one platform</h2></div>
        <p>Every solution pack should use the same institutional objects, evidence, decision memory, approval logic and execution controls.</p>
      </div>
      <div className="platform-core-grid">{CORE.map(([title, Icon, description]) => <article key={title}><Icon size={19} /><div><h3>{title}</h3><p>{description}</p></div></article>)}</div>
    </section>

    <section className="platform-moat">
      <div>
        <span className="platform-eyebrow"><Target size={15} /> INITIAL MARKET WEDGE</span>
        <h2>Obligation-to-decision-to-execution for regulated financial institutions</h2>
        <p>The initial niche remains banks, NBFCs, AMCs, fintechs and other regulated institutions in India. Synesis should solve the complete chain from a change or event to affected obligations, decisions, controlled action and regulator-ready evidence.</p>
      </div>
      <div className="platform-moat-points">
        <p><CheckCircle2 size={16} /><span><strong>Not another legal chatbot.</strong> It connects law, contracts, controls, capital, operations and governance.</span></p>
        <p><CheckCircle2 size={16} /><span><strong>Not another dashboard.</strong> It creates accountable actions and verifies closure.</span></p>
        <p><CheckCircle2 size={16} /><span><strong>Not model-dependent.</strong> The moat is the institutional ontology, Decision Memory, execution integrations and evaluation data.</span></p>
      </div>
    </section>

    <section className="platform-section">
      <div className="platform-section-head">
        <div><span>VERTICAL EXPANSION</span><h2>Next competitive capabilities</h2></div>
        <p>These remain part of the product architecture. They are sequenced after the regulatory vertical becomes stable, persistent and commercially usable.</p>
      </div>
      <div className="platform-roadmap">{ROADMAP.map(([title, description], index) => <article key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{title}</h3><p>{description}</p></div><CircleDot size={16} /></article>)}</div>
    </section>

    <section className="platform-revolution">
      <div><GitBranch size={25} /><span>THE CATEGORY-DEFINING CAPABILITY</span></div>
      <h2>A continuously updated Institutional Decision Twin</h2>
      <p>Every new regulation, contract, incident, counterparty event or governance decision should update a living graph of what the institution must do, what is affected, who can decide, what must happen next and what evidence proves completion.</p>
      <div className="platform-revolution-flow">
        <span><Scale size={16} /> Change or event</span><ArrowRight size={15} /><span><Network size={16} /> Institutional impact</span><ArrowRight size={15} /><span><BrainCircuit size={16} /> Controlled decision</span><ArrowRight size={15} /><span><Workflow size={16} /> Execution</span><ArrowRight size={15} /><span><FileCheck2 size={16} /> Evidence & memory</span>
      </div>
    </section>
  </main>;
}
