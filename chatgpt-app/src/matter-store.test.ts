import assert from "node:assert/strict";
import test from "node:test";

import { createMatterStore } from "./matter-store.js";

const review = {
  executivePosition: "Do not clear until the data-use, liability and exit controls are corrected.",
  recommendedDecision: "Modify before clearance",
  overallRisk: "High" as const,
  currentLawStatus: "Source checked" as const,
  missingFacts: ["Whether Indian personal data will be transferred outside India."],
  limitations: ["No full source document is stored by this workspace."],
};

test("stores only the selected matter's structured review and produces an isolated brief", () => {
  const store = createMatterStore();
  const first = store.openWorkspace({ matter: "Aster supplier agreement", jurisdiction: "India" });
  const second = store.openWorkspace({ matter: "Unrelated policy", jurisdiction: "India" });

  const saved = store.saveReview({
    workspaceId: first.workspaceId,
    document: { title: "Supplier Services Agreement", matter: "Aster supplier agreement", jurisdiction: "India", type: "Agreement", sourceHash: "test-hash" },
    review,
    findings: [{
      clauseReference: "Clause 8.1",
      issue: "Supplier liability is capped at three months' fees.",
      evidence: "The Supplier's aggregate liability shall not exceed fees received in the prior three months.",
      risk: "High",
      confidence: 92,
      whyItMatters: "The cap excludes losses from the supplier-controlled data and security risks.",
      recommendation: "Require a higher aggregate cap and uncapped carve-outs.",
      protectiveLanguage: "Liability for confidentiality, data protection and indemnity shall be uncapped.",
      disposition: "Modify",
      owner: "Legal",
    }],
    tasks: [{ title: "Negotiate data and liability carve-outs", owner: "Legal", due: "Before execution", priority: "High", evidenceRequired: ["Revised redline"] }],
    citations: [{ title: "Example official source", url: "https://example.com/source", checkedAt: "2026-08-10" }],
  });

  assert.equal(saved.document?.title, "Supplier Services Agreement");
  assert.equal(saved.findings.length, 1);
  assert.equal("sourceText" in saved, false);
  assert.equal(store.getWorkspace(second.workspaceId)?.findings.length, 0);

  const brief = store.createDecisionBrief(first.workspaceId);
  assert.match(brief, /Supplier liability is capped/);
  assert.match(brief, /Negotiate data and liability carve-outs/);
  assert.doesNotMatch(brief, /Unrelated policy/);
});

test("updates only a task that belongs to the selected workspace", () => {
  const store = createMatterStore();
  const workspace = store.openWorkspace({ matter: "Task isolation", jurisdiction: "India" });
  const saved = store.saveReview({
    workspaceId: workspace.workspaceId,
    document: { title: "Test agreement", matter: "Task isolation", jurisdiction: "India", type: "Agreement" },
    review: { ...review, currentLawStatus: "Not verified" },
    findings: [{
      clauseReference: "Clause 1",
      issue: "One-sided termination right.",
      evidence: "The Supplier may terminate immediately without cause.",
      risk: "High",
      confidence: 90,
      whyItMatters: "The customer has no equivalent exit right.",
      recommendation: "Make termination rights mutual.",
      disposition: "Modify",
      owner: "Legal",
    }],
    tasks: [{ title: "Make termination mutual", owner: "Legal", due: "Before execution", priority: "High", evidenceRequired: [] }],
    citations: [],
  });

  const updated = store.setTaskStatus({ workspaceId: workspace.workspaceId, taskId: saved.tasks[0].id, status: "Ready for review" });
  assert.equal(updated.tasks[0].status, "Ready for review");
});
