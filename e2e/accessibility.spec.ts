import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { samplePuzzle } from '../src/features/puzzle/sample-puzzle';

const board = (page: Page) => page.getByRole('group', { name: 'Your mosaic', exact: true });

const solution = [
  [1, 1, 3, 3], [1, 2, 4, 4], [1, 4, 5, 2], [1, 6, 4, 1], [2, 1, 5, 6],
  [2, 2, 3, 5], [2, 3, 6, 4], [2, 5, 4, 6], [2, 6, 5, 4], [3, 2, 6, 5],
] as const;

const startGame = async (page: Page, mode: 'Medium' | 'Hard' = 'Medium') => {
  await page.getByRole('radio', { name: new RegExp('^' + mode + '\\b') }).check();
  await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
};

function colorChannels(value: string): [number, number, number] {
  const hexadecimal = /^#([0-9a-f]{3,8})$/i.exec(value)?.[1];
  if (hexadecimal && hexadecimal.length === 3) {
    return [...hexadecimal].map((channel) => Number.parseInt(channel + channel, 16)) as [number, number, number];
  }
  if (hexadecimal && (hexadecimal.length === 6 || hexadecimal.length === 8)) {
    return [0, 2, 4].map((index) => Number.parseInt(hexadecimal.slice(index, index + 2), 16)) as [number, number, number];
  }
  const channels = value.match(/[\d.]+/g)?.map(Number) ?? [];
  if (channels.length < 3) throw new Error('Unexpected CSS color: ' + value);
  return [channels[0]!, channels[1]!, channels[2]!];
}

function contrastRatio(left: string, right: string) {
  const luminance = (value: string) => {
    const [red, green, blue] = colorChannels(value).map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
  };
  const [lighter, darker] = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

async function visibleTextSamples(page: Page) {
  return page.locator('.page-shell').evaluate((root) => {
    const parse = (color: string) => {
      const values = color.match(/[\d.]+/g)?.map(Number) ?? [];
      return { red: values[0] ?? 0, green: values[1] ?? 0, blue: values[2] ?? 0, alpha: values[3] ?? 1 };
    };
    const over = (
      top: ReturnType<typeof parse>,
      bottom: ReturnType<typeof parse>,
    ) => {
      const alpha = top.alpha + bottom.alpha * (1 - top.alpha);
      if (alpha === 0) return { red: 0, green: 0, blue: 0, alpha: 0 };
      return {
        red: (top.red * top.alpha + bottom.red * bottom.alpha * (1 - top.alpha)) / alpha,
        green: (top.green * top.alpha + bottom.green * bottom.alpha * (1 - top.alpha)) / alpha,
        blue: (top.blue * top.alpha + bottom.blue * bottom.alpha * (1 - top.alpha)) / alpha,
        alpha,
      };
    };
    const samples: { text: string; foreground: string; background: string; fontSize: number; fontWeight: number }[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent?.trim();
      const element = node.parentElement;
      if (!text || !element || element.closest('.visually-hidden, [aria-hidden="true"], :disabled, [aria-disabled="true"]')) continue;
      const style = getComputedStyle(element);
      const range = document.createRange();
      range.selectNodeContents(node);
      if (range.getClientRects().length === 0 || style.visibility === 'hidden' || style.display === 'none') continue;

      const backgrounds = [];
      for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
        backgrounds.push(parse(getComputedStyle(ancestor).backgroundColor));
      }
      let background = { red: 0, green: 0, blue: 0, alpha: 0 };
      for (const layer of backgrounds.reverse()) background = over(layer, background);
      samples.push({
        text,
        foreground: style.color,
        background: 'rgb(' + Math.round(background.red) + ', ' + Math.round(background.green) + ', ' + Math.round(background.blue) + ')',
        fontSize: Number.parseFloat(style.fontSize),
        fontWeight: Number.parseInt(style.fontWeight, 10) || 400,
      });
    }
    return samples;
  });
}

async function expectTextContrast(page: Page, phase: string) {
  const samples = await visibleTextSamples(page);
  const failures = samples.filter(({ foreground, background, fontSize, fontWeight }) => {
    const large = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
    return contrastRatio(foreground, background) < (large ? 3 : 4.5);
  });
  expect(failures, phase + ' text contrast failures: ' + JSON.stringify(failures)).toEqual([]);
}

async function artworkColors(page: Page) {
  return page.locator('.tile-grid svg').evaluateAll((elements) => elements.map((element) => ({
    background: element.querySelector('rect')?.getAttribute('fill') ?? '',
    foreground: element.querySelector('g')?.getAttribute('stroke') ?? '',
  })));
}

async function expectArtworkContrast(page: Page, phase: string) {
  const pairs = await artworkColors(page);
  const failures = pairs.filter(({ foreground, background }) => contrastRatio(foreground, background) < 3);
  expect(failures, phase + ' tile artwork contrast failures: ' + JSON.stringify(failures)).toEqual([]);
}

async function expectMarkerContrast(page: Page, selector: string, count: number, phase: string) {
  const markers = await board(page).getByRole('button').evaluateAll((buttons, markerSelector) =>
    buttons.flatMap((button) => {
      const marker = button.querySelector<HTMLElement>(markerSelector);
      if (!marker) return [];
      const style = getComputedStyle(marker);
      const tileBackground = button.querySelector('rect')?.getAttribute('fill') ?? '';
      return [{
        text: marker.textContent?.trim() ?? '',
        foreground: style.color,
        background: style.backgroundColor,
        borderColor: style.borderColor,
        borderWidth: Number.parseFloat(style.borderWidth),
        tileBackground,
      }];
    }), selector);
  expect(markers, phase + ' marker count').toHaveLength(count);
  const failures = markers.filter(({ foreground, background, borderColor, borderWidth, tileBackground }) => {
    const markerAgainstTile = Math.max(
      contrastRatio(background, tileBackground),
      contrastRatio(foreground, tileBackground),
      borderWidth > 0 ? contrastRatio(borderColor, tileBackground) : 0,
    );
    return contrastRatio(foreground, background) < 3 || markerAgainstTile < 3;
  });
  expect(failures, phase + ' marker contrast failures: ' + JSON.stringify(failures)).toEqual([]);
}

async function expectStaticFeedback(page: Page, phase: string) {
  const styles = await page.locator('.playable-grid, .tile-button.is-selected, .hint-mark, .game-feedback output, .outcome-mark')
    .evaluateAll((elements) => elements.map((element) => {
      const style = getComputedStyle(element);
      return { animationName: style.animationName, transitionDuration: style.transitionDuration };
    }));
  expect(styles.length, phase + ' should expose visible feedback').toBeGreaterThan(0);
  const animated = styles.filter(({ animationName, transitionDuration }) =>
    animationName !== 'none' || transitionDuration.split(',').some((duration) => Number.parseFloat(duration) > 0));
  expect(animated, phase + ' should not rely on motion').toEqual([]);
}

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

test('keeps visible game text and tile artwork above WCAG AA contrast thresholds', async ({ page }) => {
  await expectTextContrast(page, 'mode picker');
  await startGame(page);
  await expectTextContrast(page, 'active round');
  await expectArtworkContrast(page, 'active round');

  const firstCell = board(page).getByRole('button', { name: /^Row 1, column 1:/ });
  await firstCell.click();
  await expect(firstCell).toHaveAttribute('aria-pressed', 'true');
  await expectMarkerContrast(page, '.selection-mark', 1, 'selection');
  await firstCell.click();

  await page.getByRole('button', { name: 'Use hint', exact: true }).click();
  await expectTextContrast(page, 'hint');
  await expectMarkerContrast(page, '.hint-mark', 2, 'hint');

  for (const [r1, c1, r2, c2] of solution) {
    await board(page).getByRole('button', { name: new RegExp('^Row ' + r1 + ', column ' + c1 + ':') }).click();
    await board(page).getByRole('button', { name: new RegExp('^Row ' + r2 + ', column ' + c2 + ':') }).click();
  }
  await expect(page.getByRole('status')).toContainText('Puzzle complete');
  await expect(board(page).locator('.outcome-mark')).toHaveCount(36);
  await expect(board(page).locator('.outcome-mark').first()).toHaveText('✓');
  await expectMarkerContrast(page, '.outcome-mark', 36, 'win');
  await expectTextContrast(page, 'win result');

  await page.reload();
  await startGame(page, 'Hard');
  await expectArtworkContrast(page, 'hard round');
  for (let attempt = 0; attempt < 10; attempt++) {
    await board(page).getByRole('button', { name: /^Row 1, column 1:/ }).click();
    await board(page).getByRole('button', { name: /^Row 1, column 2:/ }).click();
  }
  await expect(page.getByRole('status')).toContainText('No attempts remaining');
  await expect(board(page).locator('.outcome-mark')).toHaveCount(36);
  await expect(board(page).locator('.outcome-mark').first()).toHaveText('×');
  await expectMarkerContrast(page, '.outcome-mark', 36, 'failure');
  await expectTextContrast(page, 'failure result');
});

test('focus indicator reaches 3:1 contrast on every tile background', async ({ page }) => {
  await startGame(page, 'Hard');
  const cells = board(page).getByRole('button');
  await cells.nth(0).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await expect(cells.nth(1)).toBeFocused();

  const { outlineColor, outlineStyle, outlineWidth, boxShadow, backgrounds } = await cells.nth(1).evaluate((element) => ({
    outlineColor: getComputedStyle(element).outlineColor,
    outlineStyle: getComputedStyle(element).outlineStyle,
    outlineWidth: getComputedStyle(element).outlineWidth,
    boxShadow: getComputedStyle(element).boxShadow,
    backgrounds: [...document.querySelectorAll('.playable-grid .tile-button rect')].map((rect) => rect.getAttribute('fill') ?? ''),
  }));
  expect(outlineStyle).not.toBe('none');
  expect(Number.parseFloat(outlineWidth)).toBeGreaterThanOrEqual(2);
  const ringColors = [outlineColor, ...(boxShadow.match(/rgb\([^)]+\)/g) ?? [])];
  const failures = [...new Set(backgrounds)].filter((background) =>
    Math.max(...ringColors.map((ring) => contrastRatio(ring, background))) < 3);
  expect(failures, 'Focus indicator is too low contrast on these tile backgrounds: ' + failures.join(', ')).toEqual([]);
});

test('keeps swap, hint, win, and failure feedback clear with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startGame(page);
  const firstCell = board(page).getByRole('button', { name: /^Row 1, column 1:/ });
  const secondCell = board(page).getByRole('button', { name: /^Row 3, column 3:/ });
  await firstCell.click();
  await secondCell.click();
  await expect(page.getByText('12 of 13 swaps remaining', { exact: true })).toBeVisible();
  await expectStaticFeedback(page, 'swap');
  await firstCell.click();
  await secondCell.click();
  await expect(page.getByText('11 of 13 swaps remaining', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Use hint', exact: true }).click();
  await expect(board(page).locator('.hint-mark')).toHaveCount(2);
  await expect(page.locator('#hint-instruction')).toContainText('Hint: Swap');
  await expectStaticFeedback(page, 'hint');
  for (const [r1, c1, r2, c2] of solution) {
    await board(page).getByRole('button', { name: new RegExp('^Row ' + r1 + ', column ' + c1 + ':') }).click();
    await board(page).getByRole('button', { name: new RegExp('^Row ' + r2 + ', column ' + c2 + ':') }).click();
  }
  await expect(page.getByRole('status')).toContainText('Puzzle complete');
  await expect(board(page).locator('.outcome-mark').first()).toHaveText('✓');
  await expectStaticFeedback(page, 'win');

  await page.reload();
  await startGame(page, 'Hard');
  for (let attempt = 0; attempt < 10; attempt++) {
    await board(page).getByRole('button', { name: /^Row 1, column 1:/ }).click();
    await board(page).getByRole('button', { name: /^Row 1, column 2:/ }).click();
  }
  await expect(page.getByRole('status')).toContainText('No attempts remaining');
  await expect(board(page).locator('.outcome-mark').first()).toHaveText('×');
  await expectStaticFeedback(page, 'failure');
});
