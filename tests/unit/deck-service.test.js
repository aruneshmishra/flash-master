import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDelimiters, sourceFromId, sheetInputFor, importFromSheet, importFromCSVText, refreshDeck, openSample, renameDeck } from '../../js/lib/deck-service.js';
import { parseCSV } from '../../js/lib/csv.js';
import { parseSheetUrl, deckIdFor } from '../../js/lib/sheet.js';

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd';
const res = (body) => ({ status: 200, ok: true, text: async () => body, headers: { get: (k) => (k === 'content-type' ? 'text/csv' : null) } });

test('Quizlet tab export with commas in definitions', () => {
  assert.deepEqual(parseCSV(normalizeDelimiters('gato\tcat, the animal\nperro\t"dog"')), [['gato', 'cat, the animal'], ['perro', '"dog"']]);
});
test('plain CSV is left alone', () => { assert.equal(normalizeDelimiters('a,b\nc,d'), 'a,b\nc,d'); });

test('deck ids round-trip back to a sheet source, including ids with dashes', () => {
  for (const url of [`https://docs.google.com/spreadsheets/d/${ID}-x_y/edit#gid=77`, 'https://docs.google.com/spreadsheets/d/e/2PACX-1v-abc_DEF/pubhtml?gid=3']) {
    const src = parseSheetUrl(url);
    assert.deepEqual(sourceFromId(deckIdFor(src)), { kind: src.kind, id: src.id, gid: src.gid });
    assert.deepEqual(parseSheetUrl(sheetInputFor(src)), src);
  }
  assert.equal(sourceFromId('sample-space'), null);
});

test('import, rename survives refresh, change detection', async () => {
  const d1 = await importFromSheet(ID, async () => res('Term,Definition\na,b\nc,d'));
  assert.equal(d1.cards.length, 2);
  d1.titleIsCustom = true; d1.title = 'Mine';
  const same = await refreshDeck(d1, async () => res('Term,Definition\na,b\nc,d'));
  assert.equal(same.changed, false);
  const more = await refreshDeck(d1, async () => res('Term,Definition\na,b\nc,d\ne,f'));
  assert.equal(more.changed, true);
  assert.equal(more.deck.cards.length, 3);
});

test('empty sheet gives a helpful error', async () => {
  await assert.rejects(importFromSheet(ID, async () => res('Term,Definition\n')), { code: 'empty-deck' });
});

test('file import and samples', () => {
  assert.equal(importFromCSVText('x,y\nz,w', 'bio.csv').title, 'bio');
  assert.ok(openSample('sample-spanish').cards.length >= 16);
  assert.equal(openSample('nope'), null);
});

test('combine decks: merged cards, stable id, refresh rebuilds', async () => {
  const { combineDecks } = await import('../../js/lib/deck-service.js');
  const a = importFromCSVText('x,1\ny,2', 'a.csv');
  const b = importFromCSVText('y,2\nz,3', 'b.csv');
  const c = combineDecks([a.id, b.id]);
  assert.equal(c.cards.length, 3);
  assert.equal(c.title, 'a + b');
  assert.equal(combineDecks([b.id, a.id]).id, c.id);
  const r = await refreshDeck(c);
  assert.equal(r.changed, false);
  assert.throws(() => combineDecks([a.id]), /at least two/);
});

test('sample decks keep a custom name and combine without losing cards', async () => {
  const { combineDecks, getDeck } = await import('../../js/lib/deck-service.js');
  const a = openSample('sample-space');
  renameDeck(a, 'Planets');
  assert.equal((await getDeck('sample-space')).title, 'Planets');
  openSample('sample-elements');
  assert.equal(combineDecks(['sample-space', 'sample-elements']).cards.length, 28);
});
