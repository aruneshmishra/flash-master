import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enroll, review, dueCards, nextDue, describeDue, dayStart, INTERVAL_DAYS } from '../../js/lib/srs.js';

const DAY = 86400000;
const now = new Date(2026, 9, 22, 15, 0).getTime();
const cards = ['a', 'b', 'c'].map((id) => ({ id }));

test('enrolled cards are due tomorrow, not today', () => {
  const srs = {};
  enroll(srs, 'a', now);
  assert.equal(dueCards(cards, srs, now).length, 0);
  assert.equal(dueCards(cards, srs, now + DAY).length, 1);
  assert.equal(describeDue(nextDue(cards, srs), now), 'tomorrow');
});
test('correct answers push the card further out; a miss resets to box 1', () => {
  const srs = {};
  enroll(srs, 'a', now);
  let t = now + DAY;
  const seen = [];
  for (let i = 0; i < 4; i++) { const s = review(srs, 'a', true, t); seen.push((s.due - dayStart(t)) / DAY); t = s.due; }
  assert.deepEqual(seen, INTERVAL_DAYS.slice(2, 6));
  const s = review(srs, 'a', false, t);
  assert.equal(s.box, 1);
  assert.equal((s.due - dayStart(t)) / DAY, 1);
});
test('unenrolled cards are never due; overdue cards sort first', () => {
  const srs = { b: { box: 2, due: now - 3 * DAY }, c: { box: 2, due: now - DAY } };
  assert.deepEqual(dueCards(cards, srs, now).map((c) => c.id), ['b', 'c']);
  assert.equal(describeDue(now - DAY, now), 'today');
  assert.equal(describeDue(now + 5 * DAY, now), 'in 5 days');
});
