import pg from 'pg';

const { Pool } = pg;
const sourceUrl = String(process.env.DATABASE_URL || '').trim();
const targetUrl = String(process.env.NEON_DATABASE_URL || '').trim();

if (!targetUrl) {
  console.log('SYNESIS Neon migration skipped: NEON_DATABASE_URL is not configured.');
  process.exit(0);
}
if (!sourceUrl) throw new Error('DATABASE_URL is required for the source database migration.');
if (sourceUrl === targetUrl) {
  console.log('SYNESIS Neon migration skipped: DATABASE_URL already points to the Neon target.');
  process.exit(0);
}

const source = new Pool({ connectionString: sourceUrl, max: 1, connectionTimeoutMillis: 15000 });
const target = new Pool({ connectionString: targetUrl, max: 1, connectionTimeoutMillis: 15000 });

const TABLES = [
  { name: 'organizations', key: 'id', verify: ['id', 'name', 'slug'] },
  { name: 'users', key: 'id', verify: ['id', 'organization_id', 'name', 'email', 'role', 'password_hash', 'is_active', 'must_change_password'] },
  { name: 'institutional_state', key: 'organization_id', verify: ['organization_id', 'payload'] },
  { name: 'documents', key: 'id', verify: ['id', 'organization_id', 'title', 'file_name', 'mime_type', 'content_hash', 'document_type', 'jurisdiction', 'matter', 'status', 'encrypted_source', 'created_by'] },
  { name: 'analyses', key: 'id', verify: ['id', 'organization_id', 'document_id', 'engine', 'overall_risk', 'score', 'payload'] },
  { name: 'audit_log', key: 'id', verify: ['id', 'organization_id', 'user_id', 'user_email', 'role', 'action', 'entity_type', 'entity_id', 'metadata'] }
];

const q = identifier => `"${String(identifier).replaceAll('"', '""')}"`;

async function ensureTargetSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name text NOT NULL, email text NOT NULL UNIQUE, role text NOT NULL, password_hash text NOT NULL,
      is_active boolean NOT NULL DEFAULT true, must_change_password boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), last_login_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS users_org_idx ON users(organization_id);
    CREATE TABLE IF NOT EXISTS institutional_state (
      organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS documents (
      id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      title text NOT NULL, file_name text, mime_type text, content_hash text NOT NULL, document_type text,
      jurisdiction text, matter text, status text NOT NULL, encrypted_source text NOT NULL,
      created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS documents_org_updated_idx ON documents(organization_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS analyses (
      id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE, engine text, overall_risk text,
      score integer, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS analyses_document_created_idx ON analyses(document_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS audit_log (
      id uuid PRIMARY KEY, organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
      user_id uuid, user_email text NOT NULL, role text NOT NULL, action text NOT NULL,
      entity_type text, entity_id text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS audit_org_created_idx ON audit_log(organization_id, created_at DESC);
  `);
}

async function columns(client, table) {
  const result = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
    [table]
  );
  return result.rows.map(row => row.column_name);
}

async function copyTable(sourceClient, targetClient, table, key) {
  const [sourceColumns, targetColumns] = await Promise.all([columns(sourceClient, table), columns(targetClient, table)]);
  if (!sourceColumns.length) throw new Error(`Source table ${table} is missing.`);
  const missing = sourceColumns.filter(column => !targetColumns.includes(column));
  if (missing.length) throw new Error(`Target table ${table} is missing source columns: ${missing.join(', ')}`);

  const rows = (await sourceClient.query(`SELECT * FROM ${q(table)} ORDER BY ${q(key)}::text`)).rows;
  for (const row of rows) {
    const cols = Object.keys(row).filter(column => targetColumns.includes(column));
    const values = cols.map(column => row[column]);
    const updates = cols.filter(column => column !== key).map(column => `${q(column)}=EXCLUDED.${q(column)}`);
    const placeholders = cols.map((_, index) => `$${index + 1}`);
    const sql = `INSERT INTO ${q(table)} (${cols.map(q).join(',')}) VALUES (${placeholders.join(',')}) ON CONFLICT (${q(key)}) DO ${updates.length ? `UPDATE SET ${updates.join(',')}` : 'NOTHING'}`;
    await targetClient.query(sql, values);
  }
  return { table, copied: rows.length };
}

async function fingerprint(client, table) {
  const values = table.verify.map(column => `t.${q(column)}`).join(', ');
  const result = await client.query(`
    SELECT count(*)::bigint AS count,
      md5(COALESCE(string_agg(md5(jsonb_build_array(${values})::text), '' ORDER BY t.${q(table.key)}::text), '')) AS fingerprint
    FROM ${q(table.name)} t
  `);
  return { count: String(result.rows[0]?.count || '0'), fingerprint: result.rows[0]?.fingerprint || '' };
}

let sourceClient;
let targetClient;
try {
  sourceClient = await source.connect();
  targetClient = await target.connect();
  await sourceClient.query('SELECT 1');
  await targetClient.query('SELECT 1');
  await targetClient.query('BEGIN');
  await ensureTargetSchema(targetClient);

  const copied = [];
  for (const table of TABLES) copied.push(await copyTable(sourceClient, targetClient, table.name, table.key));

  const verification = [];
  for (const table of TABLES) {
    const [from, to] = await Promise.all([fingerprint(sourceClient, table), fingerprint(targetClient, table)]);
    const match = from.count === to.count && from.fingerprint === to.fingerprint;
    verification.push({ table: table.name, count: from.count, match });
    if (!match) throw new Error(`Verification failed for ${table.name}: source ${from.count}/${from.fingerprint}, target ${to.count}/${to.fingerprint}`);
  }

  await targetClient.query('COMMIT');
  console.log(`SYNESIS_NEON_MIGRATION_OK ${JSON.stringify({ copied, verification })}`);
} catch (error) {
  if (targetClient) await targetClient.query('ROLLBACK').catch(() => {});
  console.error(`SYNESIS_NEON_MIGRATION_FAILED ${String(error?.message || error).slice(0, 1000)}`);
  process.exitCode = 1;
} finally {
  sourceClient?.release();
  targetClient?.release();
  await source.end().catch(() => {});
  await target.end().catch(() => {});
}
