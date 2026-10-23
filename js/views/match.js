import { h, icon, formatTime, announce } from '../lib/dom.js';
import { shuffle } from '../lib/random.js';
import { confetti } from '../lib/confetti.js';
import { normalize } from '../lib/grade.js';
import { studyHeader, activeCards } from './shell.js';
import { sizeClass } from './flashcards.js';
import { logStudy } from './streak.js';

const PAIRS = 6;
const PENALTY_MS = 1000;

export function renderMatch(ctx) {
  const { root, deck, progress, save, signal } = ctx;
  const page = h('div', { class: 'page study-page match-page' });
  const body = h('div', { class: 'match-body' });
  page.append(studyHeader(deck, 'games'), body);
  root.append(page);

  let raf = 0;
  signal.addEventListener('abort', () => cancelAnimationFrame(raf));

  function intro() {
    const best = progress.best?.match;
    body.replaceChildren(h('div', { class: 'panel match-intro', id: 'match-intro' },
      h('div', { class: 'finish-emoji', 'aria-hidden': 'true' }, '⏱️'),
      h('h2', null, 'Ready to play?'),
      h('p', { class: 'muted' }, 'Match every term with its definition as fast as you can. Wrong pairs add one second.'),
      best ? h('p', { class: 'best-badge center' }, icon('trophy', { size: 18 }), `Your best: ${formatTime(best)}`) : null,
      h('button', { class: 'btn btn-primary btn-lg', id: 'start-match', onclick: play }, 'Start game', icon('play', { size: 18 }))));
    setTimeout(() => body.querySelector('#start-match')?.focus(), 30);
  }

  function play() {
    // Avoid two cards with identical text, which would make the board ambiguous.
    const seenT = new Set(), seenD = new Set();
    const unique = shuffle(activeCards(deck, progress, false)).filter((c) => {
      const t = normalize(c.term), d = normalize(c.definition);
      if (seenT.has(t) || seenD.has(d)) return false;
      seenT.add(t); seenD.add(d); return true;
    });
    const set = unique.slice(0, PAIRS);
    if (set.length < 2) {
      body.replaceChildren(h('div', { class: 'panel' }, h('p', null, 'Match needs at least 2 different cards.')));
      return;
    }
    const tiles = shuffle(set.flatMap((c) => [{ card: c, side: 'term', text: c.term }, { card: c, side: 'definition', text: c.definition }]));
    let selected = null;
    let left = set.length;
    let penalty = 0;
    let busy = false;
    const start = performance.now();
    const clock = h('span', { class: 'match-clock', id: 'match-clock' }, '0.0s');
    const penaltyEl = h('span', { class: 'penalty', 'aria-live': 'polite' });

    const tick = () => { clock.textContent = formatTime(performance.now() - start + penalty); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);

    const grid = h('div', { class: `match-grid n${tiles.length}`, id: 'match-grid' }, tiles.map((t, i) => {
      const el = h('button', { class: `tile ${sizeClass(t.text)}`, type: 'button', 'data-id': t.card.id, 'data-side': t.side, 'aria-label': `${t.side}: ${t.text}` },
        t.side === 'definition' && t.card.image ? h('img', { src: t.card.image, alt: '', class: 'tile-img', referrerpolicy: 'no-referrer' }) : null,
        h('span', null, t.text));
      el.addEventListener('click', () => choose(el, t));
      el.style.animationDelay = `${i * 25}ms`;
      return el;
    }));

    function choose(el, t) {
      if (busy || el.classList.contains('gone')) return;
      if (!selected) { selected = { el, t }; el.classList.add('selected'); return; }
      if (selected.el === el) { el.classList.remove('selected'); selected = null; return; }
      const a = selected;
      selected = null;
      if (a.t.card.id === t.card.id && a.t.side !== t.side) {
        a.el.classList.remove('selected');
        [a.el, el].forEach((x) => { x.classList.add('matched'); x.disabled = true; setTimeout(() => x.classList.add('gone'), 380); });
        left--;
        announce(`Matched. ${left} left.`);
        if (!left) setTimeout(() => finish(performance.now() - start + penalty), 420);
      } else {
        busy = true;
        a.el.classList.remove('selected');
        [a.el, el].forEach((x) => x.classList.add('wrong'));
        penalty += PENALTY_MS;
        penaltyEl.textContent = '+1s';
        penaltyEl.classList.remove('pop'); void penaltyEl.offsetWidth; penaltyEl.classList.add('pop');
        setTimeout(() => { [a.el, el].forEach((x) => x.classList.remove('wrong')); busy = false; }, 450);
      }
    }

    body.replaceChildren(
      h('div', { class: 'match-hud' }, h('span', { class: 'muted' }, 'Tap a term, then its definition'), h('span', { class: 'clock-wrap' }, icon('timer', { size: 18 }), clock, penaltyEl)),
      grid);
  }

  function finish(ms) {
    logStudy(PAIRS);
    cancelAnimationFrame(raf);
    const prev = progress.best?.match;
    const isBest = !prev || ms < prev;
    if (isBest) { progress.best = { ...progress.best, match: Math.round(ms) }; save(); confetti(); }
    body.replaceChildren(h('div', { class: 'panel finish', id: 'match-done' },
      h('div', { class: 'finish-emoji', 'aria-hidden': 'true' }, isBest ? '🏆' : '⚡'),
      h('h2', null, isBest ? (prev ? 'New record!' : 'Nice! First record set.') : 'Well played!'),
      h('p', { class: 'final-time', id: 'final-time' }, formatTime(ms)),
      prev ? h('p', { class: 'muted' }, isBest ? `Previous best: ${formatTime(prev)}` : `Your best: ${formatTime(prev)}. Can you beat it?`) : null,
      h('div', { class: 'finish-actions' },
        h('button', { class: 'btn btn-primary', id: 'play-again', onclick: play }, icon('refresh', { size: 18 }), 'Play again'),
        h('a', { class: 'btn btn-ghost', href: `#/deck/${encodeURIComponent(deck.id)}/learn` }, icon('learn', { size: 18 }), 'Go to Learn'))));
    setTimeout(() => body.querySelector('#play-again')?.focus(), 30);
  }

  intro();
}
