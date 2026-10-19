import { expect, test } from '@playwright/test';
import { samplePuzzle } from '../src/features/puzzle/sample-puzzle';
import { dailyPuzzleFromId, generateDailyPuzzle } from '../src/features/puzzle/daily-puzzle-generator';
import { buildDifficultyPuzzle } from '../src/features/puzzle/difficulty-preview';
import type { TileAppearance } from '../src/features/puzzle/puzzle.types';

// Independent witness for the sample's ten visible swaps (zero-based positions).
const solution = [[0, 14], [1, 21], [3, 25], [5, 18], [6, 29], [7, 16], [8, 33], [10, 23], [11, 27], [13, 34]] as const;

test('wins when only equivalent ribbons remain and never hints their invisible swap', async ({ page }) => {
  const ribbon: TileAppearance = { motif: 'squiggle-loops', color: 'teal', strokeWeight: 7, orientation: 90, inverted: false, mirrored: false };
  const target = [...samplePuzzle.target];
  target[15] = ribbon;
  target[26] = { ...ribbon, orientation: 270, mirrored: true };
  const start = [...samplePuzzle.start];
  start[15] = target[26];
  start[26] = target[15];
  const id = 'daily-v3-2026-10-19-0-0';
  const release = {
    puzzleId: id, releaseDate: '2026-10-19', generatorVersion: 3,
    puzzle: { ...samplePuzzle, id, schemaVersion: 1, target, start, attemptLimits: { easy: 15, medium: 13, hard: 10 } },
  };
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00Z'));
  await page.route('**/api/puzzles/today', route => route.fulfill({ json: release }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
  const board = page.getByRole('group', { name: 'Your tiles', exact: true });
  const cells = board.getByRole('button');
  await expect(page.getByText('16 of 36 tiles match the target', { exact: true })).toBeVisible();
  for (const [left, right] of solution.slice(0, -1)) {
    await cells.nth(left).click();
    await cells.nth(right).click();
  }
  await expect(page.getByText('34 of 36 tiles match the target', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show hint', exact: true }).click();
  await expect(cells.nth(15)).not.toHaveClass(/is-hinted/);
  await expect(cells.nth(26)).not.toHaveClass(/is-hinted/);
  await cells.nth(13).click();
  await cells.nth(34).click();
  await expect(board).toHaveClass(/is-won/);
  await expect(page.getByText('Solved in 10 of 13 swaps', { exact: true })).toBeVisible();
  // Both slots render exactly the target artwork despite their different transforms.
  const current = await board.locator('svg').evaluateAll(elements => elements.map(element => element.innerHTML));
  const preview = await page.getByRole('list', { name: 'Target pattern', exact: true }).locator('svg')
    .evaluateAll(elements => elements.map(element => element.innerHTML));
  expect(current).toEqual(preview);
});

test('recovers a visibly solved v2 save after the generator upgrade without spending a swap', async ({ page }) => {
  const legacy = dailyPuzzleFromId('daily-v2-2026-10-19-16-0')!;
  const target = buildDifficultyPuzzle(legacy.puzzle, 'hard').target;
  const savedBoard = [...target];
  [savedBoard[1], savedBoard[4]] = [savedBoard[4]!, savedBoard[1]!];
  const progress = {
    version: 1, puzzleId: legacy.puzzleId, tierId: 'hard', board: savedBoard,
    attemptsUsed: 9, hintUsed: true, hintedPositions: [1, 4], elapsedMilliseconds: 12345,
  };
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00Z'));
  await page.route('**/api/puzzles/today', route => route.fulfill({ json: generateDailyPuzzle('2026-10-19') }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Choose your mode' })).toBeVisible();
  await page.evaluate(saved => localStorage.setItem('tile-puzzle-progress:v1', JSON.stringify(saved)), progress);
  await page.reload();
  await expect(page.getByRole('group', { name: 'Your tiles', exact: true })).toHaveClass(/is-won/);
  await expect(page.getByText('Solved in 9 of 10 swaps', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('tile-puzzle-progress:v1'))).toBeNull();
  const completed = await page.evaluate(() => JSON.parse(localStorage.getItem('tile-puzzle-completions:v1')!).completions.hard);
  expect(completed).toMatchObject({ puzzleId: legacy.puzzleId, status: 'won', attemptsUsed: 9, elapsedMilliseconds: 12345, hintedPositions: null });
  await page.reload();
  await page.getByRole('radio', { name: /^Hard\b/ }).check();
  await page.getByRole('button', { name: 'Review finished puzzle', exact: true }).click();
  await expect(page.getByText('Solved in 9 of 10 swaps', { exact: true })).toBeVisible();
});
