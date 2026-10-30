import { describe, expect, it, vi } from 'vitest';
import { createDailyPuzzleApi } from './daily-puzzle-api';
import { generateDailyPuzzle } from './daily-puzzle-generator';
import { createDailyPuzzleReleaseLoader } from './daily-puzzle-release-cache';

const today = generateDailyPuzzle('2026-10-30');

describe('daily release diagnostics', () => {
  it('logs an actionable generation failure without leaking exception or request data', async () => {
    const reportFailure = vi.fn();
    const api = createDailyPuzzleApi({
      now: () => new Date('2026-10-30T12:00:00Z'),
      getToday: () => { throw new Error('private-player-sentinel'); },
      reportFailure,
    });
    const response = await api.today(new Request('https://tile.example/api/puzzles/today', {
      headers: { Cookie: 'private-cookie-sentinel', Authorization: 'private-token-sentinel' },
    }));

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith({
      event: 'daily_puzzle_failure', operation: 'today', reason: 'generation',
      timestamp: '2026-10-30T12:00:00.000Z', releaseDate: '2026-10-30',
      status: 503, durationMilliseconds: expect.any(Number),
    });
    expect(JSON.stringify(reportFailure.mock.calls)).not.toContain('sentinel');
  });

  it.each(['invalid_release', 'wrong_date'] as const)('identifies current-release %s failures', async (reason) => {
    const reportFailure = vi.fn();
    const api = createDailyPuzzleApi({
      now: () => new Date('2026-10-30T12:00:00Z'), reportFailure,
      getToday: () => reason === 'invalid_release'
        ? { ...today, puzzle: { ...today.puzzle, target: [] } }
        : generateDailyPuzzle('2026-10-29'),
    });
    expect((await api.today(new Request('https://tile.example/api/puzzles/today'))).status).toBe(503);
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      operation: 'today', reason, releaseDate: '2026-10-30', status: 503,
    }));
    expect(reportFailure.mock.calls[0]![0]).not.toHaveProperty('puzzleId');
  });

  it.each(['generation', 'invalid_release'] as const)('identifies historical %s failures with the requested identity', async (reason) => {
    const reportFailure = vi.fn();
    const api = createDailyPuzzleApi({
      now: () => new Date('2026-10-30T12:00:00Z'), reportFailure,
      getById: () => {
        if (reason === 'generation') throw new Error('private-player-sentinel');
        return { ...today, puzzleId: 'private-payload-sentinel' };
      },
    });
    const response = await api.byId(new Request(`https://tile.example/api/puzzles/${today.puzzleId}`), today.puzzleId);
    expect(response.status).toBe(503);
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      operation: 'by_id', reason, puzzleId: today.puzzleId, releaseDate: '2026-10-30', status: 503,
    }));
    expect(JSON.stringify(reportFailure.mock.calls)).not.toContain('sentinel');
  });

  it('logs failed delivery while preserving a validated cached fallback', async () => {
    const reportFailure = vi.fn();
    const load = createDailyPuzzleReleaseLoader({
      now: () => new Date('2026-10-30T12:00:00Z'), reportFailure,
      fetcher: async () => new Response('private-body-sentinel', { status: 503 }),
      cache: { read: async () => today, write: async () => {}, clear: async () => {} },
    });
    await expect(load(new AbortController().signal)).resolves.toEqual({ release: today, source: 'cache' });
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith({
      event: 'daily_puzzle_failure', operation: 'load_today', reason: 'http', status: 503,
      timestamp: '2026-10-30T12:00:00.000Z', releaseDate: '2026-10-30',
      durationMilliseconds: expect.any(Number),
    });
    expect(JSON.stringify(reportFailure.mock.calls)).not.toContain('sentinel');
  });

  it.each([
    ['network', async () => { throw new TypeError('private-network-sentinel'); }],
    ['invalid_json', async () => new Response('private-json-sentinel')],
    ['invalid_release', async () => Response.json({ puzzleId: 'private-payload-sentinel' })],
    ['wrong_date', async () => Response.json(generateDailyPuzzle('2026-10-29'))],
  ] as const)('classifies delivery failure as %s without leaking raw data', async (reason, fetcher) => {
    const reportFailure = vi.fn();
    const load = createDailyPuzzleReleaseLoader({
      now: () => new Date('2026-10-30T12:00:00Z'), reportFailure, fetcher,
    });
    await expect(load(new AbortController().signal)).rejects.toThrow('Daily puzzle is unavailable.');
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ operation: 'load_today', reason }));
    expect(JSON.stringify(reportFailure.mock.calls)).not.toContain('sentinel');
  });

  it('identifies a ten-second timeout while preserving cached play', async () => {
    vi.useFakeTimers();
    try {
      const reportFailure = vi.fn();
      const load = createDailyPuzzleReleaseLoader({
        now: () => new Date('2026-10-30T12:00:00Z'), reportFailure,
        fetcher: () => new Promise<Response>(() => {}),
        cache: { read: async () => today, write: async () => {}, clear: async () => {} },
      });
      const result = load(new AbortController().signal);
      await vi.advanceTimersByTimeAsync(10_000);
      await expect(result).resolves.toEqual({ release: today, source: 'cache' });
      expect(reportFailure).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ reason: 'timeout' }));
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs a missing current release while preserving the null result', async () => {
    const reportFailure = vi.fn();
    const load = createDailyPuzzleReleaseLoader({
      now: () => new Date('2026-10-30T12:00:00Z'), reportFailure,
      fetcher: async () => new Response(null, { status: 404 }),
    });
    await expect(load(new AbortController().signal)).resolves.toBeNull();
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ reason: 'http', status: 404 }));
  });

  it('does not treat canceled delivery as a service failure', async () => {
    const reportFailure = vi.fn();
    const controller = new AbortController();
    const load = createDailyPuzzleReleaseLoader({
      reportFailure, fetcher: () => new Promise<Response>(() => {}),
    });
    const result = load(controller.signal);
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(reportFailure).not.toHaveBeenCalled();
  });

  it('does not log successful delivery, rejected IDs, or canonical redirects as failures', async () => {
    const reportFailure = vi.fn();
    const api = createDailyPuzzleApi({ now: () => new Date('2026-10-30T12:00:00Z'), reportFailure });
    expect((await api.today(new Request('https://tile.example/api/puzzles/today'))).status).toBe(200);
    expect((await api.byId(new Request('https://tile.example/api/puzzles/bad'), 'bad')).status).toBe(404);
    expect((await api.today(new Request('https://tile.example/api/puzzles/today?private-sentinel'))).status).toBe(308);
    const load = createDailyPuzzleReleaseLoader({
      now: () => new Date('2026-10-30T12:00:00Z'), reportFailure, fetcher: async () => Response.json(today),
    });
    await expect(load(new AbortController().signal)).resolves.toEqual({ release: today, source: 'network' });
    expect(reportFailure).not.toHaveBeenCalled();
  });

  it.each([false, true])('preserves responses and fallback when a reporter rejects (async=%s)', async (asynchronous) => {
    const reportFailure = () => {
      if (asynchronous) return Promise.reject(new Error('logging unavailable'));
      throw new Error('logging unavailable');
    };
    const api = createDailyPuzzleApi({ reportFailure, getToday: () => { throw new Error('generation failed'); } });
    expect((await api.today(new Request('https://tile.example/api/puzzles/today'))).status).toBe(503);
    const load = createDailyPuzzleReleaseLoader({
      now: () => new Date('2026-10-30T12:00:00Z'), reportFailure,
      fetcher: async () => new Response(null, { status: 503 }),
      cache: { read: async () => today, write: async () => {}, clear: async () => {} },
    });
    await expect(load(new AbortController().signal)).resolves.toEqual({ release: today, source: 'cache' });
  });

  it('writes safe structured JSON to the default console destination', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const api = createDailyPuzzleApi({ getToday: () => { throw new Error('private-exception-sentinel'); } });
      expect((await api.today(new Request('https://tile.example/api/puzzles/today'))).status).toBe(503);
      expect(log).toHaveBeenCalledOnce();
      const event = JSON.parse(log.mock.calls[0]![0] as string);
      expect(event).toMatchObject({ event: 'daily_puzzle_failure', operation: 'today', reason: 'generation', status: 503 });
      expect(event.durationMilliseconds).toBeGreaterThanOrEqual(0);
      expect(JSON.stringify(event)).not.toContain('sentinel');
    } finally {
      log.mockRestore();
    }
  });
});
