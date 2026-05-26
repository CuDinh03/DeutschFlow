import { test, expect } from '@playwright/test';
import { studentCookies, STUDENT_TOKEN } from '../helpers/tokens';

/**
 * E2E Tests: Authentication Flow
 * 
 * Strategy: We mock all authentication and redirection endpoints.
 * Next.js Edge middleware relies on cookies, so we inject or clear them appropriately.
 */
test.describe('Authentication Flow', () => {
  test('Login - Should redirect to student dashboard on successful STUDENT login', async ({ page, context }) => {
    // 1. Mock the login endpoint to return a success token and STUDENT role
    await page.route('**/api/auth/login', async (route) => {
      // Create a valid JWT string for the mock
      const mockJwt = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiU1RVREVOVCIsInN1YiI6IjEifQ.FAKESIGNATURE';
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
    await page.goto('/login');

    // 4. Fill in credentials and submit
    await page.fill('input[type="email"]', 'test@student.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // 5. Verify that it navigates to /dashboard
    await expect(page).toHaveURL(/\/dashboard/);
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
    await page.goto('/dashboard');

    // 3. Find and click the logout button. In StudentShell, it's usually inside a user menu.
    // The exact selector depends on the UI. We'll look for "Đăng xuất" text.
    // Let's assume there's a user menu we might need to click first.
    const userMenuButton = page.locator('button').filter({ hasText: /^TS$/ }); // initials for Test Student
    if (await userMenuButton.isVisible()) {
      await userMenuButton.click();
    }
    
    // Look for the Logout text
    await page.getByText(/Đăng xuất/i).click();

    // 4. Verify it redirects to /login
    await expect(page).toHaveURL(/\/login/);

    // 5. Verify local storage is cleared
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(token).toBeNull();
  });
});
