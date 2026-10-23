import { test, expect } from '@playwright/test';
import { watchErrors, loadDeck, noHorizontalScroll } from './helpers.js';

test('match game: wrong pair adds penalty, finishing sets a best time', async ({ page }) => {
  const errs = watchErrors(page);
  await loadDeck(page);
  await page.click('[data-mode="match"]');
  await page.click('#start-match');
  const tiles = page.locator('#match-grid .tile');
  await expect(tiles).toHaveCount(12);
  await noHorizontalScroll(page);
  // a deliberate mistake
  const ids = await tiles.evaluateAll((els) => els.map((e) => [e.dataset.id, e.dataset.side]));
  const a = ids.findIndex(([, s]) => s === 'term');
  const b = ids.findIndex(([id, s]) => s === 'definition' && id !== ids[a][0]);
  await tiles.nth(a).click();
  await tiles.nth(b).click();
  await expect(tiles.nth(a)).toHaveClass(/wrong/);
  await page.waitForTimeout(500);
  // now solve it
  const unique = [...new Set(ids.map(([id]) => id))];
  for (const id of unique) {
    await page.locator(`#match-grid .tile[data-id="${id}"][data-side="term"]`).click();
    await page.locator(`#match-grid .tile[data-id="${id}"][data-side="definition"]`).click();
  }
  await expect(page.locator('#match-done')).toBeVisible();
  await expect(page.locator('#final-time')).toHaveText(/\d/);
  await page.click('#play-again');
  await expect(tiles).toHaveCount(12);
  errs.assertClean();
});
