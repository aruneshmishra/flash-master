import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowsToCards, detectColumns, sides } from '../../js/lib/deck.js';

test('Quizlet-style Term/Definition headers', () => {
  const { cards, hasHeader } = rowsToCards([['Term', 'Definition'], ['cat', 'gato'], ['dog', 'perro']]);
  assert.equal(hasHeader, true);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].term, 'cat');
  assert.equal(cards[0].definition, 'gato');
});
test('legacy Question/Answer headers in any order, plus image', () => {
  const { cards } = rowsToCards([['Answer', 'Image', 'Question'], ['4', 'https://x.org/a.png', '2+2']]);
  assert.deepEqual([cards[0].term, cards[0].definition, cards[0].image], ['2+2', '4', 'https://x.org/a.png']);
});
test('no header: column A is term, B is definition, first row kept', () => {
  const { cards, hasHeader } = rowsToCards([['cat', 'gato'], ['dog', 'perro']]);
  assert.equal(hasHeader, false);
  assert.equal(cards.length, 2);
});
test('skips half-empty rows with a warning, rejects unsafe images', () => {
  const { cards, warnings } = rowsToCards([['term', 'definition', 'image'], ['a', '', ''], ['b', 'c', 'javascript:alert(1)']]);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].image, '');
  assert.match(warnings[0], /1 row was skipped/);
});
test('stable unique ids even for duplicate rows', () => {
  const a = rowsToCards([['x', 'y'], ['x', 'y']]).cards;
  const b = rowsToCards([['z', 'w'], ['x', 'y']]).cards;
  assert.notEqual(a[0].id, a[1].id);
  assert.equal(a[0].id, b[1].id);
});
test('only one recognised header still works', () => {
  assert.deepEqual(detectColumns(['Word', 'Notes']), { term: 0, definition: 1, image: -1 });
});
test('sides', () => {
  const c = { term: 't', definition: 'd' };
  assert.equal(sides(c, 'term').answer, 't');
  assert.equal(sides(c, 'definition').answer, 'd');
});
