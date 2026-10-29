import { describe, expect, it } from 'vitest';
import { dailyPuzzleFromId, generateDailyPuzzle } from './daily-puzzle-generator';
import { buildDifficultyPuzzle } from './difficulty-preview';
import { restoreDailyPuzzle } from './daily-puzzle-restore';
import type { DifficultyTierId, SavedPuzzleCompletionV1, SavedPuzzleProgressV1 } from './puzzle.types';

const current = generateDailyPuzzle('2026-10-19');
const modes = ['easy', 'medium', 'hard'] as const;
const cases = [1, 2, 3].flatMap(version => modes.map(tierId => ({ version, tierId })));

function savedRound(version: number, tierId: DifficultyTierId): SavedPuzzleProgressV1 {
  const release = dailyPuzzleFromId(`daily-v${version}-2026-10-19-16-0`)!;
  return {
    version: 1, puzzleId: release.puzzleId, tierId,
    board: buildDifficultyPuzzle(release.puzzle, tierId).start,
    attemptsUsed: 2, hintUsed: true, hintedPositions: null, elapsedMilliseconds: 12345,
  };
}

function completedRound(version: number, tierId: DifficultyTierId, status: 'won' | 'lost'): SavedPuzzleCompletionV1 {
  const saved = savedRound(version, tierId);
  const release = dailyPuzzleFromId(saved.puzzleId)!;
  return { ...saved, status,
    board: status === 'won' ? buildDifficultyPuzzle(release.puzzle, tierId).target : saved.board,
    attemptsUsed: status === 'won' ? 9 : release.puzzle.attemptLimits[tierId],
  };
}

describe('daily puzzle restore', () => {
  it.each(cases)('restores the exact v$version $tierId round rather than replacing its puzzle', ({ version, tierId }) => {
    const saved = savedRound(version, tierId);
    const restored = restoreDailyPuzzle(current, saved, {});

    expect(restored.release).toEqual(dailyPuzzleFromId(saved.puzzleId));
    expect(restored.restoredProgress).toEqual(saved);
    expect(restored.recoveredCompletion).toBeNull();
    expect(restored.completions).toEqual({});
  });

  it.each(cases.flatMap(item => (['won', 'lost'] as const).map(status => ({ ...item, status }))))(
    'keeps v$version $tierId $status results available for review', ({ version, tierId, status }) => {
      const completion = completedRound(version, tierId, status);
      const restored = restoreDailyPuzzle(current, null, { [tierId]: completion });

      expect(restored.release.puzzleId).toBe(completion.puzzleId);
      expect(restored.completions).toEqual({ [tierId]: completion });
      expect(restored.restoredProgress).toBeNull();
    },
  );

  it('prefers a valid unfinished round to another release’s completed results', () => {
    const saved = savedRound(1, 'medium');
    const completion = completedRound(2, 'hard', 'lost');
    const restored = restoreDailyPuzzle(current, saved, { hard: completion });
    expect(restored.release.puzzleId).toBe(saved.puzzleId);
    expect(restored.restoredProgress).toEqual(saved);
    expect(restored.completions).toEqual({});
  });

  it('uses valid completed results when a saved round cannot be restored', () => {
    const saved = savedRound(1, 'medium');
    const completion = completedRound(2, 'hard', 'lost');
    const invalid = { ...saved, board: saved.board.map(() => saved.board[0]!) };
    const restored = restoreDailyPuzzle(current, invalid, { hard: completion });
    expect(restored.release.puzzleId).toBe(completion.puzzleId);
    expect(restored.restoredProgress).toBeNull();
    expect(restored.completions).toEqual({ hard: completion });
  });

  it('keeps all completed modes for the resumed release and prevents replaying a finished mode', () => {
    const easy = completedRound(1, 'easy', 'won');
    const hard = completedRound(1, 'hard', 'lost');
    const restored = restoreDailyPuzzle(current, savedRound(1, 'easy'), { easy, hard });
    expect(restored.release.puzzleId).toBe(easy.puzzleId);
    expect(restored.restoredProgress).toBeNull();
    expect(restored.completions).toEqual({ easy, hard });
  });

  it('recovers a visibly solved v2 round without spending another attempt', () => {
    const saved = savedRound(2, 'hard');
    const release = dailyPuzzleFromId(saved.puzzleId)!;
    const board = [...buildDifficultyPuzzle(release.puzzle, 'hard').target];
    [board[1], board[4]] = [board[4]!, board[1]!];
    const solved = { ...saved, board, attemptsUsed: 9, hintedPositions: [1, 4] as const };
    const restored = restoreDailyPuzzle(current, solved, {});

    expect(restored.release.puzzleId).toBe(saved.puzzleId);
    expect(restored.restoredProgress).toBeNull();
    expect(restored.recoveredCompletion).toEqual({ ...solved, status: 'won', hintedPositions: null });
    expect(restored.completions.hard).toEqual(restored.recoveredCompletion);
  });

  it.each([1, 2, 3])('expires previous-day v%s progress and results on an online rollover', (version) => {
    const nextDay = generateDailyPuzzle('2026-10-20');
    const restored = restoreDailyPuzzle(nextDay, savedRound(version, 'medium'), {
      hard: completedRound(version, 'hard', 'lost'),
    });
    expect(restored.release.puzzleId).toBe(nextDay.puzzleId);
    expect(restored.restoredProgress).toBeNull();
    expect(restored.completions).toEqual({});
  });

  it('rejects unsupported saves and invalid completion boards', () => {
    const saved = { ...savedRound(1, 'medium'), puzzleId: 'daily-v4-2026-10-19-0-0' };
    const completion = { ...completedRound(2, 'hard', 'won'), board: savedRound(2, 'hard').board };
    const restored = restoreDailyPuzzle(current, saved, { hard: completion });
    expect(restored.release.puzzleId).toBe(current.puzzleId);
    expect(restored.restoredProgress).toBeNull();
    expect(restored.completions).toEqual({});
  });
});
