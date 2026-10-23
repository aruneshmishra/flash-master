import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSheetUrl, csvUrlFor, deckIdFor, fetchSheet, titleFromDisposition } from '../../js/lib/sheet.js';

const ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';

test('normal edit link with gid', () => {
  const s = parseSheetUrl(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=123`);
  assert.deepEqual(s, { kind: 'sheet', id: ID, gid: '123' });
  assert.equal(csvUrlFor(s), `https://docs.google.com/spreadsheets/d/${ID}/export?format=csv&gid=123`);
  assert.equal(deckIdFor(s), `s-${ID}-123`);
});
test('edit link with ?usp=sharing defaults gid 0', () => {
  assert.equal(parseSheetUrl(`https://docs.google.com/spreadsheets/d/${ID}/edit?usp=sharing`).gid, '0');
});
test('published to web link', () => {
  const s = parseSheetUrl('https://docs.google.com/spreadsheets/d/e/2PACX-1vabcDEF_123/pubhtml?gid=55&single=true');
  assert.equal(s.kind, 'published');
  assert.equal(csvUrlFor(s), 'https://docs.google.com/spreadsheets/d/e/2PACX-1vabcDEF_123/pub?output=csv&gid=55');
});
test('bare id and direct csv', () => {
  assert.equal(parseSheetUrl(ID).id, ID);
  assert.equal(parseSheetUrl('https://example.com/deck.csv').kind, 'csv');
});
test('rejects junk', () => {
  assert.throws(() => parseSheetUrl(''), /Paste/);
  assert.throws(() => parseSheetUrl('hello'), /doesn't look like/);
});
test('title from content-disposition', () => {
  assert.equal(titleFromDisposition('attachment; filename="Bio - Sheet1.csv"; filename*=UTF-8\'\'Bio%20%E2%9C%93%20-%20Sheet1.csv'), 'Bio ✓ - Sheet1');
  assert.equal(titleFromDisposition(null), '');
});
const res = (status, body, headers = {}) => ({
  status, ok: status >= 200 && status < 300, text: async () => body,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
});
test('fetchSheet success / private / network', async () => {
  const src = parseSheetUrl(ID);
  const ok = await fetchSheet(src, async () => res(200, 'a,b', { 'content-type': 'text/csv' }));
  assert.equal(ok.text, 'a,b');
  await assert.rejects(fetchSheet(src, async () => res(200, '<!DOCTYPE html><html>', { 'content-type': 'text/html' })), { code: 'private' });
  await assert.rejects(fetchSheet(src, async () => res(403, '')), { code: 'private' });
  await assert.rejects(fetchSheet(src, async () => { throw new TypeError('Failed to fetch'); }), { code: 'network' });
});
