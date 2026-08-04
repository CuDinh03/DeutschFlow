import { test, expect } from '@playwright/test';
import { teacherCookies, TEACHER_TOKEN } from '../helpers/tokens';

test.describe('Teacher LMS Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
      ...teacherCookies(),
    ]);

    // Port sang /v2 (04/08): `/teacher` và `/teacher/dashboard` giờ đã bị next.config đá sang
    // `/v2/teacher`, nên spec phải vào thẳng địa chỉ mới thay vì đi qua một chặng redirect.
    await page.goto('/v2/teacher');
    await page.evaluate((token) => {
      localStorage.setItem('accessToken', token);
    }, TEACHER_TOKEN);
    
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

    // Verify we are on the teacher home. Trang chủ GV của v2 là `/v2/teacher` — KHÔNG còn tầng
    // `/dashboard` như v1, nên assertion cũ `/\/teacher\/dashboard/` không bao giờ khớp nữa.
    await expect(page).toHaveURL(/\/v2\/teacher/);

    // Fill in the class name in the inline form. `getByPlaceholder` khớp theo chuỗi con nên vẫn
    // bắt được placeholder dài hơn của v2 ("Nhập tên lớp học (VD: A1.1 Lớp tối 2-4-6)").
    const nameInput = page.getByPlaceholder('Nhập tên lớp học');
    await nameInput.fill('A1 German Class');

    // Submit the form. Nhãn nút ở v2 là "Tạo lớp" (v1: "Tạo lớp học") — `hasText` khớp chuỗi con
    // nên phải dùng nhãn NGẮN hơn, dùng nhãn v1 sẽ không khớp.
    const submitButton = page.locator('button').filter({ hasText: 'Tạo lớp' });
    await submitButton.click();

    // Wait for the mock POST to resolve, we should see the class name and the invite code
    await expect(page.getByText('A1 German Class').first()).toBeVisible();
    await expect(page.getByText('TEST-1234').first()).toBeVisible();
  });
});
