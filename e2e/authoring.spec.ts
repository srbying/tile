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

test('reports file read failures and resets the input for the same file', async ({ page }) => {
  await page.addInitScript(() => {
    const read = File.prototype.text;
    File.prototype.text = function () {
      if (this.name === 'unreadable.json') return Promise.reject(new Error('read failed'));
      return read.call(this);
    };
  });
  await page.goto('/author');
  const input = page.getByLabel('Load candidate JSON');
  const file = {
    name: 'candidate.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":1,"id":"imported"}'),
  };

  await input.setInputFiles({ ...file, name: 'unreadable.json' });
  await expect(page.getByRole('alert')).toContainText('Could not read candidate JSON file');
  await expect(input).toHaveValue('');

  await input.setInputFiles(file);
  await expect(page.getByRole('textbox', { name: 'Candidate JSON' })).toHaveValue(file.buffer.toString());
  await expect(input).toHaveValue('');
  await input.setInputFiles(file);
  await expect(page.getByRole('textbox', { name: 'Candidate JSON' })).toHaveValue(file.buffer.toString());
});

test('ignores an earlier file read when a newer selection or text edit wins', async ({ page }) => {
  await page.addInitScript(() => {
    const read = File.prototype.text;
    File.prototype.text = function () {
      const content = read.call(this);
      if (this.name !== 'slow.json') return content;
      return new Promise<string>((resolve) => {
        Object.assign(window, {
          slowFileReadStarted: true,
          releaseSlowFileRead: async () => resolve(await content),
        });
      });
    };
  });
  await page.goto('/author');
  const input = page.getByLabel('Load candidate JSON');
  const json = page.getByRole('textbox', { name: 'Candidate JSON' });
  const slow = { name: 'slow.json', mimeType: 'application/json', buffer: Buffer.from('{"id":"stale"}') };
  const latest = { name: 'latest.json', mimeType: 'application/json', buffer: Buffer.from('{"id":"latest"}') };

  await input.setInputFiles(slow);
  await page.waitForFunction(() => (window as Window & { slowFileReadStarted?: boolean }).slowFileReadStarted);
  await input.setInputFiles(latest);
  await expect(json).toHaveValue(latest.buffer.toString());
  await page.evaluate(() => (window as Window & { releaseSlowFileRead?: () => void }).releaseSlowFileRead?.());
  await expect(json).toHaveValue(latest.buffer.toString());

  await input.setInputFiles(slow);
  await page.waitForFunction(() => (window as Window & { slowFileReadStarted?: boolean }).slowFileReadStarted);
  await json.fill('newer text edit');
  await page.evaluate(() => (window as Window & { releaseSlowFileRead?: () => void }).releaseSlowFileRead?.());
  await expect(json).toHaveValue('newer text edit');
});
