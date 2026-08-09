import test from 'node:test';
import assert from 'node:assert/strict';
import { extractLegalReferences, normalizeRegulatoryImpact, emptyRegulatoryImpact, regulatoryImpactResearchQuestion } from './regulatory-impact.js';
import { LIVE_SOURCE_CATALOG, classifyLegalChange } from './source-catalog.js';

test('extracts named acts, rules and regulatory circulars from the selected document', () => {
  const text = `This Agreement shall comply with the Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025. The parties also refer to RBI Master Direction RBI/DBR/2015-16/18 and Circular No. RBI/2022-23/01 dated 1 April 2022.`;
  const refs = extractLegalReferences(text);
  const labels = refs.map(item => item.reference).join(' | ');
  assert.match(labels, /Digital Personal Data Protection Act, 2023/i);
  assert.match(labels, /Digital Personal Data Protection Rules, 2025/i);
  assert.match(labels, /RBI Master Direction/i);
});

test('normalization makes amended or superseded references a stale-reference warning', () => {
  const refs = [{ id: 'ref-1', reference: 'Circular No. OLD/1', context: '', nearbySections: [] }];
  const impact = normalizeRegulatoryImpact({
    overallImpact: 'HIGH',
    staleReferenceWarning: false,
    citedAuthorities: [{ referenceId: 'ref-1', documentReference: 'Circular No. OLD/1', currentStatus: 'SUPERSEDED', currentInstrument: 'Master Circular NEW/9', amendmentOrSupersession: 'Replaced in full', effectiveDate: '2026-01-01', impact: 'Document procedure is stale.', sourceUrls: ['https://rbi.org.in/example'] }],
    complianceImpacts: [{ dimension: 'Reporting / filing', impactLevel: 'High', requirement: 'Use new reporting process' }],
    requiredActions: [{ title: 'Replace stale circular reference' }],
    decisionEffect: 'Do not clear until updated.'
  }, refs, { liveWebUsed: true, citations: [{ url: 'https://rbi.org.in/example', title: 'Official source' }], researchedAt: '2026-08-09T00:00:00Z' });
  assert.equal(impact.staleReferenceWarning, true);
  assert.equal(impact.citedAuthorities[0].currentStatus, 'SUPERSEDED');
  assert.equal(impact.overallImpact, 'HIGH');
  assert.equal(impact.liveWebUsed, true);
});

test('unavailable live research never converts references into a current-law conclusion', () => {
  const refs = [{ id: 'ref-1', reference: 'Some Act, 2020' }];
  const impact = emptyRegulatoryImpact(refs, 'provider unavailable');
  assert.equal(impact.status, 'UNAVAILABLE');
  assert.equal(impact.citedAuthorities[0].currentStatus, 'NOT_VERIFIED');
  assert.equal(impact.staleReferenceWarning, false);
});

test('research question explicitly requires omitted-authority and amendment checks', () => {
  const q = regulatoryImpactResearchQuestion([{ id: 'ref-1', reference: 'Some Circular No. 1', nearbySections: ['section 4'] }]);
  assert.match(q, /amended, superseded, repealed, withdrawn/i);
  assert.match(q, /failed to cite/i);
  assert.match(q, /transition/i);
});

test('India source map is broad enough for general legal/compliance work', () => {
  const india = LIVE_SOURCE_CATALOG.filter(item => item.jurisdiction === 'India');
  const domains = new Set(india.flatMap(item => item.allowedDomains || []));
  for (const domain of ['rbi.org.in','sebi.gov.in','indiacode.nic.in','mca.gov.in','meity.gov.in','incometax.gov.in','labour.gov.in','cci.gov.in','sci.gov.in','ifsca.gov.in','irdai.gov.in','pfrda.org.in']) {
    assert.ok(domains.has(domain), `missing ${domain}`);
  }
});

test('legal change classifier distinguishes supersession from an ordinary update', () => {
  assert.equal(classifyLegalChange('Circular X superseded and withdrawn'), 'Repeal / rescission / supersession');
  assert.equal(classifyLegalChange('Amendment Regulations 2026'), 'Amendment / modification');
});
