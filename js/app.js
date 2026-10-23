import { h, icon, modal, toast, isTyping } from './lib/dom.js';
import * as store from './lib/store.js';
import { getDeck, importFromSheet, needsRefresh, refreshDeck } from './lib/deck-service.js';
import { stopSpeaking } from './lib/speech.js';
import { renderHome } from './views/home.js';
import { renderDeck } from './views/deck.js';
import { renderFlashcards } from './views/flashcards.js';
import { renderLearn } from './views/learn.js';
import { renderTest } from './views/test.js';
import { renderMatch } from './views/match.js';
import { renderGames } from './views/games.js';
import { renderMeteor } from './views/meteor.js';
import { renderReview } from './views/review.js';
import { paintStreak, showStreak } from './views/streak.js';

const MODES = { flashcards: renderFlashcards, learn: renderLearn, test: renderTest, games: renderGames, match: renderMatch, meteor: renderMeteor, review: renderReview };
const root = document.getElementById('view');
let controller = null;
let navToken = 0;

/* ---------- theme (dark by default) ---------- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById('theme-btn');
  if (btn) {
    btn.replaceChildren(icon(theme === 'dark' ? 'sun' : 'moon', { size: 20 }));
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    btn.title = btn.getAttribute('aria-label');
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0e1020' : '#f6f7fb');
}

function initChrome() {
  applyTheme(store.loadSettings().theme);
  document.getElementById('theme-btn').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    store.saveSettings({ theme: next });
    applyTheme(next);
  });
  const kb = document.getElementById('keys-btn');
  kb.replaceChildren(icon('keyboard', { size: 20 }));
  kb.addEventListener('click', showShortcuts);
  paintStreak();
  document.getElementById('streak-btn').addEventListener('click', showStreak);
  // A new day may start while the tab is open.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) paintStreak(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === '?' && !isTyping(e) && !document.querySelector('dialog[open]')) showShortcuts();
  });
}

function showShortcuts() {
  const row = (keys, what) => h('tr', null, h('td', null, keys.map((k) => h('kbd', null, k))), h('td', null, what));
  modal({
    title: 'Keyboard shortcuts',
    body: h('div', { class: 'shortcuts' },
      h('h3', null, 'Flashcards'),
      h('table', null, row(['Space'], 'Flip card'), row(['←', '→'], 'Previous / next (or sort when tracking)'), row(['S'], 'Star card'), row(['K'], 'Read aloud')),
      h('h3', null, 'Learn'),
      h('table', null, row(['1', '2', '3', '4'], 'Pick an answer'), row(['Enter'], 'Submit / continue'), row(['O'], 'Override: I was right')),
      h('h3', null, 'Spaced review'),
      h('table', null, row(['Space'], 'Show answer'), row(['1', '2'], 'Forgot / remembered')),
      h('h3', null, 'Meteor game'),
      h('table', null, row(['1', '2', '3', '4'], 'Pick an answer')),
      h('h3', null, 'Anywhere'),
      h('table', null, row(['?'], 'Show this help'))),
    buttons: [{ label: 'Close', value: true, variant: 'primary' }],
  });
}

/* ---------- routing ---------- */
export function navigate(hash) {
  if (location.hash === hash) route(); else location.hash = hash;
}

function loading(text = 'Loading your deck…') {
  root.replaceChildren(h('div', { class: 'page loading-page', role: 'status' }, h('div', { class: 'spinner', 'aria-hidden': 'true' }), h('p', { class: 'muted' }, text)));
}

function errorPage(message, retry) {
  root.replaceChildren(h('div', { class: 'page' }, h('div', { class: 'panel finish' },
    h('div', { class: 'finish-emoji', 'aria-hidden': 'true' }, '😕'),
    h('h2', null, "We couldn't open that deck"),
    h('p', { class: 'muted', id: 'error-message' }, message),
    h('div', { class: 'finish-actions' },
      retry ? h('button', { class: 'btn btn-primary', onclick: retry }, icon('refresh', { size: 18 }), 'Try again') : null,
      h('a', { class: 'btn btn-ghost', href: '#/' }, 'Back to home')))));
}

async function route() {
  const token = ++navToken;
  controller?.abort();
  controller = new AbortController();
  stopSpeaking();
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());

  const parts = (location.hash || '#/').replace(/^#\/?/, '').split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });

  if (parts[0] !== 'deck' || !parts[1]) {
    document.title = 'FlashMaster · Study anything from a Google Sheet';
    root.replaceChildren();
    renderHome({ root, navigate });
    focusMain();
    return;
  }

  const [, id, mode] = parts;
  const saved = store.loadDeck(id);
  if (!saved) loading();
  let deck;
  try {
    deck = await getDeck(id);
  } catch (err) {
    if (token === navToken) errorPage(err.message, route);
    return;
  }
  if (token !== navToken) return;
  if (!deck) { errorPage('This deck link is not valid anymore. Paste the Google Sheet link on the home page instead.'); return; }

  const progress = store.loadProgress(id);
  const ctx = { root, deck, progress, navigate, signal: controller.signal, save: () => store.saveProgress(id, progress) };
  root.replaceChildren();
  const render = MODES[mode] || renderDeck;
  const modeName = MODES[mode] ? mode[0].toUpperCase() + mode.slice(1) : null;
  document.title = `${modeName ? `${modeName} · ` : ''}${deck.title} · FlashMaster`;
  const instance = render(ctx);
  window.scrollTo({ top: 0 });
  focusMain();

  // Pull in edits made to the sheet, without interrupting a study session.
  if (needsRefresh(deck)) {
    refreshDeck(deck).then(({ deck: fresh, changed }) => {
      if (!changed || token !== navToken) return;
      if (instance?.onDeckUpdated) { instance.onDeckUpdated(fresh); toast(`Updated from your sheet: ${fresh.cards.length} terms`, { type: 'success' }); }
      else toast('Your sheet changed. Leave and re-open this mode to see the new cards.');
    }).catch(() => { /* offline: keep studying the saved copy */ });
  }
}

function focusMain() {
  const main = document.getElementById('view');
  main.setAttribute('tabindex', '-1');
  main.focus({ preventScroll: true });
}

/* ---------- shared links: ?sheet=<google sheet link> ---------- */
async function handleSharedLink() {
  const params = new URLSearchParams(location.search);
  const sheet = params.get('sheet');
  if (!sheet) return false;
  loading('Opening shared deck…');
  const clean = `${location.pathname}`;
  try {
    const deck = await importFromSheet(sheet);
    history.replaceState(null, '', `${clean}#/deck/${encodeURIComponent(deck.id)}`);
  } catch (err) {
    history.replaceState(null, '', `${clean}#/`);
    route();
    setTimeout(() => {
      const input = document.getElementById('sheet-url');
      const status = document.querySelector('.form-status');
      if (input) input.value = sheet;
      if (status) { status.textContent = err.message; status.className = 'form-status error'; }
    }, 0);
    return true;
  }
  return false;
}

window.addEventListener('hashchange', route);
initChrome();
handleSharedLink().then((handled) => { if (!handled) route(); });
