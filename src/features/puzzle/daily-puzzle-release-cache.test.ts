import { describe, expect, it, vi } from 'vitest';
import {
  createDailyPuzzleReleaseCache,
  createDailyPuzzleReleaseLoader,
  parseDailyPuzzleRelease,
} from './daily-puzzle-release-cache';
import { dailyPuzzleFromId, generateDailyPuzzle } from './daily-puzzle-generator';
import type { DailyPuzzleRelease } from './puzzle.types';

const today = generateDailyPuzzle('2026-09-29');
const nextRelease = generateDailyPuzzle('2026-09-30');

const eligibleFailures = [
  ['network error', async () => { throw new TypeError('offline'); }],
  ['429', async () => new Response(null, { status: 429, headers: { 'Retry-After': '60' } })],
  ['500', async () => new Response(null, { status: 500 })],
  ['503', async () => new Response(null, { status: 503 })],
  ['invalid JSON', async () => new Response('{ broken')],
  ['invalid release', async () => Response.json({ ...today, puzzleId: 'other-id' })],
] as const;

function memoryCache(initial: unknown = null) {
  let value = initial;
  return {
    read: vi.fn(async () => value),
    write: vi.fn(async (release: DailyPuzzleRelease) => { value = release; }),
    clear: vi.fn(async () => { value = null; }),
  };
}

describe('daily puzzle release cache', () => {
  it('keeps v1 and v2 releases readable while accepting v3 releases', () => {
    for (const version of [1, 2]) {
      const legacy = dailyPuzzleFromId(`daily-v${version}-2026-09-29-0-0`);
      expect(legacy).not.toBeNull();
      expect(parseDailyPuzzleRelease(legacy)).toEqual(legacy);
    }
    expect(parseDailyPuzzleRelease(today)).toEqual(today);
  });

  it('refreshes old ribbon hints and accepts a shorter visible solution in cached v2 releases', () => {
    const legacy = dailyPuzzleFromId('daily-v2-2026-10-19-16-0')!;
    // A cached hint may refer to the now-equivalent ribbons. Recompute it from the board.
    const cached = { ...legacy, puzzle: { ...legacy.puzzle, hints: { easy: [1, 10], medium: [1, 10], hard: [1, 4] } } };
    expect(parseDailyPuzzleRelease(cached)).toEqual(legacy);
  });

  it('validates and caches the latest successful current-release response', async () => {
    const cache = memoryCache();
    const fetcher = vi.fn(async () => Response.json(today));
    const load = createDailyPuzzleReleaseLoader({ fetcher, cache });
    const signal = new AbortController().signal;

    await expect(load(signal)).resolves.toEqual({ release: today, source: 'network' });
    expect(fetcher).toHaveBeenCalledWith('/api/puzzles/today', { cache: 'no-store', signal: expect.any(AbortSignal) });
    expect(cache.write).toHaveBeenCalledWith(today);
  });

  it('uses a validated cached release after network and server failures', async () => {
    for (const fetcher of [
      vi.fn(async () => { throw new TypeError('offline'); }),
      vi.fn(async () => new Response(null, { status: 503 })),
    ]) {
      const cache = memoryCache(today);
      const load = createDailyPuzzleReleaseLoader({ fetcher, cache });

      await expect(load(new AbortController().signal)).resolves.toEqual({ release: today, source: 'cache' });
      expect(cache.write).not.toHaveBeenCalled();
    }
  });

  it('stops a stalled request after ten seconds and uses the saved release without retrying', async () => {
    vi.useFakeTimers();
    try {
      let requestSignal: AbortSignal | undefined;
      const fetcher = vi.fn((_input: string, init: RequestInit) => {
        requestSignal = init.signal as AbortSignal;
        return new Promise<Response>(() => {});
      });
      const load = createDailyPuzzleReleaseLoader({ fetcher, cache: memoryCache(today) });
      const result = load(new AbortController().signal);
      const assertion = expect(result).resolves.toEqual({ release: today, source: 'cache' });

      await vi.advanceTimersByTimeAsync(10_000);

      expect(requestSignal?.aborted).toBe(true);
      await assertion;
      expect(fetcher).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('includes a stalled response body in the ten-second deadline', async () => {
    vi.useFakeTimers();
    try {
      const response = new Response(new ReadableStream({ start() {} }));
      const load = createDailyPuzzleReleaseLoader({ fetcher: async () => response, cache: memoryCache(today) });
      const result = load(new AbortController().signal);
      const assertion = expect(result).resolves.toEqual({ release: today, source: 'cache' });
      await vi.advanceTimersByTimeAsync(10_000);
      await assertion;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(eligibleFailures)('reports unavailable after %s with no saved release', async (_name, failure) => {
    const fetcher = vi.fn(failure);
    await expect(createDailyPuzzleReleaseLoader({ fetcher })(new AbortController().signal))
      .rejects.toThrow('Daily puzzle is unavailable.');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([400, 401, 403, 404])('does not use cached content or retry after HTTP %s', async (status) => {
    const cache = memoryCache(today);
    const fetcher = vi.fn(async () => new Response(null, { status }));
    const result = createDailyPuzzleReleaseLoader({ fetcher, cache })(new AbortController().signal);
    if (status === 404) await expect(result).resolves.toBeNull();
    else await expect(result).rejects.toThrow('Puzzle request failed.');
    expect(cache.read).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('cancels a stalled load promptly without using or changing cached content', async () => {
    const cache = memoryCache(today);
    const fetcher = vi.fn(() => new Promise<Response>(() => {}));
    const controller = new AbortController();
    const result = createDailyPuzzleReleaseLoader({ fetcher, cache })(controller.signal);
    const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await assertion;
    expect(cache.read).not.toHaveBeenCalled();
    expect(cache.write).not.toHaveBeenCalled();
  });

  it('bounds unavailable cache storage so it cannot keep the loading state hanging', async () => {
    vi.useFakeTimers();
    try {
      const cache = { ...memoryCache(), read: () => new Promise<null>(() => {}) };
      const load = createDailyPuzzleReleaseLoader({
        fetcher: async () => { throw new TypeError('offline'); }, cache,
      });
      const assertion = expect(load(new AbortController().signal)).rejects.toThrow('Daily puzzle is unavailable.');
      await vi.advanceTimersByTimeAsync(1_000);
      await assertion;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(eligibleFailures)('reports unavailable after %s when the saved release is corrupt', async (_name, failure) => {
    const cache = memoryCache({ ...today, releaseDate: 'not-a-date' });
    const fetcher = vi.fn(failure);
    await expect(createDailyPuzzleReleaseLoader({ fetcher, cache })(new AbortController().signal))
      .rejects.toThrow('Daily puzzle is unavailable.');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(await cache.read()).toBeNull();
  });

  it('keeps online play available when cache reads and writes throw', async () => {
    const cache = {
      read: async () => { throw new Error('Storage blocked'); },
      write: async () => { throw new Error('Storage blocked'); },
      clear: async () => { throw new Error('Storage blocked'); },
    };
    await expect(createDailyPuzzleReleaseLoader({ fetcher: async () => Response.json(today), cache })(new AbortController().signal))
      .resolves.toEqual({ release: today, source: 'network' });
    await expect(createDailyPuzzleReleaseLoader({ fetcher: async () => { throw new TypeError('offline'); }, cache })(new AbortController().signal))
      .rejects.toThrow('Daily puzzle is unavailable.');
  });

  it('does not let a stalled cache write block a valid online release', async () => {
    vi.useFakeTimers();
    try {
      const cache = { ...memoryCache(), write: () => new Promise<void>(() => {}) };
      const load = createDailyPuzzleReleaseLoader({ fetcher: async () => Response.json(today), cache });
      const assertion = expect(load(new AbortController().signal)).resolves.toEqual({ release: today, source: 'network' });
      await vi.advanceTimersByTimeAsync(1_000);
      await assertion;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('replaces the single cached release when a newer daily response arrives', async () => {
    const cache = memoryCache(today);
    const fetcher = vi.fn(async () => Response.json(nextRelease));
    const load = createDailyPuzzleReleaseLoader({ fetcher, cache });

    await expect(load(new AbortController().signal)).resolves.toEqual({ release: nextRelease, source: 'network' });
    expect(cache.write).toHaveBeenCalledTimes(1);
    expect(cache.write).toHaveBeenCalledWith(nextRelease);
    expect(await cache.read()).toEqual(nextRelease);
  });

  it.each(eligibleFailures)('uses only the validated saved release after %s, without retrying', async (_name, failure) => {
    const cache = memoryCache(today);
    const fetcher = vi.fn(failure);
    const load = createDailyPuzzleReleaseLoader({ fetcher, cache });
    await expect(load(new AbortController().signal)).resolves.toEqual({ release: today, source: 'cache' });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(cache.write).not.toHaveBeenCalled();
    expect(await cache.read()).toEqual(today);
  });

  it('rejects corrupt cached releases instead of trusting them', async () => {
    const malformedCache = memoryCache({ ...today, generatorVersion: 4 });
    const offline = createDailyPuzzleReleaseLoader({
      fetcher: vi.fn(async () => { throw new TypeError('offline'); }),
      cache: malformedCache,
    });
    await expect(offline(new AbortController().signal)).rejects.toThrow('Daily puzzle is unavailable.');
    expect(malformedCache.clear).toHaveBeenCalledOnce();
  });

  it.each([
    ['a different date', { ...today, releaseDate: '2026-09-30' }],
    ['an impossible date', { ...today, releaseDate: '2026-02-30', puzzleId: 'daily-v3-2026-02-30-0-0', puzzle: { ...today.puzzle, id: 'daily-v3-2026-02-30-0-0' } }],
    ['an invalid identity', { ...today, puzzleId: 'daily-v3-unknown', puzzle: { ...today.puzzle, id: 'daily-v3-unknown' } }],
    ['a broken board', { ...today, puzzle: { ...today.puzzle, target: [] } }],
  ])('rejects a release with %s', (_name, release) => {
    expect(parseDailyPuzzleRelease(release)).toBeNull();
  });

  it('stores one cache entry under a client-only key, never an API route', async () => {
    const entries = new Map<string, Response>();
    const cache = {
      match: vi.fn(async (key: RequestInfo | URL) => entries.get(String(key))?.clone()),
      put: vi.fn(async (key: RequestInfo | URL, response: Response) => { entries.set(String(key), response.clone()); }),
      delete: vi.fn(async (key: RequestInfo | URL) => entries.delete(String(key))),
    };
    const storage = { open: vi.fn(async () => cache) };
    const releaseCache = createDailyPuzzleReleaseCache(storage, 'https://tile.example');

    await releaseCache.write(today);
    await releaseCache.write(nextRelease);

    expect(storage.open).toHaveBeenCalledWith('tile-current-daily-puzzle-v1');
    expect(entries.size).toBe(1);
    const [key] = entries.keys();
    expect(key).toBe('https://tile.example/__daily-puzzle-cache__/current');
    expect(key).not.toContain('/api/puzzles/');
    await expect(releaseCache.read()).resolves.toEqual(nextRelease);
  });

  it('discards corrupt Cache Storage data', async () => {
    const key = 'https://tile.example/__daily-puzzle-cache__/current';
    const entries = new Map([[key, new Response('{ invalid json')]]);
    const cache = {
      match: vi.fn(async (request: RequestInfo | URL) => entries.get(String(request))?.clone()),
      put: vi.fn(async (request: RequestInfo | URL, response: Response) => { entries.set(String(request), response.clone()); }),
      delete: vi.fn(async (request: RequestInfo | URL) => entries.delete(String(request))),
    };
    const releaseCache = createDailyPuzzleReleaseCache({ open: async () => cache }, 'https://tile.example');

    await expect(releaseCache.read()).resolves.toBeNull();
    expect(cache.delete).toHaveBeenCalledWith(key);
    expect(entries.size).toBe(0);
  });
});
