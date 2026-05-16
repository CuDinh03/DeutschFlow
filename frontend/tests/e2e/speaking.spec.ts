import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Speaking Session Flow
 * 
 * Strategy: Mock the session creation, persona selection, and SSE stream.
 */
test.describe('Speaking Session Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Next.js required cookies for auth
    await page.context().addCookies([
      { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
      { name: 'auth_access', value: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiU1RVREVOVCIsInN1YiI6IjEiLCJleHAiOjE3NzkwMjgyODF9.tketgaKuI7Mbm_Tbu4bYBzxUTUBtcEt25f5gaD53dJY', domain: 'localhost', path: '/' },
      { name: 'auth_role', value: 'STUDENT', domain: 'localhost', path: '/' },
      { name: 'auth_logged_in', value: '1', domain: 'localhost', path: '/' }
    ]);

    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiU1RVREVOVCIsInN1YiI6IjEiLCJleHAiOjE3NzkwMjgyODF9.tketgaKuI7Mbm_Tbu4bYBzxUTUBtcEt25f5gaD53dJY');
    });

    // Catch-all mock
    await page.route('**/api/**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    }));

    // Mock User Profile
    await page.route(/.+\/api\/auth\/me$/, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ displayName: 'Test Student', role: 'STUDENT', userId: 1, learningTargetLevel: 'A1' })
    }));

    // Mock Persona List
    await page.route('**/api/speaking-sessions/personas', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: '1', systemName: 'Klaus', displayName: 'Thầy Klaus', avatarUrl: '👨‍🏫', description: 'Giáo viên nghiêm khắc', defaultLevel: 'A1' },
        { id: '2', systemName: 'Anna', displayName: 'Cô Anna', avatarUrl: '👩‍🏫', description: 'Giáo viên thân thiện', defaultLevel: 'A2' }
      ])
    }));
  });

  test('should create a session and load the chat interface', async ({ page }) => {
    // Mock Session Creation
    await page.route('**/api/speaking-sessions', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-session-id',
            status: 'ACTIVE',
            persona: { displayName: 'Thầy Klaus', avatarUrl: '👨‍🏫' },
            topic: 'Giới thiệu bản thân'
          })
        });
      }
      return route.continue();
    });

    // Mock Session Fetch (when the page loads after creation)
    await page.route('**/api/speaking-sessions/test-session-id', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'test-session-id',
        status: 'ACTIVE',
        persona: { displayName: 'Thầy Klaus', avatarUrl: '👨‍🏫' },
        topic: 'Giới thiệu bản thân',
        turns: []
      })
    }));

    // Start at the speaking entry page
    await page.goto('/speaking');

    // We should see Lukas
    await expect(page.getByText('Lukas', { exact: true }).first()).toBeVisible();
    await page.getByText('Lukas', { exact: true }).first().click();
    
    // Start button
    const startButton = page.locator('button').filter({ hasText: /Bắt đầu với Lukas/i });
    await startButton.click();

    // It should navigate to /speaking/chat
    await expect(page).toHaveURL(/\/speaking\/chat/);
    
    // We should see the chat interface with Lukas
    await expect(page.getByText('Lukas', { exact: true }).first()).toBeVisible();
  });
});
