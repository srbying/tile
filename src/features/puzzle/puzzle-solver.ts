import type { SameAppearance, TileAppearance } from './puzzle.types.js';

/** Return exact minimum whole-tile swaps, using visible equivalence; null means inventories differ. */
export function minimumVisibleSwaps(
  board: readonly TileAppearance[],
  target: readonly TileAppearance[],
  sameAppearance: SameAppearance,
): number | null {
  if (board.length !== target.length) return null;

  const representatives: TileAppearance[] = [];
  const classOf = (tile: TileAppearance) => {
    let classIndex = representatives.findIndex((representative) => sameAppearance(representative, tile));
    if (classIndex < 0) {
      classIndex = representatives.length;
      representatives.push(tile);
    }
    return classIndex;
  };
  const targetClasses = target.map(classOf);
  const boardClasses = board.map(classOf);
  const inventory = new Map<number, number>();
  for (const classIndex of targetClasses) inventory.set(classIndex, (inventory.get(classIndex) ?? 0) + 1);
  for (const classIndex of boardClasses) inventory.set(classIndex, (inventory.get(classIndex) ?? 0) - 1);
  if ([...inventory.values()].some((count) => count !== 0)) return null;

  const memo = new Map<string, number>();
  function solve(state: readonly number[]): number {
    let firstMismatch = 0;
    while (firstMismatch < state.length && state[firstMismatch] === targetClasses[firstMismatch]) firstMismatch++;
    if (firstMismatch === state.length) return 0;

    const key = state.join(',');
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    let mismatches = 0;
    for (let index = firstMismatch; index < state.length; index++) {
      if (state[index] !== targetClasses[index]) mismatches++;
    }
    const lowerBound = Math.ceil(mismatches / 2);
    let minimum = Number.POSITIVE_INFINITY;
    const next = [...state];
    for (let partner = firstMismatch + 1; partner < state.length; partner++) {
      if (state[partner] !== targetClasses[firstMismatch]
        || state[partner] === targetClasses[partner]) continue;

      [next[firstMismatch], next[partner]] = [next[partner]!, next[firstMismatch]!];
      const remaining = solve(next);
      minimum = Math.min(minimum, 1 + remaining);
      [next[firstMismatch], next[partner]] = [next[partner]!, next[firstMismatch]!];
      if (minimum === lowerBound) break;
    }

    memo.set(key, minimum);
    return minimum;
  }

  return solve(boardClasses);
}
