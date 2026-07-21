import crypto from 'node:crypto';

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value || 0)));
const round = value => Number(Number(value || 0).toFixed(2));
const risk = score => score >= 75 ? 'Critical' : score >= 55 ? 'High' : score >= 30 ? 'Medium' : 'Low';

const SCENARIOS = {
  liquidity: {
    label: 'Liquidity and redemption shock',
    owners: ['Fund Management', 'Risk', 'Operations', 'Trustees'],
    approvals: ['Risk validation', 'Fund Manager decision', 'Trustee escalation if thresholds are breached']
  },
  market: {
    label: 'Market and portfolio shock',
    owners: ['Investment Team', 'Risk', 'Management'],
    approvals: ['Risk review', 'Investment Committee decision']
  },
  counterparty: {
    label: 'Counterparty, sanctions or default event',
    owners: ['Risk', 'Compliance', 'Legal', 'Treasury', 'Operations'],
    approvals: ['Compliance clearance', 'Risk acceptance', 'Management decision']
  },
  cyber: {
    label: 'Cyber, data or critical vendor incident',
    owners: ['Information Security', 'Operations', 'Risk', 'Compliance', 'Legal'],
    approvals: ['Incident commander', 'Regulatory notification approval', 'Customer communication approval']
  },
  regulatory: {
    label: 'Regulatory change impact',
    owners: ['Compliance', 'Legal', 'Risk', 'Business', 'Technology'],
    approvals: ['Applicability confirmation', 'Policy owner approval', 'Management closure']
  },
  contract: {
    label: 'Contract, obligation or service failure',
    owners: ['Legal', 'Procurement', 'Business', 'Risk', 'Operations'],
    approvals: ['Legal position', 'Commercial decision', 'Remedy or termination approval']
  },
  litigation: {
    label: 'Dispute, investigation or litigation exposure',
    owners: ['Legal', 'Management', 'Finance', 'Risk'],
    approvals: ['Privilege review', 'Settlement authority', 'Board or committee escalation where material']
  },
  product: {
    label: 'New product or institutional launch',
    owners: ['Business', 'Risk', 'Compliance', 'Legal', 'Technology', 'Operations'],
    approvals: ['Product governance', 'Risk sign-off', 'Compliance and legal clearance', 'Launch authority']
  }
};

function value(input, key, fallback = 0) {
  const parsed = Number(input?.[key]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(input, key, fallback = '') {
  return String(input?.[key] ?? fallback).trim();
}

function action(priority, owner, action, gate = 'Human approval required') {
  return { id: crypto.randomUUID(), priority, owner, action, gate };
}

function simulateLiquidity(input, context) {
  const redemption = clamp(value(input, 'redemptionPercent', 10));
  const priceShock = clamp(value(input, 'priceShockPercent', 5));
  const cash = clamp(value(input, 'cashPercent', context?.portfolio?.metrics?.cash_weight || 0));
  const slow = clamp(value(input, 'slowLiquidityPercent', context?.portfolio?.metrics?.slow_liquidity_weight || 0));
  const topIssuer = clamp(value(input, 'topIssuerPercent', context?.portfolio?.metrics?.top_holding_weight || 0));
  const uncovered = Math.max(0, redemption - cash);
  const forcedSlow = Math.min(slow, uncovered);
  const estimatedLoss = round((uncovered * priceShock) / 100);
  const score = clamp(redemption * 2 + priceShock * 2.4 + slow * 0.9 + topIssuer * 0.7 - cash * 0.8);
  return {
    score,
    metrics: [
      ['Redemption demand', `${redemption}%`],
      ['Mapped cash buffer', `${cash}%`],
      ['Assets requiring sale', `${round(uncovered)}%`],
      ['Slow-liquidity sales', `${round(forcedSlow)}%`],
      ['Indicative portfolio loss', `${estimatedLoss}% of NAV`]
    ],
    findings: [
      uncovered > 0 ? `Cash does not fully cover the ${redemption}% redemption scenario.` : 'Mapped cash covers the modelled redemption demand.',
      forcedSlow > redemption * 0.25 ? 'A material portion of the sale requirement depends on slower assets.' : 'Slow-asset dependency is limited under the supplied assumptions.',
      topIssuer > 12 ? 'Post-sale concentration may become materially worse.' : 'Top-issuer concentration is not the principal risk driver in this run.'
    ],
    actions: [
      action('Immediate', 'Fund Management / Treasury', 'Confirm executable cash, settlement flows and the first-sale sequence.'),
      action('Immediate', 'Risk', 'Validate stressed liquidation costs and remaining-investor impact.'),
      action('Next', 'Compliance / Trustees', 'Assess escalation and disclosure requirements if internal or scheme thresholds are crossed.')
    ]
  };
}

function simulateMarket(input, context) {
  const equityShock = clamp(value(input, 'equityShockPercent', 15));
  const rateShock = clamp(value(input, 'rateShockBps', 100), 0, 1000);
  const creditSpread = clamp(value(input, 'creditSpreadBps', 150), 0, 2000);
  const equityWeight = clamp(value(input, 'equityWeight', context?.portfolio?.asset_class_distribution?.find(item => /equity/i.test(item.name))?.weight || 50));
  const debtWeight = clamp(value(input, 'debtWeight', context?.portfolio?.asset_class_distribution?.find(item => /debt/i.test(item.name))?.weight || 40));
  const estimatedNavImpact = round((equityWeight * equityShock / 100) + (debtWeight * (rateShock / 10000 + creditSpread / 15000)));
  const score = clamp(equityShock * 2.1 + rateShock / 12 + creditSpread / 18 + Math.max(0, equityWeight - 60) * 0.5);
  return {
    score,
    metrics: [
      ['Equity shock', `-${equityShock}%`],
      ['Rate shock', `+${rateShock} bps`],
      ['Credit spread shock', `+${creditSpread} bps`],
      ['Estimated NAV impact', `-${estimatedNavImpact}%`]
    ],
    findings: [
      estimatedNavImpact > 10 ? 'The combined shock produces a material estimated decline in portfolio value.' : 'The modelled loss is meaningful but below the prototype materiality threshold.',
      'This estimate is sensitivity-based and does not replace instrument-level pricing or a validated enterprise risk model.'
    ],
    actions: [
      action('Immediate', 'Risk', 'Run instrument-level stress testing and validate nonlinear, correlation and derivative effects.'),
      action('Next', 'Investment Committee', 'Review hedging, cash, concentration and rebalancing alternatives.'),
      action('Next', 'Investor Relations', 'Prepare factual communication only if approved and required.')
    ]
  };
}

function simulateCounterparty(input) {
  const exposure = clamp(value(input, 'exposurePercent', 12));
  const frozen = clamp(value(input, 'frozenPercent', 60));
  const recovery = clamp(value(input, 'recoveryPercent', 30));
  const settlementDays = clamp(value(input, 'settlementDelayDays', 10), 0, 365);
  const loss = round(exposure * frozen / 100 * (100 - recovery) / 100);
  const score = clamp(exposure * 2.5 + frozen * 0.65 + settlementDays * 0.8 - recovery * 0.3);
  return {
    score,
    metrics: [
      ['Institutional exposure', `${exposure}%`],
      ['Potentially frozen', `${frozen}% of exposure`],
      ['Assumed recovery', `${recovery}%`],
      ['Indicative permanent loss', `${loss}% of relevant base`],
      ['Settlement delay', `${settlementDays} days`]
    ],
    findings: [
      exposure > 10 ? 'The counterparty exposure is material under the supplied assumptions.' : 'The exposure is contained but still requires legal, sanctions and operational assessment.',
      frozen > 50 ? 'Operational availability is the dominant immediate risk.' : 'Loss and settlement uncertainty are the principal risk drivers.'
    ],
    actions: [
      action('Immediate', 'Compliance', 'Determine sanctions, regulatory and transaction-permissibility position.'),
      action('Immediate', 'Treasury / Operations', 'Stop or route pending transactions only under authorised control procedures.'),
      action('Immediate', 'Legal / Risk', 'Assess contractual suspension, set-off, termination, collateral and recovery rights.'),
      action('Next', 'Management', 'Approve exposure reduction, communication and continuity measures.')
    ]
  };
}

function simulateCyber(input) {
  const downtime = clamp(value(input, 'downtimeHours', 24), 0, 720);
  const affected = clamp(value(input, 'affectedCustomersPercent', 20));
  const dataSensitivity = clamp(value(input, 'dataSensitivity', 70));
  const recoveryReadiness = clamp(value(input, 'recoveryReadiness', 50));
  const score = clamp(downtime * 1.2 + affected * 0.7 + dataSensitivity * 0.5 - recoveryReadiness * 0.45);
  return {
    score,
    metrics: [
      ['Downtime', `${downtime} hours`],
      ['Affected customers or users', `${affected}%`],
      ['Data sensitivity', `${dataSensitivity}/100`],
      ['Recovery readiness', `${recoveryReadiness}/100`]
    ],
    findings: [
      downtime > 12 ? 'The modelled outage is operationally material.' : 'The outage duration is limited but may still trigger incident obligations.',
      dataSensitivity > 65 ? 'Sensitive data exposure materially increases notification, legal and reputational risk.' : 'Operational resilience is the leading risk in this run.'
    ],
    actions: [
      action('Immediate', 'Incident Commander / Information Security', 'Contain, preserve evidence and validate affected systems and data.'),
      action('Immediate', 'Compliance / Legal', 'Assess regulatory, contractual and customer notification deadlines.'),
      action('Immediate', 'Operations', 'Activate tested continuity and manual processing controls.'),
      action('Next', 'Management', 'Approve external communication, remediation funding and third-party enforcement.')
    ]
  };
}

function simulateRegulatory(input, context) {
  const days = clamp(value(input, 'implementationDays', 30), 0, 730);
  const processes = clamp(value(input, 'affectedProcesses', context?.regulatory?.affected_areas?.length || 5), 0, 100);
  const systems = clamp(value(input, 'affectedSystems', 3), 0, 100);
  const readiness = clamp(value(input, 'currentReadiness', 40));
  const score = clamp(processes * 4 + systems * 3 + Math.max(0, 90 - days) * 0.45 - readiness * 0.45);
  return {
    score,
    metrics: [
      ['Implementation window', `${days} days`],
      ['Affected processes', processes],
      ['Affected systems', systems],
      ['Current readiness', `${readiness}/100`]
    ],
    findings: [
      days < 45 ? 'The implementation window is compressed.' : 'The implementation window allows staged remediation if ownership begins promptly.',
      readiness < 50 ? 'Existing readiness is below the prototype control threshold.' : 'Readiness is moderate, but evidence and closure governance remain necessary.'
    ],
    actions: [
      action('Immediate', 'Compliance / Legal', 'Confirm applicability, effective date, obligation wording and source authority.'),
      action('Immediate', 'Transformation Office', 'Map affected policies, controls, systems, contracts, reports and owners.'),
      action('Next', 'Business and Technology Owners', 'Implement changes with evidence and exception tracking.'),
      action('Closure', 'Management / Board Committee', 'Approve residual risk and regulator-ready closure pack.')
    ]
  };
}

function simulateContract(input) {
  const annualValue = Math.max(0, value(input, 'annualValue', 10000000));
  const downtimeDays = clamp(value(input, 'downtimeDays', 3), 0, 365);
  const liabilityCap = Math.max(0, value(input, 'liabilityCapPercent', 100));
  const replacementDays = clamp(value(input, 'replacementDays', 45), 0, 730);
  const criticality = clamp(value(input, 'criticality', 70));
  const estimatedExposure = round(annualValue * (criticality / 100) * (1 + downtimeDays / 30));
  const recoverable = round(annualValue * liabilityCap / 100);
  const score = clamp(criticality * 0.65 + downtimeDays * 2 + replacementDays * 0.45 + Math.max(0, 100 - liabilityCap) * 0.35);
  return {
    score,
    metrics: [
      ['Annual contract value', annualValue.toLocaleString('en-IN')],
      ['Modelled operational exposure', estimatedExposure.toLocaleString('en-IN')],
      ['Contractual cap proxy', recoverable.toLocaleString('en-IN')],
      ['Replacement period', `${replacementDays} days`]
    ],
    findings: [
      recoverable < estimatedExposure ? 'The modelled loss exceeds the supplied contractual cap proxy.' : 'The supplied cap proxy may cover the modelled exposure, subject to exclusions and enforceability.',
      replacementDays > 60 ? 'Exit and substitution time creates material continuity risk.' : 'Replacement timing is manageable only if transition controls are operational.'
    ],
    actions: [
      action('Immediate', 'Business / Operations', 'Quantify actual service impact, dependencies and continuity options.'),
      action('Immediate', 'Legal / Procurement', 'Assess SLA credits, indemnity, cap exclusions, audit, suspension, termination and transition rights.'),
      action('Next', 'Risk / Management', 'Approve remediation, claim, replacement or risk acceptance.')
    ]
  };
}

function simulateLitigation(input) {
  const claim = Math.max(0, value(input, 'claimAmount', 50000000));
  const probability = clamp(value(input, 'adverseProbability', 35));
  const legalCost = Math.max(0, value(input, 'legalCost', claim * 0.05));
  const reputation = clamp(value(input, 'reputationImpact', 50));
  const expectedLoss = round(claim * probability / 100 + legalCost);
  const score = clamp(probability * 0.75 + reputation * 0.45 + Math.min(25, Math.log10(Math.max(10, claim)) * 2.2));
  return {
    score,
    metrics: [
      ['Claim or exposure', claim.toLocaleString('en-IN')],
      ['Adverse probability', `${probability}%`],
      ['Expected financial loss', expectedLoss.toLocaleString('en-IN')],
      ['Reputation impact', `${reputation}/100`]
    ],
    findings: [
      probability > 50 ? 'Adverse outcome probability is material under the supplied assumption.' : 'The financial exposure is scenario-sensitive and should not be treated as a legal conclusion.',
      'Privilege, evidence preservation and authority limits are critical control points.'
    ],
    actions: [
      action('Immediate', 'Legal', 'Preserve privilege, evidence, chronology, key issues and procedural deadlines.'),
      action('Immediate', 'Finance / Risk', 'Validate provisioning, insurance and scenario exposure.'),
      action('Next', 'Authorised Settlement Committee', 'Assess defence, settlement and business-resolution options.')
    ]
  };
}

function simulateProduct(input) {
  const readiness = clamp(value(input, 'readiness', 45));
  const dependencies = clamp(value(input, 'criticalDependencies', 8), 0, 100);
  const unresolved = clamp(value(input, 'unresolvedRisks', 6), 0, 100);
  const days = clamp(value(input, 'daysToLaunch', 30), 0, 730);
  const score = clamp((100 - readiness) * 0.55 + dependencies * 2.3 + unresolved * 3 + Math.max(0, 45 - days) * 0.7);
  return {
    score,
    metrics: [
      ['Readiness', `${readiness}/100`],
      ['Critical dependencies', dependencies],
      ['Unresolved risks', unresolved],
      ['Days to launch', days]
    ],
    findings: [
      readiness < 60 ? 'The product is below the prototype launch-readiness threshold.' : 'The launch may be feasible subject to formal approval and closure evidence.',
      unresolved > 4 ? 'Unresolved risks are too numerous for uncontrolled launch.' : 'Residual risks are limited but require accountable ownership.'
    ],
    actions: [
      action('Immediate', 'Product Owner', 'Create a single launch control room with dependencies, owners and evidence.'),
      action('Immediate', 'Risk / Compliance / Legal', 'Complete product, customer, regulatory, contractual and conduct assessments.'),
      action('Next', 'Technology / Operations', 'Validate end-to-end controls, resilience, support and rollback.'),
      action('Gate', 'Launch Authority', 'Approve launch, conditional launch or deferral based on closed evidence.')
    ]
  };
}

export function runSimulation(payload = {}) {
  const type = SCENARIOS[payload.type] ? payload.type : 'regulatory';
  const input = payload.input || {};
  const context = payload.context || {};
  const engines = {
    liquidity: simulateLiquidity,
    market: simulateMarket,
    counterparty: simulateCounterparty,
    cyber: simulateCyber,
    regulatory: simulateRegulatory,
    contract: simulateContract,
    litigation: simulateLitigation,
    product: simulateProduct
  };
  const result = engines[type](input, context);
  const scenario = SCENARIOS[type];
  return {
    id: crypto.randomUUID(),
    type,
    title: scenario.label,
    institutionType: text(payload, 'institutionType', 'Regulated enterprise'),
    generatedAt: new Date().toISOString(),
    engine: 'synesis-simulation-engine-v1',
    riskScore: round(result.score),
    riskLevel: risk(result.score),
    metrics: result.metrics,
    findings: result.findings,
    owners: scenario.owners,
    approvalGates: scenario.approvals,
    actions: result.actions,
    decisionPosition: result.score >= 75 ? 'Do not proceed without executive intervention and verified controls.' : result.score >= 55 ? 'Proceed only under a formal remediation and approval plan.' : result.score >= 30 ? 'Proceed with controlled mitigation and accountable monitoring.' : 'Scenario is manageable under the supplied assumptions, subject to validation.',
    evidenceBoundary: [
      'Inputs are user-supplied or derived from the active uploaded prototype context.',
      'Calculations are transparent scenario estimates, not market prices, legal opinions or regulatory certification.',
      'No trade, filing, notification, payment, contract action or customer communication has been executed.'
    ]
  };
}
