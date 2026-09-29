import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const board = (page: Page) => page.getByRole('group', { name: 'Your mosaic', exact: true });
const cell = (page: Page, row: number, column: number) =>
  board(page).getByRole('button', { name: new RegExp(`^Row ${row}, column ${column}:`) });
const artworks = (page: Page) => board(page).locator('svg').evaluateAll((elements) => elements.map((element) => element.innerHTML));

// An independently recorded witness; tests do not call the production solver/reducer.
const solution = [
  [1, 1, 3, 3], [1, 2, 4, 4], [1, 4, 5, 2], [1, 6, 4, 1], [2, 1, 5, 6],
  [2, 2, 3, 5], [2, 3, 6, 4], [2, 5, 4, 6], [2, 6, 5, 4], [3, 2, 6, 5],
] as const;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('opens directly to a readable target and playable 36-cell board', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Daily Tile-Swap Puzzle.' })).toBeVisible();
  await expect(page.getByText('Match the target. Tap two tiles to swap them.')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Target arrangement' }).getByRole('listitem')).toHaveCount(36);
  await expect(board(page).getByRole('button')).toHaveCount(36);
  await expect(cell(page, 1, 1)).toHaveAccessibleName(/Row 1, column 1: teal nested diamonds, bold lines/);
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-pressed', 'false');
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-disabled', 'false');
});

test('selects, cancels, reselects, and swaps whole artwork with pointer or touch', async ({ page, isMobile }) => {
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

for (const input of ['pointer', 'keyboard'] as const) {
  test(`solves using ${input}, announces completion, and locks all swaps`, async ({ page, isMobile }) => {
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
    await expect(board(page).getByRole('button', { pressed: true })).toHaveCount(0);
    await expect(board(page).getByRole('button', { disabled: true })).toHaveCount(36);
    await expect(board(page)).toHaveClass(/is-solved/);
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

test('reload restores the sample and the app raises no browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.reload();
  const before = await artworks(page);
  await cell(page, 1, 1).click();
  await cell(page, 6, 6).click();
  await page.reload();
  expect(await artworks(page)).toEqual(before);
  await expect(board(page).getByRole('button', { pressed: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
