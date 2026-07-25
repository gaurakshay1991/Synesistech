import express from 'express';
import { config } from './config.js';
import { synchronizeBootstrapAdmin } from './bootstrap-admin.js';
import mcpRouter from './mcp.js';

await synchronizeBootstrapAdmin();
const { default: privateApp } = await import('./app.js');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    product: 'LIVE SYNESIS',
    mode: config.aiMode,
    storage: config.databaseUrl ? 'neon-postgres' : 'local',
    aiConfigured: config.openaiConfigured,
    model: config.openaiModel,
    time: new Date().toISOString()
  });
});

app.use(mcpRouter);
app.use(privateApp);

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`LIVE SYNESIS 4 running on port ${config.port}`);
  console.log('MCP Streamable HTTP endpoint: /mcp');
  console.log(`Storage: ${config.databaseUrl ? 'Neon Postgres' : 'local development store'}`);
  console.log(`Analysis mode: ${config.aiMode}${config.aiMode === 'prototype' ? ' (quota-independent deterministic engine)' : ` (${config.openaiModel})`}`);
});

function shutdown(signal) {
  console.log(`${signal} received. Closing LIVE SYNESIS.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
