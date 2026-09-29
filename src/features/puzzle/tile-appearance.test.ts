import { describe, expect, it } from 'vitest';
import { describeTile, sameAppearance, visibleAppearance } from './tile-appearance';
import type { QuarterTurn, TileAppearance } from './puzzle.types';

const tile: TileAppearance = {
  motif: 'meander', color: 'teal', strokeWeight: 7, orientation: 0, inverted: false, mirrored: false,
};

describe('visible tile equivalence', () => {
  it('compares appearance rather than object identity or extra IDs', () => {
    expect(sameAppearance({ ...tile }, { ...tile })).toBe(true);
    const first = { ...tile, id: 'a' };
    const second = { ...tile, id: 'b' };
    expect(sameAppearance(first, second)).toBe(true);
  });

  it.each<Partial<TileAppearance>>([
    { motif: 'diamond' }, { color: 'terracotta' }, { strokeWeight: 4 },
    { orientation: 90 }, { inverted: true }, { mirrored: true },
  ])('distinguishes a visible attribute change: %o', (change) => {
    expect(sameAppearance(tile, { ...tile, ...change })).toBe(false);
  });

  it.each<QuarterTurn>([0, 90, 180, 270])('accepts diamond symmetry at %s degrees, with or without mirroring', (orientation) => {
    const diamond = { ...tile, motif: 'diamond' as const };
    for (const mirrored of [false, true]) {
      expect(sameAppearance(diamond, { ...diamond, orientation, mirrored })).toBe(true);
    }
  });

  it('accepts chevron reflection while distinguishing its direction', () => {
    const chevron = { ...tile, motif: 'chevron' as const };
    expect(sameAppearance(chevron, { ...chevron, mirrored: true })).toBe(true);
    expect(sameAppearance(chevron, { ...chevron, orientation: 180 })).toBe(false);
  });

  it('transforms points clockwise around the tile center and inverts actual colors', () => {
    const result = visibleAppearance({ ...tile, motif: 'chevron', orientation: 90, inverted: true });
    expect(result.strokes).toEqual(['50,22 26,50 50,78', '76,22 52,50 76,78']);
    expect(result.background).toBe('#245951');
    expect(result.foreground).toBe('#fff9eb');
  });

  it('describes every configurable attribute for assistive technology', () => {
    expect(describeTile({ ...tile, orientation: 90, mirrored: true, inverted: true }))
      .toBe('teal Greek key, bold lines, 90 degrees, mirrored, light motif on dark background');
  });
});
