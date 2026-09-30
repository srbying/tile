import { expect, test } from '@playwright/test';

test('authors, validates, previews, and exports a candidate offline', async ({ page }) => {
  await page.goto('/author');
  await expect(page.getByRole('heading', { name: 'Puzzle authoring' })).toBeVisible();

  const json = page.getByRole('textbox', { name: 'Candidate JSON' });
  const candidate = JSON.parse(await json.inputValue()) as { id: string; title: string };

  await page.getByRole('button', { name: 'Generate candidate' }).click();
  const generated = JSON.parse(await json.inputValue()) as { id: string };
  expect(generated.id).not.toBe(candidate.id);
  await page.getByRole('button', { name: 'Validate candidate' }).click();
  await expect(page.getByRole('status')).toContainText('Candidate passes validation');

  candidate.title = 'Edited courtyard';
  await json.fill(JSON.stringify(candidate, null, 2));
  await page.getByRole('button', { name: 'Validate candidate' }).click();
  await expect(page.getByRole('status')).toContainText('Candidate passes validation');
  await expect(page.getByText('Edited courtyard', { exact: true })).toBeVisible();

  for (const tier of ['Easy', 'Medium', 'Hard']) {
    for (const kind of ['target', 'starting'] as const) {
      await expect(page.getByRole('list', { name: `${tier} ${kind} board` }).getByRole('listitem'))
        .toHaveCount(36);
    }
  }

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export candidate JSON' }).click();
  expect((await download).suggestedFilename()).toMatch(/candidate-.*\.json/);
});

test('imports candidate JSON and explains validation failures', async ({ page }) => {
  await page.goto('/author');
  await page.getByLabel('Load candidate JSON').setInputFiles({
    name: 'invalid-candidate.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":1,"id":"broken"}'),
  });
  await expect(page.getByRole('alert')).toContainText('Candidate must contain two 6×6 tile boards');
});
