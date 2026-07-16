import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { config } from './config.js';

const ENCRYPTION_KEY = crypto.createHash('sha256').update(config.encryptionSecret).digest();
const sql = config.databaseUrl ? neon(config.databaseUrl) : null;

const emptyStore = {
  organizations: [],
  users: [],
  documents: [],
  audit: []
};

export const usingDatabase = Boolean(sql);

function encryptText(value = '') {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64')
  };
}

function decryptText(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (payload.algorithm !== 'aes-256-gcm') {
    throw new Error('Unsupported stored document encryption format.');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    ENCRYPTION_KEY,
    Buffer.from(payload.iv, 'base64')
  );
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

function publicDocument(document, includeText = false) {
  const result = { ...document };
  const text = result.extractedText ?? decryptText(result.encryptedText);
  delete result.encryptedText;
  delete result.extractedText;
  if (includeText) result.extractedText = text;
  return result;
}

function rowToDocument(row, includeText = false) {
  return publicDocument({
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    matter: row.matter,
    jurisdiction: row.jurisdiction,
    riskAppetite: row.risk_appetite,
    documentType: row.document_type,
    originalFileName: row.original_file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    parser: row.parser,
    truncated: row.truncated,
    contentSha256: row.content_sha256,
    encryptedText: row.encrypted_text,
    analysis: row.analysis,
    decisions: Array.isArray(row.decisions) ? row.decisions : [],
    uploadedById: row.uploaded_by,
    uploadedBy: row.uploaded_by_email,
    status: row.status,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  }, includeText);
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    name: row.name,
    email: row.email,
    role: row.role,
    passwordHash: row.password_hash,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
    lastLoginAt: iso(row.last_login_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

async function ensureStore() {
  await fs.mkdir(path.dirname(config.dataFile), { recursive: true });
  try {
    await fs.access(config.dataFile);
  } catch {
    await fs.writeFile(config.dataFile, JSON.stringify(emptyStore, null, 2), 'utf8');
  }
}

async function readStore() {
  await ensureStore();
  try {
    const parsed = JSON.parse(await fs.readFile(config.dataFile, 'utf8'));
    return {
      organizations: Array.isArray(parsed.organizations) ? parsed.organizations : [],
      users: Array.isArray(parsed.users) ? parsed.users : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      audit: Array.isArray(parsed.audit) ? parsed.audit : []
    };
  } catch {
    await fs.writeFile(config.dataFile, JSON.stringify(emptyStore, null, 2), 'utf8');
    return structuredClone(emptyStore);
  }
}

async function writeStore(store) {
  await ensureStore();
  const temp = `${config.dataFile}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(store, null, 2), 'utf8');
  await fs.rename(temp, config.dataFile);
}

function tenant(context) {
  const organizationId = context?.organizationId;
  if (!organizationId) throw new Error('Organization context is required.');
  return organizationId;
}

export async function ensureOrganization({ name, slug }) {
  if (sql) {
    const rows = await sql`
      INSERT INTO organizations (name, slug)
      VALUES (${name}, ${slug})
      ON CONFLICT (slug)
      DO UPDATE SET name = EXCLUDED.name, updated_at = now()
      RETURNING *
    `;
    return rows[0];
  }
  const store = await readStore();
  let organization = store.organizations.find(item => item.slug === slug);
  if (!organization) {
    organization = {
      id: crypto.randomUUID(),
      name,
      slug,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    store.organizations.push(organization);
    await writeStore(store);
  }
  return organization;
}

export async function getUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (sql) {
    const rows = await sql`
      SELECT u.*, o.name AS organization_name
      FROM users u
      JOIN organizations o ON o.id = u.organization_id
      WHERE lower(u.email) = ${normalized}
      LIMIT 1
    `;
    return rowToUser(rows[0]);
  }
  const store = await readStore();
  const row = store.users.find(item => item.email.toLowerCase() === normalized);
  const org = row && store.organizations.find(item => item.id === row.organizationId);
  return row ? { ...row, organizationName: org?.name || config.organizationName } : null;
}

export async function getUserById(id) {
  if (sql) {
    const rows = await sql`
      SELECT u.*, o.name AS organization_name
      FROM users u
      JOIN organizations o ON o.id = u.organization_id
      WHERE u.id = ${id}
      LIMIT 1
    `;
    return rowToUser(rows[0]);
  }
  const store = await readStore();
  const row = store.users.find(item => item.id === id);
  const org = row && store.organizations.find(item => item.id === row.organizationId);
  return row ? { ...row, organizationName: org?.name || config.organizationName } : null;
}

export async function createUser(input) {
  if (sql) {
    const rows = await sql`
      INSERT INTO users (
        organization_id, name, email, role, password_hash, is_active, must_change_password
      ) VALUES (
        ${input.organizationId}, ${input.name}, ${input.email.toLowerCase()}, ${input.role},
        ${input.passwordHash}, ${input.isActive ?? true}, ${input.mustChangePassword ?? true}
      )
      ON CONFLICT ((lower(email))) DO NOTHING
      RETURNING *
    `;
    return rows[0] ? rowToUser(rows[0]) : getUserByEmail(input.email);
  }
  const store = await readStore();
  const existing = store.users.find(item => item.email.toLowerCase() === input.email.toLowerCase());
  if (existing) return existing;
  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    name: input.name,
    email: input.email.toLowerCase(),
    role: input.role,
    passwordHash: input.passwordHash,
    isActive: input.isActive ?? true,
    mustChangePassword: input.mustChangePassword ?? true,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now
  };
  store.users.push(user);
  await writeStore(store);
  return user;
}

export async function listUsers(context) {
  const organizationId = tenant(context);
  if (sql) {
    const rows = await sql`
      SELECT u.*, o.name AS organization_name
      FROM users u
      JOIN organizations o ON o.id = u.organization_id
      WHERE u.organization_id = ${organizationId}
      ORDER BY u.is_active DESC, u.name ASC
    `;
    return rows.map(rowToUser).map(({ passwordHash, ...user }) => user);
  }
  const store = await readStore();
  return store.users
    .filter(item => item.organizationId === organizationId)
    .map(({ passwordHash, ...user }) => user)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function setUserActive(id, context, isActive) {
  const organizationId = tenant(context);
  if (sql) {
    const rows = await sql`
      UPDATE users
      SET is_active = ${Boolean(isActive)}, updated_at = now()
      WHERE id = ${id} AND organization_id = ${organizationId}
      RETURNING *
    `;
    return rowToUser(rows[0]);
  }
  const store = await readStore();
  const user = store.users.find(item => item.id === id && item.organizationId === organizationId);
  if (!user) return null;
  user.isActive = Boolean(isActive);
  user.updatedAt = new Date().toISOString();
  await writeStore(store);
  return user;
}

export async function updateUserPassword(id, context, passwordHash, mustChangePassword = false) {
  const organizationId = tenant(context);
  if (sql) {
    const rows = await sql`
      UPDATE users
      SET password_hash = ${passwordHash},
          must_change_password = ${Boolean(mustChangePassword)},
          updated_at = now()
      WHERE id = ${id} AND organization_id = ${organizationId}
      RETURNING *
    `;
    return rowToUser(rows[0]);
  }
  const store = await readStore();
  const user = store.users.find(item => item.id === id && item.organizationId === organizationId);
  if (!user) return null;
  user.passwordHash = passwordHash;
  user.mustChangePassword = Boolean(mustChangePassword);
  user.updatedAt = new Date().toISOString();
  await writeStore(store);
  return user;
}

export async function touchUserLogin(id) {
  if (sql) {
    await sql`UPDATE users SET last_login_at = now() WHERE id = ${id}`;
    return;
  }
  const store = await readStore();
  const user = store.users.find(item => item.id === id);
  if (user) {
    user.lastLoginAt = new Date().toISOString();
    await writeStore(store);
  }
}

export async function listDocuments(context = {}, filters = {}) {
  const organizationId = tenant(context);
  const search = String(filters.search || '').trim();
  const pattern = `%${search}%`;
  const status = String(filters.status || '').trim();
  const limit = Math.max(1, Math.min(200, Number(filters.limit || 100)));
  if (sql) {
    const rows = await sql`
      SELECT *
      FROM documents
      WHERE organization_id = ${organizationId}
        AND deleted_at IS NULL
        AND (${status} = '' OR status = ${status})
        AND (
          ${search} = '' OR
          title ILIKE ${pattern} OR
          matter ILIKE ${pattern} OR
          original_file_name ILIKE ${pattern} OR
          document_type ILIKE ${pattern}
        )
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;
    return rows.map(row => rowToDocument(row, false));
  }
  const store = await readStore();
  return store.documents
    .filter(item => item.organizationId === organizationId && !item.deletedAt)
    .map(item => publicDocument(item, false))
    .filter(item => !status || item.status === status)
    .filter(item => {
      if (!search) return true;
      return [item.title, item.matter, item.originalFileName, item.documentType]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase());
    })
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, limit);
}

export async function getDocument(id, context, includeText = false) {
  const organizationId = tenant(context);
  if (sql) {
    const rows = await sql`
      SELECT *
      FROM documents
      WHERE id = ${id}
        AND organization_id = ${organizationId}
        AND deleted_at IS NULL
      LIMIT 1
    `;
    return rows[0] ? rowToDocument(rows[0], includeText) : null;
  }
  const store = await readStore();
  const document = store.documents.find(item =>
    item.id === id && item.organizationId === organizationId && !item.deletedAt
  );
  return document ? publicDocument(document, includeText) : null;
}

export async function saveDocument(input, context) {
  const organizationId = tenant(context);
  const encryptedText = encryptText(input.extractedText);
  const now = new Date().toISOString();
  if (sql) {
    const rows = await sql`
      INSERT INTO documents (
        organization_id, title, matter, jurisdiction, risk_appetite, document_type,
        original_file_name, mime_type, size_bytes, parser, truncated, content_sha256,
        encrypted_text, analysis, decisions, uploaded_by, uploaded_by_email, status
      ) VALUES (
        ${organizationId}, ${input.title}, ${input.matter}, ${input.jurisdiction},
        ${input.riskAppetite}, ${input.documentType}, ${input.originalFileName},
        ${input.mimeType}, ${input.sizeBytes || 0}, ${input.parser}, ${Boolean(input.truncated)},
        ${input.contentSha256 || null}, ${JSON.stringify(encryptedText)}::jsonb,
        ${JSON.stringify(input.analysis)}::jsonb, '[]'::jsonb, ${input.uploadedById || null},
        ${input.uploadedBy}, ${input.status || 'AI Review Complete'}
      )
      RETURNING *
    `;
    return rowToDocument(rows[0], false);
  }
  const store = await readStore();
  const document = {
    id: crypto.randomUUID(),
    organizationId,
    createdAt: now,
    updatedAt: now,
    decisions: [],
    ...input,
    encryptedText
  };
  delete document.extractedText;
  store.documents.unshift(document);
  await writeStore(store);
  return publicDocument(document, false);
}

export async function updateDocument(id, context, updater) {
  const current = await getDocument(id, context, true);
  if (!current) return null;
  const next = typeof updater === 'function'
    ? updater(current)
    : { ...current, ...updater };
  next.updatedAt = new Date().toISOString();
  const encryptedText = encryptText(next.extractedText);
  const organizationId = tenant(context);
  if (sql) {
    const rows = await sql`
      UPDATE documents
      SET title = ${next.title},
          matter = ${next.matter},
          jurisdiction = ${next.jurisdiction},
          risk_appetite = ${next.riskAppetite},
          document_type = ${next.documentType},
          encrypted_text = ${JSON.stringify(encryptedText)}::jsonb,
          analysis = ${JSON.stringify(next.analysis)}::jsonb,
          decisions = ${JSON.stringify(next.decisions || [])}::jsonb,
          status = ${next.status},
          updated_at = now()
      WHERE id = ${id} AND organization_id = ${organizationId} AND deleted_at IS NULL
      RETURNING *
    `;
    return rows[0] ? rowToDocument(rows[0], false) : null;
  }
  const store = await readStore();
  const index = store.documents.findIndex(item =>
    item.id === id && item.organizationId === organizationId && !item.deletedAt
  );
  if (index < 0) return null;
  store.documents[index] = { ...next, encryptedText };
  delete store.documents[index].extractedText;
  await writeStore(store);
  return publicDocument(store.documents[index], false);
}

export async function deleteDocument(id, context) {
  const organizationId = tenant(context);
  if (sql) {
    const rows = await sql`
      UPDATE documents
      SET deleted_at = now(), updated_at = now()
      WHERE id = ${id} AND organization_id = ${organizationId} AND deleted_at IS NULL
      RETURNING id
    `;
    return Boolean(rows[0]);
  }
  const store = await readStore();
  const document = store.documents.find(item =>
    item.id === id && item.organizationId === organizationId && !item.deletedAt
  );
  if (!document) return false;
  document.deletedAt = new Date().toISOString();
  await writeStore(store);
  return true;
}

export async function addDecision(id, context, decision) {
  return updateDocument(id, context, current => ({
    ...current,
    status: decision.documentStatus || current.status,
    decisions: [
      {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        findingId: decision.findingId || null,
        status: decision.status || 'Commented',
        comment: decision.comment || '',
        user: decision.user || 'Unknown',
        userId: decision.userId || null
      },
      ...(current.decisions || [])
    ]
  }));
}

export async function logAudit(entry) {
  const metadata = entry.metadata || entry.meta || {};
  if (sql) {
    await sql`
      INSERT INTO audit_events (
        organization_id, user_id, user_email, role, action, entity_type, entity_id,
        metadata, request_id, ip_address
      ) VALUES (
        ${entry.organizationId || null}, ${entry.userId || null}, ${entry.userEmail || entry.user || 'anonymous'},
        ${entry.role || 'unknown'}, ${entry.action}, ${entry.entityType || null},
        ${entry.entityId || null}, ${JSON.stringify(metadata)}::jsonb,
        ${entry.requestId || null}, ${entry.ipAddress || null}
      )
    `;
    return;
  }
  const store = await readStore();
  store.audit.unshift({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...entry,
    metadata
  });
  store.audit = store.audit.slice(0, 3000);
  await writeStore(store);
}

export async function listAudit(context, limit = 300) {
  const organizationId = tenant(context);
  const safeLimit = Math.max(1, Math.min(1000, Number(limit || 300)));
  if (sql) {
    const rows = await sql`
      SELECT *
      FROM audit_events
      WHERE organization_id = ${organizationId}
      ORDER BY created_at DESC
      LIMIT ${safeLimit}
    `;
    return rows.map(row => ({
      id: String(row.id),
      at: iso(row.created_at),
      user: row.user_email,
      role: row.role,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: row.metadata
    }));
  }
  const store = await readStore();
  return store.audit
    .filter(item => item.organizationId === organizationId)
    .slice(0, safeLimit);
}

export async function dashboardMetrics(context) {
  const documents = await listDocuments(context, { limit: 200 });
  const highRisk = documents.filter(document => document.analysis?.overall_risk === 'High').length;
  const open = documents.filter(document => !['Final Approved', 'Closed', 'Rejected'].includes(document.status)).length;
  const findings = documents.reduce((sum, document) => sum + (document.analysis?.findings?.length || 0), 0);
  const scenarios = documents.reduce((sum, document) => sum + (document.analysis?.scenario_tests?.length || 0), 0);
  const departments = {};
  for (const document of documents) {
    for (const finding of document.analysis?.findings || []) {
      for (const owner of finding.review_owner || []) {
        departments[owner] = (departments[owner] || 0) + 1;
      }
    }
  }
  return {
    totalDocuments: documents.length,
    highRisk,
    open,
    totalFindings: findings,
    totalScenarios: scenarios,
    completed: documents.filter(document => ['Final Approved', 'Closed'].includes(document.status)).length,
    ownerWorkload: Object.entries(departments)
      .map(([owner, count]) => ({ owner, count }))
      .sort((a, b) => b.count - a.count),
    recent: documents.slice(0, 6)
  };
}

export function platformStorageStatus() {
  return {
    provider: sql ? 'neon-postgres' : 'encrypted-local-fallback',
    tenantScoped: true,
    encryptedSourceText: true
  };
}
