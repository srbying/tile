import { expect, test } from '@playwright/test';

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
  expect(release.generatorVersion).toBe(1);
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

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Daily Tile-Swap Puzzle/ })).toBeVisible();
  await expect(page.getByText(`DAILY Nº ${release.releaseDate}`)).toBeVisible();
  await page.getByRole('button', { name: 'Start puzzle' }).click();
  await expect(page.getByRole('list', { name: 'Target arrangement' }).getByRole('listitem')).toHaveCount(36);
  await expect(page.getByRole('group', { name: 'Your mosaic' }).getByRole('button')).toHaveCount(36);
});
