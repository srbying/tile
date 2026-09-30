import { describe, expect, it, vi } from 'vitest';
import { createDailyPuzzleApi, decodePuzzleId } from './daily-puzzle-api';
import { generateDailyPuzzle } from './daily-puzzle-generator';

describe('daily puzzle API', () => {
  it('treats malformed URI-encoded puzzle IDs as not found', async () => {
    expect(decodePuzzleId('%E0%A4%A')).toBe('');

    const getById = vi.fn(() => null);
    const api = createDailyPuzzleApi({ getById });
    const response = await api.byId(new Request('https://tile.example/api/puzzles/%E0%A4%A'), decodePuzzleId('%E0%A4%A'));

    expect(getById).toHaveBeenCalledWith('');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Puzzle not found.' });
  });

  it('returns today’s stable release from the New York date provider', async () => {
    const release = generateDailyPuzzle('2026-09-29');
    const getToday = vi.fn(() => release);
    const api = createDailyPuzzleApi({
      now: () => new Date('2026-09-29T12:00:00Z'),
      getToday,
      getById: () => release,
    });

    const response = await api.today(new Request('https://tile.example/api/puzzles/today'));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(release);
    expect(getToday).toHaveBeenCalledWith(new Date('2026-09-29T12:00:00Z'));
  });

  it('rejects non-GET requests', async () => {
    const api = createDailyPuzzleApi();

    expect((await api.today(new Request('https://tile.example/api/puzzles/today', { method: 'POST' }))).status)
      .toBe(405);
    expect((await api.byId(new Request('https://tile.example/api/puzzles/id', { method: 'POST' }), 'id')).status)
      .toBe(405);
  });

  it('returns 404 for unsupported or malformed saved puzzle IDs', async () => {
    const api = createDailyPuzzleApi({ getById: () => null });
    const response = await api.byId(new Request('https://tile.example/api/puzzles/nope'), 'nope');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Puzzle not found.' });
  });

  it('fails closed when automatic generation cannot produce a validated release', async () => {
    const api = createDailyPuzzleApi({ getToday: () => { throw new Error('generation failed'); } });
    const response = await api.today(new Request('https://tile.example/api/puzzles/today'));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Today’s puzzle is temporarily unavailable.' });
  });
});
