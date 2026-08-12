import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatterDecisionBrief, matterDecisionBriefFileName } from './matter-brief.js';

const document = {
  id: 'matter-1',
  title: 'TriArc Services Agreement',
  matter: 'Vendor onboarding',
  jurisdiction: 'India',
  documentType: 'Master services agreement',
  analysis: {
    engine: 'live multipass',
    overall_risk: 'High',
    overall_score: 78,
    executive_position: 'The uncapped indemnity should be negotiated before clearance.',
    recommended_decision: 'Negotiate before clearance',
    analysis_details: { document_isolation: 'single-document', live_ai_used: true, current_law_web_used: true },
    findings: [{
      issue: 'Uncapped indemnity', risk_level: 'High', clause_reference: 'Clause 12',
      quoted_text: 'Supplier shall indemnify Customer for all losses without limitation.',
      institutional_impact: 'The supplier accepts no cap on third-party and direct claims.',
      recommended_mitigation: 'Cap liability and exclude indirect loss.'
    }],
    live_current_law: { liveWebUsed: true, answer: 'No current-law exception to the required contractual allocation was confirmed.', citations: [{ title: 'Official source', url: 'https://example.gov.in/source' }] },
    regulatory_impact: { overallImpact: 'High', staleReferenceWarning: true, citedAuthorities: [{ documentReference: 'DPDP Act', currentStatus: 'AMENDED', amendmentOrSupersession: 'Verify the current rules before signing.' }], requiredActions: [{ title: 'Complete privacy review', owner: 'Compliance' }] },
    exposure_model: { exposures: [{ category: 'Indemnity', quantificationStatus: 'Contractually unbounded', exposureLabel: 'Contractually unbounded', rationale: 'No express ceiling appears in the selected document.' }] }
  }
};

test('creates a selected-matter brief without copying the source document', () => {
  const brief = createMatterDecisionBrief({
    document,
    decisionPack: { overall_disposition: 'NEGOTIATE_BEFORE_CLEARANCE', clearance_recommendation: 'Do not clear before the liability position is corrected.', executive_rationale: 'The uncapped indemnity is a material commercial and legal issue.', must_fix: [{ issue: 'Uncapped indemnity', why: 'No contractual ceiling.' }] },
    tasks: [
      { documentId: 'matter-1', title: 'Obtain vendor counterproposal', owner: 'Legal', due: '2026-08-14', status: 'Not started' },
      { documentId: 'other-matter', title: 'This must not enter the selected-matter brief', owner: 'Risk', due: '2026-08-20', status: 'Not started' }
    ],
    generatedAt: '2026-08-10T18:00:00.000Z'
  });

  assert.match(brief, /TriArc Services Agreement/);
  assert.match(brief, /NEGOTIATE_BEFORE_CLEARANCE/);
  assert.match(brief, /Supplier shall indemnify Customer for all losses without limitation/);
  assert.match(brief, /Contractually unbounded/);
  assert.match(brief, /https:\/\/example.gov.in\/source/);
  assert.doesNotMatch(brief, /sourceText/i);
  assert.doesNotMatch(brief, /This must not enter the selected-matter brief/);
  assert.equal(matterDecisionBriefFileName(document), 'synesis-triarc-services-agreement-decision-brief.md');
});
