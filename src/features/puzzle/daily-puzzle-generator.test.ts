import { describe, expect, it } from 'vitest';
import {
  dailyPuzzleFromId,
  generateDailyCandidate,
  generateDailyPuzzle,
  getNewYorkPuzzleDate,
  getRecentPuzzleTargets,
} from './daily-puzzle-generator';
import { canonicalBoardTargetKey, hasRecentVisualDuplicate } from './puzzle-symmetry';
import { validatePuzzleCandidate } from './puzzle-candidate';

describe('daily puzzle generator', () => {
  it('generates a deterministic, validated 10-swap puzzle for every visual tier', () => {
    const first = generateDailyPuzzle('2026-09-29');
    const second = generateDailyPuzzle('2026-09-29');

    expect(first).toEqual(second);
    expect(first.releaseDate).toBe('2026-09-29');
    expect(first.puzzleId).toMatch(/^daily-v1-2026-09-29-/);
    const result = validatePuzzleCandidate(first.puzzle);
    expect(result.valid).toBe(true);
    expect(result.tiers.map(({ minimumSwaps, attemptLimit }) => [minimumSwaps, attemptLimit]))
      .toEqual([[10, 15], [10, 13], [10, 10]]);
  }, 30000);

  it('changes deterministic target layouts while avoiding recent visible duplicates', () => {
    const previous = getRecentPuzzleTargets('2026-09-29', 5);
    const next = generateDailyPuzzle('2026-09-29', previous.map((target, index) => ({
      schemaVersion: 1 as const,
      id: `history-${index}`,
      title: 'History',
      motifDescription: 'History target.',
      size: 6 as const,
      target,
      start: target,
      attemptLimits: { easy: 15, medium: 13, hard: 10 },
    })));
    expect(validatePuzzleCandidate(next.puzzle, { recentTargets: previous }).valid).toBe(true);
  }, 30000);

  it('checks the full prior 30-day target window without building historical scrambles', () => {
    const recentTargets = getRecentPuzzleTargets('2026-09-29', 30);
    expect(recentTargets).toHaveLength(30);
    expect(new Set(recentTargets.map((target) => canonicalBoardTargetKey(target, 6))).size).toBe(30);
    const today = generateDailyPuzzle('2026-09-29', recentTargets.map((target, index) => ({
      schemaVersion: 1 as const,
      id: `history-${index}`,
      title: 'History',
      motifDescription: 'History target.',
      size: 6 as const,
      target,
      start: target,
      attemptLimits: { easy: 15, medium: 13, hard: 10 },
    })));
    expect(hasRecentVisualDuplicate(today.puzzle.target, 6, recentTargets)).toBe(false);
    expect(() => getRecentPuzzleTargets('2026-09-29', 31)).toThrow(RangeError);
  });

  it('regenerates a saved puzzle from its versioned ID', () => {
    const release = generateDailyPuzzle('2026-09-29');
    expect(dailyPuzzleFromId(release.puzzleId)).toEqual(release);
    expect(dailyPuzzleFromId('daily-v2-2026-09-29-0')).toBeNull();
  });

  it('generates alternate authoring candidates from a deterministic target variation', () => {
    const first = generateDailyCandidate('2026-09-29', 0);
    const second = generateDailyCandidate('2026-09-29', 1);
    expect(first.id).not.toBe(second.id);
    expect(validatePuzzleCandidate(first).valid).toBe(true);
    expect(validatePuzzleCandidate(second).valid).toBe(true);
    expect(() => generateDailyCandidate('2026-09-29', 67)).toThrow(RangeError);
  });

  it('uses America/New_York midnight as the release boundary across DST changes', () => {
    expect(getNewYorkPuzzleDate(new Date('2026-03-08T04:59:00Z'))).toBe('2026-03-07');
    expect(getNewYorkPuzzleDate(new Date('2026-03-08T05:00:00Z'))).toBe('2026-03-08');
    expect(getNewYorkPuzzleDate(new Date('2026-11-01T03:59:00Z'))).toBe('2026-10-31');
    expect(getNewYorkPuzzleDate(new Date('2026-11-01T04:00:00Z'))).toBe('2026-11-01');
  });
});
