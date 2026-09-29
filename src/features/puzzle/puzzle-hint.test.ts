import { describe, expect, it } from 'vitest';
import { findProductiveHint } from './puzzle-hint';
import { sameAppearance } from './tile-appearance';
import type { TileAppearance } from './puzzle.types';

const plain: TileAppearance = {
  motif: 'diamond', color: 'teal', strokeWeight: 4, orientation: 0, inverted: false, mirrored: false,
};
const decorated: TileAppearance = {
  motif: 'meander', color: 'terracotta', strokeWeight: 7, orientation: 90, inverted: true, mirrored: true,
};
const target = Array.from({ length: 36 }, (_, position) => position === 35 ? decorated : plain);
const start = Array.from({ length: 36 }, (_, position) => position === 0 ? decorated : plain);

describe('findProductiveHint', () => {
  it('returns deterministic swap that strictly increases visibly correct cells', () => {
    expect(findProductiveHint(start, target, sameAppearance)).toEqual([0, 35]);
  });

  it('uses visual equivalence instead of tile object identity', () => {
    const symmetricPlain: TileAppearance = { ...plain, orientation: 180, mirrored: true };
    const equivalentTarget = [...target];
    equivalentTarget[0] = symmetricPlain;
    const alternateBoard = [...start];
    [alternateBoard[0], alternateBoard[10]] = [alternateBoard[10]!, alternateBoard[0]!];

    expect(sameAppearance(plain, symmetricPlain)).toBe(true);
    expect(findProductiveHint(alternateBoard, equivalentTarget, sameAppearance)).toEqual([10, 35]);
  });

  it('returns null when board already matches target', () => {
    expect(findProductiveHint(target, target, sameAppearance)).toBeNull();
  });
});
