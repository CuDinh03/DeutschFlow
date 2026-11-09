/**
 * Tổng quan admin (đợt 1, 09/11/2026 — AC-ADMIN-20): dashboard từng ghi "Doanh thu (MRR)" và
 * "Thuê bao trả phí theo kỳ" cho hai con số không phải vậy (ADMIN-08 / AC-ADMIN-13), và donut vai
 * trò bỏ sót MANAGER/OWNER. Catalog vi THẬT nên test canh luôn thiếu khoá i18n.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminOpsVi from '../../../messages/v2/adminOps.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import AdminOverviewPage from '@/app/v2/admin/page'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return { ...actual, default: { get: mocks.get } }
})

// GĐ3 (09/11/2026): Tổng quan đọc KPI người dùng từ /admin/users/stats, không tải cả danh sách nữa.
const STATS = {
  total: 5,
  active: 4,
  locked: 1,
  byRole: { STUDENT: 1, TEACHER: 1, MANAGER: 1, OWNER: 1, ADMIN: 1 },
  aiActive30d: 2,
  freeTeachers: 0,
  topUsage30d: [],
}

function mockApi(netVnd: number) {
  mocks.get.mockImplementation((url: string) => {
    if (url === '/admin/users/stats') return Promise.resolve({ data: STATS })
    if (url === '/admin/analytics/revenue')
      return Promise.resolve({
        data: {
          totals: { netVnd },
          chartData: [{ period: '2026-10', netVnd, subscribers: 3, b2cGrossVnd: 1_000_000, b2bGrossVnd: 2_000_000 }],
        },
      })
    return Promise.resolve({ data: { data: [] } })
  })
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...adminOpsVi, ...chromeVi } }}>
      <AdminOverviewPage />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => mocks.get.mockReset())

describe('Tổng quan admin — nhãn đúng nghĩa', () => {
  it('không còn chữ "MRR" hay "Thuê bao"; có nhãn "Còn lại sau phí & AI" và "Giao dịch thành công"', async () => {
    mockApi(2_000_000)
    const { container } = renderPage()
    await waitFor(() => expect(screen.getByText('Còn lại sau phí & AI')).toBeTruthy())
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/MRR/)
    expect(text).not.toMatch(/Thuê bao/)
    expect(text).toContain('Giao dịch thành công theo kỳ')
    // Thẻ tách nguồn: cá nhân (B2C) và trung tâm (B2B, hoá đơn đã thu).
    expect(text).toMatch(/2026-10 · cá nhân .+ · trung tâm .+/)
    // Không còn tải cả bảng người dùng chỉ để đếm.
    expect(mocks.get).not.toHaveBeenCalledWith('/admin/users')
  })

  it('tài khoản tạm dừng dẫn thẳng tới danh sách đã lọc "Đã khoá"', async () => {
    mockApi(2_000_000)
    renderPage()
    const link = await screen.findByText(/1 tài khoản đang tạm dừng/)
    expect(link.closest('a')?.getAttribute('href')).toBe('/v2/admin/users?status=locked')
  })

  it('donut vai trò có đủ Quản lý và Giám đốc', async () => {
    mockApi(2_000_000)
    renderPage()
    await waitFor(() => expect(screen.getByText('Quản lý')).toBeTruthy())
    expect(screen.getByText('Giám đốc')).toBeTruthy()
  })

  it('link "Theo dõi ngân sách chi phí AI" trỏ về Chi phí AI, không về trang tokens đã gộp', async () => {
    mockApi(2_000_000)
    renderPage()
    const link = await screen.findByText('Theo dõi ngân sách chi phí AI')
    expect(link.closest('a')?.getAttribute('href')).toBe('/v2/admin/ai-usage')
  })
})
