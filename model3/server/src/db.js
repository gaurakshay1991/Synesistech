import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { config } from './config.js';
import { seedState } from './seed.js';

const { Pool } = pg;
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const dataFile = config.databasePath.replace(/\.db$/i, '.json');
const pool = config.databaseUrl ? new Pool({ connectionString: config.databaseUrl }) : null;

export let organizationId = null;

function mergeStateDefaults(defaultValue, currentValue) {
  if (Array.isArray(defaultValue)) return Array.isArray(currentValue) ? structuredClone(currentValue) : structuredClone(defaultValue);
  if (defaultValue && typeof defaultValue === 'object') {
    const current = currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue) ? currentValue : {};
    const output = {};
    for (const [key, value] of Object.entries(defaultValue)) output[key] = mergeStateDefaults(value, current[key]);
    for (const [key, value] of Object.entries(current)) if (!(key in output)) output[key] = structuredClone(value);
    return output;
  }
  return currentValue === undefined || currentValue === null ? structuredClone(defaultValue) : currentValue;
}

export function hydrateState(value) {
  const hydrated = mergeStateDefaults(seedState, value || {});
  hydrated.schemaVersion = seedState.schemaVersion;
  hydrated.product = { ...seedState.product, ...(hydrated.product || {}) };
  return hydrated;
}

function keyBuffer() {
  return crypto.createHash('sha256').update(config.encryptionSecret).digest();
}

export function encryptText(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.');
}

export function decryptText(value) {
  const [ivRaw, tagRaw, encryptedRaw] = String(value).split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}

function initialStore() {
  const orgId = uuid();
  return {
    organizations: [{ id: orgId, name: config.organizationName, slug: config.organizationSlug, created_at: now() }],
    users: [{
      id: uuid(), organization_id: orgId, name: config.bootstrapAdmin.name,
      email: config.bootstrapAdmin.email.toLowerCase(), role: 'admin',
      password_hash: bcrypt.hashSync(config.bootstrapAdmin.password, 12),
      is_active: 1, must_change_password: 1, created_at: now(), last_login_at: null
    }],
    states: { [orgId]: hydrateState(seedState) },
    documents: [], analyses: [], audit: []
  };
}

async function ensureFileStore() {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await writeFileStore(initialStore());
  }
}

async function readFileStore() {
  await ensureFileStore();
  try {
    const parsed = JSON.parse(await fs.readFile(dataFile, 'utf8'));
    return parsed?.organizations?.length ? parsed : initialStore();
  } catch {
    const fresh = initialStore();
    await writeFileStore(fresh);
    return fresh;
  }
}

async function writeFileStore(store) {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  const temp = `${dataFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(store, null, 2), { mode: 0o600 });
  await fs.rename(temp, dataFile);
}

async function migratePostgres() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY,
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      role text NOT NULL,
      password_hash text NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      must_change_password boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      last_login_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS users_org_idx ON users(organization_id);
    CREATE TABLE IF NOT EXISTS institutional_state (
      organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      payload jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS documents (
      id uuid PRIMARY KEY,
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      title text NOT NULL,
      file_name text,
      mime_type text,
      content_hash text NOT NULL,
      document_type text,
      jurisdiction text,
      matter text,
      status text NOT NULL,
      encrypted_source text NOT NULL,
      created_by uuid REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS documents_org_updated_idx ON documents(organization_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS analyses (
      id uuid PRIMARY KEY,
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      engine text,
      overall_risk text,
      score integer,
      payload jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS analyses_document_created_idx ON analyses(document_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS audit_log (
      id uuid PRIMARY KEY,
      organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
      user_id uuid,
      user_email text NOT NULL,
      role text NOT NULL,
      action text NOT NULL,
      entity_type text,
      entity_id text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS audit_org_created_idx ON audit_log(organization_id, created_at DESC);
  `);
}

export async function initializeStorage() {
  if (pool) {
    await migratePostgres();
    const orgId = uuid();
    const orgResult = await pool.query(
      `INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
       RETURNING id`,
      [orgId, config.organizationName, config.organizationSlug]
    );
    organizationId = orgResult.rows[0].id;

    const existing = await getUserByEmail(config.bootstrapAdmin.email);
    if (!existing) {
      await createUser({
        orgId: organizationId,
        name: config.bootstrapAdmin.name,
        email: config.bootstrapAdmin.email,
        role: 'admin',
        passwordHash: bcrypt.hashSync(config.bootstrapAdmin.password, 12)
      });
    }
    await pool.query(
      `INSERT INTO institutional_state (organization_id, payload)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (organization_id) DO NOTHING`,
      [organizationId, JSON.stringify(hydrateState(seedState))]
    );
    const existingState = await pool.query('SELECT payload FROM institutional_state WHERE organization_id = $1', [organizationId]);
    const hydratedState = hydrateState(existingState.rows[0]?.payload || seedState);
    await pool.query('UPDATE institutional_state SET payload = $2::jsonb, updated_at = now() WHERE organization_id = $1', [organizationId, JSON.stringify(hydratedState)]);
    return organizationId;
  }

  const store = await readFileStore();
  organizationId = store.organizations[0].id;
  if (!store.states?.[organizationId]) store.states = { ...(store.states || {}), [organizationId]: hydrateState(seedState) };
  else store.states[organizationId] = hydrateState(store.states[organizationId]);
  if (!store.users.some(user => user.email === config.bootstrapAdmin.email.toLowerCase())) {
    store.users.push({
      id: uuid(), organization_id: organizationId, name: config.bootstrapAdmin.name,
      email: config.bootstrapAdmin.email.toLowerCase(), role: 'admin',
      password_hash: bcrypt.hashSync(config.bootstrapAdmin.password, 12),
      is_active: 1, must_change_password: 1, created_at: now(), last_login_at: null
    });
  }
  await writeFileStore(store);
  return organizationId;
}

function mapUser(row) {
  if (!row) return null;
  return {
    ...row,
    is_active: row.is_active === true || row.is_active === 1,
    must_change_password: row.must_change_password === true || row.must_change_password === 1,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    last_login_at: row.last_login_at instanceof Date ? row.last_login_at.toISOString() : row.last_login_at
  };
}

export async function getUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (pool) {
    const result = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [normalized]);
    return mapUser(result.rows[0]);
  }
  const store = await readFileStore();
  return mapUser(store.users.find(user => user.email === normalized));
}

export async function getUserById(id) {
  if (pool) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
    return mapUser(result.rows[0]);
  }
  const store = await readFileStore();
  return mapUser(store.users.find(user => user.id === id));
}

export async function touchLogin(id) {
  if (pool) {
    await pool.query('UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1', [id]);
    return;
  }
  const store = await readFileStore();
  const user = store.users.find(item => item.id === id);
  if (user) user.last_login_at = now();
  await writeFileStore(store);
}

export async function updatePassword(id, passwordHash) {
  if (pool) {
    await pool.query('UPDATE users SET password_hash = $2, must_change_password = false, updated_at = now() WHERE id = $1', [id, passwordHash]);
    return;
  }
  const store = await readFileStore();
  const user = store.users.find(item => item.id === id);
  if (user) { user.password_hash = passwordHash; user.must_change_password = 0; }
  await writeFileStore(store);
}

export async function listUsers(orgId) {
  if (pool) {
    const result = await pool.query('SELECT * FROM users WHERE organization_id = $1 ORDER BY name', [orgId]);
    return result.rows.map(mapUser);
  }
  const store = await readFileStore();
  return store.users.filter(user => user.organization_id === orgId).map(mapUser).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createUser({ orgId, name, email, role, passwordHash }) {
  const id = uuid();
  const normalized = email.toLowerCase();
  if (pool) {
    const result = await pool.query(
      `INSERT INTO users (id, organization_id, name, email, role, password_hash, is_active, must_change_password)
       VALUES ($1, $2, $3, $4, $5, $6, true, true)
       RETURNING *`,
      [id, orgId, name, normalized, role, passwordHash]
    );
    return mapUser(result.rows[0]);
  }
  const store = await readFileStore();
  const user = { id, organization_id: orgId, name, email: normalized, role, password_hash: passwordHash, is_active: 1, must_change_password: 1, created_at: now(), last_login_at: null };
  store.users.push(user);
  await writeFileStore(store);
  return mapUser(user);
}

export async function setUserActive(id, active) {
  if (pool) {
    await pool.query('UPDATE users SET is_active = $2, updated_at = now() WHERE id = $1', [id, Boolean(active)]);
    return;
  }
  const store = await readFileStore();
  const user = store.users.find(item => item.id === id);
  if (user) user.is_active = active ? 1 : 0;
  await writeFileStore(store);
}

export async function getState(orgId) {
  if (pool) {
    const result = await pool.query('SELECT payload FROM institutional_state WHERE organization_id = $1', [orgId]);
    return hydrateState(result.rows[0]?.payload || seedState);
  }
  const store = await readFileStore();
  return hydrateState(store.states?.[orgId] || seedState);
}

export async function saveState(orgId, value) {
  if (pool) {
    await pool.query(
      `INSERT INTO institutional_state (organization_id, payload, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (organization_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
      [orgId, JSON.stringify(value)]
    );
    return structuredClone(value);
  }
  const store = await readFileStore();
  store.states[orgId] = structuredClone(value);
  await writeFileStore(store);
  return structuredClone(value);
}

export async function mutateState(orgId, mutator) {
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query('SELECT payload FROM institutional_state WHERE organization_id = $1 FOR UPDATE', [orgId]);
      const current = hydrateState(result.rows[0]?.payload || seedState);
      const next = mutator(current) || current;
      await client.query(
        `INSERT INTO institutional_state (organization_id, payload, updated_at)
         VALUES ($1, $2::jsonb, now())
         ON CONFLICT (organization_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
        [orgId, JSON.stringify(next)]
      );
      await client.query('COMMIT');
      return structuredClone(next);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  const store = await readFileStore();
  const current = hydrateState(store.states?.[orgId] || seedState);
  const next = mutator(current) || current;
  store.states[orgId] = structuredClone(next);
  await writeFileStore(store);
  return structuredClone(next);
}

function mapDocument(row, includeSource = false) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    fileName: row.file_name,
    mimeType: row.mime_type,
    contentHash: row.content_hash,
    documentType: row.document_type,
    jurisdiction: row.jurisdiction,
    matter: row.matter,
    status: row.status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    analysis: row.analysis_payload || row.payload || row.analysis || null,
    ...(includeSource ? { sourceText: decryptText(row.encrypted_source) } : {})
  };
}

export async function saveDocument({ orgId, userId, title, fileName, mimeType, hash, documentType, jurisdiction, matter, sourceText, analysis }) {
  const id = uuid();
  const timestamp = now();
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO documents (id, organization_id, title, file_name, mime_type, content_hash, document_type, jurisdiction, matter, status, encrypted_source, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [id, orgId, title, fileName, mimeType, hash, documentType, jurisdiction, matter, 'AI Review Complete', encryptText(sourceText), userId]
      );
      await client.query(
        `INSERT INTO analyses (id, organization_id, document_id, engine, overall_risk, score, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
        [uuid(), orgId, id, analysis.engine, analysis.overall_risk, analysis.overall_score, JSON.stringify(analysis)]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return getDocument(orgId, id, false);
  }

  const store = await readFileStore();
  store.documents.push({ id, organization_id: orgId, title, file_name: fileName, mime_type: mimeType, content_hash: hash, document_type: documentType, jurisdiction, matter, status: 'AI Review Complete', encrypted_source: encryptText(sourceText), created_by: userId, created_at: timestamp, updated_at: timestamp });
  store.analyses.push({ id: uuid(), organization_id: orgId, document_id: id, engine: analysis.engine, overall_risk: analysis.overall_risk, score: analysis.overall_score, payload: structuredClone(analysis), created_at: timestamp });
  await writeFileStore(store);
  return getDocument(orgId, id, false);
}

export async function listDocuments(orgId, limit = 100) {
  if (pool) {
    const result = await pool.query(
      `SELECT d.*, a.engine, a.overall_risk, a.score
       FROM documents d
       LEFT JOIN LATERAL (
         SELECT engine, overall_risk, score FROM analyses WHERE document_id = d.id ORDER BY created_at DESC LIMIT 1
       ) a ON true
       WHERE d.organization_id = $1
       ORDER BY d.created_at DESC LIMIT $2`,
      [orgId, limit]
    );
    return result.rows.map(row => ({
      id: row.id, title: row.title, fileName: row.file_name, mimeType: row.mime_type,
      contentHash: row.content_hash, documentType: row.document_type, jurisdiction: row.jurisdiction,
      matter: row.matter, status: row.status, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
      engine: row.engine, overallRisk: row.overall_risk, score: row.score
    }));
  }
  const store = await readFileStore();
  return store.documents.filter(item => item.organization_id === orgId).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit).map(row => {
    const analysis = store.analyses.filter(item => item.document_id === row.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return { id: row.id, title: row.title, fileName: row.file_name, mimeType: row.mime_type, contentHash: row.content_hash, documentType: row.document_type, jurisdiction: row.jurisdiction, matter: row.matter, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, engine: analysis?.engine, overallRisk: analysis?.overall_risk, score: analysis?.score };
  });
}

export async function getDocument(orgId, id, includeSource = false) {
  if (pool) {
    const result = await pool.query(
      `SELECT d.*, a.payload AS analysis_payload
       FROM documents d
       LEFT JOIN LATERAL (
         SELECT payload FROM analyses WHERE document_id = d.id ORDER BY created_at DESC LIMIT 1
       ) a ON true
       WHERE d.organization_id = $1 AND d.id = $2 LIMIT 1`,
      [orgId, id]
    );
    return mapDocument(result.rows[0], includeSource);
  }
  const store = await readFileStore();
  const row = store.documents.find(item => item.organization_id === orgId && item.id === id);
  if (!row) return null;
  const analysis = store.analyses.filter(item => item.document_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return mapDocument({ ...row, analysis_payload: analysis?.payload }, includeSource);
}

export async function updateDocumentStatus(orgId, id, status) {
  if (pool) {
    const result = await pool.query('UPDATE documents SET status = $3, updated_at = now() WHERE organization_id = $1 AND id = $2 RETURNING id', [orgId, id, status]);
    return result.rowCount ? getDocument(orgId, id, false) : null;
  }
  const store = await readFileStore();
  const row = store.documents.find(item => item.organization_id === orgId && item.id === id);
  if (!row) return null;
  row.status = status;
  row.updated_at = now();
  await writeFileStore(store);
  return getDocument(orgId, id, false);
}

export async function logAudit({ orgId, user, action, entityType = null, entityId = null, metadata = {} }) {
  const record = { id: uuid(), organization_id: orgId || null, user_id: user?.id || null, user_email: user?.email || 'anonymous', role: user?.role || 'unknown', action, entity_type: entityType, entity_id: entityId, metadata: structuredClone(metadata), created_at: now() };
  if (pool) {
    await pool.query(
      `INSERT INTO audit_log (id, organization_id, user_id, user_email, role, action, entity_type, entity_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [record.id, record.organization_id, record.user_id, record.user_email, record.role, record.action, record.entity_type, record.entity_id, JSON.stringify(record.metadata)]
    );
    return;
  }
  const store = await readFileStore();
  store.audit.push(record);
  if (store.audit.length > 5000) store.audit = store.audit.slice(-5000);
  await writeFileStore(store);
}

export async function listAudit(orgId, limit = 300) {
  if (pool) {
    const result = await pool.query('SELECT * FROM audit_log WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2', [orgId, limit]);
    return result.rows.map(row => ({ id: row.id, userEmail: row.user_email, role: row.role, action: row.action, entityType: row.entity_type, entityId: row.entity_id, metadata: row.metadata, createdAt: row.created_at.toISOString() }));
  }
  const store = await readFileStore();
  return store.audit.filter(item => item.organization_id === orgId).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit).map(row => ({ id: row.id, userEmail: row.user_email, role: row.role, action: row.action, entityType: row.entity_type, entityId: row.entity_id, metadata: row.metadata, createdAt: row.created_at }));
}

export function healthStorage() {
  return pool
    ? { engine: 'PostgreSQL', encryptedSourceText: true, durable: true }
    : { engine: 'Encrypted atomic JSON local fallback', encryptedSourceText: true, durable: false, dataFile: path.basename(dataFile) };
}

export async function closeStorage() {
  if (pool) await pool.end();
}
