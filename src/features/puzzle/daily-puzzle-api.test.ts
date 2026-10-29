import { describe, expect, it, vi } from 'vitest';
import { createDailyPuzzleApi, decodePuzzleId } from './daily-puzzle-api';
import { generateDailyPuzzle, getDailyPuzzleForNow } from './daily-puzzle-generator';
import { validatePuzzleCandidate } from './puzzle-candidate';

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
    expect(response.headers.get('cdn-cache-control'))
      .toBe('public, s-maxage=57600, must-revalidate, stale-while-revalidate=0, stale-if-error=0');
    expect(response.headers.get('date')).toBe('Tue, 29 Sep 2026 12:00:00 GMT');
    expect(response.headers.get('expires')).toBe('Wed, 30 Sep 2026 04:00:00 GMT');
    expect(await response.json()).toEqual(release);
    expect(getToday).toHaveBeenCalledWith(new Date('2026-09-29T12:00:00Z'));
  });

  it('returns the same validated release on independent origin cache misses', async () => {
    const firstOrigin = createDailyPuzzleApi({ now: () => new Date('2026-09-29T12:00:00Z') });
    const secondOrigin = createDailyPuzzleApi({ now: () => new Date('2026-09-29T23:00:00Z') });
    const request = new Request('https://tile.example/api/puzzles/today');
    const first = await firstOrigin.today(request);
    const second = await secondOrigin.today(request);
    const release = await first.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(release);
    expect(release.puzzleId).toBe('daily-v3-2026-09-29-0-2');
    expect(release.puzzle.id).toBe(release.puzzleId);
    const validation = validatePuzzleCandidate(release.puzzle);
    expect(validation.valid).toBe(true);
    expect(validation.tiers.map(({ tierId, minimumSwaps, attemptLimit }) => ({ tierId, minimumSwaps, attemptLimit })))
      .toEqual([
        { tierId: 'easy', minimumSwaps: 10, attemptLimit: 15 },
        { tierId: 'medium', minimumSwaps: 10, attemptLimit: 13 },
        { tierId: 'hard', minimumSwaps: 10, attemptLimit: 10 },
      ]);
    const replay = await secondOrigin.byId(new Request(`https://tile.example/api/puzzles/${release.puzzleId}`), release.puzzleId);
    expect(await replay.json()).toEqual(release);
  });

  it('keeps one immutable ID per New York release and advances at midnight in both DST seasons', async () => {
    let now = new Date('2026-03-08T04:59:59Z');
    const api = createDailyPuzzleApi({ now: () => new Date(now) });
    const getRelease = async () => {
      const response = await api.today(new Request('https://tile.example/api/puzzles/today'));
      expect(response.status).toBe(200);
      return await response.json() as { puzzleId: string; releaseDate: string };
    };

    const beforeSpringMidnight = await getRelease();
    expect(await getRelease()).toEqual(beforeSpringMidnight);
    now = new Date('2026-03-08T05:00:00Z');
    const afterSpringMidnight = await getRelease();
    expect(afterSpringMidnight.releaseDate).toBe('2026-03-08');
    expect(afterSpringMidnight.puzzleId).not.toBe(beforeSpringMidnight.puzzleId);

    now = new Date('2026-11-01T03:59:59Z');
    const beforeFallMidnight = await getRelease();
    expect(beforeFallMidnight.releaseDate).toBe('2026-10-31');
    expect(await getRelease()).toEqual(beforeFallMidnight);
    now = new Date('2026-11-01T04:00:00Z');
    const afterFallMidnight = await getRelease();
    expect(afterFallMidnight.releaseDate).toBe('2026-11-01');
    expect(afterFallMidnight.puzzleId).not.toBe(beforeFallMidnight.puzzleId);
  }, 30000);

  it.each([
    ['2026-03-08T05:00:00Z', 'Mon, 09 Mar 2026 04:00:00 GMT', 82800],
    ['2026-11-01T04:00:00Z', 'Mon, 02 Nov 2026 05:00:00 GMT', 90000],
    ['2026-03-09T03:59:59Z', 'Mon, 09 Mar 2026 04:00:00 GMT', 1],
    ['2026-11-02T04:59:59Z', 'Mon, 02 Nov 2026 05:00:00 GMT', 1],
    ['2026-03-09T04:00:00Z', 'Tue, 10 Mar 2026 04:00:00 GMT', 86400],
    ['2026-11-02T05:00:00Z', 'Tue, 03 Nov 2026 05:00:00 GMT', 86400],
  ])('bounds cache freshness at midnight for %s', async (timestamp, expiry, seconds) => {
    const api = createDailyPuzzleApi({ now: () => new Date(timestamp) });
    const response = await api.today(new Request('https://tile.example/api/puzzles/today'));

    expect(response.status).toBe(200);
    expect(response.headers.get('cdn-cache-control'))
      .toBe(`public, s-maxage=${seconds}, must-revalidate, stale-while-revalidate=0, stale-if-error=0`);
    expect(response.headers.get('expires')).toBe(expiry);
  });

  it.each([
    ['2026-09-29T12:00:00Z', '2026-09-29T13:00:00Z', '2026-09-29', 54000],
    ['2026-03-09T03:59:59Z', '2026-03-09T04:00:00Z', '2026-03-09', 86400],
    ['2026-11-02T04:59:59Z', '2026-11-02T05:00:00Z', '2026-11-02', 86400],
  ])('uses the response date when generation starting at %s finishes at %s', async (start, finish, date, seconds) => {
    let clock = new Date(start);
    const api = createDailyPuzzleApi({
      now: () => new Date(clock),
      getToday: (at) => {
        clock = new Date(finish);
        return getDailyPuzzleForNow(at);
      },
    });
    const response = await api.today(new Request('https://tile.example/api/puzzles/today'));

    expect(response.status).toBe(200);
    expect((await response.json()).releaseDate).toBe(date);
    expect(response.headers.get('date')).toBe(new Date(finish).toUTCString());
    expect(response.headers.get('cdn-cache-control')).toContain(`s-maxage=${seconds},`);
  });

  it('does not cache the fractional second before midnight', async () => {
    const api = createDailyPuzzleApi({ now: () => new Date('2026-09-30T03:59:59.999Z') });
    const response = await api.today(new Request('https://tile.example/api/puzzles/today'));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('cdn-cache-control')).toBe('no-store');
    expect((await response.json()).releaseDate).toBe('2026-09-29');
  });

  it.each(['invalid', 'stale', 'future'])('does not cache a %s provider release', async (kind) => {
    const release = generateDailyPuzzle('2026-09-29');
    const provided = kind === 'invalid'
      ? { ...release, puzzle: { ...release.puzzle, target: [] } }
      : generateDailyPuzzle(kind === 'stale' ? '2026-09-28' : '2026-09-30');
    const api = createDailyPuzzleApi({
      now: () => new Date('2026-09-29T12:00:00Z'),
      getToday: () => provided,
    });
    const response = await api.today(new Request('https://tile.example/api/puzzles/today'));

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('cdn-cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'Today’s puzzle is temporarily unavailable.' });
  });

  it.each([1, 2, 3])('replays supported v%s releases but withholds future IDs until midnight', async (version) => {
    let clock = new Date('2026-09-30T03:59:59Z');
    const api = createDailyPuzzleApi({ now: () => new Date(clock) });
    const savedId = `daily-v${version}-2026-09-29-0-0`;
    const savedRequest = new Request(`https://tile.example/api/puzzles/${savedId}`);
    const saved = await api.byId(savedRequest, savedId);
    expect(saved.status).toBe(200);
    expect(saved.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect((await saved.clone().json()).puzzleId).toBe(savedId);
    expect(await (await api.byId(savedRequest, savedId)).json()).toEqual(await saved.json());

    const futureId = `daily-v${version}-2026-09-30-0-0`;
    const futureRequest = new Request(`https://tile.example/api/puzzles/${futureId}`);
    const future = await api.byId(futureRequest, futureId);
    expect(future.status).toBe(404);
    expect(future.headers.get('cache-control')).toBe('no-store');
    expect(future.headers.get('cdn-cache-control')).toBe('no-store');

    clock = new Date('2026-09-30T04:00:00Z');
    const released = await api.byId(futureRequest, futureId);
    expect(released.status).toBe(200);
    expect((await released.json()).releaseDate).toBe('2026-09-30');
  }, 30000);

  it('rejects non-GET requests', async () => {
    const api = createDailyPuzzleApi();

    const responses = [
      await api.today(new Request('https://tile.example/api/puzzles/today', { method: 'POST' })),
      await api.byId(new Request('https://tile.example/api/puzzles/id', { method: 'POST' }), 'id'),
    ];
    for (const response of responses) {
      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe('GET');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('cdn-cache-control')).toBe('no-store');
    }
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
