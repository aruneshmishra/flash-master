import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTest, gradeTest, missedCards } from '../../js/lib/test-builder.js';
import { createRng } from '../../js/lib/random.js';

const cards = Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, term: `term ${i}`, definition: `def ${i}`, image: '' }));

test('distributes types and counts every card once', () => {
  const t = buildTest({ cards, count: 12, types: ['tf', 'mc', 'match', 'written'], rng: createRng(1) });
  assert.equal(t.total, 12);
  const kinds = new Set(t.questions.map((q) => q.kind));
  assert.deepEqual([...kinds].sort(), ['match', 'mc', 'tf', 'written']);
  for (const q of t.questions.filter((q) => q.kind === 'match')) assert.ok(q.items.length >= 2 && q.items.length <= 5);
});

test('perfect answers score 100%', () => {
  const t = buildTest({ cards, count: 20, types: ['tf', 'mc', 'match', 'written'], rng: createRng(2) });
  const answers = t.questions.map((q) => (q.kind === 'tf' ? q.isTrue : q.kind === 'match' ? q.items.map((i) => i.answer) : q.answer));
  const g = gradeTest(t, answers);
  assert.equal(g.percent, 100);
  assert.equal(missedCards(t, g).length, 0);
});

test('blank answers score 0 and all cards are missed', () => {
  const t = buildTest({ cards, count: 8, types: ['mc', 'match'], rng: createRng(3) });
  const g = gradeTest(t, []);
  assert.equal(g.score, 0);
  assert.equal(missedCards(t, g).length, 8);
});

test('a lone matching item becomes multiple choice', () => {
  const t = buildTest({ cards, count: 1, types: ['match'], rng: createRng(4) });
  assert.equal(t.questions[0].kind, 'mc');
});

test('count is clamped and tiny decks still work', () => {
  const t = buildTest({ cards: cards.slice(0, 1), count: 50, types: ['mc', 'tf'], rng: createRng(5) });
  assert.equal(t.total, 1);
  assert.notEqual(t.questions[0].kind, 'mc');
});
