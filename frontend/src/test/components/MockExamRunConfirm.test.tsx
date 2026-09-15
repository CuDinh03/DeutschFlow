/**
 * Xác nhận nộp bài / thoát bài thi ở `/v2/student/mock-exam/run` (08/09/2026).
 *
 * Trước đây hai nhánh này gọi `window.confirm` gốc: lệch chuẩn §2.11 (mọi thao tác không quay lại
 * được phải qua ConfirmDialog nêu hệ quả) và hộp thoại gốc KHOÁ luồng render của cả tab — quan sát
 * prod 07/09/2026: trang treo hoàn toàn với công cụ tự động.
 *
 * Test khẳng định đúng hợp đồng đó: `window.confirm` không bao giờ được gọi, hộp thoại nêu hệ quả
 * thật bằng chữ trong catalog, huỷ thì không nộp — và ĐƯỜNG TỰ NỘP KHI HẾT GIỜ không hỏi lại.
 */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mọi thứ factory `vi.mock` chạm tới phải nằm trong `vi.hoisted` — factory được kéo lên đầu file,
// `const` thường chưa khởi tạo lúc đó. Giá trị hook trả về cũng phải GIỮ NGUYÊN identity giữa các
// lần render: `me` là dep của effect gọi `load()`, object literal mới mỗi render = render vô hạn.
const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  trackFeatureAction: vi.fn(),
  params: 'examId=1',
  remainingSeconds: 1800,
  me: { id: 9 },
  posthog: { capture: () => undefined },
}))

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi'))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(h.params),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

vi.mock('@/lib/api', () => ({
  default: { get: h.apiGet, post: h.apiPost, defaults: { baseURL: '' } },
  httpStatus: (e: unknown) => (e as { response?: { status?: number } })?.response?.status ?? 0,
  isAxiosErr: () => false,
}))

vi.mock('@/lib/authSession', () => ({ getAccessToken: () => 'token' }))

vi.mock('@/hooks/useTracking', () => {
  const value = { trackFeatureAction: h.trackFeatureAction, posthog: h.posthog }
  return { useTracking: () => value }
})

vi.mock('@/hooks/useStudentPracticeSession', () => {
  const value = { me: h.me, loading: false, targetLevel: 'A1' }
  return { useStudentPracticeSession: () => value }
})

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

// Autosaver thật chạy timer + PATCH nền — không phải thứ đang kiểm, và nó làm test rung.
vi.mock('@/lib/exam/examDraftSync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/exam/examDraftSync')>()),
  createDraftAutosaver: () => ({
    notifyChange: vi.fn(),
    adoptVersion: vi.fn(),
    getSnapshot: () => null,
    flushNow: vi.fn(),
    dispose: vi.fn(),
  }),
}))

import Page from '@/app/v2/student/mock-exam/run/page'

const SECTIONS = {
  sections: [
    {
      name: 'LESEN',
      label_vi: 'Đọc hiểu',
      time_minutes: 30,
      max_points: 25,
      teile: [
        {
          teil: 1,
          instruction_vi: 'Chọn đáp án đúng',
          items: [
            { id: 'q1', question: 'Wie heißt du?', type: 'MULTIPLE_CHOICE', options: { a: 'Anna', b: 'Berlin' } },
            { id: 'q2', question: 'Woher kommst du?', type: 'MULTIPLE_CHOICE', options: { a: 'Aus Hanoi', b: 'Gut' } },
          ],
        },
      ],
    },
  ],
}

/** Vào thẳng phòng thi qua deep link `?examId=1` rồi chờ vỏ thi dựng xong. */
async function renderTaking() {
  render(<Page />)
  await screen.findByRole('button', { name: /Thoát/ })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.params = 'examId=1'
  h.remainingSeconds = 1800
  h.apiGet.mockImplementation((url: string) => {
    if (url.includes('/attempts/') && url.endsWith('/result')) {
      return Promise.resolve({ data: { id: 77, exam_id: 1, status: 'COMPLETED', total_score: 80, passed: true, started_at: '2026-09-08T01:00:00Z' } })
    }
    return Promise.resolve({ data: [] })
  })
  h.apiPost.mockResolvedValue({
    data: { id: 77, sections_json: JSON.stringify(SECTIONS), time_limit_minutes: 30, remaining_seconds: h.remainingSeconds },
  })
})

describe('Thi thử — xác nhận NỘP BÀI', () => {
  it('bấm Nộp bài mở ConfirmDialog nêu hệ quả, KHÔNG gọi window.confirm và chưa nộp gì', async () => {
    const nativeConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    await renderTaking()

    await user.click(screen.getAllByRole('button', { name: 'Nộp bài' })[0])

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Nộp bài thi?')).toBeInTheDocument()
    expect(
      within(dialog).getByText('Nộp xong bạn không sửa được câu trả lời nữa và bài chuyển sang chấm điểm.'),
    ).toBeInTheDocument()
    // Hệ quả đo được: số câu đã trả lời trên tổng số câu THẬT của đề.
    expect(within(dialog).getByText('Bạn đã trả lời 0/2 câu — câu bỏ trống tính 0 điểm.')).toBeInTheDocument()

    expect(nativeConfirm).not.toHaveBeenCalled()
    expect(h.apiPost).not.toHaveBeenCalledWith(expect.stringContaining('/finish'), expect.anything())
  })

  it('Huỷ đóng hộp thoại và KHÔNG nộp bài', async () => {
    const user = userEvent.setup()
    await renderTaking()

    await user.click(screen.getAllByRole('button', { name: 'Nộp bài' })[0])
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Huỷ' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(h.apiPost).not.toHaveBeenCalledWith(expect.stringContaining('/finish'), expect.anything())
    // Vẫn ở trong phòng thi.
    expect(screen.getByRole('button', { name: /Thoát/ })).toBeInTheDocument()
  })

  it('xác nhận trong hộp thoại mới thật sự gọi /finish', async () => {
    const user = userEvent.setup()
    await renderTaking()

    await user.click(screen.getAllByRole('button', { name: 'Nộp bài' })[0])
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Nộp bài' }))

    await waitFor(() =>
      expect(h.apiPost).toHaveBeenCalledWith('/mock-exams/attempts/77/finish', { answers: {} }),
    )
  })
})

describe('Thi thử — xác nhận THOÁT', () => {
  it('mở hộp thoại nêu bài vẫn là nháp và đồng hồ vẫn chạy, KHÔNG dùng window.confirm', async () => {
    const nativeConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    await renderTaking()

    await user.click(screen.getByRole('button', { name: /Thoát/ }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Thoát khỏi bài thi?')).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        'Bài làm đã được lưu tự động nên bạn vào lại làm tiếp được — bài vẫn ở dạng nháp, chưa nộp.',
      ),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('Đồng hồ vẫn tiếp tục chạy sau khi bạn thoát.')).toBeInTheDocument()
    expect(nativeConfirm).not.toHaveBeenCalled()
  })

  it('Huỷ thì ở lại phòng thi; xác nhận thì về danh sách đề và không nộp bài', async () => {
    const user = userEvent.setup()
    await renderTaking()

    await user.click(screen.getByRole('button', { name: /Thoát/ }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Huỷ' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Thoát/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Thoát/ }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Thoát bài thi' }))

    await waitFor(() => expect(screen.getByText('Thi thử Goethe')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /^Thoát$/ })).not.toBeInTheDocument()
    expect(h.apiPost).not.toHaveBeenCalledWith(expect.stringContaining('/finish'), expect.anything())
  })
})

describe('Thi thử — hết giờ vẫn tự nộp, không hỏi lại', () => {
  it('remaining_seconds = 0 → gọi thẳng /finish, không mở hộp thoại nào', async () => {
    const nativeConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    h.remainingSeconds = 0
    h.apiPost.mockResolvedValue({
      data: { id: 77, sections_json: JSON.stringify(SECTIONS), time_limit_minutes: 30, remaining_seconds: 0 },
    })
    render(<Page />)

    await waitFor(() =>
      expect(h.apiPost).toHaveBeenCalledWith('/mock-exams/attempts/77/finish', { answers: {} }),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(nativeConfirm).not.toHaveBeenCalled()
  })
})
