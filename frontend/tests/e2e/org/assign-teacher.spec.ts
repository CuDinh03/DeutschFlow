import { test, expect, type Page } from '@playwright/test'

/**
 * E2E: nút "Phân công" trang Giáo viên của tổ chức (/v2/org/teachers).
 *
 * Trước đây nút này là stub `toast('sắp ra mắt')` — org-admin tạo giáo viên mới xong KHÔNG có
 * cách nào giao lớp đã tồn tại cho họ (backend chỉ gán giáo viên lúc TẠO lớp). Bộ test này khoá
 * lại luồng mới: mở modal, thấy trạng thái từng lớp, gán lớp → PATCH /org/classes/{id}/teacher
 * và UI phản ánh giáo viên mới đang phụ trách.
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
    { id: 9, name: 'A2 Sáng T3-T5', inviteCode: 'GHI13579', teacherId: null, createdAt: '2026-07-01T00:00:00Z' },
  ],
  totalElements: 3,
  totalPages: 1,
  number: 0,
  size: 100,
}

const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

/** Ghi lại các lệnh PATCH đã bắn để assert payload — Playwright không có sẵn request spy. */
type PatchCall = { url: string; body: unknown }

async function mockOrgSession(page: Page): Promise<PatchCall[]> {
  const patches: PatchCall[] = []

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
  await page.route('**/api/org/classes/7/teacher', (route) => {
    patches.push({ url: route.request().url(), body: route.request().postDataJSON() })
    return route.fulfill(
      json({ id: 7, name: 'A1.1 Buổi tối', inviteCode: 'ABC12345', teacherId: 2, createdAt: '2026-06-01T00:00:00Z' }),
    )
  })
  return patches
}

test.describe('Phân công giáo viên vào lớp — /v2/org/teachers', () => {
  test('mở modal thấy đủ 3 trạng thái lớp', async ({ page }) => {
    await mockOrgSession(page)
    await page.goto('/v2/org/teachers')

    await page.getByRole('button', { name: 'Phân công' }).click()

    const modal = page.getByRole('dialog')
    await expect(modal.getByText('Phân công lớp')).toBeVisible()
    await expect(modal.getByText('Lê Duy Tùng')).toBeVisible()

    // Ba lớp, ba trạng thái: GV khác / chính GV này / chưa gán.
    await expect(modal.getByText('A1.1 Buổi tối')).toBeVisible()
    await expect(modal.getByText('Đang có giáo viên khác phụ trách')).toBeVisible()
    await expect(modal.getByText('B1 Cuối tuần')).toBeVisible()
    await expect(modal.getByText('Giáo viên này đang phụ trách')).toBeVisible()
    await expect(modal.getByText('A2 Sáng T3-T5')).toBeVisible()
    await expect(modal.getByText('Chưa có giáo viên phụ trách')).toBeVisible()

    // Lớp đang do chính GV phụ trách không có nút gán, chỉ có huy hiệu.
    await expect(modal.getByText('Đang phụ trách', { exact: true })).toBeVisible()
    await expect(modal.getByRole('button', { name: 'Giao lớp này' })).toHaveCount(2)
  })

  test('gán lớp → PATCH đúng endpoint + payload, UI đổi sang "đang phụ trách"', async ({ page }) => {
    const patches = await mockOrgSession(page)
    await page.goto('/v2/org/teachers')

    await page.getByRole('button', { name: 'Phân công' }).click()
    const modal = page.getByRole('dialog')

    // Hàng "A1.1 Buổi tối" (đang có GV khác) → giao cho Lê Duy Tùng.
    const row = modal.locator('li').filter({ hasText: 'A1.1 Buổi tối' })
    await row.getByRole('button', { name: 'Giao lớp này' }).click()

    await expect(page.getByText('Đã giao lớp A1.1 Buổi tối.')).toBeVisible()
    expect(patches).toHaveLength(1)
    expect(patches[0].url).toContain('/api/org/classes/7/teacher')
    expect(patches[0].body).toEqual({ teacherId: 2 })

    // Modal không đóng — hàng vừa gán chuyển trạng thái, giờ có 2 lớp "đang phụ trách".
    await expect(row.getByText('Giáo viên này đang phụ trách')).toBeVisible()
    await expect(modal.getByText('Đang phụ trách', { exact: true })).toHaveCount(2)
  })

  test('lọc lớp theo tên trong modal', async ({ page }) => {
    await mockOrgSession(page)
    await page.goto('/v2/org/teachers')

    await page.getByRole('button', { name: 'Phân công' }).click()
    const modal = page.getByRole('dialog')
    await expect(modal.getByText('A1.1 Buổi tối')).toBeVisible()

    await modal.getByPlaceholder('Tìm lớp…').fill('B1')
    await expect(modal.getByText('B1 Cuối tuần')).toBeVisible()
    await expect(modal.getByText('A1.1 Buổi tối')).toBeHidden()

    await modal.getByPlaceholder('Tìm lớp…').fill('không-tồn-tại')
    await expect(modal.getByText('Không có lớp nào khớp từ khóa.')).toBeVisible()
  })
})
