const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));
const uniq = values => [...new Set((Array.isArray(values) ? values : []).map(value => String(value || '').trim()).filter(Boolean))];

export const DEFAULT_COGNITIVE_CONTROLS = Object.freeze({
  schemaVersion: 1,
  killSwitch: false,
  safeMode: true,
  externalModels: true,
  externalResearch: true,
  forceDeterministic: false,
  allowMemoryPromotion: false,
  approvalRiskThreshold: 'High',
  abstentionThreshold: 0.58,
  sourceAuthorityThreshold: 90,
  transientMemoryTtlMinutes: 20,
  maxHypotheses: 5,
  externalModelDataClasses: ['public', 'internal'],
  externalResearchDataClasses: ['public', 'internal'],
  allowedDestinations: ['openai', 'official-web'],
  allowedTools: ['deterministic-policy-engine', 'probabilistic-decision-engine', 'official-web-research', 'single-document-analysis', 'institutional-state', 'neuro-symbolic-graph'],
  allowedDomains: []
});

export function normalizeControls(input = {}) {
  const threshold = ['Critical', 'High', 'Medium', 'Low'].includes(input.approvalRiskThreshold) ? input.approvalRiskThreshold : DEFAULT_COGNITIVE_CONTROLS.approvalRiskThreshold;
  return {
    ...DEFAULT_COGNITIVE_CONTROLS,
    ...input,
    schemaVersion: 1,
    killSwitch: Boolean(input.killSwitch ?? DEFAULT_COGNITIVE_CONTROLS.killSwitch),
    safeMode: Boolean(input.safeMode ?? DEFAULT_COGNITIVE_CONTROLS.safeMode),
    externalModels: Boolean(input.externalModels ?? DEFAULT_COGNITIVE_CONTROLS.externalModels),
    externalResearch: Boolean(input.externalResearch ?? DEFAULT_COGNITIVE_CONTROLS.externalResearch),
    forceDeterministic: Boolean(input.forceDeterministic ?? DEFAULT_COGNITIVE_CONTROLS.forceDeterministic),
    allowMemoryPromotion: Boolean(input.allowMemoryPromotion ?? DEFAULT_COGNITIVE_CONTROLS.allowMemoryPromotion),
    approvalRiskThreshold: threshold,
    abstentionThreshold: clamp(input.abstentionThreshold ?? DEFAULT_COGNITIVE_CONTROLS.abstentionThreshold, 0.35, 0.95),
    sourceAuthorityThreshold: clamp(input.sourceAuthorityThreshold ?? DEFAULT_COGNITIVE_CONTROLS.sourceAuthorityThreshold, 50, 100),
    transientMemoryTtlMinutes: Math.round(clamp(input.transientMemoryTtlMinutes ?? DEFAULT_COGNITIVE_CONTROLS.transientMemoryTtlMinutes, 5, 120)),
    maxHypotheses: Math.round(clamp(input.maxHypotheses ?? DEFAULT_COGNITIVE_CONTROLS.maxHypotheses, 2, 8)),
    externalModelDataClasses: uniq(input.externalModelDataClasses ?? DEFAULT_COGNITIVE_CONTROLS.externalModelDataClasses).map(value => value.toLowerCase()),
    externalResearchDataClasses: uniq(input.externalResearchDataClasses ?? DEFAULT_COGNITIVE_CONTROLS.externalResearchDataClasses).map(value => value.toLowerCase()),
    allowedDestinations: uniq(input.allowedDestinations ?? DEFAULT_COGNITIVE_CONTROLS.allowedDestinations).map(value => value.toLowerCase()),
    allowedTools: uniq(input.allowedTools ?? DEFAULT_COGNITIVE_CONTROLS.allowedTools),
    allowedDomains: uniq(input.allowedDomains ?? DEFAULT_COGNITIVE_CONTROLS.allowedDomains).map(value => value.toLowerCase())
  };
}

const riskRank = { Low: 1, Medium: 2, High: 3, Critical: 4 };

export function classifyRequestRisk({ question = '', requestedAction = '', dataClass = 'internal' } = {}) {
  const text = `${question} ${requestedAction}`.toLowerCase();
  let score = 18;
  const reasons = [];
  const add = (points, reason) => { score += points; reasons.push(reason); };

  if (/delete|destroy|terminate|block|freeze|suspend|reject|decline|fire|dismiss|sanction|report to regulator|file complaint|send externally|publish|execute|transfer funds|trade|invest|approve payment|close account/.test(text)) add(30, 'Requested action could have irreversible or externally consequential effects.');
  if (/criminal|fraud|money laundering|terror|sanction|brib|corrupt|cyber|breach|personal data|privacy|regulator|enforcement|litigation|court|injunction|penalt|fine/.test(text)) add(24, 'The subject contains legal, enforcement, financial-crime, cyber/privacy or litigation indicators.');
  if (/critical|high risk|material breach|unlimited liability|indemnity|default|acceleration|termination/.test(text)) add(18, 'The request contains explicit material-risk language.');
  if (/medical|health|biometric|password|secret|credential|account number|confidential|privileged/.test(text)) add(16, 'Sensitive or restricted information indicators are present.');
  if (String(dataClass).toLowerCase() === 'confidential') add(8, 'The request is classified confidential.');
  if (String(dataClass).toLowerCase() === 'restricted') add(20, 'The request is classified restricted.');

  score = clamp(score, 0, 100);
  const level = score >= 82 ? 'Critical' : score >= 62 ? 'High' : score >= 36 ? 'Medium' : 'Low';
  return { level, score, reasons: reasons.length ? reasons : ['No elevated deterministic risk signal was detected in the request text.'] };
}

export function informationFlowDecision({ controls: rawControls = {}, dataClass = 'internal', requestedDestinations = [], preferredDomains = [] } = {}) {
  const controls = normalizeControls(rawControls);
  const classification = String(dataClass || 'internal').toLowerCase();
  const requested = uniq(requestedDestinations).map(value => value.toLowerCase());
  const reasons = [];

  if (controls.killSwitch) {
    return { permitted: false, allowModel: false, allowResearch: false, allowedDomains: [], blockedDestinations: requested, reasons: ['Cognitive kill switch is active.'] };
  }

  const blockedDestinations = requested.filter(value => !controls.allowedDestinations.includes(value));
  if (blockedDestinations.length) reasons.push(`Default-deny information-flow policy blocked destination(s): ${blockedDestinations.join(', ')}.`);

  let allowModel = controls.externalModels && controls.externalModelDataClasses.includes(classification) && !blockedDestinations.includes('openai');
  let allowResearch = controls.externalResearch && controls.externalResearchDataClasses.includes(classification) && !blockedDestinations.includes('official-web');

  if (!controls.externalModels) reasons.push('External model transmission is disabled by the Control Tower.');
  if (!controls.externalResearch) reasons.push('External research is disabled by the Control Tower.');
  if (!controls.externalModelDataClasses.includes(classification)) reasons.push(`${classification} data is not authorised for external model transmission.`);
  if (!controls.externalResearchDataClasses.includes(classification)) reasons.push(`${classification} data is not authorised for external research.`);

  let allowedDomains = uniq(preferredDomains).map(value => value.toLowerCase());
  if (controls.allowedDomains.length) {
    allowedDomains = allowedDomains.length ? allowedDomains.filter(domain => controls.allowedDomains.includes(domain)) : [...controls.allowedDomains];
  }

  const permitted = blockedDestinations.length === 0;
  return { permitted, allowModel, allowResearch, allowedDomains, blockedDestinations, reasons };
}

function evidenceQuality({ document = null, state = null } = {}) {
  if (document) {
    const analysis = document.analysis || {};
    const confidenceValues = (analysis.findings || []).map(item => Number(item.confidence || item.confidence_score || 0)).filter(value => value > 0);
    const avg = confidenceValues.length ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length : Number(analysis.overall_score || 55);
    return clamp(avg / 100, 0.15, 0.98);
  }
  const metrics = state?.metrics || {};
  const evidenceCoverage = Number(metrics.evidenceCoverage || 0) / 100;
  return clamp(evidenceCoverage || 0.45, 0.15, 0.95);
}

export function deterministicDecision({ question = '', requestedAction = '', state = null, document = null, controls: rawControls = {} } = {}) {
  const controls = normalizeControls(rawControls);
  const requestRisk = classifyRequestRisk({ question, requestedAction });
  const text = `${question} ${requestedAction}`.toLowerCase();
  let riskScore = requestRisk.score;
  const signals = [...requestRisk.reasons];

  if (document) {
    const analysis = document.analysis || {};
    const mappedRisk = { Critical: 92, High: 74, Medium: 52, Low: 24 }[analysis.overall_risk || document.overallRisk] || 0;
    if (mappedRisk) {
      riskScore = Math.max(riskScore, mappedRisk);
      signals.push(`Selected document analysis is ${analysis.overall_risk || document.overallRisk}.`);
    }
    const materialFindings = (analysis.findings || []).filter(item => ['Critical', 'High'].includes(item.risk_level || item.risk));
    if (materialFindings.length) {
      riskScore = clamp(riskScore + Math.min(12, materialFindings.length * 2), 0, 100);
      signals.push(`${materialFindings.length} Critical/High finding(s) exist in the isolated document analysis.`);
    }
  } else if (state) {
    const metrics = state.metrics || {};
    const critical = Number(metrics.critical || 0);
    const overdue = Number(metrics.overdue || 0);
    const controlsAtRisk = Number(metrics.controlsAtRisk || 0);
    if (critical) { riskScore += Math.min(12, critical * 2); signals.push(`${critical} critical institutional exposure(s) are currently recorded.`); }
    if (overdue) { riskScore += Math.min(8, overdue); signals.push(`${overdue} overdue governed task(s) are recorded.`); }
    if (controlsAtRisk) { riskScore += Math.min(8, controlsAtRisk); signals.push(`${controlsAtRisk} control(s) are below the configured effectiveness threshold.`); }
  }

  if (/approved by|verified|evidence attached|confirmed by|control implemented|remediated/.test(text)) {
    riskScore -= 10;
    signals.push('The request contains a positive verification/control signal.');
  }
  if (/uncertain|unknown|missing|not available|cannot verify|unconfirmed|insufficient/.test(text)) {
    riskScore += 12;
    signals.push('The request explicitly indicates missing or uncertain evidence.');
  }

  riskScore = clamp(riskScore, 0, 100);
  const riskLevel = riskScore >= 82 ? 'Critical' : riskScore >= 62 ? 'High' : riskScore >= 36 ? 'Medium' : 'Low';
  const evidence = evidenceQuality({ document, state: document ? null : state });

  let recommendation = 'Proceed within ordinary controls';
  if (riskLevel === 'Critical') recommendation = 'Do not execute autonomously; escalate for authorised human decision';
  else if (riskLevel === 'High') recommendation = 'Challenge or proceed only with explicit controls and authorised approval';
  else if (riskLevel === 'Medium') recommendation = evidence < 0.55 ? 'Obtain additional evidence before proceeding' : 'Proceed with documented controls and monitoring';
  else if (evidence < 0.45) recommendation = 'Proceed only after basic evidence is confirmed';

  return {
    mode: 'deterministic',
    riskLevel,
    riskScore: Math.round(riskScore),
    evidenceQuality: Number(evidence.toFixed(3)),
    recommendation,
    signals: uniq(signals).slice(0, 12),
    reproducibilityKey: JSON.stringify({ question: String(question).trim(), requestedAction: String(requestedAction).trim(), riskLevel, riskScore: Math.round(riskScore), evidence: Number(evidence.toFixed(3)), forceDeterministic: controls.forceDeterministic })
  };
}

function softmax(scores) {
  const max = Math.max(...scores);
  const exps = scores.map(score => Math.exp(score - max));
  const total = exps.reduce((sum, value) => sum + value, 0) || 1;
  return exps.map(value => value / total);
}

export function probabilisticDecision({ deterministic, controls: rawControls = {}, requestedOptions = [] } = {}) {
  const controls = normalizeControls(rawControls);
  const risk = clamp(deterministic?.riskScore || 50, 0, 100) / 100;
  const evidence = clamp(deterministic?.evidenceQuality || 0.45, 0.05, 0.99);
  const uncertainty = clamp(1 - evidence, 0.05, 0.9);
  const defaults = ['Proceed', 'Proceed with controls', 'Challenge / obtain evidence', 'Do not proceed', 'Abstain'];
  const options = uniq(requestedOptions).slice(0, controls.maxHypotheses);
  const labels = options.length >= 2 ? options : defaults;

  const genericScore = label => {
    const value = label.toLowerCase();
    if (/abstain|insufficient|defer/.test(value)) return 1.0 + uncertainty * 3.1 + risk * 0.6;
    if (/reject|do not|stop|decline|block/.test(value)) return 0.5 + risk * 3.4 + (1 - evidence) * 0.7;
    if (/challenge|evidence|investigate|review/.test(value)) return 1.2 + uncertainty * 2.4 + risk * 1.1;
    if (/control|condition|mitigat/.test(value)) return 1.5 + (1 - Math.abs(risk - 0.58)) * 1.8 + evidence * 0.6;
    return 1.5 + (1 - risk) * 2.6 + evidence * 1.2;
  };

  const probabilities = softmax(labels.map(genericScore));
  const ranked = labels.map((label, index) => {
    const probability = probabilities[index];
    const halfRange = clamp(uncertainty * 0.16, 0.03, 0.16);
    return {
      option: label,
      probability: Number(probability.toFixed(4)),
      probabilityRange: [Number(clamp(probability - halfRange, 0, 1).toFixed(4)), Number(clamp(probability + halfRange, 0, 1).toFixed(4))]
    };
  }).sort((a, b) => b.probability - a.probability);

  const top = ranked[0];
  const abstain = top.probability < controls.abstentionThreshold || (evidence < 0.35 && !/abstain/i.test(top.option));
  return {
    mode: 'probabilistic',
    options: ranked,
    selected: abstain ? 'Abstain — evidence below governed confidence threshold' : top.option,
    selectedProbability: Number(top.probability.toFixed(4)),
    uncertainty: Number(uncertainty.toFixed(3)),
    abstained: abstain,
    abstentionThreshold: controls.abstentionThreshold,
    interpretation: 'Analytical decision distribution for prioritisation; it is not a measured real-world event probability and must not be represented as one.'
  };
}

export function requiresHumanApproval({ riskLevel = 'Low', requestedAction = '', controls: rawControls = {}, userRole = '' } = {}) {
  const controls = normalizeControls(rawControls);
  const threshold = riskRank[controls.approvalRiskThreshold] || riskRank.High;
  const riskRequires = (riskRank[riskLevel] || 1) >= threshold;
  const highImpactAction = /delete|destroy|terminate|block|freeze|suspend|reject|decline|dismiss|send externally|publish|execute|transfer|trade|invest|payment|close account|regulator|court|customer action/i.test(String(requestedAction));
  const privilegedApprover = ['admin', 'management'].includes(String(userRole).toLowerCase());
  const required = controls.safeMode && (riskRequires || highImpactAction);
  return {
    required,
    privilegedApprover,
    status: required ? 'HUMAN_APPROVAL_REQUIRED' : 'NO_ADDITIONAL_APPROVAL_GATE',
    reason: required
      ? 'Deterministic governance policy requires an authorised human decision before any consequential action.'
      : 'The request did not cross the configured deterministic approval threshold.'
  };
}

export function redactForExternalModel(value = '') {
  return String(value)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
    .replace(/\b(?:\+?\d[\d\s-]{8,}\d)\b/g, '[REDACTED_PHONE_OR_ACCOUNT]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|AKIA[0-9A-Z]{16})\b/g, '[REDACTED_SECRET]')
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, '[REDACTED_TAX_ID]');
}

export function operationalEvent(stage, message, metadata = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (/prompt|chain|reasoning|sourceText|documentText|secret|token|password/i.test(key)) continue;
    safe[key] = value;
  }
  return { at: new Date().toISOString(), stage, message, ...safe };
}
