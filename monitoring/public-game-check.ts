import type { Page } from '@playwright/test';
import { parseDailyPuzzleRelease } from '../src/features/puzzle/daily-puzzle-release-cache';
import { getNewYorkPuzzleDate } from '../src/features/puzzle/daily-puzzle-generator';

export interface PublicGameCheckResult {
  readonly ok: boolean;
  readonly timestamp: string;
  readonly durationMilliseconds: number;
  readonly reason?: 'page_unavailable' | 'page_http' | 'page_redirect' | 'release_timeout'
    | 'release_http' | 'invalid_json' | 'invalid_release' | 'wrong_date'
    | 'ui_unavailable' | 'interaction_failed' | 'runtime_error' | 'probe_timeout' | 'invalid_target';
  readonly pageStatus?: number;
  readonly releaseStatus?: number;
  readonly releaseDate?: string;
  readonly puzzleId?: string;
}

export interface PublicGameCheckOptions {
  readonly now?: () => Date;
  readonly timeoutMilliseconds?: number;
}

export async function checkPublicGame(page: Page, baseURL: string, options: PublicGameCheckOptions = {}): Promise<PublicGameCheckResult> {
  const started = performance.now();
  const now = options.now ?? (() => new Date());
  const timestamp = now().toISOString();
  let reason: PublicGameCheckResult['reason'] = 'page_unavailable';
  let pageStatus: number | undefined;
  let releaseStatus: number | undefined;
  let releaseDate: string | undefined;
  let puzzleId: string | undefined;
  let runtimeError = false;
  const onRuntimeError = () => { runtimeError = true; };
  page.on('pageerror', onRuntimeError);
  const result = (ok: boolean): PublicGameCheckResult => ({
    ok, timestamp, durationMilliseconds: Math.max(0, Math.round(performance.now() - started)),
    ...(ok ? {} : { reason }),
    ...(pageStatus === undefined ? {} : { pageStatus }),
    ...(releaseStatus === undefined ? {} : { releaseStatus }),
    ...(releaseDate ? { releaseDate } : {}),
    ...(puzzleId ? { puzzleId } : {}),
  });

  const probe = async (): Promise<PublicGameCheckResult> => {
    try {
      reason = 'invalid_target';
      const target = new URL(baseURL);
      if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password
        || target.search || target.hash || target.pathname !== '/') return result(false);
      reason = 'page_unavailable';
      const releaseResponse = page.waitForResponse((response) =>
        response.url() === new URL('/api/puzzles/today', target).href
        && response.request().method() === 'GET', { timeout: 10_000 })
        .catch(() => null);
      const navigation = await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      pageStatus = navigation?.status();
      reason = 'page_http';
      if (pageStatus !== 200) return result(false);
      reason = 'page_redirect';
      if (page.url() !== target.href) return result(false);
      reason = 'release_timeout';
      const response = await releaseResponse;
      if (!response) return result(false);
      releaseStatus = response.status();
      reason = 'release_http';
      if (releaseStatus !== 200) return result(false);
      reason = 'invalid_json';
      const payload: unknown = await response.json();
      reason = 'invalid_release';
      if (!response.headers()['content-type']?.includes('application/json')) return result(false);
      const release = parseDailyPuzzleRelease(payload);
      if (!release) return result(false);
      releaseDate = release.releaseDate;
      puzzleId = release.puzzleId;
      reason = 'wrong_date';
      if (releaseDate !== getNewYorkPuzzleDate(now())) return result(false);
      reason = 'ui_unavailable';
      await page.getByRole('heading', { name: 'Daily Tile-Swap Puzzle', exact: true }).waitFor({ timeout: 10_000 });
      if (!(await page.getByRole('contentinfo').innerText()).includes(releaseDate)) return result(false);
      if (await page.getByRole('radio').count() !== 3) return result(false);
      for (const mode of ['Easy', 'Medium', 'Hard']) {
        if (!await page.getByRole('radio', { name: new RegExp(`^${mode}\\b`) }).isEnabled()) return result(false);
      }
      await page.getByRole('radio', { name: /^Medium\b/ }).check();
      await page.getByRole('button', { name: 'Start puzzle', exact: true }).click();
      const tiles = page.getByRole('group', { name: 'Your tiles' }).getByRole('button');
      await tiles.last().waitFor();
      if (await tiles.count() !== 36
        || await page.getByRole('list', { name: 'Target pattern' }).getByRole('listitem').count() !== 36
        || !await tiles.evaluateAll((buttons) => buttons.every((button) => !button.hasAttribute('disabled')))) return result(false);
      reason = 'interaction_failed';
      await page.getByText('13 swaps left', { exact: true }).waitFor();
      await tiles.nth(0).click();
      await tiles.nth(1).click();
      await page.getByText('12 swaps left', { exact: true }).waitFor();
      if (runtimeError) {
        reason = 'runtime_error';
        return result(false);
      }
      return result(true);
    } catch {
      if (runtimeError) reason = 'runtime_error';
      return result(false);
    }
  };
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<PublicGameCheckResult>((resolve) => {
    timer = setTimeout(() => {
      reason = 'probe_timeout';
      resolve(result(false));
      void page.close().catch(() => {});
    }, Math.min(options.timeoutMilliseconds ?? 45_000, 45_000));
  });
  try {
    return await Promise.race([probe(), deadline]);
  } finally {
    clearTimeout(timer!);
    page.off('pageerror', onRuntimeError);
  }
}
