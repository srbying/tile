import { expect, test } from '@playwright/test';

test('query and encoded aliases redirect once to unchanged canonical releases', async ({ request, baseURL }) => {
  for (const path of ['/api/puzzles/today', ...[1, 2, 3].map(version => `/api/puzzles/daily-v${version}-2026-09-29-44-3`)]) {
    const canonical = await request.get(path);
    expect(canonical.status()).toBe(200);
    const expected = await canonical.json();
    // Playwright strips a bare '?' from the HTTP request target; the API unit test covers it.
    const aliases = [`${path}?next=https://attacker.example`, `${path}?cacheBust=`];
    if (!path.endsWith('/today')) aliases.push(path.replace('/daily-', '/%64aily-'));
    for (const alias of aliases) {
      const redirect = await request.get(alias, { maxRedirects: 0 });
      expect(redirect.status()).toBe(308);
      expect(redirect.headers()['location']).toBe(path);
      expect(new URL(redirect.headers()['location']!, baseURL).origin).toBe(new URL(baseURL!).origin);
      expect(redirect.headers()['cache-control']).toBe('no-store');
      expect(redirect.headers()['cdn-cache-control']).toBe('no-store');
      const followed = await request.get(alias, { maxRedirects: 1 });
      expect(followed.status()).toBe(200);
      expect(await followed.json()).toEqual(expected);
      if (path.endsWith('/today')) expect(followed.headers()['cdn-cache-control']).toMatch(/^public, s-maxage=\d+, must-revalidate,/);
      else expect(followed.headers()['cdn-cache-control']).toBe(canonical.headers()['cdn-cache-control']);
    }
  }
});

test('malformed and future aliases return uncached errors without redirecting', async ({ request }) => {
  for (const id of ['%E0%A4%A', 'x'.repeat(73), 'daily-v4-2026-09-29-0-0', 'daily-v3-2026-02-29-0-0', 'daily-v3-9999-12-31-0-0']) {
    const response = await request.get(`/api/puzzles/${id}?cacheBust=1`, { maxRedirects: 0 });
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: 'Puzzle not found.' });
    expect(response.headers()['location']).toBeUndefined();
    expect(response.headers()['cache-control']).toBe('no-store');
    expect(response.headers()['cdn-cache-control']).toBe('no-store');
  }
});

test('100 independent clients sharing a network can load today and supported historical releases', async ({ playwright, baseURL }) => {
  // A local application compatibility check, not a simulation of Vercel's WAF.
  const clients = await Promise.all(Array.from({ length: 100 }, () => playwright.request.newContext({
    baseURL, extraHTTPHeaders: { 'X-Forwarded-For': '192.0.2.1' },
  })));
  try {
    for (let offset = 0; offset < clients.length; offset += 10) {
      await Promise.all(clients.slice(offset, offset + 10).map(async (client, index) => {
        const today = await client.get('/api/puzzles/today');
        expect(today.status()).toBe(200);
        const release = await today.json();
        expect(release.puzzleId).toBe(release.puzzle.id);
        const version = (offset + index) % 3 + 1;
        const id = `daily-v${version}-2026-09-29-44-3`;
        const historical = await client.get(`/api/puzzles/${id}`);
        expect(historical.status()).toBe(200);
        expect((await historical.json()).puzzleId).toBe(id);
        expect(historical.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
      }));
    }
  } finally {
    await Promise.all(clients.map(client => client.dispose()));
  }
});
