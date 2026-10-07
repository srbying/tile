export interface ResultShareSummary {
  readonly releaseDate: string;
  readonly mode: string;
  readonly status: 'won' | 'lost';
  readonly attemptsUsed: number;
  readonly attemptLimit: number;
  readonly hintUsed: boolean;
}

/** Build a share message from display-safe result fields only. */
export function buildResultShareText(summary: ResultShareSummary): string {
  const outcome = summary.status === 'won' ? 'Solved' : 'Not solved';
  const assistance = summary.hintUsed ? 'Hint used' : 'No hint';

  return [
    `Daily Tile-Swap Puzzle · ${summary.releaseDate}`,
    `${outcome} · ${summary.mode} mode · ${summary.attemptsUsed}/${summary.attemptLimit} swaps · ${assistance}`,
  ].join('\n');
}
