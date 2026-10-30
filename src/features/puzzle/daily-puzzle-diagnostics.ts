export interface DailyPuzzleFailure {
  readonly event: 'daily_puzzle_failure';
  readonly operation: 'today' | 'by_id' | 'load_today';
  readonly reason: 'generation' | 'invalid_release' | 'wrong_date' | 'serialization'
    | 'network' | 'http' | 'invalid_json' | 'timeout';
  readonly timestamp: string;
  readonly durationMilliseconds: number;
  readonly status?: number;
  readonly releaseDate?: string;
  readonly puzzleId?: string;
}

export type DailyPuzzleFailureReporter = (failure: DailyPuzzleFailure) => void | Promise<void>;

// Only allowlisted fields reach this boundary. Never pass an Error, Request,
// response body, or player state. Diagnostics cannot interfere with delivery.
export function reportDailyPuzzleFailure(
  details: Omit<DailyPuzzleFailure, 'event' | 'durationMilliseconds'>,
  started: number,
  reporter: DailyPuzzleFailureReporter = (failure) => console.error(JSON.stringify(failure)),
): void {
  try {
    void Promise.resolve(reporter({
      event: 'daily_puzzle_failure',
      ...details,
      durationMilliseconds: Math.max(0, Math.round(performance.now() - started)),
    })).catch(() => {});
  } catch {
    // A broken logging destination must not break the game.
  }
}
