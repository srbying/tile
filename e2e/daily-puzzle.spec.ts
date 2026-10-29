import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test('serves a stable generated daily puzzle and starts gameplay with it', async ({ page }) => {
  const todayResponse = await page.request.get('/api/puzzles/today');
  expect(todayResponse.status()).toBe(200);
  expect(todayResponse.headers()['cache-control']).toBe('no-store');
  expect(todayResponse.headers()['cdn-cache-control'])
    .toMatch(/^public, s-maxage=\d+, must-revalidate, stale-while-revalidate=0, stale-if-error=0$/);
  expect(Date.parse(todayResponse.headers()['expires']!))
    .toBeGreaterThan(Date.parse(todayResponse.headers()['date']!));
  const release = await todayResponse.json() as {
    puzzleId: string;
    releaseDate: string;
    generatorVersion: number;
    puzzle: { id: string; target: unknown[]; start: unknown[]; attemptLimits: Record<string, number> };
  };
  expect(release.generatorVersion).toBe(3);
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

  const dailyRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/puzzles/today');
  await page.goto('/');
  const requestHeaders = (await dailyRequest).headers();
  expect(requestHeaders['cache-control'] ?? '').not.toMatch(/no-cache|no-store/);
  expect(requestHeaders['pragma'] ?? '').not.toContain('no-cache');
  await expect(page.getByRole('heading', { name: /Daily Tile-Swap Puzzle/ })).toBeVisible();
  for (const mode of ['Easy', 'Medium', 'Hard']) {
    await page.getByRole('radio', { name: new RegExp(`^${mode}\\b`) }).check();
    await expect(page.getByRole('contentinfo')).toContainText(release.releaseDate);
  }
  await page.getByRole('button', { name: 'Start puzzle' }).click();
  await expect(page.getByRole('list', { name: 'Target pattern' }).getByRole('listitem')).toHaveCount(36);
  await expect(page.getByRole('group', { name: 'Your tiles' }).getByRole('button')).toHaveCount(36);
});

test.describe('online cache validation', () => {
  test.use({ serviceWorkers: 'block' });

  test('rejects a stale CDN reply and restores today’s saved round on retry', async ({ page }) => {
    const response = await page.request.get('/api/puzzles/today');
    const release = await response.json();
    const previousDate = new Date(Date.parse(`${release.releaseDate}T00:00:00Z`) - 86400000)
      .toISOString().slice(0, 10);
    const previousId = release.puzzleId.replace(release.releaseDate, previousDate);
    const staleRelease = {
      ...release,
      puzzleId: previousId,
      releaseDate: previousDate,
      puzzle: { ...release.puzzle, id: previousId },
    };
    await page.clock.setFixedTime(new Date(`${release.releaseDate}T12:00:00Z`));
    let serveStale = false;
    await page.route('**/api/puzzles/today', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(serveStale ? staleRelease : release),
    }));
    await page.goto('/');
    await page.getByRole('radio', { name: /^Hard\b/ }).check();
    await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
    const tiles = page.getByRole('group', { name: 'Your tiles' }).getByRole('button');
    await tiles.nth(0).click();
    await tiles.nth(1).click();
    await page.getByRole('button', { name: 'Show hint', exact: true }).click();
    await expect(page.getByText('9 swaps left', { exact: true })).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tile-puzzle-progress:v1')!));

    serveStale = true;
    // With no offline copy, a wrong-date CDN reply must show error and retry.
    await page.evaluate(async () => { await caches.delete('tile-current-daily-puzzle-v1'); });
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('We couldn’t load today’s puzzle');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tile-puzzle-progress:v1')!)))
      .toMatchObject({ puzzleId: saved.puzzleId, tierId: 'hard', attemptsUsed: 1, hintUsed: true, board: saved.board });

    serveStale = false;
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByRole('contentinfo')).toContainText(release.releaseDate);
    await expect(page.getByText('9 swaps left', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show hint', exact: true })).toBeDisabled();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tile-puzzle-progress:v1')!)))
      .toMatchObject({ puzzleId: saved.puzzleId, tierId: 'hard', attemptsUsed: 1, hintUsed: true, board: saved.board });
  });
});

test('replays v1 puzzle IDs after the v3 generator rollout', async ({ page }) => {
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
    const puzzleId = `daily-v${baseRelease.generatorVersion}-${date}-0-0`;
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
  await expect(page.getByRole('contentinfo')).toContainText('2026-09-30');
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
  const board = page.getByRole('group', { name: 'Your tiles' }).getByRole('button');
  await board.nth(0).click();
  await board.nth(1).click();
  await expect(page.getByText('12 swaps left', { exact: true })).toBeVisible();

  await page.clock.fastForward(60_000);

  await expect(page.getByRole('contentinfo')).toContainText('2026-10-01');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('tile-puzzle-progress:v1'))).toBeNull();
  await expect(page.getByRole('heading', { name: 'Choose your mode' })).toBeVisible();
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
  await expect(page.getByText('13 swaps left', { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Your tiles' }).getByRole('button')).toHaveCount(36);
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
    const puzzleId = `daily-v${baseRelease.generatorVersion}-${date}-0-0`;
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
  await expect(page.getByRole('contentinfo')).toContainText('2026-09-30');
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
  const board = page.getByRole('group', { name: 'Your tiles' }).getByRole('button');
  await board.nth(0).click();
  await board.nth(1).click();
  await expect(page.getByText('12 swaps left', { exact: true })).toBeVisible();

  await page.clock.setSystemTime(new Date('2026-10-01T04:00:00.000Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  await expect.poll(() => releaseRequests).toBe(2);
  await expect(page.getByRole('status').filter({ hasText: 'Using a saved puzzle from 2026-09-30.' })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));

  await expect(page.getByRole('contentinfo')).toContainText('2026-10-01');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('tile-puzzle-progress:v1'))).toBeNull();
  await expect(page.getByRole('heading', { name: 'Choose your mode' })).toBeVisible();
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
  await expect(page.getByText('13 swaps left', { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Your tiles' }).getByRole('button')).toHaveCount(36);
});

test('keeps the app and current puzzle playable after going offline', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright service-worker offline interception is supported in Chromium only.');
  const todayResponse = await page.request.get('/api/puzzles/today');
  const release = await todayResponse.json() as { releaseDate: string };

  await page.goto('/');
  await expect(page.getByRole('contentinfo')).toContainText(release.releaseDate);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Choose your mode' })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toContainText(release.releaseDate);
  await expect(page.getByRole('status').filter({ hasText: `Using a saved puzzle from ${release.releaseDate}.` })).toBeVisible();
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
  const board = page.getByRole('group', { name: 'Your tiles' }).getByRole('button');
  await board.nth(0).click();
  await board.nth(1).click();
  await expect(page.getByText('12 swaps left', { exact: true })).toBeVisible();
});

test('restores current-release progress from the cached puzzle while offline', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright service-worker offline interception is supported in Chromium only.');
  const todayResponse = await page.request.get('/api/puzzles/today');
  const release = await todayResponse.json() as { puzzleId: string; releaseDate: string };

  await page.goto('/');
  await expect(page.getByRole('contentinfo')).toContainText(release.releaseDate);
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
  const board = page.getByRole('group', { name: 'Your tiles' }).getByRole('button');
  await board.nth(0).click();
  await board.nth(1).click();
  await expect(page.getByText('12 swaps left', { exact: true })).toBeVisible();

  const savedProgress = await page.evaluate(() => JSON.parse(localStorage.getItem('tile-puzzle-progress:v1')!));
  expect(savedProgress.puzzleId).toBe(release.puzzleId);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await context.setOffline(true);
  await page.reload();

  await expect(page.getByText('12 swaps left', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: `Using a saved puzzle from ${release.releaseDate}.` })).toBeVisible();
  const resumedBoard = page.getByRole('group', { name: 'Your tiles' }).getByRole('button');
  await resumedBoard.nth(2).click();
  await resumedBoard.nth(3).click();
  await expect(page.getByText('11 swaps left', { exact: true })).toBeVisible();
});
