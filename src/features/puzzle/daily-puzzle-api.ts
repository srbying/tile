import { dailyPuzzleFromId, getDailyPuzzleForNow } from './daily-puzzle-generator.js';
import type { DailyPuzzleRelease } from './puzzle.types.js';

export interface DailyPuzzleApiDependencies {
  readonly now?: () => Date;
  readonly getToday?: (now: Date) => DailyPuzzleRelease;
  readonly getById?: (puzzleId: string) => DailyPuzzleRelease | null;
}

function methodNotAllowed(): Response {
  return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: { Allow: 'GET' } });
}

export function createDailyPuzzleApi(dependencies: DailyPuzzleApiDependencies = {}) {
  const now = dependencies.now ?? (() => new Date());
  const getToday = dependencies.getToday ?? getDailyPuzzleForNow;
  const getById = dependencies.getById ?? dailyPuzzleFromId;

  return {
    async today(request: Request): Promise<Response> {
      if (request.method !== 'GET') return methodNotAllowed();
      try {
        const release = getToday(now());
        return Response.json(release, { headers: { 'Cache-Control': 'no-store' } });
      } catch {
        return Response.json(
          { error: 'Today’s puzzle is temporarily unavailable.' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } },
        );
      }
    },

    async byId(request: Request, puzzleId: string): Promise<Response> {
      if (request.method !== 'GET') return methodNotAllowed();
      const release = getById(puzzleId);
      if (!release) {
        return Response.json({ error: 'Puzzle not found.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
      }
      return Response.json(release, { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } });
    },
  };
}
