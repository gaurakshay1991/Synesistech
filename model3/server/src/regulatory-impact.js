const compact = value => String(value || '').replace(/\s+/g, ' ').trim();

const patterns = [
  /\b(?:the\s+)?[A-Z][A-Za-z&()\-.,' ]{2,100}\s+(?:Act|Code|Ordinance),?\s*(?:19|20)\d{2}\b/g,
  /\b(?:the\s+)?[A-Z][A-Za-z&()\-.,' ]{2,100}\s+(?:Rules|Regulations|Directions|Guidelines|Standards|Scheme),?\s*(?:19|20)\d{2}\b/g,
  /\b(?:Master\s+(?:Direction|Circular)|Circular|Notification|Direction|Guideline|Guidelines|Order|Public Notice|Office Memorandum|Press Note)\s+(?:No\.?\s*)?[A-Za-z0-9()_./\-]+(?:\s+(?:dated|date)\s+[0-9A-Za-z,./\- ]{4,35})?/gi,
  /\b(?:RBI|SEBI|IRDAI|IFSCA|PFRDA|FIU(?:-IND)?|DGFT|MCA|MeitY|CBDT|CBIC|CCI)\s+(?:Master\s+(?:Direction|Circular)|Circular|Notification|Direction|Guideline|Guidelines|Order|Framework)\s+(?:No\.?\s*)?[A-Za-z0-9()_./\-]+/gi,
  /\b(?:Directive|Regulation)\s+\(?(?:EU|EC)\)?\s*(?:No\.?\s*)?[A-Za-z0-9()_./\-]+/gi,
  /\b(?:U\.S\.C\.|CFR|USC)\s*§?\s*[0-9A-Za-z.()\-]+/g
];

const sectionPattern = /\b(?:section|sec\.|rule|regulation|reg\.|article|art\.)\s+([0-9]+[A-Za-z]?(?:\([0-9A-Za-z]+\))*)/gi;

export function extractLegalReferences(text = '') {
  const source = String(text || '');
  const seen = new Set();
  const references = [];
  for (const regex of patterns) {
    regex.lastIndex = 0;
    for (const match of source.matchAll(regex)) {
      const reference = compact(match[0]).replace(/[.,;:]$/, '');
      const key = reference.toLowerCase();
      if (!reference || seen.has(key)) continue;
      seen.add(key);
      const start = Math.max(0, (match.index || 0) - 160);
      const end = Math.min(source.length, (match.index || 0) + match[0].length + 220);
      const context = compact(source.slice(start, end));
      const nearbySections = [];
      sectionPattern.lastIndex = 0;
      for (const section of context.matchAll(sectionPattern)) nearbySections.push(compact(section[0]));
      references.push({
        id: `ref-${references.length + 1}`,
        reference,
        context: context.slice(0, 700),
        nearbySections: [...new Set(nearbySections)].slice(0, 12),
        apparentStatusLanguage: /as amended|amended from time to time|as updated|as modified/i.test(context)
          ? 'Document acknowledges possible amendments'
          : /supersed|repeal|rescinded|withdrawn/i.test(context)
            ? 'Document contains supersession/repeal language'
            : 'No amendment-status language detected nearby'
      });
    }
  }
  return references.slice(0, 120);
}

export const COMPLIANCE_IMPACT_DIMENSIONS = [
  'Licensing / authorisation / registration',
  'Regulatory approval / consent / no-objection',
  'Reporting / filing / returns / disclosures',
  'KYC / AML / CFT / sanctions / screening',
  'Privacy / data protection / localisation / cross-border transfer',
  'Cybersecurity / technology / outsourcing / cloud / incident reporting',
  'Capital / prudential / exposure / provisioning / liquidity',
  'Customer / consumer protection / conduct / disclosures',
  'Corporate approvals / board / shareholder / related-party governance',
  'Tax / withholding / GST / customs / duties',
  'Employment / labour / social security',
  'Competition / antitrust / merger control',
  'Foreign exchange / cross-border / trade controls',
  'Record retention / audit trail / evidence',
  'Contract enforceability / mandatory clauses / prohibited terms',
  'Operational process / maker-checker / control ownership',
  'Third-party / vendor / subcontractor / concentration risk',
  'Litigation / enforcement / penalty / remediation',
  'Transition / grandfathering / implementation deadline',
  'Management / regulator notification / escalation'
];

export function emptyRegulatoryImpact(referenceInventory = [], error = '') {
  return {
    status: error ? 'UNAVAILABLE' : 'NOT_RUN',
    overallImpact: 'UNASSESSED',
    staleReferenceWarning: false,
    referenceInventory,
    citedAuthorities: referenceInventory.map(item => ({
      referenceId: item.id,
      documentReference: item.reference,
      currentStatus: 'NOT_VERIFIED',
      currentInstrument: null,
      amendmentOrSupersession: null,
      effectiveDate: null,
      impact: 'Requires live authority verification',
      sourceUrls: []
    })),
    omittedApplicableAuthorities: [],
    complianceImpacts: [],
    transitionAndDeadlines: [],
    requiredActions: [],
    decisionEffect: 'No current regulatory conclusion available.',
    limitations: error ? [error] : [],
    generatedAt: new Date().toISOString()
  };
}

export function normalizeRegulatoryImpact(pack = {}, referenceInventory = [], currentLaw = null) {
  const allowedStatus = new Set(['CURRENT','AMENDED','SUPERSEDED','REPEALED','WITHDRAWN','PARTIALLY_EFFECTIVE','NOT_YET_EFFECTIVE','UNCLEAR','NOT_VERIFIED']);
  const cited = Array.isArray(pack.citedAuthorities) ? pack.citedAuthorities : [];
  const normalizedCited = cited.map((item, index) => ({
    referenceId: item.referenceId || referenceInventory[index]?.id || `ref-${index + 1}`,
    documentReference: compact(item.documentReference || item.reference || referenceInventory[index]?.reference || 'Unspecified authority'),
    currentStatus: allowedStatus.has(String(item.currentStatus || '').toUpperCase()) ? String(item.currentStatus).toUpperCase() : 'UNCLEAR',
    currentInstrument: item.currentInstrument || null,
    amendmentOrSupersession: item.amendmentOrSupersession || null,
    effectiveDate: item.effectiveDate || null,
    transitionDate: item.transitionDate || null,
    impact: compact(item.impact || 'No impact explanation returned.'),
    sourceUrls: Array.isArray(item.sourceUrls) ? item.sourceUrls.filter(value => /^https:\/\//i.test(String(value))).slice(0, 10) : []
  }));
  const stale = normalizedCited.some(item => ['AMENDED','SUPERSEDED','REPEALED','WITHDRAWN','PARTIALLY_EFFECTIVE'].includes(item.currentStatus));
  return {
    status: 'COMPLETE',
    overallImpact: String(pack.overallImpact || 'UNASSESSED').toUpperCase(),
    staleReferenceWarning: Boolean(pack.staleReferenceWarning || stale),
    executiveConclusion: compact(pack.executiveConclusion || ''),
    referenceInventory,
    citedAuthorities: normalizedCited,
    omittedApplicableAuthorities: Array.isArray(pack.omittedApplicableAuthorities) ? pack.omittedApplicableAuthorities : [],
    complianceImpacts: Array.isArray(pack.complianceImpacts) ? pack.complianceImpacts : [],
    transitionAndDeadlines: Array.isArray(pack.transitionAndDeadlines) ? pack.transitionAndDeadlines : [],
    requiredActions: Array.isArray(pack.requiredActions) ? pack.requiredActions : [],
    approvalsAndEscalations: Array.isArray(pack.approvalsAndEscalations) ? pack.approvalsAndEscalations : [],
    missingFacts: Array.isArray(pack.missingFacts) ? pack.missingFacts : [],
    decisionEffect: compact(pack.decisionEffect || ''),
    currentLawCitations: currentLaw?.citations || [],
    researchedAt: currentLaw?.researchedAt || new Date().toISOString(),
    liveWebUsed: Boolean(currentLaw?.liveWebUsed),
    generatedAt: new Date().toISOString()
  };
}

export function regulatoryImpactResearchQuestion(referenceInventory = []) {
  const listed = referenceInventory.length
    ? referenceInventory.map(item => `- ${item.reference}${item.nearbySections?.length ? ` [${item.nearbySections.join(', ')}]` : ''}`).join('\n')
    : '- No express named authority was reliably extracted. Identify current authorities that nevertheless apply to the selected document.';
  return `Perform a CURRENT regulatory-reference and compliance-impact audit of this exact selected document.\n\nDOCUMENT REFERENCES DETECTED:\n${listed}\n\nFor EACH cited authority, verify whether the exact instrument/version relied on is current, amended, superseded, repealed, withdrawn, partly effective, not yet effective, or unclear. Find later amendments, corrigenda, master/consolidated instruments, implementation circulars, commencement notifications, transitional/grandfathering provisions and binding court decisions that materially alter its meaning or applicability.\n\nAlso identify material CURRENT laws/rules/regulations/circulars/guidelines/orders that apply to this document even if the drafter failed to cite them. Do not treat proposals/consultations/drafts as operative law.\n\nThen determine concrete compliance impact: licensing/authorisation; approvals/NOCs; filings/reporting/disclosures; KYC/AML/CFT/sanctions; privacy/data/cross-border transfer; cyber/technology/outsourcing; prudential/capital/exposure; consumer/conduct; corporate governance; tax; employment; competition; FEMA/trade controls; record retention/audit evidence; mandatory/prohibited contract terms; vendor controls; enforcement/penalties; implementation deadlines; and management/regulator escalation.\n\nWhere a cited circular or law is stale, state WHAT replaced/changed it, WHEN the change became effective, WHETHER it affects this document, and the exact remedial action. Prefer primary official sources and cite them.`;
}
