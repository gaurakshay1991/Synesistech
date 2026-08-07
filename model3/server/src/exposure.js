const currencyPatterns = [
  { code: 'INR', symbol: '₹', regex: /(?:₹|INR\s*)\s*([0-9][0-9,]*(?:\.\d+)?)\s*(crore|cr|lakh|lac|million|billion)?/gi },
  { code: 'USD', symbol: '$', regex: /(?:US\$|USD\s*|\$)\s*([0-9][0-9,]*(?:\.\d+)?)\s*(million|billion|m|bn)?/gi },
  { code: 'EUR', symbol: '€', regex: /(?:EUR\s*|€)\s*([0-9][0-9,]*(?:\.\d+)?)\s*(million|billion|m|bn)?/gi },
  { code: 'GBP', symbol: '£', regex: /(?:GBP\s*|£)\s*([0-9][0-9,]*(?:\.\d+)?)\s*(million|billion|m|bn)?/gi }
];

function multiplier(unit = '') {
  const value = String(unit || '').toLowerCase();
  if (value === 'crore' || value === 'cr') return 10_000_000;
  if (value === 'lakh' || value === 'lac') return 100_000;
  if (value === 'million' || value === 'm') return 1_000_000;
  if (value === 'billion' || value === 'bn') return 1_000_000_000;
  return 1;
}

function number(value) {
  return Number(String(value || '').replace(/,/g, '')) || 0;
}

export function extractMonetarySignals(text = '') {
  const source = String(text || '');
  const values = [];
  for (const pattern of currencyPatterns) {
    pattern.regex.lastIndex = 0;
    for (const match of source.matchAll(pattern.regex)) {
      const amount = number(match[1]) * multiplier(match[2]);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const start = Math.max(0, (match.index || 0) - 120);
      const end = Math.min(source.length, (match.index || 0) + match[0].length + 180);
      const context = source.slice(start, end).replace(/\s+/g, ' ').trim();
      values.push({
        currency: pattern.code,
        amount,
        raw: match[0],
        context,
        isLiabilityCap: /aggregate liability|liability.{0,40}(cap|limit)|shall not exceed|maximum liability/i.test(context),
        isContractValue: /contract value|agreement value|total consideration|total fees|annual fees|charges payable|purchase price/i.test(context),
        isPenalty: /penalt|liquidated damages|fine|damages/i.test(context),
        isInsurance: /insurance|coverage/i.test(context)
      });
    }
  }
  return values.sort((a, b) => b.amount - a.amount);
}

function sameCurrencyLargest(values, currency) {
  return values.filter(item => item.currency === currency).sort((a, b) => b.amount - a.amount)[0] || null;
}

function riskFactor(level) {
  if (level === 'Critical') return { low: 0.2, base: 0.6, high: 1.25, probability: 65 };
  if (level === 'High') return { low: 0.1, base: 0.35, high: 0.8, probability: 45 };
  if (level === 'Medium') return { low: 0.03, base: 0.12, high: 0.35, probability: 25 };
  return { low: 0.01, base: 0.04, high: 0.12, probability: 10 };
}

function roundMoney(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value);
}

function categoryOf(finding = {}) {
  return String(finding.category || finding.type || finding.issue || '').toLowerCase();
}

function explicitCap(values, finding) {
  const category = categoryOf(finding);
  if (!/liabil|indemn|damages|risk allocation/.test(category)) return null;
  return values.find(item => item.isLiabilityCap) || null;
}

function referenceValue(values, finding) {
  const cap = explicitCap(values, finding);
  if (cap) return { ...cap, basis: 'Express liability cap detected in the document' };
  const contract = values.find(item => item.isContractValue);
  if (contract) return { ...contract, basis: 'Express contract or fee value detected in the document' };
  const penalty = values.find(item => item.isPenalty);
  if (penalty) return { ...penalty, basis: 'Express penalty or damages amount detected in the document' };
  const top = values[0];
  return top ? { ...top, basis: 'Largest monetary amount detected; relationship to exposure requires human validation' } : null;
}

export function quantifyFindingExposure(finding = {}, text = '', options = {}) {
  const values = extractMonetarySignals(text);
  const level = finding.risk_level || finding.risk || finding.level || 'Medium';
  const factors = riskFactor(level);
  const ref = referenceValue(values, finding);
  const category = categoryOf(finding);
  const issue = String(finding.issue || finding.title || 'Identified legal risk');
  const uncapped = /uncapped|unlimited liability|without limitation/i.test(`${issue} ${text.slice(0, 60000)}`) && /liabil|indemn|damages/.test(category);
  const cap = explicitCap(values, finding);

  if (uncapped && !cap) {
    return {
      riskLevel: level,
      issue,
      quantificationStatus: 'Unbounded contractually',
      directContractualExposure: { currency: null, low: null, base: null, high: null, ceiling: null },
      exposureLabel: 'No express monetary ceiling detected for this risk.',
      probabilityIndicator: factors.probability,
      confidence: 84,
      rationale: 'The document appears to create uncapped or unlimited liability and no express monetary liability cap was detected. Actual recoverable loss remains dependent on causation, remoteness, mitigation, governing law, exclusions and facts.',
      regulatoryExposure: 'Not asserted from the contract alone. Use live authority mapping for current statutory penalties.',
      basis: ['Document wording', 'No express liability-cap amount detected'],
      limitations: ['This is not a damages opinion.', 'A contractual absence of a cap does not mean every asserted loss is legally recoverable.']
    };
  }

  if (cap) {
    return {
      riskLevel: level,
      issue,
      quantificationStatus: 'Bounded by express document amount',
      directContractualExposure: { currency: cap.currency, low: null, base: null, high: null, ceiling: roundMoney(cap.amount) },
      exposureLabel: `${cap.currency} ${Math.round(cap.amount).toLocaleString()} express cap detected`,
      probabilityIndicator: factors.probability,
      confidence: 90,
      rationale: 'An express monetary liability-cap amount was detected near liability-limitation language. The ceiling remains subject to carve-outs, exclusions, separate indemnities, statutory liabilities and interpretation.',
      regulatoryExposure: 'Separate from the contractual cap and requires current-law authority mapping.',
      basis: [cap.basis || 'Express liability cap', cap.context],
      limitations: ['Carve-outs may sit outside the cap.', 'The detected amount must be legally validated in context.']
    };
  }

  if (ref && ['Critical', 'High', 'Medium'].includes(level)) {
    return {
      riskLevel: level,
      issue,
      quantificationStatus: 'Scenario range — not legal maximum',
      directContractualExposure: {
        currency: ref.currency,
        low: roundMoney(ref.amount * factors.low),
        base: roundMoney(ref.amount * factors.base),
        high: roundMoney(ref.amount * factors.high),
        ceiling: null
      },
      exposureLabel: `Scenario band derived from an explicit ${ref.currency} reference amount`,
      probabilityIndicator: factors.probability,
      confidence: ref.isContractValue || ref.isPenalty ? 62 : 42,
      rationale: `The document contains an explicit monetary reference of ${ref.currency} ${Math.round(ref.amount).toLocaleString()}. Because the clause does not state a clear legal maximum for this risk, Synesis uses it only as a scenario anchor rather than asserting a damages ceiling.`,
      regulatoryExposure: 'Requires live authority mapping before any statutory amount is stated.',
      basis: [ref.basis, ref.context],
      limitations: ['Scenario factors are risk-management assumptions, not legal rules.', 'Do not book provisions or make settlement decisions from this band without finance and legal validation.']
    };
  }

  return {
    riskLevel: level,
    issue,
    quantificationStatus: 'Not reliably quantifiable from current evidence',
    directContractualExposure: { currency: null, low: null, base: null, high: null, ceiling: null },
    exposureLabel: 'No reliable monetary basis detected.',
    probabilityIndicator: factors.probability,
    confidence: 25,
    rationale: 'Risk severity and monetary exposure are different dimensions. The document does not contain a sufficiently reliable monetary anchor or express ceiling for this finding.',
    regulatoryExposure: 'Requires live authority mapping and organisation-specific facts.',
    basis: ['Risk severity', 'Document text'],
    limitations: ['Do not infer money solely from High/Medium severity.', 'Additional transaction value, revenue, customer count, insured limits or statutory penalty data may be needed.']
  };
}

export function buildDocumentExposureModel(analysis = {}, text = '', options = {}) {
  const findings = Array.isArray(analysis.findings) ? analysis.findings : [];
  const material = findings.filter(item => ['Critical', 'High', 'Medium'].includes(item.risk_level || item.risk || item.level));
  const exposures = material.map((finding, index) => ({
    findingId: finding.id || `finding-${index + 1}`,
    category: finding.category || finding.type || 'Legal risk',
    ...quantifyFindingExposure(finding, text, options)
  }));
  const exactOrBounded = exposures.filter(item => ['Bounded by express document amount', 'Unbounded contractually'].includes(item.quantificationStatus)).length;
  const scenario = exposures.filter(item => item.quantificationStatus.startsWith('Scenario')).length;
  const unquantified = exposures.length - exactOrBounded - scenario;
  return {
    model: 'Synesis Exposure Engine v1',
    generatedAt: new Date().toISOString(),
    documentIsolation: true,
    overallRisk: analysis.overall_risk || 'Unassessed',
    materialFindings: exposures.length,
    summary: { exactOrBounded, scenario, unquantified },
    exposures,
    methodology: [
      'Uses only monetary values detected in the selected document for contractual quantification.',
      'Treats uncapped liability as contractually unbounded instead of inventing a number.',
      'Treats severity and monetary exposure as separate dimensions.',
      'Statutory fines and current legal maxima are not asserted without live-authority research.',
      'Scenario bands are explicitly labelled and never presented as legal maxima.'
    ]
  };
}

export function findCurrencyReference(values = [], currency) {
  return sameCurrencyLargest(values, currency);
}
