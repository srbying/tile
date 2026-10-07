import { describe, expect, it } from 'vitest';
import { buildResultShareText } from './result-sharing';

describe('result share text', () => {
  it('summarizes a win without exposing puzzle content', () => {
    expect(buildResultShareText({
      releaseDate: '2026-09-29',
      mode: 'Hard',
      status: 'won',
      attemptsUsed: 10,
      attemptLimit: 10,
      hintUsed: false,
    })).toBe('Daily Tile-Swap Puzzle · 2026-09-29\nSolved · Hard mode · 10/10 swaps · No hint');
  });

  it('summarizes a failure without exposing puzzle content', () => {
    expect(buildResultShareText({
      releaseDate: '2026-09-29',
      mode: 'Medium',
      status: 'lost',
      attemptsUsed: 13,
      attemptLimit: 13,
      hintUsed: false,
    })).toBe('Daily Tile-Swap Puzzle · 2026-09-29\nNot solved · Medium mode · 13/13 swaps · No hint');
  });

  it('says when a hint was used', () => {
    expect(buildResultShareText({
      releaseDate: '2026-09-29',
      mode: 'Easy',
      status: 'won',
      attemptsUsed: 9,
      attemptLimit: 15,
      hintUsed: true,
    })).toBe('Daily Tile-Swap Puzzle · 2026-09-29\nSolved · Easy mode · 9/15 swaps · Hint used');
  });
});
