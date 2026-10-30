import { appendFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { checkPublicGame } from './public-game-check';

test('public daily release is available and playable', async ({ page }) => {
  const controlledFailure = process.env.TILE_MONITOR_SIMULATE_FAILURE === 'true';
  if (controlledFailure) {
    await page.route('**/api/puzzles/today', (route) => route.fulfill({
      status: 503, contentType: 'application/json', body: '{"error":"Controlled monitor drill."}',
    }));
  }
  const result = await checkPublicGame(page, process.env.TILE_MONITOR_URL ?? '');
  const report = JSON.stringify({ ...result, controlledFailure });
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## Public daily release\n\n${result.ok ? 'PASS' : 'FAIL'}${controlledFailure ? ' (controlled drill)' : ''}\n\n`
      + `\`\`\`json\n${report}\n\`\`\`\n\n`
      + '[Response runbook](https://github.com/srbying/tile/blob/main/docs/operations.md)\n');
  }
  expect(result.ok, `Public game check failed: ${result.reason ?? 'unknown'}. See docs/operations.md.`).toBe(true);
});
