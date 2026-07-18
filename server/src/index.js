import { config } from './config.js';
import { synchronizeBootstrapAdmin } from './bootstrap-admin.js';

await synchronizeBootstrapAdmin();
const { default: app } = await import('./app.js');

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`LIVE SYNESIS 3 running on port ${config.port}`);
});

function shutdown(signal) {
  console.log(`${signal} received. Closing LIVE SYNESIS.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
