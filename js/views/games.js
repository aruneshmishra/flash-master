import { h, icon, formatTime } from '../lib/dom.js';
import { studyHeader } from './shell.js';

export function renderGames({ root, deck, progress }) {
  const encId = encodeURIComponent(deck.id);
  const best = progress.best || {};
  const game = (key, emoji, title, text, badge) => h('a', { class: `game-card game-${key}`, href: `#/deck/${encId}/${key}`, 'data-game': key },
    h('span', { class: 'game-emoji', 'aria-hidden': 'true' }, emoji),
    h('span', { class: 'game-title' }, title),
    h('span', { class: 'game-text muted' }, text),
    badge ? h('span', { class: 'best-badge' }, icon('trophy', { size: 14 }), badge) : null);
  root.append(h('div', { class: 'page study-page games-page' },
    studyHeader(deck, 'games'),
    h('div', { class: 'game-grid' },
      game('match', '🧩', 'Match', 'Pair every term with its definition as fast as you can.', best.match ? `Best ${formatTime(best.match)}` : null),
      game('meteor', '☄️', 'Meteor', 'Stop the falling meteors by picking the right answer before they land.', best.meteor ? `Best ${best.meteor} pts` : null))));
}
