import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDocument, contentHash, extractText } from './analysis.js';

test('contentHash is deterministic and content-specific', () => {
  const first = contentHash(Buffer.from('Synesis evidence A'));
  const repeat = contentHash(Buffer.from('Synesis evidence A'));
  const different = contentHash(Buffer.from('Synesis evidence B'));
  assert.equal(first, repeat);
  assert.notEqual(first, different);
  assert.equal(first.length, 64);
});

test('extractText accepts meaningful pasted evidence', async () => {
  const result = await extractText(null, 'This agreement requires the service provider to maintain incident records and notify the institution promptly.');
  assert.match(result.text, /service provider/i);
  assert.equal(result.mimeType, 'text/plain');
  assert.equal(result.hash.length, 64);
});

test('extractText rejects insufficient pasted evidence', async () => {
  await assert.rejects(() => extractText(null, 'too short'), /20 readable characters/i);
});

test('fallback analysis is explicitly disclosed and document-specific', async () => {
  const risky = await analyzeDocument({
    client: null,
    model: 'gpt-5-mini',
    text: 'The Provider shall have unlimited liability for all losses. The Provider shall indemnify the Bank for any and all claims.',
    options: { matter: 'Vendor contract', documentType: 'Agreement', jurisdiction: 'India' }
  });
  const controlled = await analyzeDocument({
    client: null,
    model: 'gpt-5-mini',
    text: 'Liability is capped at the annual fees. The institution may audit records and terminate or suspend immediately for sanctions, AML, cyber incidents or regulatory directions. Business continuity and transition assistance are mandatory.',
    options: { matter: 'Vendor contract', documentType: 'Agreement', jurisdiction: 'India' }
  });

  assert.equal(risky.analysis_details.live_ai_used, false);
  assert.match(risky.engine, /Emergency deterministic fallback/i);
  assert.ok(risky.findings.some(item => /uncapped liability/i.test(item.issue)));
  assert.notDeepEqual(risky.findings.map(item => item.issue), controlled.findings.map(item => item.issue));
});
