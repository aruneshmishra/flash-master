import { h, icon, isTyping, announce } from '../lib/dom.js';
import { buildChoices } from '../lib/learn-engine.js';
import { shuffle } from '../lib/random.js';
import { confetti } from '../lib/confetti.js';
import { studyHeader, activeCards } from './shell.js';
import { logStudy } from './streak.js';

const LIVES = 3;

/**
 * Meteor: a prompt falls from the sky. Pick the matching answer before it lands.
 * Each save speeds the next one up a little. Three misses and the game ends.
 */
export function renderMeteor(ctx) {
  const { root, deck, progress, save, signal } = ctx;
  const page = h('div', { class: 'page study-page meteor-page' });
  const body = h('div', { class: 'meteor-body' });
  page.append(studyHeader(deck, 'games'), body);
  root.append(page);

  let raf = 0;
  let onKey = null;
  signal.addEventListener('abort', () => cancelAnimationFrame(raf));

  const cards = activeCards(deck, progress, false);
  // Short side is the answer so buttons stay readable.
  const avg = (side) => cards.reduce((s, c) => s + c[side].length, 0) / Math.max(1, cards.length);
  const answerSide = avg('definition') <= avg('term') ? 'definition' : 'term';
  const promptSide = answerSide === 'term' ? 'definition' : 'term';

  function intro() {
    onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); } };
    body.replaceChildren(h('div', { class: 'panel match-intro', id: 'meteor-intro' },
      h('div', { class: 'finish-emoji', 'aria-hidden': 'true' }, '☄️'),
      h('h2', null, 'Meteor'),
      h('p', { class: 'muted' }, 'A meteor falls with a word on it. Tap the matching answer (or press 1 to 4) before it hits the ground. You have 3 lives.'),
      progress.best?.meteor ? h('p', { class: 'best-badge center' }, icon('trophy', { size: 18 }), `Your best: ${progress.best.meteor} pts`) : null,
      h('button', { class: 'btn btn-primary btn-lg', id: 'start-meteor', onclick: play }, 'Start game', icon('play', { size: 18 }))));
  }

  function play() {
    if (cards.length < 2) { body.replaceChildren(h('div', { class: 'panel' }, h('p', null, 'Meteor needs at least 2 cards.'))); return; }
    let lives = LIVES;
    let score = 0;
    let saved = 0;
    let fallMs = 9000;
    let bag = [];
    let current = null;
    let locked = false;

    const scoreEl = h('span', { id: 'meteor-score' }, '0');
    const livesEl = h('span', { class: 'lives', id: 'meteor-lives', 'aria-label': `${lives} lives` });
    const arena = h('div', { class: 'arena', id: 'arena' });
    const choicesEl = h('div', { class: 'choices meteor-choices' });
    const paintLives = () => { livesEl.replaceChildren(...Array.from({ length: LIVES }, (_, i) => h('span', { class: i < lives ? 'life on' : 'life' }, '❤'))); livesEl.setAttribute('aria-label', `${lives} lives`); };
    paintLives();

    body.replaceChildren(
      h('div', { class: 'match-hud' }, h('span', { class: 'clock-wrap' }, icon('sparkle', { size: 18 }), scoreEl, h('span', { class: 'muted small' }, ' pts')), livesEl),
      arena, choicesEl);

    function nextCard() {
      if (!bag.length) bag = shuffle(cards);
      return bag.pop();
    }

    function launch() {
      locked = false;
      const card = nextCard();
      const choices = buildChoices(card, answerSide, cards, Math.random);
      const rock = h('div', { class: 'meteor', id: 'meteor' }, h('span', { class: 'meteor-text' }, card[promptSide]));
      arena.replaceChildren(h('div', { class: 'ground', 'aria-hidden': 'true' }), rock);
      const buttons = choices.map((c, i) => h('button', { class: 'choice', type: 'button', 'data-choice': String(i), onclick: () => pick(i) },
        h('span', { class: 'choice-key', 'aria-hidden': 'true' }, String(i + 1)), h('span', { class: 'choice-text' }, c)));
      choicesEl.replaceChildren(...buttons);
      current = { card, choices, buttons, rock, start: performance.now() };
      announce(`Meteor: ${card[promptSide]}`);
      cancelAnimationFrame(raf);
      const fall = (now) => {
        if (!current || current.rock !== rock) return;
        const t = (now - current.start) / fallMs;
        const max = arena.clientHeight - rock.offsetHeight - 14;
        rock.style.transform = `translate(-50%, ${Math.max(0, Math.min(1, t)) * max}px)`;
        if (t >= 1) return miss(true);
        raf = requestAnimationFrame(fall);
      };
      raf = requestAnimationFrame(fall);
    }

    function pick(i) {
      if (locked || !current) return;
      const right = current.choices[i] === current.card[answerSide];
      if (right) {
        locked = true;
        cancelAnimationFrame(raf);
        const left = 1 - (performance.now() - current.start) / fallMs;
        const gained = 10 + Math.round(Math.max(0, left) * 10);
        score += gained;
        saved++;
        scoreEl.textContent = String(score);
        current.buttons[i].classList.add('correct');
        current.rock.classList.add('boom');
        current.rock.append(h('span', { class: 'gain' }, `+${gained}`));
        logStudy(1);
        fallMs = Math.max(3500, fallMs * 0.94);
        setTimeout(launch, 450);
      } else {
        current.buttons[i].classList.add('wrong');
        current.buttons[i].disabled = true;
        miss(false);
      }
    }

    function miss(landed) {
      lives--;
      paintLives();
      arena.classList.remove('hit'); void arena.offsetWidth; arena.classList.add('hit');
      if (landed || lives <= 0) {
        locked = true;
        cancelAnimationFrame(raf);
        current.buttons.forEach((b, j) => { if (current.choices[j] === current.card[answerSide]) b.classList.add('correct'); b.disabled = true; });
        current.rock.classList.add('landed');
        setTimeout(() => (lives <= 0 ? over() : launch()), 1300);
      }
    }

    function over() {
      cancelAnimationFrame(raf);
      current = null;
      const prev = progress.best?.meteor || 0;
      const isBest = score > prev;
      if (isBest) { progress.best = { ...progress.best, meteor: score }; save(); if (score) confetti(); }
      onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); play(); } };
      body.replaceChildren(h('div', { class: 'panel finish', id: 'meteor-done' },
        h('div', { class: 'finish-emoji', 'aria-hidden': 'true' }, isBest && score ? '🏆' : '☄️'),
        h('h2', null, isBest && score ? 'New high score!' : 'Game over'),
        h('p', { class: 'final-time', id: 'meteor-final' }, `${score} pts`),
        h('p', { class: 'muted' }, `You stopped ${saved} meteor${saved === 1 ? '' : 's'}.${prev && !isBest ? ` Your best is ${prev} pts.` : ''}`),
        h('div', { class: 'finish-actions' },
          h('button', { class: 'btn btn-primary', id: 'meteor-again', onclick: play }, icon('refresh', { size: 18 }), 'Play again'),
          h('a', { class: 'btn btn-ghost', href: `#/deck/${encodeURIComponent(deck.id)}/games` }, 'All games'))));
    }

    onKey = (e) => { const n = Number(e.key); if (n >= 1 && n <= 4 && current) { e.preventDefault(); pick(n - 1); } };
    launch();
  }

  document.addEventListener('keydown', (e) => {
    if (isTyping(e) || document.querySelector('dialog[open]') || e.metaKey || e.ctrlKey) return;
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('button, a')) return;
    onKey?.(e);
  }, { signal });

  intro();
}
