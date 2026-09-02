import { test, expect } from '@playwright/test';
import * as path from 'path';

/**
 * Smoke tài khoản thật trên PROD — chụp màn hình mọi khu vực học viên để soi mắt thường.
 *
 * ĐÃ PORT SANG /v2 Ở ĐỢT 3: tệp này trước đây đi thẳng vào cây v1 (`/login`, `/dashboard`,
 * `/roadmap/tree`, `/student/*`). Những trang đó nay KHÔNG CÒN TỒN TẠI — chỉ còn redirect 308 —
 * nên nếu để nguyên, mọi `page.goto` sẽ hoặc bị nảy một nhịp, hoặc rơi vào 404 với những path
 * không nằm trong bảng. Đích ở đây là path v2 THẬT, khớp `frontend/legacy-redirects.mjs`.
 *
 * Test tự SKIP khi thiếu E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD, nên nó không chạy trên CI.
 */
test.describe('Live Account Testing', () => {
  test.use({ baseURL: 'https://mydeutschflow.com' });

  // Trước đây trỏ vào một thư mục tuyệt đối trên máy một người. Ảnh giờ nằm cạnh kết quả
  // Playwright (test-results/ đã được .gitignore) để bất kỳ ai chạy cũng có chỗ ghi.
  const artifactDir = path.join('test-results', 'live-account');

  /** Khu vực học viên trên Galerie v2. Đích lấy từ bảng ánh xạ v1→v2 của Đợt 2.5 (#290). */
  const pagesToTest = [
    { name: 'speaking', path: '/v2/student/speaking' },
    { name: 'vocabulary', path: '/v2/student/vocabulary' },
    { name: 'roadmap', path: '/v2/student/roadmap' },
    { name: 'errors', path: '/v2/student/errors' },
    // `/student/review` và `/student/review-queue` của v1 gộp về CÙNG một trang ở v2 → chỉ còn một mục.
    { name: 'review', path: '/v2/student/review' },
    { name: 'speaking_history', path: '/v2/student/speaking/history' },
    { name: 'interviews', path: '/v2/student/interviews' },
    { name: 'mock_exam', path: '/v2/student/mock-exam' },
    { name: 'progress', path: '/v2/student/progress' },
    { name: 'certificates', path: '/v2/student/certificates' },
    { name: 'tutor', path: '/v2/student/tutor' },
    // `/student/leaderboard` + `/student/badges` (v1) → trang thành tích v2 đã gộp cả hai.
    { name: 'achievements', path: '/v2/student/achievements' },
    { name: 'settings', path: '/v2/profile' },
    { name: 'pricing', path: '/v2/payment' },
  ];

  test('Login and explore all features', async ({ page }) => {
    test.setTimeout(240000); // 4 phút

    page.on('console', msg => {
      console.log(`BROWSER CONSOLE [${msg.type()}]: ${msg.text()}`);
    });
    page.on('pageerror', err => {
      console.error(`BROWSER EXCEPTION: ${err.stack || err.message}`);
    });

    // 1. Trang đăng nhập — bề mặt DUY NHẤT từ Đợt 0 là /v2/login.
    console.log('Navigating to login...');
    await page.goto('/v2/login', { waitUntil: 'load' });
    await page.screenshot({ path: path.join(artifactDir, 'live_0_login_page.png') });

    // 2. Đăng nhập. Thông tin lấy từ env — không bao giờ hardcode tài khoản prod vào repo.
    const liveEmail = process.env.E2E_LIVE_EMAIL;
    const livePassword = process.env.E2E_LIVE_PASSWORD;
    test.skip(!liveEmail || !livePassword,
      'Set E2E_LIVE_EMAIL and E2E_LIVE_PASSWORD to run the live-account smoke test.');
    console.log('Logging in...');
    await page.fill('input[type="email"]', liveEmail!);
    await page.fill('input[type="password"]', livePassword!);
    await page.click('button[type="submit"]');

    // Mọi trang chủ sau đăng nhập đều nằm dưới /v2 (xem `homeFor()` trong src/lib/roleRouting.ts).
    await page.waitForURL(/\/v2\//, { timeout: 20000 });
    console.log('Logged in. Current URL:', page.url());

    // 3. Nếu funnel onboarding còn dang dở thì hoàn tất — nhãn nút giữ nguyên như v1
    //    (messages/v2/onboarding.vi.json: nav.continue = "Tiếp tục", nav.startRoadmap = "Bắt đầu lộ trình").
    console.log('Checking onboarding status at /v2/onboarding...');
    await page.goto('/v2/onboarding', { waitUntil: 'load' });
    await page.waitForTimeout(4000);

    const isStep1Visible = await page.getByText('Bạn đang ở trình độ nào?').isVisible();
    if (isStep1Visible) {
      console.log('Onboarding is pending. Completing step 1...');
      await page.screenshot({ path: path.join(artifactDir, 'onboarding_step1.png') });
      await page.click('button:has-text("Tiếp tục")');
      await page.waitForTimeout(2000);

      console.log('Completing step 2...');
      await page.screenshot({ path: path.join(artifactDir, 'onboarding_step2.png') });
      await page.click('button:has-text("Tiếp tục")');
      await page.waitForTimeout(2000);

      console.log('Completing step 3...');
      await page.screenshot({ path: path.join(artifactDir, 'onboarding_step3.png') });
      await page.click('button:has-text("Bắt đầu lộ trình")');
      await page.waitForTimeout(6000);
      console.log('Onboarding wizard completed! Current URL:', page.url());
    } else {
      console.log('Onboarding already completed or not active.');
    }

    // BỎ so với bản v1: bước "ép hoàn tất /roadmap/setup". Trang setup rời đó không được port —
    // ở v2 lộ trình do chính funnel onboarding phía trên tạo, và `/roadmap/setup` chỉ còn là
    // redirect về `/v2/student/roadmap`. Ảnh chụp lộ trình đã nằm trong danh sách bên dưới.

    await page.goto('/v2/student/dashboard', { waitUntil: 'load' });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(artifactDir, 'live_1_dashboard_initialized.png'), fullPage: true });
    console.log('Initialized Dashboard screenshot captured.');

    // 4. Đi qua từng khu vực và chụp màn hình.
    let index = 2;
    for (const item of pagesToTest) {
      try {
        console.log(`Navigating to ${item.name} (${item.path})...`);
        await page.goto(item.path, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(4000);

        // Hồi quy Đợt 3: không được nảy ngược ra ngoài /v2 (đường về v1 đã bị xoá hẳn).
        expect(page.url()).toContain('/v2/');

        console.log(`Loaded: ${page.url()} | Title: ${await page.title()}`);
        const screenshotName = `live_${index}_${item.name}.png`;
        await page.screenshot({ path: path.join(artifactDir, screenshotName), fullPage: true });
        console.log(`Captured screenshot: ${screenshotName}`);
        index++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error navigating to page ${item.name} (${item.path}):`, msg);
      }
    }

    console.log('Testing finished.');
  });
});
