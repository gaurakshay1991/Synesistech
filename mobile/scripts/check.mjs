import fs from 'node:fs';

const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../src/api.js', import.meta.url), 'utf8');
const config = JSON.parse(fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8'));

const requiredAppSignals = [
  'Analyse document',
  'Independent evidence. No cross-document contamination.',
  'Ask with current law',
  'Exposure',
  'Live Brain',
  'Cognitive controls',
  'Single-document isolation is enforced.'
];
for (const signal of requiredAppSignals) {
  if (!app.includes(signal)) throw new Error(`Missing mobile product capability: ${signal}`);
}

const requiredApiRoutes = [
  '/auth/login', '/bootstrap', '/documents/analyze', '/documents/${id}/ask',
  '/documents/${id}/exposure', '/live/status', '/cognitive/run', '/cognitive/control-plane'
];
for (const route of requiredApiRoutes) {
  if (!api.includes(route)) throw new Error(`Missing API integration: ${route}`);
}

if (!String(config.expo?.extra?.apiBaseUrl || '').startsWith('https://')) throw new Error('Mobile API base URL must use HTTPS.');
if (config.expo?.ios?.bundleIdentifier !== 'com.synesis.neuro') throw new Error('Unexpected iOS bundle identifier.');

console.log('SYNESIS iOS product contract checks passed.');
