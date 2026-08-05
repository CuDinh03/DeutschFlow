import { test, expect, type Page } from '@playwright/test'

/**
 * E2E: nút "Phân công" trang Giáo viên của tổ chức (/v2/org/teachers).
 *
 * PR #299 biến nút stub thành modal giao lớp; PR C (trợ giảng) nâng modal lên HAI hành động:
 * "Giao phụ trách" (PATCH /org/classes/{id}/teacher — GV hiện tại hạ vai trợ giảng) và
 * "Thêm trợ giảng" (POST /org/classes/{id}/teachers). Bộ test khoá: trạng thái từng lớp
 * (phụ trách / trợ giảng / GV khác / chưa gán), endpoint + payload đúng cho cả hai hành động,
 * và ô tìm lớp.
 */

const TEACHERS = [
  {
    userId: 2,
    email: 'leeduytung@deutschflow.com',
    displayName: 'Lê Duy Tùng',
    role: 'TEACHER',
    status: 'ACTIVE',
    joinedAt: '2026-08-05T00:00:00Z',
  },
]

const CLASSES = {
  content: [
    { id: 7, name: 'A1.1 Buổi tối', inviteCode: 'ABC12345', teacherId: 5, createdAt: '2026-06-01T00:00:00Z' },
    { id: 8, name: 'B1 Cuối tuần', inviteCode: 'DEF67890', teacherId: 2, createdAt: '2026-06-15T00:00:00Z' },
    { id: 9, name: 'A2 Sáng T3-T5', inviteCode: 'GHI13579', teacherId: 5, createdAt: '2026-07-01T00:00:00Z' },
    { id: 10, name: 'A1 Vỡ lòng', inviteCode: 'JKL24680', teacherId: null, createdAt: '2026-07-10T00:00:00Z' },
  ],
  totalElements: 4,
  totalPages: 1,
  number: 0,
  size: 100,
}

/** Lớp GV 2 THAM GIA (class_teachers): 8 = phụ trách, 9 = trợ giảng (teacherId lớp 9 là GV khác). */
const TEACHER_2_CLASSES = [
  { id: 8, name: 'B1 Cuối tuần', inviteCode: 'DEF67890', studentCount: 5, quizCount: 2, createdAt: '2026-06-15T00:00:00Z' },
  { id: 9, name: 'A2 Sáng T3-T5', inviteCode: 'GHI13579', studentCount: 3, quizCount: 1, createdAt: '2026-07-01T00:00:00Z' },
]

const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

type ApiCall = { method: string; url: string; body: unknown }

async function mockOrgSession(page: Page): Promise<ApiCall[]> {
  const calls: ApiCall[] = []

  await page.context().addCookies(
    [
      ['refresh_token', '1'],
      ['auth_logged_in', '1'],
      ['auth_role', 'MANAGER'],
      ['NEXT_LOCALE', 'vi'],
    ].map(([name, value]) => ({ name, value, domain: 'localhost', path: '/' })),
  )

  // Catch-all TRƯỚC, route cụ thể SAU — Playwright ưu tiên route đăng ký sau.
  await page.route('**/api/**', (route) => route.fulfill(json([])))
  await page.route(/.+\/api\/auth\/me$/, (route) =>
    route.fulfill(json({ userId: 9, displayName: 'QA Manager', role: 'MANAGER', email: 'owner@test.com', locale: 'vi' })),
  )
  await page.route('**/api/org/members**', (route) => route.fulfill(json(TEACHERS)))
  await page.route('**/api/org/invitations', (route) => route.fulfill(json([])))
  await page.route('**/api/org/classes**', (route) => route.fulfill(json(CLASSES)))
  await page.route('**/api/org/teachers/2/classes', (route) => route.fulfill(json(TEACHER_2_CLASSES)))
  await page.route('**/api/org/classes/7/teacher', (route) => {
    calls.push({ method: route.request().method(), url: route.request().url(), body: route.request().postDataJSON() })
    return route.fulfill(
      json({ id: 7, name: 'A1.1 Buổi tối', inviteCode: 'ABC12345', teacherId: 2, createdAt: '2026-06-01T00:00:00Z' }),
    )
  })
  await page.route('**/api/org/classes/10/teachers', (route) => {
    calls.push({ method: route.request().method(), url: route.request().url(), body: route.request().postDataJSON() })
    return route.fulfill(json({ teacherId: 2, email: 'leeduytung@deutschflow.com', displayName: 'Lê Duy Tùng', role: 'ASSISTANT' }))
  })
  return calls
}

async function openModal(page: Page) {
  await page.goto('/v2/org/teachers')
  await page.getByRole('button', { name: 'Phân công' }).click()
  return page.getByRole('dialog')
}

test.describe('Phân công giáo viên vào lớp — /v2/org/teachers', () => {
  test('modal hiện đủ 4 trạng thái lớp + đúng bộ nút cho từng trạng thái', async ({ page }) => {
    await mockOrgSession(page)
    const modal = await openModal(page)

    await expect(modal.getByText('Phân công lớp')).toBeVisible()

    // Lớp GV khác phụ trách → đủ 2 hành động.
    const taken = modal.locator('li').filter({ hasText: 'A1.1 Buổi tối' })
    await expect(taken.getByText('Đang có giáo viên khác phụ trách')).toBeVisible()
    await expect(taken.getByRole('button', { name: 'Giao phụ trách' })).toBeVisible()
    await expect(taken.getByRole('button', { name: 'Thêm trợ giảng' })).toBeVisible()

    // Lớp đang phụ trách → chỉ badge, không nút.
    const primary = modal.locator('li').filter({ hasText: 'B1 Cuối tuần' })
    await expect(primary.getByText('Đang phụ trách', { exact: true })).toBeVisible()
    await expect(primary.getByRole('button')).toHaveCount(0)

    // Lớp đang trợ giảng → badge Trợ giảng + chỉ còn "Giao phụ trách" (thăng vai).
    const assistant = modal.locator('li').filter({ hasText: 'A2 Sáng T3-T5' })
    await expect(assistant.getByText('Đang là trợ giảng của lớp này')).toBeVisible()
    await expect(assistant.getByText('Trợ giảng', { exact: true })).toBeVisible()
    await expect(assistant.getByRole('button', { name: 'Giao phụ trách' })).toBeVisible()
    await expect(assistant.getByRole('button', { name: 'Thêm trợ giảng' })).toHaveCount(0)

    // Lớp chưa gán → đủ 2 hành động.
    const free = modal.locator('li').filter({ hasText: 'A1 Vỡ lòng' })
    await expect(free.getByText('Chưa có giáo viên phụ trách')).toBeVisible()
    await expect(free.getByRole('button', { name: 'Giao phụ trách' })).toBeVisible()
  })

  test('Giao phụ trách → PATCH /teacher đúng payload, hàng chuyển "đang phụ trách"', async ({ page }) => {
    const calls = await mockOrgSession(page)
    const modal = await openModal(page)

    const row = modal.locator('li').filter({ hasText: 'A1.1 Buổi tối' })
    await row.getByRole('button', { name: 'Giao phụ trách' }).click()

    await expect(page.getByText('Đã giao lớp A1.1 Buổi tối.')).toBeVisible()
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('PATCH')
    expect(calls[0].url).toContain('/api/org/classes/7/teacher')
    expect(calls[0].body).toEqual({ teacherId: 2 })

    await expect(row.getByText('Đang phụ trách', { exact: true })).toBeVisible()
  })

  test('Thêm trợ giảng → POST /teachers đúng payload, hàng chuyển sang trạng thái trợ giảng', async ({ page }) => {
    const calls = await mockOrgSession(page)
    const modal = await openModal(page)

    const row = modal.locator('li').filter({ hasText: 'A1 Vỡ lòng' })
    await row.getByRole('button', { name: 'Thêm trợ giảng' }).click()

    await expect(page.getByText('Đã thêm làm trợ giảng lớp A1 Vỡ lòng.')).toBeVisible()
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toContain('/api/org/classes/10/teachers')
    expect(calls[0].body).toEqual({ teacherId: 2 })

    // Hàng đổi trạng thái: còn đúng 1 nút "Giao phụ trách" (thăng vai), badge Trợ giảng hiện ra.
    await expect(row.getByText('Đang là trợ giảng của lớp này')).toBeVisible()
    await expect(row.getByRole('button', { name: 'Thêm trợ giảng' })).toHaveCount(0)
  })

  test('lọc lớp theo tên trong modal', async ({ page }) => {
    await mockOrgSession(page)
    const modal = await openModal(page)
    await expect(modal.getByText('A1.1 Buổi tối')).toBeVisible()

    await modal.getByPlaceholder('Tìm lớp…').fill('B1')
    await expect(modal.getByText('B1 Cuối tuần')).toBeVisible()
    await expect(modal.getByText('A1.1 Buổi tối')).toBeHidden()

    await modal.getByPlaceholder('Tìm lớp…').fill('không-tồn-tại')
    await expect(modal.getByText('Không có lớp nào khớp từ khóa.')).toBeVisible()
  })
})
