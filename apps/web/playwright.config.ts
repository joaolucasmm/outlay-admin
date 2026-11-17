import { defineConfig, devices } from '@playwright/test';

const PORT = 4174;
const BASE_URL = `http://localhost:${PORT}/outlay-admin/`;
const CI = Boolean(process.env.CI);

/**
 * `E2E_API=live` builds the app against the Java tenant API (docker compose up, port 8080)
 * and runs the main flow there, one test at a time on the shared database. AI stays mocked.
 */
const LIVE = process.env.E2E_API === 'live';
const LIVE_API_URL = 'http://localhost:8080/api/v1';

/**
 * End-to-end tests against the production build, served under the GitHub Pages base path.
 * By default in mock mode: the same artifact the demo deploys (MSW worker, 404.html aside).
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: LIVE ? 'smoke.e2e.ts' : '**/*.e2e.ts',
  fullyParallel: !LIVE,
  workers: LIVE ? 1 : undefined,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && pnpm exec vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !CI && !LIVE,
    timeout: 180_000,
    env: LIVE ? { VITE_API_MODE: 'live', VITE_API_URL: LIVE_API_URL, VITE_AI_MODE: 'mock' } : {},
  },
});
