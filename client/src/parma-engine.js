export const FACTORS = [
  { key: 'regulatory', label: 'Regulatory & licensing', weight: 18 },
  { key: 'financial', label: 'Financial downside', weight: 18 },
  { key: 'counterparty', label: 'Counterparty resilience', weight: 14 },
  { key: 'contractual', label: 'Contractual protection', weight: 14 },
  { key: 'operational', label: 'Operational dependency', weight: 10 },
  { key: 'reputational', label: 'Reputational sensitivity', weight: 8 },
  { key: 'data', label: 'Data, privacy & cyber', weight: 10 },
  { key: 'sanctions', label: 'Sanctions & cross-border', weight: 8 }
];

export const DEFAULT_SCORES = {
  regulatory: 55, financial: 60, counterparty: 45, contractual: 50,
  operational: 35, reputational: 35, data: 30, sanctions: 20
};

export function classify(score) {
  if (score >= 80) return { label: 'Critical', tone: 'critical' };
  if (score >= 60) return { label: 'High', tone: 'high' };
  if (score >= 35) return { label: 'Medium', tone: 'medium' };
  return { label: 'Low', tone: 'low' };
}

export function assessMatter({ value, probability, lossSeverity, controlEffectiveness, scores }) {
  const inherent = Math.round(FACTORS.reduce((sum, factor) => sum + ((Number(scores[factor.key]) || 0) * factor.weight / 100), 0));
  const residual = Math.max(0, Math.round(inherent * (1 - (Number(controlEffectiveness) || 0) / 100)));
  const matterValue = Math.max(0, Number(value) || 0);
  const probabilityRate = Math.min(100, Math.max(0, Number(probability) || 0)) / 100;
  const severityRate = Math.min(100, Math.max(0, Number(lossSeverity) || 0)) / 100;
  const maximumExposure = Math.round(matterValue * severityRate);
  const expectedLoss = Math.round(maximumExposure * probabilityRate);
  const residualExpectedLoss = Math.round(expectedLoss * (1 - (Number(controlEffectiveness) || 0) / 100));
  const riskAdjustedValue = Math.max(0, matterValue - residualExpectedLoss);
  const drivers = FACTORS
    .map(factor => ({ ...factor, score: Number(scores[factor.key]) || 0, contribution: Math.round((Number(scores[factor.key]) || 0) * factor.weight / 100) }))
    .sort((a, b) => b.contribution - a.contribution);
  return { inherent, residual, band: classify(residual), maximumExposure, expectedLoss, residualExpectedLoss, riskAdjustedValue, drivers };
}

export function money(value, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value) || 0);
}

export function makeId() {
  return globalThis.crypto?.randomUUID?.() || `parma-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
