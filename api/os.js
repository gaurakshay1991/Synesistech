import express from 'express';
import rateLimit from 'express-rate-limit';
import { neon } from '@neondatabase/serverless';
import { config } from '../server/src/config.js';

const app = express();
const sql = config.databaseUrl ? neon(config.databaseUrl) : null;
const apiKey = process.env.SYNESIS_OS_API_KEY || '';

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '4mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 180, standardHeaders: true, legacyHeaders: false }));

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function text(value, fallback = '', maximum = 4000) {
  return String(value ?? fallback).trim().slice(0, maximum);
}

function auth(req, res, next) {
  if (!apiKey) return res.status(503).json({ error: 'Institutional OS API is not configured.' });
  const bearer = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const supplied = req.get('x-synesis-os-key') || bearer;
  if (supplied !== apiKey) return res.status(401).json({ error: 'Institutional workspace authentication required.' });
  next();
}

async function organization(req) {
  if (!sql) fail(503, 'DATABASE_URL is not configured.');
  const requestedId = text(req.get('x-synesis-organization-id'), '', 80);
  if (requestedId) {
    const rows = await sql`SELECT id, name, slug FROM organizations WHERE id = ${requestedId} LIMIT 1`;
    if (!rows[0]) fail(404, 'Organization not found.');
    return rows[0];
  }
  const slug = config.organizationSlug || 'synesis';
  const rows = await sql`SELECT id, name, slug FROM organizations WHERE slug = ${slug} LIMIT 1`;
  if (!rows[0]) fail(404, 'Configured organization not found.');
  return rows[0];
}

function eventView(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sourceDocumentId: row.source_document_id,
    title: row.title,
    sourceType: row.source_type,
    functionName: row.function_name,
    status: row.status,
    overallRisk: row.overall_risk,
    overallScore: row.overall_score,
    recommendedDecision: row.recommended_decision,
    executivePosition: row.executive_position,
    analysis: row.analysis,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at
  };
}

app.get('/api/os/health', auth, async (req, res, next) => {
  try {
    const org = await organization(req);
    const rows = await sql`SELECT version, applied_at FROM schema_migrations WHERE version = '2026-07-20-institutional-os-4' LIMIT 1`;
    res.json({ ok: true, product: 'LIVE SYNESIS Institutional OS', organization: org, databaseReady: Boolean(rows[0]), version: '4.4.0-institutional-os' });
  } catch (error) { next(error); }
});

app.get('/api/os/command-center', auth, async (req, res, next) => {
  try {
    const org = await organization(req);
    const [eventRows, decisionRows, actionRows, evidenceRows] = await Promise.all([
      sql`SELECT * FROM institutional_events WHERE organization_id = ${org.id} ORDER BY updated_at DESC LIMIT 200`,
      sql`SELECT id, event_id, question, owner, approval_gate, status, comment, decided_at, created_at, updated_at FROM institutional_decisions WHERE organization_id = ${org.id} ORDER BY updated_at DESC LIMIT 500`,
      sql`SELECT id, event_id, decision_id, title, owner, priority, approval_gate, evidence_required, status, due_at, completed_at, created_at, updated_at FROM institutional_actions WHERE organization_id = ${org.id} ORDER BY updated_at DESC LIMIT 1000`,
      sql`SELECT id, event_id, action_id, title, note, storage_reference, content_sha256, created_at FROM institutional_evidence WHERE organization_id = ${org.id} ORDER BY created_at DESC LIMIT 1000`
    ]);
    res.json({ organization: org, events: eventRows.map(eventView), decisions: decisionRows, actions: actionRows, evidence: evidenceRows });
  } catch (error) { next(error); }
});

app.get('/api/os/events/:id', auth, async (req, res, next) => {
  try {
    const org = await organization(req);
    const eventRows = await sql`SELECT * FROM institutional_events WHERE id = ${req.params.id} AND organization_id = ${org.id} LIMIT 1`;
    if (!eventRows[0]) return res.status(404).json({ error: 'Institutional event not found.' });
    const [obligations, decisions, actions, evidence, relationships] = await Promise.all([
      sql`SELECT * FROM institutional_obligations WHERE event_id = ${req.params.id} AND organization_id = ${org.id} ORDER BY created_at ASC`,
      sql`SELECT * FROM institutional_decisions WHERE event_id = ${req.params.id} AND organization_id = ${org.id} ORDER BY created_at ASC`,
      sql`SELECT * FROM institutional_actions WHERE event_id = ${req.params.id} AND organization_id = ${org.id} ORDER BY created_at ASC`,
      sql`SELECT * FROM institutional_evidence WHERE event_id = ${req.params.id} AND organization_id = ${org.id} ORDER BY created_at DESC`,
      sql`SELECT r.*, f.object_type AS from_type, f.name AS from_name, t.object_type AS to_type, t.name AS to_name FROM institutional_relationships r JOIN institutional_objects f ON f.id = r.from_object_id JOIN institutional_objects t ON t.id = r.to_object_id WHERE r.source_event_id = ${req.params.id} AND r.organization_id = ${org.id} ORDER BY r.created_at ASC`
    ]);
    res.json({ event: eventView(eventRows[0]), obligations, decisions, actions, evidence, relationships });
  } catch (error) { next(error); }
});

app.post('/api/os/events', auth, async (req, res, next) => {
  try {
    const org = await organization(req);
    const analysis = req.body?.analysis && typeof req.body.analysis === 'object' ? req.body.analysis : {};
    const intelligence = analysis.decision_intelligence || {};
    const title = text(req.body?.title || analysis.document_title, 'Institutional event', 240);
    const sourceType = text(req.body?.sourceType, 'Institutional event', 120);
    const functionName = text(req.body?.functionName, 'Institutional', 120);
    const eventRows = await sql`
      INSERT INTO institutional_events (
        organization_id, source_document_id, title, source_type, function_name, status,
        overall_risk, overall_score, recommended_decision, executive_position, analysis, created_by
      ) VALUES (
        ${org.id}, ${req.body?.sourceDocumentId || null}, ${title}, ${sourceType}, ${functionName},
        ${analysis.analysis_details?.live_ai_used ? 'Decision Required' : 'Verification Required'},
        ${text(analysis.overall_risk, 'Medium', 30)}, ${Number.isFinite(analysis.overall_score) ? analysis.overall_score : null},
        ${text(analysis.recommended_decision, 'Authorised review required', 1000)},
        ${text(analysis.executive_position || analysis.document_summary, '', 12000)},
        ${JSON.stringify(analysis)}::jsonb, ${req.body?.createdBy || null}
      ) RETURNING *
    `;
    const created = eventRows[0];

    for (const item of Array.isArray(intelligence.obligations) ? intelligence.obligations : []) {
      await sql`INSERT INTO institutional_obligations (organization_id, event_id, actor, obligation, trigger_condition, deadline_or_frequency, evidence_required, consequence, owner, source_reference) VALUES (${org.id}, ${created.id}, ${text(item.actor, '', 300) || null}, ${text(item.obligation, 'Obligation requires review', 6000)}, ${text(item.trigger, '', 2000) || null}, ${text(item.deadline_or_frequency, '', 1000) || null}, ${text(item.evidence_required, '', 2000) || null}, ${text(item.consequence, '', 3000) || null}, ${text(item.owner, functionName, 300)}, ${text(item.source_reference, '', 1000) || null})`;
    }
    for (const question of Array.isArray(intelligence.decision_questions) ? intelligence.decision_questions : []) {
      await sql`INSERT INTO institutional_decisions (organization_id, event_id, question, owner, approval_gate) VALUES (${org.id}, ${created.id}, ${text(question, 'Decision required', 6000)}, ${functionName}, 'Authorised owner approval')`;
    }
    for (const item of Array.isArray(intelligence.action_plan) ? intelligence.action_plan : []) {
      await sql`INSERT INTO institutional_actions (organization_id, event_id, title, owner, priority, approval_gate, evidence_required) VALUES (${org.id}, ${created.id}, ${text(item.action, 'Controlled action required', 6000)}, ${text(item.owner, functionName, 300)}, ${text(item.priority, 'Before Approval', 100)}, ${text(item.approval_gate, 'Authorised owner approval', 1000)}, ${text(item.completion_evidence, 'Documented completion evidence', 2000)})`;
    }
    res.status(201).json({ event: eventView(created) });
  } catch (error) { next(error); }
});

app.patch('/api/os/decisions/:id', auth, async (req, res, next) => {
  try {
    const org = await organization(req);
    const status = text(req.body?.status, '', 40);
    if (!['Pending', 'Approved', 'Rejected', 'Escalated'].includes(status)) fail(400, 'Invalid decision status.');
    const rows = await sql`UPDATE institutional_decisions SET status = ${status}, comment = ${text(req.body?.comment, '', 6000)}, decided_by = ${req.body?.decidedBy || null}, decided_at = CASE WHEN ${status} = 'Pending' THEN NULL ELSE now() END, updated_at = now() WHERE id = ${req.params.id} AND organization_id = ${org.id} RETURNING *`;
    if (!rows[0]) return res.status(404).json({ error: 'Decision not found.' });
    res.json({ decision: rows[0] });
  } catch (error) { next(error); }
});

app.patch('/api/os/actions/:id', auth, async (req, res, next) => {
  try {
    const org = await organization(req);
    const status = text(req.body?.status, '', 40);
    if (!['Open', 'In Progress', 'Blocked', 'Completed', 'Cancelled'].includes(status)) fail(400, 'Invalid action status.');
    const rows = await sql`UPDATE institutional_actions SET status = ${status}, completed_at = CASE WHEN ${status} = 'Completed' THEN now() ELSE NULL END, updated_at = now() WHERE id = ${req.params.id} AND organization_id = ${org.id} RETURNING *`;
    if (!rows[0]) return res.status(404).json({ error: 'Action not found.' });
    res.json({ action: rows[0] });
  } catch (error) { next(error); }
});

app.post('/api/os/evidence', auth, async (req, res, next) => {
  try {
    const org = await organization(req);
    const eventId = text(req.body?.eventId, '', 80);
    if (!eventId) fail(400, 'eventId is required.');
    const rows = await sql`INSERT INTO institutional_evidence (organization_id, event_id, action_id, title, note, storage_reference, content_sha256, added_by) VALUES (${org.id}, ${eventId}, ${req.body?.actionId || null}, ${text(req.body?.title, 'Completion evidence', 500)}, ${text(req.body?.note, '', 10000)}, ${text(req.body?.storageReference, '', 2000) || null}, ${text(req.body?.contentSha256, '', 128) || null}, ${req.body?.addedBy || null}) RETURNING *`;
    res.status(201).json({ evidence: rows[0] });
  } catch (error) { next(error); }
});

app.post('/api/os/events/:id/close', auth, async (req, res, next) => {
  try {
    const org = await organization(req);
    const [decisionCount] = await sql`SELECT count(*)::integer AS count FROM institutional_decisions WHERE event_id = ${req.params.id} AND organization_id = ${org.id} AND status = 'Pending'`;
    const [actionCount] = await sql`SELECT count(*)::integer AS count FROM institutional_actions WHERE event_id = ${req.params.id} AND organization_id = ${org.id} AND status NOT IN ('Completed', 'Cancelled')`;
    const [evidenceCount] = await sql`SELECT count(*)::integer AS count FROM institutional_evidence WHERE event_id = ${req.params.id} AND organization_id = ${org.id}`;
    if (decisionCount.count || actionCount.count || !evidenceCount.count) return res.status(409).json({ error: 'Matter cannot close until decisions are resolved, actions are completed or cancelled, and closure evidence is recorded.', pendingDecisions: decisionCount.count, openActions: actionCount.count, evidenceRecords: evidenceCount.count });
    const rows = await sql`UPDATE institutional_events SET status = 'Closed', closed_at = now(), updated_at = now() WHERE id = ${req.params.id} AND organization_id = ${org.id} RETURNING *`;
    if (!rows[0]) return res.status(404).json({ error: 'Institutional event not found.' });
    res.json({ event: eventView(rows[0]) });
  } catch (error) { next(error); }
});

app.use((error, req, res, next) => {
  console.error('Institutional OS API error:', error);
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Institutional OS request failed.', detail: error.status ? undefined : String(error.message || '').slice(0, 300) });
});

export default app;
