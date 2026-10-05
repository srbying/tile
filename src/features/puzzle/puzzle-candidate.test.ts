import { describe, expect, it, vi } from 'vitest';
import * as solver from './puzzle-solver';
import { parsePuzzleCandidate, validatePuzzleCandidate } from './puzzle-candidate';
import { sameAppearance } from './tile-appearance';
import type { PuzzleCandidate, TileAppearance } from './puzzle.types';

const tile = (motif: TileAppearance['motif'], color: TileAppearance['color'] = 'teal', orientation: TileAppearance['orientation'] = 0): TileAppearance => ({
  motif,
  color,
  strokeWeight: 7,
  orientation,
  inverted: false,
  mirrored: false,
});

function candidate(): PuzzleCandidate {
  const target = Array.from({ length: 36 }, (_, index) => [
    tile('diamond'), tile('chevron'), tile('meander'), tile('chevron', 'terracotta'),
  ][index % 4]!);
  const start = [...target];
  for (let left = 0; left < 20; left += 2) [start[left], start[left + 1]] = [start[left + 1]!, start[left]!];
  return {
    schemaVersion: 1,
    id: 'candidate-test',
    title: 'Test mosaic',
    motifDescription: 'A test pattern.',
    size: 6,
    target,
    start,
    attemptLimits: { easy: 15, medium: 13, hard: 10 },
  };
}

const codes = (value: PuzzleCandidate, recent: readonly PuzzleCandidate[] = []) =>
  validatePuzzleCandidate(value, { recentPuzzles: recent }).issues.map(({ code }) => code);

describe('puzzle candidate validation', () => {
  it('accepts a valid ten-swap visible puzzle with productive derived hints', () => {
    const result = validatePuzzleCandidate(candidate());

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.tiers.map(({ minimumSwaps }) => minimumSwaps)).toEqual([10, 10, 10]);
    for (const tier of result.tiers) {
      expect(tier.hint).not.toBeNull();
      const [left, right] = tier.hint!;
      expect(sameAppearance(tier.start[left]!, tier.target[left]!)
        || sameAppearance(tier.start[right]!, tier.target[right]!)).toBe(false);
    }
  });

  it('rejects invalid board shape and tile data', () => {
    const value = candidate();
    expect(codes({ ...value, target: value.target.slice(1) })).toContain('invalid-board');
    expect(codes({ ...value, start: [{ ...value.start[0]!, motif: 'hidden' } as unknown as TileAppearance, ...value.start.slice(1)] }))
      .toContain('invalid-tile');
  });

  it('parses candidates that use newly cataloged waveform motifs and colors', () => {
    const value = candidate();
    const target = [...value.target];
    target[0] = { ...target[0]!, motif: 'waveform-sine', color: 'indigo' } as TileAppearance;

    expect(parsePuzzleCandidate({ ...value, target })).not.toBeNull();
  });

  it('rejects candidates whose visible tile inventories cannot be swapped into place', () => {
    const value = candidate();
    const start = [...value.start];
    start[0] = tile('diamond', 'terracotta');

    expect(codes({ ...value, start })).toContain('unsolvable-inventory');
  });

  it('rejects starts already solved in any projected difficulty tier', () => {
    const value = candidate();

    expect(codes({ ...value, start: value.target })).toContain('already-solved');
  });

  it('rejects invalid attempt caps', () => {
    const value = candidate();

    expect(codes({ ...value, attemptLimits: { easy: 0, medium: 13, hard: 10 } })).toContain('invalid-attempt-limit');
    expect(codes({ ...value, attemptLimits: { easy: 15, medium: 0, hard: 10 } })).toContain('invalid-attempt-limit');
    expect(codes({ ...value, attemptLimits: { easy: 14, medium: 13, hard: 10 } })).toContain('invalid-attempt-limit');
  });

  it('rejects puzzles whose shortest solution is not ten visible swaps in every tier', () => {
    const value = candidate();
    const start = [...value.target];
    [start[0], start[1]] = [start[1]!, start[0]!];

    expect(codes({ ...value, start })).toContain('incorrect-shortest-solution');
  });

  it('skips exhaustive solving when more than twenty visible positions differ', () => {
    const value = candidate();
    const start = [...value.start];
    [start[20], start[21]] = [start[21]!, start[20]!];
    const solve = vi.spyOn(solver, 'minimumVisibleSwaps');

    const result = validatePuzzleCandidate({ ...value, start });
    const solverWasCalled = solve.mock.calls.length > 0;
    solve.mockRestore();

    expect(solverWasCalled).toBe(false);
    expect(result.tiers.map(({ minimumSwaps }) => minimumSwaps)).toEqual([null, null, null]);
    expect(result.issues.map(({ code }) => code)).toEqual([
      'incorrect-shortest-solution',
      'incorrect-shortest-solution',
      'incorrect-shortest-solution',
    ]);
  });

  it('rejects an authored hint that does not improve visible matches', () => {
    const value = candidate();

    expect(codes({ ...value, hints: { easy: [0, 2], medium: [0, 2], hard: [0, 2] } }))
      .toContain('invalid-hint');
  });

  it('accepts visible equivalence and never requires a hidden tile identity', () => {
    const value = candidate();
    const target = [...value.target];
    const start = [...value.start];
    target[0] = tile('diamond', 'teal', 0);
    start[1] = tile('diamond', 'teal', 90);

    const result = validatePuzzleCandidate({ ...value, target, start });
    expect(result.issues.some(({ code }) => code === 'hidden-id-dependency')).toBe(false);
  });

  it('flags target duplicates under whole-board rotations and reflections', () => {
    const value = candidate();
    const rotated = Array.from({ length: 36 }, () => value.target[0]!);
    value.target.forEach((appearance, position) => {
      const row = Math.floor(position / 6);
      const column = position % 6;
      const orientation = ((appearance.orientation + 90) % 360) as TileAppearance['orientation'];
      rotated[column * 6 + (5 - row)] = { ...appearance, orientation };
    });

    expect(codes(candidate(), [{ ...value, target: rotated }])).toContain('recent-visual-duplicate');

    const reflected = Array.from({ length: 36 }, () => value.target[0]!);
    value.target.forEach((appearance, position) => {
      const row = Math.floor(position / 6);
      const column = position % 6;
      const orientation = ((360 - appearance.orientation) % 360) as TileAppearance['orientation'];
      reflected[row * 6 + (5 - column)] = { ...appearance, orientation, mirrored: !appearance.mirrored };
    });
    expect(codes(candidate(), [{ ...value, target: reflected }])).toContain('recent-visual-duplicate');
  });

  it('rejects hidden identity fields instead of relying on tile IDs', () => {
    const value = candidate();

    expect(codes({ ...value, tileIds: Array.from({ length: 36 }, (_, index) => index) } as PuzzleCandidate))
      .toContain('hidden-id-dependency');
    const start = [...value.start] as (TileAppearance & { tileId?: string })[];
    start[0] = { ...start[0]!, tileId: 'concealed-piece' };
    expect(codes({ ...value, start } as unknown as PuzzleCandidate)).toContain('hidden-id-dependency');
  });
});
