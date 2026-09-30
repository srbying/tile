import { createDailyPuzzleApi, decodePuzzleId } from '../../src/features/puzzle/daily-puzzle-api.js';

const api = createDailyPuzzleApi();

export function GET(request: Request): Promise<Response> {
  const puzzleId = new URL(request.url).pathname.split('/').at(-1) ?? '';
  return api.byId(request, decodePuzzleId(puzzleId));
}
