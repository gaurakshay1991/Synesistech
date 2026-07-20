import crypto from 'node:crypto';

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));
const round = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));
const level = score => score >= 75 ? 'Critical' : score >= 55 ? 'High' : score >= 30 ? 'Moderate' : 'Low';

const SCENARIOS = {
  regulatory: {
    label: 'Regulatory change or supervisory action',
    domains: { regulatory: 1.5, governance: 1.2, operations: 1.05, legal: 1.1, reputation: 0.9 },
    cascades: ['Obligation interpretation', 'Policy and control impact', 'Operational remediation', 'Management or trustee approval', 'Evidence and regulatory response'],
    owners: ['Compliance', 'Risk', 'Legal', 'Operations', 'Management'],
    gates: ['Confirm applicability and effective date', 'Approve interpretation and risk acceptance', 'Approve remediation plan', 'Validate completion evidence']
  },
  liquidity: {
    label: 'Liquidity, redemption or funding stress',
    domains: { capital: 1.35, liquidity: 1.6, investor_customer: 1.4, operations: 1.1, regulatory: 1.0, reputation: 0.8 },
    cascades: ['Cash buffer consumption', 'Asset disposal or funding draw', 'Concentration and price impact', 'Investor or customer fairness assessment', 'Escalation and disclosure'],
    owners: ['Investment / Treasury', 'Risk', 'Operations', 'Compliance', 'Management'],
    gates: ['Validate liquidity assumptions', 'Approve disposal or funding sequence', 'Assess investor/customer impact', 'Approve escalation and communication']
  },
  cyber: {
    label: 'Cyber, data or technology incident',
    domains: { data_cyber: 1.6, operations: 1.45, investor_customer: 1.2, regulatory: 1.25, reputation: 1.15, financial: 0.9 },
    cascades: ['Detection and containment', 'Data and system impact', 'Service disruption', 'Notification assessment', 'Recovery and control remediation'],
    owners: ['Information Security', 'Technology', 'Operations', 'Data Protection', 'Compliance', 'Management'],
    gates: ['Confirm incident severity', 'Approve containment action', 'Determine notification obligations', 'Approve recovery and external communication']
  },
  counterparty: {
    label: 'Counterparty, issuer or service-provider failure',
    domains: { financial: 1.35, operations: 1.25, capital: 1.05, legal: 1.0, regulatory: 0.95, reputation: 0.75 },
    cascades: ['Exposure identification', 'Service or payment interruption', 'Collateral and remedy assessment', 'Replacement or exit decision', 'Financial and stakeholder impact'],
    owners: ['Risk', 'Finance / Credit', 'Operations', 'Legal', 'Procurement', 'Management'],
    gates: ['Confirm exposure and dependency', 'Approve suspension, replacement or exit', 'Approve claim or enforcement strategy', 'Validate continuity and recovery']
  },
  contract: {
    label: 'Contract termination, breach or value leakage',
    domains: { legal: 1.5, operations: 1.25, financial: 1.05, regulatory: 0.8, data_cyber: 0.65, reputation: 0.7 },
    cascades: ['Breach or trigger verification', 'Rights and remedy assessment', 'Operational dependency impact', 'Negotiation, cure or termination', 'Exit and value recovery'],
    owners: ['Legal', 'Business', 'Operations', 'Procurement', 'Risk', 'Management'],
    gates: ['Confirm contractual trigger', 'Approve legal and commercial position', 'Approve suspension or termination', 'Validate exit and recovery evidence']
  },
  sanctions: {
    label: 'Sanctions, AML or prohibited-party event',
    domains: { regulatory: 1.55, legal: 1.25, operations: 1.3, financial: 0.95, reputation: 1.15, investor_customer: 0.8 },
    cascades: ['Entity and transaction identification', 'Screening and legal perimeter', 'Hold, reject or suspend assessment', 'Regulatory and management escalation', 'Exit, reporting and evidence'],
    owners: ['Compliance / AML', 'Legal', 'Operations', 'Risk', 'Management'],
    gates: ['Confirm identity and applicable restrictions', 'Approve hold, rejection or suspension', 'Determine reporting and disclosure', 'Approve relationship exit or continuation']
  },
  litigation: {
    label: 'Litigation, enforcement or investigation event',
    domains: { legal: 1.6, financial: 1.05, reputation: 1.15, operations: 0.75, governance: 0.85, regulatory: 0.9 },
    cascades: ['Claim and evidence assessment', 'Preservation and investigation', 'Exposure and strategy modelling', 'Settlement or defence decision', 'Disclosure and remediation'],
    owners: ['Legal', 'Compliance', 'Risk', 'Finance', 'Management'],
    gates: ['Approve privilege and preservation plan', 'Approve strategy and reserves', 'Approve settlement or defence position', 'Validate disclosure and closure']
  },
  governance: {
    label: 'Governance, authority or conflict event',
    domains: { governance: 1.6, regulatory: 1.15, legal: 1.05, reputation: 1.0, operations: 0.7, financial: 0.65 },
    cascades: ['Authority and conflict identification', 'Decision validity assessment', 'Independent review or recusal', 'Approval reconstruction', 'Remediation and institutional learning'],
    owners: ['Board / Trustees', 'Company Secretariat', 'Compliance', 'Legal', 'Management'],
    gates: ['Confirm decision authority', 'Resolve conflicts and recusals', 'Approve ratification or fresh decision', 'Validate governance evidence']
  },
  market: {
    label: 'Market, valuation or portfolio shock',
    domains: { capital: 1.55, financial: 1.25, liquidity: 1.15, investor_customer: 1.25, regulatory: 0.75, reputation: 0.65 },
    cascades: ['Valuation movement', 'Limit and concentration impact', 'Liquidity and collateral effect', 'Portfolio or balance-sheet response', 'Investor, customer or management communication'],
    owners: ['Investment / Treasury', 'Risk', 'Finance', 'Operations', 'Compliance', 'Management'],
    gates: ['Validate prices and scenario assumptions', 'Approve rebalance, hedge or funding action', 'Assess mandate and stakeholder fairness', 'Approve communication and monitoring']
  },
  operational: {
    label: 'Operational outage, control failure or processing event',
    domains: { operations: 1.6, investor_customer: 1.2, financial: 0.9, regulatory: 0.85, reputation: 0.95, data_cyber: 0.65 },
    cascades: ['Failure detection', 'Transaction and stakeholder impact', 'Manual continuity or workaround', 'Root cause and control assessment', 'Recovery, compensation and closure'],
    owners: ['Operations', 'Technology', 'Risk', 'Compliance', 'Business', 'Management'],
    gates: ['Confirm impact population', 'Approve workaround and prioritisation', 'Approve compensation or disclosure', 'Validate root-cause remediation']
  },
  generic: {
    label: 'Cross-functional institutional event',
    domains: { operations: 1.0, financial: 1.0, regulatory: 1.0, legal: 1.0, reputation: 0.9, governance: 0.9 },
    cascades: ['Event validation', 'Affected-object mapping', 'Risk and dependency assessment', 'Decision and approval', 'Execution and evidence'],
    owners: ['Business Owner', 'Risk', 'Compliance', 'Legal', 'Operations', 'Management'],
    gates: ['Validate facts and scope', 'Approve institutional position', 'Approve controlled action', 'Validate completion evidence']
  }
};

function contextAdjustment(context = {}) {
  const portfolioScore = clamp(context.portfolio?.overall_score || 0);
  const mandateBreaches = Math.max(0, Number(context.mandate?.breach_count || 0));
  const documentHigh = (context.document?.findings || []).filter(item => String(item.severity || item.risk_level).toLowerCase() === 'high').length;
  const regulatoryImmediate = (context.regulatory?.action_plan || []).filter(item => String(item.priority).toLowerCase() === 'immediate').length;
  return clamp(portfolioScore * 0.12 + mandateBreaches * 4 + documentHigh * 2.5 + regulatoryImmediate * 1.5, 0, 25);
}

function affectedDomainScores(profile, baseScore, controlStrength, activeFunctions) {
  const functionLift = Math.min(12, activeFunctions.length * 1.5);
  return Object.entries(profile.domains)
    .map(([domain, multiplier]) => ({
      domain,
      score: clamp(baseScore * multiplier + functionLift - controlStrength * 2.1)
    }))
    .sort((a, b) => b.score - a.score);
}

function scenarioVariant({ name, multiplier, baseScore, exposure, probability, durationDays, profile, controls, activeFunctions, contextLift }) {
  const controlStrength = clamp(controls, 0, 5);
  const score = clamp(baseScore * multiplier + contextLift - controlStrength * 2.4);
  const probabilityFactor = clamp(probability, 1, 5) / 5;
  const lossFactor = Math.min(0.85, (score / 100) * probabilityFactor * (0.35 + multiplier * 0.25));
  const expectedExposure = exposure > 0 ? round(exposure * lossFactor, 2) : null;
  const timeToCritical = Math.max(1, Math.round((6 - clamp(probability, 1, 5)) * 3 / Math.max(0.65, multiplier) + durationDays * 0.08));
  const domains = affectedDomainScores(profile, score, controlStrength, activeFunctions);
  return {
    name,
    multiplier,
    overall_score: round(score, 1),
    level: level(score),
    modelled_exposure: expectedExposure,
    exposure_basis: expectedExposure === null ? 'No financial exposure supplied.' : 'Modelled sensitivity estimate from user-supplied exposure; not a valuation or forecast.',
    time_to_critical_hours: timeToCritical,
    continuity_index: round(clamp(100 - domains.find(item => item.domain === 'operations')?.score * 0.75 || 100 - score * 0.35), 1),
    stakeholder_impact_index: round(clamp(domains.find(item => item.domain === 'investor_customer')?.score || score * 0.55), 1),
    regulatory_urgency_index: round(clamp(domains.find(item => item.domain === 'regulatory')?.score || score * 0.5), 1),
    affected_domains: domains
  };
}

export function simulateInstitutionalScenario(input = {}) {
  const scenarioType = SCENARIOS[input.scenarioType] ? input.scenarioType : 'generic';
  const profile = SCENARIOS[scenarioType];
  const probability = clamp(input.probability ?? 3, 1, 5);
  const severity = clamp(input.severity ?? 3, 1, 5);
  const speed = clamp(input.speed ?? 3, 1, 5);
  const durationDays = clamp(input.durationDays ?? 30, 1, 3650);
  const controlStrength = clamp(input.controlStrength ?? 2, 0, 5);
  const exposure = Math.max(0, Number(input.financialExposure || 0));
  const activeFunctions = Array.isArray(input.affectedFunctions) ? input.affectedFunctions.filter(Boolean).slice(0, 20) : [];
  const context = input.context && typeof input.context === 'object' ? input.context : {};
  const contextLift = contextAdjustment(context);
  const baseScore = clamp(probability * 7.5 + severity * 10 + speed * 5 + Math.min(15, durationDays / 30) + activeFunctions.length * 1.2 - controlStrength * 3.2, 5, 95);

  const variants = [
    scenarioVariant({ name: 'Base case', multiplier: 0.82, baseScore, exposure, probability, durationDays, profile, controls: controlStrength, activeFunctions, contextLift: contextLift * 0.7 }),
    scenarioVariant({ name: 'Adverse case', multiplier: 1.08, baseScore, exposure, probability, durationDays, profile, controls: controlStrength, activeFunctions, contextLift }),
    scenarioVariant({ name: 'Severe but plausible', multiplier: 1.32, baseScore, exposure, probability, durationDays, profile, controls: Math.max(0, controlStrength - 0.5), activeFunctions, contextLift: contextLift * 1.15 })
  ];

  const main = variants[1];
  const evidenceGaps = [
    !String(input.trigger || '').trim() ? 'No factual trigger or event narrative was supplied.' : null,
    exposure <= 0 ? 'No financial exposure was supplied; financial sensitivity cannot be modelled.' : null,
    !activeFunctions.length ? 'No affected functions were selected; cross-functional routing may be incomplete.' : null,
    !Array.isArray(input.controls) || !input.controls.length ? 'No existing controls or mitigants were described.' : null,
    !context.portfolio && !context.mandate && !context.document && !context.regulatory ? 'No uploaded institutional context was linked to the simulation.' : null
  ].filter(Boolean);

  const cascade = profile.cascades.map((event, index) => ({
    id: crypto.randomUUID(),
    sequence: index + 1,
    event,
    estimated_start_hours: index === 0 ? 0 : Math.max(1, Math.round(main.time_to_critical_hours * index / profile.cascades.length)),
    state: index === 0 ? 'Trigger' : index < 3 ? 'Likely cascade' : 'Decision-dependent',
    owner: profile.owners[Math.min(index, profile.owners.length - 1)]
  }));

  const actions = profile.gates.map((gate, index) => ({
    id: crypto.randomUUID(),
    priority: index < 2 ? 'Immediate' : index === 2 ? 'High' : 'Planned',
    action: gate,
    owner: profile.owners[Math.min(index, profile.owners.length - 1)],
    approval_gate: index === 0 ? 'Fact-owner validation' : index === profile.gates.length - 1 ? 'Closure authority' : 'Authorised decision-maker',
    completion_evidence: index === 0 ? 'Validated event record and affected-object list' : index === profile.gates.length - 1 ? 'Control test, closure approval and retained evidence' : 'Approved decision record, assigned tasks and execution evidence'
  }));

  const nodes = [
    { id: 'trigger', label: String(input.title || profile.label).slice(0, 80), type: 'Trigger', score: main.overall_score },
    ...main.affected_domains.slice(0, 6).map((item, index) => ({ id: `domain-${index}`, label: item.domain.replaceAll('_', ' '), type: 'Impact domain', score: item.score })),
    ...profile.owners.slice(0, 5).map((owner, index) => ({ id: `owner-${index}`, label: owner, type: 'Decision owner', score: Math.max(20, main.overall_score - index * 6) }))
  ];
  const links = [
    ...main.affected_domains.slice(0, 6).map((_, index) => ({ from: 'trigger', to: `domain-${index}`, relation: 'affects' })),
    ...profile.owners.slice(0, 5).map((_, index) => ({ from: `domain-${Math.min(index, 5)}`, to: `owner-${index}`, relation: 'requires decision by' }))
  ];

  return {
    kind: 'simulation',
    id: crypto.randomUUID(),
    title: String(input.title || profile.label).trim().slice(0, 180),
    scenario_type: scenarioType,
    scenario_label: profile.label,
    generated_at: new Date().toISOString(),
    engine: 'server-institutional-simulation-v1',
    inputs: {
      probability,
      severity,
      speed,
      duration_days: durationDays,
      control_strength: controlStrength,
      financial_exposure: exposure || null,
      affected_functions: activeFunctions,
      trigger: String(input.trigger || '').trim().slice(0, 4000),
      controls: Array.isArray(input.controls) ? input.controls.slice(0, 20) : []
    },
    context_used: {
      portfolio: context.portfolio?.title || null,
      mandate: context.mandate?.title || null,
      document: context.document?.title || null,
      regulatory: context.regulatory?.title || null,
      context_risk_lift: round(contextLift, 1)
    },
    overall_score: main.overall_score,
    overall_level: main.level,
    executive_position: `${profile.label} produces a ${main.level.toLowerCase()} modelled institutional impact under the adverse case. The first controlled decisions concern ${profile.gates.slice(0, 2).join(' and ').toLowerCase()}.`,
    variants,
    cascade,
    actions,
    evidence_gaps: evidenceGaps,
    graph: { nodes, links },
    assumptions: [
      'This is a decision-support simulation based on user-supplied parameters and active uploaded context.',
      'Modelled exposure is a sensitivity estimate, not a valuation, accounting reserve, probability forecast or regulatory conclusion.',
      'The simulation does not execute trades, suspend transactions, notify regulators, terminate contracts or communicate with stakeholders.',
      'Authorised personnel must validate facts, applicable requirements, assumptions and actions before reliance.'
    ]
  };
}

export const scenarioCatalogue = Object.entries(SCENARIOS).map(([key, value]) => ({ key, label: value.label }));
