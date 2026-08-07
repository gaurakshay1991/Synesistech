import test from 'node:test';
import assert from 'node:assert/strict';
import { LIVE_SOURCE_CATALOG, parseRssOrAtom, parseFederalRegister, classifyLegalChange } from './source-catalog.js';

test('source catalog includes autonomous primary-source monitors and global query-time authorities', () => {
  assert.ok(LIVE_SOURCE_CATALOG.some(source => source.id === 'rbi-notifications' && source.backgroundEnabled));
  assert.ok(LIVE_SOURCE_CATALOG.some(source => source.id === 'sebi-rss' && source.backgroundEnabled));
  assert.ok(LIVE_SOURCE_CATALOG.some(source => source.id === 'us-federal-register' && source.backgroundEnabled));
  assert.ok(LIVE_SOURCE_CATALOG.some(source => source.id === 'eur-lex' && !source.backgroundEnabled));
});

test('RSS parser produces source-versioned regulatory events', () => {
  const source = LIVE_SOURCE_CATALOG.find(item => item.id === 'rbi-notifications');
  const xml = `<?xml version="1.0"?><rss><channel><item><title>Amendment to Master Direction on Outsourcing</title><link>https://rbi.org.in/example</link><pubDate>Fri, 07 Aug 2026 04:00:00 GMT</pubDate><description>Requirements have been amended.</description></item></channel></rss>`;
  const items = parseRssOrAtom(xml, source);
  assert.equal(items.length, 1);
  assert.equal(items[0].changeType, 'Amendment / modification');
  assert.equal(items[0].provenance, 'Direct official feed');
  assert.equal(items[0].sourceReference, 'https://rbi.org.in/example');
  assert.equal(items[0].contentHash.length, 64);
});

test('Federal Register parser preserves official API provenance and effective date', () => {
  const source = LIVE_SOURCE_CATALOG.find(item => item.id === 'us-federal-register');
  const items = parseFederalRegister({ results: [{
    document_number: '2026-12345', title: 'Final Rule on Operational Resilience', type: 'Rule',
    publication_date: '2026-08-07', effective_on: '2026-09-08', html_url: 'https://www.federalregister.gov/d/2026-12345',
    abstract: 'A final rule establishing operational resilience requirements.', agencies: [{ name: 'Example Agency' }]
  }] }, source);
  assert.equal(items.length, 1);
  assert.equal(items[0].effectiveDate, '2026-09-08');
  assert.equal(items[0].provenance, 'Direct official API');
  assert.match(items[0].regulator, /Example Agency/);
});

test('change classifier distinguishes operative and proposed source types', () => {
  assert.equal(classifyLegalChange('Draft consultation on AI governance'), 'Proposal / consultation');
  assert.equal(classifyLegalChange('Circular on outsourcing controls'), 'Circular');
  assert.equal(classifyLegalChange('Notification amending prior direction'), 'Amendment / modification');
});
