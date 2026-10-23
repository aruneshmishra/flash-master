import { test, expect } from '@playwright/test';
import { watchErrors, loadDeck, answerFor, CARDS, noHorizontalScroll } from './helpers.js';

test('full marks on a mixed test', async ({ page }) => {
  const errs = watchErrors(page);
  await loadDeck(page);
  await page.click('[data-mode="test"]');
  await expect(page.locator('#test-setup')).toBeVisible();
  await page.fill('#test-count', String(CARDS.length));
  await page.locator('#test-count').blur();
  await page.click('#start-test');
  const qs = page.locator('.test-q');
  const n = await qs.count();
  for (let i = 0; i < n; i++) {
    const q = qs.nth(i);
    const kind = await q.getAttribute('data-kind');
    if (kind === 'tf') {
      const [prompt, shown] = (await q.locator('.tq-text').allTextContents()).map((s) => s.trim());
      await q.getByRole('button', { name: answerFor(prompt) === shown ? 'True' : 'False' }).click();
    } else if (kind === 'mc') {
      const prompt = (await q.locator('.tq-text').first().textContent()).trim();
      await q.locator('.choice', { hasText: answerFor(prompt) }).click();
    } else if (kind === 'match') {
      const items = q.locator('.match-prompts li');
      for (let j = 0; j < await items.count(); j++) {
        const prompt = (await items.nth(j).locator('.tq-text').textContent()).trim();
        await items.nth(j).locator('select').selectOption(answerFor(prompt));
      }
    } else {
      const prompt = (await q.locator('.tq-text').textContent()).trim();
      await q.locator('input').fill(answerFor(prompt));
    }
  }
  await expect(page.locator('#answered-count')).toHaveText(String(CARDS.length));
  await noHorizontalScroll(page);
  await page.click('#submit-test');
  await expect(page.locator('#score-pct')).toHaveText('100%');
  await expect(page.locator('.review-item.bad')).toHaveCount(0);
  await expect(page.locator('#retake-missed')).toHaveCount(0);
  errs.assertClean();
});

test('submitting a blank test warns, scores 0, and offers a retake of missed cards', async ({ page }) => {
  await loadDeck(page);
  await page.click('[data-mode="test"]');
  await page.click('#start-test');
  await page.click('#submit-test');
  await expect(page.locator('dialog')).toContainText('You skipped');
  await page.locator('dialog').getByRole('button', { name: 'Submit' }).click();
  await expect(page.locator('#score-pct')).toHaveText('0%');
  await expect(page.locator('.review-item.bad').first()).toContainText('Skipped');
  await page.click('#retake-missed');
  await expect(page.locator('.test-q').first()).toBeVisible();
});

test('setup requires at least one question type', async ({ page }) => {
  await loadDeck(page);
  await page.click('[data-mode="test"]');
  for (const name of ['True or false', 'Multiple choice', 'Matching', 'Written']) {
    await page.locator('.switch-row', { hasText: name }).click();
  }
  await page.click('#start-test');
  await expect(page.locator('#test-setup .form-status.error')).toContainText('at least one');
});
