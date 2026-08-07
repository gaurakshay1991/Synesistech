import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd().endsWith('model3') ? process.cwd() : path.join(process.cwd(), 'model3');
function patch(relative, changes) {
  const file = path.join(root, relative);
  let value = fs.readFileSync(file, 'utf8');
  for (const [from, to] of changes) {
    if (!value.includes(from)) throw new Error(`Anchor missing in ${relative}: ${from.slice(0, 120)}`);
    value = value.replace(from, to);
  }
  fs.writeFileSync(file, value);
}

patch('server/src/live-routes.js', [
  ["async function performSync(orgId) {", "export async function performSync(orgId) {"],
  [
    "  app.get('/api/live/status', auth, route(async (req, res) => {\n    const state = await getState(req.orgId);",
    "  app.get('/api/live/status', auth, route(async (req, res) => {\n    let state = await getState(req.orgId);\n    const lastSync = new Date(state.liveBrain?.lastSyncAt || 0).getTime();\n    if (!lastSync || Date.now() - lastSync > config.liveSyncMinutes * 60_000) state = await performSync(req.orgId);"
  ]
]);

patch('server/src/index.js', [
  [
    "import { registerLiveRoutes } from './live-routes.js';",
    "import { registerLiveRoutes, performSync } from './live-routes.js';"
  ],
  [
    "registerLiveRoutes({ app, auth, allow, route, openai });",
    "registerLiveRoutes({ app, auth, allow, route, openai });\n\nlet liveSyncInProgress = false;\nasync function runLiveSourceHeartbeat() {\n  if (!config.production || !organizationId || liveSyncInProgress) return;\n  liveSyncInProgress = true;\n  try {\n    const state = await performSync(organizationId);\n    console.log(`Synesis Live Brain sync: ${state.liveBrain?.lastDetectedCount || 0} new events at ${state.liveBrain?.lastSyncAt || new Date().toISOString()}`);\n  } catch (error) {\n    console.error(`Synesis Live Brain sync failed: ${error.message}`);\n  } finally {\n    liveSyncInProgress = false;\n  }\n}\nconst liveSyncTimer = setInterval(runLiveSourceHeartbeat, config.liveSyncMinutes * 60_000);\nliveSyncTimer.unref();\nconst liveStartupTimer = setTimeout(runLiveSourceHeartbeat, 8_000);\nliveStartupTimer.unref();"
  ]
]);

console.log('Applied in-service autonomous Live Brain scheduler.');
