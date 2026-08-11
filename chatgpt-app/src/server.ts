import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { createMatterStore } from "./matter-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const WIDGET_URI = "ui://synesis/matter-workspace-v1.html";
const WIDGET_HTML = readFileSync(path.join(ROOT_DIR, "public", "widget.html"), "utf8");
const matterStore = createMatterStore();
const riskSchema = z.enum(["Critical", "High", "Medium", "Low"]);
const dispositionSchema = z.enum(["Must fix", "Raise", "Modify", "Accept with conditions", "Monitor", "Let go"]);
const taskStatusSchema = z.enum(["Not started", "In progress", "Blocked", "Ready for review", "Complete"]);
const documentSchema = z.object({ title: z.string().min(1).max(200), matter: z.string().min(1).max(200), jurisdiction: z.string().min(1).max(100), type: z.string().min(1).max(100), sourceHash: z.string().max(128).optional() });
const reviewSchema = z.object({ executivePosition: z.string().min(1).max(4000), recommendedDecision: z.string().min(1).max(1000), overallRisk: riskSchema, currentLawStatus: z.enum(["Source checked", "Not verified", "Not applicable"]), missingFacts: z.array(z.string().min(1).max(500)).max(20), limitations: z.array(z.string().min(1).max(500)).max(20) });
const findingSchema = z.object({ clauseReference: z.string().min(1).max(240), issue: z.string().min(1).max(800), evidence: z.string().min(8).max(1800), risk: riskSchema, confidence: z.number().int().min(0).max(100), whyItMatters: z.string().min(1).max(1200), recommendation: z.string().min(1).max(1200), protectiveLanguage: z.string().max(2400).optional(), disposition: dispositionSchema, owner: z.string().min(1).max(120) });
const taskSchema = z.object({ title: z.string().min(1).max(300), owner: z.string().min(1).max(120), due: z.string().min(1).max(100), priority: riskSchema, evidenceRequired: z.array(z.string().min(1).max(300)).max(12) });
const citationSchema = z.object({ title: z.string().min(1).max(300), url: z.string().url().max(2048), checkedAt: z.string().min(1).max(100) });

function responseForWorkspace(workspaceId: string, text: string) {
  const workspace = matterStore.getWorkspace(workspaceId);
  if (!workspace) throw new Error("The requested Synesis workspace was not found or has expired.");
  return { content: [{ type: "text" as const, text }], structuredContent: { workspace }, _meta: { "openai/outputTemplate": WIDGET_URI } };
}

function createAppServer(): McpServer {
  const server = new McpServer({ name: "synesis-chatgpt-workspace", version: "1.0.0" });
  registerAppResource(server, "synesis-matter-workspace", WIDGET_URI, {}, async () => ({
    contents: [{ uri: WIDGET_URI, mimeType: RESOURCE_MIME_TYPE, text: WIDGET_HTML, _meta: { ui: { prefersBorder: true, csp: { connectDomains: [], resourceDomains: [] } }, "openai/widgetDescription": "A source-bound SYNESIS legal matter workspace. It displays only the selected matter, its evidence-linked findings, current-law verification state, actions and decision brief." } }]
  }));

  registerAppTool(server, "synesis_open_workspace", {
    title: "Open a SYNESIS matter workspace",
    description: "Use this when a user starts a legal, regulatory, contract or policy matter in SYNESIS. Create one isolated workspace before saving a review. Do not use this tool to analyse the document; analyse the selected document in ChatGPT first.",
    inputSchema: { matter: z.string().min(1).max(200).describe("The isolated matter or transaction name."), jurisdiction: z.string().min(1).max(100).describe("Primary legal jurisdiction for this review.") },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
    _meta: { ui: { resourceUri: WIDGET_URI }, "openai/toolInvocation/invoking": "Opening an isolated SYNESIS matter", "openai/toolInvocation/invoked": "SYNESIS matter workspace opened" }
  }, async ({ matter, jurisdiction }) => {
    const workspace = matterStore.openWorkspace({ matter, jurisdiction });
    return { content: [{ type: "text" as const, text: "Opened an isolated SYNESIS matter workspace. Analyse the selected document in ChatGPT, then save only evidence-linked findings to this workspace." }], structuredContent: { workspace }, _meta: { "openai/outputTemplate": WIDGET_URI } };
  });

  registerAppTool(server, "synesis_save_review", {
    title: "Save an evidence-linked SYNESIS review",
    description: "Use this only after analysing the user's selected document in ChatGPT. Save a document-specific legal review with exact evidence quotations, risk, recommended position, tasks and verified current-law sources. Never invent a finding, source, legal change, date or monetary exposure. If current law was not source-checked, mark it Not verified and do not present a final legal conclusion.",
    inputSchema: { workspaceId: z.string().uuid(), document: documentSchema, review: reviewSchema, findings: z.array(findingSchema).min(1).max(30), tasks: z.array(taskSchema).max(30), citations: z.array(citationSchema).max(30) },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: { "openai/toolInvocation/invoking": "Saving evidence-linked review", "openai/toolInvocation/invoked": "SYNESIS review saved" }
  }, async ({ workspaceId, document, review, findings, tasks, citations }) => {
    if (review.currentLawStatus === "Source checked" && citations.length === 0) throw new Error("Current-law status cannot be Source checked without at least one cited source URL.");
    const workspace = matterStore.saveReview({ workspaceId, document, review, findings, tasks, citations });
    return { content: [{ type: "text" as const, text: "Saved a source-bound review for the selected matter. Call synesis_render_workspace to show the Synesis workspace." }], structuredContent: { workspace } };
  });

  registerAppTool(server, "synesis_render_workspace", {
    title: "Render the SYNESIS matter workspace",
    description: "Use this after opening or saving a SYNESIS matter, or when the user asks to view the selected matter. It renders the matter's evidence, findings, sources, tasks and decision posture. It never combines another matter's content.",
    inputSchema: { workspaceId: z.string().uuid() },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: { ui: { resourceUri: WIDGET_URI }, "openai/toolInvocation/invoking": "Loading the selected SYNESIS matter", "openai/toolInvocation/invoked": "SYNESIS matter ready" }
  }, async ({ workspaceId }) => responseForWorkspace(workspaceId, "Rendered the selected SYNESIS matter workspace."));

  registerAppTool(server, "synesis_update_task_status", {
    title: "Update a SYNESIS matter task",
    description: "Use this when the user explicitly changes the status of an action in the selected SYNESIS matter. It updates only that task in that workspace.",
    inputSchema: { workspaceId: z.string().uuid(), taskId: z.string().min(1).max(100), status: taskStatusSchema },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: { "openai/toolInvocation/invoking": "Updating matter task", "openai/toolInvocation/invoked": "Matter task updated" }
  }, async ({ workspaceId, taskId, status }) => {
    matterStore.setTaskStatus({ workspaceId, taskId, status });
    return responseForWorkspace(workspaceId, "Updated the selected matter task.");
  });

  registerAppTool(server, "synesis_create_decision_brief", {
    title: "Create a SYNESIS decision brief",
    description: "Use this when the user asks for a decision brief from the selected SYNESIS matter. The brief contains only that matter's document provenance, evidence-linked findings, source-verification state, tasks and decision posture. It is not an approval or final legal opinion.",
    inputSchema: { workspaceId: z.string().uuid() },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: { "openai/toolInvocation/invoking": "Compiling matter decision brief", "openai/toolInvocation/invoked": "Matter decision brief ready" }
  }, async ({ workspaceId }) => {
    const workspace = matterStore.getWorkspace(workspaceId);
    if (!workspace) throw new Error("The requested Synesis workspace was not found or has expired.");
    const decisionBriefMarkdown = matterStore.createDecisionBrief(workspaceId);
    return { content: [{ type: "text" as const, text: "Created a decision brief for the selected matter only." }], structuredContent: { workspace, decisionBriefMarkdown }, _meta: { "openai/outputTemplate": WIDGET_URI } };
  });
  return server;
}

const port = Number(process.env.PORT ?? "8787");
const MCP_PATH = "/mcp";
createServer(async (req, res) => {
  if (!req.url) { res.writeHead(400).end("Missing URL"); return; }
  const url = new URL(req.url, "http://" + (req.headers.host ?? "localhost"));
  const isMcpRoute = url.pathname === MCP_PATH || url.pathname.startsWith(MCP_PATH + "/");
  if (req.method === "OPTIONS" && isMcpRoute) {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS", "Access-Control-Allow-Headers": "content-type, mcp-session-id", "Access-Control-Expose-Headers": "Mcp-Session-Id" });
    res.end(); return;
  }
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ name: "synesis-chatgpt-workspace", mcp: MCP_PATH, modelProvider: "ChatGPT host — no server-side model key", storage: "Transient in-memory workspace only" })); return;
  }
  const transportMethods = new Set(["GET", "POST", "DELETE"]);
  if (isMcpRoute && req.method && transportMethods.has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
    const server = createAppServer(); const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { transport.close(); server.close(); });
    try { await server.connect(transport); await transport.handleRequest(req, res); }
    catch (error) { console.error("Failed to handle MCP request:", error); if (!res.headersSent) res.writeHead(500).end("Internal server error"); }
    return;
  }
  res.writeHead(404).end("Not Found");
}).listen(port, () => console.log("SYNESIS ChatGPT MCP server listening on http://localhost:" + port + MCP_PATH));
