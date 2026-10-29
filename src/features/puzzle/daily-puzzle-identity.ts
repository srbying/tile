export interface DailyPuzzleIdentity {
  readonly generatorVersion: 1 | 2 | 3;
  readonly releaseDate: string;
  readonly variation: number;
  readonly scramble: number;
}

export function parseDailyPuzzleId(puzzleId: string): DailyPuzzleIdentity | null {
  // Bound work before matching or parsing attacker-controlled input.
  if (puzzleId.length < 23 || puzzleId.length > 24) return null;
  const match = /^daily-v([123])-(\d{4}-\d{2}-\d{2})-(0|[1-9]\d?)-([0-3])$/.exec(puzzleId);
  if (!match || match[0] !== puzzleId) return null;
  const generatorVersion = Number(match[1]) as DailyPuzzleIdentity['generatorVersion'];
  const releaseDate = match[2]!;
  const variation = Number(match[3]);
  const scramble = Number(match[4]);
  // Historical bounds belong to their version, not the current art catalog.
  if (variation >= (generatorVersion === 1 ? 67 : 45)) return null;
  const date = new Date(`${releaseDate}T00:00:00.000Z`);
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== releaseDate) return null;
  return { generatorVersion, releaseDate, variation, scramble };
}
