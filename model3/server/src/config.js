import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '../..');
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

const production = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET || 'synesis-model3-local-jwt-secret-change-before-production';
const encryptionSecret = process.env.DATA_ENCRYPTION_KEY || 'synesis-model3-local-encryption-secret-change-before-production';

export const config = Object.freeze({
  production,
  port: Number(process.env.PORT || 3000),
  clientDist: path.join(ROOT_DIR, 'client', 'dist'),
  databaseUrl: String(process.env.DATABASE_URL || '').trim(),
  databasePath: path.resolve(ROOT_DIR, 'server', process.env.DATABASE_PATH || './data/synesis-model3.db'),
  clientOrigins: String(process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(v => v.trim()).filter(Boolean),
  jwtSecret,
  encryptionSecret,
  secureCookie: String(process.env.COOKIE_SECURE ?? (production ? 'true' : 'false')).toLowerCase() === 'true',
  organizationName: process.env.SYNESIS_ORGANIZATION_NAME || 'Synesis Model 3 Organisation',
  organizationSlug: process.env.SYNESIS_ORGANIZATION_SLUG || 'synesis-model-3',
  bootstrapAdmin: {
    name: process.env.BOOTSTRAP_ADMIN_NAME || 'Synesis Administrator',
    email: process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@synesis.local',
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD || 'ChangeMe!12345'
  },
  openaiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-5-mini',
  maxUploadMb: Math.max(1, Math.min(25, Number(process.env.MAX_UPLOAD_MB || 15)))
});

export function assertProductionConfig() {
  if (!production) return;
  const missing = [];
  if (jwtSecret.length < 32) missing.push('JWT_SECRET');
  if (encryptionSecret.length < 32) missing.push('DATA_ENCRYPTION_KEY');
  if (!config.bootstrapAdmin.email || config.bootstrapAdmin.password.length < 12) missing.push('BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD');
  if (missing.length) throw new Error(`Unsafe production configuration: ${missing.join(', ')}`);
}
