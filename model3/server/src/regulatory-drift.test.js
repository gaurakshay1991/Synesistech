import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreRegulatoryDrift, mapRegulatoryDrift, applyRegulatoryDrift, resolveDocumentDrift } from './regulatory-drift.js';

const document = {
  id: 'doc-1', title: 'Vendor Data Agreement', matter: 'Bank outsourcing', jurisdiction: 'India', documentType: 'Agreement',
  analysis: {
    recommended_decision: 'CLEAR_WITH_CONDITIONS',
    live_current_law: { researchedAt: '2026-07-01T00:00:00Z' },
    regulatory_impact: {
      referenceInventory: [{ reference: 'RBI Master Direction on Outsourcing of Information Technology Services, 2023' }],
      citedAuthorities: [{ documentReference: 'RBI Master Direction on Outsourcing of Information Technology Services, 2023', currentInstrument: 'RBI Master Direction on Outsourcing of Information Technology Services, 2023' }]
    }
  }
};

const update = {
  id: 'live-rbi-1', title: 'Amendment to Master Direction on Outsourcing of Information Technology Services',
  summary: 'Reserve Bank of India modifies requirements under the outsourcing direction.', regulator: 'Reserve Bank of India',
  sourceName: 'Reserve Bank of India — Notifications', jurisdiction: 'India', domain: 'Banking / technology outsourcing',
  changeType: 'Amendment / modification', sourceReference: 'https://rbi.org.in/example', publishedDate: '2026-08-09', effectiveDate: '2026-09-01', firstSeenAt: '2026-08-09T10:00:00Z'
};

test('highly related official change maps to the exact matter', () => {
  const scored = scoreRegulatoryDrift(document, update);
  assert.ok(scored.score >= 55, `score=${scored.score}`);
  const mapped = mapRegulatoryDrift([document], [update]);
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].documentId, 'doc-1');
  assert.equal(mapped[0].status, 'REVALIDATION_REQUIRED');
  assert.equal(mapped[0].automaticLegalConclusionMade, false);
});

test('unrelated regulatory update does not re-open the matter', () => {
  const unrelated = { ...update, id: 'other', title: 'Pension withdrawal process update', summary: 'PFRDA changes NPS withdrawal forms.', regulator: 'PFRDA', sourceName: 'PFRDA', domain: 'Pensions' };
  assert.equal(mapRegulatoryDrift([document], [unrelated]).length, 0);
});

test('applying drift creates matter-specific alert and revalidation task once', () => {
  const candidate = mapRegulatoryDrift([document], [update])[0];
  const state = { alerts: [], tasks: [], metrics: {} };
  applyRegulatoryDrift(state, [candidate, candidate]);
  assert.equal(state.regulatoryDrift.length, 1);
  assert.equal(state.alerts.filter(item => item.documentId === 'doc-1').length, 1);
  assert.equal(state.tasks.filter(item => item.documentId === 'doc-1').length, 1);
  assert.equal(state.metrics.regulatoryDriftOpen, 1);
});

test('fresh revalidation closes the open drift task without deleting history', () => {
  const candidate = mapRegulatoryDrift([document], [update])[0];
  const state = { alerts: [], tasks: [], metrics: {} };
  applyRegulatoryDrift(state, [candidate]);
  resolveDocumentDrift(state, 'doc-1', { status: 'REVALIDATED_IMPACTED', note: 'Fresh impact audit completed', by: 'legal@example.com' });
  assert.equal(state.regulatoryDrift[0].status, 'REVALIDATED_IMPACTED');
  assert.equal(state.tasks[0].status, 'Completed');
  assert.equal(state.metrics.regulatoryDriftOpen, 0);
});
