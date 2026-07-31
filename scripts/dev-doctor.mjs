import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const major = Number(process.versions.node.split('.')[0]);
const errors = [];
const warnings = [];

if (major < 20 || major >= 23) {
  errors.push(`Unsupported Node.js ${process.versions.node}. Install Node.js 22 LTS for this repository.`);
}

const requiredFiles = [
  'package.json',
  'client/package.json',
  'server/package.json',
  'server/schema.sql',
  'client/vite.config.js'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`Missing required file: ${file}`);
}

const envPath = ['.env.local', '.env.runtime', '.env']
  .map(file => path.join(root, file))
  .find(file => fs.existsSync(file));

if (!envPath) {
  errors.push('No local environment file found. Run: npm run setup:local');
} else {
  const values = new Map();
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    values.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }

  const placeholder = value => !value || /set_|replace|paste|change.?this|local_value/i.test(value);
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'DATA_ENCRYPTION_KEY',
    'BOOTSTRAP_ADMIN_EMAIL',
    'BOOTSTRAP_ADMIN_PASSWORD',
    'SYNESIS_AI_MODE'
  ];

  for (const key of required) {
    if (placeholder(values.get(key))) errors.push(`${key} is missing or still contains a placeholder.`);
  }

  const databaseUrl = values.get('DATABASE_URL') || '';
  if (databaseUrl && !/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    errors.push('DATABASE_URL is not a PostgreSQL connection string.');
  }
  if (/\s/.test(databaseUrl)) errors.push('DATABASE_URL contains whitespace. Copy it again from Neon.');

  const jwt = values.get('JWT_SECRET') || '';
  const encryption = values.get('DATA_ENCRYPTION_KEY') || '';
  if (jwt && jwt.length < 32) errors.push('JWT_SECRET must be at least 32 characters.');
  if (encryption && encryption.length < 32) errors.push('DATA_ENCRYPTION_KEY must be at least 32 characters.');
  if (jwt && encryption && jwt === encryption) errors.push('JWT_SECRET and DATA_ENCRYPTION_KEY must be different.');

  const mode = String(values.get('SYNESIS_AI_MODE') || '').toLowerCase();
  if (!['prototype', 'live', 'auto'].includes(mode)) errors.push('SYNESIS_AI_MODE must be prototype, live or auto.');
  if (mode === 'live' && placeholder(values.get('OPENAI_API_KEY'))) {
    errors.push('OPENAI_API_KEY is required when SYNESIS_AI_MODE=live.');
  }
  if (mode === 'auto' && placeholder(values.get('OPENAI_API_KEY'))) {
    warnings.push('SYNESIS_AI_MODE=auto has no usable OPENAI_API_KEY; analysis will remain deterministic.');
  }

  console.log(`Environment file: ${path.basename(envPath)}`);
  console.log(`AI mode: ${mode || 'not set'}`);
}

if (!fs.existsSync(path.join(root, 'node_modules'))) {
  warnings.push('Dependencies are not installed. Run: npm install');
}

for (const warning of warnings) console.warn(`WARNING: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(`Node.js ${process.versions.node}: supported`);
console.log('Development configuration check passed. Secret values were not printed.');
