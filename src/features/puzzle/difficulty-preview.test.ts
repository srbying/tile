import { describe, expect, it } from 'vitest';
import { buildDifficultyPreviews } from './difficulty-preview';
import { samplePuzzle, sampleSolution } from './sample-puzzle';
import { sameAppearance, visualKey } from './tile-appearance';
import type { TileAppearance } from './puzzle.types';

const inventory = (tiles: readonly TileAppearance[]) => tiles.map(visualKey).sort();

function differsByMoreThanColor(left: TileAppearance, right: TileAppearance) {
  return left.motif !== right.motif
    || left.strokeWeight !== right.strokeWeight
    || left.orientation !== right.orientation
    || left.inverted !== right.inverted
    || left.mirrored !== right.mirrored;
}

describe('difficulty art previews', () => {
  const previews = buildDifficultyPreviews(samplePuzzle);

  it('provides Easy, Medium, and Hard from one shared 6×6 puzzle', () => {
    expect(previews.map(({ id }) => id)).toEqual(['easy', 'medium', 'hard']);

    for (const preview of previews) {
      expect(preview.target).toHaveLength(36);
      expect(preview.start).toHaveLength(36);
      expect(inventory(preview.target)).toEqual(inventory(preview.start));
    }
  });

  it('progressively narrows color and stroke cues while keeping geometry data-driven', () => {
    const [easy, medium, hard] = previews;
    expect(easy!.target).toEqual(samplePuzzle.target);
    expect(medium!.target.every(({ strokeWeight }) => strokeWeight === 7)).toBe(true);
    expect(medium!.target.map(({ color }) => color))
      .toEqual(samplePuzzle.target.map(({ color }) => color));
    expect(hard!.target.every(({ strokeWeight, color }) => strokeWeight === 7 && color === 'teal')).toBe(true);

    for (let position = 0; position < samplePuzzle.target.length; position++) {
      expect(hard!.target[position]!.motif).toBe(samplePuzzle.target[position]!.motif);
      expect(hard!.target[position]!.orientation).toBe(samplePuzzle.target[position]!.orientation);
      expect(hard!.target[position]!.inverted).toBe(samplePuzzle.target[position]!.inverted);
      expect(hard!.target[position]!.mirrored).toBe(samplePuzzle.target[position]!.mirrored);
    }
  });

  it('keeps every authored scramble swap visibly distinct beyond color', () => {
    for (const preview of previews) {
      for (const [left, right] of sampleSolution) {
        expect(sameAppearance(preview.target[left]!, preview.start[left]!)).toBe(false);
        expect(sameAppearance(preview.target[right]!, preview.start[right]!)).toBe(false);
        expect(differsByMoreThanColor(preview.target[left]!, preview.start[left]!)).toBe(true);
        expect(differsByMoreThanColor(preview.target[right]!, preview.start[right]!)).toBe(true);
      }
    }
  });

  it('does not mutate the puzzle used to build previews', () => {
    const before = samplePuzzle.target.map((tile) => ({ ...tile }));
    buildDifficultyPreviews(samplePuzzle);
    expect(samplePuzzle.target).toEqual(before);
  });
});
