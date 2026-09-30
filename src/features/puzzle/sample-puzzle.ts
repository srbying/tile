import type { PuzzleDefinition, QuarterTurn, TileAppearance, TileColor } from './puzzle.types.js';

const key = (orientation: QuarterTurn, mirrored = false): TileAppearance => ({
  motif: 'meander', color: 'teal', strokeWeight: 7, orientation, inverted: false, mirrored,
});
const arrow = (orientation: QuarterTurn, color: TileColor): TileAppearance => ({
  motif: 'chevron', color, strokeWeight: 7, orientation, inverted: false, mirrored: false,
});
const diamond = (color: TileColor, inverted = false): TileAppearance => ({
  motif: 'diamond', color, strokeWeight: inverted ? 7 : 4, orientation: 0, inverted, mirrored: false,
});

// Row-major mosaic: a Greek-key border around four inset diamonds.
const target: readonly TileAppearance[] = [
  key(0), key(0), key(0), key(0), key(0), key(90, true),
  key(270), diamond('terracotta'), arrow(0, 'teal'), arrow(0, 'terracotta'), diamond('terracotta'), key(90),
  key(270), arrow(270, 'terracotta'), diamond('teal', true), diamond('terracotta', true), arrow(90, 'teal'), key(90),
  key(270), arrow(270, 'teal'), diamond('terracotta', true), diamond('teal', true), arrow(90, 'terracotta'), key(90),
  key(270), diamond('terracotta'), arrow(180, 'terracotta'), arrow(180, 'teal'), diamond('terracotta'), key(90),
  key(270, true), key(180), key(180), key(180), key(180), key(180),
];

// Ten disjoint swaps: replaying these pairs restores the fixed target.
// These are fixture construction data, not a runtime hint or solver.
export const sampleSolution: readonly (readonly [number, number])[] = [
  [0, 14], [1, 21], [3, 25], [5, 18], [6, 29],
  [7, 16], [8, 33], [10, 23], [11, 27], [13, 34],
];

const start = [...target];
for (const [left, right] of sampleSolution) [start[left], start[right]] = [start[right]!, start[left]!];

export const samplePuzzle: PuzzleDefinition = {
  id: 'sample-mosaic-01',
  title: 'The courtyard',
  motifDescription: 'Greek-key border around four inset diamonds.',
  size: 6,
  target,
  start,
};
