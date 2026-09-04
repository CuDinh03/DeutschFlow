import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// E2E_JWT_SECRET phải KHỚP JWT_SECRET của dev server (.env.local): tokens.ts ký HS256 bằng nó,
// middleware verify bằng JWT_SECRET — lệch là mọi trang gated bị 307 về /v2/login và ~30 test
// fail "giả" (đã cắn hai lần: 26/08 và 04/09, lần sau mất cả buổi chẩn vì tưởng bug sản phẩm).
// Tự nạp tại đây để chạy `playwright test` trần vẫn đúng; export tay vẫn thắng nếu cần override.
if (!process.env.E2E_JWT_SECRET) {
  try {
    const envLocal = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    const m = envLocal.match(/^JWT_SECRET=(.*)$/m);
    if (m) process.env.E2E_JWT_SECRET = m[1].trim();
  } catch {
    // Không có .env.local (CI chẳng hạn): tokens.ts rơi về secret mặc định như trước.
  }
}

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
