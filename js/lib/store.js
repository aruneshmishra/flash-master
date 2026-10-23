/**
 * localStorage wrapper. Every call is guarded: private windows or blocked
 * storage must never crash the app, progress just won't persist.
 */
const NS = 'fm:';
const mem = new Map();

function raw() {
  try { const s = globalThis.localStorage; s.getItem('x'); return s; } catch { return null; }
}

export function get(key, fallback = null) {
  const s = raw();
  try {
    const v = s ? s.getItem(NS + key) : mem.get(NS + key);
    return v == null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}

export function set(key, value) {
  const s = raw();
  const v = JSON.stringify(value);
  try { if (s) s.setItem(NS + key, v); else mem.set(NS + key, v); return true; } catch { return false; }
}

export function remove(key) {
  const s = raw();
  try { if (s) s.removeItem(NS + key); else mem.delete(NS + key); } catch { /* ignore */ }
}

/* ---------- decks ---------- */

export function saveDeck(deck) {
  set(`deck:${deck.id}`, deck);
  const recent = get('recent', []).filter((id) => id !== deck.id);
  recent.unshift(deck.id);
  set('recent', recent.slice(0, 30));
}

export const loadDeck = (id) => get(`deck:${id}`);

export function recentDecks() {
  return get('recent', []).map(loadDeck).filter(Boolean);
}

export function removeDeck(id) {
  remove(`deck:${id}`);
  remove(`progress:${id}`);
  set('recent', get('recent', []).filter((x) => x !== id));
}

/* ---------- per-deck progress ---------- */

export function emptyProgress() {
  return { learn: {}, srs: {}, stars: [], know: [], best: {}, lastStudied: 0 };
}

export function loadProgress(id) {
  return { ...emptyProgress(), ...get(`progress:${id}`, {}) };
}

export function saveProgress(id, progress) {
  progress.lastStudied = Date.now();
  set(`progress:${id}`, progress);
}

/* ---------- app settings ---------- */

export const loadSettings = () => ({ theme: 'dark', ...get('settings', {}) });
export function saveSettings(patch) { const s = { ...loadSettings(), ...patch }; set('settings', s); return s; }

/* ---------- daily activity (streak + goal), shared across decks ---------- */
import { emptyActivity } from './activity.js';
export const loadActivity = () => ({ ...emptyActivity(), ...get('activity', {}) });
export function saveActivity(a) { set('activity', a); }
