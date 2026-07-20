import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDocument } from '../src/analysis-engine.js';

function analysisFixture({ title = 'Test document', score = 72, issue = 'Material approval ambiguity' } = {}) {
  return {
    document_title: title,
    document_type: 'Commercial Agreement',
    document_summary: 'The document creates a material approval and execution dependency.',
    overall_risk: score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low',
    overall_score: score,
    executive_position: 'Authorised approval and evidence should be resolved before execution.',
    findings: [{
      id: `finding-${score}`,
      clause_reference: 'Clause 4',
      clause_title: 'Approval mechanics',
      quoted_text: 'The transaction may proceed following internal approval.',
      issue,
      risk_category: 'Operational',
      risk_level: score >= 70 ? 'High' : 'Medium',
      risk_score: score,
      why_risky_for_bank: 'The approving authority, evidence and timing are undefined.',
      how_risk_may_materialise: 'Execution occurs before valid authority is evidenced.',
      impact: {
        legal: 'Authority may be challenged.',
        regulatory: 'Governance evidence may be incomplete.',
        financial: 'The organisation may incur avoidable exposure.',
        operational: 'Execution may be delayed or reversed.',
        data_cyber: 'No specific data impact identified.',
        reputational: 'A control failure may reduce stakeholder confidence.'
      },
      recommended_mitigation: 'Define the approver, approval standard, timing and retained evidence.',
      suggested_rewrite: 'The transaction shall proceed only after written approval by the authorised committee, evidenced in the matter record.',
      review_owner: ['Legal', 'Risk', 'Management'],
      priority: 'Before Signing',
      confidence: 88,
      verification_required: false
    }],
    missing_clauses: [],
    contradictions: [],
    regulatory_touchpoints: [{
      area: 'Governance and delegated authority',
      relevance: 'Execution depends on internal approval.',
      action: 'Verify the authority matrix and retain approval evidence.',
      verification_required: true
    }],
    scenario_tests: [{
      title: 'Execution before approval',
      trigger_from_document: 'The transaction may proceed following internal approval.',
      event: 'Operations proceeds without evidence of approval.',
      likely_outcome: 'The decision may be challenged and remediation may be required.',
      risk_level: 'High',
      recommended_control: 'Block execution until approval evidence is attached.'
    }],
    recommended_decision: 'Sign Only After Material Revision',
    assumptions_and_limits: ['Authority records were not included in the uploaded document.']
  };
}

function decisionFixture() {
  return {
    institutional_thesis: 'The document allocates decision authority and execution responsibility.',
    affected_areas: ['Governance', 'Operations', 'Risk'],
    parties_and_entities: [{
      name: 'The organisation',
      role: 'Decision-maker',
      interests: 'Controlled and authorised execution',
      exposure: 'Invalid or unsupported action'
    }],
    obligations: [{
      actor: 'Management',
      obligation: 'Approve the transaction before execution',
      trigger: 'Proposed execution',
      deadline_or_frequency: 'Before execution',
      evidence_required: 'Written approval in the matter record',
      consequence: 'Execution must be blocked',
      owner: 'Management'
    }],
    decision_questions: ['Who has final approval authority?'],
    unresolved_questions: ['Which authority matrix applies?'],
    dependencies: [{
      dependency: 'Written approval',
      affected_item: 'Transaction execution',
      failure_effect: 'Execution is unauthorised or delayed'
    }],
    action_plan: [{
      action: 'Confirm and evidence approval authority',
      owner: 'Legal',
      priority: 'Before Execution',
      approval_gate: 'Authorised committee approval',
      completion_evidence: 'Signed approval record'
    }],
    stakeholder_impact: {
      customers_or_unit_holders: 'No direct effect established from the document.',
      regulators: 'Governance evidence may be requested.',
      management: 'Management must make and evidence the decision.',
      operations: 'Operations must enforce the approval gate.',
      capital_or_financial: 'Invalid execution may create financial exposure.'
    },
    evidence_gaps: ['Authority matrix', 'Approval record']
  };
}

function queuedOpenAI(outputs) {
  const queue = [...outputs];
  return {
    responses: {
      async create() {
        const next = queue.shift();
        if (next instanceof Error) throw next;
        return { output_text: JSON.stringify(next), output: [] };
      }
    }
  };
}

test('deep mode uses independent live reasoning passes and returns execution intelligence', async () => {
  const primary = analysisFixture({ score: 72, issue: 'Undefined approval authority' });
  const decision = decisionFixture();
  const critic = analysisFixture({ score: 84, issue: 'Approval evidence is not a condition precedent' });
  const result = await analyzeDocument({
    openai: queuedOpenAI([primary, decision, critic]),
    model: 'test-model',
    text: 'Clause 4. The transaction may proceed following internal approval, but the approving person and evidence are not specified.',
    options: { title: 'Authority test', analysisMode: 'deep' }
  });

  assert.equal(result.engine, 'openai-deep-multipass');
  assert.equal(result.analysis_details.live_ai_used, true);
  assert.equal(result.analysis_details.independent_passes, 3);
  assert.equal(result.analysis_details.deterministic_rules_used_for_primary_result, false);
  assert.equal(result.decision_intelligence.institutional_thesis, decision.institutional_thesis);
  assert.ok(result.findings.some(item => item.issue === 'Undefined approval authority'));
  assert.ok(result.findings.some(item => item.issue === 'Approval evidence is not a condition precedent'));
});

test('AI failure is explicit and is never presented as completed live analysis', async () => {
  const result = await analyzeDocument({
    openai: queuedOpenAI([new Error('simulated provider failure')]),
    model: 'test-model',
    text: 'Vendor may use Bank customer data for model training and may retain it indefinitely after termination.',
    options: { title: 'Failure disclosure test', analysisMode: 'deep' }
  });

  assert.equal(result.engine, 'deterministic-emergency-fallback');
  assert.equal(result.analysis_details.live_ai_used, false);
  assert.match(result.analysis_details.failure, /simulated provider failure/i);
  assert.match(result.executive_position, /fallback/i);
  assert.ok(result.assumptions_and_limits.some(item => /must not be treated as the completed Synesis analysis/i.test(item)));
});
