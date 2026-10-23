import { h, icon } from '../lib/dom.js';

export const MODES = [
  { key: 'flashcards', label: 'Flashcards', icon: 'cards', blurb: 'Flip through cards and sort what you know.' },
  { key: 'learn', label: 'Learn', icon: 'learn', blurb: 'Adaptive rounds until you master every term.' },
  { key: 'test', label: 'Test', icon: 'test', blurb: 'A practice test with instant grading.' },
  { key: 'match', label: 'Match', icon: 'match', blurb: 'Race the clock to pair everything up.' },
];

/** Top bar shared by all study modes: back link, deck title, mode switcher. */
export function studyHeader(deck, active) {
  return h('div', { class: 'study-header' },
    h('div', { class: 'study-header-row' },
      h('a', { class: 'btn btn-ghost btn-sm back-link', href: `#/deck/${encodeURIComponent(deck.id)}` }, icon('back', { size: 18 }), h('span', { class: 'back-text' }, 'Deck')),
      h('h1', { class: 'study-title', title: deck.title }, deck.title)),
    h('nav', { class: 'mode-tabs', 'aria-label': 'Study modes' },
      MODES.map((m) => h('a', {
        class: `mode-tab${m.key === active ? ' active' : ''}`,
        href: `#/deck/${encodeURIComponent(deck.id)}/${m.key}`,
        'aria-current': m.key === active ? 'page' : null,
      }, icon(m.icon, { size: 18 }), h('span', null, m.label)))));
}

/** A labelled segmented control: options [[value, label]]. */
export function segmented(name, options, value, onChange) {
  return h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': name },
    options.map(([v, label]) => h('button', {
      type: 'button',
      class: `seg${v === value ? ' active' : ''}`,
      role: 'radio',
      'aria-checked': String(v === value),
      onclick: (e) => {
        e.currentTarget.parentElement.querySelectorAll('.seg').forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-checked', 'false'); });
        e.currentTarget.classList.add('active');
        e.currentTarget.setAttribute('aria-checked', 'true');
        onChange(v);
      },
    }, label)));
}

export function toggle(label, checked, onChange, hint) {
  const input = h('input', { type: 'checkbox', class: 'switch-input', checked, onchange: (e) => onChange(e.target.checked) });
  return h('label', { class: 'switch-row' },
    h('span', { class: 'switch-text' }, h('span', null, label), hint ? h('small', null, hint) : null),
    input, h('span', { class: 'switch', 'aria-hidden': 'true' }));
}

export function masteryBar(counts, { large = false } = {}) {
  const pct = (n) => (counts.total ? (n / counts.total) * 100 : 0);
  return h('div', { class: `mastery${large ? ' mastery-lg' : ''}` },
    h('div', { class: 'mastery-bar', role: 'img', 'aria-label': `${counts.mastered} mastered, ${counts.learning} still learning, ${counts.new} not studied` },
      h('span', { class: 'seg-mastered', style: { width: `${pct(counts.mastered)}%` } }),
      h('span', { class: 'seg-learning', style: { width: `${pct(counts.learning)}%` } })),
    h('div', { class: 'mastery-legend' },
      h('span', { class: 'dot dot-mastered' }, `${counts.mastered} mastered`),
      h('span', { class: 'dot dot-learning' }, `${counts.learning} still learning`),
      h('span', { class: 'dot dot-new' }, `${counts.new} not studied`)));
}

export function emptyState(title, text, action) {
  return h('div', { class: 'empty-state' }, h('div', { class: 'empty-emoji', 'aria-hidden': 'true' }, '🗂️'), h('h2', null, title), h('p', null, text), action);
}

/** Cards in play, honouring the "starred only" filter (falls back to all if none starred). */
export function activeCards(deck, progress, starredOnly) {
  if (!starredOnly) return deck.cards;
  const stars = new Set(progress.stars);
  const s = deck.cards.filter((c) => stars.has(c.id));
  return s.length ? s : deck.cards;
}

export function starButton(card, progress, save, { size = 20 } = {}) {
  const isOn = () => progress.stars.includes(card.id);
  const btn = h('button', { class: 'icon-btn star-btn', type: 'button' });
  const paint = () => {
    btn.replaceChildren(icon('star', { size, filled: isOn() }));
    btn.classList.toggle('on', isOn());
    btn.setAttribute('aria-pressed', String(isOn()));
    btn.setAttribute('aria-label', isOn() ? 'Unstar this card' : 'Star this card');
  };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isOn()) progress.stars = progress.stars.filter((id) => id !== card.id);
    else progress.stars = [...progress.stars, card.id];
    save();
    paint();
  });
  paint();
  btn.repaint = paint;
  return btn;
}
