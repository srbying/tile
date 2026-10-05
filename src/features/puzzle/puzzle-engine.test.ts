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
const puzzle: PuzzleDefinition = Object.freeze({
  id: 'test', title: 'Test', motifDescription: 'Test motif.', size: 6, target, start,
});

describe('player transitions', () => {
  const engine = createPuzzleEngine(puzzle, { sameAppearance, attemptLimit: 15 });

  it('selects, cancels, and reselects without spending attempts', () => {
    const initial = Object.freeze(engine.initialize());
    expect(initial.attemptsUsed).toBe(0);
    expect(initial.attemptLimit).toBe(15);
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
    expect(cleared.attemptsUsed).toBe(0);
    expect(initial.selectedPosition).toBeNull();
  });

  it('uses one productive hint without changing the board or attempt count', () => {
    const initial = engine.initialize();
    const hinted = engine.reduce(initial, { type: 'useHint' });

    expect(hinted.hintUsed).toBe(true);
    expect(hinted.hintedPositions).toEqual([0, 35]);
    expect(hinted.board).toBe(initial.board);
    expect(hinted.attemptsUsed).toBe(0);
    expect(engine.reduce(hinted, { type: 'useHint' })).toBe(hinted);
  });

  it('derives hint from board after player moves and clears highlight after next swap', () => {
    const initial = engine.initialize();
    const afterWrongSwap = engine.reduce(
      engine.reduce(initial, { type: 'activate', position: 0 }),
      { type: 'activate', position: 1 },
    );
    const hinted = engine.reduce(afterWrongSwap, { type: 'useHint' });

    expect(hinted.hintedPositions).toEqual([1, 35]);
    const afterHintedSwap = engine.reduce(
      engine.reduce(hinted, { type: 'activate', position: 1 }),
      { type: 'activate', position: 35 },
    );
    expect(afterHintedSwap.hintUsed).toBe(true);
    expect(afterHintedSwap.hintedPositions).toBeNull();
    expect(afterHintedSwap.attemptsUsed).toBe(2);
  });

  it('swaps any two positions, moves every attribute together, and spends one attempt', () => {
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
    expect(moved.attemptsUsed).toBe(1);
    expect(initial.board).toEqual(start);
    expect(selected.selectedPosition).toBe(0);
  });

  it('wins on the last allowed attempt and rejects all later actions', () => {
    const lastAttemptEngine = createPuzzleEngine(puzzle, { sameAppearance, attemptLimit: 1 });
    const selected = lastAttemptEngine.reduce(lastAttemptEngine.initialize(), { type: 'activate', position: 0 });
    const won = lastAttemptEngine.reduce(selected, { type: 'activate', position: 35 });
    expect(won.board).toEqual(target);
    expect(won.status).toBe('won');
    expect(won.attemptsUsed).toBe(1);
    expect(won.selectedPosition).toBeNull();
    expect(lastAttemptEngine.reduce(won, { type: 'activate', position: 1 })).toBe(won);
    expect(lastAttemptEngine.reduce(won, { type: 'cancel' })).toBe(won);
  });

  it('loses immediately after an incorrect final attempt', () => {
    const oneAttemptEngine = createPuzzleEngine(puzzle, { sameAppearance, attemptLimit: 1 });
    const selected = oneAttemptEngine.reduce(oneAttemptEngine.initialize(), { type: 'activate', position: 0 });
    const lost = oneAttemptEngine.reduce(selected, { type: 'activate', position: 1 });
    expect(lost.status).toBe('lost');
    expect(lost.attemptsUsed).toBe(1);
    expect(lost.board).not.toEqual(target);
    expect(oneAttemptEngine.reduce(lost, { type: 'activate', position: 35 })).toBe(lost);
  });

  it('accepts equivalent-looking tiles with different object identities and symmetries', () => {
    const equivalentTarget = target.map((tile) => tile.motif === 'diamond'
      ? { ...tile, orientation: 90 as const, mirrored: true }
      : { ...tile });
    const equivalentEngine = createPuzzleEngine({ ...puzzle, target: equivalentTarget }, { sameAppearance, attemptLimit: 15 });
    const selected = equivalentEngine.reduce(equivalentEngine.initialize(), { type: 'activate', position: 0 });
    expect(equivalentEngine.reduce(selected, { type: 'activate', position: 35 }).status).toBe('won');
  });

  it('recognizes a puzzle that already starts visibly solved', () => {
    expect(createPuzzleEngine({ ...puzzle, start: target }, { sameAppearance, attemptLimit: 15 }).initialize().status).toBe('won');
  });

  it('restores board, mode budget, attempts, and one-use hint state', () => {
    const initial = engine.initialize();
    const moved = engine.reduce(
      engine.reduce(initial, { type: 'activate', position: 0 }),
      { type: 'activate', position: 1 },
    );
    const hinted = engine.reduce(moved, { type: 'useHint' });

    const restored = engine.restore({
      board: hinted.board,
      attemptsUsed: hinted.attemptsUsed,
      hintUsed: hinted.hintUsed,
      hintedPositions: hinted.hintedPositions,
    });

    expect(restored).toEqual({ ...hinted, selectedPosition: null });
    expect(restored?.attemptLimit).toBe(15);
    expect(restored?.attemptsUsed).toBe(1);
    expect(restored?.hintUsed).toBe(true);
  });

  it('rejects malformed and terminal saved game state', () => {
    expect(engine.restore({ board: [], attemptsUsed: 1, hintUsed: false, hintedPositions: null })).toBeNull();
    expect(engine.restore({
      board: Array.from({ length: 36 }, () => plain),
      attemptsUsed: 1,
      hintUsed: false,
      hintedPositions: null,
    })).toBeNull();
    expect(engine.restore({ board: start, attemptsUsed: 15, hintUsed: false, hintedPositions: null })).toBeNull();
    expect(engine.restore({ board: target, attemptsUsed: 0, hintUsed: false, hintedPositions: null })).toBeNull();
  });

  it('restores a completed win or loss as a terminal state', () => {
    const won = engine.restoreCompletion({
      board: target,
      attemptsUsed: 10,
      hintUsed: true,
      hintedPositions: null,
      status: 'won',
    });
    const lost = engine.restoreCompletion({
      board: start,
      attemptsUsed: 15,
      hintUsed: false,
      hintedPositions: null,
      status: 'lost',
    });

    expect(won).toEqual({
      board: target,
      selectedPosition: null,
      status: 'won',
      attemptsUsed: 10,
      attemptLimit: 15,
      hintUsed: true,
      hintedPositions: null,
    });
    expect(lost).toEqual({
      board: start,
      selectedPosition: null,
      status: 'lost',
      attemptsUsed: 15,
      attemptLimit: 15,
      hintUsed: false,
      hintedPositions: null,
    });
  });

  it('rejects terminal snapshots whose outcome disagrees with board or attempt count', () => {
    expect(engine.restoreCompletion({
      board: start,
      attemptsUsed: 10,
      hintUsed: false,
      hintedPositions: null,
      status: 'won',
    })).toBeNull();
    expect(engine.restoreCompletion({
      board: target,
      attemptsUsed: 15,
      hintUsed: false,
      hintedPositions: null,
      status: 'lost',
    })).toBeNull();
    expect(engine.restoreCompletion({
      board: start,
      attemptsUsed: 14,
      hintUsed: false,
      hintedPositions: null,
      status: 'lost',
    })).toBeNull();
  });

  it('lets callers supply the appearance policy without changing rules', () => {
    const byMotif = createPuzzleEngine(puzzle, { sameAppearance: (left, right) => left.motif === right.motif, attemptLimit: 15 });
    const selected = byMotif.reduce(byMotif.initialize(), { type: 'activate', position: 0 });
    expect(byMotif.reduce(selected, { type: 'activate', position: 35 }).status).toBe('won');
  });

  it.each([-1, 36, 1.5, Number.NaN])('ignores invalid position %s', (position) => {
    const initial = engine.initialize();
    expect(engine.reduce(initial, { type: 'activate', position })).toBe(initial);
  });

  it('rejects malformed board dimensions', () => {
    const options = { sameAppearance, attemptLimit: 15 };
    expect(() => createPuzzleEngine({ ...puzzle, start: start.slice(1) }, options)).toThrow('36');
    expect(() => createPuzzleEngine({ ...puzzle, target: [] }, options)).toThrow('36');
  });

  it('rejects a zero or fractional attempt limit', () => {
    expect(() => createPuzzleEngine(puzzle, { sameAppearance, attemptLimit: 0 })).toThrow('positive integer');
    expect(() => createPuzzleEngine(puzzle, { sameAppearance, attemptLimit: 1.5 })).toThrow('positive integer');
  });
});
