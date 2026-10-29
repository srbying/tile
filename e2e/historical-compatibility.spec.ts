import { expect, test } from '@playwright/test';
import { dailyPuzzleFromId, generateDailyPuzzle } from '../src/features/puzzle/daily-puzzle-generator';
import { buildDifficultyPuzzle } from '../src/features/puzzle/difficulty-preview';

for (const version of [1, 2, 3]) {
  test(`reload preserves a supported v${version} round across generator rollout`, async ({ page }) => {
    const release = dailyPuzzleFromId(`daily-v${version}-2026-10-19-16-0`)!;
    const saved = {
      version: 1, puzzleId: release.puzzleId, tierId: 'hard',
      board: buildDifficultyPuzzle(release.puzzle, 'hard').start,
      attemptsUsed: 2, hintUsed: true, hintedPositions: null, elapsedMilliseconds: 12345,
    };
    await page.clock.setFixedTime(new Date('2026-10-19T12:00:00Z'));
    await page.route('**/api/puzzles/today', route => route.fulfill({ json: generateDailyPuzzle('2026-10-19') }));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Choose your mode' })).toBeVisible();
    await page.evaluate(snapshot => localStorage.setItem('tile-puzzle-progress:v1', JSON.stringify(snapshot)), saved);

    await page.reload();

    await expect(page.getByText('8 swaps left', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show hint', exact: true })).toBeDisabled();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tile-puzzle-progress:v1')!)))
      .toMatchObject({ puzzleId: saved.puzzleId, tierId: 'hard', board: saved.board, attemptsUsed: 2, hintUsed: true });
    await page.reload();
    await expect(page.getByText('8 swaps left', { exact: true })).toBeVisible();
  });

  test(`reload preserves completed v${version} modes for read-only review`, async ({ page }) => {
    const release = dailyPuzzleFromId(`daily-v${version}-2026-10-19-16-0`)!;
    const completion = {
      version: 1, puzzleId: release.puzzleId, tierId: 'easy', status: 'won',
      board: buildDifficultyPuzzle(release.puzzle, 'easy').target,
      attemptsUsed: 9, hintUsed: true, hintedPositions: null, elapsedMilliseconds: 12345,
    };
    await page.clock.setFixedTime(new Date('2026-10-19T12:00:00Z'));
    await page.route('**/api/puzzles/today', route => route.fulfill({ json: generateDailyPuzzle('2026-10-19') }));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Choose your mode' })).toBeVisible();
    await page.evaluate(snapshot => localStorage.setItem('tile-puzzle-completions:v1', JSON.stringify({
      version: 1, puzzleId: snapshot.puzzleId, completions: { easy: snapshot },
    })), completion);

    await page.reload();
    await page.getByRole('radio', { name: /^Easy\b/ }).check();
    await page.getByRole('button', { name: 'Review finished puzzle', exact: true }).click();

    await expect(page.getByText('Solved in 9 of 15 swaps', { exact: true })).toBeVisible();
    const tiles = page.getByRole('group', { name: 'Your tiles', exact: true }).getByRole('button');
    await expect(tiles.first()).toBeDisabled();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tile-puzzle-completions:v1')!).completions.easy))
      .toEqual(completion);
  });
}
