import fs from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { config } from '../src/config.js';

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required for database migration.');
}

const sql = neon(config.databaseUrl);
const schema = await fs.readFile(new URL('../schema.sql', import.meta.url), 'utf8');
const statements = schema
  .split(/;\s*(?:\r?\n|$)/)
  .map(statement => statement.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement, []);
}
console.log('LIVE SYNESIS database migration completed.');
