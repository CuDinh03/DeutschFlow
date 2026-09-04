import { test, expect, type Page } from '@playwright/test'

/**
 * E2E — RoleAreaGuard (cổng vai trò PHÍA CLIENT của bốn khu vực /v2).
 *
 * Tái hiện đúng lỗ hổng prod 2026-08-25: Amplify không có JWT verifier nên middleware degrade
 * thành "có cookie là cho qua" — học viên mở được nguyên trang /v2/admin. Các token ở đây CỐ TÌNH
 * mang chữ ký rác: middleware (dù dev server có JWT_SECRET hay không) không verify được, thấy còn
 * refresh cookie thì pass-through — tức là mọi cú redirect quan sát được trong spec này chỉ có thể
 * đến từ RoleAreaGuard, không phải từ middleware. Đừng thay bằng token ký thật của helpers/tokens:
 * khi secret khớp, middleware sẽ đá trước và spec này không còn kiểm chứng guard nữa.
 *
 * Backend được mock toàn bộ (pattern của v2-smoke.spec.ts) để interceptor 401-refresh không dọn
 * cookie/đá về login giữa chừng làm nhiễu kết quả.
 */

function b64url(value: object): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

/** JWT đúng cấu trúc nhưng chữ ký rác — middleware verify fail, guard client vẫn đọc được claim. */
function unverifiableToken(role: string): string {
  return [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ role, sub: '9', exp: Math.floor(Date.now() / 1000) + 3600 }),
    'not-a-real-signature',
  ].join('.')
}

function mockSessionCookies(role: string, domain = 'localhost') {
  return [
    { name: 'NEXT_LOCALE', value: 'vi', domain, path: '/' },
    { name: 'auth_access', value: unverifiableToken(role), domain, path: '/' },
    { name: 'auth_role', value: role, domain, path: '/' },
    { name: 'auth_logged_in', value: '1', domain, path: '/' },
    // Middleware pass-through cần refresh cookie (HttpOnly thật, nhưng test set thường vẫn được gửi).
    { name: 'refresh_token', value: 'e2e-dummy-refresh', domain, path: '/' },
  ]
}

async function mockApi(page: Page, role: string) {
  // Playwright khớp route theo thứ tự NGƯỢC đăng ký → catch-all đăng ký TRƯỚC, route cụ thể sau.
  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
  // Hai danh sách trang admin/users cần dạng mảng để không vỡ .map/.filter.
  await page.route(/.+\/api\/admin\/(users|plans)\/?$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route(/.+\/api\/auth\/me$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 9, email: 'qa@local.test', displayName: 'QA User', role, locale: 'vi' }),
    }),
  )
}

test.describe('RoleAreaGuard — cổng vai trò client cho /v2', () => {
  test('học viên mở /v2/admin bị đá về dashboard học viên', async ({ page }) => {
    await page.context().addCookies(mockSessionCookies('STUDENT'))
    await mockApi(page, 'STUDENT')

    await page.goto('/v2/admin/users/')
    await page.waitForURL('**/v2/student/dashboard/**', { timeout: 15000 })
  })

  test('học viên mở /v2/teacher bị đá về dashboard học viên', async ({ page }) => {
    await page.context().addCookies(mockSessionCookies('STUDENT'))
    await mockApi(page, 'STUDENT')

    await page.goto('/v2/teacher/')
    await page.waitForURL('**/v2/student/dashboard/**', { timeout: 15000 })
  })

  test('admin vẫn vào được /v2/admin/users bình thường', async ({ page }) => {
    await page.context().addCookies(mockSessionCookies('ADMIN'))
    await mockApi(page, 'ADMIN')

    await page.goto('/v2/admin/users/')
    await expect(page.locator('h1')).toContainText('Quản lý người dùng')
    await expect(page).toHaveURL(/\/v2\/admin\/users\/?$/)
  })

  test('phiên chỉ còn refresh cookie (vai trò CHƯA BIẾT) không bị đá oan', async ({ page }) => {
    // Người dùng quay lại sau khi đóng trình duyệt: mất cookie phiên, chỉ còn refresh HttpOnly.
    // Guard phải để yên (render + chờ token khôi phục), không được đá một admin thật về trang học viên.
    await page.context().addCookies([
      { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
      { name: 'refresh_token', value: 'e2e-dummy-refresh', domain: 'localhost', path: '/' },
    ])
    await mockApi(page, 'ADMIN')

    await page.goto('/v2/admin/users/')
    await expect(page.locator('h1')).toContainText('Quản lý người dùng')
    // Kiểm "KHÔNG redirect" buộc phải chờ qua ít nhất vài nhịp poll của guard (500ms/nhịp) —
    // đây là absence-check, không có sự kiện xác định để bám nên chấp nhận một cú chờ ngắn.
    await page.waitForTimeout(1500)
    await expect(page).toHaveURL(/\/v2\/admin\/users\/?$/)
  })
})
