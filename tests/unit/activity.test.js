import { test } from 'node:test';
import assert from 'node:assert/strict';
import { record, streak, today, emptyActivity } from '../../js/lib/activity.js';

const DAY = 86400000;
const t0 = new Date(2026, 9, 22, 10, 0).getTime();

test('records today and detects when the goal is reached exactly once', () => {
  const a = emptyActivity();
  a.goal = 3;
  assert.equal(record(a, 2, t0).reachedGoal, false);
  assert.equal(record(a, 1, t0).reachedGoal, true);
  assert.equal(record(a, 1, t0).reachedGoal, false);
  assert.equal(today(a, t0), 4);
});
test('streak counts consecutive days, still alive if today not started', () => {
  const a = emptyActivity();
  for (let i = 0; i < 4; i++) record(a, 1, t0 - i * DAY);
  assert.equal(streak(a, t0), 4);
  assert.equal(streak(a, t0 + DAY), 4); // tomorrow, before studying
  assert.equal(streak(a, t0 + 2 * DAY), 0); // missed a day
  record(a, 1, t0 + DAY);
  assert.equal(streak(a, t0 + DAY), 5);
});
test('gap breaks the streak', () => {
  const a = emptyActivity();
  record(a, 1, t0); record(a, 1, t0 - 2 * DAY);
  assert.equal(streak(a, t0), 1);
});
