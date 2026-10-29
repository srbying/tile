import { getDailyPuzzleForId } from './daily-puzzle-generator';
import { parseDailyPuzzleId } from './daily-puzzle-identity';
import { buildDifficultyPuzzle, difficultyTierConfigs } from './difficulty-preview';
import { createPuzzleEngine } from './puzzle-engine';
import { sameAppearance } from './tile-appearance';
import type { DailyPuzzleRelease, DifficultyTierId, SavedPuzzleCompletionV1, SavedPuzzleProgressV1 } from './puzzle.types';
import type { PuzzleCompletionsByTier } from './puzzle-progress';

export interface RestoredDailyPuzzle {
  readonly release: DailyPuzzleRelease;
  readonly restoredProgress: SavedPuzzleProgressV1 | null;
  readonly recoveredCompletion: SavedPuzzleCompletionV1 | null;
  readonly completions: PuzzleCompletionsByTier;
}

function engineForTier(release: DailyPuzzleRelease, tierId: DifficultyTierId) {
  return createPuzzleEngine(buildDifficultyPuzzle(release.puzzle, tierId), {
    sameAppearance,
    attemptLimit: release.puzzle.attemptLimits[tierId],
  });
}

function releaseForSave(current: DailyPuzzleRelease, puzzleId: string): DailyPuzzleRelease | null {
  if (parseDailyPuzzleId(puzzleId)?.releaseDate !== current.releaseDate) return null;
  return puzzleId === current.puzzleId ? current : getDailyPuzzleForId(puzzleId);
}

function validateCompletions(release: DailyPuzzleRelease, completions: PuzzleCompletionsByTier): PuzzleCompletionsByTier {
  const valid: PuzzleCompletionsByTier = {};
  for (const { id } of difficultyTierConfigs) {
    const completion = completions[id];
    if (completion?.puzzleId === release.puzzleId && completion.tierId === id
      && engineForTier(release, id).restoreCompletion(completion)) valid[id] = completion;
  }
  return valid;
}

export function restoreDailyPuzzle(
  currentRelease: DailyPuzzleRelease,
  saved: SavedPuzzleProgressV1 | null,
  storedCompletions: PuzzleCompletionsByTier,
): RestoredDailyPuzzle {
  const savedRelease = saved ? releaseForSave(currentRelease, saved.puzzleId) : null;
  if (saved && savedRelease) {
    const completions = validateCompletions(savedRelease, storedCompletions);
    if (!completions[saved.tierId]) {
      const engine = engineForTier(savedRelease, saved.tierId);
      // Preserve existing recovery of a v2 board solved by corrected ribbon equivalence.
      const recoveredCompletion: SavedPuzzleCompletionV1 = { ...saved, status: 'won', hintedPositions: null };
      if (engine.restoreCompletion(recoveredCompletion)) {
        return { release: savedRelease, restoredProgress: null, recoveredCompletion,
          completions: { ...completions, [saved.tierId]: recoveredCompletion } };
      }
      if (engine.restore(saved)) {
        return { release: savedRelease, restoredProgress: saved, recoveredCompletion: null, completions };
      }
    }
  }
  for (const completion of Object.values(storedCompletions)) {
    const release = releaseForSave(currentRelease, completion.puzzleId);
    if (!release) continue;
    const completions = validateCompletions(release, storedCompletions);
    if (Object.keys(completions).length > 0) {
      return { release, restoredProgress: null, recoveredCompletion: null, completions };
    }
  }
  return { release: currentRelease, restoredProgress: null, recoveredCompletion: null, completions: {} };
}
