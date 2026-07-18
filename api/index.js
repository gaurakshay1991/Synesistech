import { synchronizeBootstrapAdmin } from '../server/src/bootstrap-admin.js';

await synchronizeBootstrapAdmin();
const { default: app } = await import('../server/src/app.js');

export default app;
