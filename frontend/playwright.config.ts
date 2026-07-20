import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Requires dev server to be running externally: npm run dev
  // Run tests with: npm run dev & sleep 10 && npm run test:e2e
  webServer: {
    command: 'NEXT_PUBLIC_BACKEND_URL=http://localhost:3000 npm run dev',
    // Readiness probe must not depend on the v1 tree (scheduled for deletion) — and must not be a
    // gated route either: a 3xx bounce to login still counts as "up" for Playwright, but it compiles
    // the wrong page. `/` is public and unauthenticated, so it stays a truthful "server is serving".
    url: 'http://localhost:3000/',
    reuseExistingServer: true,
    timeout: 60000,
    env: {
      NEXT_PUBLIC_BACKEND_URL: 'http://localhost:3000',
    },
  },
});
