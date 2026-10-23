/** Forgiving answer checking for typed answers. */

export function normalize(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const stripParens = (s) => String(s || '').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');
const stripArticles = (s) => s.replace(/^(the|a|an|to|el|la|los|las|le|les|un|une|der|die|das) /, '');

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Variants of the expected answer a student may reasonably type. */
function acceptable(expected) {
  const out = new Set();
  const add = (s) => { const n = normalize(s); if (n) { out.add(n); out.add(stripArticles(n)); } };
  add(expected);
  add(stripParens(expected));
  // "colour / color" or "car; automobile" style alternatives
  const parts = String(expected).split(/\s*(?:;|\s\/\s|\|)\s*/);
  if (parts.length > 1) parts.forEach(add);
  return [...out];
}

/**
 * @returns {{ correct: boolean, close: boolean, empty: boolean }}
 * close = accepted, but with a small typo worth pointing out.
 */
export function gradeWritten(input, expected) {
  const given = normalize(input);
  if (!given) return { correct: false, close: false, empty: true };
  const g2 = stripArticles(given);
  let close = false;
  for (const target of acceptable(expected)) {
    if (given === target || g2 === target) return { correct: true, close: false, empty: false };
    const allowed = target.length >= 12 ? 2 : target.length >= 5 ? 1 : 0;
    if (allowed && (levenshtein(given, target) <= allowed || levenshtein(g2, target) <= allowed)) close = true;
  }
  return { correct: close, close, empty: false };
}

/** Typing a whole paragraph is no fun; long answers get a self-check instead. */
export function isTypeable(answer) {
  return String(answer || '').length <= 60;
}
