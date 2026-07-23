import express from 'express';
import { config } from './config.js';
import { synchronizeBootstrapAdmin } from './bootstrap-admin.js';
import mcpRouter from './mcp.js';

await synchronizeBootstrapAdmin();
const { default: gateway } = await import('../../api/index.js');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '8mb' }));
app.use(mcpRouter);
app.use(gateway);

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`LIVE SYNESIS 4 running on port ${config.port}`);
  console.log('MCP Streamable HTTP endpoint: /mcp');
  console.log(`Institutional multipass analysis: ${config.openaiKey ? `configured with ${config.openaiModel}` : 'emergency fallback only'}`);
});

function shutdown(signal) {
  console.log(`${signal} received. Closing LIVE SYNESIS.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
