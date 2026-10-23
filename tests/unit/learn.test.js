import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LearnSession, summarize } from '../../js/lib/learn-engine.js';
import { createRng } from '../../js/lib/random.js';

const cards = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, term: `term ${i}`, definition: `definition ${i}`, image: '' }));

function playAll(session, isCorrect = () => true, limit = 500) {
  let asked = 0;
  while (session.startRound()) {
    let q;
    while ((q = session.next())) { session.answer(isCorrect(q)); if (++asked > limit) throw new Error('runaway'); }
  }
  return asked;
}

test('new cards are multiple choice, familiar cards are written', () => {
  const s = new LearnSession({ cards, rng: createRng(1) });
  s.startRound();
  const q = s.next();
  assert.equal(q.type, 'mc');
  assert.equal(q.choices.length, 4);
  assert.ok(q.choices.includes(q.answer));
  assert.equal(new Set(q.choices).size, 4);
  s.answer(true);
  assert.equal(s.progress[q.card.id].level, 1);
  // card comes back in next round as written
  while (s.next()) s.answer(true);
  s.startRound();
  const q2 = s.next();
  assert.equal(q2.type, 'written');
});

test('rounds are at most 7 cards and all correct answers master everything in 2 passes', () => {
  const s = new LearnSession({ cards, rng: createRng(2) });
  s.startRound();
  assert.equal(s.queue.length, 7);
  const asked = playAll(new LearnSession({ cards, rng: createRng(2) }));
  assert.equal(asked, 20);
});

test('wrong answers get requeued in the same round, capped', () => {
  const s = new LearnSession({ cards: cards.slice(0, 3), rng: createRng(3) });
  s.startRound();
  const q = s.next();
  const r = s.answer(false);
  assert.equal(r.requeued, true);
  assert.ok(s.queue.includes(q.card));
  assert.equal(s.streak, 0);
});

test('override fixes a wrong answer', () => {
  const s = new LearnSession({ cards, rng: createRng(4) });
  s.startRound();
  const q = s.next();
  s.answer(false);
  s.override();
  assert.equal(s.progress[q.card.id].level, 1);
  assert.equal(s.queue.includes(q.card), false);
  assert.equal(s.roundSummary().find((r) => r.card === q.card).missed, false);
});

test('finishes even when student keeps missing (no infinite loop)', () => {
  const s = new LearnSession({ cards, rng: createRng(5) });
  let n = 0;
  playAll(s, () => (n++ % 3) !== 0, 2000);
  assert.equal(s.isDone(), true);
  assert.deepEqual(summarize(cards, s.progress), { new: 0, learning: 0, mastered: 10, total: 10 });
});

test('long answers use self-check instead of typing; written-only works with 1 card', () => {
  const long = [{ id: 'l', term: 'x', definition: 'y'.repeat(80), image: '' }];
  const s = new LearnSession({ cards: long, rng: createRng(6) });
  s.startRound();
  assert.equal(s.next().type, 'reveal');
  const s2 = new LearnSession({ cards: [{ id: 'a', term: 'a', definition: 'b', image: '' }], rng: createRng(7) });
  s2.startRound();
  assert.equal(s2.next().type, 'written');
});

test('answer with term and both', () => {
  const s = new LearnSession({ cards, options: { answerWith: 'term' }, rng: createRng(8) });
  s.startRound();
  const q = s.next();
  assert.equal(q.answer, q.card.term);
  const b = new LearnSession({ cards, options: { answerWith: 'both' }, rng: createRng(9) });
  const dirs = new Set();
  playAll(b, (q) => { dirs.add(q.answerSide); return true; });
  assert.equal(dirs.size, 2);
});

test('resumes from saved progress', () => {
  const progress = Object.fromEntries(cards.slice(0, 9).map((c) => [c.id, { level: 2, seen: 2, correct: 2, wrong: 0 }]));
  const s = new LearnSession({ cards, progress, rng: createRng(10) });
  s.startRound();
  assert.deepEqual(s.queue.map((c) => c.id), ['c9']);
});

test('spell questions mix in with written ones when enabled', () => {
  const progress = Object.fromEntries(cards.map((c) => [c.id, { level: 1, seen: 1, correct: 1, wrong: 0 }]));
  const s = new LearnSession({ cards, progress, options: { spell: true }, rng: createRng(11) });
  const types = new Set();
  s.startRound();
  let q;
  while ((q = s.next())) { types.add(q.type); s.answer(true); }
  assert.deepEqual([...types].sort(), ['spell', 'written']);
  const off = new LearnSession({ cards, progress: Object.fromEntries(cards.map((c) => [c.id, { level: 1, seen: 1, correct: 1, wrong: 0 }])), rng: createRng(11) });
  off.startRound();
  while ((q = off.next())) { assert.notEqual(q.type, 'spell'); off.answer(true); }
});
