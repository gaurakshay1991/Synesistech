import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function cookieFrom(response) {
  const raw = response.headers.get('set-cookie') || '';
  return raw.split(';')[0];
}

async function waitForHealth(baseUrl, child) {
  let lastError;
  for (let i = 0; i < 80; i += 1) {
    if (child.exitCode !== null) throw new Error(`Acceptance server exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return response.json();
    } catch (error) {
      lastError = error;
    }
    await sleep(125);
  }
  throw lastError || new Error('Acceptance server did not become healthy.');
}

test('end-to-end API acceptance gate: auth, isolation, analysis, exposure and Q&A', { timeout: 45_000 }, async () => {
  const token = `${process.pid}-${Date.now()}`;
  const port = 39000 + Math.floor(Math.random() * 1500);
  const baseUrl = `http://127.0.0.1:${port}`;
  const relativeDb = `./data/acceptance-${token}.db`;
  const jsonPath = path.resolve(process.cwd(), 'data', `acceptance-${token}.json`);
  const email = `qa-${token}@synesis.test`;
  const temporaryPassword = 'TempPass!12345';
  const permanentPassword = 'Permanent!Pass12345';

  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DATABASE_URL: '',
      DATABASE_PATH: relativeDb,
      COOKIE_SECURE: 'false',
      JWT_SECRET: 'acceptance-jwt-secret-that-is-longer-than-thirty-two-characters',
      DATA_ENCRYPTION_KEY: 'acceptance-encryption-secret-that-is-longer-than-thirty-two-characters',
      SYNESIS_SYNC_TOKEN: 'acceptance-sync-secret-that-is-longer-than-thirty-two-characters',
      BOOTSTRAP_ADMIN_NAME: 'Acceptance Administrator',
      BOOTSTRAP_ADMIN_EMAIL: email,
      BOOTSTRAP_ADMIN_PASSWORD: temporaryPassword,
      OPENAI_API_KEY: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });

  try {
    const health = await waitForHealth(baseUrl, child);
    assert.equal(health.ok, true);
    assert.equal(health.version, '5.0.0');
    assert.match(health.product, /Live Legal Brain|Neuro-Symbolic/i);

    let response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: temporaryPassword })
    });
    assert.equal(response.status, 200);
    let cookie = cookieFrom(response);
    const login = await response.json();
    assert.equal(login.user.email, email);
    assert.equal(login.user.mustChangePassword, true);
    assert.ok(cookie.includes('synesis_model3_session='));

    response = await fetch(`${baseUrl}/api/bootstrap`, { headers: { cookie } });
    assert.equal(response.status, 428, 'temporary password must block application use');

    response = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ currentPassword: temporaryPassword, newPassword: permanentPassword })
    });
    assert.equal(response.status, 200);
    cookie = cookieFrom(response) || cookie;

    response = await fetch(`${baseUrl}/api/bootstrap`, { headers: { cookie } });
    assert.equal(response.status, 200);
    const bootstrap = await response.json();
    assert.equal(bootstrap.user.mustChangePassword, false);
    assert.ok(bootstrap.state);

    async function analyse(title, text) {
      const form = new FormData();
      form.set('title', title);
      form.set('matter', 'Acceptance test matter');
      form.set('documentType', 'Vendor Agreement');
      form.set('jurisdiction', 'India');
      form.set('riskAppetite', 'Conservative');
      form.set('analysisMode', 'Deep');
      form.set('objective', 'Identify legal risk and exposure without using any other document.');
      form.set('text', text);
      const res = await fetch(`${baseUrl}/api/documents/analyze`, { method: 'POST', headers: { cookie }, body: form });
      const raw = await res.text();
      assert.equal(res.status, 201, raw);
      return JSON.parse(raw);
    }

    const first = await analyse(
      'Acceptance Alpha Agreement',
      'ALPHA-ONLY-991. The supplier shall have unlimited liability for all losses. The supplier shall process personal data. Security incidents shall be notified within 24 hours. The customer has audit rights and access to records.'
    );
    const firstAnalysis = first.document.analysis;
    assert.ok(first.document.id);
    assert.equal(firstAnalysis.analysis_details.document_isolation, 'single-document');
    assert.ok(firstAnalysis.exposure_model, 'exposure model must be attached to every analysed document');
    assert.match(JSON.stringify(firstAnalysis.exposure_model), /unbounded|unlimited|quantif/i);
    assert.ok(firstAnalysis.live_current_law, 'every analysis must carry an explicit current-law result or explicit unavailability object');
    assert.equal(firstAnalysis.live_current_law.isolation.otherDocumentMemoryUsed, false);

    const second = await analyse(
      'Acceptance Beta Agreement',
      'BETA-ONLY-772. Liability is capped at INR 2 crore in aggregate. The agreement includes audit rights and a 24 hour security incident notification obligation.'
    );
    assert.ok(second.document.id);

    response = await fetch(`${baseUrl}/api/documents/${first.document.id}`, { headers: { cookie } });
    assert.equal(response.status, 200);
    const firstReloaded = await response.json();
    const firstSerialized = JSON.stringify(firstReloaded);
    assert.match(firstSerialized, /ALPHA-ONLY-991/);
    assert.doesNotMatch(firstSerialized, /BETA-ONLY-772/, 'analysis of document A must not absorb document B');

    response = await fetch(`${baseUrl}/api/documents/${first.document.id}/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ question: 'What liability exposure is present in this selected document?' })
    });
    assert.equal(response.status, 200);
    const qa = await response.json();
    assert.ok(qa.engine);
    assert.doesNotMatch(JSON.stringify(qa), /BETA-ONLY-772/, 'single-document Q&A must not leak the other document');

    response = await fetch(`${baseUrl}/api/documents`, { headers: { cookie } });
    assert.equal(response.status, 200);
    const list = await response.json();
    assert.ok(list.documents.some(item => item.id === first.document.id));
    assert.ok(list.documents.some(item => item.id === second.document.id));
  } finally {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      sleep(2000)
    ]);
    await fs.rm(jsonPath, { force: true }).catch(() => {});
    if (child.exitCode && child.exitCode !== 0 && stderr) console.error(stderr);
  }
});
