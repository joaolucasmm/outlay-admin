import { defineConfig, devices } from '@playwright/test';

const PORT = 4174;
const BASE_URL = `http://localhost:${PORT}/outlay-admin/`;
const CI = Boolean(process.env.CI);

/**
 * End-to-end tests against the production build, served under the GitHub Pages base path
 * in mock mode: the same artifact the demo deploys (MSW worker, 404.html fallback aside).
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
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
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
});
