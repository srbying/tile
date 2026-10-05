import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { samplePuzzle } from '../src/features/puzzle/sample-puzzle';

const board = (page: Page) => page.getByRole('group', { name: 'Your mosaic', exact: true });
const cell = (page: Page, row: number, column: number) =>
  board(page).getByRole('button', { name: new RegExp(`^Row ${row}, column ${column}:`) });
const artworks = (page: Page) => board(page).locator('svg').evaluateAll((elements) => elements.map((element) => element.innerHTML));
const startGame = async (page: Page, mode?: 'Easy' | 'Medium' | 'Hard') => {
  if (mode) await page.getByRole('radio', { name: new RegExp(`^${mode}\\b`) }).check();
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
};

// An independently recorded witness; tests do not call the production solver/reducer.
const solution = [
  [1, 1, 3, 3], [1, 2, 4, 4], [1, 4, 5, 2], [1, 6, 4, 1], [2, 1, 5, 6],
  [2, 2, 3, 5], [2, 3, 6, 4], [2, 5, 4, 6], [2, 6, 5, 4], [3, 2, 6, 5],
] as const;

const solvePuzzle = async (page: Page) => {
  for (const [r1, c1, r2, c2] of solution) {
    await cell(page, r1, c1).click();
    await cell(page, r2, c2).click();
  }
};

test.beforeEach(async ({ page }) => {
  const puzzleId = 'daily-v1-2026-09-29-0-0';
  const puzzle = { schemaVersion: 1, ...samplePuzzle, id: puzzleId, attemptLimits: { easy: 15, medium: 13, hard: 10 } };
  const release = { puzzleId: puzzle.id, releaseDate: '2026-09-29', generatorVersion: 1, puzzle };
  await page.clock.setFixedTime(new Date('2026-09-29T12:00:00.000Z'));
  await page.route('**/api/puzzles/today', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(release),
  }));
  await page.goto('/');
});

test('discards saved progress when it belongs to a previous release', async ({ page }) => {
  const startingBoard = samplePuzzle.start;
  await page.evaluate((board) => localStorage.setItem('tile-puzzle-progress:v1', JSON.stringify({
    version: 1,
    puzzleId: 'yesterday-puzzle',
    tierId: 'hard',
    board,
    attemptsUsed: 1,
    hintUsed: false,
    hintedPositions: null,
    elapsedMilliseconds: 1,
  })), startingBoard);

  await page.reload();

  await expect(page.getByRole('heading', { name: 'Choose your mode' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('tile-puzzle-progress:v1'))).toBeNull();
});

test('preselects Medium and offers no unselected mode', async ({ page }) => {
  await expect(page.getByRole('radio')).toHaveCount(3);
  await expect(page.getByRole('radio', { name: /^Medium\b/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /^Easy\b/ })).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Start puzzle', exact: true })).toBeEnabled();
});

test('keeps mode choices readable and selectable at phone widths', async ({ page }) => {
  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const cards = await page.locator('.mode-option').evaluateAll((elements) => elements.map((element) => {
      const { width: cardWidth, height } = element.getBoundingClientRect();
      return { width: cardWidth, height };
    }));
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.width).toBeGreaterThanOrEqual(44);
      expect(card.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.getByRole('radio', { name: /^Hard\b/ }).check();
  await expect(page.getByRole('radio', { name: /^Hard\b/ })).toBeChecked();
});

test('starts a readable target and playable 36-cell board', async ({ page }) => {
  await startGame(page);
  await expect(page.getByRole('heading', { name: 'Daily Tile-Swap Puzzle.' })).toBeVisible();
  await expect(page.getByText('Match the target. Tap two tiles to swap them.')).toBeVisible();
  await expect(page.getByText('Medium mode', { exact: true })).toBeVisible();
  await expect(page.getByText('13 of 13 swaps remaining', { exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Target arrangement' }).getByRole('listitem')).toHaveCount(36);
  await expect(board(page).getByRole('button')).toHaveCount(36);
  await expect(cell(page, 1, 1)).toHaveAccessibleName(/Row 1, column 1: teal Nested diamonds, bold lines/);
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-pressed', 'false');
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-disabled', 'false');
});

test('selects, cancels, reselects, and swaps whole artwork with pointer or touch', async ({ page, isMobile }) => {
  await startGame(page);
  const before = await artworks(page);
  const activate = async (row: number, column: number) => {
    const tile = cell(page, row, column);
    if (isMobile) await tile.tap();
    else await tile.click();
  };
  await activate(1, 1);
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status')).toContainText('Row 1, column 1 selected');
  expect(await artworks(page)).toEqual(before);
  await activate(1, 1);
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-pressed', 'false');
  await activate(2, 2);
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  expect(await artworks(page)).toEqual(before);
  await expect(cell(page, 2, 2)).toHaveAttribute('aria-pressed', 'false');
  await activate(1, 1);
  await activate(6, 6);
  const after = await artworks(page);
  expect(after[0]).toBe(before[35]);
  expect(after[35]).toBe(before[0]);
  expect(after.slice(1, 35)).toEqual(before.slice(1, 35));
  await expect(board(page).getByRole('button', { pressed: true })).toHaveCount(0);
});

test('keyboard focus is row-major, selection is separate, and Escape cancels', async ({ page }) => {
  await startGame(page);
  const before = await artworks(page);
  await cell(page, 1, 1).focus();
  await page.keyboard.press('Enter');
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Tab');
  await expect(cell(page, 1, 2)).toBeFocused();
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-pressed', 'true');
  expect(await artworks(page)).toEqual(before);
  await page.keyboard.press('Escape');
  await expect(board(page).getByRole('button', { pressed: true })).toHaveCount(0);
  expect(await artworks(page)).toEqual(before);
  await page.keyboard.press('Space');
  await expect(cell(page, 1, 2)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  const after = await artworks(page);
  expect(after[1]).toBe(before[2]);
  expect(after[2]).toBe(before[1]);
  await expect(cell(page, 1, 3)).toBeFocused();
  const focusStyle = await cell(page, 1, 3).evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(focusStyle).toBe('dashed');
});

test('uses one productive hint without consuming a swap and marks the result assisted', async ({ page, isMobile }) => {
  await startGame(page);
  const before = await artworks(page);
  await expect(page.locator('#hint-instruction')).toHaveCount(1);
  await expect(page.locator('#hint-instruction')).toBeEmpty();
  await page.getByRole('button', { name: 'Use hint', exact: true }).click();

  const hinted = board(page).locator('.is-hinted');
  await expect(hinted).toHaveCount(2);
  await expect(hinted.first()).toHaveAttribute('aria-describedby', 'hint-instruction');
  await expect(page.getByText(/Hint: Swap Row 1, column 1 with Row 3, column 3/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use hint', exact: true })).toBeDisabled();
  await expect(page.getByText('13 of 13 swaps remaining', { exact: true })).toBeVisible();
  expect(await artworks(page)).toEqual(before);
  expect(await hinted.evaluateAll((elements) => elements.map((element) => Number(element.getAttribute('data-position')))))
    .toEqual([0, 14]);

  const activate = async (position: number) => {
    const tile = board(page).locator(`[data-position="${position}"]`);
    if (isMobile) await tile.tap();
    else await tile.click();
  };
  await activate(0);
  await activate(14);
  await expect(board(page).locator('.is-hinted')).toHaveCount(0);
  for (const [r1, c1, r2, c2] of solution.slice(1)) {
    await activate((r1 - 1) * 6 + c1 - 1);
    await activate((r2 - 1) * 6 + c2 - 1);
  }

  await expect(page.getByRole('status')).toContainText('Puzzle complete');
  await expect(page.locator('.round-result')).toContainText('Assisted (hint used)');
  await expect(page.locator('.round-result')).toContainText(/Active time: \d+:\d{2}/);
  await expect(page.locator('.round-result')).toContainText('Greek-key border around four inset diamonds.');
});

test('shares only spoiler-safe result text through the native share sheet', async ({ page }) => {
  await page.addInitScript(() => {
    const testWindow = window as unknown as { __shareCalls: ShareData[] };
    testWindow.__shareCalls = [];
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => { testWindow.__shareCalls.push(data); },
    });
  });
  await page.reload();
  await startGame(page);
  await expect(page.getByRole('button', { name: /result/i })).toHaveCount(0);
  await solvePuzzle(page);

  await page.getByRole('button', { name: 'Share result', exact: true }).click();

  await expect(page.locator('.result-share-feedback')).toHaveText('Share sheet opened.');
  const shareCalls = await page.evaluate(() => (window as unknown as { __shareCalls: ShareData[] }).__shareCalls);
  expect(shareCalls).toEqual([{
    title: 'Daily Tile-Swap Puzzle',
    text: 'Daily Tile-Swap Puzzle · 2026-09-29\nSolved · Medium mode · 10/13 swaps · Unassisted',
  }]);
});

test('copies a loss result when native sharing is unavailable and announces completion', async ({ page }) => {
  await page.addInitScript(() => {
    const testWindow = window as unknown as { __copiedText?: string };
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => { testWindow.__copiedText = text; } },
    });
  });
  await page.reload();
  await startGame(page, 'Hard');
  for (let attempt = 0; attempt < 10; attempt++) {
    await cell(page, 1, 1).click();
    await cell(page, 1, 2).click();
  }

  await page.getByRole('button', { name: 'Copy result', exact: true }).click();

  await expect(page.locator('.result-share-feedback')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('.result-share-feedback')).toHaveText('Result copied to clipboard.');
  expect(await page.evaluate(() => (window as unknown as { __copiedText?: string }).__copiedText))
    .toBe('Daily Tile-Swap Puzzle · 2026-09-29\nNot solved · Hard mode · 10/10 swaps · Unassisted');
});

test('announces when copying a result fails', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => { throw new Error('Clipboard access denied.'); } },
    });
  });
  await page.reload();
  await startGame(page, 'Hard');
  for (let attempt = 0; attempt < 10; attempt++) {
    await cell(page, 1, 1).click();
    await cell(page, 1, 2).click();
  }

  await page.getByRole('button', { name: 'Copy result', exact: true }).click();

  await expect(page.locator('.result-share-feedback')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('.result-share-feedback')).toHaveText('Could not copy result. Please try again.');
});

test('does not copy when the player cancels native sharing', async ({ page }) => {
  await page.addInitScript(() => {
    const testWindow = window as unknown as { __copyCalls: number };
    testWindow.__copyCalls = 0;
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => { throw new DOMException('Share canceled.', 'AbortError'); },
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => { testWindow.__copyCalls++; } },
    });
  });
  await page.reload();
  await startGame(page);
  await solvePuzzle(page);

  await page.getByRole('button', { name: 'Share result', exact: true }).click();

  await expect(page.locator('.result-share-feedback')).toHaveText('Sharing canceled.');
  expect(await page.evaluate(() => (window as unknown as { __copyCalls: number }).__copyCalls)).toBe(0);
});

for (const input of ['pointer', 'keyboard'] as const) {
  test(`solves using ${input}, announces completion, and locks all swaps`, async ({ page, isMobile }) => {
    await startGame(page);
    for (const [r1, c1, r2, c2] of solution) {
      for (const [row, column] of [[r1, c1], [r2, c2]] as const) {
        const tile = cell(page, row, column);
        if (input === 'keyboard') {
          await tile.focus();
          await page.keyboard.press('Enter');
        } else if (isMobile) await tile.tap();
        else await tile.click();
      }
    }
    await expect(page.getByRole('status')).toHaveText('✓Puzzle complete. The pattern is restored.');
    const completed = await artworks(page);
    const target = await page.getByRole('list', { name: 'Target arrangement' }).locator('svg')
      .evaluateAll((elements) => elements.map((element) => element.innerHTML));
    expect(completed).toEqual(target);
    await expect(page.locator('.round-result')).toContainText('Unassisted');
    await expect(page.locator('.round-result')).toContainText(/Active time: \d+:\d{2}/);
    await expect(page.locator('.round-result')).toContainText('Greek-key border around four inset diamonds.');
    await expect(board(page).getByRole('button', { pressed: true })).toHaveCount(0);
    await expect(board(page).getByRole('button', { disabled: true })).toHaveCount(36);
    await expect(board(page)).toHaveClass(/is-won/);
    await cell(page, 1, 1).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    // Real pointer events still hit aria-disabled controls; the UI must ignore them.
    for (const column of [1, 2]) {
      const tile = cell(page, 1, column);
      await tile.scrollIntoViewIfNeeded();
      const box = await tile.boundingBox();
      if (!box) throw new Error('Completed tile is missing.');
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    expect(await artworks(page)).toEqual(completed);
    await expect(page.getByRole('status')).toContainText('Puzzle complete');
  });
}

test('fits phone widths with reliable square touch targets and static feedback', async ({ page }) => {
  await startGame(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const sizes = await board(page).getByRole('button').evaluateAll((elements) => elements.map((element) => {
      const { width, height } = element.getBoundingClientRect();
      return { width, height };
    }));
    for (const size of sizes) {
      expect(size.width).toBeGreaterThanOrEqual(44);
      expect(size.height).toBeGreaterThanOrEqual(44);
      expect(Math.abs(size.width - size.height)).toBeLessThan(1);
    }
    const reference = await page.getByRole('list', { name: 'Target arrangement' }).boundingBox();
    const playable = await board(page).boundingBox();
    expect(reference!.width).toBeCloseTo(playable!.width, 0);
  }
  await cell(page, 1, 1).click();
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-pressed', 'true');
  expect(await cell(page, 1, 1).evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
});

test('a loss on the final Hard attempt colors and locks the full board', async ({ page }) => {
  await startGame(page, 'Hard');
  await expect(page.getByText('10 of 10 swaps remaining', { exact: true })).toBeVisible();

  for (let attempt = 0; attempt < 10; attempt++) {
    await cell(page, 1, 1).click();
    await cell(page, 1, 2).click();
  }

  await expect(page.getByRole('status')).toContainText('No attempts remaining');
  await expect(page.locator('.round-result').getByText('Hard mode', { exact: true })).toBeVisible();
  await expect(page.locator('.round-result').getByText('10 of 10 swaps used', { exact: true })).toBeVisible();
  await expect(page.locator('.round-result')).toContainText('Unassisted');
  await expect(page.locator('.round-result')).toContainText(/Active time: \d+:\d{2}/);
  await expect(page.locator('.round-result')).toContainText('Greek-key border around four inset diamonds.');
  await expect(board(page)).toHaveClass(/is-lost/);
  await expect(board(page).getByRole('button', { disabled: true })).toHaveCount(36);
  await expect(board(page).locator('.outcome-mark')).toHaveCount(36);
  expect(await page.evaluate(() => localStorage.getItem('tile-puzzle-progress:v1'))).toBeNull();
});

test('Hard mode wins on its tenth and final attempt', async ({ page }) => {
  await startGame(page, 'Hard');
  for (const [r1, c1, r2, c2] of solution) {
    await cell(page, r1, c1).click();
    await cell(page, r2, c2).click();
  }
  await expect(page.getByRole('status')).toContainText('Puzzle complete');
  await expect(page.locator('.round-result').getByText('Hard mode', { exact: true })).toBeVisible();
  await expect(page.locator('.round-result').getByText('10 of 10 swaps used', { exact: true })).toBeVisible();
  await expect(board(page)).toHaveClass(/is-won/);
  expect(await page.evaluate(() => localStorage.getItem('tile-puzzle-progress:v1'))).toBeNull();
});

test('reviews a finished win after reload and keeps sharing available', async ({ page }) => {
  await page.addInitScript(() => {
    const testWindow = window as unknown as { __copiedText?: string };
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => { testWindow.__copiedText = text; } },
    });
  });
  await startGame(page, 'Medium');
  await solvePuzzle(page);

  const solvedArtwork = await artworks(page);
  const activeTime = await page.locator('.round-result').getByText(/^Active time:/).innerText();
  await page.getByRole('button', { name: 'Choose another difficulty', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your mode' })).toBeVisible();
  await expect(page.locator('.mode-option').filter({ hasText: 'Medium' }).getByText('Finished', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review finished puzzle', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Choose your mode' })).toBeVisible();
  await page.getByRole('radio', { name: /^Medium\b/ }).check();
  await page.getByRole('button', { name: 'Review finished puzzle', exact: true }).click();

  await expect(board(page)).toHaveClass(/is-won/);
  await expect(page.getByText('10 of 13 swaps used', { exact: true })).toBeVisible();
  await expect(page.locator('.round-result').getByText(/^Active time:/)).toHaveText(activeTime);
  expect(await artworks(page)).toEqual(solvedArtwork);
  await page.getByRole('button', { name: 'Copy result', exact: true }).click();
  await expect(page.locator('.result-share-feedback')).toHaveText('Result copied to clipboard.');
  expect(await page.evaluate(() => (window as unknown as { __copiedText?: string }).__copiedText))
    .toBe('Daily Tile-Swap Puzzle · 2026-09-29\nSolved · Medium mode · 10/13 swaps · Unassisted');

  await page.getByRole('button', { name: 'Choose another difficulty', exact: true }).click();
  await page.getByRole('radio', { name: /^Easy\b/ }).check();
  await expect(page.getByRole('button', { name: 'Start puzzle', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
  await expect(page.getByText('Easy mode', { exact: true })).toBeVisible();
});

test('locks a finished loss while leaving other difficulties playable', async ({ page }) => {
  await startGame(page, 'Hard');
  for (let attempt = 0; attempt < 10; attempt++) {
    await cell(page, 1, 1).click();
    await cell(page, 1, 2).click();
  }
  await page.getByRole('button', { name: 'Choose another difficulty', exact: true }).click();

  await expect(page.locator('.mode-option').filter({ hasText: 'Hard' }).getByText('Finished', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: /^Medium\b/ }).check();
  await expect(page.getByRole('button', { name: 'Start puzzle', exact: true })).toBeEnabled();
  await page.getByRole('radio', { name: /^Hard\b/ }).check();
  await expect(page.getByRole('button', { name: 'Review finished puzzle', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Review finished puzzle', exact: true }).click();

  await expect(board(page)).toHaveClass(/is-lost/);
  await expect(page.getByText('10 of 10 swaps used', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Choose another difficulty', exact: true }).click();
  await page.getByRole('radio', { name: /^Medium\b/ }).check();
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
  await expect(page.getByText('Medium mode', { exact: true })).toBeVisible();
});

test('makes all difficulties playable for a new daily puzzle', async ({ page }) => {
  await startGame(page, 'Medium');
  await solvePuzzle(page);
  await page.getByRole('button', { name: 'Choose another difficulty', exact: true }).click();

  const nextPuzzleId = 'daily-v1-2026-09-30-0-0';
  const nextPuzzle = { ...samplePuzzle, id: nextPuzzleId };
  const nextRelease = {
    puzzleId: nextPuzzleId,
    releaseDate: '2026-09-30',
    generatorVersion: 1,
    puzzle: { schemaVersion: 1, ...nextPuzzle, attemptLimits: { easy: 15, medium: 13, hard: 10 } },
  };
  await page.unroute('**/api/puzzles/today');
  await page.route('**/api/puzzles/today', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(nextRelease),
  }));
  await page.reload();

  await expect(page.getByText('DAILY Nº 2026-09-30')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start puzzle', exact: true })).toBeEnabled();
  await expect(page.getByText('Finished', { exact: true })).toHaveCount(0);
});

test('reload before a committed move returns to mode picker and raises no browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await startGame(page);
  await page.reload();
  await expect(page.getByRole('radio', { name: /^Medium\b/ })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Start puzzle', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('reload resumes saved mode, board, attempts, hint, and active time', async ({ page }) => {
  await startGame(page, 'Hard');
  await cell(page, 1, 1).click();
  await cell(page, 1, 2).click();
  await page.getByRole('button', { name: 'Use hint', exact: true }).click();
  const boardBeforeReload = await artworks(page);
  const savedBeforeReload = await page.evaluate(() => JSON.parse(localStorage.getItem('tile-puzzle-progress:v1')!));
  expect(savedBeforeReload).toMatchObject({
    version: 1,
    tierId: 'hard',
    attemptsUsed: 1,
    hintUsed: true,
  });
  expect(savedBeforeReload.puzzleId).toBe('daily-v1-2026-09-29-0-0');

  await page.waitForTimeout(1_050);
  const puzzleRequests: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/puzzles/')) puzzleRequests.push(path);
  });
  await page.reload();

  await expect(page.getByText('Hard mode', { exact: true })).toBeVisible();
  await expect(page.getByText('9 of 10 swaps remaining', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use hint', exact: true })).toBeDisabled();
  await expect(board(page).locator('.is-hinted')).toHaveCount(2);
  expect(await artworks(page)).toEqual(boardBeforeReload);
  expect(puzzleRequests).toContain('/api/puzzles/today');
  expect(puzzleRequests).not.toContain(`/api/puzzles/${savedBeforeReload.puzzleId}`);
  const savedAfterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('tile-puzzle-progress:v1')!));
  expect(savedAfterReload.elapsedMilliseconds).toBeGreaterThanOrEqual(savedBeforeReload.elapsedMilliseconds + 900);

  await cell(page, 1, 3).click();
  await cell(page, 1, 4).click();
  const afterNextSwap = await page.evaluate(() => JSON.parse(localStorage.getItem('tile-puzzle-progress:v1')!));
  expect(afterNextSwap.attemptsUsed).toBe(2);
  expect(afterNextSwap.elapsedMilliseconds).toBeGreaterThan(savedAfterReload.elapsedMilliseconds);
});
