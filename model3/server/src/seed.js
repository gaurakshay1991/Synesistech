export const seedState = {
  schemaVersion: 5,
  product: {
    name: 'Synesis',
    edition: 'Live Neuro-Symbolic Legal Intelligence Platform',
    operatingPrinciple: 'Evidence before inference; rules before autonomous action; accountable human approval for material decisions.',
    disclaimer: 'Synesis is decision-support software. It does not replace authorised legal advice, regulatory verification or accountable human judgment.'
  },
  metrics: {
    attention: 12,
    critical: 3,
    overdue: 2,
    decisionsPending: 7,
    controlsAtRisk: 5,
    evidenceCoverage: 81,
    averageCycleDays: 4.6,
    preventedExposure: 184000000,
    regulatoryUpdatesOpen: 4,
    clauseMemoryCoverage: 74,
    governanceReadiness: 68,
    simulationCount: 4,
    liveSources: 0,
    liveChanges24h: 0
  },
  alerts: [
    { id: 'a1', severity: 'Critical', title: 'RBI outsourcing change affects 14 controls', owner: 'Compliance', due: '2026-08-15', why: 'Effective-date gap and vendor audit-right mismatch', next: 'Approve impact plan' },
    { id: 'a2', severity: 'High', title: 'Crypto-key custody exception remains unresolved', owner: 'Cyber / Legal', due: '2026-08-10', why: 'Third party can sign messages using bank material', next: 'Select compensating controls' },
    { id: 'a3', severity: 'High', title: 'Three contracts lack immediate sanctions termination', owner: 'Legal', due: '2026-08-20', why: 'Exposure may continue during an enforcement event', next: 'Launch remediation pack' },
    { id: 'a4', severity: 'Medium', title: 'Two delegated authorities require renewal', owner: 'Governance', due: '2026-08-29', why: 'Execution authority may lapse', next: 'Route renewal approvals' }
  ],
  obligations: [
    { id: 'o1', title: 'Complete critical-vendor exit testing', type: 'Regulatory', source: 'RBI outsourcing programme', sourceRef: 'Exit strategy / concentration risk', owner: 'Operational Risk', due: '2026-09-15', status: 'At risk', risk: 'Critical', evidence: 42, controls: ['C-OPR-18', 'C-BCP-07'] },
    { id: 'o2', title: 'Revoke cryptographic material on vendor incident', type: 'Cyber', source: 'Payments control addendum', sourceRef: 'Key revocation and incident response', owner: 'CISO', due: 'Event driven', status: 'Active', risk: 'High', evidence: 75, controls: ['C-CYB-22'] },
    { id: 'o3', title: 'Verify LRS and purpose-code reporting', type: 'FEMA / Operations', source: 'Travel remittance operating standard', sourceRef: 'Reporting and records', owner: 'Remittances', due: 'Daily', status: 'Active', risk: 'High', evidence: 88, controls: ['C-FX-05', 'C-AML-11'] },
    { id: 'o4', title: 'Maintain processing and deletion evidence', type: 'Privacy', source: 'Data protection control standard', sourceRef: 'Retention and erasure', owner: 'DPO', due: 'Continuous', status: 'Gap', risk: 'High', evidence: 54, controls: ['C-DP-09'] },
    { id: 'o5', title: 'Renew signatory delegation', type: 'Governance', source: 'Board delegation matrix', sourceRef: 'Authorised execution', owner: 'Company Secretariat', due: '2026-08-29', status: 'In progress', risk: 'Medium', evidence: 64, controls: ['C-GOV-02'] }
  ],
  impacts: [
    { id: 'i1', title: 'Digital personal data implementation programme', source: 'Verified regulatory source pack required', effectiveDate: 'To be confirmed', severity: 'Critical', status: 'Assessment', affected: { documents: 42, controls: 18, products: 7, vendors: 26, systems: 11, teams: 9 }, confidence: 78 },
    { id: 'i2', title: 'Outsourcing and third-party concentration expectations', source: 'RBI / internal policy mapping', effectiveDate: 'To be confirmed', severity: 'High', status: 'Remediation', affected: { documents: 19, controls: 14, products: 4, vendors: 8, systems: 6, teams: 7 }, confidence: 87 },
    { id: 'i3', title: 'Beneficiary-name validation operating change', source: 'Payments control programme', effectiveDate: 'To be confirmed', severity: 'High', status: 'Approval', affected: { documents: 6, controls: 9, products: 3, vendors: 2, systems: 5, teams: 6 }, confidence: 94 }
  ],
  decisions: [
    { id: 'd1', title: 'Permit vendor use of cryptographic material?', matter: 'Payments technology service', risk: 'Critical', status: 'Challenge', owner: 'Risk Committee', due: '2026-08-12', rationale: 'Proceed only with hardware-backed storage, bank-controlled revocation, immutable logging and an incident kill switch.', approvals: [{ role: 'Legal', status: 'Approved' }, { role: 'Cyber', status: 'Conditional' }, { role: 'Risk', status: 'Pending' }] },
    { id: 'd2', title: 'Pause new transactions pending enhanced assurance?', matter: 'Partner event review', risk: 'High', status: 'Pending', owner: 'Compliance', due: '2026-08-13', rationale: 'Use risk-based enhanced monitoring while contractual information and regulatory assurance are obtained.', approvals: [{ role: 'Legal', status: 'Approved' }, { role: 'Compliance', status: 'Pending' }] },
    { id: 'd3', title: 'Adopt technology-only operating model?', matter: 'Deposit technology partnership', risk: 'High', status: 'Pending', owner: 'Business / Compliance', due: '2026-08-15', rationale: 'Restrict the provider to technology and support services; retain all regulated activity, discretion and customer responsibility with the regulated entity.', approvals: [{ role: 'Business', status: 'Approved' }, { role: 'Compliance', status: 'Pending' }] }
  ],
  tasks: [
    { id: 't1', title: 'Map affected outsourcing controls', owner: 'Operational Risk', due: '2026-08-15', status: 'In progress', priority: 'Critical', blocker: 'Two control owners unconfirmed', decisionId: 'd1', evidenceRequired: ['Updated control mapping', 'Owner acceptance'] },
    { id: 't2', title: 'Prepare enhanced assurance request', owner: 'Legal', due: '2026-08-12', status: 'Ready', priority: 'High', blocker: '', decisionId: 'd2', evidenceRequired: ['Signed response', 'Board or management confirmation'] },
    { id: 't3', title: 'Draft technology-only operating model', owner: 'Legal / Compliance', due: '2026-08-14', status: 'In progress', priority: 'High', blocker: 'Compliance classification', decisionId: 'd3', evidenceRequired: ['Approved process map', 'RACI', 'Customer journey'] },
    { id: 't4', title: 'Validate deletion evidence', owner: 'DPO / IT', due: '2026-08-22', status: 'Not started', priority: 'High', blocker: 'System inventory incomplete', evidenceRequired: ['Deletion logs', 'Retention schedule', 'Exception register'] }
  ],
  controls: [
    { id: 'C-CYB-22', name: 'Third-party cryptographic material control', status: 'At risk', effectiveness: 58, owner: 'CISO', linkedObligations: 1 },
    { id: 'C-OPR-18', name: 'Critical vendor exit and substitution', status: 'At risk', effectiveness: 49, owner: 'Operational Risk', linkedObligations: 3 },
    { id: 'C-DP-09', name: 'Retention, erasure and deletion evidence', status: 'Gap', effectiveness: 44, owner: 'DPO', linkedObligations: 5 },
    { id: 'C-FX-05', name: 'Purpose and remittance reporting', status: 'Effective', effectiveness: 91, owner: 'Operations', linkedObligations: 4 },
    { id: 'C-GOV-02', name: 'Authority and delegation validity', status: 'Attention', effectiveness: 72, owner: 'Governance', linkedObligations: 2 }
  ],
  evidence: [
    { id: 'e1', title: 'Key-rotation test log', entity: 'C-CYB-22', status: 'Verified', verifiedBy: 'Cyber Assurance', date: '2026-07-18' },
    { id: 'e2', title: 'Vendor exit simulation report', entity: 'C-OPR-18', status: 'Rejected', verifiedBy: 'Operational Risk', date: '2026-07-17' },
    { id: 'e3', title: 'Daily return reconciliation', entity: 'C-FX-05', status: 'Verified', verifiedBy: 'Operations Control', date: '2026-07-20' }
  ],
  memories: [
    { id: 'm1', title: 'Prior approval of vendor-held certificate', date: '2025-11-12', outcome: 'Approved with controls', lesson: 'Contractual restrictions were insufficient without bank-controlled revocation telemetry.', similarity: 94 },
    { id: 'm2', title: 'Partner enforcement-event review', date: '2026-02-08', outcome: 'Enhanced monitoring', lesson: 'Immediate suspension was disproportionate; assurance rights and transaction caps reduced exposure.', similarity: 86 },
    { id: 'm3', title: 'Technology provider versus regulated intermediary classification', date: '2025-09-19', outcome: 'Technology-only model', lesson: 'Customer solicitation, discretion and transaction execution must remain with the regulated entity.', similarity: 82 }
  ],
  liveBrain: {
    status: 'Configured — awaiting first autonomous sync',
    lastSyncAt: null,
    lastDetectedCount: 0,
    monitoredBackgroundSources: 0,
    queryTimeSources: 0,
    watchedUrls: 0,
    isolationPolicy: 'Every document live-analysis run is isolated from every other document and matter.'
  },
  liveWatchlist: [],
  sources: [
    { id: 's1', name: 'Reserve Bank of India', jurisdiction: 'India', type: 'Authoritative source registry', status: 'Configured — manual verification', lastChecked: null },
    { id: 's2', name: 'Securities and Exchange Board of India', jurisdiction: 'India', type: 'Authoritative source registry', status: 'Configured — manual verification', lastChecked: null },
    { id: 's3', name: 'Indian data protection sources', jurisdiction: 'India', type: 'Authoritative source registry', status: 'Configured — manual verification', lastChecked: null },
    { id: 's4', name: 'European Union legal sources', jurisdiction: 'European Union', type: 'Authoritative source registry', status: 'Configured — manual verification', lastChecked: null },
    { id: 's5', name: 'Internal policy and control library', jurisdiction: 'Enterprise', type: 'Controlled internal', status: 'Active', lastChecked: '2026-08-06T00:00:00Z' }
  ],
  regulatoryUpdates: [
    { id: 'ru1', title: 'Outsourcing control update — sample assessment', regulator: 'RBI', jurisdiction: 'India', publishedDate: 'Unverified', effectiveDate: 'To be confirmed', status: 'Source verification required', severity: 'Critical', domains: ['Banking', 'Third-party risk', 'Operational resilience'], summary: 'Demonstration record for mapping a regulatory change to contracts, controls, systems and owners.', sourceReference: '', affectedClauseTypes: ['Audit rights', 'Subcontracting', 'Exit assistance', 'Data location'], mappedItems: 47, confidence: 55, owner: 'Compliance' },
    { id: 'ru2', title: 'Data protection implementation change — sample assessment', regulator: 'Competent authority', jurisdiction: 'India', publishedDate: 'Unverified', effectiveDate: 'To be confirmed', status: 'Source verification required', severity: 'High', domains: ['Privacy', 'Data governance'], summary: 'Demonstration record for retention, deletion, notice, processor and cross-border mapping.', sourceReference: '', affectedClauseTypes: ['Processing instructions', 'Incident notice', 'Deletion', 'International transfer'], mappedItems: 63, confidence: 50, owner: 'Privacy' },
    { id: 'ru3', title: 'AI governance requirement — sample assessment', regulator: 'EU institutions', jurisdiction: 'European Union', publishedDate: 'Unverified', effectiveDate: 'To be confirmed', status: 'Source verification required', severity: 'High', domains: ['AI governance', 'Technology procurement'], summary: 'Demonstration record for risk classification, transparency, human oversight and supplier assurance mapping.', sourceReference: '', affectedClauseTypes: ['AI use restriction', 'Model transparency', 'Human oversight', 'Audit evidence'], mappedItems: 28, confidence: 50, owner: 'AI Governance' }
  ],
  clauseMemory: {
    coverage: 74,
    archetypes: [
      { id: 'cm-liability', name: 'Limitation of liability', category: 'Risk allocation', preferredPosition: 'Mutual, calibrated aggregate cap with narrow justified carve-outs', riskSignals: ['Unlimited liability', 'Consequential loss exposure', 'Cap exclusions that swallow the cap'], acceptedVariants: 12, challengedVariants: 8, outcomeConfidence: 88 },
      { id: 'cm-indemnity', name: 'Indemnity', category: 'Risk allocation', preferredPosition: 'Defined third-party claims, causation, defence control, mitigation and no double recovery', riskSignals: ['First-party loss indemnity', 'Uncontrolled settlement', 'No causation threshold'], acceptedVariants: 9, challengedVariants: 11, outcomeConfidence: 84 },
      { id: 'cm-data', name: 'Data protection and security', category: 'Regulatory', preferredPosition: 'Purpose limitation, security controls, rapid notice, audit, deletion and subprocessor governance', riskSignals: ['Unrestricted use', 'No incident deadline', 'No deletion evidence'], acceptedVariants: 18, challengedVariants: 7, outcomeConfidence: 91 },
      { id: 'cm-exit', name: 'Termination and exit assistance', category: 'Operational resilience', preferredPosition: 'Immediate regulatory exit rights plus orderly transition, portability and deletion evidence', riskSignals: ['Termination lock-in', 'No transition assistance', 'Vendor-controlled data export'], acceptedVariants: 10, challengedVariants: 6, outcomeConfidence: 86 },
      { id: 'cm-ai', name: 'AI use and model governance', category: 'Emerging technology', preferredPosition: 'Declared use, approved models, no training on confidential data, human oversight and auditability', riskSignals: ['Silent AI processing', 'Training on customer data', 'Unverified automated decisions'], acceptedVariants: 4, challengedVariants: 5, outcomeConfidence: 66 }
    ],
    edges: [
      ['cm-data', 'ru2', 'governed by'], ['cm-ai', 'ru3', 'governed by'], ['cm-exit', 'ru1', 'impacted by'], ['cm-liability', 'cm-indemnity', 'interacts with'], ['cm-data', 'cm-liability', 'risk allocation depends on']
    ],
    feedbackEvents: [
      { id: 'fb1', clauseId: 'cm-data', action: 'Accepted with edit', lesson: 'A fixed notice period alone was insufficient; continuous updates and regulator cooperation were retained.', recordedAt: '2026-07-25', source: 'Controlled demonstration data' },
      { id: 'fb2', clauseId: 'cm-liability', action: 'Rejected', lesson: 'The proposed carve-outs made the negotiated cap commercially ineffective.', recordedAt: '2026-07-28', source: 'Controlled demonstration data' }
    ]
  },
  litigationSimulations: [
    { id: 'ls1', name: 'Uncapped vendor liability dispute', clauseType: 'Limitation of liability', jurisdiction: 'India', event: 'Service failure causes regulatory and customer loss', probability: 34, enforceability: 58, exposure: 75000000, confidence: 46, status: 'Illustrative — not legal prediction', keyDrivers: ['Clause wording', 'Causation evidence', 'Exclusions', 'Mitigation conduct'], recommendation: 'Negotiate a defensible cap structure and preserve evidence of loss, causation and mitigation.' },
    { id: 'ls2', name: 'Data breach notification failure', clauseType: 'Data protection', jurisdiction: 'Multi-jurisdiction', event: 'Vendor delays incident notification', probability: 28, enforceability: 76, exposure: 40000000, confidence: 52, status: 'Illustrative — not legal prediction', keyDrivers: ['Notice deadline', 'Regulatory duties', 'Forensic access', 'Customer remediation'], recommendation: 'Use immediate notice, a maximum deadline, continuing updates and cost allocation.' }
  ],
  governanceFrameworks: [
    { id: 'gf-ai', name: 'AI Governance', domain: 'Cross-border AI', readiness: 62, status: 'Attention', controls: ['Use-case inventory', 'Risk classification', 'Human oversight', 'Model and prompt register', 'Evaluation evidence', 'Supplier controls', 'Incident response'], gaps: ['Independent model validation', 'Cross-jurisdiction applicability record'] },
    { id: 'gf-esg', name: 'ESG Contract Governance', domain: 'ESG', readiness: 58, status: 'At risk', controls: ['Supplier standards', 'Audit rights', 'Remediation plan', 'Termination rights', 'Disclosure evidence'], gaps: ['Scope 3 evidence linkage', 'Jurisdiction-specific clause library'] },
    { id: 'gf-privacy', name: 'Privacy and Data Governance', domain: 'Data protection', readiness: 71, status: 'Attention', controls: ['Processing register', 'Purpose limitation', 'Incident management', 'Retention and deletion', 'Transfer governance'], gaps: ['Deletion evidence automation'] },
    { id: 'gf-modelrisk', name: 'Model Risk Management', domain: 'AI assurance', readiness: 64, status: 'Attention', controls: ['Model inventory', 'Version control', 'Testing', 'Human approval', 'Fallback disclosure', 'Monitoring'], gaps: ['Production drift telemetry', 'Formal validation sign-off'] }
  ],
  graph: {
    nodes: [
      { id: 'bank', label: 'Institution', type: 'Organisation', risk: 'Low' },
      { id: 'product1', label: 'Cross-border remittance', type: 'Product', risk: 'High' },
      { id: 'vendor1', label: 'Payment technology vendor', type: 'Third party', risk: 'Critical' },
      { id: 'reg1', label: 'Outsourcing obligation', type: 'Obligation', risk: 'Critical' },
      { id: 'control1', label: 'Vendor exit control', type: 'Control', risk: 'High' },
      { id: 'decision1', label: 'Cryptographic custody decision', type: 'Decision', risk: 'Critical' },
      { id: 'evidence1', label: 'Exit simulation evidence', type: 'Evidence', risk: 'High' }
    ],
    edges: [
      ['bank', 'product1', 'operates'], ['product1', 'vendor1', 'depends on'], ['reg1', 'product1', 'governs'], ['reg1', 'control1', 'requires'], ['control1', 'decision1', 'gates'], ['decision1', 'vendor1', 'permits or restricts'], ['evidence1', 'control1', 'proves']
    ]
  },
  packs: [
    { id: 'p1', name: 'Contract Command', description: 'Clause review, negotiation, obligations, renewals and value assurance', maturity: 84 },
    { id: 'p2', name: 'Regulatory Command', description: 'Source change, impact mapping, remediation and regulator-ready evidence', maturity: 78 },
    { id: 'p3', name: 'Clause Memory Graph', description: 'Clause archetypes, variants, outcomes, feedback and regulatory relationships', maturity: 72 },
    { id: 'p4', name: 'Litigation Simulation', description: 'Scenario-based enforceability, exposure and response planning with explicit uncertainty', maturity: 54 },
    { id: 'p5', name: 'ESG & AI Governance', description: 'Cross-border governance controls, gaps, obligations and assurance', maturity: 61 },
    { id: 'p6', name: 'Governance & Authority', description: 'Entities, signatories, delegations and board approvals', maturity: 64 },
    { id: 'p7', name: 'Transactions & Diligence', description: 'Issue lists, approvals, CPs, closing and post-closing obligations', maturity: 57 },
    { id: 'p8', name: 'Investigations & Disputes', description: 'Chronology, evidence graph, privilege and settlement scenarios', maturity: 48 }
  ],
  simulations: [
    { id: 'sim1', name: 'Critical vendor failure', probability: 32, impact: 91, readiness: 47, recommendation: 'Complete exit test, validate an alternate provider and pre-approve customer communications.' },
    { id: 'sim2', name: 'Regulatory effective date accelerated by 90 days', probability: 18, impact: 84, readiness: 61, recommendation: 'Prioritise high-risk controls and freeze non-essential change demand.' }
  ],
  businessModel: {
    primary: 'Enterprise SaaS subscription',
    revenueStreams: [
      { name: 'SaaS', model: 'Tiered annual subscription by users, document volume and modules', status: 'Productised' },
      { name: 'API', model: 'Usage-based clause, risk, regulatory and graph intelligence endpoints', status: 'Architecture ready; commercial API not yet exposed' },
      { name: 'Private deployment', model: 'Dedicated private cloud or on-premises licence with maintenance', status: 'Container-ready; enterprise hardening required' },
      { name: 'Professional services', model: 'Onboarding, playbook authoring, integrations and assurance support', status: 'Planned' }
    ],
    pricingAssumptions: [
      { tier: 'Team', annualInr: 1200000, scope: 'Core contract intelligence and controlled regulatory workspace' },
      { tier: 'Professional', annualInr: 3600000, scope: 'Regulatory, clause memory, simulations and custom playbooks' },
      { tier: 'Enterprise', annualInr: 10000000, scope: 'Private deployment options, integrations, advanced governance and support' }
    ]
  },
  financialScenario: {
    label: 'Illustrative management scenario — not a forecast or investment representation',
    years: [
      { year: 1, revenueCr: 1, operatingCostCr: 4, cashFlowCr: -3, grossMargin: 60, enterpriseClients: 2, midMarketClients: 5 },
      { year: 2, revenueCr: 5, operatingCostCr: 8, cashFlowCr: -3, grossMargin: 70, enterpriseClients: 5, midMarketClients: 20 },
      { year: 3, revenueCr: 20, operatingCostCr: 15, cashFlowCr: 5, grossMargin: 80, enterpriseClients: 15, midMarketClients: 50 },
      { year: 4, revenueCr: 50, operatingCostCr: 30, cashFlowCr: 20, grossMargin: 85, enterpriseClients: 40, midMarketClients: 120 },
      { year: 5, revenueCr: 100, operatingCostCr: 60, cashFlowCr: 40, grossMargin: 90, enterpriseClients: 80, midMarketClients: 250 }
    ],
    seedAskCr: 16,
    valuationCapCr: 80,
    discountPercent: 20,
    useOfFunds: [
      { category: 'Product and R&D', percent: 50 },
      { category: 'Sales and marketing', percent: 25 },
      { category: 'Compliance, certifications and IP', percent: 12.5 },
      { category: 'General and administrative', percent: 12.5 }
    ]
  },
  ipPortfolio: [
    { id: 'ip1', invention: 'Hybrid neuro-symbolic clause risk scoring', protection: 'Patent candidate', status: 'Concept register — counsel review required', noveltyFocus: 'Reconciliation of neural evidence with deterministic legal rules and traceable scoring' },
    { id: 'ip2', invention: 'Clause Memory Graph and feedback propagation', protection: 'Patent candidate plus trade secret', status: 'Concept register — counsel review required', noveltyFocus: 'Graph-based clause equivalence, outcome memory and controlled propagation of regulatory changes' },
    { id: 'ip3', invention: 'Regulatory text-to-contract mapping', protection: 'Patent candidate', status: 'Concept register — counsel review required', noveltyFocus: 'Conversion of verified regulatory propositions into clause, control and obligation mappings' },
    { id: 'ip4', invention: 'Governed clause rewrite learning loop', protection: 'Patent candidate plus trade secret', status: 'Concept register — counsel review required', noveltyFocus: 'Human feedback captured without silently changing approved legal positions' },
    { id: 'ip5', invention: 'Clause-level litigation simulation', protection: 'Patent candidate', status: 'Research concept — validation required', noveltyFocus: 'Evidence-weighted scenario modelling with explicit jurisdictional and confidence limits' }
  ],
  roadmap: [
    { phase: 'Phase 1', horizon: '0–3 months', name: 'Clause intelligence MVP', deliverables: ['Document ingestion', 'Clause classification', 'Rule trace', 'Risk score', 'Suggested language'], status: 'Built' },
    { phase: 'Phase 2', horizon: '4–9 months', name: 'Neuro-symbolic expansion', deliverables: ['Clause ontology', 'Memory graph', 'Advanced playbooks', 'Feedback governance'], status: 'In progress' },
    { phase: 'Phase 3', horizon: '6–12 months', name: 'Regulatory intelligence', deliverables: ['Authorised connectors', 'Source verification workflow', 'Impact propagation', 'Alerts'], status: 'Prototype' },
    { phase: 'Phase 4', horizon: '9–15 months', name: 'Rewrite and learning loop', deliverables: ['Controlled rewrite suggestions', 'Acceptance analytics', 'Model evaluation', 'Versioned legal positions'], status: 'Prototype' },
    { phase: 'Phase 5', horizon: '12–18 months', name: 'Enterprise scale', deliverables: ['SSO and MFA', 'Private deployment', 'Enterprise APIs', 'SOC 2 / ISO programme', 'Pen test and DR'], status: 'Planned' }
  ],
  deliveryModes: [
    { name: 'Multi-tenant SaaS', readiness: 70, controls: ['Organisation-scoped data', 'RBAC', 'Encryption', 'Audit trail'], gaps: ['SSO/MFA', 'Formal tenant penetration testing'] },
    { name: 'Dedicated private cloud', readiness: 55, controls: ['Container packaging', 'External database', 'Environment separation'], gaps: ['Automated provisioning', 'Customer-managed keys'] },
    { name: 'On-premises', readiness: 42, controls: ['Docker packaging', 'Offline-capable fallback'], gaps: ['Kubernetes charts', 'Offline model serving', 'Signed update packs'] },
    { name: 'API platform', readiness: 48, controls: ['Internal JSON APIs', 'Role enforcement', 'Rate limiting'], gaps: ['External API gateway', 'API keys', 'Usage metering', 'Developer documentation'] }
  ],
  verticals: [
    { name: 'Banking and financial services', capabilities: ['RBI/SEBI mapping', 'Outsourcing', 'AML/FEMA', 'Vendor and credit documentation'], readiness: 82 },
    { name: 'Venture capital and private equity', capabilities: ['Term sheet risk', 'Due diligence', 'Exit scenarios', 'Portfolio compliance'], readiness: 58 },
    { name: 'ESG and sustainable finance', capabilities: ['Supplier clauses', 'Green finance obligations', 'Evidence and reporting controls'], readiness: 54 },
    { name: 'Corporate legal and compliance', capabilities: ['Contract review', 'Regulatory change', 'Playbooks', 'Approvals and evidence'], readiness: 80 }
  ],
  investorReadiness: {
    verifiedClaimsOnly: true,
    claimRegister: [
      { claim: 'Founder qualifications and employment history', status: 'Do not publish until documentary evidence is verified' },
      { claim: 'Clients, pilots, LOIs and pipeline', status: 'Do not publish until signed evidence and disclosure permission exist' },
      { claim: 'Accuracy percentages and contracts processed', status: 'Do not publish until reproducible evaluation data exists' },
      { claim: 'Awards, accelerators, media and patents filed', status: 'Do not publish until independently verifiable' },
      { claim: 'Incorporation, CIN, DPIIT and registered office', status: 'Do not publish until official records are supplied' }
    ],
    safeMaterials: ['Product architecture', 'Demonstrated capabilities', 'Clearly labelled financial scenarios', 'Risk and limitation disclosures', 'Roadmap and use-of-funds assumptions']
  }
};
