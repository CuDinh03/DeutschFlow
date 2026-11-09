/**
 * Danh sách người dùng admin (đợt 1 "Nền móng + Người dùng" · GĐ3, 09/11/2026 — AC-ADMIN-25/28):
 * lọc, sắp xếp và phân trang trên SERVER (GET /admin/users/search), bộ lọc nằm trên URL, KPI đếm
 * trên cả bảng (GET /admin/users/stats), chế độ xem "Giáo viên tự do" thay trang cũ, bấm một dòng
 * thì sang trang hồ sơ. Catalog vi THẬT nên test canh luôn thiếu khoá i18n.
 */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminOpsVi from '../../../messages/v2/adminOps.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'

const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
  push: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  usePathname: () => '/v2/admin/users',
  useSearchParams: () => nav.params,
}))

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return { ...actual, default: { get: mocks.get } }
})

import AdminUsersPage from '@/app/v2/admin/users/page'

const ROW = {
  id: 7,
  email: 'lan@test.vn',
  displayName: 'Lan Anh',
  role: 'MANAGER',
  isActive: true,
  createdAt: '2026-10-01T09:00:00',
  orgId: 3,
  orgName: 'TT Hà Nội',
  planCode: 'DEFAULT',
  usageLast30Days: 1200,
  quota: null,
}
const STATS = {
  total: 137,
  active: 130,
  locked: 7,
  byRole: { STUDENT: 100, TEACHER: 20, MANAGER: 10, OWNER: 5, ADMIN: 2 },
  aiActive30d: 40,
  freeTeachers: 6,
  topUsage30d: [],
}

function searchCalls() {
  return mocks.get.mock.calls.filter(([url]) => url === '/admin/users/search')
}

function renderAt(query: string) {
  nav.params = new URLSearchParams(query)
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...adminOpsVi, ...chromeVi } }}>
      <AdminUsersPage />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.get.mockImplementation((url: string) => {
    if (url === '/admin/users/search') return Promise.resolve({ data: { items: [ROW], total: 41, page: 1, size: 20, sort: 'createdAt,desc' } })
    if (url === '/admin/users/stats') return Promise.resolve({ data: STATS })
    if (url === '/admin/plans') return Promise.resolve({ data: [{ code: 'PRO', name: 'Pro' }] })
    return Promise.resolve({ data: null })
  })
})

describe('Danh sách người dùng — phân trang và lọc trên server', () => {
  it('đọc bộ lọc từ URL: ?role=MANAGER&page=2 gửi API trang 1 (API đánh số từ 0)', async () => {
    renderAt('role=MANAGER&page=2')
    await waitFor(() => expect(searchCalls().length).toBeGreaterThan(0))
    expect(searchCalls()[0][1]).toEqual({
      params: { role: 'MANAGER', sort: 'createdAt,desc', page: 1, size: 20 },
    })
    // Không bao giờ còn tải cả bảng.
    expect(mocks.get).not.toHaveBeenCalledWith('/admin/users')
  })

  it('đổi bộ lọc trạng thái ghi lên URL và bỏ số trang (về trang 1)', async () => {
    const user = userEvent.setup()
    renderAt('page=3')
    await screen.findByText('Lan Anh')
    await user.click(screen.getByTestId('status-filter-locked'))
    expect(nav.replace).toHaveBeenCalledWith('/v2/admin/users?status=locked', { scroll: false })
  })

  it('KPI lấy từ /stats (đếm cả bảng), không từ trang đang xem', async () => {
    renderAt('')
    await screen.findByText('Lan Anh')
    // 137 = tổng cả bảng, hiện ở thẻ KPI và ở chip "Tất cả" — trang đang xem chỉ có 1 dòng.
    expect((await screen.findAllByText('137')).length).toBe(2)
    expect(within(screen.getByTestId('role-filter-all')).getByText('137')).toBeTruthy()
    expect(within(screen.getByTestId('role-filter-MANAGER')).getByText('10')).toBeTruthy()
  })

  it('chế độ Giáo viên tự do gửi đúng bộ lọc TEACHER · không thuộc trung tâm · đang hoạt động', async () => {
    renderAt('view=free-teachers')
    await waitFor(() => expect(searchCalls().length).toBeGreaterThan(0))
    expect(searchCalls()[0][1].params).toMatchObject({ role: 'TEACHER', org: 'none', status: 'active' })
    expect(screen.queryByTestId('role-filter-all')).toBeNull()
  })

  it('bấm một dòng thì sang trang hồ sơ của người đó', async () => {
    const user = userEvent.setup()
    renderAt('')
    await user.click(await screen.findByText('Lan Anh'))
    expect(nav.push).toHaveBeenCalledWith('/v2/admin/users/7')
  })

  it('footer phân trang dùng tổng từ server', async () => {
    renderAt('')
    await screen.findByText('Lan Anh')
    expect(screen.getByText(/41/)).toBeTruthy()
  })
})
