/**
 * G1.2 (F05, F07) — trang thống kê học tập nói sai khoảng thời gian và trộn hai đơn vị.
 *
 * F05: nhãn ghi "tuần này" trong khi backend cộng today−6..today theo lịch VN — không phải tuần
 * lịch. Khoảng nay do backend công bố (rangeStart/rangeEnd) và giao diện hiển thị đúng khoảng đó,
 * thay vì để người đọc đoán hoặc suy từ đồng hồ máy khách.
 *
 * F07: số TỪ và số PHÚT từng nằm chung một GaMultiBars, tức chung một trục Y — cột "5 từ" cao bằng
 * cột "5 phút", mời người đọc so sánh hai đại lượng không so sánh được.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import studentVi from '../../../messages/v2/student.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import StatsPage from '@/app/v2/student/stats/page'

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
const routerMock = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))
vi.mock('@/hooks/usePageTimeTracker', () => ({ usePageTimeTracker: () => {} }))

const ANALYTICS = {
  rangeStart: '2026-09-01',
  rangeEnd: '2026-09-07',
  totalWordsLearned: 12,
  totalWordsReviewed: 30,
  totalSpeakingMinutes: 18,
  totalSessionsCompleted: 4,
  wordsDueForReview: 99,
  weeklyBreakdown: Array.from({ length: 7 }, (_, i) => ({
    date: `2026-09-0${i + 1}`,
    wordsLearned: i,
    wordsReviewed: i * 2,
    speakingMinutes: i,
  })),
  errorsByType: {},
  topWeakPoints: [],
}

function mockAll() {
  mocks.get.mockImplementation((url: string) => {
    if (url === '/user/analytics') return Promise.resolve({ data: ANALYTICS })
    if (url === '/user/recommendations') return Promise.resolve({ data: { items: [] } })
    return Promise.resolve({ data: { errorTrend: [], openErrors: 0 } })
  })
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...studentVi, ...chromeVi } }}>
      <StatsPage />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.restoreAllMocks())

describe('Student stats — khoảng thời gian và đơn vị (G1.2)', () => {
  it('F05: không còn gọi là "tuần này"; hiện đúng khoảng backend đã cộng', async () => {
    mockAll()
    renderPage()

    await waitFor(() => expect(screen.getByText('Từ mới')).toBeInTheDocument())
    // Backend chốt 01/09–07/09 theo lịch VN; giao diện phải nói lại đúng khoảng đó.
    // Dấu phân cách ngày/tháng do Intl quyết theo locale (vi-VN cho "01-09"), không ép ở đây.
    expect(screen.getAllByText(/01.09\s*–\s*07.09/).length).toBeGreaterThan(0)
    expect(screen.queryByText('tuần này')).not.toBeInTheDocument()
  })

  it('F07: từ vựng và phút nói nằm ở hai biểu đồ riêng, mỗi cái ghi rõ đơn vị', async () => {
    mockAll()
    renderPage()

    await waitFor(() => expect(screen.getByText(/Từ vựng ·/)).toBeInTheDocument())
    expect(screen.getByText(/Luyện nói ·/)).toBeInTheDocument()
    // Đơn vị ghi tường minh dưới mỗi biểu đồ — thứ mà một trục Y chung không thể nói được.
    expect(screen.getByText('đơn vị: từ')).toBeInTheDocument()
    expect(screen.getByText('đơn vị: phút')).toBeInTheDocument()
  })

  it('F06: KPI "Đến hạn" lấy đúng số backend trả, không phải tổng số thẻ', async () => {
    mockAll()
    renderPage()

    await waitFor(() => expect(screen.getByText('Đến hạn')).toBeInTheDocument())
    // 99 cố ý không trùng số nào trong bảng dữ liệu 7 ngày bên dưới: từ khi biểu đồ có bảng đọc số
    // kèm theo (G3), một giá trị nhỏ như "3" xuất hiện ở nhiều nơi và phép tìm theo text mất nghĩa.
    expect(screen.getByText('99')).toBeInTheDocument()
  })

  it('thiếu rangeStart/rangeEnd (backend cũ): vẫn nói "7 ngày gần nhất", không bịa ngày', async () => {
    const { rangeStart: _s, rangeEnd: _e, ...legacy } = ANALYTICS
    mocks.get.mockImplementation((url: string) => {
      if (url === '/user/analytics') return Promise.resolve({ data: legacy })
      if (url === '/user/recommendations') return Promise.resolve({ data: { items: [] } })
      return Promise.resolve({ data: { errorTrend: [], openErrors: 0 } })
    })
    renderPage()

    await waitFor(() => expect(screen.getAllByText('7 ngày gần nhất').length).toBeGreaterThan(0))
    expect(screen.queryByText(/\d{2}.\d{2}\s*–\s*\d{2}.\d{2}/)).not.toBeInTheDocument()
  })
})
