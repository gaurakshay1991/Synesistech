import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { config } from './config.js';
import { seedState } from './seed.js';

const { Pool } = pg;
const pool = config.databaseUrl ? new Pool({ connectionString: config.databaseUrl }) : null;
const dataFile = config.databasePath.replace(/\.db$/i, '.json');
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
export let organizationId = null;

function encryptionKey() {
  return crypto.createHash('sha256').update(config.encryptionSecret).digest();
}

export function encryptText(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(x => x.toString('base64url')).join('.');
}

export function decryptText(value) {
  const [iv, tag, encrypted] = String(value).split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}

function freshStore() {
  const orgId = uuid();
  return {
    organizations: [{ id: orgId, name: config.organizationName, slug: config.organizationSlug, created_at: now() }],
    users: [{ id: uuid(), organization_id: orgId, name: config.bootstrapAdmin.name, email: config.bootstrapAdmin.email.toLowerCase(), role: 'admin', password_hash: bcrypt.hashSync(config.bootstrapAdmin.password, 12), is_active: 1, must_change_password: 1, created_at: now(), last_login_at: null }],
    states: { [orgId]: structuredClone(seedState) }, documents: [], analyses: [], audit: []
  };
}

async function readStore() {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  try { return JSON.parse(await fs.readFile(dataFile, 'utf8')); }
  catch { const store = freshStore(); await writeStore(store); return store; }
}

async function writeStore(store) {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  const temporary = `${dataFile}.${process.pid}.${uuid()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(store, null, 2), { mode: 0o600 });
  await fs.rename(temporary, dataFile);
}

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizations(id uuid PRIMARY KEY,name text NOT NULL,slug text UNIQUE NOT NULL,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
    CREATE TABLE IF NOT EXISTS users(id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,name text NOT NULL,email text UNIQUE NOT NULL,role text NOT NULL,password_hash text NOT NULL,is_active boolean DEFAULT true,must_change_password boolean DEFAULT true,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),last_login_at timestamptz);
    CREATE TABLE IF NOT EXISTS institutional_state(organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,payload jsonb NOT NULL,updated_at timestamptz DEFAULT now());
    CREATE TABLE IF NOT EXISTS documents(id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,title text NOT NULL,file_name text,mime_type text,content_hash text NOT NULL,document_type text,jurisdiction text,matter text,status text NOT NULL,encrypted_source text NOT NULL,created_by uuid,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
    CREATE TABLE IF NOT EXISTS analyses(id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,engine text,overall_risk text,score integer,payload jsonb NOT NULL,created_at timestamptz DEFAULT now());
    CREATE TABLE IF NOT EXISTS audit_log(id uuid PRIMARY KEY,organization_id uuid,user_id uuid,user_email text NOT NULL,role text NOT NULL,action text NOT NULL,entity_type text,entity_id text,metadata jsonb DEFAULT '{}'::jsonb,created_at timestamptz DEFAULT now());
    CREATE INDEX IF NOT EXISTS documents_org_idx ON documents(organization_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS analyses_doc_idx ON analyses(document_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS audit_org_idx ON audit_log(organization_id,created_at DESC);
  `);
}

export async function initializeStorage() {
  if (pool) {
    await migrate();
    const proposed = uuid();
    const org = await pool.query(`INSERT INTO organizations(id,name,slug) VALUES($1,$2,$3) ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name,updated_at=now() RETURNING id`, [proposed, config.organizationName, config.organizationSlug]);
    organizationId = org.rows[0].id;
    if (!(await getUserByEmail(config.bootstrapAdmin.email))) await createUser({ orgId: organizationId, name: config.bootstrapAdmin.name, email: config.bootstrapAdmin.email, role: 'admin', passwordHash: bcrypt.hashSync(config.bootstrapAdmin.password, 12) });
    await pool.query(`INSERT INTO institutional_state(organization_id,payload) VALUES($1,$2::jsonb) ON CONFLICT(organization_id) DO NOTHING`, [organizationId, JSON.stringify(seedState)]);
    return organizationId;
  }
  const store = await readStore();
  organizationId = store.organizations[0].id;
  if (!store.states?.[organizationId]) store.states = { ...(store.states || {}), [organizationId]: structuredClone(seedState) };
  await writeStore(store);
  return organizationId;
}

function mapUser(row) {
  if (!row) return null;
  return { ...row, is_active: row.is_active === true || row.is_active === 1, must_change_password: row.must_change_password === true || row.must_change_password === 1, created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at, last_login_at: row.last_login_at instanceof Date ? row.last_login_at.toISOString() : row.last_login_at };
}

export async function getUserByEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  if (pool) return mapUser((await pool.query('SELECT * FROM users WHERE email=$1 LIMIT 1', [value])).rows[0]);
  return mapUser((await readStore()).users.find(x => x.email === value));
}

export async function getUserById(id) {
  if (pool) return mapUser((await pool.query('SELECT * FROM users WHERE id=$1 LIMIT 1', [id])).rows[0]);
  return mapUser((await readStore()).users.find(x => x.id === id));
}

export async function touchLogin(id) {
  if (pool) return void await pool.query('UPDATE users SET last_login_at=now(),updated_at=now() WHERE id=$1', [id]);
  const store = await readStore(); const user = store.users.find(x => x.id === id); if (user) user.last_login_at = now(); await writeStore(store);
}

export async function updatePassword(id, passwordHash) {
  if (pool) return void await pool.query('UPDATE users SET password_hash=$2,must_change_password=false,updated_at=now() WHERE id=$1', [id, passwordHash]);
  const store = await readStore(); const user = store.users.find(x => x.id === id); if (user) { user.password_hash = passwordHash; user.must_change_password = 0; } await writeStore(store);
}

export async function listUsers(orgId) {
  if (pool) return (await pool.query('SELECT * FROM users WHERE organization_id=$1 ORDER BY name', [orgId])).rows.map(mapUser);
  return (await readStore()).users.filter(x => x.organization_id === orgId).map(mapUser);
}

export async function createUser({ orgId, name, email, role, passwordHash }) {
  const id = uuid(); const normalized = email.toLowerCase();
  if (pool) return mapUser((await pool.query(`INSERT INTO users(id,organization_id,name,email,role,password_hash,is_active,must_change_password) VALUES($1,$2,$3,$4,$5,$6,true,true) RETURNING *`, [id, orgId, name, normalized, role, passwordHash])).rows[0]);
  const store = await readStore(); const record = { id, organization_id: orgId, name, email: normalized, role, password_hash: passwordHash, is_active: 1, must_change_password: 1, created_at: now(), last_login_at: null }; store.users.push(record); await writeStore(store); return mapUser(record);
}

export async function setUserActive(id, active) {
  if (pool) return void await pool.query('UPDATE users SET is_active=$2,updated_at=now() WHERE id=$1', [id, active]);
  const store = await readStore(); const user = store.users.find(x => x.id === id); if (user) user.is_active = active ? 1 : 0; await writeStore(store);
}

export async function getState(orgId) {
  if (pool) return structuredClone((await pool.query('SELECT payload FROM institutional_state WHERE organization_id=$1', [orgId])).rows[0]?.payload || seedState);
  return structuredClone((await readStore()).states?.[orgId] || seedState);
}

export async function mutateState(orgId, mutator) {
  if (pool) {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const result = await client.query('SELECT payload FROM institutional_state WHERE organization_id=$1 FOR UPDATE', [orgId]); const state = structuredClone(result.rows[0]?.payload || seedState); const next = mutator(state) || state; await client.query(`INSERT INTO institutional_state(organization_id,payload,updated_at) VALUES($1,$2::jsonb,now()) ON CONFLICT(organization_id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now()`, [orgId, JSON.stringify(next)]); await client.query('COMMIT'); return structuredClone(next); }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  const store = await readStore(); const state = structuredClone(store.states?.[orgId] || seedState); const next = mutator(state) || state; store.states[orgId] = structuredClone(next); await writeStore(store); return structuredClone(next);
}

function documentMap(row, includeSource = false) {
  if (!row) return null;
  return { id: row.id, title: row.title, fileName: row.file_name, mimeType: row.mime_type, contentHash: row.content_hash, documentType: row.document_type, jurisdiction: row.jurisdiction, matter: row.matter, status: row.status, createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at, updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at, analysis: row.analysis_payload || row.payload || null, ...(includeSource ? { sourceText: decryptText(row.encrypted_source) } : {}) };
}

export async function saveDocument({ orgId, userId, title, fileName, mimeType, hash, documentType, jurisdiction, matter, sourceText, analysis }) {
  const id = uuid();
  if (pool) {
    const client = await pool.connect();
    try { await client.query('BEGIN'); await client.query(`INSERT INTO documents(id,organization_id,title,file_name,mime_type,content_hash,document_type,jurisdiction,matter,status,encrypted_source,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'AI Review Complete',$10,$11)`, [id, orgId, title, fileName, mimeType, hash, documentType, jurisdiction, matter, encryptText(sourceText), userId]); await client.query(`INSERT INTO analyses(id,organization_id,document_id,engine,overall_risk,score,payload) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`, [uuid(), orgId, id, analysis.engine, analysis.overall_risk, analysis.overall_score, JSON.stringify(analysis)]); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  } else {
    const store = await readStore(); const timestamp = now(); store.documents.push({ id, organization_id: orgId, title, file_name: fileName, mime_type: mimeType, content_hash: hash, document_type: documentType, jurisdiction, matter, status: 'AI Review Complete', encrypted_source: encryptText(sourceText), created_by: userId, created_at: timestamp, updated_at: timestamp }); store.analyses.push({ id: uuid(), organization_id: orgId, document_id: id, engine: analysis.engine, overall_risk: analysis.overall_risk, score: analysis.overall_score, payload: structuredClone(analysis), created_at: timestamp }); await writeStore(store);
  }
  return getDocument(orgId, id, false);
}

export async function listDocuments(orgId, limit = 100) {
  if (pool) {
    const rows = (await pool.query(`SELECT d.*,a.engine,a.overall_risk,a.score FROM documents d LEFT JOIN LATERAL(SELECT engine,overall_risk,score FROM analyses WHERE document_id=d.id ORDER BY created_at DESC LIMIT 1)a ON true WHERE d.organization_id=$1 ORDER BY d.created_at DESC LIMIT $2`, [orgId, limit])).rows;
    return rows.map(x => ({ id: x.id, title: x.title, fileName: x.file_name, mimeType: x.mime_type, contentHash: x.content_hash, documentType: x.document_type, jurisdiction: x.jurisdiction, matter: x.matter, status: x.status, createdAt: x.created_at.toISOString(), updatedAt: x.updated_at.toISOString(), engine: x.engine, overallRisk: x.overall_risk, score: x.score }));
  }
  const store = await readStore(); return store.documents.filter(x => x.organization_id === orgId).sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0,limit).map(x => { const a = store.analyses.filter(y => y.document_id === x.id).sort((m,n) => n.created_at.localeCompare(m.created_at))[0]; return { id:x.id,title:x.title,fileName:x.file_name,mimeType:x.mime_type,contentHash:x.content_hash,documentType:x.document_type,jurisdiction:x.jurisdiction,matter:x.matter,status:x.status,createdAt:x.created_at,updatedAt:x.updated_at,engine:a?.engine,overallRisk:a?.overall_risk,score:a?.score }; });
}

export async function getDocument(orgId, id, includeSource = false) {
  if (pool) return documentMap((await pool.query(`SELECT d.*,a.payload AS analysis_payload FROM documents d LEFT JOIN LATERAL(SELECT payload FROM analyses WHERE document_id=d.id ORDER BY created_at DESC LIMIT 1)a ON true WHERE d.organization_id=$1 AND d.id=$2 LIMIT 1`, [orgId,id])).rows[0], includeSource);
  const store = await readStore(); const row = store.documents.find(x => x.organization_id === orgId && x.id === id); if (!row) return null; const analysis = store.analyses.filter(x => x.document_id === id).sort((a,b) => b.created_at.localeCompare(a.created_at))[0]; return documentMap({ ...row, analysis_payload: analysis?.payload }, includeSource);
}

export async function updateDocumentStatus(orgId, id, status) {
  if (pool) { const result = await pool.query('UPDATE documents SET status=$3,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING id', [orgId,id,status]); return result.rowCount ? getDocument(orgId,id,false) : null; }
  const store = await readStore(); const row = store.documents.find(x => x.organization_id === orgId && x.id === id); if (!row) return null; row.status=status; row.updated_at=now(); await writeStore(store); return getDocument(orgId,id,false);
}

export async function logAudit({ orgId, user, action, entityType=null, entityId=null, metadata={} }) {
  const record = { id:uuid(),organization_id:orgId||null,user_id:user?.id||null,user_email:user?.email||'anonymous',role:user?.role||'unknown',action,entity_type:entityType,entity_id:entityId,metadata:structuredClone(metadata),created_at:now() };
  if (pool) return void await pool.query(`INSERT INTO audit_log(id,organization_id,user_id,user_email,role,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, [record.id,record.organization_id,record.user_id,record.user_email,record.role,record.action,record.entity_type,record.entity_id,JSON.stringify(record.metadata)]);
  const store = await readStore(); store.audit.push(record); store.audit = store.audit.slice(-5000); await writeStore(store);
}

export async function listAudit(orgId, limit=300) {
  if (pool) return (await pool.query('SELECT * FROM audit_log WHERE organization_id=$1 ORDER BY created_at DESC LIMIT $2',[orgId,limit])).rows.map(x => ({ id:x.id,userEmail:x.user_email,role:x.role,action:x.action,entityType:x.entity_type,entityId:x.entity_id,metadata:x.metadata,createdAt:x.created_at.toISOString() }));
  return (await readStore()).audit.filter(x => x.organization_id === orgId).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,limit).map(x => ({ id:x.id,userEmail:x.user_email,role:x.role,action:x.action,entityType:x.entity_type,entityId:x.entity_id,metadata:x.metadata,createdAt:x.created_at }));
}

export function healthStorage() { return pool ? { engine:'PostgreSQL',encryptedSourceText:true,durable:true } : { engine:'Encrypted atomic JSON local fallback',encryptedSourceText:true,durable:false }; }
