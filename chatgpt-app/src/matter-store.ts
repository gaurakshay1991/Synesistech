import { createHash, randomUUID } from "node:crypto";

export type Risk = "Critical" | "High" | "Medium" | "Low";
export type TaskStatus = "Not started" | "In progress" | "Blocked" | "Ready for review" | "Complete";
export type Disposition = "Must fix" | "Raise" | "Modify" | "Accept with conditions" | "Monitor" | "Let go";

export interface DocumentMeta {
  title: string;
  matter: string;
  jurisdiction: string;
  type: string;
  sourceHash?: string;
}

export interface Review {
  executivePosition: string;
  recommendedDecision: string;
  overallRisk: Risk;
  currentLawStatus: "Source checked" | "Not verified" | "Not applicable";
  missingFacts: string[];
  limitations: string[];
}

export interface Finding {
  id: string;
  clauseReference: string;
  issue: string;
  evidence: string;
  risk: Risk;
  confidence: number;
  whyItMatters: string;
  recommendation: string;
  protectiveLanguage?: string;
  disposition: Disposition;
  owner: string;
}

export interface Task {
  id: string;
  title: string;
  owner: string;
  due: string;
  priority: Risk;
  evidenceRequired: string[];
  status: TaskStatus;
}

export interface Citation {
  title: string;
  url: string;
  checkedAt: string;
}

interface Workspace {
  workspaceId: string;
  matter: string;
  jurisdiction: string;
  createdAt: string;
  updatedAt: string;
  document?: DocumentMeta;
  review?: Review;
  findings: Finding[];
  tasks: Task[];
  citations: Citation[];
}

export interface WorkspaceView extends Workspace {
  storageNotice: string;
  dataPolicy: string;
}

type UnsavedFinding = Omit<Finding, "id">;
type UnsavedTask = Omit<Task, "id" | "status">;

function stableId(prefix: string, ...parts: string[]) {
  return `${prefix}-${createHash("sha256").update(parts.join("\u001f")).digest("hex").slice(0, 16)}`;
}

function copyWorkspace(workspace: Workspace): WorkspaceView {
  return {
    ...workspace,
    document: workspace.document ? { ...workspace.document } : undefined,
    review: workspace.review
      ? { ...workspace.review, missingFacts: [...workspace.review.missingFacts], limitations: [...workspace.review.limitations] }
      : undefined,
    findings: workspace.findings.map((finding) => ({ ...finding })),
    tasks: workspace.tasks.map((task) => ({ ...task, evidenceRequired: [...task.evidenceRequired] })),
    citations: workspace.citations.map((citation) => ({ ...citation })),
    storageNotice: "This developer-mode workspace is transient and is cleared when the MCP server restarts.",
    dataPolicy: "No full source document is accepted or stored by this server. Save only necessary evidence quotations and structured review data.",
  };
}

export function createMatterStore() {
  const workspaces = new Map<string, Workspace>();

  function getWorkspace(workspaceId: string) {
    const workspace = workspaces.get(workspaceId);
    return workspace ? copyWorkspace(workspace) : undefined;
  }

  return {
    openWorkspace(input: { matter: string; jurisdiction: string }) {
      const now = new Date().toISOString();
      const workspace: Workspace = {
        workspaceId: randomUUID(),
        matter: input.matter,
        jurisdiction: input.jurisdiction,
        createdAt: now,
        updatedAt: now,
        findings: [],
        tasks: [],
        citations: [],
      };
      workspaces.set(workspace.workspaceId, workspace);
      return copyWorkspace(workspace);
    },

    getWorkspace,

    saveReview(input: {
      workspaceId: string;
      document: DocumentMeta;
      review: Review;
      findings: UnsavedFinding[];
      tasks: UnsavedTask[];
      citations: Citation[];
    }) {
      const workspace = workspaces.get(input.workspaceId);
      if (!workspace) throw new Error("The requested Synesis workspace was not found or has expired.");
      if (input.findings.some((finding) => !finding.evidence.trim())) {
        throw new Error("Every finding needs document evidence before it can be saved.");
      }

      workspace.matter = input.document.matter;
      workspace.jurisdiction = input.document.jurisdiction;
      workspace.document = { ...input.document };
      workspace.review = {
        ...input.review,
        missingFacts: [...input.review.missingFacts],
        limitations: [...input.review.limitations],
      };
      workspace.findings = input.findings.map((finding, index) => ({
        ...finding,
        id: stableId("finding", workspace.workspaceId, String(index), finding.clauseReference, finding.issue),
      }));
      workspace.tasks = input.tasks.map((task, index) => ({
        ...task,
        id: stableId("task", workspace.workspaceId, String(index), task.title),
        evidenceRequired: [...task.evidenceRequired],
        status: "Not started",
      }));
      workspace.citations = input.citations.map((citation) => ({ ...citation }));
      workspace.updatedAt = new Date().toISOString();
      return copyWorkspace(workspace);
    },

    setTaskStatus(input: { workspaceId: string; taskId: string; status: TaskStatus }) {
      const workspace = workspaces.get(input.workspaceId);
      if (!workspace) throw new Error("The requested Synesis workspace was not found or has expired.");
      const task = workspace.tasks.find((item) => item.id === input.taskId);
      if (!task) throw new Error("The requested task does not belong to the selected Synesis matter.");
      task.status = input.status;
      workspace.updatedAt = new Date().toISOString();
      return copyWorkspace(workspace);
    },

    createDecisionBrief(workspaceId: string) {
      const workspace = workspaces.get(workspaceId);
      if (!workspace) throw new Error("The requested Synesis workspace was not found or has expired.");
      if (!workspace.document || !workspace.review) {
        throw new Error("Save an evidence-linked review before creating a decision brief.");
      }

      const lines = [
        "# SYNESIS — Matter Decision Brief",
        "",
        "## Scope and provenance",
        `- Matter: ${workspace.document.matter}`,
        `- Document: ${workspace.document.title} (${workspace.document.type})`,
        `- Jurisdiction: ${workspace.document.jurisdiction}`,
        `- Updated: ${workspace.updatedAt}`,
        workspace.document.sourceHash ? `- Source hash: ${workspace.document.sourceHash}` : "- Source hash: Not recorded",
        "",
        "## Executive position",
        workspace.review.executivePosition,
        "",
        `**Recommended decision:** ${workspace.review.recommendedDecision}`,
        `**Overall risk:** ${workspace.review.overallRisk}`,
        `**Current-law verification:** ${workspace.review.currentLawStatus}`,
        "",
        "## Evidence-linked findings",
        ...workspace.findings.flatMap((finding, index) => [
          `### ${index + 1}. ${finding.issue} — ${finding.risk} / ${finding.disposition}`,
          `- Clause: ${finding.clauseReference}`,
          `- Evidence: ${finding.evidence}`,
          `- Why it matters: ${finding.whyItMatters}`,
          `- Recommendation: ${finding.recommendation}`,
          finding.protectiveLanguage ? `- Protective language: ${finding.protectiveLanguage}` : "- Protective language: Not provided",
          `- Owner: ${finding.owner}; confidence: ${finding.confidence}%`,
          "",
        ]),
        "## Current-law sources",
        ...(workspace.citations.length
          ? workspace.citations.map((citation) => `- [${citation.title}](${citation.url}) — checked ${citation.checkedAt}`)
          : ["- No source citation was saved. Do not treat this as a source-checked legal conclusion."]),
        "",
        "## Missing facts and limitations",
        ...(workspace.review.missingFacts.length ? workspace.review.missingFacts.map((item) => `- Missing fact: ${item}`) : ["- No missing facts recorded."]),
        ...workspace.review.limitations.map((item) => `- Limitation: ${item}`),
        "",
        "## Selected matter actions",
        ...(workspace.tasks.length
          ? workspace.tasks.map((task) => `- [${task.status}] ${task.title} — ${task.owner}; due ${task.due}; priority ${task.priority}`)
          : ["- No action was saved for this matter."]),
        "",
        "This brief contains the selected matter only. It is a working aid, not an approval, final legal opinion or substitute for human review.",
      ];
      return lines.join("\n");
    },
  };
}
