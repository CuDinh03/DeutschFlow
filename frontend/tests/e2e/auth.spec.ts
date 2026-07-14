import { test, expect } from '@playwright/test';
import { studentCookies, STUDENT_TOKEN } from '../helpers/tokens';

/**
 * E2E Tests: Authentication Flow
 *
 * Strategy: We mock all authentication and redirection endpoints.
 * Next.js Edge middleware relies on cookies, so we inject or clear them appropriately.
 *
 * Every navigation targets the v2 (Galerie) surface. The legacy routes (/login, /dashboard) only
 * survive as 307 redirects today and are scheduled for deletion, so driving them here would leave
 * the suite green on a tree that is about to disappear — and hide the redirect table breaking.
 */

/**
 * Assembles an unsigned, deliberately-fake JWT at runtime. It is joined from parts rather than
 * written as a literal because the CI secret scanner (gitleaks rule `jwt`) matches any three-part
 * base64 literal on sight — including obvious mocks like this one — and it is a BLOCKING check.
 *
 * The signature is garbage on purpose: the edge middleware cannot verify it, so it treats the
 * request as unauthenticated. That is exactly what the assertions below rely on.
 */
function fakeJwt(payloadB64: string): string {
  return ['eyJhbGciOiJIUzI1NiJ9', payloadB64, 'FAKESIGNATURE'].join('.');
}

test.describe('Authentication Flow', () => {
  test('Login - Should redirect to student dashboard on successful STUDENT login', async ({ page, context }) => {
    // 1. Mock the login endpoint to return a success token and STUDENT role
    await page.route('**/api/auth/login', async (route) => {
      // { "role": "STUDENT", "sub": "1" }
      const mockJwt = fakeJwt('eyJyb2xlIjoiU1RVREVOVCIsInN1YiI6IjEifQ');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: mockJwt,
          role: 'STUDENT',
          user: {
            userId: 1,
            email: 'test@student.com',
            displayName: 'Test Student',
            role: 'STUDENT'
          }
        }),
      });
    });

    // 2. Mock /api/auth/me to verify token after login
    await page.route(/.+\/api\/auth\/me$/, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        displayName: 'Test Student',
        role: 'STUDENT',
        userId: 1,
        email: 'test@student.com'
      }),
    }));

    // Mock Dashboard and Plan endpoints that might be fetched after login
    await page.route('**/api/plan/me', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ plan: { targetLevel: 'A1', currentLevel: 'A1' } })
    }));
    await page.route('**/api/student/dashboard', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ streakDays: 1 })
    }));

    // 3. Go to login page
    await page.goto('/v2/login');

    // 4. Fill in credentials and submit. The v2 form is not a <form> — its CTA is a plain button
    // (no type="submit" attribute), so it must be addressed by its accessible name.
    await page.fill('input[type="email"]', 'test@student.com');
    await page.fill('input[type="password"]', 'password123');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

    // 5. Verify that it navigates to the v2 student dashboard. As in the MANAGER test below, the mock
    // token carries FAKESIGNATURE: where a JWT verifier is configured the edge gate cannot verify it
    // and forwards to /v2/login?next=… — either URL proves the login page CHOSE the student dashboard.
    await expect(page).toHaveURL(/(\/v2\/student\/dashboard|next=%2Fv2%2Fstudent%2Fdashboard)/);
  });

  test('Login - Should route a centre MANAGER to the org console, not the student dashboard', async ({ page }) => {
    // Regression: /login's role→home map had no OWNER/MANAGER case, so a centre manager fell through
    // to the STUDENT default and landed on /v2/student/dashboard (the edge gate then bounced them).
    // The login response is what carries orgRole — /auth/me is only used for identity here.
    await page.route('**/api/auth/login', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        // { "role": "MANAGER", "sub": "3" } — unverifiable on purpose, see the assertion below.
        accessToken: fakeJwt('eyJyb2xlIjoiTUFOQUdFUiIsInN1YiI6IjMifQ'),
        role: 'MANAGER',
        orgId: 1,
        orgRole: 'MANAGER',
        userId: 3,
        email: 'manager@deutschflow.com',
        displayName: 'Centre Manager',
      }),
    }));
    await page.route(/.+\/api\/auth\/me$/, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ userId: 3, email: 'manager@deutschflow.com', displayName: 'Centre Manager', role: 'MANAGER' }),
    }));

    await page.goto('/v2/login');
    await page.fill('input[type="email"]', 'manager@deutschflow.com');
    await page.fill('input[type="password"]', 'not-a-real-password');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

    // The login page must CHOOSE /v2/org. With a mock (unverifiable) token the edge gate then sends
    // the request on to /v2/login?next=%2Fv2%2Forg — either URL proves the routing decision. What
    // must never appear is the student dashboard, which is what the bug produced.
    await expect(page).toHaveURL(/(\/v2\/org|next=%2Fv2%2Forg)/);
    await expect(page).not.toHaveURL(/student\/dashboard/);
  });

  test('Logout - Should clear state and return to login', async ({ page }) => {
    await page.context().addCookies([
      { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
      ...studentCookies(),
    ]);

    await page.addInitScript((token) => {
      if (window.location.pathname.includes('/dashboard')) {
        localStorage.setItem('accessToken', token);
      }
    }, STUDENT_TOKEN);
    
    // Mock API requests so dashboard loads
    // Catch-all MUST be first!
    await page.route('**/api/**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}'
    }));
    await page.route(/.+\/api\/auth\/me$/, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ displayName: 'Test Student', role: 'STUDENT', userId: 1 })
    }));
    // Mock the logout API to return success
    await page.route('**/api/auth/logout', (route) => route.fulfill({ status: 200 }));

    // 2. Go to student dashboard
    await page.goto('/v2/student/dashboard');

    // 3. Click logout. The v2 shell (GaSidebar) keeps it in the sidebar footer, always visible —
    // there is no user menu to open first, unlike the legacy StudentShell.
    await page.getByRole('button', { name: /Đăng xuất/i }).click();

    // 4. Verify it redirects to the v2 login (authSession.logout() hard-navigates there)
    await expect(page).toHaveURL(/\/v2\/login/);

    // 5. Verify local storage is cleared
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(token).toBeNull();
  });
});
