import { config } from './config.js';

const base = String(process.env.SYNESIS_SYNC_URL || 'https://synesis-new-model-3.onrender.com').replace(/\/$/, '');
const response = await fetch(`${base}/api/system/live-sync`, {
  method: 'POST',
  headers: { 'x-synesis-sync-token': config.syncToken, 'content-type': 'application/json' },
  body: '{}'
});
const text = await response.text();
if (!response.ok) {
  console.error(`Synesis live sync failed with HTTP ${response.status}: ${text.slice(0, 500)}`);
  process.exit(1);
}
let result = {};
try { result = JSON.parse(text); } catch {}
console.log(`Synesis live sync completed. Detected ${result?.liveBrain?.lastDetectedCount ?? 'unknown'} new items at ${result?.liveBrain?.lastSyncAt || new Date().toISOString()}.`);
