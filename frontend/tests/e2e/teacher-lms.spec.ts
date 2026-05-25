import { test, expect } from '@playwright/test';

test.describe('Teacher LMS Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Next.js required cookies for auth as TEACHER
    await page.context().addCookies([
      { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
      { name: 'auth_access', value: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiVEVBQ0hFUiIsInN1YiI6IjIiLCJpYXQiOjE3Nzg5NDMxNjUsImV4cCI6MTc3OTAyOTU2NX0.F8Bt8I_VNf7HNOMDbpGwNaUyyXHOMY1qoPcUF19MgdM', domain: 'localhost', path: '/' },
      { name: 'auth_role', value: 'TEACHER', domain: 'localhost', path: '/' },
      { name: 'auth_logged_in', value: '1', domain: 'localhost', path: '/' }
    ]);

    await page.goto('/teacher');
    await page.evaluate(() => {
      localStorage.setItem('accessToken', 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiVEVBQ0hFUiIsInN1YiI6IjIiLCJpYXQiOjE3Nzg5NDMxNjUsImV4cCI6MTc3OTAyOTU2NX0.F8Bt8I_VNf7HNOMDbpGwNaUyyXHOMY1qoPcUF19MgdM');
    });
    
    // Catch-all mock MUST be first
    await page.route('**/api/**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    }));

    // Mock Teacher Profile
    await page.route(/.+\/api\/auth\/me$/, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ displayName: 'Test Teacher', role: 'TEACHER', userId: 2 })
    }));

    // Mock Class List (Stateful)
    let mockClasses: any[] = [];
    await page.route('**/api/v2/teacher/classes', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockClasses)
        });
      }
      if (route.request().method() === 'POST') {
        const postData = JSON.parse(route.request().postData() || '{}');
        const newClass = {
          id: mockClasses.length + 1,
          name: postData.name || 'A1 German Class',
          inviteCode: 'TEST-1234',
          teacherId: 2,
          studentCount: 0,
          quizCount: 0,
          isActive: true,
          createdAt: new Date().toISOString()
        };
        mockClasses.push(newClass);
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(newClass)
        });
      }
      return route.continue();
    });
  });

  test('should create a new class and display the invite code', async ({ page }) => {
    // Reload to apply localstorage and load the page as teacher
    await page.reload();

    // Verify we are on the teacher dashboard
    await expect(page).toHaveURL(/\/teacher\/dashboard/);

    // Fill in the class name in the inline form
    const nameInput = page.getByPlaceholder('Nhập tên lớp học');
    await nameInput.fill('A1 German Class');

    // Submit the form
    const submitButton = page.locator('button').filter({ hasText: 'Tạo lớp học' });
    await submitButton.click();

    // Wait for the mock POST to resolve, we should see the class name and the invite code
    await expect(page.getByText('A1 German Class').first()).toBeVisible();
    await expect(page.getByText('TEST-1234').first()).toBeVisible();
  });
});
