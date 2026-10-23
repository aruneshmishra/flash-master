import { parseCSV } from './csv.js';
import { rowsToCards } from './deck.js';
import { hash } from './hash.js';
import { parseSheetUrl, fetchSheet, deckIdFor, SheetError } from './sheet.js';
import * as store from './store.js';
import { SAMPLES, findSample } from '../data/samples.js';

const REFRESH_AFTER_MS = 2 * 60 * 1000;

function buildDeck({ id, title, source, text, previous }) {
  const { cards, warnings } = rowsToCards(parseCSV(text));
  if (!cards.length) {
    throw new SheetError('No cards found. Put terms in column A and definitions in column B (a header row like "Term, Definition" is optional).', 'empty-deck');
  }
  return {
    id,
    title: previous?.titleIsCustom ? previous.title : (title || previous?.title || 'My study set'),
    titleIsCustom: previous?.titleIsCustom || false,
    source,
    cards,
    warnings,
    lang: previous?.lang || { term: 'auto', definition: 'auto' },
    fetchedAt: Date.now(),
  };
}

export async function importFromSheet(input, fetchImpl) {
  const src = parseSheetUrl(input);
  const id = deckIdFor(src);
  const previous = store.loadDeck(id);
  const { text, title } = await fetchSheet(src, fetchImpl);
  const deck = buildDeck({ id, title, source: src, text, previous });
  store.saveDeck(deck);
  return deck;
}

export function importFromCSVText(text, fileName = 'My file') {
  const id = `file-${hash(text)}`;
  const deck = buildDeck({ id, title: fileName.replace(/\.(csv|txt|tsv)$/i, ''), source: { kind: 'file', name: fileName }, text: normalizeDelimiters(text), previous: store.loadDeck(id) });
  store.saveDeck(deck);
  return deck;
}

/** Quizlet's export uses tabs between term and definition; accept that too. */
export function normalizeDelimiters(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  if (firstLine.includes('\t')) {
    return text.split(/\r?\n/).map((l) => l.split('\t').map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  }
  return text;
}

export function openSample(id) {
  const s = findSample(id);
  if (!s) return null;
  const previous = store.loadDeck(id);
  const deck = {
    id: s.id, title: s.title, titleIsCustom: false, source: { kind: 'sample' }, cards: s.cards, warnings: [],
    lang: previous?.lang || s.lang || { term: 'auto', definition: 'auto' }, fetchedAt: Date.now(),
  };
  store.saveDeck(deck);
  return deck;
}

/** Rebuild a sheet source from a deck id, so shared #/deck/... links work on a fresh device. */
export function sourceFromId(id) {
  const m = id.match(/^([sp])-([a-zA-Z0-9_-]+)-(\d+)$/);
  if (!m) return null;
  return { kind: m[1] === 'p' ? 'published' : 'sheet', id: m[2], gid: m[3] };
}

export function sheetInputFor(source) {
  if (source.kind === 'sheet') return `https://docs.google.com/spreadsheets/d/${source.id}/edit#gid=${source.gid}`;
  if (source.kind === 'published') return `https://docs.google.com/spreadsheets/d/e/${source.id}/pubhtml?gid=${source.gid}`;
  if (source.kind === 'csv') return source.url;
  return null;
}

export async function getDeck(id) {
  const saved = store.loadDeck(id);
  if (saved) return saved;
  if (findSample(id)) return openSample(id);
  const src = sourceFromId(id);
  if (src) return importFromSheet(sheetInputFor(src));
  return null;
}

export const isRemote = (deck) => ['sheet', 'published', 'csv'].includes(deck?.source?.kind);
export const needsRefresh = (deck) => isRemote(deck) && Date.now() - (deck.fetchedAt || 0) > REFRESH_AFTER_MS;

/** Re-download a sheet deck. Returns { deck, changed }. */
export async function refreshDeck(deck, fetchImpl) {
  if (!isRemote(deck)) return { deck, changed: false };
  const fresh = await importFromSheet(sheetInputFor(deck.source), fetchImpl);
  const sig = (d) => d.cards.map((c) => c.id + c.image).join('|');
  return { deck: fresh, changed: sig(fresh) !== sig(deck) };
}

export function renameDeck(deck, title) {
  deck.title = title.trim() || deck.title;
  deck.titleIsCustom = true;
  store.saveDeck(deck);
}

export { SAMPLES };
