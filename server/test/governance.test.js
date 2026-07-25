import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HUMAN_OVERSIGHT_POLICY,
  applyHumanOversight,
  classifyProviderError,
  liveAnalysisFailure
} from '../src/governance.js';

test('insufficient quota is classified as a non-retryable incomplete analysis', () => {
  const result = classifyProviderError({
    status: 429,
    code: 'insufficient_quota',
    message: 'You exceeded your current quota, please check your plan and billing details.'
  });

  assert.equal(result.code, 'OPENAI_QUOTA_EXCEEDED');
  assert.equal(result.httpStatus, 503);
  assert.equal(result.retryable, false);
  assert.match(result.userMessage, /not completed/i);
});

test('employment context forces advisory-only human review', () => {
  const analysis = applyHumanOversight({
    executive_position: 'The agreement requires amendment.',
    recommended_decision: 'Sign Only After Material Revision',
    assumptions_and_limits: [],
    analysis_details: { live_ai_used: true }
  }, {
    text: 'This employment agreement governs salary, performance review and termination.',
    options: { documentType: 'Employment Agreement' }
  });

  assert.equal(analysis.human_review_required, true);
  assert.equal(analysis.governance.employmentContextDetected, true);
  assert.equal(analysis.governance.finalDecisionByHuman, true);
  assert.match(analysis.recommended_decision, /human review required/i);
  assert.match(analysis.executive_position, /must not make or execute hiring/i);
});

test('non-employment analysis remains advisory and retains its recommendation', () => {
  const analysis = applyHumanOversight({
    executive_position: 'The vendor terms require amendment.',
    recommended_decision: 'Sign Only After Material Revision',
    assumptions_and_limits: [],
    analysis_details: { live_ai_used: true }
  }, {
    text: 'The vendor may process customer data outside India.',
    options: { documentType: 'Vendor Agreement' }
  });

  assert.equal(analysis.recommended_decision, 'Sign Only After Material Revision');
  assert.equal(analysis.governance.employmentContextDetected, false);
  assert.deepEqual(analysis.governance.prohibitedAutonomousEmploymentDecisions, HUMAN_OVERSIGHT_POLICY.prohibitedAutonomousEmploymentDecisions);
});

test('fallback analysis exposes a provider failure and cannot be completed', () => {
  const failure = liveAnalysisFailure({
    analysis_details: {
      live_ai_used: false,
      failure: '429 You exceeded your current quota, please check your plan and billing details.'
    }
  });

  assert.equal(failure.code, 'OPENAI_QUOTA_EXCEEDED');
  assert.equal(failure.retryable, false);
});
