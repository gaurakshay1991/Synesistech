import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const sourceFile = fileURLToPath(import.meta.url);
export const ROOT_DIR = path.resolve(path.dirname(sourceFile), '../..');

dotenv.config({ path: path.join(ROOT_DIR, '.env.runtime'), override: false });
dotenv.config({ path: path.join(ROOT_DIR, '.env.local'), override: false });
dotenv.config({ path: path.join(ROOT_DIR, '.env'), override: false });

export function normalizeDatabaseUrl(value = '') {
  return String(value).replace(/[\r\n\t ]+/g, '');
}

export function normalizeOpenAIModel(value = '') {
  const requested = String(value || 'gpt-5-mini').trim();
  const chatOnlyAliases = new Set(['gpt-5.6', 'gpt-5.6-thinking', 'chatgpt-gpt-5.6']);
  return chatOnlyAliases.has(requested.toLowerCase()) ? 'gpt-5-mini' : requested;
}

const production = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
const publicMode = String(process.env.SYNESIS_PUBLIC_MODE ?? 'true').toLowerCase() !== 'false';

export const config = Object.freeze({
  production,
  publicMode,
  port: Number(process.env.PORT || 3000),
  clientDist: path.join(ROOT_DIR, 'client', 'dist'),
  databaseUrl: normalizeDatabaseUrl(process.env.DATABASE_URL),
  dataFile: process.env.DATA_FILE || (production
    ? '/tmp/live-synesis-store.json'
    : path.join(ROOT_DIR, 'server', 'data', 'live-synesis-store.json')),
  jwtSecret: process.env.JWT_SECRET || (production ? '' : 'live-synesis-local-development-secret'),
  encryptionSecret: process.env.DATA_ENCRYPTION_KEY || process.env.JWT_SECRET || (production ? '' : 'live-synesis-local-encryption-secret'),
  openaiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: normalizeOpenAIModel(process.env.OPENAI_MODEL),
  maxUploadMb: Math.max(1, Math.min(25, Number(process.env.MAX_UPLOAD_MB || 15))),
  organizationName: process.env.SYNESIS_ORGANIZATION_NAME || 'Synesis',
  organizationSlug: process.env.SYNESIS_ORGANIZATION_SLUG || 'synesis',
  bootstrapAdmin: {
    name: process.env.BOOTSTRAP_ADMIN_NAME || 'Platform Administrator',
    email: process.env.BOOTSTRAP_ADMIN_EMAIL || '',
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD || ''
  },
  clientOrigins: String(process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
});

export function assertProductionConfig() {
  if (!config.production || config.publicMode) return;
  const missing = [];
  if (!config.databaseUrl) missing.push('DATABASE_URL');
  if (config.jwtSecret.length < 32) missing.push('JWT_SECRET');
  if (config.encryptionSecret.length < 32) missing.push('DATA_ENCRYPTION_KEY');
  if (!config.bootstrapAdmin.email || config.bootstrapAdmin.password.length < 8) {
    missing.push('BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD');
  }
  if (missing.length) {
    throw new Error(`Missing or unsafe production configuration: ${missing.join(', ')}`);
  }
}
