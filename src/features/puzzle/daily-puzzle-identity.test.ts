import { describe, expect, it } from 'vitest';
import { parseDailyPuzzleId } from './daily-puzzle-identity';

describe('daily puzzle identity', () => {
  it.each([[1, 66], [2, 44], [3, 44]])('parses canonical v%s identities at both bounds', (generatorVersion, lastVariation) => {
    for (const variation of [0, lastVariation]) {
      for (const scramble of [0, 3]) {
        expect(parseDailyPuzzleId(`daily-v${generatorVersion}-2024-02-29-${variation}-${scramble}`))
          .toEqual({ generatorVersion, releaseDate: '2024-02-29', variation, scramble });
      }
    }
  });

  it.each([
    '', 'nope', 'daily-v4-2026-09-29-0-0', 'daily-v01-2026-09-29-0-0',
    'daily-v1-2026-09-29-67-0', 'daily-v2-2026-09-29-45-0', 'daily-v3-2026-09-29-45-0',
    'daily-v3-2026-09-29-00-0', 'daily-v3-2026-09-29-0-00', 'daily-v3-2026-09-29-0-4',
    'daily-v3-2026-09-29--1-0', 'daily-v3-2026-02-29-0-0', 'daily-v3-2026-04-31-0-0',
    'daily-v3-2026-13-01-0-0', 'daily-v3-2026-00-01-0-0', 'daily-v3-2026-09-00-0-0',
    'daily-v3-2026-9-29-0-0', 'daily-v3-2026-09-29-0-0\n', 'daily-v3-2026-09-29-0-0/extra',
    `daily-v3-2026-09-29-${'9'.repeat(10000)}-0`,
  ])('rejects invalid or noncanonical identity %s', (id) => {
    expect(parseDailyPuzzleId(id)).toBeNull();
  });
});
