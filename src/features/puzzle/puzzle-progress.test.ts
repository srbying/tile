import { describe, expect, it } from 'vitest';
import { samplePuzzle } from './sample-puzzle';
import {
  createPuzzleCompletionRepository,
  createPuzzleProgressRepository,
  puzzleCompletionStorageKey,
  puzzleProgressStorageKey,
  resolvePuzzleForProgress,
} from './puzzle-progress';
import type { SavedPuzzleCompletionV1, SavedPuzzleProgressV1 } from './puzzle.types';

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

const completion: SavedPuzzleCompletionV1 = {
  ...progress,
  status: 'won',
  board: samplePuzzle.target,
};

describe('puzzle progress repository', () => {
  it('round-trips a versioned in-progress snapshot', () => {
    const storage = new MemoryStorage();
    const repository = createPuzzleProgressRepository(storage);

    repository.save(progress);

    expect(JSON.parse(storage.getItem(puzzleProgressStorageKey)!)).toEqual(progress);
    expect(repository.load()).toEqual(progress);
  });

  it('restores progress whose saved board uses the expanded motif catalog', () => {
    const storage = new MemoryStorage();
    const repository = createPuzzleProgressRepository(storage);
    const board = [...progress.board];
    board[0] = { ...board[0]!, motif: 'waveform-sine', color: 'indigo' };

    repository.save({ ...progress, board });

    expect(repository.load()?.board).toEqual(board);
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

describe('puzzle completion repository', () => {
  it('stores one completed result per difficulty for a puzzle', () => {
    const storage = new MemoryStorage();
    const repository = createPuzzleCompletionRepository(storage);
    const easy = { ...completion, tierId: 'easy' as const, attemptsUsed: 4 };
    const hard = { ...completion, tierId: 'hard' as const, attemptsUsed: 3 };

    repository.save(easy);
    repository.save(hard);

    expect(repository.load(samplePuzzle.id)).toEqual({ easy, hard });
    expect(JSON.parse(storage.getItem(puzzleCompletionStorageKey)!)).toEqual({
      version: 1,
      puzzleId: samplePuzzle.id,
      completions: { easy, hard },
    });
  });

  it('does not expose one puzzle’s completions for another puzzle', () => {
    const storage = new MemoryStorage();
    const repository = createPuzzleCompletionRepository(storage);
    repository.save(completion);

    expect(repository.load('daily-2026-10-06')).toEqual({});
  });

  it('discards malformed completion records and unsupported versions', () => {
    const storage = new MemoryStorage();
    const repository = createPuzzleCompletionRepository(storage);
    storage.setItem(puzzleCompletionStorageKey, '{bad json');
    expect(repository.load(samplePuzzle.id)).toEqual({});

    storage.setItem(puzzleCompletionStorageKey, JSON.stringify({
      version: 2,
      puzzleId: samplePuzzle.id,
      completions: { medium: completion },
    }));
    expect(repository.load(samplePuzzle.id)).toEqual({});

    storage.setItem(puzzleCompletionStorageKey, JSON.stringify({
      version: 1,
      puzzleId: samplePuzzle.id,
      completions: { medium: { ...completion, status: 'playing' } },
    }));
    expect(repository.load(samplePuzzle.id)).toEqual({});
  });

  it('keeps completion persistence failures from breaking gameplay', () => {
    const unavailableStorage = {
      getItem() { throw new Error('storage unavailable'); },
      setItem() { throw new Error('storage unavailable'); },
      removeItem() { throw new Error('storage unavailable'); },
    };
    const repository = createPuzzleCompletionRepository(unavailableStorage);

    expect(repository.load(samplePuzzle.id)).toEqual({});
    expect(() => repository.save(completion)).not.toThrow();
  });
});
