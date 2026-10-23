import { sides } from './deck.js';
import { normalize, isTypeable } from './grade.js';
import { shuffle } from './random.js';

/**
 * Adaptive Learn mode.
 *
 * Every card climbs three steps:  new (0)  ->  familiar (1)  ->  mastered (2).
 *  - A correct answer moves a card up one step.
 *  - New cards are asked as multiple choice (recognition).
 *  - Familiar cards are asked as typed answers (recall); long answers become
 *    a self-check flip because typing a paragraph is not learning.
 *  - A missed card comes back again later in the same round.
 * Study happens in short rounds so students get frequent wins.
 */
export const LEVEL = { NEW: 0, FAMILIAR: 1, MASTERED: 2 };

export function statusOf(p) {
  if (!p || !p.seen) return 'new';
  return p.level >= LEVEL.MASTERED ? 'mastered' : 'learning';
}

export function summarize(cards, progress) {
  const out = { new: 0, learning: 0, mastered: 0, total: cards.length };
  for (const c of cards) out[statusOf(progress[c.id])]++;
  return out;
}

export function buildChoices(card, answerSide, cards, rng, max = 4) {
  const correct = card[answerSide];
  const used = new Set([normalize(correct)]);
  const pool = [];
  for (const other of shuffle(cards, rng)) {
    if (other.id === card.id) continue;
    const text = other[answerSide];
    const key = normalize(text);
    if (used.has(key)) continue;
    used.add(key);
    pool.push(text);
    if (pool.length >= max - 1) break;
  }
  return shuffle([correct, ...pool], rng);
}

export class LearnSession {
  constructor({ cards, progress = {}, options = {}, rng = Math.random }) {
    this.cards = cards;
    this.progress = progress;
    this.rng = rng;
    this.options = { answerWith: 'definition', mc: true, written: true, roundSize: 7, shuffle: false, ...options };
    if (!this.options.mc && !this.options.written) this.options.mc = true;
    this.round = 0;
    this.queue = [];
    this.attempts = new Map();
    this.roundLog = [];
    this.current = null;
    this.last = null;
    this.streak = 0;
    this.bestStreak = 0;
  }

  p(card) {
    if (!this.progress[card.id]) this.progress[card.id] = { level: 0, seen: 0, correct: 0, wrong: 0 };
    return this.progress[card.id];
  }

  counts() { return summarize(this.cards, this.progress); }

  isDone() { return this.cards.length > 0 && this.cards.every((c) => (this.progress[c.id]?.level ?? 0) >= LEVEL.MASTERED); }

  /** Starts the next round. Returns false when everything is mastered. */
  startRound() {
    const remaining = this.cards.filter((c) => (this.progress[c.id]?.level ?? 0) < LEVEL.MASTERED);
    if (!remaining.length) { this.queue = []; return false; }
    const ordered = this.options.shuffle ? shuffle(remaining, this.rng) : remaining;
    const rank = (c) => {
      const p = this.progress[c.id];
      if (!p || !p.seen) return 2;
      return p.level >= LEVEL.FAMILIAR ? 0 : 1;
    };
    const batch = ordered
      .map((c, i) => ({ c, i }))
      .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
      .slice(0, this.options.roundSize)
      .map((x) => x.c);
    this.round++;
    this.queue = this.options.shuffle ? shuffle(batch, this.rng) : batch.slice();
    this.roundCards = batch;
    this.attempts = new Map();
    this.roundLog = [];
    return true;
  }

  typeFor(card, answer) {
    const level = this.progress[card.id]?.level ?? 0;
    const canMC = this.options.mc && this.cards.length >= 2;
    const wantWritten = this.options.written && (level >= LEVEL.FAMILIAR || !canMC);
    if (wantWritten) {
      if (!isTypeable(answer)) return 'reveal';
      // Spell: hear the answer read aloud and type it. Mixed in with written questions.
      if (this.options.spell && answer.length <= 40 && this.rng() < 0.5) return 'spell';
      return 'written';
    }
    return canMC ? 'mc' : 'reveal';
  }

  /** The next question in this round, or null when the round is over. */
  next() {
    if (!this.queue.length) { this.current = null; return null; }
    const card = this.queue.shift();
    let dir = this.options.answerWith;
    if (dir === 'both') dir = this.rng() < 0.5 ? 'term' : 'definition';
    const s = sides(card, dir);
    const type = this.typeFor(card, s.answer);
    const q = { card, type, prompt: s.prompt, answer: s.answer, promptSide: s.promptSide, answerSide: s.answerSide };
    if (type === 'mc') q.choices = buildChoices(card, s.answerSide, this.cards, this.rng);
    this.current = q;
    return q;
  }

  /** Record an answer for the current question. */
  answer(correct) {
    const q = this.current;
    if (!q) throw new Error('No active question');
    const p = this.p(q.card);
    const before = p.level;
    p.seen++;
    p.lastSeen = Date.now();
    let requeued = false;
    if (correct) {
      p.correct++;
      p.level = Math.min(LEVEL.MASTERED, p.level + 1);
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
    } else {
      p.wrong++;
      this.streak = 0;
      const tries = (this.attempts.get(q.card.id) || 0) + 1;
      this.attempts.set(q.card.id, tries);
      if (tries < 3) {
        // Put it back a few questions later (not immediately) so it is a real retry.
        const at = Math.min(this.queue.length, 2 + Math.floor(this.rng() * 2));
        this.queue.splice(at, 0, q.card);
        requeued = true;
      }
    }
    this.last = { q, correct, before, after: p.level, requeued };
    this.roundLog.push({ card: q.card, correct });
    return this.last;
  }

  /** "I was right" - flip the most recent wrong answer to correct. */
  override() {
    const l = this.last;
    if (!l || l.correct) return null;
    const p = this.p(l.q.card);
    p.wrong = Math.max(0, p.wrong - 1);
    p.correct++;
    p.level = Math.min(LEVEL.MASTERED, l.before + 1);
    if (l.requeued) {
      const idx = this.queue.indexOf(l.q.card);
      if (idx >= 0) this.queue.splice(idx, 1);
    }
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    l.correct = true;
    l.after = p.level;
    l.requeued = false;
    const entry = [...this.roundLog].reverse().find((e) => e.card === l.q.card);
    if (entry) entry.correct = true;
    return l;
  }

  /** Per-card results for the round summary. */
  roundSummary() {
    return (this.roundCards || []).map((card) => ({
      card,
      status: statusOf(this.progress[card.id]),
      missed: this.roundLog.some((e) => e.card === card && !e.correct),
    }));
  }
}
