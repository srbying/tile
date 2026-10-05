import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test('serves a stable generated daily puzzle and starts gameplay with it', async ({ page }) => {
  const todayResponse = await page.request.get('/api/puzzles/today');
  expect(todayResponse.status()).toBe(200);
  expect(todayResponse.headers()['cache-control']).toBe('no-store');
  const release = await todayResponse.json() as {
    puzzleId: string;
    releaseDate: string;
    generatorVersion: number;
    puzzle: { id: string; target: unknown[]; start: unknown[]; attemptLimits: Record<string, number> };
  };
  expect(release.generatorVersion).toBe(2);
  expect(release.puzzleId).toBe(release.puzzle.id);
  expect(release.puzzle.target).toHaveLength(36);
  expect(release.puzzle.start).toHaveLength(36);
  expect(release.puzzle.attemptLimits).toEqual({ easy: 15, medium: 13, hard: 10 });

  const repeatedToday = await page.request.get('/api/puzzles/today');
  expect(await repeatedToday.json()).toEqual(release);

  const savedResponse = await page.request.get(`/api/puzzles/${release.puzzleId}`);
  expect(savedResponse.status()).toBe(200);
  expect(savedResponse.headers()['cache-control']).toContain('immutable');
  expect(await savedResponse.json()).toEqual(release);

  const malformedIdResponse = await page.request.get('/api/puzzles/%E0%A4%A');
  expect(malformedIdResponse.status()).toBe(404);
  expect(await malformedIdResponse.json()).toEqual({ error: 'Puzzle not found.' });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Daily Tile-Swap Puzzle/ })).toBeVisible();
  await expect(page.getByText(`DAILY Nº ${release.releaseDate}`)).toBeVisible();
  await page.getByRole('button', { name: 'Start puzzle' }).click();
  await expect(page.getByRole('list', { name: 'Target arrangement' }).getByRole('listitem')).toHaveCount(36);
  await expect(page.getByRole('group', { name: 'Your mosaic' }).getByRole('button')).toHaveCount(36);
});

test('replays v1 puzzle IDs after the v2 generator rollout', async ({ page }) => {
  const response = await page.request.get('/api/puzzles/daily-v1-2026-09-29-0-0');

  expect(response.status()).toBe(200);
  const release = await response.json() as {
    puzzleId: string;
    generatorVersion: number;
    puzzle: { id: string; target: unknown[]; start: unknown[] };
  };
  expect(release.generatorVersion).toBe(1);
  expect(release.puzzleId).toBe('daily-v1-2026-09-29-0-0');
  expect(release.puzzle.id).toBe(release.puzzleId);
  expect(release.puzzle.target).toHaveLength(36);
  expect(release.puzzle.start).toHaveLength(36);
});

test.describe('release date rollover', () => {
  test.use({ serviceWorkers: 'block' });

  test('loads the new release at midnight and drops the previous day’s saved progress', async ({ page }) => {
  const response = await page.request.get('/api/puzzles/today');
  const baseRelease = await response.json() as {
    puzzleId: string;
    releaseDate: string;
    generatorVersion: number;
    puzzle: { id: string; [key: string]: unknown };
    [key: string]: unknown;
  };
  const withDate = (date: string) => {
    const puzzleId = `daily-v2-${date}-0-0`;
    return {
      ...baseRelease,
      puzzleId,
      releaseDate: date,
      puzzle: { ...baseRelease.puzzle, id: puzzleId },
    };
  };
  const yesterday = withDate('2026-09-30');
  const today = withDate('2026-10-01');

  await page.clock.install({ time: new Date('2026-10-01T03:59:00.000Z') });
  let releaseRequests = 0;
  await page.route('**/api/puzzles/today', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(releaseRequests++ === 0 ? yesterday : today),
  }));

  await page.goto('/');
  await expect(page.getByText('DAILY Nº 2026-09-30')).toBeVisible();
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
  const board = page.getByRole('group', { name: 'Your mosaic' }).getByRole('button');
  await board.nth(0).click();
  await board.nth(1).click();
  await expect(page.getByText('12 of 13 swaps remaining', { exact: true })).toBeVisible();

  await page.clock.fastForward(60_000);

  await expect(page.getByText('DAILY Nº 2026-10-01')).toBeVisible();
  await expect(page.getByText('13 of 13 swaps remaining', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('tile-puzzle-progress:v1'))).toBeNull();
  });
});

test('retries a stale cached release when the page resumes after midnight', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright Cache Storage failure fallback is exercised in Chromium only.');
  const response = await page.request.get('/api/puzzles/today');
  const baseRelease = await response.json() as {
    puzzleId: string;
    releaseDate: string;
    generatorVersion: number;
    puzzle: { id: string; [key: string]: unknown };
    [key: string]: unknown;
  };
  const withDate = (date: string) => {
    const puzzleId = `daily-v2-${date}-0-0`;
    return {
      ...baseRelease,
      puzzleId,
      releaseDate: date,
      puzzle: { ...baseRelease.puzzle, id: puzzleId },
    };
  };
  const yesterday = withDate('2026-09-30');
  const today = withDate('2026-10-01');

  await page.clock.install({ time: new Date('2026-10-01T03:59:00.000Z') });
  let releaseRequests = 0;
  await page.route('**/api/puzzles/today', async (route) => {
    const requestNumber = releaseRequests++;
    if (requestNumber === 1) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(requestNumber === 0 ? yesterday : today),
    });
  });

  await page.goto('/');
  await expect(page.getByText('DAILY Nº 2026-09-30')).toBeVisible();
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
  const board = page.getByRole('group', { name: 'Your mosaic' }).getByRole('button');
  await board.nth(0).click();
  await board.nth(1).click();
  await expect(page.getByText('12 of 13 swaps remaining', { exact: true })).toBeVisible();

  await page.clock.setSystemTime(new Date('2026-10-01T04:00:00.000Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  await expect.poll(() => releaseRequests).toBe(2);
  await expect(page.getByText('Cached copy · 2026-09-30', { exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));

  await expect(page.getByText('DAILY Nº 2026-10-01')).toBeVisible();
  await expect(page.getByText('13 of 13 swaps remaining', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('tile-puzzle-progress:v1'))).toBeNull();
});

test('keeps the app and current puzzle playable after going offline', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright service-worker offline interception is supported in Chromium only.');
  const todayResponse = await page.request.get('/api/puzzles/today');
  const release = await todayResponse.json() as { releaseDate: string };

  await page.goto('/');
  await expect(page.getByText(`DAILY Nº ${release.releaseDate}`)).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Choose your mode' })).toBeVisible();
  await expect(page.getByText(`DAILY Nº ${release.releaseDate}`)).toBeVisible();
  await expect(page.getByText(`Cached copy · ${release.releaseDate}`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
  const board = page.getByRole('group', { name: 'Your mosaic' }).getByRole('button');
  await board.nth(0).click();
  await board.nth(1).click();
  await expect(page.getByText('12 of 13 swaps remaining', { exact: true })).toBeVisible();
});

test('restores current-release progress from the cached puzzle while offline', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright service-worker offline interception is supported in Chromium only.');
  const todayResponse = await page.request.get('/api/puzzles/today');
  const release = await todayResponse.json() as { puzzleId: string; releaseDate: string };

  await page.goto('/');
  await expect(page.getByText(`DAILY Nº ${release.releaseDate}`)).toBeVisible();
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
  const board = page.getByRole('group', { name: 'Your mosaic' }).getByRole('button');
  await board.nth(0).click();
  await board.nth(1).click();
  await expect(page.getByText('12 of 13 swaps remaining', { exact: true })).toBeVisible();

  const savedProgress = await page.evaluate(() => JSON.parse(localStorage.getItem('tile-puzzle-progress:v1')!));
  expect(savedProgress.puzzleId).toBe(release.puzzleId);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await context.setOffline(true);
  await page.reload();

  await expect(page.getByText('12 of 13 swaps remaining', { exact: true })).toBeVisible();
  await expect(page.getByText(`Cached copy · ${release.releaseDate}`, { exact: true })).toBeVisible();
  const resumedBoard = page.getByRole('group', { name: 'Your mosaic' }).getByRole('button');
  await resumedBoard.nth(2).click();
  await resumedBoard.nth(3).click();
  await expect(page.getByText('11 of 13 swaps remaining', { exact: true })).toBeVisible();
});
