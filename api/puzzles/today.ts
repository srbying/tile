import { createDailyPuzzleApi } from '../../src/features/puzzle/daily-puzzle-api';

const api = createDailyPuzzleApi();

export default function handler(request: Request): Promise<Response> {
  return api.today(request);
}
