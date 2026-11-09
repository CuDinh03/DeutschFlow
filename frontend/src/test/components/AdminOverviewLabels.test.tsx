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

const USERS = [
  { id: 1, role: 'STUDENT', isActive: true },
  { id: 2, role: 'TEACHER', isActive: true },
  { id: 3, role: 'MANAGER', isActive: true },
  { id: 4, role: 'OWNER', isActive: true },
  { id: 5, role: 'ADMIN', isActive: true },
]

function mockApi(netVnd: number) {
  mocks.get.mockImplementation((url: string) => {
    if (url === '/admin/users') return Promise.resolve({ data: USERS })
    if (url === '/admin/analytics/revenue')
      return Promise.resolve({ data: { totals: { netVnd }, chartData: [{ period: '2026-10', netVnd, subscribers: 3 }] } })
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
    expect(text).toContain('kỳ gần nhất · 2026-10')
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
