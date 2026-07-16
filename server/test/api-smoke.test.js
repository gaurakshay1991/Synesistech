import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const defective = `Vendor may use Bank customer KYC records for system training and investor demonstrations. Vendor may share Bank Data with affiliates and subcontractors without prior written approval. Vendor shall notify the Bank of a data breach within thirty business days. The Bank and regulators shall not have audit rights. Vendor liability shall not exceed INR 50,000 and Vendor shall not be liable for data breach, fraud or gross negligence.`;
const corrected = `Bank Data remains the property of the Bank. Vendor shall process Bank Data solely on documented instructions and shall not use it for training, marketing or benchmarking. Vendor shall not subcontract without prior written approval and remains fully responsible for subcontractors. Vendor shall notify the Bank immediately and within twenty-four hours of any suspected or actual incident. The Bank and regulators have reasonable audit rights. Liability limits do not apply to fraud, gross negligence, confidentiality breach or data breach.`;

async function waitForHealth(baseUrl, process, output) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (process.exitCode !== null) throw new Error(`Server exited before health check.\n${output.join('')}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return response.json();
    } catch {
      // Server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not become healthy.\n${output.join('')}`);
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  assert.ok(response.ok, `${response.status}: ${JSON.stringify(data)}`);
  return data;
}

test('LIVE SYNESIS API completes login, document analysis, comparison, assistant and deletion', { timeout: 30_000 }, async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'live-synesis-test-'));
  const dataFile = path.join(temp, 'store.json');
  const port = 41000 + Math.floor(Math.random() * 1000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const output = [];
  const currentDirectory = process.cwd();
  const serverDirectory = path.basename(currentDirectory) === 'server'
    ? currentDirectory
    : path.resolve(currentDirectory, 'server');
  const server = spawn(process.execPath, ['src/index.js'], {
    cwd: serverDirectory,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DATA_FILE: dataFile,
      JWT_SECRET: 'integration-test-jwt-secret-with-sufficient-length',
      DATA_ENCRYPTION_KEY: 'integration-test-encryption-key-with-sufficient-length',
      OPENAI_API_KEY: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', chunk => output.push(chunk.toString()));
  server.stderr.on('data', chunk => output.push(chunk.toString()));
  t.after(async () => {
    server.kill('SIGTERM');
    await fs.rm(temp, { recursive: true, force: true });
  });

  const health = await waitForHealth(baseUrl, server, output);
  assert.equal(health.product, 'LIVE SYNESIS');
  assert.equal(health.storageEncryption, true);

  const login = await jsonRequest(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'legal@synesis.local', password: 'LegalDemoOnly123!' })
  });
  assert.ok(login.token);
  const headers = { Authorization: `Bearer ${login.token}` };

  async function analyse(title, text) {
    const form = new FormData();
    form.set('title', title);
    form.set('matter', 'Automated regression test');
    form.set('documentType', 'Vendor / Outsourcing Agreement');
    form.set('jurisdiction', 'India');
    form.set('riskAppetite', 'Conservative');
    form.set('text', text);
    return jsonRequest(`${baseUrl}/api/documents/analyze`, { method: 'POST', headers, body: form });
  }

  const bad = await analyse('Defective agreement', defective);
  const good = await analyse('Corrected agreement', corrected);
  assert.equal(bad.document.analysis.overall_risk, 'High');
  assert.ok(bad.document.analysis.overall_score > good.document.analysis.overall_score);

  const comparison = await jsonRequest(`${baseUrl}/api/documents/compare`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ leftId: bad.document.id, rightId: good.document.id })
  });
  assert.ok(comparison.comparison.score_delta > 0);

  const assistant = await jsonRequest(`${baseUrl}/api/documents/${bad.document.id}/ask`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'What is the principal risk?' })
  });
  assert.ok(assistant.answer.length > 20);

  await jsonRequest(`${baseUrl}/api/documents/${bad.document.id}`, { method: 'DELETE', headers });
  const remaining = await jsonRequest(`${baseUrl}/api/documents`, { headers });
  assert.equal(remaining.documents.length, 1);

  const stored = JSON.parse(await fs.readFile(dataFile, 'utf8'));
  assert.ok(stored.documents[0].encryptedText);
  assert.equal(stored.documents[0].extractedText, undefined);
});
