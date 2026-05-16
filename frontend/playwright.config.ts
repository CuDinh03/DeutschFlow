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
    url: 'http://localhost:3000/student/roadmap',
    reuseExistingServer: true,
    timeout: 60000,
    env: {
      NEXT_PUBLIC_BACKEND_URL: 'http://localhost:3000',
    },
  },
});
