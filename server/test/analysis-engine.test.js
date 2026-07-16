import test from 'node:test';
import assert from 'node:assert/strict';
import { heuristicAnalyze, compareAnalyses } from '../src/analysis-engine.js';

const defective = `TEST AGREEMENT
This Vendor Services Agreement is between ABC Bank Limited (Bank) and QuickData Solutions (Vendor).
1. Services and Scope. The scope may be changed by email, oral instruction, dashboard message, invoice or conduct without a formal written amendment. Time shall not be of the essence for Vendor.
2. Bank Data. Vendor may use customer KYC records, Aadhaar copies, account details and sanctions results for improving its products, analytics, benchmarking, system training and investor demonstrations. Derived data shall belong exclusively to Vendor.
3. Confidentiality. Vendor may share Bank Data with affiliates, consultants, subcontractors, cloud providers, technology partners, investors and advisers without prior written consent of the Bank. Confidentiality obligations survive only six months. Vendor is not required to return or delete Bank Data.
4. Cross-border. Vendor may store and process Bank Data in India, Singapore, UAE, EU, US or any other jurisdiction selected by Vendor. Vendor will follow privacy laws where commercially feasible and Bank is solely responsible for consents and penalties.
5. Subcontracting. Vendor may subcontract to any affiliate, freelancer, cloud provider or offshore centre without approval. Vendor shall not be liable for any subcontractor.
6. Security. Vendor need not comply with Bank cyber policies and shall notify a material data breach within thirty business days after Vendor determines it is material. Vendor need not provide logs, root-cause analysis or forensic reports. Bank and regulators shall not have audit rights.
7. Compliance. Vendor shall not be responsible for RBI directions, outsourcing guidelines, KYC/AML, DPDP, FEMA, cyber security or Bank policies. This Agreement shall prevail over regulatory expectations.
8. Liability. Vendor liability shall not exceed INR 50,000 or one month fees, whichever is lower. Vendor shall not be liable for data breach, regulatory penalties, fraud, wilful misconduct, gross negligence or subcontractor failure. Bank shall indemnify Vendor.
9. Termination. Bank may not terminate for convenience and must give Vendor 180 days to cure. Vendor may terminate immediately for convenience. Vendor may retain Bank Data for as long as it considers necessary.
10. Governing law. Singapore law and Singapore courts have exclusive jurisdiction, but Vendor may sue in any jurisdiction. Vendor may refer to Bank in investor decks and any Bank employee is deemed authorised to bind the Bank.`;

const corrected = `TEST AGREEMENT
This Vendor Services Agreement is between ABC Bank Limited (Bank) and QuickData Solutions (Vendor).
1. Services. The Vendor shall provide the Services strictly under a written statement of work. No amendment is valid unless approved in writing by authorised representatives of both Parties. The Vendor shall meet binding service levels and timelines.
2. Data. Bank Data remains the property and confidential information of the Bank. Vendor shall process Bank Data solely on documented instructions of the Bank and shall not use it for model training, analytics, marketing, benchmarking or other independent purposes.
3. Confidentiality. Vendor shall disclose Bank Data only to approved need-to-know personnel and approved subcontractors under equivalent obligations. Confidentiality survives for as long as the information remains confidential. On termination Vendor shall return or securely delete Bank Data and provide a deletion certificate.
4. Data location. Vendor shall not process or access Bank Data outside approved locations without the Bank's prior written approval and required legal, regulatory and security assessments.
5. Subcontracting. Vendor shall not subcontract material Services without prior written approval and remains fully responsible for all subcontractors.
6. Security. Vendor shall comply with Bank security requirements, encryption, access controls, logging, testing, BCP and DR. Vendor shall notify the Bank within twenty-four hours of any suspected or actual incident and provide logs, root-cause analysis, remediation evidence and regulatory support. The Bank and regulators have reasonable audit and inspection rights.
7. Compliance. Vendor shall comply with applicable law, regulatory directions and Bank policies notified to it in relation to the Services.
8. Liability. Vendor shall indemnify the Bank for Vendor breach, negligence, unlawful processing, security incidents, infringement and subcontractors. Liability limits do not apply to fraud, wilful misconduct, gross negligence, confidentiality, data breach, regulatory penalties caused by Vendor or indemnities.
9. Termination. Bank may terminate for convenience on thirty days' notice and immediately for regulatory, security, data, sanctions, insolvency, service failure or unauthorised subcontracting events. Vendor shall provide transition, data return and deletion support.
10. Governing law. Indian law and New Delhi courts apply. Vendor may not use the Bank's name without prior written approval. Only authorised representatives may bind the Bank.`;

test('defective agreement produces materially higher Bank risk than corrected agreement', () => {
  const bad = heuristicAnalyze(defective, { title: 'Defective agreement', documentType: 'Vendor / Outsourcing Agreement' });
  const good = heuristicAnalyze(corrected, { title: 'Corrected agreement', documentType: 'Vendor / Outsourcing Agreement' });
  assert.equal(bad.overall_risk, 'High');
  assert.ok(bad.overall_score >= good.overall_score + 25, `${bad.overall_score} should materially exceed ${good.overall_score}`);
  assert.ok(bad.findings.filter(item => item.risk_level === 'High').length >= 8);
  assert.ok(good.findings.filter(item => item.risk_level === 'High').length <= 2);
  const comparison = compareAnalyses(bad, good);
  assert.ok(comparison.score_delta > 0);
});

test('slow breach notification is found and a 24-hour clause reduces that finding', () => {
  const slow = heuristicAnalyze('Vendor shall notify the Bank of a data breach within thirty business days after Vendor determines it is material.', { documentType: 'Vendor / Outsourcing Agreement' });
  const fast = heuristicAnalyze('Vendor shall notify the Bank immediately and in any event within twenty-four hours of becoming aware of any suspected or actual data breach and shall provide logs and remediation evidence.', { documentType: 'Vendor / Outsourcing Agreement' });
  assert.ok(slow.findings.some(item => item.id.startsWith('slow-incident-notification')));
  assert.ok(!fast.findings.some(item => item.id.startsWith('slow-incident-notification')));
  assert.ok(slow.overall_score > fast.overall_score);
});

test('analysis is document-specific rather than title-specific', () => {
  const nda = heuristicAnalyze('The Recipient shall keep Confidential Information confidential. The obligation shall survive for five years. The Recipient may disclose to advisers on a need-to-know basis under equivalent duties.', { title: 'Vendor agreement', documentType: 'NDA / Confidentiality Agreement' });
  const vendor = heuristicAnalyze(defective, { title: 'Vendor agreement', documentType: 'Vendor / Outsourcing Agreement' });
  assert.notEqual(nda.overall_score, vendor.overall_score);
  assert.ok(vendor.findings.length > nda.findings.length);
});

test('adverse clauses are not mistaken for protective language in a compact document', () => {
  const compact = `VENDOR SERVICES AGREEMENT.
  Vendor may use Bank customer KYC records for model training and investor demonstrations.
  Vendor may subcontract offshore without approval and is not liable for subcontractors.
  Vendor will notify a data breach within thirty business days.
  Bank and regulators shall not have audit rights.
  Vendor liability is INR 50,000.
  Vendor may terminate immediately; Bank may not terminate for convenience.`;
  const result = heuristicAnalyze(compact, { documentType: 'Vendor / Outsourcing Agreement' });
  assert.equal(result.overall_risk, 'High');
  assert.ok(result.overall_score >= 85);
  assert.ok(result.findings.length >= 7);
  assert.ok(result.findings.some(item => item.issue === 'Inadequate Bank and regulatory audit access'));
  assert.ok(result.findings.some(item => item.issue === 'Unauthorised secondary use of Bank Data'));
});
