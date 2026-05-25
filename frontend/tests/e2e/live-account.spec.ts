import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Live Account Testing', () => {
  test.use({ baseURL: 'https://mydeutschflow.com' });

  const artifactDir = '/Users/dinhcu/.gemini/antigravity/brain/2d9086a8-6508-4bd5-854b-53e50cfba324';

  const pagesToTest = [
    { name: 'dashboard', path: '/dashboard' },
    { name: 'speaking', path: '/speaking' },
    { name: 'vocabulary', path: '/vocabulary' },
    { name: 'roadmap_tree', path: '/roadmap/tree' },
    { name: 'errors', path: '/student/errors' },
    { name: 'review', path: '/student/review' },
    { name: 'review_queue', path: '/student/review-queue' },
    { name: 'speaking_history', path: '/student/speaking-history' },
    { name: 'interviews', path: '/student/interviews' },
    { name: 'mock_exam', path: '/student/mock-exam' },
    { name: 'progress', path: '/student/progress' },
    { name: 'certificates', path: '/student/certificates' },
    { name: 'tutor', path: '/student/tutor' },
    { name: 'leaderboard', path: '/student/leaderboard' },
    { name: 'badges', path: '/student/badges' },
    { name: 'settings', path: '/student/settings' },
    { name: 'pricing', path: '/student/pricing' }
  ];

  test('Login and explore all features', async ({ page }) => {
    test.setTimeout(240000); // 4 minutes

    // Capture console and page errors
    page.on('console', msg => {
      console.log(`BROWSER CONSOLE [${msg.type()}]: ${msg.text()}`);
    });
    page.on('pageerror', err => {
      console.error(`BROWSER EXCEPTION: ${err.stack || err.message}`);
    });

    // 1. Visit login page
    console.log('Navigating to login...');
    await page.goto('/login', { waitUntil: 'load' });
    await page.screenshot({ path: path.join(artifactDir, 'live_0_login_page.png') });

    // 2. Fill credentials & Login
    console.log('Logging in...');
    await page.fill('input[type="email"]', 'nvb@gmail.com');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await page.waitForURL(/\/dashboard|student|roadmap|onboarding/, { timeout: 20000 });
    console.log('Logged in. Current URL:', page.url());
    await page.waitForTimeout(5000);

    // 3. Force Onboarding completion
    console.log('Checking onboarding status by navigating directly to /onboarding...');
    await page.goto('/onboarding', { waitUntil: 'load' });
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

    // 4. Force Roadmap Setup completion
    console.log('Checking roadmap setup status by navigating directly to /roadmap/setup...');
    await page.goto('/roadmap/setup', { waitUntil: 'load' });
    await page.waitForTimeout(4000);

    const isSetupFormVisible = await page.getByText('Thiết lập lộ trình học').isVisible();
    if (isSetupFormVisible) {
      console.log('Roadmap setup is pending. Submitting roadmap setup...');
      await page.screenshot({ path: path.join(artifactDir, 'roadmap_setup_page.png') });
      await page.click('button:has-text("Tạo lộ trình")');
      console.log('Clicked "Tạo lộ trình". Waiting for redirect...');
      await page.waitForTimeout(8000);
      console.log('Roadmap setup submitted. Current URL:', page.url());
    } else {
      console.log('Roadmap setup already completed or not active.');
    }

    // Capture main dashboard screen after initialization
    await page.goto('/dashboard', { waitUntil: 'load' });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(artifactDir, 'live_1_dashboard_initialized.png'), fullPage: true });
    console.log('Initialized Dashboard screenshot captured.');

    // 5. Visit each student section and capture screenshots
    let index = 2;
    for (const item of pagesToTest) {
      try {
        console.log(`Navigating to ${item.name} (${item.path})...`);
        await page.goto(item.path, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(4000);

        const currentUrl = page.url();
        const pageTitle = await page.title();
        console.log(`Loaded: ${currentUrl} | Title: ${pageTitle}`);

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
