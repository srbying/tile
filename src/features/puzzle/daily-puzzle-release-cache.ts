import { parsePuzzleCandidate, validatePuzzleCandidate } from './puzzle-candidate.js';
import type { DailyPuzzleRelease } from './puzzle.types.js';

export interface DailyPuzzleReleaseCache {
  read(): Promise<unknown | null>;
  write(release: DailyPuzzleRelease): Promise<void>;
  clear(): Promise<void>;
}

interface ResponseCache {
  match(request: RequestInfo | URL): Promise<Response | undefined>;
  put(request: RequestInfo | URL, response: Response): Promise<void>;
  delete(request: RequestInfo | URL): Promise<boolean>;
}

interface CacheStorageLike {
  open(cacheName: string): Promise<ResponseCache>;
}

export interface CurrentPuzzleLoad {
  readonly release: DailyPuzzleRelease;
  readonly source: 'network' | 'cache';
}

interface DailyPuzzleReleaseLoaderDependencies {
  readonly fetcher: (input: string, init: RequestInit) => Promise<Response>;
  readonly cache?: DailyPuzzleReleaseCache;
}

const releaseCacheName = 'tile-current-daily-puzzle-v1';
const releaseCachePath = '/__daily-puzzle-cache__/current';

export function createDailyPuzzleReleaseCache(
  storage: CacheStorageLike,
  origin: string,
): DailyPuzzleReleaseCache {
  const key = new URL(releaseCachePath, origin).toString();
  let cache: Promise<ResponseCache> | undefined;
  const openCache = () => cache ??= storage.open(releaseCacheName);

  return {
    async read() {
      const response = await (await openCache()).match(key);
      if (!response) return null;
      try {
        return await response.json() as unknown;
      } catch {
        await (await openCache()).delete(key);
        return null;
      }
    },
    async write(release) {
      await (await openCache()).put(key, Response.json(release));
    },
    async clear() {
      await (await openCache()).delete(key);
    },
  };
}

export function parseDailyPuzzleRelease(value: unknown): DailyPuzzleRelease | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const release = value as Record<string, unknown>;
  const puzzle = parsePuzzleCandidate(release.puzzle);
  if (!puzzle || release.puzzleId !== puzzle.id || typeof release.releaseDate !== 'string'
    || (release.generatorVersion !== 1 && release.generatorVersion !== 2)
    || !release.puzzleId.startsWith(`daily-v${release.generatorVersion}-`)
    || !validatePuzzleCandidate(puzzle).valid) return null;
  return {
    puzzleId: release.puzzleId,
    releaseDate: release.releaseDate,
    generatorVersion: release.generatorVersion,
    puzzle,
  };
}

export function createDailyPuzzleReleaseLoader(dependencies: DailyPuzzleReleaseLoaderDependencies) {
  const readCachedRelease = async (): Promise<DailyPuzzleRelease | null> => {
    if (!dependencies.cache) return null;
    try {
      const cached = await dependencies.cache.read();
      if (cached === null) return null;
      const release = parseDailyPuzzleRelease(cached);
      if (!release) await dependencies.cache.clear();
      return release;
    } catch {
      return null;
    }
  };

  return async (signal: AbortSignal): Promise<CurrentPuzzleLoad | null> => {
    let response: Response;
    try {
      response = await dependencies.fetcher('/api/puzzles/today', { cache: 'no-store', signal });
    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
      const cached = await readCachedRelease();
      if (cached) return { release: cached, source: 'cache' };
      throw new Error('Daily puzzle is unavailable.');
    }

    if (response.status === 404) return null;
    if (response.status >= 500) {
      const cached = await readCachedRelease();
      if (cached) return { release: cached, source: 'cache' };
      throw new Error('Daily puzzle is unavailable.');
    }
    if (!response.ok) throw new Error('Puzzle request failed.');

    let payload: unknown;
    try {
      payload = await response.json() as unknown;
    } catch {
      throw new Error('Invalid daily puzzle release.');
    }
    const release = parseDailyPuzzleRelease(payload);
    if (!release) throw new Error('Invalid daily puzzle release.');

    try {
      await dependencies.cache?.write(release);
    } catch {
      // Cache failures must not prevent an online round from loading.
    }
    return { release, source: 'network' };
  };
}
