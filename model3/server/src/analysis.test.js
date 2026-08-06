import test from 'node:test';
import assert from 'node:assert/strict';
import { extractText, analyzeDocument, symbolicClauseAssessment } from './analysis.js';

test('pasted text is extracted and hashed', async () => {
  const result = await extractText(null, 'This agreement contains sufficient readable text for analysis and testing.');
  assert.equal(result.mimeType, 'text/plain');
  assert.equal(result.hash.length, 64);
});

test('symbolic engine detects material legal protections and produces a trace', () => {
  const result = symbolicClauseAssessment(
    'The supplier shall have unlimited liability for all losses. The customer may audit records. Security incidents shall be notified within 24 hours.',
    { matter: 'Vendor agreement', jurisdiction: 'India' }
  );
  assert.ok(result.rules_fired.some(item => item.id === 'LIABILITY-UNLIMITED'));
  assert.ok(result.positive_controls.some(item => item.id === 'AUDIT-RIGHT-PRESENT'));
  assert.ok(result.positive_controls.some(item => item.id === 'INCIDENT-TIMING-PRESENT'));
  assert.equal(result.clause_fingerprint.length, 64);
  assert.ok(result.metadata.rulesEvaluated >= 10);
});

test('fallback is explicit, document-specific and neuro-symbolically traceable', async () => {
  const result = await analyzeDocument({
    client: null,
    model: 'none',
    text: 'The supplier shall have unlimited liability for all losses and shall process personal data.',
    options: { matter: 'Vendor agreement', documentType: 'Agreement', jurisdiction: 'India' }
  });
  assert.equal(result.analysis_details.live_ai_used, false);
  assert.match(result.engine, /neuro-symbolic fallback/i);
  assert.ok(result.findings.some(item => /unlimited|uncapped/i.test(item.issue)));
  assert.ok(result.neuro_symbolic.symbolic_signal_score >= 1);
  assert.ok(result.reasoning_trace.length >= 1);
  assert.equal(result.litigation_risk.status, 'Illustrative indicator — not legal prediction');
  assert.ok(Array.isArray(result.clause_memory_candidates));
});
