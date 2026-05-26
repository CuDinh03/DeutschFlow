import { test, expect } from '@playwright/test';
import { studentCookies, STUDENT_TOKEN } from '../../helpers/tokens';

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
    await page.context().addCookies([
      { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
      ...studentCookies(),
    ]);

    await page.addInitScript((token) => {
      localStorage.setItem('accessToken', token);
      localStorage.setItem('df_roadmap_view', 'list');
    }, STUDENT_TOKEN);

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

  test('should display roadmap creation status and learned node progress', async ({ page }) => {
    await page.goto('/student/roadmap');

    await expect(page.getByText('Cơ bản 1')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Chuyên ngành IT')).toBeVisible();
    await expect(page.getByText('A1')).toBeVisible();
    await expect(page.getByText('50%')).toBeVisible();
    await expect(page.getByText('1 / 2')).toBeVisible();
  });

  test('should keep roadmap responsive when the unlock job is slow before completing', async ({ page }) => {
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
          pollCount <= 2
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

  test('should show empty roadmap fallback when backend returns no nodes', async ({ page }) => {
    await page.route('**/api/roadmap/me', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }));
    await page.route('**/api/roadmap/me/meta', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        roadmapVersion: 'A0_A1_Foundation_First',
        roadmapType: 'FOUNDATION_FIRST',
        entryNodeCode: 'A0-001',
        currentLevel: 'A0',
        targetLevel: 'A1',
        currentNodeCode: 'A0-001',
        completedNodes: 0,
        totalNodes: 0,
        progressPercent: 0,
        progressModel: 'ROADMAP_STATES_V1',
      }),
    }));

    await page.goto('/student/roadmap');

    await expect(page.getByText('Lộ trình trống')).toBeVisible();
    await expect(page.getByText(/Chưa có node để học/i)).toBeVisible();
  });
});
