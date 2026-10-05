import { describe, expect, it } from 'vitest';
import {
  dailyPuzzleFromId,
  dailyPuzzleGeneratorVersion,
  getDailyPuzzleArt,
  generateDailyCandidate,
  generateDailyPuzzle,
  getNextNewYorkMidnight,
  getNewYorkPuzzleDate,
  getRecentPuzzleTargets,
} from './daily-puzzle-generator';
import { motifSets } from './motif-set-catalog';
import { canonicalBoardTargetKey, hasRecentVisualDuplicate } from './puzzle-symmetry';
import { validatePuzzleCandidate } from './puzzle-candidate';

describe('daily puzzle generator', () => {
  it('uses the expanded generator while preserving access to v1 puzzle IDs', () => {
    const current = generateDailyPuzzle('2026-09-29');
    const legacy = dailyPuzzleFromId('daily-v1-2026-09-29-0-0');

    expect(dailyPuzzleGeneratorVersion).toBe(2);
    expect(current.generatorVersion).toBe(2);
    expect(current.puzzleId).toMatch(/^daily-v2-/);
    expect(legacy?.generatorVersion).toBe(1);
    expect(legacy?.puzzleId).toBe('daily-v1-2026-09-29-0-0');
  }, 30000);

  it('rotates through motif sets without repeats for six intervening days and board types without consecutive repeats', () => {
    const dates = Array.from({ length: 18 }, (_, offset) => {
      const date = new Date(Date.UTC(2026, 0, 1 + offset)).toISOString().slice(0, 10);
      return getDailyPuzzleArt(date);
    });

    expect(motifSets).toHaveLength(9);
    expect(motifSets.map(({ motifs: setMotifs }) => setMotifs.length)).toEqual([3, 3, 3, 3, 3, 3, 3, 3, 6]);
    expect(new Set(motifSets.flatMap(({ motifs: setMotifs }) => setMotifs)).size).toBe(30);
    for (let index = 0; index < dates.length; index++) {
      for (let intervening = 1; intervening <= 6; intervening++) {
        expect(dates[index]?.motifSetId).not.toBe(dates[index + intervening]?.motifSetId);
      }
      if (index > 0) expect(dates[index]?.boardTypeId).not.toBe(dates[index - 1]?.boardTypeId);
    }
    expect(dates[9]?.motifSetId).toBe(dates[0]?.motifSetId);
  });

  it('builds each daily target from its scheduled motif set and board type', () => {
    const date = '2026-09-29';
    const art = getDailyPuzzleArt(date);
    const release = generateDailyPuzzle(date);
    const motifSet = motifSets.find(({ id }) => id === art.motifSetId)!;

    expect(release.puzzle.target.every(({ motif }) => motifSet.motifs.includes(motif))).toBe(true);
    expect(new Set(release.puzzle.target.map(({ motif }) => motif))).toEqual(new Set(motifSet.motifs));
    expect(release.puzzle.motifDescription).toContain(art.boardTypeLabel.toLowerCase());
  }, 30000);

  it('validates each scheduled motif-set and board-type pairing at all difficulty tiers', () => {
    const epoch = Date.UTC(2026, 0, 1);
    for (let offset = 0; offset < 45; offset++) {
      const date = new Date(epoch + offset * 86400000).toISOString().slice(0, 10);
      const release = generateDailyPuzzle(date);
      const validation = validatePuzzleCandidate(release.puzzle);
      const art = getDailyPuzzleArt(date);
      const motifSet = motifSets.find(({ id }) => id === art.motifSetId)!;
      expect(validation.valid, date).toBe(true);
      expect(validation.tiers.map(({ minimumSwaps }) => minimumSwaps), date).toEqual([10, 10, 10]);
      expect(new Set(release.puzzle.target.map(({ motif }) => motif)), date).toEqual(new Set(motifSet.motifs));
      if (art.motifSetId === 9) {
        expect(new Set(release.puzzle.target.map(({ color }) => color)), date)
          .toEqual(new Set(['indigo', 'terracotta', 'ochre']));
      }
    }
  }, 30000);

  it('generates a deterministic, validated 10-swap puzzle for every visual tier', () => {
    const first = generateDailyPuzzle('2026-09-29');
    const second = generateDailyPuzzle('2026-09-29');

    expect(first).toEqual(second);
    expect(first.releaseDate).toBe('2026-09-29');
    expect(first.puzzleId).toMatch(/^daily-v2-2026-09-29-/);
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
    expect(dailyPuzzleFromId('daily-v3-2026-09-29-0-0')).toBeNull();
  });

  it('generates alternate authoring candidates from a deterministic target variation', () => {
    const first = generateDailyCandidate('2026-09-29', 0);
    const second = generateDailyCandidate('2026-09-29', 1);
    expect(first.id).not.toBe(second.id);
    expect(validatePuzzleCandidate(first).valid).toBe(true);
    expect(validatePuzzleCandidate(second).valid).toBe(true);
    expect(() => generateDailyCandidate('2026-09-29', 45)).toThrow(RangeError);
  });

  it('uses America/New_York midnight as the release boundary across DST changes', () => {
    expect(getNewYorkPuzzleDate(new Date('2026-03-08T04:59:00Z'))).toBe('2026-03-07');
    expect(getNewYorkPuzzleDate(new Date('2026-03-08T05:00:00Z'))).toBe('2026-03-08');
    expect(getNewYorkPuzzleDate(new Date('2026-11-01T03:59:00Z'))).toBe('2026-10-31');
    expect(getNewYorkPuzzleDate(new Date('2026-11-01T04:00:00Z'))).toBe('2026-11-01');
  });

  it('schedules the next New York midnight across daylight-saving changes', () => {
    expect(getNextNewYorkMidnight(new Date('2026-03-08T05:00:01Z')).toISOString())
      .toBe('2026-03-09T04:00:00.000Z');
    expect(getNextNewYorkMidnight(new Date('2026-11-01T04:00:01Z')).toISOString())
      .toBe('2026-11-02T05:00:00.000Z');
  });
});
