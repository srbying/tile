import { describe, expect, it, vi } from 'vitest';
import { createDailyPuzzleReleaseCache, createDailyPuzzleReleaseLoader } from './daily-puzzle-release-cache';
import { generateDailyPuzzle } from './daily-puzzle-generator';
import type { DailyPuzzleRelease } from './puzzle.types';

const today = generateDailyPuzzle('2026-09-29');
const nextRelease = generateDailyPuzzle('2026-09-30');

function memoryCache(initial: unknown = null) {
  let value = initial;
  return {
    read: vi.fn(async () => value),
    write: vi.fn(async (release: DailyPuzzleRelease) => { value = release; }),
    clear: vi.fn(async () => { value = null; }),
  };
}

describe('daily puzzle release cache', () => {
  it('validates and caches the latest successful current-release response', async () => {
    const cache = memoryCache();
    const fetcher = vi.fn(async () => Response.json(today));
    const load = createDailyPuzzleReleaseLoader({ fetcher, cache });
    const signal = new AbortController().signal;

    await expect(load(signal)).resolves.toEqual({ release: today, source: 'network' });
    expect(fetcher).toHaveBeenCalledWith('/api/puzzles/today', { cache: 'no-store', signal });
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

  it('replaces the single cached release when a newer daily response arrives', async () => {
    const cache = memoryCache(today);
    const fetcher = vi.fn(async () => Response.json(nextRelease));
    const load = createDailyPuzzleReleaseLoader({ fetcher, cache });

    await expect(load(new AbortController().signal)).resolves.toEqual({ release: nextRelease, source: 'network' });
    expect(cache.write).toHaveBeenCalledTimes(1);
    expect(cache.write).toHaveBeenCalledWith(nextRelease);
    expect(await cache.read()).toEqual(nextRelease);
  });

  it('rejects malformed live and cached releases instead of trusting them', async () => {
    const malformedLive = createDailyPuzzleReleaseLoader({
      fetcher: vi.fn(async () => Response.json({ ...today, puzzleId: 'other-id' })),
      cache: memoryCache(today),
    });
    await expect(malformedLive(new AbortController().signal)).rejects.toThrow('Invalid daily puzzle release.');

    const malformedCache = memoryCache({ ...today, generatorVersion: 2 });
    const offline = createDailyPuzzleReleaseLoader({
      fetcher: vi.fn(async () => { throw new TypeError('offline'); }),
      cache: malformedCache,
    });
    await expect(offline(new AbortController().signal)).rejects.toThrow('Daily puzzle is unavailable.');
    expect(malformedCache.clear).toHaveBeenCalledOnce();
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
