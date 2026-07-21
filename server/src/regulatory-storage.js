import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { config } from './config.js';

const sql = config.databaseUrl ? neon(config.databaseUrl) : null;
const key = crypto.createHash('sha256').update(config.encryptionSecret || 'synesis-regulatory-storage').digest();

function tenant(context) {
  const organizationId = context?.organizationId;
  if (!organizationId) throw new Error('Organization context is required.');
  return organizationId;
}

function encrypted(value = '') {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64')
  };
}

function decrypted(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

function iso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function schemaError(error) {
  if (/regulatory_cases|regulatory_obligations|does not exist/i.test(String(error?.message || ''))) {
    const wrapped = new Error('Regulatory Command enterprise schema has not been migrated yet.');
    wrapped.status = 503;
    return wrapped;
  }
  return error;
}

function caseRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    regulator: row.regulator || '',
    reference: row.regulatory_reference || '',
    jurisdiction: row.jurisdiction || 'India',
    effectiveDate: row.effective_date ? String(row.effective_date).slice(0, 10) : '',
    owner: row.accountable_owner || '',
    status: row.status,
    sourceDocumentId: row.source_document_id,
    sourceFile: row.source_file_name || '',
    sourceFingerprint: row.source_fingerprint || '',
    analysis: row.analysis || {},
    decision: row.decision || '',
    closureStatement: row.closure_statement || '',
    createdBy: row.created_by,
    createdByEmail: row.created_by_email,
    closedBy: row.closed_by,
    closedAt: iso(row.closed_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

function obligationRow(row) {
  return {
    id: row.id,
    reference: row.source_reference || '',
    statement: row.statement,
    owner: row.owner || '',
    dueDate: row.due_date ? String(row.due_date).slice(0, 10) : '',
    status: row.status,
    applicabilityBasis: row.applicability_basis || '',
    evidenceRequired: row.evidence_required || '',
    notes: row.notes || '',
    sortOrder: row.sort_order || 0
  };
}

function impactRow(row) {
  return {
    id: row.id,
    area: row.area,
    control: row.control_reference || '',
    policy: row.policy_reference || '',
    system: row.system_or_process || '',
    owner: row.owner || '',
    status: row.status,
    notes: row.notes || ''
  };
}

function taskRow(row) {
  return {
    id: row.id,
    obligationId: row.obligation_id,
    title: row.title,
    owner: row.owner || '',
    priority: row.priority,
    dueDate: row.due_date ? String(row.due_date).slice(0, 10) : '',
    status: row.status,
    approvalGate: row.approval_gate || '',
    evidenceRequired: row.evidence_required || '',
    notes: row.notes || '',
    completedAt: iso(row.completed_at)
  };
}

function approvalRow(row) {
  return {
    id: row.id,
    function: row.approval_function,
    status: row.status,
    comment: row.comment || '',
    decidedBy: row.decided_by,
    decidedByEmail: row.decided_by_email,
    updatedAt: iso(row.decided_at || row.updated_at)
  };
}

function evidenceRow(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    obligationId: row.obligation_id,
    title: row.title,
    note: row.note || '',
    owner: row.evidence_owner || '',
    storageReference: row.storage_reference || '',
    contentHash: row.content_hash || '',
    metadata: row.metadata || {},
    createdBy: row.created_by,
    createdByEmail: row.created_by_email,
    createdAt: iso(row.created_at)
  };
}

export async function listRegulatoryCases(context, filters = {}) {
  if (!sql) throw Object.assign(new Error('Database storage is not configured.'), { status: 503 });
  const organizationId = tenant(context);
  const status = String(filters.status || '').trim();
  const search = String(filters.search || '').trim();
  const pattern = `%${search}%`;
  try {
    const rows = await sql`
      SELECT c.*,
        (SELECT count(*)::int FROM regulatory_obligations o WHERE o.case_id = c.id AND o.status NOT IN ('Not applicable','Implemented')) AS open_obligations,
        (SELECT count(*)::int FROM regulatory_tasks t WHERE t.case_id = c.id AND t.status <> 'Completed') AS open_tasks,
        (SELECT count(*)::int FROM regulatory_approvals a WHERE a.case_id = c.id AND a.status = 'Pending') AS pending_approvals,
        (SELECT count(*)::int FROM regulatory_evidence e WHERE e.case_id = c.id) AS evidence_count
      FROM regulatory_cases c
      WHERE c.organization_id = ${organizationId}
        AND c.deleted_at IS NULL
        AND (${status} = '' OR c.status = ${status})
        AND (${search} = '' OR c.title ILIKE ${pattern} OR c.regulator ILIKE ${pattern} OR c.regulatory_reference ILIKE ${pattern})
      ORDER BY c.updated_at DESC
      LIMIT 200
    `;
    return rows.map(row => ({
      ...caseRow(row),
      counts: {
        openObligations: row.open_obligations || 0,
        openTasks: row.open_tasks || 0,
        pendingApprovals: row.pending_approvals || 0,
        evidence: row.evidence_count || 0
      }
    }));
  } catch (error) {
    throw schemaError(error);
  }
}

export async function getRegulatoryCase(id, context, includeSource = false) {
  if (!sql) throw Object.assign(new Error('Database storage is not configured.'), { status: 503 });
  const organizationId = tenant(context);
  try {
    const rows = await sql`
      SELECT * FROM regulatory_cases
      WHERE id = ${id} AND organization_id = ${organizationId} AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows[0]) return null;
    const [obligations, impacts, tasks, approvals, evidence] = await Promise.all([
      sql`SELECT * FROM regulatory_obligations WHERE case_id = ${id} AND organization_id = ${organizationId} ORDER BY sort_order, created_at`,
      sql`SELECT * FROM regulatory_impacts WHERE case_id = ${id} AND organization_id = ${organizationId} ORDER BY created_at`,
      sql`SELECT * FROM regulatory_tasks WHERE case_id = ${id} AND organization_id = ${organizationId} ORDER BY created_at`,
      sql`SELECT * FROM regulatory_approvals WHERE case_id = ${id} AND organization_id = ${organizationId} ORDER BY created_at`,
      sql`SELECT * FROM regulatory_evidence WHERE case_id = ${id} AND organization_id = ${organizationId} ORDER BY created_at DESC`
    ]);
    const record = {
      ...caseRow(rows[0]),
      obligations: obligations.map(obligationRow),
      impacts: impacts.map(impactRow),
      tasks: tasks.map(taskRow),
      approvals: approvals.map(approvalRow),
      evidence: evidence.map(evidenceRow)
    };
    if (includeSource) record.sourceText = decrypted(rows[0].source_text_encrypted);
    return record;
  } catch (error) {
    throw schemaError(error);
  }
}

export async function saveRegulatoryCase(input, context, actor) {
  if (!sql) throw Object.assign(new Error('Database storage is not configured.'), { status: 503 });
  const organizationId = tenant(context);
  const id = input.id || crypto.randomUUID();
  const now = new Date().toISOString();
  const sourceText = String(input.sourceText || '');
  const fingerprint = sourceText ? crypto.createHash('sha256').update(sourceText).digest('hex') : input.sourceFingerprint || '';
  const sourcePayload = sourceText ? encrypted(sourceText) : null;
  try {
    await sql`
      INSERT INTO regulatory_cases (
        id, organization_id, title, regulator, regulatory_reference, jurisdiction, effective_date,
        accountable_owner, status, source_file_name, source_text_encrypted, source_fingerprint,
        analysis, decision, closure_statement, created_by, created_by_email, closed_by, closed_at,
        created_at, updated_at
      ) VALUES (
        ${id}, ${organizationId}, ${input.title}, ${input.regulator || null}, ${input.reference || null},
        ${input.jurisdiction || 'India'}, ${input.effectiveDate || null}, ${input.owner || null},
        ${input.status || 'Intake'}, ${input.sourceFile || null}, ${sourcePayload}, ${fingerprint || null},
        ${JSON.stringify(input.analysis || {})}, ${input.decision || null}, ${input.closureStatement || null},
        ${actor.id}, ${actor.email}, ${input.status === 'Closed' ? actor.id : null},
        ${input.status === 'Closed' ? now : null}, ${input.createdAt || now}, ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        regulator = EXCLUDED.regulator,
        regulatory_reference = EXCLUDED.regulatory_reference,
        jurisdiction = EXCLUDED.jurisdiction,
        effective_date = EXCLUDED.effective_date,
        accountable_owner = EXCLUDED.accountable_owner,
        status = EXCLUDED.status,
        source_file_name = COALESCE(EXCLUDED.source_file_name, regulatory_cases.source_file_name),
        source_text_encrypted = COALESCE(EXCLUDED.source_text_encrypted, regulatory_cases.source_text_encrypted),
        source_fingerprint = COALESCE(EXCLUDED.source_fingerprint, regulatory_cases.source_fingerprint),
        analysis = EXCLUDED.analysis,
        decision = EXCLUDED.decision,
        closure_statement = EXCLUDED.closure_statement,
        closed_by = EXCLUDED.closed_by,
        closed_at = EXCLUDED.closed_at,
        updated_at = now()
      WHERE regulatory_cases.organization_id = ${organizationId}
    `;

    await Promise.all([
      sql`DELETE FROM regulatory_obligations WHERE case_id = ${id} AND organization_id = ${organizationId}`,
      sql`DELETE FROM regulatory_impacts WHERE case_id = ${id} AND organization_id = ${organizationId}`,
      sql`DELETE FROM regulatory_tasks WHERE case_id = ${id} AND organization_id = ${organizationId}`,
      sql`DELETE FROM regulatory_approvals WHERE case_id = ${id} AND organization_id = ${organizationId}`,
      sql`DELETE FROM regulatory_evidence WHERE case_id = ${id} AND organization_id = ${organizationId}`
    ]);

    for (let index = 0; index < (input.obligations || []).length; index += 1) {
      const item = input.obligations[index];
      await sql`
        INSERT INTO regulatory_obligations (
          id, organization_id, case_id, source_reference, statement, owner, due_date, status,
          applicability_basis, evidence_required, notes, sort_order
        ) VALUES (
          ${item.id || crypto.randomUUID()}, ${organizationId}, ${id}, ${item.reference || null},
          ${item.statement}, ${item.owner || null}, ${item.dueDate || null}, ${item.status || 'Assessment required'},
          ${item.applicabilityBasis || null}, ${item.evidenceRequired || null}, ${item.notes || null}, ${index}
        )
      `;
    }

    for (const item of input.impacts || []) {
      await sql`
        INSERT INTO regulatory_impacts (
          id, organization_id, case_id, area, control_reference, policy_reference,
          system_or_process, owner, status, notes
        ) VALUES (
          ${item.id || crypto.randomUUID()}, ${organizationId}, ${id}, ${item.area}, ${item.control || null},
          ${item.policy || null}, ${item.system || null}, ${item.owner || null}, ${item.status || 'Mapping required'}, ${item.notes || null}
        )
      `;
    }

    for (const item of input.tasks || []) {
      await sql`
        INSERT INTO regulatory_tasks (
          id, organization_id, case_id, obligation_id, title, owner, priority, due_date,
          status, approval_gate, evidence_required, notes, completed_at
        ) VALUES (
          ${item.id || crypto.randomUUID()}, ${organizationId}, ${id}, ${item.obligationId || null},
          ${item.title}, ${item.owner || null}, ${item.priority || 'Planned'}, ${item.dueDate || null},
          ${item.status || 'Open'}, ${item.approvalGate || null}, ${item.evidenceRequired || null},
          ${item.notes || null}, ${item.status === 'Completed' ? item.completedAt || now : null}
        )
      `;
    }

    for (const item of input.approvals || []) {
      const decided = item.status && item.status !== 'Pending';
      await sql`
        INSERT INTO regulatory_approvals (
          id, organization_id, case_id, approval_function, status, comment,
          decided_by, decided_by_email, decided_at
        ) VALUES (
          ${item.id || crypto.randomUUID()}, ${organizationId}, ${id}, ${item.function}, ${item.status || 'Pending'},
          ${item.comment || null}, ${decided ? actor.id : null}, ${decided ? actor.email : null},
          ${decided ? item.updatedAt || now : null}
        )
      `;
    }

    for (const item of input.evidence || []) {
      await sql`
        INSERT INTO regulatory_evidence (
          id, organization_id, case_id, task_id, obligation_id, title, note,
          evidence_owner, storage_reference, content_hash, metadata, created_by, created_by_email, created_at
        ) VALUES (
          ${item.id || crypto.randomUUID()}, ${organizationId}, ${id}, ${item.taskId || null}, ${item.obligationId || null},
          ${item.title}, ${item.note || null}, ${item.owner || null}, ${item.storageReference || null},
          ${item.contentHash || null}, ${JSON.stringify(item.metadata || {})}, ${actor.id}, ${actor.email}, ${item.createdAt || now}
        )
      `;
    }

    return getRegulatoryCase(id, context, true);
  } catch (error) {
    throw schemaError(error);
  }
}

export async function deleteRegulatoryCase(id, context) {
  if (!sql) throw Object.assign(new Error('Database storage is not configured.'), { status: 503 });
  const organizationId = tenant(context);
  try {
    const rows = await sql`
      UPDATE regulatory_cases
      SET deleted_at = now(), updated_at = now()
      WHERE id = ${id} AND organization_id = ${organizationId} AND deleted_at IS NULL
      RETURNING id
    `;
    return Boolean(rows[0]);
  } catch (error) {
    throw schemaError(error);
  }
}
