import { describe, expect, it } from 'vitest';
import { createPuzzleEngine } from './puzzle-engine';
import { sameAppearance } from './tile-appearance';
import type { PuzzleDefinition, TileAppearance } from './puzzle.types';

const plain: TileAppearance = Object.freeze({
  motif: 'diamond', color: 'teal', strokeWeight: 4, orientation: 0, inverted: false, mirrored: false,
});
const decorated: TileAppearance = Object.freeze({
  motif: 'meander', color: 'terracotta', strokeWeight: 7, orientation: 90, inverted: true, mirrored: true,
});
const target = Object.freeze(Array.from({ length: 36 }, (_, i) => i === 35 ? decorated : plain));
const start = Object.freeze(Array.from({ length: 36 }, (_, i) => i === 0 ? decorated : plain));
const puzzle: PuzzleDefinition = Object.freeze({ id: 'test', title: 'Test', size: 6, target, start });

describe('player transitions', () => {
  const engine = createPuzzleEngine(puzzle, sameAppearance);

  it('selects, cancels, and reselects without changing any tile', () => {
    const initial = Object.freeze(engine.initialize());
    const selected = engine.reduce(initial, { type: 'activate', position: 0 });
    expect(selected.selectedPosition).toBe(0);
    expect(selected.board).toBe(initial.board);
    const cancelled = engine.reduce(selected, { type: 'activate', position: 0 });
    expect(cancelled.selectedPosition).toBeNull();
    const reselected = engine.reduce(cancelled, { type: 'activate', position: 12 });
    expect(reselected.selectedPosition).toBe(12);
    const cleared = engine.reduce(reselected, { type: 'cancel' });
    expect(cleared.selectedPosition).toBeNull();
    expect(cleared.board).toEqual(start);
    expect(initial.selectedPosition).toBeNull();
  });

  it('swaps any two positions and moves every attribute together', () => {
    const initial = engine.initialize();
    Object.freeze(initial.board);
    const selected = Object.freeze(engine.reduce(initial, { type: 'activate', position: 0 }));
    const moved = engine.reduce(selected, { type: 'activate', position: 22 });
    expect(moved.board[22]).toEqual(decorated);
    expect(moved.board[0]).toEqual(plain);
    expect(moved.board[22]).toBe(start[0]);
    expect(moved.board.filter((_, index) => index !== 0 && index !== 22))
      .toEqual(start.filter((_, index) => index !== 0 && index !== 22));
    expect(moved.selectedPosition).toBeNull();
    expect(moved.status).toBe('playing');
    expect(initial.board).toEqual(start);
    expect(selected.selectedPosition).toBe(0);
  });

  it('solves after the winning swap and rejects all later actions', () => {
    const selected = engine.reduce(engine.initialize(), { type: 'activate', position: 0 });
    const solved = engine.reduce(selected, { type: 'activate', position: 35 });
    expect(solved.board).toEqual(target);
    expect(solved.status).toBe('solved');
    expect(solved.selectedPosition).toBeNull();
    expect(engine.reduce(solved, { type: 'activate', position: 1 })).toBe(solved);
    expect(engine.reduce(solved, { type: 'cancel' })).toBe(solved);
  });

  it('accepts equivalent-looking tiles with different object identities and symmetries', () => {
    const equivalentTarget = target.map((tile) => tile.motif === 'diamond'
      ? { ...tile, orientation: 90 as const, mirrored: true }
      : { ...tile });
    const equivalentEngine = createPuzzleEngine({ ...puzzle, target: equivalentTarget }, sameAppearance);
    const selected = equivalentEngine.reduce(equivalentEngine.initialize(), { type: 'activate', position: 0 });
    expect(equivalentEngine.reduce(selected, { type: 'activate', position: 35 }).status).toBe('solved');
  });

  it('recognizes a puzzle that already starts visibly solved', () => {
    expect(createPuzzleEngine({ ...puzzle, start: target }, sameAppearance).initialize().status).toBe('solved');
  });

  it('lets callers supply the appearance policy without changing rules', () => {
    const byMotif = createPuzzleEngine(puzzle, (left, right) => left.motif === right.motif);
    const selected = byMotif.reduce(byMotif.initialize(), { type: 'activate', position: 0 });
    expect(byMotif.reduce(selected, { type: 'activate', position: 35 }).status).toBe('solved');
  });

  it.each([-1, 36, 1.5, Number.NaN])('ignores invalid position %s', (position) => {
    const initial = engine.initialize();
    expect(engine.reduce(initial, { type: 'activate', position })).toBe(initial);
  });

  it('rejects malformed board dimensions', () => {
    expect(() => createPuzzleEngine({ ...puzzle, start: start.slice(1) }, sameAppearance)).toThrow('36');
    expect(() => createPuzzleEngine({ ...puzzle, target: [] }, sameAppearance)).toThrow('36');
  });
});
