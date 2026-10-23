import { expect } from '@playwright/test';

export const SHEET_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd';
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=0`;

export const CARDS = [
  ['Photosynthesis', 'How plants make food from light'],
  ['Mitochondria', 'Powerhouse of the cell'],
  ['Osmosis', 'Water moving through a membrane'],
  ['Nucleus', 'Holds the genetic material'],
  ['Ribosome', 'Builds proteins'],
  ['Enzyme', 'Speeds up chemical reactions'],
];
export const answerFor = (prompt) => {
  const byTerm = CARDS.find(([t]) => t === prompt);
  if (byTerm) return byTerm[1];
  const byDef = CARDS.find(([, d]) => d === prompt);
  return byDef ? byDef[0] : null;
};

export const toCsv = (rows) => rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');

/** Pretend to be Google Sheets. */
export async function mockSheet(page, body, { status = 200, contentType = 'text/csv' } = {}) {
  const calls = [];
  await page.route('https://docs.google.com/**', (route) => {
    calls.push(route.request().url());
    route.fulfill({ status, body, headers: { 'content-type': contentType, 'access-control-allow-origin': '*' } });
  });
  return calls;
}

/** Collect console errors and uncaught exceptions; assert none at the end. */
export function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) errors.push(`console: ${m.text()}`); });
  return { assertClean: () => expect(errors, errors.join('\n')).toEqual([]) };
}

export async function loadDeck(page, rows = [['Term', 'Definition'], ...CARDS]) {
  await mockSheet(page, toCsv(rows));
  await page.goto('/');
  await page.fill('#sheet-url', SHEET_URL);
  await page.click('#load-btn');
  await expect(page.locator('#deck-title')).toBeVisible();
}

export async function noHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page should not scroll sideways').toBeLessThanOrEqual(1);
}
