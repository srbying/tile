import { difficultyTierConfigs } from './difficulty-preview';
import { isMotif, isTileColor } from './tile-appearance';
import type { DifficultyTierId, PuzzleDefinition, SavedPuzzleProgressV1, TileAppearance } from './puzzle.types';

export const puzzleProgressStorageKey = 'tile-puzzle-progress:v1';

export interface PuzzleProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PuzzleProgressRepository {
  load(): SavedPuzzleProgressV1 | null;
  save(progress: SavedPuzzleProgressV1): void;
  clear(): void;
}

const turns = new Set([0, 90, 180, 270]);
const tierIds = new Set<DifficultyTierId>(difficultyTierConfigs.map(({ id }) => id));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTileAppearance(value: unknown): value is TileAppearance {
  if (!isRecord(value)) return false;
  return isMotif(value.motif)
    && isTileColor(value.color)
    && (value.strokeWeight === 4 || value.strokeWeight === 7)
    && typeof value.orientation === 'number' && turns.has(value.orientation)
    && typeof value.inverted === 'boolean'
    && typeof value.mirrored === 'boolean';
}

function isHintedPositions(value: unknown): value is readonly [number, number] | null {
  return value === null || (Array.isArray(value)
    && value.length === 2
    && Number.isInteger(value[0])
    && Number.isInteger(value[1])
    && value[0] >= 0 && value[0] < 36
    && value[1] >= 0 && value[1] < 36
    && value[0] !== value[1]);
}

function isSavedProgress(value: unknown): value is SavedPuzzleProgressV1 {
  if (!isRecord(value)) return false;
  if (value.version !== 1 || typeof value.puzzleId !== 'string' || value.puzzleId.length === 0) return false;
  if (typeof value.tierId !== 'string' || !tierIds.has(value.tierId as DifficultyTierId)) return false;
  const tier = difficultyTierConfigs.find(({ id }) => id === value.tierId);
  if (!tier || !Array.isArray(value.board) || value.board.length !== 36 || !value.board.every(isTileAppearance)) return false;
  if (!Number.isInteger(value.attemptsUsed) || Number(value.attemptsUsed) < 0 || Number(value.attemptsUsed) > tier.attemptLimit) return false;
  if (typeof value.hintUsed !== 'boolean' || !isHintedPositions(value.hintedPositions)) return false;
  if (!value.hintUsed && value.hintedPositions !== null) return false;
  return typeof value.elapsedMilliseconds === 'number'
    && Number.isFinite(value.elapsedMilliseconds)
    && value.elapsedMilliseconds >= 0;
}

export function createPuzzleProgressRepository(storage: PuzzleProgressStorage): PuzzleProgressRepository {
  return {
    load() {
      try {
        const serialized = storage.getItem(puzzleProgressStorageKey);
        if (serialized === null) return null;
        const value: unknown = JSON.parse(serialized);
        if (isSavedProgress(value)) return value;
      } catch {
        // Storage may be disabled or contain invalid JSON; gameplay can still continue.
      }
      return null;
    },
    save(progress) {
      try {
        if (isSavedProgress(progress)) storage.setItem(puzzleProgressStorageKey, JSON.stringify(progress));
      } catch {
        // Keep the in-memory round playable when persistence is unavailable.
      }
    },
    clear() {
      try {
        storage.removeItem(puzzleProgressStorageKey);
      } catch {
        // Clearing a save must not prevent the round from finishing.
      }
    },
  };
}

export function resolvePuzzleForProgress(
  progress: SavedPuzzleProgressV1 | null,
  currentPuzzle: PuzzleDefinition,
  findPuzzleById: (id: string) => PuzzleDefinition | undefined,
): PuzzleDefinition {
  if (!progress) return currentPuzzle;
  const savedPuzzle = findPuzzleById(progress.puzzleId);
  return savedPuzzle?.id === progress.puzzleId ? savedPuzzle : currentPuzzle;
}
