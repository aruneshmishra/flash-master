import { h, icon, isTyping, announce, toast } from '../lib/dom.js';
import { shuffle } from '../lib/random.js';
import { speak, canSpeak, stopSpeaking } from '../lib/speech.js';
import { confetti } from '../lib/confetti.js';
import { studyHeader, segmented, toggle, starButton, activeCards } from './shell.js';
import { modal } from '../lib/dom.js';
import { hintLink } from './review.js';
import { logStudy } from './streak.js';

export function renderFlashcards(ctx) {
  const { root, deck, progress, save, signal } = ctx;
  progress.prefs = progress.prefs || {};
  const prefs = (progress.prefs.flash = { front: 'term', starredOnly: false, track: false, ...progress.prefs.flash });

  let order = [];
  let index = 0;
  let flipped = false;
  let shuffled = false;
  let results = new Map(); // id -> 'know' | 'learning' (this pass)
  let autoplay = null;
  let finished = false;

  const page = h('div', { class: 'page study-page flash-page' });
  root.append(page);

  function build(cards) {
    order = shuffled ? shuffle(cards) : cards.slice();
    index = 0;
    flipped = false;
    results = new Map();
    finished = false;
  }
  build(activeCards(deck, progress, prefs.starredOnly));

  /* ---------- rendering ---------- */
  const header = studyHeader(deck, 'flashcards');
  const body = h('div', { class: 'flash-body' });
  page.append(header, body);

  function faceContent(card, side) {
    const text = side === 'term' ? card.term : card.definition;
    const lang = deck.lang?.[side];
    const showImg = card.image && side === 'definition';
    return h('div', { class: 'face-inner' },
      h('div', { class: 'face-top' },
        h('span', { class: 'face-label' }, side === 'term' ? 'Term' : 'Definition'),
        h('div', { class: 'face-tools' },
          canSpeak() ? h('button', { class: 'icon-btn', 'aria-label': 'Read aloud', onclick: (e) => { e.stopPropagation(); speak(text, lang); } }, icon('sound', { size: 20 })) : null,
          starButton(card, progress, save))),
      h('div', { class: `face-content${showImg ? ' has-img' : ''}` },
        showImg ? h('img', { src: card.image, alt: '', class: 'face-img', referrerpolicy: 'no-referrer', draggable: false }) : null,
        h('p', { class: `face-text ${sizeClass(text)}` }, text),
        side === 'term' ? hintLink(card) : null));
  }

  function draw(direction) {
    stopAutoplayIfDone();
    body.replaceChildren();
    if (finished) { body.append(finishPanel()); return; }
    const card = order[index];
    const front = prefs.front;
    const back = front === 'term' ? 'definition' : 'term';

    const known = [...results.values()].filter((v) => v === 'know').length;
    const learning = results.size - known;

    const cardEl = h('div', {
      class: `flashcard${flipped ? ' is-flipped' : ''}${direction ? ` enter-${direction}` : ''}`,
      id: 'flashcard', tabindex: '0', role: 'button',
      'aria-label': flipped ? `Showing ${back}. Press space to flip back.` : `Showing ${front}. Press space to flip.`,
    },
      h('div', { class: 'face face-front' }, faceContent(card, front)),
      h('div', { class: 'face face-back' }, faceContent(card, back)));
    attachGestures(cardEl);

    const progressBar = h('div', { class: 'flash-progress', 'aria-hidden': 'true' }, h('span', { style: { width: `${((index + (finished ? 1 : 0)) / order.length) * 100}%` } }));

    const stage = h('div', { class: `flash-stage${prefs.track ? ' tracking' : ''}` },
      prefs.track ? h('div', { class: 'tally tally-learning', title: 'Still learning' }, h('span', { class: 'tally-num', id: 'tally-learning' }, String(learning)), h('span', { class: 'tally-label' }, 'Still learning')) : null,
      h('div', { class: 'card-wrap' }, cardEl),
      prefs.track ? h('div', { class: 'tally tally-know', title: 'Know' }, h('span', { class: 'tally-num', id: 'tally-know' }, String(known)), h('span', { class: 'tally-label' }, 'Know')) : null);

    const counter = h('span', { class: 'flash-counter', id: 'flash-counter' }, `${index + 1} / ${order.length}`);
    const controls = h('div', { class: 'flash-controls' },
      h('div', { class: 'ctrl-group' },
        toggleChip('Track progress', prefs.track, (v) => { prefs.track = v; save(); build(activeCards(deck, progress, prefs.starredOnly)); draw(); }, 'track-toggle')),
      prefs.track
        ? h('div', { class: 'ctrl-group main' },
          h('button', { class: 'round-btn learning', id: 'still-learning-btn', 'aria-label': 'Still learning', title: 'Still learning (←)', onclick: () => mark('learning') }, icon('x', { size: 24 })),
          counter,
          h('button', { class: 'round-btn know', id: 'know-btn', 'aria-label': 'I know this', title: 'Know (→)', onclick: () => mark('know') }, icon('check', { size: 24 })))
        : h('div', { class: 'ctrl-group main' },
          h('button', { class: 'round-btn', id: 'prev-btn', 'aria-label': 'Previous card', title: 'Previous (←)', disabled: index === 0, onclick: prev }, icon('left', { size: 22 })),
          counter,
          h('button', { class: 'round-btn', id: 'next-btn', 'aria-label': 'Next card', title: 'Next (→)', onclick: next }, icon('right', { size: 22 }))),
      h('div', { class: 'ctrl-group end' },
        h('button', { class: `icon-btn${autoplay ? ' on' : ''}`, id: 'autoplay-btn', 'aria-label': autoplay ? 'Stop auto-play' : 'Auto-play', title: 'Auto-play', 'aria-pressed': String(!!autoplay), onclick: toggleAutoplay }, icon(autoplay ? 'pause' : 'play', { size: 20 })),
        h('button', { class: `icon-btn${shuffled ? ' on' : ''}`, id: 'shuffle-btn', 'aria-label': 'Shuffle', title: 'Shuffle', 'aria-pressed': String(shuffled), onclick: toggleShuffle }, icon('shuffle', { size: 20 })),
        h('button', { class: 'icon-btn', id: 'flash-settings', 'aria-label': 'Flashcard options', title: 'Options', onclick: options }, icon('gear', { size: 20 }))));

    const hint = h('p', { class: 'kbd-hint' },
      kbd('Space'), ' flip  ', kbd('←'), ' ', kbd('→'), prefs.track ? ' sort  ' : ' move  ', kbd('S'), ' star',
      h('span', { class: 'touch-only' }, ' · Swipe the card'));

    body.append(progressBar, stage, controls, hint);
  }

  function kbd(t) { return h('kbd', null, t); }
  function toggleChip(label, on, onChange, id) {
    return h('button', { class: `chip-toggle${on ? ' on' : ''}`, id, 'aria-pressed': String(on), onclick: () => onChange(!on) },
      h('span', { class: 'chip-dot', 'aria-hidden': 'true' }), label);
  }

  function finishPanel() {
    const known = [...results.values()].filter((v) => v === 'know').length;
    const learning = [...results.entries()].filter(([, v]) => v === 'learning').map(([id]) => id);
    const total = order.length;
    if (prefs.track && known === total) confetti();
    const encId = encodeURIComponent(deck.id);
    const pct = total ? Math.round((known / total) * 100) : 0;
    return h('div', { class: 'panel finish', id: 'flash-finish' },
      h('div', { class: 'finish-emoji', 'aria-hidden': 'true' }, prefs.track ? (pct === 100 ? '🏆' : pct >= 60 ? '💪' : '🌱') : '🎉'),
      h('h2', null, prefs.track ? (pct === 100 ? 'You know every card!' : 'Nice work, keep going!') : "You've reached the end!"),
      prefs.track ? h('div', { class: 'finish-stats' },
        h('div', { class: 'stat know' }, h('b', null, String(known)), h('span', null, 'Know')),
        h('div', { class: 'stat learning' }, h('b', null, String(learning.length)), h('span', null, 'Still learning'))) : h('p', { class: 'muted' }, `You went through all ${total} cards.`),
      h('div', { class: 'finish-actions' },
        prefs.track && learning.length ? h('button', {
          class: 'btn btn-primary', id: 'review-learning-btn',
          onclick: () => { const ids = new Set(learning); build(deck.cards.filter((c) => ids.has(c.id))); draw(); },
        }, `Keep reviewing ${learning.length} term${learning.length === 1 ? '' : 's'}`) : null,
        h('button', { class: `btn ${prefs.track && learning.length ? 'btn-ghost' : 'btn-primary'}`, id: 'restart-btn', onclick: () => { build(activeCards(deck, progress, prefs.starredOnly)); draw(); } }, 'Restart flashcards'),
        h('a', { class: 'btn btn-ghost', href: `#/deck/${encId}/learn` }, icon('learn', { size: 18 }), 'Practice with Learn')));
  }

  /* ---------- actions ---------- */
  function flip() {
    flipped = !flipped;
    const el = body.querySelector('#flashcard');
    if (el) {
      el.classList.remove('enter-left', 'enter-right');
      el.classList.toggle('is-flipped', flipped);
      el.setAttribute('aria-label', flipped ? 'Showing back. Press space to flip back.' : 'Showing front. Press space to flip.');
    }
  }
  function next() {
    if (!prefs.track) logStudy(1);
    if (index < order.length - 1) { index++; flipped = false; draw('right'); announce(`Card ${index + 1} of ${order.length}`); }
    else { finished = true; draw(); }
  }
  function prev() {
    if (index > 0) { index--; flipped = false; draw('left'); }
  }
  function mark(kind) {
    logStudy(1);
    const card = order[index];
    results.set(card.id, kind);
    const knowSet = new Set(progress.know);
    if (kind === 'know') knowSet.add(card.id); else knowSet.delete(card.id);
    progress.know = [...knowSet];
    save();
    next();
  }
  function toggleShuffle() {
    shuffled = !shuffled;
    build(activeCards(deck, progress, prefs.starredOnly));
    draw();
    toast(shuffled ? 'Cards shuffled' : 'Back to original order');
  }
  function toggleAutoplay() {
    if (autoplay) { clearInterval(autoplay); autoplay = null; draw(); return; }
    autoplay = setInterval(() => {
      if (finished) { clearInterval(autoplay); autoplay = null; return; }
      if (!flipped) flip();
      else if (index < order.length - 1) next();
      else { clearInterval(autoplay); autoplay = null; finished = true; draw(); }
    }, 2600);
    draw();
  }
  function stopAutoplayIfDone() { if (finished && autoplay) { clearInterval(autoplay); autoplay = null; } }

  async function options() {
    await modal({
      title: 'Flashcard options',
      body: h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Show first'),
          segmented('Show first', [['term', 'Term'], ['definition', 'Definition']], prefs.front, (v) => { prefs.front = v; })),
        toggle('Study starred cards only', prefs.starredOnly, (v) => { prefs.starredOnly = v; }, progress.stars.length ? `${progress.stars.length} starred` : 'Star cards with ★ or press S')),
      buttons: [{ label: 'Done', value: true, variant: 'primary' }],
    });
    save();
    if (prefs.starredOnly && !progress.stars.length) toast('No starred cards yet, showing all cards');
    build(activeCards(deck, progress, prefs.starredOnly));
    draw();
  }

  /* ---------- gestures ---------- */
  function attachGestures(el) {
    let startX = 0, startY = 0, dx = 0, dragging = false, moved = false;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      dragging = true; moved = false; startX = e.clientX; startY = e.clientY; dx = 0;
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        moved = true;
        el.style.transition = 'none';
        el.parentElement.style.transform = `translateX(${dx}px) rotate(${dx / 25}deg)`;
        el.parentElement.dataset.swipe = dx > 0 ? 'right' : 'left';
      }
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      el.style.transition = '';
      const wrap = el.parentElement;
      wrap.style.transform = '';
      delete wrap.dataset.swipe;
      if (moved && Math.abs(dx) > 80) {
        if (prefs.track) mark(dx > 0 ? 'know' : 'learning');
        else if (dx < 0) next(); else prev();
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      if (moved) { moved = false; return; }
      flip();
    });
  }

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', (e) => {
    if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
    if (finished) return;
    const k = e.key;
    if (k === ' ' || k === 'ArrowUp' || k === 'ArrowDown' || (k === 'Enter' && e.target.id === 'flashcard')) { e.preventDefault(); flip(); }
    else if (k === 'ArrowRight') { e.preventDefault(); prefs.track ? mark('know') : next(); }
    else if (k === 'ArrowLeft') { e.preventDefault(); prefs.track ? mark('learning') : prev(); }
    else if (k.toLowerCase() === 's') { body.querySelector(flipped ? '.face-back .star-btn' : '.face-front .star-btn')?.click(); body.querySelectorAll('.star-btn').forEach((b) => b.repaint?.()); }
    else if (k.toLowerCase() === 'k' && canSpeak()) { const c = order[index]; const side = flipped ? (prefs.front === 'term' ? 'definition' : 'term') : prefs.front; speak(c[side], deck.lang?.[side]); }
  }, { signal });

  signal.addEventListener('abort', () => { if (autoplay) clearInterval(autoplay); stopSpeaking(); });
  draw();
}

export function sizeClass(text) {
  const n = String(text).length;
  if (n > 220) return 'size-xs';
  if (n > 120) return 'size-sm';
  if (n > 50) return 'size-md';
  if (n > 18) return 'size-lg';
  return 'size-xl';
}
