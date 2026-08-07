import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDocumentExposureModel, quantifyFindingExposure, extractMonetarySignals } from './exposure.js';

const liabilityFinding = { id: 'f1', category: 'Limitation of liability', risk_level: 'High', issue: 'Potentially uncapped liability' };

test('exposure engine detects an express liability ceiling instead of inventing damages', () => {
  const text = 'The aggregate liability of the Supplier shall not exceed INR 2 crore during the term.';
  const result = quantifyFindingExposure(liabilityFinding, text);
  assert.equal(result.quantificationStatus, 'Bounded by express document amount');
  assert.equal(result.directContractualExposure.currency, 'INR');
  assert.equal(result.directContractualExposure.ceiling, 20_000_000);
  assert.ok(result.confidence >= 80);
});

test('uncapped liability is represented as contractually unbounded with no fabricated monetary ceiling', () => {
  const text = 'The Supplier shall have unlimited liability for all losses and damages arising under this Agreement.';
  const result = quantifyFindingExposure(liabilityFinding, text);
  assert.equal(result.quantificationStatus, 'Unbounded contractually');
  assert.equal(result.directContractualExposure.ceiling, null);
  assert.match(result.exposureLabel, /No express monetary ceiling/i);
});

test('high severity without a reliable amount remains unquantified', () => {
  const finding = { id: 'f2', category: 'Data protection', risk_level: 'High', issue: 'Incident notice is missing' };
  const result = quantifyFindingExposure(finding, 'The processor handles personal data but the contract contains no incident notification deadline.');
  assert.equal(result.quantificationStatus, 'Not reliably quantifiable from current evidence');
  assert.equal(result.directContractualExposure.currency, null);
});

test('document model keeps risk severity separate from monetary quantification', () => {
  const analysis = { overall_risk: 'High', findings: [
    { id: 'f1', category: 'Limitation of liability', risk_level: 'High', issue: 'Liability cap concern' },
    { id: 'f2', category: 'Data protection', risk_level: 'Medium', issue: 'Weak breach notification' },
    { id: 'f3', category: 'Style', risk_level: 'Low', issue: 'Formatting' }
  ] };
  const model = buildDocumentExposureModel(analysis, 'The contract value is INR 50 lakh. No other monetary limits are stated.');
  assert.equal(model.materialFindings, 2);
  assert.ok(model.exposures.every(item => ['High', 'Medium'].includes(item.riskLevel)));
  assert.ok(model.methodology.some(item => /severity and monetary exposure/i.test(item)));
});

test('monetary signal extraction understands Indian crore and lakh units', () => {
  const signals = extractMonetarySignals('Contract value INR 3 crore. Insurance coverage ₹50 lakh.');
  assert.ok(signals.some(item => item.amount === 30_000_000));
  assert.ok(signals.some(item => item.amount === 5_000_000));
});
