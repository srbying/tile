import type { SameAppearance, TileAppearance } from './puzzle.types.js';

export type HintPositions = readonly [number, number];

/** Returns the first deterministic swap that improves the visible match count. */
export function findProductiveHint(
  board: readonly TileAppearance[],
  target: readonly TileAppearance[],
  sameAppearance: SameAppearance,
): HintPositions | null {
  if (board.length !== target.length) return null;

  for (let left = 0; left < board.length - 1; left++) {
    for (let right = left + 1; right < board.length; right++) {
      const before = Number(sameAppearance(board[left]!, target[left]!))
        + Number(sameAppearance(board[right]!, target[right]!));
      const after = Number(sameAppearance(board[right]!, target[left]!))
        + Number(sameAppearance(board[left]!, target[right]!));
      if (after > before) return [left, right];
    }
  }

  return null;
}
