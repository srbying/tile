import { createDailyPuzzleApi } from '../../src/features/puzzle/daily-puzzle-api';

const api = createDailyPuzzleApi();

export default function handler(request: Request): Promise<Response> {
  const puzzleId = new URL(request.url).pathname.split('/').at(-1) ?? '';
  return api.byId(request, decodeURIComponent(puzzleId));
}
