import { describe, expect, it } from 'vitest';
import { samplePuzzle } from './sample-puzzle';
import {
  createPuzzleProgressRepository,
  puzzleProgressStorageKey,
  resolvePuzzleForProgress,
} from './puzzle-progress';
import type { SavedPuzzleProgressV1 } from './puzzle.types';

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const progress: SavedPuzzleProgressV1 = {
  version: 1,
  puzzleId: samplePuzzle.id,
  tierId: 'hard',
  board: samplePuzzle.start,
  attemptsUsed: 2,
  hintUsed: true,
  hintedPositions: [0, 14],
  elapsedMilliseconds: 3_750,
};

describe('puzzle progress repository', () => {
  it('round-trips a versioned in-progress snapshot', () => {
    const storage = new MemoryStorage();
    const repository = createPuzzleProgressRepository(storage);

    repository.save(progress);

    expect(JSON.parse(storage.getItem(puzzleProgressStorageKey)!)).toEqual(progress);
    expect(repository.load()).toEqual(progress);
  });

  it('discards malformed or unsupported saves', () => {
    const storage = new MemoryStorage();
    const repository = createPuzzleProgressRepository(storage);
    storage.setItem(puzzleProgressStorageKey, '{bad json');
    expect(repository.load()).toBeNull();

    storage.setItem(puzzleProgressStorageKey, JSON.stringify({ ...progress, version: 2 }));
    expect(repository.load()).toBeNull();

    storage.setItem(puzzleProgressStorageKey, JSON.stringify({ ...progress, board: [] }));
    expect(repository.load()).toBeNull();
  });

  it('keeps game playable when storage access fails', () => {
    const unavailableStorage = {
      getItem() { throw new Error('storage unavailable'); },
      setItem() { throw new Error('storage unavailable'); },
      removeItem() { throw new Error('storage unavailable'); },
    };
    const repository = createPuzzleProgressRepository(unavailableStorage);

    expect(repository.load()).toBeNull();
    expect(() => repository.save(progress)).not.toThrow();
    expect(() => repository.clear()).not.toThrow();
  });

  it('resolves saved puzzle ID when a newer puzzle is current', () => {
    const oldPuzzle = { ...samplePuzzle, id: 'daily-2026-09-28' };
    const newPuzzle = { ...samplePuzzle, id: 'daily-2026-09-29' };
    const catalog = new Map([[oldPuzzle.id, oldPuzzle], [newPuzzle.id, newPuzzle]]);
    const oldProgress = { ...progress, puzzleId: oldPuzzle.id };

    expect(resolvePuzzleForProgress(oldProgress, newPuzzle, (id) => catalog.get(id))).toBe(oldPuzzle);
    expect(resolvePuzzleForProgress(null, newPuzzle, (id) => catalog.get(id))).toBe(newPuzzle);
    expect(resolvePuzzleForProgress({ ...oldProgress, puzzleId: 'missing' }, newPuzzle, (id) => catalog.get(id)))
      .toBe(newPuzzle);
  });
});
