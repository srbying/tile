import { describe, expect, it } from 'vitest';
import { minimumVisibleSwaps } from './puzzle-solver';
import { sameAppearance } from './tile-appearance';
import type { TileAppearance } from './puzzle.types';

const tile = (motif: TileAppearance['motif'], color: TileAppearance['color'] = 'teal', orientation: TileAppearance['orientation'] = 0): TileAppearance => ({
  motif,
  color,
  strokeWeight: 7,
  orientation,
  inverted: false,
  mirrored: false,
});

describe('minimum visible swaps', () => {
  it('counts disjoint cycles for distinct visible tiles', () => {
    const target = [tile('meander'), tile('chevron'), tile('diamond'), tile('meander', 'terracotta')];
    const board = [target[1]!, target[0]!, target[3]!, target[2]!];

    expect(minimumVisibleSwaps(board, target, sameAppearance)).toBe(2);
  });

  it('uses visible equivalence when identical tiles have different hidden attributes', () => {
    const target = [tile('diamond'), tile('chevron'), tile('meander')];
    const visuallyEquivalentDiamond = tile('diamond', 'teal', 90);
    const board = [target[1]!, visuallyEquivalentDiamond, target[2]!];

    expect(sameAppearance(visuallyEquivalentDiamond, target[0]!)).toBe(true);
    expect(minimumVisibleSwaps(board, target, sameAppearance)).toBe(1);
  });

  it('finds the shortest solution when visible classes contain duplicates', () => {
    const a = tile('diamond');
    const b = tile('chevron');
    const c = tile('meander');
    const target = [a, a, b, b, c];
    const board = [b, a, a, b, c];

    expect(minimumVisibleSwaps(board, target, sameAppearance)).toBe(1);
  });

  it('reports an impossible board when visible inventories differ', () => {
    const target = [tile('diamond'), tile('chevron')];
    const board = [tile('diamond'), tile('meander')];

    expect(minimumVisibleSwaps(board, target, sameAppearance)).toBeNull();
  });
});
