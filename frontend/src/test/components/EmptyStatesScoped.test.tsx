/**
 * G3 lát 2 / D10 — trạng thái rỗng phải nói đúng phạm vi và mở đúng lối ra.
 *
 * Ba lỗi cùng một họ: câu "chưa có gì" được viết cho MỘT tình huống rồi dùng cho mọi tình huống.
 *   · Lịch dạy ghi "Tuần này chưa có buổi lớp nào" kể cả khi người dùng đã lật sang tuần khác —
 *     nói sai phạm vi của chính thứ đang trống.
 *   · Hàng đợi ôn gộp "bạn chưa có thẻ nào" với "thẻ chưa tới hạn" thành một câu, rồi khuyên cả hai
 *     nhóm "quay lại sau" — với người chưa có thẻ, đó là bảo họ chờ một việc không bao giờ tự tới.
 *   · Chấm bài phân biệt được rỗng-thật với rỗng-do-lọc, nhưng không mở lối ra: người dùng phải tự
 *     nhớ mình đã lọc gì.
 *
 * Ràng buộc quan trọng ở ca cuối: KHÔNG suy ra "kho rỗng" từ chỗ thiếu dữ liệu — đúng cái bẫy mà
 * G2 vừa gỡ ở các trang analytics.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import studentVi from '../../../messages/v2/student.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import ReviewPage from '@/app/v2/student/review/page'

const mocks = vi.hoisted(() => ({
  getDueVocab: vi.fn(),
  getTodayTasks: vi.fn(),
  getStats: vi.fn(),
}))
vi.mock('@/lib/reviewApi', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return { ...actual, reviewApi: { ...mocks } }
})
const routerMock = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))

function renderReview() {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...studentVi, ...chromeVi } }}>
      <ReviewPage />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getDueVocab.mockResolvedValue([])
  mocks.getTodayTasks.mockResolvedValue({ tasks: [] })
})
afterEach(() => vi.restoreAllMocks())

describe('Hàng đợi ôn — rỗng vì chưa có thẻ ≠ rỗng vì chưa tới hạn (D10)', () => {
  it('kho THỰC SỰ rỗng: nói đúng lý do và mở lối đi thêm từ', async () => {
    mocks.getStats.mockResolvedValue({ dueCount: 0, totalCards: 0, reviewedCards: 0, totalReviews: 0 })
    renderReview()

    await waitFor(() => expect(screen.getByText('Bộ thẻ ôn của bạn đang trống')).toBeInTheDocument())
    // "Quay lại sau" là lời khuyên sai với người chưa có thẻ nào.
    expect(screen.queryByText(/Quay lại sau|quay lại sau/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Học từ vựng' }))
    expect(routerMock.push).toHaveBeenCalledWith('/v2/student/vocabulary')
  })

  it('có thẻ nhưng chưa tới hạn: giữ câu cũ và KHÔNG mời đi thêm từ', async () => {
    mocks.getStats.mockResolvedValue({ dueCount: 0, totalCards: 42, reviewedCards: 40, totalReviews: 120 })
    renderReview()

    await waitFor(() => expect(screen.getByText('Không có thẻ nào cần ôn')).toBeInTheDocument())
    expect(screen.queryByText('Bộ thẻ ôn của bạn đang trống')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Học từ vựng' })).not.toBeInTheDocument()
  })

  it('KHÔNG đọc được stats: dùng câu trung tính, không suy ra kho rỗng từ chỗ thiếu dữ liệu', async () => {
    mocks.getStats.mockRejectedValue(new Error('boom'))
    renderReview()

    await waitFor(() => expect(screen.getByText('Không có thẻ nào cần ôn')).toBeInTheDocument())
    // Đây là điểm dễ sai nhất: thiếu dữ liệu không phải bằng chứng cho một khẳng định.
    expect(screen.queryByText('Bộ thẻ ôn của bạn đang trống')).not.toBeInTheDocument()
  })
})
