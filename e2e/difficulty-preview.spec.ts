import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const tiers = ['Easy', 'Medium', 'Hard'] as const;
const board = (page: Page, tier: string, kind: 'target' | 'starting') =>
  page.getByRole('list', { name: `${tier} ${kind === 'target' ? 'target pattern' : 'starting tiles'}`, exact: true });

test('shows the same full-size target and starting layout for each art tier', async ({ page }) => {
  await page.goto('/preview');
  await expect(page.getByRole('heading', { name: 'Compare the modes' })).toBeVisible();
  await expect(page.getByText('Same puzzle, different visual clues. Each mode changes how the tiles look.')).toBeVisible();

  for (const tier of tiers) {
    await expect(page.getByRole('heading', { name: new RegExp(`${tier}$`) })).toBeVisible();
    for (const kind of ['target', 'starting'] as const) {
      await expect(board(page, tier, kind).getByRole('listitem')).toHaveCount(36);
    }
  }

  await expect(page.getByRole('link', { name: 'Back to the puzzle' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('button')).toHaveCount(0);
});

test('keeps each board readable and stacked at common phone widths', async ({ page }) => {
  await page.goto('/preview');

  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    for (const tier of tiers) {
      const target = await board(page, tier, 'target').boundingBox();
      const starting = await board(page, tier, 'starting').boundingBox();
      expect(target).not.toBeNull();
      expect(starting).not.toBeNull();
      expect(target!.width).toBeCloseTo(starting!.width, 0);
      expect(starting!.y).toBeGreaterThanOrEqual(target!.y + target!.height);

      const cells = await board(page, tier, 'starting').getByRole('listitem').evaluateAll((elements) =>
        elements.map((element) => {
          const { width, height } = element.getBoundingClientRect();
          return { width, height };
        }));
      for (const cell of cells) {
        expect(cell.width).toBeGreaterThanOrEqual(44);
        expect(cell.height).toBeGreaterThanOrEqual(44);
      }
    }
  }
});

test('navigates from the game to preview and back without changing gameplay', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Daily Tile-Swap Puzzle.' })).toBeVisible();
  await page.getByRole('link', { name: 'Compare modes' }).click();
  await expect(page).toHaveURL('/preview');
  await page.getByRole('link', { name: 'Back to the puzzle' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Daily Tile-Swap Puzzle.' })).toBeVisible();
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Your tiles', exact: true }).getByRole('button')).toHaveCount(36);
});
