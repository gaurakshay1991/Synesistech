export const seedState = {
  metrics: { attention: 8, critical: 2, overdue: 1, decisionsPending: 3, controlsAtRisk: 3, evidenceCoverage: 78, averageCycleDays: 4.6, preventedExposure: 184000000 },
  alerts: [
    { id:'a1', severity:'Critical', title:'Outsourcing change affects critical controls', owner:'Compliance', due:'2026-07-23', why:'Effective-date and vendor-right gaps require a governed response.', next:'Approve impact plan' },
    { id:'a2', severity:'High', title:'Cryptographic custody exception unresolved', owner:'Cyber / Legal', due:'2026-07-22', why:'A third party may sign using bank-controlled material.', next:'Select controls' },
    { id:'a3', severity:'High', title:'Contracts lack immediate sanctions response rights', owner:'Legal', due:'2026-07-26', why:'Exposure may continue during an enforcement event.', next:'Launch remediation' }
  ],
  obligations: [
    { id:'o1', title:'Complete critical-vendor exit testing', type:'Regulatory', source:'RBI outsourcing programme', sourceRef:'Exit strategy', owner:'Operational Risk', due:'2026-08-15', status:'At risk', risk:'Critical', evidence:42, controls:['C-OPR-18'] },
    { id:'o2', title:'Revoke cryptographic material on incident', type:'Cyber', source:'Payments addendum', sourceRef:'Revocation and incident response', owner:'CISO', due:'Event driven', status:'Active', risk:'High', evidence:75, controls:['C-CYB-22'] },
    { id:'o3', title:'Maintain retention and deletion evidence', type:'Privacy', source:'DPDP control standard', sourceRef:'Retention and erasure', owner:'DPO', due:'Continuous', status:'Gap', risk:'High', evidence:54, controls:['C-DP-09'] }
  ],
  impacts: [
    { id:'i1', title:'Digital personal-data implementation phase', source:'India privacy programme', effectiveDate:'2027-05-13', severity:'Critical', status:'Assessment', affected:{ documents:42, controls:18, products:7, vendors:26, systems:11, teams:9 }, confidence:91 },
    { id:'i2', title:'Outsourcing and concentration expectations', source:'RBI / internal policy', effectiveDate:'2026-09-01', severity:'High', status:'Remediation', affected:{ documents:19, controls:14, products:4, vendors:8, systems:6, teams:7 }, confidence:87 }
  ],
  decisions: [
    { id:'d1', title:'Permit vendor use of cryptographic material?', matter:'Payments service', risk:'Critical', status:'Challenge', owner:'Risk Committee', due:'2026-07-22', rationale:'Proceed only with bank-controlled revocation, immutable logging and an incident kill switch.', approvals:[{ role:'Legal', status:'Approved' },{ role:'Cyber', status:'Conditional' },{ role:'Risk', status:'Pending' }] },
    { id:'d2', title:'Pause new partner transactions pending assurance?', matter:'Counterparty-event review', risk:'High', status:'Pending', owner:'Compliance', due:'2026-07-23', rationale:'Use risk-based enhanced monitoring while contractual and regulatory assurance is obtained.', approvals:[{ role:'Legal', status:'Approved' },{ role:'Compliance', status:'Pending' }] }
  ],
  tasks: [
    { id:'t1', title:'Map affected outsourcing controls', owner:'Operational Risk', due:'2026-07-23', status:'In progress', priority:'Critical', blocker:'Two control owners unconfirmed', evidenceRequired:['Updated mapping','Owner acceptance'] },
    { id:'t2', title:'Prepare enhanced assurance request', owner:'Legal', due:'2026-07-22', status:'Ready', priority:'High', blocker:'', evidenceRequired:['Signed response','Management confirmation'] },
    { id:'t3', title:'Validate deletion evidence', owner:'DPO / IT', due:'2026-08-02', status:'Not started', priority:'High', blocker:'System inventory incomplete', evidenceRequired:['Deletion logs','Retention schedule'] }
  ],
  controls: [
    { id:'C-CYB-22', name:'Third-party cryptographic material control', status:'At risk', effectiveness:58, owner:'CISO', linkedObligations:1 },
    { id:'C-OPR-18', name:'Critical vendor exit and substitution', status:'At risk', effectiveness:49, owner:'Operational Risk', linkedObligations:3 },
    { id:'C-DP-09', name:'Retention, erasure and deletion evidence', status:'Gap', effectiveness:44, owner:'DPO', linkedObligations:5 }
  ],
  evidence: [
    { id:'e1', title:'Key-rotation test log', entity:'C-CYB-22', status:'Verified', verifiedBy:'Cyber Assurance', date:'2026-07-18' },
    { id:'e2', title:'Vendor exit simulation report', entity:'C-OPR-18', status:'Rejected', verifiedBy:'Operational Risk', date:'2026-07-17' }
  ],
  memories: [
    { id:'m1', title:'Prior vendor-held certificate decision', date:'2025-11-12', outcome:'Approved with controls', lesson:'Contract wording was insufficient without revocation telemetry.', similarity:94 },
    { id:'m2', title:'Partner enforcement-event review', date:'2026-02-08', outcome:'Enhanced monitoring', lesson:'Assurance rights and transaction caps reduced exposure.', similarity:86 }
  ],
  sources: [
    { id:'s1', name:'Reserve Bank of India', jurisdiction:'India', type:'Authoritative', status:'Active', lastChecked:'2026-07-21T05:30:00Z' },
    { id:'s2', name:'Internal policy and control library', jurisdiction:'Enterprise', type:'Controlled internal', status:'Active', lastChecked:'2026-07-21T05:00:00Z' }
  ],
  graph: {
    nodes:[
      { id:'bank', label:'Institution', type:'Organisation', risk:'Low' },
      { id:'product1', label:'Cross-border remittance', type:'Product', risk:'High' },
      { id:'vendor1', label:'Payment technology vendor', type:'Third party', risk:'Critical' },
      { id:'reg1', label:'Outsourcing obligation', type:'Obligation', risk:'Critical' },
      { id:'control1', label:'Vendor exit control', type:'Control', risk:'High' },
      { id:'decision1', label:'Custody decision', type:'Decision', risk:'Critical' },
      { id:'evidence1', label:'Exit-test evidence', type:'Evidence', risk:'High' }
    ],
    edges:[['bank','product1','operates'],['product1','vendor1','depends on'],['reg1','product1','governs'],['reg1','control1','requires'],['control1','decision1','gates'],['evidence1','control1','proves']]
  },
  packs:[
    { id:'p1', name:'Contract Command', description:'Review, negotiation, obligations and value assurance', maturity:76 },
    { id:'p2', name:'Regulatory Command', description:'Change, impact, remediation and evidence', maturity:71 },
    { id:'p3', name:'Governance & Authority', description:'Entities, signatories and approvals', maturity:64 },
    { id:'p4', name:'KYC / AML Exceptions', description:'Exception governance and disposition', maturity:59 },
    { id:'p5', name:'Privacy & Cyber', description:'Data, incident and third-party controls', maturity:68 },
    { id:'p6', name:'Capital & Mandate', description:'Mandate, liquidity and conflict tests', maturity:43 },
    { id:'p7', name:'Transactions & Diligence', description:'Diligence, CPs and closing obligations', maturity:57 },
    { id:'p8', name:'Investigations & Disputes', description:'Chronology, evidence and scenarios', maturity:48 }
  ],
  simulations:[
    { id:'sim1', name:'Critical vendor failure', probability:32, impact:91, readiness:47, recommendation:'Complete exit test, validate alternate provider and pre-approve communications.' },
    { id:'sim2', name:'Regulatory deadline accelerated', probability:18, impact:84, readiness:61, recommendation:'Prioritise high-risk controls and freeze non-essential change.' }
  ]
};
