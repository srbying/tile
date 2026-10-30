import { dailyPuzzleFromId, getDailyPuzzleForNow, getNextNewYorkMidnight, getNewYorkPuzzleDate } from './daily-puzzle-generator.js';
import { parseDailyPuzzleRelease } from './daily-puzzle-release-cache.js';
import type { DailyPuzzleRelease } from './puzzle.types.js';
import { parseDailyPuzzleId } from './daily-puzzle-identity.js';
import { reportDailyPuzzleFailure } from './daily-puzzle-diagnostics.js';
import type { DailyPuzzleFailure, DailyPuzzleFailureReporter } from './daily-puzzle-diagnostics.js';

export interface DailyPuzzleApiDependencies {
  readonly now?: () => Date;
  readonly getToday?: (now: Date) => DailyPuzzleRelease;
  readonly getById?: (puzzleId: string) => DailyPuzzleRelease | null;
  readonly reportFailure?: DailyPuzzleFailureReporter;
}

const noStoreHeaders = { 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store' };

function methodNotAllowed(): Response {
  return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: { ...noStoreHeaders, Allow: 'GET' } });
}

function canonicalRedirect(request: Request, path: string): Response | null {
  if (request.url === new URL(path, request.url).href) return null;
  return new Response(null, { status: 308, headers: { ...noStoreHeaders, Location: path } });
}

export function decodePuzzleId(encodedPuzzleId: string): string {
  // Supported IDs contain at most 24 ASCII characters, each optionally %HH encoded.
  if (encodedPuzzleId.length > 72) return '';
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
      const redirect = canonicalRedirect(request, '/api/puzzles/today');
      if (redirect) return redirect;
      const started = performance.now();
      let reason: DailyPuzzleFailure['reason'] = 'generation';
      let puzzleId: string | undefined;
      try {
        // A cold generation can straddle midnight. Retry once for the new date.
        for (let attempt = 0; attempt < 2; attempt++) {
          reason = 'generation';
          const provided = getToday(now());
          reason = 'invalid_release';
          const release = parseDailyPuzzleRelease(provided);
          if (!release) throw new Error('Invalid current release.');
          const responseAt = now();
          reason = 'wrong_date';
          if (release.releaseDate !== getNewYorkPuzzleDate(responseAt)) continue;
          puzzleId = release.puzzleId;
          reason = 'serialization';
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
        const failedAt = now();
        reportDailyPuzzleFailure({
          operation: 'today', reason, timestamp: failedAt.toISOString(),
          releaseDate: getNewYorkPuzzleDate(failedAt), status: 503,
          ...(puzzleId ? { puzzleId } : {}),
        }, started, dependencies.reportFailure);
        return Response.json(
          { error: 'Today’s puzzle is temporarily unavailable.' },
          { status: 503, headers: noStoreHeaders },
        );
      }
    },

    async byId(request: Request, puzzleId: string): Promise<Response> {
      if (request.method !== 'GET') return methodNotAllowed();
      const identity = parseDailyPuzzleId(puzzleId);
      if (!identity || identity.releaseDate > getNewYorkPuzzleDate(now())) {
        return Response.json({ error: 'Puzzle not found.' }, { status: 404, headers: noStoreHeaders });
      }
      const redirect = canonicalRedirect(request, `/api/puzzles/${puzzleId}`);
      if (redirect) return redirect;
      const started = performance.now();
      let reason: DailyPuzzleFailure['reason'] = 'generation';
      try {
        const provided = getById(puzzleId);
        if (!provided) {
          return Response.json({ error: 'Puzzle not found.' }, { status: 404, headers: noStoreHeaders });
        }
        reason = 'invalid_release';
        const release = parseDailyPuzzleRelease(provided);
        if (!release || release.puzzleId !== puzzleId) throw new Error('Invalid historical release.');
        reason = 'serialization';
        return Response.json(release, { headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
          'CDN-Cache-Control': 'public, s-maxage=31536000, immutable',
        } });
      } catch {
        reportDailyPuzzleFailure({
          operation: 'by_id', reason, timestamp: now().toISOString(),
          puzzleId, releaseDate: identity.releaseDate, status: 503,
        }, started, dependencies.reportFailure);
        return Response.json(
          { error: 'Puzzle is temporarily unavailable.' },
          { status: 503, headers: noStoreHeaders },
        );
      }
    },
  };
}
