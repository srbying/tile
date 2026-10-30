import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'public-game.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 55_000, // The probe has its own 45-second deadline; allow cleanup/reporting.
  forbidOnly: true,
  reporter: 'line',
  use: {
    ...devices['Desktop Chrome'],
    serviceWorkers: 'block',
    actionTimeout: 10_000,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});
