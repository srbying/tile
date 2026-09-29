import { describe, expect, it } from 'vitest';
import { createPuzzleEngine } from './puzzle-engine';
import { samplePuzzle, sampleSolution } from './sample-puzzle';
import { sameAppearance, visualKey } from './tile-appearance';

describe('The courtyard sample', () => {
  it('has 36 positions and preserves the complete tile inventory', () => {
    expect(samplePuzzle.start).toHaveLength(36);
    expect(samplePuzzle.target).toHaveLength(36);
    expect(samplePuzzle.start.map(visualKey).sort()).toEqual(samplePuzzle.target.map(visualKey).sort());
  });

  it('starts unsolved and its documented swaps restore the target', () => {
    const engine = createPuzzleEngine(samplePuzzle, { sameAppearance, attemptLimit: 15 });
    let state = engine.initialize();
    expect(state.status).toBe('playing');
    // Independently documented, 1-based row/column solution from README.
    const solution = [
      [1, 1, 3, 3], [1, 2, 4, 4], [1, 4, 5, 2], [1, 6, 4, 1], [2, 1, 5, 6],
      [2, 2, 3, 5], [2, 3, 6, 4], [2, 5, 4, 6], [2, 6, 5, 4], [3, 2, 6, 5],
    ];
    for (const [r1, c1, r2, c2] of solution) {
      state = engine.reduce(state, { type: 'activate', position: (r1! - 1) * 6 + c1! - 1 });
      state = engine.reduce(state, { type: 'activate', position: (r2! - 1) * 6 + c2! - 1 });
    }
    expect(state.status).toBe('won');
    expect(state.board).toEqual(samplePuzzle.target);
  });

  it('uses ten disjoint, visibly different pairs rather than an unconstrained shuffle', () => {
    expect(sampleSolution).toHaveLength(10);
    expect(new Set(sampleSolution.flat()).size).toBe(20);
    for (const [left, right] of sampleSolution) {
      expect(sameAppearance(samplePuzzle.target[left]!, samplePuzzle.target[right]!)).toBe(false);
    }
  });
});
