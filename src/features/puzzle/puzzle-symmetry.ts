import { visualKey } from './tile-appearance';
import type { QuarterTurn, TileAppearance } from './puzzle.types';

export type BoardReflection = 'none' | 'horizontal';

function rotatePosition(position: number, turns: number, size: number): number {
  let row = Math.floor(position / size);
  let column = position % size;
  for (let turn = 0; turn < turns; turn++) [row, column] = [column, size - 1 - row];
  return row * size + column;
}

function transformTile(tile: TileAppearance, turns: number, reflected: boolean): TileAppearance {
  const orientation = reflected
    ? ((360 - tile.orientation + turns * 90) % 360) as QuarterTurn
    : ((tile.orientation + turns * 90) % 360) as QuarterTurn;
  return { ...tile, orientation, mirrored: tile.mirrored !== reflected };
}

/** Canonical visible target across whole-board rotations and reflections. */
export function canonicalBoardTargetKey(tiles: readonly TileAppearance[], size: number): string {
  const keys: string[] = [];
  for (const reflected of [false, true]) {
    for (let turns = 0; turns < 4; turns++) {
      const transformed = Array.from({ length: tiles.length }, () => '');
      tiles.forEach((tile, position) => {
        const reflectedPosition = reflected
          ? Math.floor(position / size) * size + (size - 1 - position % size)
          : position;
        const destination = rotatePosition(reflectedPosition, turns, size);
        transformed[destination] = visualKey(transformTile(tile, turns, reflected));
      });
      keys.push(transformed.join('|'));
    }
  }
  return keys.sort()[0]!;
}

export function hasRecentVisualDuplicate(
  target: readonly TileAppearance[],
  size: number,
  recentTargets: readonly (readonly TileAppearance[])[],
): boolean {
  const key = canonicalBoardTargetKey(target, size);
  return recentTargets.some((recent) => recent.length === target.length
    && canonicalBoardTargetKey(recent, size) === key);
}
