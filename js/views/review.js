import { h, icon, isTyping, announce } from '../lib/dom.js';
import { dueCards, review, nextDue, describeDue } from '../lib/srs.js';
import { speak, canSpeak, stopSpeaking } from '../lib/speech.js';
import { confetti } from '../lib/confetti.js';
import { studyHeader } from './shell.js';
import { sizeClass } from './flashcards.js';
import { logStudy } from './streak.js';

/**
 * Spaced review: quick self-check on cards that are due today.
 * Think of the answer, reveal it, then say honestly if you remembered.
 */
export function renderReview(ctx) {
  const { root, deck, progress, save, signal } = ctx;
  progress.srs = progress.srs || {};
  const page = h('div', { class: 'page study-page review-page' });
  const body = h('div', { class: 'review-body' });
  page.append(studyHeader(deck, null), body);
  root.append(page);

  const queue = dueCards(deck.cards, progress.srs);
  const total = queue.length;
  const retried = new Set();
  let done = 0;
  let remembered = 0;
  let onKey = null;

  function next() {
    onKey = null;
    const card = queue.shift();
    if (!card) return finish();
    let revealed = false;
    const area = h('div', { class: 'reveal-area' });
    const showAnswer = () => {
      if (revealed) return;
      revealed = true;
      area.replaceChildren(
        h('div', { class: 'reveal-answer' }, h('span', { class: 'face-label' }, 'Definition'),
          card.image ? h('img', { class: 'q-img', src: card.image, alt: '', referrerpolicy: 'no-referrer' }) : null,
          h('p', { id: 'revealed-answer' }, card.definition)),
        h('p', { class: 'q-instruction' }, 'Did you remember it?'),
        h('div', { class: 'judge' },
          h('button', { class: 'btn btn-ghost', id: 'forgot-btn', onclick: () => judge(false) }, icon('x', { size: 18 }), 'Forgot'),
          h('button', { class: 'btn btn-success', id: 'remembered-btn', onclick: () => judge(true) }, icon('check', { size: 18 }), 'Remembered')));
      onKey = (e) => {
        if (e.key === '1' || e.key === 'ArrowLeft') judge(false);
        else if (e.key === '2' || e.key === 'ArrowRight') judge(true);
      };
    };
    const judge = (ok) => {
      const firstTry = !retried.has(card.id);
      if (firstTry) {
        review(progress.srs, card.id, ok);
        if (ok) remembered++;
        done++;
        logStudy(1);
      }
      if (!ok && firstTry) { retried.add(card.id); queue.push(card); } // one more look before you go
      save();
      announce(ok ? 'Nice!' : 'It will come back soon.');
      next();
    };
    area.append(h('button', { class: 'btn btn-primary btn-lg', id: 'show-answer-btn', onclick: showAnswer }, 'Show answer'));
    const pct = total ? (done / total) * 100 : 0;
    body.replaceChildren(
      h('div', { class: 'learn-top' },
        h('div', { class: 'learn-top-row' }, h('span', { class: 'round-label' }, 'Spaced review'), h('span', { class: 'muted small', id: 'review-left' }, `${Math.max(0, total - done)} left`)),
        h('div', { class: 'flash-progress' }, h('span', { style: { width: `${pct}%` } }))),
      h('div', { class: 'q-card panel', 'data-type': 'review' },
        h('div', { class: 'q-prompt' },
          h('div', { class: 'q-prompt-top' }, h('span', { class: 'face-label' }, 'Term'),
            canSpeak() ? h('button', { class: 'icon-btn', 'aria-label': 'Read aloud', onclick: () => speak(card.term, deck.lang?.term) }, icon('sound', { size: 20 })) : null),
          h('p', { class: `q-text ${sizeClass(card.term)}`, id: 'q-text' }, card.term)),
        hintLink(card),
        area));
    onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); showAnswer(); } };
  }

  function finish() {
    if (total) confetti();
    const nd = nextDue(deck.cards, progress.srs);
    const encId = encodeURIComponent(deck.id);
    body.replaceChildren(h('div', { class: 'panel finish', id: 'review-done' },
      h('div', { class: 'finish-emoji', 'aria-hidden': 'true' }, total ? '🧠' : '😴'),
      h('h2', null, total ? 'Review complete!' : 'Nothing to review right now'),
      h('p', { class: 'muted' }, total
        ? `You remembered ${remembered} of ${total}. Cards you forgot come back tomorrow, the rest wait longer.`
        : 'Cards join review once you master them in Learn.'),
      nd ? h('p', { class: 'best-badge center' }, icon('timer', { size: 16 }), `Next review ${describeDue(nd)}`) : null,
      h('div', { class: 'finish-actions' },
        h('a', { class: 'btn btn-primary', href: `#/deck/${encId}` }, 'Back to deck'),
        h('a', { class: 'btn btn-ghost', href: `#/deck/${encId}/learn` }, icon('learn', { size: 18 }), 'Learn more terms'))));
  }

  document.addEventListener('keydown', (e) => {
    if (isTyping(e) || document.querySelector('dialog[open]') || e.metaKey || e.ctrlKey) return;
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('button, a')) return;
    onKey?.(e);
  }, { signal });
  signal.addEventListener('abort', stopSpeaking);
  next();
}

/** "Show hint" link for cards whose sheet has a Hint column. */
export function hintLink(card) {
  if (!card.hint) return null;
  const wrap = h('div', { class: 'hint-wrap' });
  const btn = h('button', { type: 'button', class: 'link-btn hint-btn', onclick: () => {
    wrap.replaceChildren(h('p', { class: 'hint-text' }, icon('sparkle', { size: 16 }), h('span', null, card.hint)));
  } }, icon('sparkle', { size: 16 }), 'Show hint');
  wrap.append(btn);
  return wrap;
}
