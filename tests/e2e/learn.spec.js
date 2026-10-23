import { test, expect } from '@playwright/test';
import { watchErrors, loadDeck, answerFor, CARDS, noHorizontalScroll } from './helpers.js';

async function answerCurrent(page, { wrong = false } = {}) {
  const card = page.locator('.q-card');
  await expect(card).toBeVisible();
  const type = await card.getAttribute('data-type');
  const prompt = (await page.locator('#q-text').textContent()).trim();
  const answer = answerFor(prompt);
  if (type === 'mc') {
    if (wrong) await page.locator('.choice', { hasNotText: answer }).first().click();
    else await page.locator('.choice', { hasText: answer }).click();
  } else if (type === 'written') {
    await page.fill('#answer-input', wrong ? 'no idea at all' : answer.toUpperCase());
    await page.press('#answer-input', 'Enter');
  } else {
    await page.click('#reveal-btn');
    await page.click(wrong ? '#judge-no' : '#judge-yes');
  }
  return type;
}

async function advance(page) {
  // Correct MC auto-advances; otherwise press Continue.
  const btn = page.locator('#continue-btn');
  if (await btn.isVisible()) await btn.click().catch(() => {});
}

test('learn mode: rounds, written answers, mastery and completion', async ({ page }) => {
  const errs = watchErrors(page);
  await loadDeck(page);
  await page.click('[data-mode="learn"]');
  const types = new Set();
  for (let i = 0; i < 60; i++) {
    if (await page.locator('#learn-done').isVisible()) break;
    if (await page.locator('#round-done').isVisible()) { await page.click('#next-round-btn'); continue; }
    if (await page.locator('.q-card:not(.answered-right):not(.answered-wrong)').isVisible()) {
      types.add(await answerCurrent(page));
      await noHorizontalScroll(page);
    }
    await advance(page);
    await page.waitForTimeout(50);
  }
  await expect(page.locator('#learn-done')).toBeVisible();
  expect([...types].sort()).toEqual(['mc', 'written']);
  // progress persists to the deck page
  await page.locator('.back-link').click();
  await expect(page.locator('.big-pct')).toHaveText('100%');
  errs.assertClean();
});

test('wrong typed answer can be overridden, and the round summary appears', async ({ page }) => {
  await loadDeck(page);
  await page.click('[data-mode="learn"]');
  await page.click('#learn-settings');
  await page.locator('dialog .switch-row', { hasText: 'Multiple choice' }).click();
  await page.locator('dialog').getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.q-card')).toHaveAttribute('data-type', 'written');
  await answerCurrent(page, { wrong: true });
  await expect(page.locator('#correct-answer')).toBeVisible();
  await page.click('#override-btn');
  await expect(page.locator('.q-card')).toHaveClass(/answered-right/);
  await page.click('#continue-btn');
  // "Don't know" reveals the answer
  await page.click('#dont-know');
  await expect(page.locator('#correct-answer')).toBeVisible();
});

test('multiple choice works with number keys and shows the right answer when wrong', async ({ page }) => {
  await loadDeck(page);
  await page.click('[data-mode="learn"]');
  await expect(page.locator('.q-card')).toHaveAttribute('data-type', 'mc');
  const prompt = (await page.locator('#q-text').textContent()).trim();
  const answer = answerFor(prompt);
  const texts = await page.locator('.choice .choice-text').allTextContents();
  const wrongIdx = texts.findIndex((t) => t !== answer);
  await page.keyboard.press(String(wrongIdx + 1));
  await expect(page.locator('.choice.wrong')).toHaveCount(1);
  await expect(page.locator('.choice.correct')).toContainText(answer);
  await page.keyboard.press('Enter');
  await expect(page.locator('.q-card:not(.answered-wrong)')).toBeVisible();
});

test('progress is saved between visits', async ({ page }) => {
  await loadDeck(page);
  await page.click('[data-mode="learn"]');
  await answerCurrent(page);
  await page.waitForTimeout(1200);
  await page.goto(page.url().replace(/\/learn$/, ''));
  await expect(page.locator('.mastery-legend')).toContainText('1 still learning');
  expect(CARDS.length).toBeGreaterThan(1);
});
