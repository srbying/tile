import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { generateDailyPuzzle } from '../src/features/puzzle/daily-puzzle-generator';

test.use({ serviceWorkers: 'allow' });
test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright service-worker network interception is supported in Chromium only.');
});

const release = generateDailyPuzzle('2026-09-29');
const savedCopy = 'Using a saved puzzle from 2026-09-29. Today’s puzzle could not be loaded.';
const outage = { status: 503, contentType: 'text/html', body: '<h1>Hosting unavailable</h1>' };

async function installShell(page: Page) {
  await page.clock.install({ time: new Date('2026-09-29T16:00:00Z') });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Choose your mode' })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

for (const failure of ['offline', 'network', 429, 500, 503, 599] as const) {
  test(`reopens the cached shell on ${failure}, preserves progress, and recovers`, async ({ page, context }) => {
    let failing = false;
    let requests = 0;
    await context.route('**/*', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/puzzles/today') requests++;
      if (failing) {
        if (failure === 'offline') await route.continue();
        else if (failure === 'network') await route.abort('failed');
        else await route.fulfill({ ...outage, status: failure });
      } else if (path === '/api/puzzles/today') await route.fulfill({ json: release });
      else await route.continue();
    });
    await installShell(page);
    await page.getByRole('radio', { name: /^Easy / }).check();
    await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
    const board = page.getByRole('group', { name: 'Your tiles' }).getByRole('button');
    await board.nth(0).click();
    await board.nth(1).click();
    await page.getByRole('button', { name: 'Show hint', exact: true }).click();
    await expect(page.getByText('14 swaps left', { exact: true })).toBeVisible();
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('tile-puzzle-progress:v1')!));
    await page.close();

    failing = true;
    if (failure === 'offline') await context.setOffline(true);
    const reopened = await context.newPage();
    await reopened.clock.install({ time: new Date('2026-09-29T16:00:00Z') });
    const response = await reopened.goto('/');
    expect(response?.fromServiceWorker()).toBe(true);
    expect(response?.status()).toBe(200);
    await expect(reopened.getByRole('status').filter({ hasText: savedCopy })).toBeVisible();
    await expect(reopened.getByRole('contentinfo')).toContainText('2026-09-29');
    await expect(reopened.getByText('Easy mode', { exact: true })).toBeVisible();
    await expect(reopened.getByText('14 swaps left', { exact: true })).toBeVisible();
    await expect(reopened.getByRole('button', { name: 'Show hint', exact: true })).toBeDisabled();
    expect(await reopened.evaluate(() => JSON.parse(localStorage.getItem('tile-puzzle-progress:v1')!)))
      .toMatchObject({ puzzleId: release.puzzleId, board: before.board, tierId: 'easy', attemptsUsed: 1, hintUsed: true });
    // Repeated failed navigations must not replace the cached shell with an error page.
    await reopened.reload();
    await expect(reopened.getByText('14 swaps left', { exact: true })).toBeVisible();
    const requestsBeforeMoves = requests;
    const resumed = reopened.getByRole('group', { name: 'Your tiles' }).getByRole('button');
    await resumed.nth(2).click();
    await resumed.nth(3).click();
    await expect(reopened.getByText('13 swaps left', { exact: true })).toBeVisible();
    expect(requests).toBe(requestsBeforeMoves);

    failing = false;
    await context.setOffline(false);
    await reopened.reload();
    await expect(reopened.getByText('13 swaps left', { exact: true })).toBeVisible();
    await expect(reopened.getByText('Easy mode', { exact: true })).toBeVisible();
    await expect(reopened.getByRole('button', { name: 'Show hint', exact: true })).toBeDisabled();
    await expect(reopened.getByRole('status').filter({ hasText: 'Using a saved puzzle' })).toHaveCount(0);
  });
}

test('labels an older release honestly when both shell and current release fail', async ({ page, context }) => {
  let failing = false;
  await context.route('**/*', async route => {
    if (failing) await route.fulfill(outage);
    else if (new URL(route.request().url()).pathname === '/api/puzzles/today') await route.fulfill({ json: release });
    else await route.continue();
  });
  await installShell(page);
  await page.close();
  failing = true;
  const reopened = await context.newPage();
  await reopened.clock.install({ time: new Date('2026-09-30T16:00:00Z') });
  await reopened.goto('/');
  await expect(reopened.getByRole('status').filter({ hasText: savedCopy })).toBeVisible();
  await expect(reopened.getByRole('contentinfo')).toContainText('2026-09-29');
  await expect(reopened.getByText('Restore the saved pattern by swapping tiles.', { exact: true })).toBeVisible();
});

for (const cacheState of ['missing', 'invalid-json', 'invalid-release', 'future', 'unavailable-storage'] as const) {
  test(`cached shell retains accessible error and keyboard retry with ${cacheState} release cache`, async ({ page, context }) => {
    let failing = false;
    await context.route('**/*', async route => {
      if (failing) await route.fulfill(outage);
      else if (new URL(route.request().url()).pathname === '/api/puzzles/today') await route.fulfill({ json: release });
      else await route.continue();
    });
    await installShell(page);
    await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
    const board = page.getByRole('group', { name: 'Your tiles' }).getByRole('button');
    await board.nth(0).click();
    await board.nth(1).click();
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('tile-puzzle-progress:v1')!));
    const future = generateDailyPuzzle('2026-09-30');
    await page.evaluate(async ({ state, futureRelease }) => {
      const cache = await caches.open('tile-current-daily-puzzle-v1');
      const key = new URL('/__daily-puzzle-cache__/current', location.origin).href;
      if (state === 'missing') await cache.delete(key);
      else if (state !== 'unavailable-storage') await cache.put(key, new Response(
        state === 'invalid-json' ? '{ broken' : JSON.stringify(state === 'future' ? futureRelease : { puzzleId: 'invalid' }),
      ));
    }, { state: cacheState, futureRelease: future });
    await page.close();
    failing = true;
    const reopened = await context.newPage();
    await reopened.clock.install({ time: new Date('2026-09-29T16:00:00Z') });
    if (cacheState === 'unavailable-storage') await reopened.addInitScript(() => Object.defineProperty(window, 'caches', {
      value: { open: async () => { throw new Error('Storage unavailable'); } },
    }));
    const response = await reopened.goto('/');
    expect(response?.fromServiceWorker()).toBe(true);
    expect(response?.status()).toBe(200);
    await expect(reopened.getByRole('alert')).toContainText('We couldn’t load today’s puzzle');
    await expect(reopened.getByRole('alert')).toContainText('No puzzle could be loaded. Check your connection, then try again.');
    const after = await reopened.evaluate(() => JSON.parse(localStorage.getItem('tile-puzzle-progress:v1')!));
    expect(after).toMatchObject({ puzzleId: release.puzzleId, board: before.board, tierId: 'medium', attemptsUsed: 1, hintUsed: false });
    expect(after.elapsedMilliseconds).toBeGreaterThanOrEqual(before.elapsedMilliseconds);
    failing = false;
    const retry = reopened.getByRole('button', { name: 'Try again', exact: true });
    await reopened.keyboard.press('Tab');
    await expect(retry).toBeFocused();
    await reopened.keyboard.press('Enter');
    await expect(reopened.getByText('12 swaps left', { exact: true })).toBeVisible();
    await expect(reopened.getByText('Medium mode', { exact: true })).toBeVisible();
    await expect(reopened.getByRole('alert')).toHaveCount(0);
  });
}

for (const status of [401, 403, 404]) {
  test(`retains HTTP ${status} navigation instead of hiding it with the cached shell`, async ({ page, context }) => {
    await context.route('**/api/puzzles/today', route => route.fulfill({ json: release }));
    await installShell(page);
    await context.route('http://127.0.0.1:4173/', route => route.fulfill({ ...outage, status }));
    const response = await page.reload();
    expect(response?.fromServiceWorker()).toBe(true);
    expect(response?.status()).toBe(status);
    await expect(page.getByRole('heading', { name: 'Hosting unavailable' })).toBeVisible();
  });
}

test('retains the HTTP error when an installed worker has lost its shell cache', async ({ page, context }) => {
  await context.route('**/api/puzzles/today', route => route.fulfill({ json: release }));
  await installShell(page);
  await page.evaluate(async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('tile-app-shell-')) await caches.delete(name);
    }
  });
  await context.route('http://127.0.0.1:4173/', route => route.fulfill(outage));
  const response = await page.reload();
  expect(response?.fromServiceWorker()).toBe(true);
  expect(response?.status()).toBe(503);
  await expect(page.getByRole('heading', { name: 'Hosting unavailable' })).toBeVisible();
});

test('an uncached first visit retains the hosting error and recovers after reload', async ({ page, context }) => {
  await context.route('http://127.0.0.1:4173/', route => route.fulfill(outage));
  const response = await page.goto('/');
  expect(response?.fromServiceWorker()).toBe(false);
  expect(response?.status()).toBe(503);
  await expect(page.getByRole('heading', { name: 'Hosting unavailable' })).toBeVisible();
  expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
  expect(await page.evaluate(() => caches.keys())).toEqual([]);
  await context.unroute('http://127.0.0.1:4173/');
  await context.route('**/api/puzzles/today', route => route.fulfill({ json: release }));
  await page.clock.install({ time: new Date('2026-09-29T16:00:00Z') });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Choose your mode' })).toBeVisible();
});

test('an uncached first visit offline fails without presenting an app', async ({ page, context }) => {
  await context.setOffline(true);
  await expect(page.goto('/')).rejects.toThrow();
  await expect(page.getByRole('heading', { name: 'Choose your mode' })).toHaveCount(0);
});
