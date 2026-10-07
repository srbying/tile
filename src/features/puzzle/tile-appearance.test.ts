import { describe, expect, it } from 'vitest';
import { describeTile, motifs, sameAppearance, visibleAppearance } from './tile-appearance';
import type { QuarterTurn, TileAppearance } from './puzzle.types';

const tile: TileAppearance = {
  motif: 'meander', color: 'teal', strokeWeight: 7, orientation: 0, inverted: false, mirrored: false,
};

describe('visible tile equivalence', () => {
  it('registers all approved motifs as visibly distinct geometries', () => {
    const motifIds = Object.keys(motifs);
    expect(motifIds).toHaveLength(30);
    expect(new Set(motifIds.map((motif) => JSON.stringify(visibleAppearance({ ...tile, motif } as TileAppearance).strokes))).size)
      .toBe(30);
  });

  it('keeps the original v1 diamond geometry unchanged', () => {
    expect(motifs.diamond.strokes[0]).toEqual([[50, 16], [84, 50], [50, 84], [16, 50], [50, 16]]);
  });

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
    expect(result.background).toBe('#084888');
    expect(result.foreground).toBe('#f7eee6');
  });

  it('describes tile colors, shapes, and transforms in plain language', () => {
    expect(describeTile({ ...tile, orientation: 90, mirrored: true, inverted: true }))
      .toBe('blue Angular maze, thick lines, rotated 90 degrees clockwise, flipped left to right, light pattern on dark tile');
  });
});
