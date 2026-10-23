import { hash } from './hash.js';

const ALIASES = {
  term: ['term', 'terms', 'question', 'questions', 'front', 'word', 'prompt', 'q', 'concept', 'vocab', 'vocabulary'],
  definition: ['definition', 'definitions', 'answer', 'answers', 'back', 'meaning', 'a', 'def', 'explanation', 'translation'],
  image: ['image', 'image url', 'imageurl', 'img', 'picture', 'photo', 'diagram'],
};

const normHeader = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Find which columns hold term / definition / image. Returns null when row 0 is not a header. */
export function detectColumns(headerRow) {
  const cols = { term: -1, definition: -1, image: -1 };
  headerRow.forEach((cell, idx) => {
    const h = normHeader(cell);
    for (const key of Object.keys(ALIASES)) {
      if (cols[key] === -1 && ALIASES[key].includes(h)) { cols[key] = idx; break; }
    }
  });
  if (cols.term === -1 && cols.definition === -1) return null;
  if (cols.term === -1) cols.term = cols.definition === 0 ? 1 : 0;
  if (cols.definition === -1) cols.definition = cols.term === 0 ? 1 : 0;
  return cols;
}

export function isSafeImageUrl(url) {
  return /^https:\/\/\S+$/i.test(String(url || '').trim());
}

/**
 * Convert parsed CSV rows into cards.
 * Accepts Quizlet-style "Term, Definition" headers, the older "Question, Answer"
 * headers, or no header at all (column A = term, column B = definition).
 */
export function rowsToCards(rows) {
  const warnings = [];
  if (!rows || rows.length === 0) return { cards: [], warnings: ['The sheet is empty.'], hasHeader: false };

  let cols = detectColumns(rows[0]);
  const hasHeader = cols !== null;
  if (!cols) cols = { term: 0, definition: 1, image: -1 };
  const body = hasHeader ? rows.slice(1) : rows;

  const cards = [];
  const seen = new Map();
  let skipped = 0;
  body.forEach((row) => {
    const term = (row[cols.term] ?? '').trim();
    const definition = (row[cols.definition] ?? '').trim();
    if (!term || !definition) { if (term || definition) skipped++; return; }
    let image = cols.image >= 0 ? (row[cols.image] ?? '').trim() : '';
    if (image && !isSafeImageUrl(image)) image = '';
    let id = hash(`${term}\u0000${definition}`);
    const count = seen.get(id) || 0;
    seen.set(id, count + 1);
    if (count) id = `${id}-${count}`;
    cards.push({ id, term, definition, image });
  });
  if (skipped) warnings.push(`${skipped} row${skipped === 1 ? ' was' : 's were'} skipped because the term or definition was empty.`);
  return { cards, warnings, hasHeader };
}

/** Which side is the prompt and which is the answer for a given direction. */
export function sides(card, answerWith) {
  return answerWith === 'term'
    ? { prompt: card.definition, answer: card.term, promptSide: 'definition', answerSide: 'term' }
    : { prompt: card.term, answer: card.definition, promptSide: 'term', answerSide: 'definition' };
}
