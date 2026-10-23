import { sides } from './deck.js';
import { gradeWritten, isTypeable, normalize } from './grade.js';
import { buildChoices } from './learn-engine.js';
import { shuffle } from './random.js';

export const TYPE_ORDER = ['tf', 'mc', 'match', 'written'];
export const TYPE_LABEL = { tf: 'True or false', mc: 'Multiple choice', match: 'Matching', written: 'Written' };

function direction(answerWith, rng) {
  if (answerWith === 'both') return rng() < 0.5 ? 'term' : 'definition';
  return answerWith;
}

/**
 * Build a practice test.
 * @param {object} o
 * @param {Array} o.cards
 * @param {number} o.count            number of cards to quiz on
 * @param {string[]} o.types          any of tf, mc, match, written
 * @param {'term'|'definition'|'both'} o.answerWith
 */
export function buildTest({ cards, count, types, answerWith = 'definition', rng = Math.random }) {
  const enabled = TYPE_ORDER.filter((t) => types.includes(t));
  if (!enabled.length) enabled.push('mc');
  const distinctAnswers = (side) => new Set(cards.map((c) => normalize(c[side]))).size;
  const n = Math.max(1, Math.min(count, cards.length));
  const chosen = shuffle(cards, rng).slice(0, n);

  const buckets = { tf: [], mc: [], match: [], written: [] };
  chosen.forEach((card, i) => {
    const s = sides(card, direction(answerWith, rng));
    let type = enabled[i % enabled.length];
    const canChoose = distinctAnswers(s.answerSide) >= 2;
    if (type === 'written' && !isTypeable(s.answer)) type = canChoose ? 'mc' : 'tf';
    if ((type === 'mc' || type === 'match' || type === 'tf') && !canChoose) type = isTypeable(s.answer) ? 'written' : 'tf';
    buckets[type].push({ card, ...s });
  });

  // Matching needs at least two items per group; lonely items become multiple choice.
  if (buckets.match.length === 1) buckets.mc.push(buckets.match.pop());
  const groups = [];
  const m = buckets.match;
  for (let i = 0; i < m.length; ) {
    let size = Math.min(5, m.length - i);
    if (m.length - i - size === 1) size--; // avoid a trailing group of one
    groups.push(m.slice(i, i + size));
    i += size;
  }

  const questions = [];
  for (const item of buckets.tf) {
    let shown = item.answer;
    let isTrue = true;
    if (rng() < 0.5) {
      const others = cards.filter((c) => c.id !== item.card.id && normalize(c[item.answerSide]) !== normalize(item.answer));
      if (others.length) { shown = others[Math.floor(rng() * others.length)][item.answerSide]; isTrue = false; }
    }
    questions.push({ kind: 'tf', ...item, shown, isTrue });
  }
  for (const item of buckets.mc) {
    questions.push({ kind: 'mc', ...item, choices: buildChoices(item.card, item.answerSide, cards, rng) });
  }
  for (const g of groups) {
    questions.push({ kind: 'match', items: g, options: shuffle(g.map((x) => x.answer), rng) });
  }
  for (const item of buckets.written) questions.push({ kind: 'written', ...item });
  return { questions, total: questions.reduce((s, q) => s + (q.kind === 'match' ? q.items.length : 1), 0) };
}

/**
 * Grade answers.
 * answers[i] is: boolean for tf, string for mc / written, and an array of chosen
 * option strings (one per item) for match.
 */
export function gradeTest(test, answers) {
  let score = 0;
  const results = test.questions.map((q, i) => {
    const a = answers[i];
    if (q.kind === 'match') {
      const items = q.items.map((item, j) => {
        const given = a?.[j] ?? null;
        const correct = given != null && normalize(given) === normalize(item.answer);
        if (correct) score++;
        return { correct, given };
      });
      return { kind: 'match', items };
    }
    let correct = false;
    let close = false;
    if (q.kind === 'tf') correct = a === q.isTrue;
    else if (q.kind === 'mc') correct = a != null && normalize(a) === normalize(q.answer);
    else if (q.kind === 'written') { const g = gradeWritten(a, q.answer); correct = g.correct; close = g.close; }
    if (correct) score++;
    return { kind: q.kind, correct, close, given: a ?? null };
  });
  return { score, total: test.total, percent: test.total ? Math.round((score / test.total) * 100) : 0, results };
}

/** Cards answered wrong, so students can retake just those. */
export function missedCards(test, graded) {
  const out = [];
  test.questions.forEach((q, i) => {
    const r = graded.results[i];
    if (q.kind === 'match') q.items.forEach((item, j) => { if (!r.items[j].correct) out.push(item.card); });
    else if (!r.correct) out.push(q.card);
  });
  return out;
}
