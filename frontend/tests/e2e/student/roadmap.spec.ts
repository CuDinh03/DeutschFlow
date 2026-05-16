import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Student Roadmap — AsyncJob Integration
 *
 * Strategy: We mock ALL backend API calls at the network layer (page.route).
 * The app uses localStorage key 'accessToken' for auth.
 * addInitScript sets this BEFORE React hydrates.
 * We also intercept the navigation redirect to /undefined (caused by useLocale
 * returning undefined in headless) and redirect back to the roadmap.
 */
test.describe('Student Roadmap', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Next.js required cookies (next-intl and authSession)
    await page.context().addCookies([
      { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
      { name: 'auth_access', value: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiU1RVREVOVCIsInN1YiI6IjEiLCJleHAiOjE3NzkwMjgyODF9.tketgaKuI7Mbm_Tbu4bYBzxUTUBtcEt25f5gaD53dJY', domain: 'localhost', path: '/' },
      { name: 'auth_role', value: 'STUDENT', domain: 'localhost', path: '/' },
      { name: 'auth_logged_in', value: '1', domain: 'localhost', path: '/' }
    ]);

    // Set localStorage token (key 'accessToken' per authSession.ts)
    await page.addInitScript(() => {
      // Valid JWT signed with dev secret so middleware accepts it
      localStorage.setItem('accessToken', 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiU1RVREVOVCIsInN1YiI6IjEiLCJleHAiOjE3NzkwMjgyODF9.tketgaKuI7Mbm_Tbu4bYBzxUTUBtcEt25f5gaD53dJY');
      localStorage.setItem('df_roadmap_view', 'list');
    });

    // ── Mock all API endpoints ──────────────────────────────────────────────
    // Catch-all MUST be registered first so specific routes can override it
    await page.route('**/api/**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    }));

    // Use regex to strictly match /api/auth/me (no trailing characters like /plan)
    await page.route(/.+\/api\/auth\/me$/, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        displayName: 'Test Student',
        role: 'STUDENT',
        userId: 1,
        email: 'student@test.com',
        learningTargetLevel: 'A1',
      }),
    }));

    await page.route('**/api/auth/me/plan', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ planCode: 'PRO', tier: 'PRO' }),
    }));

    await page.route('**/api/onboarding/status', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hasPlan: true }),
    }));

    await page.route('**/api/plan/me', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ plan: { targetLevel: 'A1', currentLevel: 'A1' } }),
    }));

    await page.route('**/api/student/dashboard', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ streakDays: 5 }),
    }));

    await page.route('**/api/skill-tree/me', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          node_type: 'CORE_TRUNK',
          title_vi: 'Cơ bản 1',
          title_de: 'Grundlagen 1',
          description_vi: 'Bài học cơ bản đầu tiên',
          emoji: '🚀',
          user_status: 'COMPLETED',
          cefr_level: 'A1',
          phase: 'GRUNDLAGEN',
          xp_reward: 50, energy_cost: 10, difficulty: 1,
          dependencies_met: true,
          user_score: 100, user_xp: 50, user_attempts: 1,
          sort_order: 1, week_number: 1, day_number: 1,
          completed_at: null,
        },
        {
          id: 2,
          node_type: 'SATELLITE_LEAF',
          title_vi: 'Chuyên ngành IT',
          title_de: 'IT Fachbegriffe',
          description_vi: 'Từ vựng IT chuyên ngành',
          emoji: '💻',
          user_status: 'LOCKED',
          cefr_level: 'A1',
          phase: 'BERUF_CONTEXT',
          xp_reward: 100, energy_cost: 15, difficulty: 2,
          dependencies_met: true,
          user_score: 0, user_xp: 0, user_attempts: 0,
          sort_order: 2, week_number: 1, day_number: 1,
          completed_at: null,
        },
      ]),
    }));

  });

  test('should display skill tree nodes in list view', async ({ page }) => {
    await page.goto('/student/roadmap');

    await expect(page.getByText('Cơ bản 1')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Chuyên ngành IT')).toBeVisible();
  });

  test('should unlock satellite node via AsyncJob polling', async ({ page }) => {
    // Override unlock and polling endpoints
    await page.route('**/api/skill-tree/2/unlock', (route) => route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ jobId: 'test-job-uuid', status: 'ACCEPTED' }),
    }));

    let pollCount = 0;
    await page.route('**/api/async-jobs/test-job-uuid', (route) => {
      pollCount++;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          pollCount === 1
            ? { status: 'PROCESSING' }
            : { status: 'COMPLETED', resultPayload: '{}' }
        ),
      });
    });

    await page.goto('/student/roadmap');

    await expect(page.getByText('Chuyên ngành IT')).toBeVisible({ timeout: 15000 });
    await page.getByText('Chuyên ngành IT').click();
    await page.getByRole('button', { name: /Mở khóa bài chuyên ngành/i }).click();

    await expect(page.getByText(/AI đang tạo bài học/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Bài học đã được mở khóa/i)).toBeVisible({ timeout: 15000 });
  });
});
