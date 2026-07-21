import {
  ArrowRight, BrainCircuit, Briefcase, Building2, ChartNoAxesCombined, CheckCircle2,
  Clock3, Database, FileSearch, Gauge, GitBranch, Globe2, Landmark, Lock, Network,
  Scale, Search, ShieldCheck, Sparkles, Users, Workflow
} from 'lucide-react';

const startActions = [
  {
    title: 'Review a document',
    description: 'Upload the live document, identify obligations, risks, decisions and controlled next actions.',
    icon: FileSearch,
    mode: 'decision',
    status: 'Live'
  },
  {
    title: 'Assess a regulatory change',
    description: 'Map a circular or direction to obligations, affected functions, controls, owners and evidence.',
    icon: Landmark,
    mode: 'lab',
    status: 'Live'
  },
  {
    title: 'Test capital and mandate',
    description: 'Calculate portfolio concentration, liquidity and mandate restrictions from uploaded data.',
    icon: ChartNoAxesCombined,
    mode: 'lab',
    status: 'Live'
  },
  {
    title: 'Run an institutional scenario',
    description: 'Model a counterparty, cyber, governance, liquidity, sanctions or operational event.',
    icon: Gauge,
    mode: 'lab',
    status: 'Live'
  }
];

const platformCapabilities = [
  {
    title: 'Decision OS',
    detail: 'Evidence-led document intelligence, obligations, decisions, approvals and controlled actions.',
    icon: BrainCircuit,
    status: 'Available now'
  },
  {
    title: 'Institutional Decision Twin',
    detail: 'A living representation of obligations, contracts, controls, systems, entities, decisions and outcomes.',
    icon: Network,
    status: 'Foundation'
  },
  {
    title: 'Decision Memory',
    detail: 'Preserves what was decided, why, by whom, under which facts and whether the result worked.',
    icon: Database,
    status: 'Foundation'
  },
  {
    title: 'Regulatory Command',
    detail: 'Change-to-control impact mapping for regulated financial institutions, with ownership and evidence.',
    icon: Landmark,
    status: 'Available in Lab'
  },
  {
    title: 'Contract Value Assurance',
    detail: 'Tracks rights, obligations, service levels, claims, renewals, termination triggers and value leakage.',
    icon: Briefcase,
    status: 'Next vertical'
  },
  {
    title: 'Counterparty Event Command',
    detail: 'Connects external events to contracts, transactions, rights, exposures, approvals and response actions.',
    icon: Globe2,
    status: 'Next vertical'
  },
  {
    title: 'Governance & Authority Graph',
    detail: 'Entities, ownership, signatories, delegations, boards, committees and approval authority.',
    icon: Building2,
    status: 'Planned'
  },
  {
    title: 'AI Control Tower',
    detail: 'Models, prompts, agents, permissions, evaluations, cost, reliability, incidents and kill switches.',
    icon: ShieldCheck,
    status: 'Planned'
  },
  {
    title: 'Agent Studio',
    detail: 'Build governed agents with approved data, tools, output schemas, approval gates and evaluations.',
    icon: Workflow,
    status: 'Planned'
  }
];

const moat = [
  ['Institutional ontology', 'Connect obligations, clauses, controls, products, systems, owners, evidence and decisions.'],
  ['Decision lineage', 'Every conclusion shows the source, inference, approval, action and outcome.'],
  ['Controlled execution', 'AI recommends; authorised people approve; the platform proves completion.'],
  ['Open intelligence', 'Uploaded evidence remains primary while current authoritative information is independently checked.'],
  ['Sector and jurisdiction packs', 'Start with Indian regulated financial institutions, then add tested sector and jurisdiction packs.'],
  ['Evaluation advantage', 'Domain benchmarks, citation verification and human feedback improve reliability over time.']
];

function Status({ children }) {
  const future = /planned|next/i.test(children);
  return <span className={`themis-status ${future ? 'future' : ''}`}>{future ? <Clock3 size={12} /> : <CheckCircle2 size={12} />}{children}</span>;
}

export default function ThemisHome({ onOpen }) {
  return <main className="themis-home">
    <section className="themis-hero">
      <div className="themis-hero-copy">
        <div className="themis-eyebrow"><Sparkles size={15} />AI-native institutional intelligence and execution</div>
        <h1>THEMIS</h1>
        <h2>Know what the institution must do, why it matters, what is affected and what action comes next.</h2>
        <p>Themis connects capital, risk, regulation, contracts, operations, governance, evidence, people and AI agents in one governed decision and execution layer. Legal intelligence is a capability within the platform—not its category.</p>
        <div className="themis-hero-actions">
          <button onClick={() => onOpen('decision')}><FileSearch size={17} />Start live analysis</button>
          <button className="secondary" onClick={() => onOpen('lab')}><ChartNoAxesCombined size={17} />Open institutional lab</button>
        </div>
      </div>
      <div className="themis-twin-card">
        <small>THE INSTITUTIONAL TWIN</small>
        <div className="themis-twin-core"><Network size={38} /><strong>Change → Impact → Decision → Action → Evidence → Learning</strong></div>
        <ul>
          <li><Scale size={14} />Laws, obligations and contracts</li>
          <li><ShieldCheck size={14} />Controls, risks and approvals</li>
          <li><Building2 size={14} />Entities, products, systems and owners</li>
          <li><Database size={14} />Evidence, outcomes and institutional memory</li>
        </ul>
      </div>
    </section>

    <section className="themis-section">
      <div className="themis-section-heading"><div><small>START WITH WORK</small><h2>What requires action now?</h2></div><p>The user starts with the institutional task—not a catalogue of disconnected AI tools.</p></div>
      <div className="themis-start-grid">
        {startActions.map(({ title, description, icon: Icon, mode, status }) => <button key={title} onClick={() => onOpen(mode)}>
          <div className="themis-start-icon"><Icon size={21} /></div>
          <Status>{status}</Status>
          <strong>{title}</strong>
          <p>{description}</p>
          <span>Open workflow <ArrowRight size={14} /></span>
        </button>)}
      </div>
    </section>

    <section className="themis-section themis-positioning">
      <div className="themis-position-card">
        <small>INITIAL NICHE</small>
        <h2>Decision assurance and execution for regulated financial institutions.</h2>
        <p>The first commercial wedge is banks, NBFCs, AMCs, payment companies and other regulated institutions in India. The platform converts a regulatory, contractual, counterparty or governance event into affected obligations, products, systems, controls, owners, approvals and evidence.</p>
      </div>
      <div className="themis-position-card dark">
        <small>CATEGORY PROMISE</small>
        <h2>Themis does not merely explain the issue.</h2>
        <p>It identifies what must change, routes the authorised response, tracks execution, proves completion and learns from the result.</p>
      </div>
    </section>

    <section className="themis-section">
      <div className="themis-section-heading"><div><small>ONE PLATFORM, MULTIPLE SOLUTION PACKS</small><h2>Platform architecture</h2></div><p>Working capabilities remain accessible while the deeper institutional operating layer is built vertically.</p></div>
      <div className="themis-capability-grid">
        {platformCapabilities.map(({ title, detail, icon: Icon, status }) => <article key={title}>
          <div className="themis-capability-head"><span><Icon size={19} /></span><Status>{status}</Status></div>
          <h3>{title}</h3>
          <p>{detail}</p>
        </article>)}
      </div>
    </section>

    <section className="themis-section themis-moat">
      <div className="themis-section-heading"><div><small>DEFENSIBILITY</small><h2>What creates the moat</h2></div><p>The model is not the moat. Institutional context, graph relationships, decision lineage, execution and verified outcomes are.</p></div>
      <div className="themis-moat-grid">
        {moat.map(([title, detail], index) => <article key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{title}</strong><p>{detail}</p></div></article>)}
      </div>
    </section>

    <section className="themis-section themis-revolution">
      <div><small>THE REVOLUTIONARY DEMONSTRATION</small><h2>Upload a change. See the institution move.</h2></div>
      <div className="themis-revolution-flow">
        {['Ingest live evidence', 'Compile obligations', 'Map institutional impact', 'Resolve decisions', 'Execute approved actions', 'Prove and learn'].map((item, index) => <div key={item}><span>{index + 1}</span><strong>{item}</strong>{index < 5 && <GitBranch size={15} />}</div>)}
      </div>
      <p>A new circular, agreement, incident or counterparty event should update the institution’s obligations, controls, contracts, owners, decisions and evidence—not produce another isolated PDF report.</p>
    </section>

    <section className="themis-trust-strip">
      <span><Lock size={15} />Human approval for high-risk actions</span>
      <span><Search size={15} />Evidence and source provenance</span>
      <span><Users size={15} />Role-based institutional workflows</span>
      <span><Globe2 size={15} />Current external intelligence</span>
    </section>
  </main>;
}
