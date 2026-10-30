import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { checkPublicGame } from '../monitoring/public-game-check';
import { generateDailyPuzzle } from '../src/features/puzzle/daily-puzzle-generator';

test('public monitor verifies a fresh playable game using one current-release request', async ({ page, baseURL }) => {
  let requests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/puzzles/today') requests++;
  });
  const result = await checkPublicGame(page, baseURL!);
  expect(result).toMatchObject({ ok: true });
  expect(requests).toBe(1);
  await expect(page.getByText('12 swaps left', { exact: true })).toBeVisible();
});

test('public monitor detects a controlled release failure without changing the server', async ({ page, baseURL }) => {
  await page.route('**/api/puzzles/today', (route) => route.fulfill({ status: 503, body: 'private-body-sentinel' }));
  const result = await checkPublicGame(page, baseURL!);
  expect(result).toMatchObject({ ok: false, reason: 'release_http', pageStatus: 200, releaseStatus: 503 });
  expect(JSON.stringify(result)).not.toContain('sentinel');
});

for (const [reason, body] of [
  ['invalid_json', 'private-json-sentinel'],
  ['invalid_release', JSON.stringify({ puzzleId: 'private-payload-sentinel' })],
] as const) {
  test(`public monitor rejects ${reason} before trusting UI`, async ({ page, baseURL }) => {
    await page.route('**/api/puzzles/today', (route) => route.fulfill({ status: 200, contentType: 'application/json', body }));
    const result = await checkPublicGame(page, baseURL!);
    expect(result).toMatchObject({ ok: false, reason, releaseStatus: 200 });
    expect(JSON.stringify(result)).not.toContain('sentinel');
  });
}

for (const releaseDate of ['2026-10-29', '2026-10-31']) {
  test(`public monitor rejects wrong-date release ${releaseDate} even if UI can play it`, async ({ page, baseURL }) => {
    await page.clock.setFixedTime(new Date(`${releaseDate}T16:00:00Z`));
    await page.route('**/api/puzzles/today', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(generateDailyPuzzle(releaseDate)),
    }));
    const result = await checkPublicGame(page, baseURL!, { now: () => new Date('2026-10-30T16:00:00Z') });
    expect(result).toMatchObject({ ok: false, reason: 'wrong_date', releaseDate });
  });
}

test('public monitor bounds a stalled release with its own deadline', async ({ page, baseURL }) => {
  await page.route('**/api/puzzles/today', () => new Promise<void>(() => {}));
  const result = await checkPublicGame(page, baseURL!, { timeoutMilliseconds: 500 });
  expect(result).toMatchObject({ ok: false, reason: 'probe_timeout' });
  expect(result.durationMilliseconds).toBeLessThan(3_000);
});

test('public monitor rejects browser runtime errors without exposing their contents', async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    window.addEventListener('load', () => { setTimeout(() => { throw new Error('private-runtime-sentinel'); }, 0); });
  });
  const result = await checkPublicGame(page, baseURL!);
  expect(result).toMatchObject({ ok: false, reason: 'runtime_error' });
  expect(JSON.stringify(result)).not.toContain('sentinel');
});

for (const [at, date] of [
  ['2026-03-08T04:59:59Z', '2026-03-07'],
  ['2026-03-08T05:00:00Z', '2026-03-08'],
  ['2026-03-09T04:00:00Z', '2026-03-09'],
  ['2026-11-01T03:59:59Z', '2026-10-31'],
  ['2026-11-01T04:00:00Z', '2026-11-01'],
  ['2026-11-02T05:00:00Z', '2026-11-02'],
] as const) {
  test(`public monitor uses New York release ${date} at ${at}`, async ({ page, baseURL }) => {
    await page.clock.setFixedTime(new Date(at));
    await page.route('**/api/puzzles/today', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(generateDailyPuzzle(date)),
    }));
    expect(await checkPublicGame(page, baseURL!, { now: () => new Date(at) })).toMatchObject({ ok: true, releaseDate: date });
  });
}

test('public monitor detects a missing game UI behind a successful release', async ({ page, baseURL }) => {
  await page.route(baseURL! + '/', (route) => route.fulfill({
    status: 200, contentType: 'text/html',
    body: '<!doctype html><h1>Maintenance</h1><script>fetch("/api/puzzles/today").then(response => response.json())</script>',
  }));
  expect(await checkPublicGame(page, baseURL!)).toMatchObject({ ok: false, reason: 'ui_unavailable', releaseStatus: 200 });
});

test('public monitor detects an unavailable public page', async ({ page, baseURL }) => {
  await page.route(baseURL! + '/', (route) => route.fulfill({ status: 503, body: 'maintenance' }));
  expect(await checkPublicGame(page, baseURL!)).toMatchObject({ ok: false, reason: 'page_http', pageStatus: 503 });
});

test('public monitor rejects a target containing query data before navigation', async ({ page, baseURL }) => {
  let requests = 0;
  page.on('request', () => requests++);
  const result = await checkPublicGame(page, `${baseURL}/?private-config-sentinel`);
  expect(result).toMatchObject({ ok: false, reason: 'invalid_target' });
  expect(requests).toBe(0);
  expect(JSON.stringify(result)).not.toContain('sentinel');
});

test('public monitor detects a redirect to a sign-in page', async ({ page }) => {
  // WebKit cannot fulfill mocked redirects; exercise the real HTTP boundary.
  const server = createServer((request, response) => {
    if (request.url === '/') response.writeHead(302, { Location: '/login' }).end();
    else response.writeHead(200, { 'Content-Type': 'text/html' }).end('<h1>Sign in</h1>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address() as AddressInfo;
    expect(await checkPublicGame(page, `http://127.0.0.1:${port}/`)).toMatchObject({ ok: false, reason: 'page_redirect' });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('public monitor validates the receipt date when a request crosses New York midnight', async ({ page, baseURL }) => {
  let clock = new Date('2026-03-08T04:59:59Z');
  await page.clock.setFixedTime(new Date('2026-03-08T05:00:00Z'));
  await page.route('**/api/puzzles/today', (route) => {
    clock = new Date('2026-03-08T05:00:00Z');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(generateDailyPuzzle('2026-03-08')) });
  });
  expect(await checkPublicGame(page, baseURL!, { now: () => clock }))
    .toMatchObject({ ok: true, releaseDate: '2026-03-08', timestamp: '2026-03-08T04:59:59.000Z' });
});
