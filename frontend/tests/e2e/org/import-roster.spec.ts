import { test, expect, type Page } from '@playwright/test'

/**
 * E2E (mock API): nhập danh sách học viên CSV ở /v2/org/students (PR-A5 / BF-07).
 * Khoá: nút mở modal, chọn file → xem trước, gắn lớp, POST multipart tới /org/students/import
 * kèm classId, và kết quả từng dòng hiển thị sau khi nhập.
 */

const MEMBERS = [
  { userId: 31, email: 'cu@x.com', displayName: 'Học viên Cũ', role: 'STUDENT', status: 'ACTIVE', joinedAt: '2026-08-01T00:00:00Z' },
]
const ANALYTICS = {
  studentCount: 1, teacherCount: 1, classCount: 2, tokensThisMonth: 0, monthlyTokenPool: 0,
  poolUsagePercent: 0, poolUnlimited: false, activeStudents7d: 1, cefrDistribution: [],
}
const CLASSES = {
  content: [
    { id: 7, name: 'B1 Tối', inviteCode: 'ABC12345', teacherId: 5, createdAt: '2026-06-01T00:00:00Z' },
    { id: 8, name: 'A2 Sáng', inviteCode: 'DEF67890', teacherId: 5, createdAt: '2026-06-15T00:00:00Z' },
  ],
  totalElements: 2, totalPages: 1, number: 0, size: 50, first: true, last: true,
}
const RESULT = { total: 2, created: 1, linked: 1, enrolled: 2, failed: 0, errors: [] }

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

type ApiCall = { method: string; url: string; body: string | null }

async function mockOrgSession(page: Page): Promise<ApiCall[]> {
  const calls: ApiCall[] = []
  await page.context().addCookies(
    [['refresh_token', '1'], ['auth_logged_in', '1'], ['auth_role', 'MANAGER'], ['NEXT_LOCALE', 'vi']]
      .map(([name, value]) => ({ name, value, domain: 'localhost', path: '/' })),
  )
  // Catch-all TRƯỚC, route cụ thể SAU — Playwright ưu tiên route đăng ký sau.
  await page.route('**/api/**', (route) => route.fulfill(json([])))
  await page.route(/.+\/api\/auth\/me$/, (route) =>
    route.fulfill(json({ userId: 9, displayName: 'QA Manager', role: 'MANAGER', email: 'owner@test.com', locale: 'vi' })),
  )
  await page.route('**/api/org/members**', (route) => route.fulfill(json(MEMBERS)))
  await page.route('**/api/org/analytics', (route) => route.fulfill(json(ANALYTICS)))
  await page.route('**/api/org/classes**', (route) => route.fulfill(json(CLASSES)))
  await page.route('**/api/org/students/import', (route) => {
    const req = route.request()
    calls.push({ method: req.method(), url: req.url(), body: req.postData() })
    route.fulfill(json(RESULT))
  })
  return calls
}

test.describe('/v2/org/students — nhập CSV', () => {
  test('mở modal → chọn file → xem trước → gắn lớp → POST multipart → kết quả', async ({ page }) => {
    const calls = await mockOrgSession(page)
    await page.goto('/v2/org/students')

    await page.getByTestId('roster-open').click()
    await expect(page.getByRole('dialog')).toContainText('Nhập danh sách học viên')

    await page.getByTestId('roster-file-input').setInputFiles({
      name: 'hoc-vien.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('﻿email,displayName,phone\r\nan@x.com,"Nguyễn, An",0912\r\nbinh@x.com,Bình,\r\n', 'utf-8'),
    })
    await expect(page.getByText('Xem trước 2 dòng')).toBeVisible()
    await expect(page.getByText('Nguyễn, An')).toBeVisible()

    await page.getByLabel('Gắn vào lớp (tuỳ chọn)').selectOption('7')
    await page.getByTestId('roster-submit').click()

    await expect(page.getByTestId('roster-result')).toBeVisible()
    await expect(page.getByTestId('roster-result')).toContainText('Không dòng nào lỗi.')
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].body ?? '').toContain('an@x.com')
    expect(calls[0].body ?? '').toContain('name="classId"')
    expect(calls[0].body ?? '').toContain('7')
  })

  test('file rỗng → nút nhập khoá và không gọi API', async ({ page }) => {
    const calls = await mockOrgSession(page)
    await page.goto('/v2/org/students')
    await page.getByTestId('roster-open').click()
    await page.getByTestId('roster-file-input').setInputFiles({ name: 'rong.csv', mimeType: 'text/csv', buffer: Buffer.from('email,displayName,phone\r\n') })
    await expect(page.getByText('File không có dòng dữ liệu nào.')).toBeVisible()
    await expect(page.getByTestId('roster-submit')).toBeDisabled()
    expect(calls).toHaveLength(0)
  })
})
