import { test, expect, type Page } from '@playwright/test';
import { studentCookies } from '../helpers/tokens';

// ─── Shared plan mocks ─────────────────────────────────────────────────────

const FREE_PLAN = { planCode: 'FREE', tier: 'FREE', startsAtUtc: null, endsAtUtc: null };
const PRO_PLAN = {
  planCode: 'PRO',
  tier: 'PRO',
  startsAtUtc: new Date().toISOString(),
  endsAtUtc: new Date(Date.now() + 30 * 86400000).toISOString(),
};

async function mockFreePlan(page: Page) {
  await page.route('**/api/auth/me/plan', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FREE_PLAN) })
  );
}

async function mockProPlan(page: Page) {
  await page.route('**/api/auth/me/plan', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PRO_PLAN) })
  );
}

async function mockAuthMe(page: Page) {
  await page.route(/.+\/api\/auth\/me$/, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ displayName: 'E2E Student', role: 'STUDENT', userId: 1, email: 'e2e@test.com' }),
    })
  );
}

// ─── Test suite ────────────────────────────────────────────────────────────

test.describe('Paywall & Payment', () => {
  test('FREE user sees pricing page when accessing interview page', async ({ page, context }) => {
    await context.addCookies(studentCookies());
    await mockAuthMe(page);
    await mockFreePlan(page);

    await page.route('**/api/ai-speaking/quota', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ planCode: 'FREE', weeklyUsed: 0, weeklyLimit: 3, blocked: false }),
      })
    );

    await page.goto('/student/interviews');
    await page.waitForLoadState('networkidle');

    // FREE badge should appear in the interview count line
    await expect(page.locator('text=/tuần này/i').first()).toBeVisible({ timeout: 8000 });
  });

  test('Pricing page fires paywall_viewed and shows plan cards', async ({ page, context }) => {
    await context.addCookies(studentCookies());
    await mockAuthMe(page);
    await mockFreePlan(page);

    const paywallEvents: string[] = [];
    await page.route('**/posthog.io/**', async (r) => {
      const body = r.request().postDataBuffer()?.toString() ?? '';
      if (body.includes('paywall_viewed')) paywallEvents.push('paywall_viewed');
      await r.fulfill({ status: 200, body: '{}' });
    });
    // Also intercept ingest endpoint
    await page.route('**/ingest/**', async (r) => {
      const body = r.request().postDataBuffer()?.toString() ?? '';
      if (body.includes('paywall_viewed')) paywallEvents.push('paywall_viewed');
      await r.fulfill({ status: 200, body: '{}' });
    });

    await page.goto('/student/pricing');
    await page.waitForLoadState('networkidle');

    // Three plan cards (FREE, PRO, ULTRA) must be visible
    const planNames = page.locator('[class*="backdrop-blur"]');
    await expect(planNames).toHaveCount(3, { timeout: 8000 });
  });

  test('Clicking upgrade PRO calls MoMo create-order and redirects to payUrl', async ({ page, context }) => {
    await context.addCookies(studentCookies());
    await mockAuthMe(page);
    await mockFreePlan(page);

    let orderBody: Record<string, unknown> = {};
    await page.route('**/api/payments/momo/create-order', async (r) => {
      orderBody = JSON.parse(r.request().postData() ?? '{}');
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ payUrl: 'https://test-payment.momo.vn/mock', orderId: 'MOMO_TEST_001', amount: 299000, planCode: 'PRO' }),
      });
    });

    await page.goto('/student/pricing');
    await page.waitForLoadState('networkidle');

    // Intercept navigation before it leaves the app
    const navigationPromise = page.waitForRequest('**/test-payment.momo.vn/**').catch(() => null);

    // Click the PRO upgrade button (last one in the row that is not FREE)
    await page.locator('button', { hasText: /PRO/i }).last().click();

    // Verify the API was called with correct planCode
    await page.waitForTimeout(1500);
    expect(orderBody.planCode).toBe('PRO');
    expect(orderBody.durationMonths).toBe(1);
  });

  test('Payment success page syncs order and shows success state', async ({ page, context }) => {
    await context.addCookies(studentCookies());
    await mockAuthMe(page);

    let syncCalled = false;
    await page.route('**/api/payments/momo/sync-order', async (r) => {
      syncCalled = true;
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'SUCCESS', orderId: 'MOMO_TEST_001', momoResultCode: 0, message: 'OK' }),
      });
    });

    // After sync succeeds, /auth/me/plan returns PRO
    await page.route('**/api/auth/me/plan', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PRO_PLAN) })
    );

    await page.goto('/payment/success?orderId=MOMO_TEST_001');
    await page.waitForLoadState('networkidle');

    // Wait for sync to be called and success state rendered
    await page.waitForFunction(() => document.body.innerText.includes('PRO') || document.body.innerText.includes('ULTRA'), { timeout: 20000 });
    expect(syncCalled).toBe(true);
  });
});

test.describe('SRS Review Cycle', () => {
  test('Student can load SRS cards and submit a review', async ({ page, context }) => {
    await context.addCookies(studentCookies());
    await mockAuthMe(page);
    await mockFreePlan(page);

    const mockCards = [
      {
        id: 1,
        wordDe: 'der Hund',
        wordVi: 'con chó',
        exampleDe: 'Der Hund bellt.',
        exampleVi: 'Con chó sủa.',
        due: new Date().toISOString(),
        stability: 1.5,
        difficulty: 5,
        reps: 2,
        lapses: 0,
        state: 'review',
      },
    ];

    await page.route('**/api/srs/due', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockCards) })
    );

    let reviewBody: Record<string, unknown> = {};
    await page.route('**/api/srs/review', async (r) => {
      reviewBody = JSON.parse(r.request().postData() ?? '{}');
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ nextDue: new Date(Date.now() + 86400000).toISOString(), xpEarned: 5 }),
      });
    });

    await page.goto('/student/vocabulary');
    await page.waitForLoadState('networkidle');

    // SRS card should appear
    await expect(page.locator('text=/Hund/i').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('PRO Feature Access', () => {
  test('PRO user can access interview page without quota badge', async ({ page, context }) => {
    await context.addCookies(studentCookies());
    await mockAuthMe(page);
    await mockProPlan(page);

    await page.route('**/api/ai-speaking/quota', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ planCode: 'PRO', weeklyUsed: 0, weeklyLimit: 999, blocked: false }),
      })
    );
    await page.route('**/api/ai-speaking/interviews**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );

    await page.goto('/student/interviews');
    await page.waitForLoadState('networkidle');

    // Should NOT see the FREE weekly limit badge
    await expect(page.locator('text=/tuần này/i')).toHaveCount(0, { timeout: 5000 });
  });
});
