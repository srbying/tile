import { dailyPuzzleFromId, getDailyPuzzleForNow, getNextNewYorkMidnight, getNewYorkPuzzleDate } from './daily-puzzle-generator.js';
import { parseDailyPuzzleRelease } from './daily-puzzle-release-cache.js';
import type { DailyPuzzleRelease } from './puzzle.types.js';

export interface DailyPuzzleApiDependencies {
  readonly now?: () => Date;
  readonly getToday?: (now: Date) => DailyPuzzleRelease;
  readonly getById?: (puzzleId: string) => DailyPuzzleRelease | null;
}

const noStoreHeaders = { 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store' };

function methodNotAllowed(): Response {
  return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: { ...noStoreHeaders, Allow: 'GET' } });
}

export function decodePuzzleId(encodedPuzzleId: string): string {
  try {
    return decodeURIComponent(encodedPuzzleId);
  } catch {
    return '';
  }
}

export function createDailyPuzzleApi(dependencies: DailyPuzzleApiDependencies = {}) {
  const now = dependencies.now ?? (() => new Date());
  const getToday = dependencies.getToday ?? getDailyPuzzleForNow;
  const getById = dependencies.getById ?? dailyPuzzleFromId;

  return {
    async today(request: Request): Promise<Response> {
      if (request.method !== 'GET') return methodNotAllowed();
      try {
        // A cold generation can straddle midnight. Retry once for the new date.
        for (let attempt = 0; attempt < 2; attempt++) {
          const release = parseDailyPuzzleRelease(getToday(now()));
          if (!release) throw new Error('Invalid current release.');
          const responseAt = now();
          if (release.releaseDate !== getNewYorkPuzzleDate(responseAt)) continue;
          const expires = getNextNewYorkMidnight(responseAt);
          const seconds = Math.floor((expires.getTime() - responseAt.getTime()) / 1000);
          return Response.json(release, {
            headers: {
              'Cache-Control': 'no-store',
              'CDN-Cache-Control': seconds > 0
                ? `public, s-maxage=${seconds}, must-revalidate, stale-while-revalidate=0, stale-if-error=0`
                : 'no-store',
              Date: responseAt.toUTCString(),
              Expires: expires.toUTCString(),
            },
          });
        }
        throw new Error('Current release date changed during generation.');
      } catch {
        return Response.json(
          { error: 'Today’s puzzle is temporarily unavailable.' },
          { status: 503, headers: noStoreHeaders },
        );
      }
    },

    async byId(request: Request, puzzleId: string): Promise<Response> {
      if (request.method !== 'GET') return methodNotAllowed();
      const release = getById(puzzleId);
      if (!release || release.releaseDate > getNewYorkPuzzleDate(now())) {
        return Response.json({ error: 'Puzzle not found.' }, { status: 404, headers: noStoreHeaders });
      }
      return Response.json(release, { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } });
    },
  };
}
