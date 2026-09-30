import { createDailyPuzzleApi } from '../../src/features/puzzle/daily-puzzle-api.js';

const api = createDailyPuzzleApi();

export function GET(request: Request): Promise<Response> {
  return api.today(request);
}
