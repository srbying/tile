import { expect, test } from '@playwright/test';
import { generateDailyPuzzle } from '../src/features/puzzle/daily-puzzle-generator';

test.use({ serviceWorkers: 'block' });

const release = generateDailyPuzzle('2026-09-29');
const savedCopy = 'Using a saved puzzle from 2026-09-29. Today’s puzzle could not be loaded.';

test('dates and announces an older fallback, preserves the round, and avoids automatic retries', async ({ page, browserName }) => {
  await page.clock.install({ time: new Date('2026-09-29T16:00:00Z') });
  let failing = false;
  let requests = 0;
  await page.route('**/api/puzzles/today', async route => {
    requests++;
    await route.fulfill(failing ? { status: 429 } : { json: release });
  });
  await page.goto('/');
  await page.getByRole('radio', { name: /^Easy / }).check();
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
  const board = page.getByRole('group', { name: 'Your tiles' }).getByRole('button');
  await board.nth(0).click();
  await board.nth(1).click();
  await expect(page.getByText('14 swaps left', { exact: true })).toBeVisible();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('tile-puzzle-progress:v1')!));

  failing = true;
  const requestsBeforeFailure = requests;
  await page.clock.setSystemTime(new Date('2026-09-30T16:00:00Z'));
  // WebKit's ephemeral test storage loses cached responses on navigation.
  // Exercise a cold return in Chromium and a resumed page in WebKit.
  if (browserName === 'chromium') await page.reload();
  else await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  await expect(page.getByRole('status').filter({ hasText: savedCopy })).toBeVisible();
  await expect(page.getByText('14 swaps left', { exact: true })).toBeVisible();
  await expect(page.getByText('Easy mode', { exact: true })).toBeVisible();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('tile-puzzle-progress:v1')!));
  expect(after).toMatchObject({ board: before.board, tierId: 'easy', attemptsUsed: 1 });
  await page.clock.fastForward(60_000);
  expect(requests - requestsBeforeFailure).toBe(1);
  await board.nth(2).click();
  await board.nth(3).click();
  await expect(page.getByText('13 swaps left', { exact: true })).toBeVisible();
  expect(requests - requestsBeforeFailure).toBe(1);
  await page.getByRole('button', { name: 'Choose mode', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: savedCopy })).toBeVisible();
  await expect(page.getByText('Restore the saved pattern by swapping tiles.', { exact: true })).toBeVisible();
});

test('an older cached fallback does not erase a newer saved round', async ({ page }) => {
  const newerRelease = generateDailyPuzzle('2026-09-30');
  await page.clock.install({ time: new Date('2026-09-30T16:00:00Z') });
  let failing = false;
  await page.route('**/api/puzzles/today', route => route.fulfill(failing ? { status: 503 } : { json: newerRelease }));
  await page.goto('/');
  await page.getByRole('radio', { name: /^Hard / }).check();
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
  const board = page.getByRole('group', { name: 'Your tiles' }).getByRole('button');
  await board.nth(0).click();
  await board.nth(1).click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('tile-puzzle-progress:v1')!));
  await page.evaluate(async saved => {
    const cache = await caches.open('tile-current-daily-puzzle-v1');
    await cache.put(new URL('/__daily-puzzle-cache__/current', location.origin).href, new Response(JSON.stringify(saved)));
  }, release);
  failing = true;
  await page.clock.setSystemTime(new Date('2026-10-01T16:00:00Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('status').filter({ hasText: savedCopy })).toBeVisible();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('tile-puzzle-progress:v1')!));
  expect(after).toMatchObject({ puzzleId: newerRelease.puzzleId, board: before.board, tierId: 'hard', attemptsUsed: 1 });
});

test('a first visit times out with an accessible error and supports keyboard retry', async ({ page, browserName }) => {
  await page.clock.install({ time: new Date('2026-09-29T16:00:00Z') });
  let requests = 0;
  let recover = false;
  await page.route('**/api/puzzles/today', async route => {
    requests++;
    if (recover) await route.fulfill({ json: release });
    // Leave the first request pending to exercise the browser's deadline.
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('Loading today’s puzzle…');
  await page.clock.fastForward(10_000);

  await expect(page.getByRole('alert')).toContainText('We couldn’t load today’s puzzle');
  await expect(page.getByRole('alert')).toContainText('No puzzle could be loaded. Check your connection, then try again.');
  await page.clock.fastForward(60_000);
  expect(requests).toBe(1);
  recover = true;
  const retry = page.getByRole('button', { name: 'Try again', exact: true });
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(retry).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Choose your mode' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(requests).toBe(2);
});

for (const cacheState of ['missing', 'invalid-json', 'invalid-release', 'unavailable-storage']) {
  test(`preserves progress and results through ${cacheState} cache failure and retry`, async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-29T16:00:00Z') });
    let failing = false;
    await page.route('**/api/puzzles/today', route => route.fulfill(failing ? { status: 503 } : { json: release }));
    await page.goto('/');
    await page.getByRole('radio', { name: /^Hard / }).check();
    await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
    const board = page.getByRole('group', { name: 'Your tiles' }).getByRole('button');
    for (let attempt = 0; attempt < 10; attempt++) {
      await board.nth(0).click();
      await board.nth(1).click();
    }
    await expect(page.getByText('No match after 10 swaps', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Choose another mode', exact: true }).click();
    await page.getByRole('radio', { name: /^Easy / }).check();
    await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
    await board.nth(0).click();
    await board.nth(1).click();
    await page.getByRole('button', { name: 'Show hint', exact: true }).click();
    const before = await page.evaluate(() => ({
      progress: JSON.parse(localStorage.getItem('tile-puzzle-progress:v1')!),
      completions: localStorage.getItem('tile-puzzle-completions:v1'),
    }));

    if (cacheState === 'unavailable-storage') {
      await page.addInitScript(() => Object.defineProperty(window, 'caches', {
        value: { open: async () => { throw new Error('Storage unavailable'); } },
      }));
    } else {
      await page.evaluate(async state => {
        const cache = await caches.open('tile-current-daily-puzzle-v1');
        const key = new URL('/__daily-puzzle-cache__/current', location.origin).href;
        if (state === 'missing') await cache.delete(key);
        else await cache.put(key, new Response(state === 'invalid-json' ? '{ broken' : JSON.stringify({ puzzleId: 'invalid' })));
      }, cacheState);
    }
    failing = true;
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('We couldn’t load today’s puzzle');
    const after = await page.evaluate(() => ({
      progress: JSON.parse(localStorage.getItem('tile-puzzle-progress:v1')!),
      completions: localStorage.getItem('tile-puzzle-completions:v1'),
    }));
    expect(after.progress).toMatchObject({
      board: before.progress.board, tierId: 'easy', attemptsUsed: 1, hintUsed: true,
    });
    expect(after.completions).toBe(before.completions);

    failing = false;
    await page.getByRole('button', { name: 'Try again', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Easy mode', { exact: true })).toBeVisible();
    await expect(page.getByText('14 swaps left', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show hint', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Choose mode', exact: true }).click();
    await page.getByRole('radio', { name: /^Hard / }).check();
    await page.getByRole('button', { name: 'Review finished puzzle', exact: true }).click();
    await expect(page.getByText('No match after 10 swaps', { exact: true })).toBeVisible();
  });
}
