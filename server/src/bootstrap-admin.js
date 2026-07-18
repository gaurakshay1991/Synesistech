import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';

export async function synchronizeBootstrapAdmin() {
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '');

  if (!databaseUrl || !email || !password) return;
  if (password.length < 8) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain at least 8 characters.');
  }

  const sql = neon(databaseUrl);
  const rows = await sql`
    SELECT id, must_change_password
    FROM users
    WHERE lower(email) = ${email}
    LIMIT 1
  `;
  const user = rows[0];

  if (!user || !user.must_change_password) return;

  const passwordHash = await bcrypt.hash(password, 12);
  await sql`
    UPDATE users
    SET password_hash = ${passwordHash},
        must_change_password = false,
        is_active = true,
        updated_at = now()
    WHERE id = ${user.id}
  `;

  console.log('Bootstrap administrator credentials synchronized.');
}
