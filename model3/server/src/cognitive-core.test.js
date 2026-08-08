import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeControls,
  informationFlowDecision,
  deterministicDecision,
  probabilisticDecision,
  requiresHumanApproval,
  redactForExternalModel
} from './cognitive-core.js';

test('restricted data is denied external model and research by default', () => {
  const controls = normalizeControls({});
  const result = informationFlowDecision({ controls, dataClass: 'restricted', requestedDestinations: ['openai', 'official-web'] });
  assert.equal(result.allowModel, false);
  assert.equal(result.allowResearch, false);
});

test('kill switch blocks the cognitive flow deterministically', () => {
  const result = informationFlowDecision({ controls: { killSwitch: true }, dataClass: 'public', requestedDestinations: ['openai'] });
  assert.equal(result.permitted, false);
  assert.equal(result.allowModel, false);
  assert.match(result.reasons.join(' '), /kill switch/i);
});

test('deterministic mode is reproducible for identical isolated inputs', () => {
  const input = {
    question: 'Can we execute this agreement when unlimited liability and regulatory breach are identified?',
    requestedAction: 'execute agreement',
    document: {
      id: 'doc-1', overallRisk: 'High',
      analysis: { overall_risk: 'High', overall_score: 78, findings: [{ risk_level: 'High', category: 'Legal', issue: 'Unlimited liability', confidence: 84 }] }
    },
    controls: {}
  };
  const first = deterministicDecision(input);
  const second = deterministicDecision(input);
  assert.deepEqual(first, second);
  assert.ok(['High', 'Critical'].includes(first.riskLevel));
});

test('probabilistic decision distribution is normalized and labelled analytical', () => {
  const deterministic = deterministicDecision({ question: 'Material compliance risk with missing evidence', requestedAction: 'approve', controls: {} });
  const result = probabilisticDecision({ deterministic, controls: {} });
  const total = result.options.reduce((sum, item) => sum + item.probability, 0);
  assert.ok(Math.abs(total - 1) < 0.001);
  assert.match(result.interpretation, /not a measured real-world event probability/i);
});

test('high-impact actions require a human approval gate in safe mode', () => {
  const gate = requiresHumanApproval({ riskLevel: 'High', requestedAction: 'transfer funds and send externally', controls: { safeMode: true }, userRole: 'legal' });
  assert.equal(gate.required, true);
  assert.equal(gate.status, 'HUMAN_APPROVAL_REQUIRED');
});

test('external redaction removes obvious secrets and identifiers', () => {
  const value = redactForExternalModel('Email a.person@example.com using sk-abcdefghijklmnopqrstuvwxyz and PAN ABCDE1234F');
  assert.doesNotMatch(value, /a\.person@example\.com/);
  assert.doesNotMatch(value, /sk-abcdefghijklmnopqrstuvwxyz/);
  assert.doesNotMatch(value, /ABCDE1234F/);
});
