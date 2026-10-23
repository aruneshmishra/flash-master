/**
 * Spaced review (Leitner boxes).
 * A card joins review once it is mastered in Learn. Each correct review moves it
 * to a later box (seen again after a longer gap); a miss sends it back to box 1.
 */
export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30, 60];
const DAY = 86400000;

/** Start of the local day, so "due today" means any time today. */
export function dayStart(ts = Date.now()) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }

export function enroll(srs, cardId, now = Date.now()) {
  if (!srs[cardId]) srs[cardId] = { box: 1, due: dayStart(now) + INTERVAL_DAYS[1] * DAY };
  return srs[cardId];
}

export function review(srs, cardId, correct, now = Date.now()) {
  const s = srs[cardId] || { box: 1, due: now };
  s.box = correct ? Math.min(INTERVAL_DAYS.length - 1, s.box + 1) : 1;
  s.due = dayStart(now) + INTERVAL_DAYS[s.box] * DAY;
  s.last = now;
  srs[cardId] = s;
  return s;
}

export function dueCards(cards, srs, now = Date.now()) {
  const end = dayStart(now) + DAY;
  return cards.filter((c) => srs[c.id] && srs[c.id].due < end).sort((a, b) => srs[a.id].due - srs[b.id].due);
}

/** When the next card becomes due (ms timestamp) or null. */
export function nextDue(cards, srs) {
  let min = null;
  for (const c of cards) { const s = srs[c.id]; if (s && (min === null || s.due < min)) min = s.due; }
  return min;
}

export function describeDue(ts, now = Date.now()) {
  if (ts == null) return '';
  const days = Math.round((dayStart(ts) - dayStart(now)) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}
