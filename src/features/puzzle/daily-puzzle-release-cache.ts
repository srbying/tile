import { getNewYorkPuzzleDate } from './daily-puzzle-generator.js';
import { parsePuzzleCandidate, validatePuzzleCandidate } from './puzzle-candidate.js';
import type { DailyPuzzleRelease, PuzzleCandidate } from './puzzle.types.js';

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
  readonly now?: () => Date;
  readonly fetcher: (input: string, init: RequestInit) => Promise<Response>;
  readonly cache?: DailyPuzzleReleaseCache;
}

const releaseCacheName = 'tile-current-daily-puzzle-v1';
const releaseCachePath = '/__daily-puzzle-cache__/current';
const requestTimeoutMilliseconds = 10_000;
const cacheTimeoutMilliseconds = 1_000;

// Race the operation as well as aborting it: a stalled body or storage API may
// not cooperate with cancellation. Always remove the deadline and listener.
async function withDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
  milliseconds: number,
): Promise<T> {
  signal.throwIfAborted();
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout>;
  let cancel: () => void;
  const interrupted = new Promise<never>((_resolve, reject) => {
    cancel = () => {
      reject(signal.reason);
      controller.abort();
    };
    signal.addEventListener('abort', cancel, { once: true });
    timeout = setTimeout(() => {
      reject(new Error('Daily puzzle request timed out.'));
      controller.abort();
    }, milliseconds);
  });
  try {
    return await Promise.race([operation(controller.signal), interrupted]);
  } finally {
    clearTimeout(timeout!);
    signal.removeEventListener('abort', cancel!);
  }
}

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
    || (release.generatorVersion !== 1 && release.generatorVersion !== 2 && release.generatorVersion !== 3)
    || !release.puzzleId.startsWith(`daily-v${release.generatorVersion}-${release.releaseDate}-`)) return null;
  const identity = /^daily-v([123])-(\d{4}-\d{2}-\d{2})-(\d+)-(\d+)$/.exec(release.puzzleId);
  const date = new Date(`${release.releaseDate}T00:00:00.000Z`);
  if (!identity || identity[2] !== release.releaseDate || !Number.isFinite(date.valueOf())
    || date.toISOString().slice(0, 10) !== release.releaseDate) return null;
  // v2 may contain an invisible ribbon swap or a hint for one. Keep its board,
  // but validate the corrected visible solution and refresh its hints.
  const isV2 = release.generatorVersion === 2;
  const candidate = isV2 ? { ...puzzle, hints: undefined } : puzzle;
  const validation = validatePuzzleCandidate(candidate, { allowShorterSolution: isV2 });
  if (!validation.valid) return null;
  const hints = Object.fromEntries(validation.tiers.map(({ tierId, hint }) => [tierId, hint])) as PuzzleCandidate['hints'];
  return {
    puzzleId: release.puzzleId,
    releaseDate: release.releaseDate,
    generatorVersion: release.generatorVersion,
    puzzle: isV2 ? { ...puzzle, hints } : puzzle,
  };
}

export function createDailyPuzzleReleaseLoader(dependencies: DailyPuzzleReleaseLoaderDependencies) {
  const now = dependencies.now ?? (() => new Date());
  const readCachedRelease = async (): Promise<DailyPuzzleRelease | null> => {
    if (!dependencies.cache) return null;
    try {
      const cached = await dependencies.cache.read();
      if (cached === null) return null;
      const release = parseDailyPuzzleRelease(cached);
      if (!release || release.releaseDate > getNewYorkPuzzleDate(now())) {
        await dependencies.cache.clear();
        return null;
      }
      return release;
    } catch {
      return null;
    }
  };

  return async (signal: AbortSignal): Promise<CurrentPuzzleLoad | null> => {
    let release: DailyPuzzleRelease | null;
    try {
      release = await withDeadline(
        async (requestSignal) => {
          const response = await dependencies.fetcher('/api/puzzles/today', { cache: 'default', signal: requestSignal });
          if (response.status === 404) return null;
          if (response.status === 429 || response.status >= 500) throw new Error('Daily puzzle is unavailable.');
          if (!response.ok) throw new PuzzleRequestError('Puzzle request failed.');

          const payload: unknown = await response.json();
          const parsed = parseDailyPuzzleRelease(payload);
          // Check at receipt time: an in-flight request may cross midnight.
          if (!parsed || parsed.releaseDate !== getNewYorkPuzzleDate(now())) {
            throw new Error('Invalid daily puzzle release.');
          }
          return parsed;
        },
        signal,
        requestTimeoutMilliseconds,
      );
    } catch (error) {
      if (signal.aborted || error instanceof PuzzleRequestError) throw error;
      const cached = await withDeadline(readCachedRelease, signal, cacheTimeoutMilliseconds).catch(() => null);
      signal.throwIfAborted();
      if (cached) return { release: cached, source: 'cache' };
      throw new Error('Daily puzzle is unavailable.');
    }
    if (!release) return null;

    try {
      await withDeadline(async () => dependencies.cache?.write(release), signal, cacheTimeoutMilliseconds);
    } catch {
      // Cache failures must not prevent an online round from loading.
    }
    signal.throwIfAborted();
    return { release, source: 'network' };
  };
}

// Other HTTP client errors are not eligible for a cached fallback.
class PuzzleRequestError extends Error {}
