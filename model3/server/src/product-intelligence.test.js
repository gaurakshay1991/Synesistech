import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDocumentGraph, buildClauseMemory, operationalStateFromDocuments, materialityBand } from './product-intelligence.js';

const document = {
  id: 'doc-x',
  title: 'Unique Xenon Agreement',
  overallRisk: 'High',
  analysis: {
    overall_risk: 'High',
    findings: [
      {
        id: 'f-x',
        category: 'Custom delivery risk',
        risk_level: 'High',
        confidence: 91,
        issue: 'XENON-DELTA delivery obligation is uncapped',
        clause_reference: 'Clause 17.9',
        quoted_text: 'Supplier bears unlimited XENON-DELTA replacement costs.',
        recommended_mitigation: 'Cap replacement exposure.',
        suggested_rewrite: 'Supplier replacement exposure shall be capped.'
      }
    ],
    obligations: [{ id: 'ob-x', title: 'Cap XENON-DELTA replacement exposure', risk: 'High', owner: 'Legal' }],
    actors: ['Supplier'],
    regulatory_touchpoints: ['Custom XENON regime'],
    analysis_details: { clause_fingerprint: 'abc123' }
  }
};

test('materiality bands identify high-confidence high risk as worth raising', () => {
  assert.equal(materialityBand(document.analysis.findings[0]), 'RAISE');
});

test('document graph is derived from the exact uploaded matter', () => {
  const graph = buildDocumentGraph(document);
  assert.ok(graph.nodes.some(node => node.label === 'Unique Xenon Agreement'));
  assert.ok(graph.nodes.some(node => node.label.includes('XENON-DELTA')));
  assert.ok(graph.nodes.some(node => node.type === 'Clause' && node.text.includes('XENON-DELTA')));
  assert.ok(graph.edges.some(edge => edge.relation === 'GROUNDED_IN'));
});

test('clause memory candidates preserve exact source clause and remain unvalidated', () => {
  const memory = buildClauseMemory(document);
  assert.equal(memory.length, 1);
  assert.match(memory[0].sourceClause, /XENON-DELTA/);
  assert.match(memory[0].status, /not institutional memory/i);
});

test('operational state suppresses seeded demo data and retains document-derived work', () => {
  const raw = {
    metrics: { attention: 99, preventedExposure: 999999999 },
    alerts: [{ id: 'seed-alert', title: 'Seed alert' }],
    tasks: [{ id: 'seed-task', title: 'Seed task' }, { id: 'real-task', documentId: 'doc-x', title: 'Real task', status: 'Not started', priority: 'High' }],
    obligations: [{ id: 'seed-ob' }, { id: 'real-ob', documentId: 'doc-x', risk: 'High' }],
    decisions: [{ id: 'seed-dec', status: 'Pending' }, { id: 'real-dec', documentId: 'doc-x', status: 'Pending' }],
    controls: [{ id: 'seed-control' }],
    memories: [{ id: 'seed-memory' }],
    regulatoryUpdates: [
      { id: 'sample', title: 'Outsourcing update — sample assessment', sourceReference: '' },
      { id: 'live', title: 'Official update', sourceReference: 'https://example.com/official' }
    ],
    clauseMemory: { feedbackEvents: [{ id: 'seed-fb' }, { id: 'real-fb', documentId: 'doc-x' }] },
    litigationSimulations: [],
    liveBrain: { monitoredBackgroundSources: 3, lastDetectedCount: 2 }
  };
  const clean = operationalStateFromDocuments(raw, [document]);
  assert.equal(clean.demoContentSuppressed, true);
  assert.deepEqual(clean.tasks.map(item => item.id), ['real-task']);
  assert.deepEqual(clean.obligations.map(item => item.id), ['real-ob']);
  assert.deepEqual(clean.decisions.map(item => item.id), ['real-dec']);
  assert.equal(clean.controls.length, 0);
  assert.equal(clean.memories.length, 0);
  assert.deepEqual(clean.regulatoryUpdates.map(item => item.id), ['live']);
  assert.deepEqual(clean.clauseMemory.feedbackEvents.map(item => item.id), ['real-fb']);
  assert.ok(clean.alerts.some(item => item.title.includes('XENON-DELTA')));
  assert.equal(clean.metrics.preventedExposure, 0);
});
