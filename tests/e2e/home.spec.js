import { test, expect } from '@playwright/test';
import { mockSheet, watchErrors, loadDeck, SHEET_URL, SHEET_ID, CARDS, toCsv, noHorizontalScroll } from './helpers.js';

test('home page: dark by default, theme toggle persists', async ({ page }) => {
  const errs = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('flashcards');
  await noHorizontalScroll(page);
  await page.click('#theme-btn');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  errs.assertClean();
});

test('loads a Google Sheet, converts link to CSV export, lists terms', async ({ page }) => {
  const errs = watchErrors(page);
  const calls = await mockSheet(page, toCsv([['Term', 'Definition'], ...CARDS, ['Comma, term', 'Line one\nline two']]));
  await page.goto('/');
  await page.fill('#sheet-url', SHEET_URL);
  await page.press('#sheet-url', 'Enter');
  await expect(page.locator('#deck-title')).toBeVisible();
  expect(calls[0]).toBe(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`);
  await expect(page.locator('.term-row')).toHaveCount(CARDS.length + 1);
  await expect(page.locator("#view")).not.toContainText(/\bnull\b|undefined/);
  await expect(page.locator('.term-row').last()).toContainText('Comma, term');
  await noHorizontalScroll(page);
  // shows in "Jump back in" on the home page
  await page.goto('/#/');
  await expect(page.locator('.deck-card')).toHaveCount(1);
  errs.assertClean();
});

test('legacy Question/Answer sheets still work', async ({ page }) => {
  await loadDeck(page, [['Question', 'Answer'], ['2+2', '4'], ['3+3', '6']]);
  await expect(page.locator('.term-row')).toHaveCount(2);
});

test('friendly error for a private sheet and for a bad link', async ({ page }) => {
  await mockSheet(page, '<!DOCTYPE html><html><body>Sign in</body></html>', { contentType: 'text/html' });
  await page.goto('/');
  await page.fill('#sheet-url', SHEET_URL);
  await page.click('#load-btn');
  await expect(page.locator('.form-status.error')).toContainText('Anyone with the link');
  await page.fill('#sheet-url', 'not a link');
  await page.click('#load-btn');
  await expect(page.locator('.form-status.error')).toContainText("doesn't look like");
});

test('sheet content cannot inject HTML or scripts', async ({ page }) => {
  await loadDeck(page, [['Term', 'Definition'], ['<img src=x onerror="window.__pwned=1">', '<b>bold</b>'], ['safe', 'card']]);
  await expect(page.locator('.term-row').first()).toContainText('<img src=x');
  await page.click('[data-mode="flashcards"]');
  await expect(page.locator('#flashcard')).toBeVisible();
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  expect(await page.locator('.term-row b, .face b').count()).toBe(0);
});

test('shared ?sheet= link opens the deck directly', async ({ page }) => {
  await mockSheet(page, toCsv([['Term', 'Definition'], ...CARDS]));
  await page.goto(`/?sheet=${encodeURIComponent(SHEET_URL)}`);
  await expect(page.locator('#deck-title')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#/deck/s-${SHEET_ID}-0$`));
});

test('deck deep link works on a fresh device (fetches sheet from id)', async ({ page }) => {
  await mockSheet(page, toCsv([['Term', 'Definition'], ...CARDS]));
  await page.goto(`/#/deck/s-${SHEET_ID}-0/flashcards`);
  await expect(page.locator('#flashcard')).toBeVisible();
});

test('opens a Quizlet tab-separated export file', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('#csv-file', { name: 'quizlet-export.txt', mimeType: 'text/plain', buffer: Buffer.from('gato\tcat, the animal\nperro\tdog\n') });
  await expect(page.locator('#deck-title')).toHaveText('quizlet-export');
  await expect(page.locator('.term-row')).toHaveCount(2);
  await expect(page.locator('.term-row').first()).toContainText('cat, the animal');
});

test('sample deck, rename, star filter, and remove from home', async ({ page }) => {
  const errs = watchErrors(page);
  await page.goto('/');
  await page.click('[data-sample="sample-space"]');
  await expect(page.locator('#deck-title')).toHaveText('Our solar system');
  await page.getByRole('button', { name: 'Rename deck' }).click();
  await page.locator('dialog input').fill('Planets!');
  await page.locator('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('#deck-title')).toHaveText('Planets!');
  await page.locator('.term-row .star-btn').first().click();
  await page.getByRole('tab', { name: '★ Starred' }).click();
  await expect(page.locator('.term-row')).toHaveCount(1);
  await page.goto('/#/');
  await page.locator('.deck-card-remove').click();
  await page.locator('dialog').getByRole('button', { name: 'Remove' }).click();
  await expect(page.locator('.deck-card')).toHaveCount(0);
  errs.assertClean();
});
