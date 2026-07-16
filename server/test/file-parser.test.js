import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDocumentText } from '../src/file-parser.js';

test('pasted text is normalised and content-addressed', async () => {
  const result = await extractDocumentText(null, 'Clause 1.\r\n\r\nThe Vendor shall protect Bank Data.');
  assert.equal(result.parser, 'pasted-text');
  assert.match(result.text, /Vendor shall protect Bank Data/);
  assert.match(result.contentSha256, /^[a-f0-9]{64}$/);
});

test('a renamed non-PDF payload is rejected before parsing', async () => {
  await assert.rejects(
    extractDocumentText({
      originalname: 'agreement.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('This is not a PDF'),
      size: 17
    }),
    /not a valid PDF/
  );
});

test('binary data disguised as text is rejected', async () => {
  await assert.rejects(
    extractDocumentText({
      originalname: 'agreement.txt',
      mimetype: 'text/plain',
      buffer: Buffer.from([0, 0, 0, 1, 2, 3, 4, 5]),
      size: 8
    }),
    /binary data/
  );
});
