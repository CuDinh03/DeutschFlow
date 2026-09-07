/**
 * G2 (F08, F09) — lỗi tải bị trình bày như một kết luận về dữ liệu.
 *
 * Cả hai trang đều nuốt lỗi của nguồn phụ và biến nó thành một câu khẳng định:
 *   F08 `listClasses(...).catch(() => [])` → bảng lớp in "Chưa có lớp nào", tức khẳng định trung tâm
 *       không có lớp, dựng từ chỗ không có dữ liệu nào.
 *   F09 lỗi /user/recommendations và /user/error-analytics chỉ để state ở giá trị khởi tạo, nên khối
 *       tương ứng BIẾN MẤT im lặng — người học không phân biệt được "chưa có gợi ý" với "không tải
 *       được", và không có cách thử lại ngoài F5 cả trang.
 *
 * Điểm chung: nguồn phụ hỏng KHÔNG được làm hỏng nguồn chính, và ngược lại.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import orgVi from '../../../messages/v2/org.vi.json'
import studentVi from '../../../messages/v2/student.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import OrgAnalyticsPage from '@/app/v2/org/analytics/page'
import StudentStatsPage from '@/app/v2/student/stats/page'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub

const orgMocks = vi.hoisted(() => ({ getAnalytics: vi.fn(), listClasses: vi.fn() }))
vi.mock('@/lib/orgApi', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return { ...actual, getAnalytics: orgMocks.getAnalytics, listClasses: orgMocks.listClasses }
})

const apiMocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return { ...actual, default: { get: apiMocks.get }, apiMessage: () => 'Lỗi mạng' }
})
const routerMock = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))
vi.mock('@/hooks/usePageTimeTracker', () => ({ usePageTimeTracker: () => {} }))

const ORG_ANALYTICS = {
  studentCount: 40,
  activeStudents7d: 25,
  classCount: 6,
  tokensThisMonth: 1000,
  monthlyTokenPool: 5000,
  poolUsagePercent: 20,
  poolUnlimited: false,
  cefrDistribution: [{ level: 'A1', count: 10 }],
}

const STUDENT_ANALYTICS = {
  rangeStart: '2026-09-01',
  rangeEnd: '2026-09-07',
  totalWordsLearned: 5,
  totalWordsReviewed: 8,
  totalSpeakingMinutes: 4,
  totalSessionsCompleted: 2,
  wordsDueForReview: 1,
  weeklyBreakdown: [{ date: '2026-09-01', wordsLearned: 1, wordsReviewed: 2, speakingMinutes: 1 }],
  errorsByType: {},
  topWeakPoints: [],
}

const renderOrg = () =>
  render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...orgVi, ...chromeVi } }}>
      <OrgAnalyticsPage />
    </NextIntlClientProvider>,
  )

const renderStudent = () =>
  render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...studentVi, ...chromeVi } }}>
      <StudentStatsPage />
    </NextIntlClientProvider>,
  )

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.restoreAllMocks())

describe('Org analytics — lỗi khối lớp không được giả làm "chưa có lớp" (D07/F08)', () => {
  it('API lớp lỗi nhưng analytics thành công: báo lỗi ở khối lớp, KPI vẫn đúng', async () => {
    orgMocks.getAnalytics.mockResolvedValue(ORG_ANALYTICS)
    orgMocks.listClasses.mockRejectedValue(new Error('boom'))
    renderOrg()

    await waitFor(() => expect(screen.getByText('Lỗi mạng')).toBeInTheDocument())
    // Câu khẳng định sai của bản cũ.
    expect(screen.queryByText('Chưa có lớp nào.')).not.toBeInTheDocument()
    // Nguồn chính vẫn dùng được: KPI lấy từ analytics, không bị lỗi khối lớp kéo theo.
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('thử lại chỉ khối lớp là phục hồi được, không phải tải lại cả trang', async () => {
    orgMocks.getAnalytics.mockResolvedValue(ORG_ANALYTICS)
    orgMocks.listClasses.mockRejectedValueOnce(new Error('boom')).mockResolvedValue({
      content: [{ id: 1, name: 'Lớp A1 tối', inviteCode: 'ABC123', teacherId: 9 }],
      totalElements: 1, totalPages: 1, number: 0, size: 100, first: true, last: true,
    })
    renderOrg()

    await waitFor(() => expect(screen.getByText('Lỗi mạng')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /thử lại/i }))

    await waitFor(() => expect(screen.getByText('Lớp A1 tối')).toBeInTheDocument())
    // getAnalytics chỉ chạy một lần: thử lại đúng nguồn hỏng, không nạp lại thứ đang tốt.
    expect(orgMocks.getAnalytics).toHaveBeenCalledTimes(1)
  })

  it('quá 100 lớp: nói rõ đang xem bao nhiêu và có đường tới danh sách đầy đủ', async () => {
    orgMocks.getAnalytics.mockResolvedValue(ORG_ANALYTICS)
    orgMocks.listClasses.mockResolvedValue({
      content: Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Lớp ${i}`, inviteCode: null, teacherId: 1 })),
      totalElements: 150, totalPages: 2, number: 0, size: 100, first: true, last: false,
    })
    renderOrg()

    await waitFor(() => expect(screen.getByText(/Đang xem 100 trong 150 lớp/)).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /Xem tất cả lớp/ })).toHaveAttribute('href', '/v2/org/classes')
  })
})

describe('Student stats — nguồn phụ lỗi phải nói ra (D09/F09)', () => {
  function mockStudent({ recFails = false, errFails = false } = {}) {
    apiMocks.get.mockImplementation((url: string) => {
      if (url === '/user/analytics') return Promise.resolve({ data: STUDENT_ANALYTICS })
      if (url === '/user/recommendations') {
        return recFails ? Promise.reject(new Error('boom')) : Promise.resolve({ data: { items: [] } })
      }
      return errFails ? Promise.reject(new Error('boom')) : Promise.resolve({ data: { errorTrend: [], openErrors: 0 } })
    })
  }

  it('recommendations lỗi: khối gợi ý báo lỗi thay vì biến mất', async () => {
    mockStudent({ recFails: true })
    renderStudent()

    await waitFor(() =>
      expect(screen.getByText(/Không tải được gợi ý/)).toBeInTheDocument(),
    )
    // Câu này là điểm mấu chốt: im lặng biến mất khiến người học tưởng mình không còn việc gì.
    expect(screen.getByText(/không có nghĩa là bạn không còn việc cần làm/i)).toBeInTheDocument()
  })

  it('error-analytics lỗi: không kết luận đã sửa hết lỗi', async () => {
    mockStudent({ errFails: true })
    renderStudent()

    await waitFor(() => expect(screen.getByText(/Không tải được xu hướng lỗi/)).toBeInTheDocument())
    expect(screen.queryByText('Đã sửa hết')).not.toBeInTheDocument()
  })

  it('cả hai nguồn phụ tốt: không hiện banner lỗi nào', async () => {
    mockStudent()
    renderStudent()

    await waitFor(() => expect(screen.getByText('Từ mới')).toBeInTheDocument())
    expect(screen.queryByText(/Không tải được/)).not.toBeInTheDocument()
  })
})
