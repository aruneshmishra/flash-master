import { test, expect } from '@playwright/test';
import { watchErrors, loadDeck, answerFor, CARDS, noHorizontalScroll } from './helpers.js';

const HINT_ROWS = [['Term', 'Definition', 'Hint'], ...CARDS.map(([t, d], i) => [t, d, i === 0 ? 'Think about sunlight' : ''])];

test('streak badge counts study and the daily goal dialog opens', async ({ page }) => {
  const errs = watchErrors(page);
  await loadDeck(page);
  await expect(page.locator('#streak-num')).toHaveText('0');
  await page.click('[data-mode="flashcards"]');
  await page.click('#track-toggle');
  await page.click('#know-btn');
  await page.click('#know-btn');
  await expect(page.locator('#streak-num')).toHaveText('1');
  await page.click('#streak-btn');
  await expect(page.locator('#streak-days')).toHaveText('1 day');
  await expect(page.locator('dialog')).toContainText('2 / 20 today');
  await page.locator('dialog').getByRole('radio', { name: '10' }).click();
  await page.locator('dialog').getByRole('button', { name: 'Done' }).click();
  await page.reload();
  await page.click('#streak-btn');
  await expect(page.locator('dialog')).toContainText('2 / 10 today');
  errs.assertClean();
});

test('spaced review: banner shows due cards and the review session completes', async ({ page }) => {
  const errs = watchErrors(page);
  await loadDeck(page);
  const deckId = decodeURIComponent(page.url().split('#/deck/')[1]);
  // Pretend two cards were mastered a while ago and are now due.
  await page.evaluate((id) => {
    const deck = JSON.parse(localStorage.getItem(`fm:deck:${id}`));
    const p = JSON.parse(localStorage.getItem(`fm:progress:${id}`) || '{}');
    p.learn = {}; p.srs = {};
    for (const c of deck.cards.slice(0, 2)) { p.learn[c.id] = { level: 2, seen: 2, correct: 2, wrong: 0 }; p.srs[c.id] = { box: 2, due: Date.now() - 86400000 }; }
    localStorage.setItem(`fm:progress:${id}`, JSON.stringify(p));
  }, deckId);
  await page.reload();
  await expect(page.locator('#review-banner')).toContainText('2 cards due for review');
  await page.click('#review-banner');
  await page.keyboard.press('Space');
  await expect(page.locator('#revealed-answer')).toBeVisible();
  await page.click('#remembered-btn');
  await page.click('#show-answer-btn');
  await page.click('#forgot-btn');
  // a forgotten card gets one more look in the same session
  await page.click('#show-answer-btn');
  await page.click('#remembered-btn');
  await expect(page.locator('#review-done')).toContainText('You remembered 1 of 2');
  await page.getByRole('link', { name: 'Back to deck' }).click();
  await expect(page.locator('#review-banner')).toHaveCount(0);
  await expect(page.locator('#next-review')).toContainText('tomorrow');
  errs.assertClean();
});

test('mastering a card in Learn enrolls it in spaced review', async ({ page }) => {
  await loadDeck(page);
  const deckId = decodeURIComponent(page.url().split('#/deck/')[1]);
  await page.evaluate((id) => {
    const deck = JSON.parse(localStorage.getItem(`fm:deck:${id}`));
    const p = { learn: {}, srs: {} };
    for (const c of deck.cards) p.learn[c.id] = { level: 1, seen: 1, correct: 1, wrong: 0 };
    localStorage.setItem(`fm:progress:${id}`, JSON.stringify(p));
  }, deckId);
  await page.click('[data-mode="learn"]');
  const prompt = (await page.locator('#q-text').textContent()).trim();
  await page.fill('#answer-input', answerFor(prompt));
  await page.press('#answer-input', 'Enter');
  await expect(page.locator('.q-card')).toHaveClass(/answered-right/);
  const enrolled = await page.evaluate((id) => Object.keys(JSON.parse(localStorage.getItem(`fm:progress:${id}`)).srs).length, deckId);
  expect(enrolled).toBe(1);
});

test('hint column shows a hint link in Learn and on flashcards', async ({ page }) => {
  await loadDeck(page, HINT_ROWS);
  await page.click('[data-mode="flashcards"]');
  await page.locator('#flashcard .face-front .hint-btn').click();
  await expect(page.locator('#flashcard .face-front .hint-text')).toHaveText('Think about sunlight');
  await expect(page.locator('#flashcard')).not.toHaveClass(/is-flipped/);
  await page.click('[href$="/learn"]');
  for (let i = 0; i < CARDS.length; i++) {
    const prompt = (await page.locator('#q-text').textContent()).trim();
    if (prompt === CARDS[0][0]) {
      await page.click('.hint-btn');
      await expect(page.locator('.hint-text')).toContainText('sunlight');
      return;
    }
    await expect(page.locator('.hint-btn')).toHaveCount(0);
    await page.locator('.choice', { hasText: answerFor(prompt) }).click();
    await expect(page.locator('#q-text')).not.toHaveText(prompt, { timeout: 5000 });
  }
  throw new Error('hinted card never came up');
});

test('spell questions read the answer aloud and accept the typed spelling', async ({ page }) => {
  await page.addInitScript(() => {
    window.__spoken = [];
    if (window.speechSynthesis) window.speechSynthesis.speak = (u) => window.__spoken.push(u.text);
  });
  await loadDeck(page);
  const deckId = decodeURIComponent(page.url().split('#/deck/')[1]);
  await page.evaluate((id) => {
    const deck = JSON.parse(localStorage.getItem(`fm:deck:${id}`));
    const p = { learn: {}, srs: {}, prefs: { learn: { spell: true, mc: false, written: true, answerWith: 'term' } } };
    for (const c of deck.cards) p.learn[c.id] = { level: 1, seen: 1, correct: 1, wrong: 0 };
    localStorage.setItem(`fm:progress:${id}`, JSON.stringify(p));
  }, deckId);
  await page.click('[data-mode="learn"]');
  let sawSpell = false;
  for (let i = 0; i < CARDS.length && !sawSpell; i++) {
    const type = await page.locator('.q-card').getAttribute('data-type');
    const prompt = (await page.locator('#q-text').textContent()).trim();
    if (type === 'spell') {
      await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBeGreaterThan(0);
      const heard = await page.evaluate(() => window.__spoken.at(-1));
      expect(heard).toBe(answerFor(prompt));
      await page.fill('#answer-input', heard.toLowerCase());
      await page.press('#answer-input', 'Enter');
      await expect(page.locator('.q-card')).toHaveClass(/answered-right/);
      sawSpell = true;
    } else {
      await page.fill('#answer-input', answerFor(prompt));
      await page.press('#answer-input', 'Enter');
      await page.click('#continue-btn').catch(() => {});
      await expect(page.locator('#q-text')).not.toHaveText(prompt, { timeout: 5000 }).catch(() => {});
    }
  }
  expect(sawSpell).toBe(true);
});

test('study two decks together from the home page', async ({ page }) => {
  const errs = watchErrors(page);
  await page.goto('/');
  await page.click('[data-sample="sample-space"]');
  await page.goto('/#/');
  await page.click('[data-sample="sample-elements"]');
  await page.goto('/#/');
  await page.click('#together-btn');
  await expect(page.locator('#together-go')).toBeDisabled();
  await page.locator('.deck-card[data-deck="sample-space"] .pick-wrap').click();
  await page.locator('.deck-card[data-deck="sample-elements"] .pick-wrap').click();
  await expect(page.locator('#together-count')).toHaveText('2 decks picked');
  await page.click('#together-go');
  await expect(page.locator('.deck-meta')).toContainText('Combined from 2 decks');
  await expect(page.locator('.term-row')).toHaveCount(28);
  await noHorizontalScroll(page);
  errs.assertClean();
});

test('games: Meteor scores points and ends after three misses', async ({ page }) => {
  const errs = watchErrors(page);
  await loadDeck(page);
  await page.click('[data-mode="games"]');
  await expect(page.locator('[data-game="match"]')).toBeVisible();
  await page.click('[data-game="meteor"]');
  await page.click('#start-meteor');
  for (let i = 0; i < 2; i++) {
    const prompt = (await page.locator('#meteor .meteor-text').textContent()).trim();
    await page.locator('.meteor-choices .choice', { hasText: answerFor(prompt) }).click();
    await expect(page.locator('#meteor-score')).not.toHaveText('0');
    await page.waitForTimeout(600);
  }
  await noHorizontalScroll(page);
  for (let i = 0; i < 3; i++) {
    const prompt = (await page.locator('#meteor .meteor-text').textContent()).trim();
    await page.locator('.meteor-choices .choice:not([disabled])', { hasNotText: answerFor(prompt) }).first().click();
    await page.waitForTimeout(100);
  }
  await expect(page.locator('#meteor-done')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#meteor-final')).toHaveText(/[1-9]\d* pts/);
  errs.assertClean();
});
