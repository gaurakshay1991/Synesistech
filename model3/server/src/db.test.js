import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'synesis-model3-db-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = path.join(tempRoot, 'store.db');
process.env.JWT_SECRET = 'test-jwt-secret-that-is-longer-than-thirty-two-characters';
process.env.DATA_ENCRYPTION_KEY = 'test-encryption-secret-longer-than-thirty-two-characters';
process.env.SYNESIS_SYNC_TOKEN = 'test-sync-secret-that-is-longer-than-thirty-two-characters';
process.env.BOOTSTRAP_ADMIN_EMAIL = 'model3-test@example.com';
process.env.BOOTSTRAP_ADMIN_PASSWORD = 'Model3!Testing#2026';
process.env.SYNESIS_ORGANIZATION_SLUG = 'model3-test';

const db = await import(`./db.js?test=${Date.now()}`);

test.after(async () => {
  await db.closeStorage();
  await fs.rm(tempRoot, { recursive: true, force: true });
});

test('storage initializes an organisation, administrator and v5 institutional state', async () => {
  const orgId = await db.initializeStorage();
  assert.ok(orgId);
  const admin = await db.getUserByEmail('model3-test@example.com');
  assert.equal(admin.organization_id, orgId);
  assert.equal(admin.role, 'admin');
  const state = await db.getState(orgId);
  assert.ok(Array.isArray(state.tasks));
  assert.ok(state.metrics);
  assert.equal(state.schemaVersion, 5);
  assert.ok(Array.isArray(state.regulatoryUpdates));
  assert.ok(Array.isArray(state.governanceFrameworks));
  assert.ok(state.clauseMemory?.archetypes?.length > 0);
  assert.ok(Array.isArray(state.liveWatchlist));
  assert.match(state.liveBrain?.isolationPolicy || '', /isolated/i);
});

test('state hydration preserves legacy records while adding v5 live-brain modules', () => {
  const legacy = { schemaVersion: 3, metrics: { attention: 1 }, tasks: [{ id: 'legacy-task' }], customField: 'preserved' };
  const hydrated = db.hydrateState(legacy);
  assert.equal(hydrated.schemaVersion, 5);
  assert.equal(hydrated.tasks[0].id, 'legacy-task');
  assert.equal(hydrated.customField, 'preserved');
  assert.ok(Array.isArray(hydrated.regulatoryUpdates));
  assert.ok(Array.isArray(hydrated.litigationSimulations));
  assert.ok(hydrated.investorReadiness?.verifiedClaimsOnly);
  assert.ok(Array.isArray(hydrated.liveWatchlist));
  assert.equal(hydrated.liveBrain.status, 'Configured — awaiting first autonomous sync');
});

test('state mutations, encrypted document storage and audit persistence work', async () => {
  const orgId = db.organizationId || await db.initializeStorage();
  const admin = await db.getUserByEmail('model3-test@example.com');
  const next = await db.mutateState(orgId, current => {
    current.tasks.unshift({ id: 'test-task', title: 'Verify storage', status: 'Not started', priority: 'High' });
    return current;
  });
  assert.equal(next.tasks[0].id, 'test-task');

  const document = await db.saveDocument({
    orgId,
    userId: admin.id,
    title: 'Storage test agreement',
    fileName: 'storage-test.txt',
    mimeType: 'text/plain',
    hash: 'abc123',
    documentType: 'Agreement',
    jurisdiction: 'India',
    matter: 'Storage validation',
    sourceText: 'Confidential source text for encryption validation.',
    analysis: { engine: 'test', overall_risk: 'High', overall_score: 75, findings: [] }
  });
  assert.equal(document.title, 'Storage test agreement');
  const withSource = await db.getDocument(orgId, document.id, true);
  assert.equal(withSource.sourceText, 'Confidential source text for encryption validation.');

  await db.logAudit({ orgId, user: admin, action: 'storage.test', entityType: 'document', entityId: document.id });
  const audit = await db.listAudit(orgId, 10);
  assert.equal(audit[0].action, 'storage.test');
});
