/**
 * Daily goal and streak. Pure functions over { days: { 'YYYY-MM-DD': count }, goal }.
 */
export const GOAL_OPTIONS = [10, 20, 50, 100];

export function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function emptyActivity() { return { days: {}, goal: 20 }; }

/** Add n answered items for today. Returns { reachedGoal } when this push crosses the goal. */
export function record(activity, n = 1, now = Date.now()) {
  const k = dayKey(now);
  const before = activity.days[k] || 0;
  activity.days[k] = before + n;
  // keep storage small: only the last 400 days
  const keys = Object.keys(activity.days).sort();
  while (keys.length > 400) delete activity.days[keys.shift()];
  return { reachedGoal: before < activity.goal && activity.days[k] >= activity.goal };
}

export function today(activity, now = Date.now()) { return activity.days[dayKey(now)] || 0; }

/** Consecutive study days ending today (or yesterday, if today hasn't started yet). */
export function streak(activity, now = Date.now()) {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  if (!activity.days[dayKey(d.getTime())]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (activity.days[dayKey(d.getTime())]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
