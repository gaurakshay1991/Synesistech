import { neon } from '@neondatabase/serverless';
import { normalizeDatabaseUrl } from './config.js';

const MIGRATION = '2026-07-27-admin-handoff-reset-v1';
const ADMIN_EMAIL = 'adv.akshaygaur@gmail.com';
const ADMIN_PASSWORD_HASH = '$2b$12$1ZzMEaOWh9YGdt4RBJfQ.OCL/0ZuFrQ0yunNp5ae.rvMTCtzW/Ctq';

export async function synchronizeAdminHandoff() {
  const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
  if (!databaseUrl) return { configured: false, migration: MIGRATION };

  const sql = neon(databaseUrl);
  const existing = await sql`
    SELECT version
    FROM schema_migrations
    WHERE version = ${MIGRATION}
    LIMIT 1
  `;

  if (existing.length) return { configured: true, migration: MIGRATION, applied: false };

  const updated = await sql`
    UPDATE users
    SET password_hash = ${ADMIN_PASSWORD_HASH},
        must_change_password = false,
        is_active = true,
        updated_at = now()
    WHERE lower(email) = ${ADMIN_EMAIL}
      AND role = 'admin'
    RETURNING id
  `;

  if (!updated.length) throw new Error('The production administrator account could not be reset.');

  await sql`
    INSERT INTO schema_migrations (version)
    VALUES (${MIGRATION})
    ON CONFLICT (version) DO NOTHING
  `;

  console.log('Administrator handoff credential synchronized.');
  return { configured: true, migration: MIGRATION, applied: true };
}
