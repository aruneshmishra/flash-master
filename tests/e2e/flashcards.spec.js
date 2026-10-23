import { test, expect } from '@playwright/test';
import { watchErrors, loadDeck, CARDS, noHorizontalScroll } from './helpers.js';

test('flip, navigate, star with keyboard', async ({ page }) => {
  const errs = watchErrors(page);
  await loadDeck(page);
  await page.click('[data-mode="flashcards"]');
  const card = page.locator('#flashcard');
  await expect(card.locator('.face-front')).toContainText(CARDS[0][0]);
  await expect(page.locator('#flash-counter')).toHaveText(`1 / ${CARDS.length}`);
  await page.keyboard.press('Space');
  await expect(card).toHaveClass(/is-flipped/);
  await card.click({ position: { x: 150, y: 150 } });
  await expect(card).not.toHaveClass(/is-flipped/);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#flash-counter')).toHaveText(`2 / ${CARDS.length}`);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#flash-counter')).toHaveText(`1 / ${CARDS.length}`);
  await page.keyboard.press('s');
  await expect(card.locator('.face-front .star-btn')).toHaveAttribute('aria-pressed', 'true');
  await noHorizontalScroll(page);
  // go to the end
  for (let i = 0; i < CARDS.length; i++) await page.click('#next-btn');
  await expect(page.locator('#flash-finish')).toBeVisible();
  await page.click('#restart-btn');
  await expect(page.locator('#flash-counter')).toHaveText(`1 / ${CARDS.length}`);
  errs.assertClean();
});

test('track progress sorts cards and lets you review the ones still learning', async ({ page }) => {
  await loadDeck(page);
  await page.click('[data-mode="flashcards"]');
  await page.click('#track-toggle');
  for (let i = 0; i < CARDS.length; i++) {
    await page.click(i % 2 ? '#still-learning-btn' : '#know-btn');
  }
  await expect(page.locator('#flash-finish')).toContainText('Know');
  await expect(page.locator('.stat.know b')).toHaveText('3');
  await page.click('#review-learning-btn');
  await expect(page.locator('#flash-counter')).toHaveText('1 / 3');
});

test('shuffle and options: show definition first', async ({ page }) => {
  await loadDeck(page);
  await page.click('[data-mode="flashcards"]');
  await page.click('#flash-settings');
  await page.locator('dialog').getByRole('radio', { name: 'Definition' }).click();
  await page.locator('dialog').getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#flashcard .face-front .face-label')).toHaveText('Definition');
  await page.click('#shuffle-btn');
  await expect(page.locator('#shuffle-btn')).toHaveAttribute('aria-pressed', 'true');
});

test('swipe gesture moves to next card', async ({ page }) => {
  await loadDeck(page);
  await page.click('[data-mode="flashcards"]');
  const box = await page.locator('#flashcard').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2, { steps: 4 });
  await page.mouse.move(box.x + box.width / 2 - 160, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('#flash-counter')).toHaveText(`2 / ${CARDS.length}`);
});

test('space flips even when a control button has focus (no double action)', async ({ page }) => {
  await loadDeck(page);
  await page.click('[data-mode="flashcards"]');
  await page.click('#next-btn');
  await expect(page.locator('#flash-counter')).toHaveText(`2 / ${CARDS.length}`);
  await page.locator('#next-btn').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#flashcard')).toHaveClass(/is-flipped/);
  await expect(page.locator('#flash-counter')).toHaveText(`2 / ${CARDS.length}`);
});
