/**
 * Luyện một Teil (sửa sau nghiệm thu prod 07/11/2026): còn câu bỏ trống thì hỏi lại trước khi kiểm tra;
 * bấm "Vẫn kiểm tra" phải đóng hộp xác nhận và hiện kết quả (câu trống tính 0). Trước đây hộp không đóng.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ check: vi.fn(), draft: vi.fn(), push: vi.fn(), ask: vi.fn() }))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(async () => ({ data: { seen: ['exam.teil'] } })), put: vi.fn(async () => ({ data: {} })) },
  apiMessage: () => 'lỗi',
}))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('examId=7&teil=LESEN-2'),
  useRouter: () => ({ push: h.push, replace: vi.fn() }),
}))
// next-intl thật giữ nguyên `t` giữa các lần render; mock chung tạo mới mỗi lần ⇒ effect mẹo (deps có `t`)
// chạy lặp vô hạn. Cache theo namespace cho giống thật.
vi.mock('next-intl', async () => {
  const base = (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi')
  const cache = new Map<string, ReturnType<typeof base.useTranslations>>()
  return {
    ...base,
    useTranslations: (ns?: string) => {
      const k = ns ?? ''
      if (!cache.has(k)) cache.set(k, base.useTranslations(ns))
      return cache.get(k)!
    },
  }
})
vi.mock('@/components/exam/strategy/examStrategy', async (orig) => ({
  ...(await orig<typeof import('@/components/exam/strategy/examStrategy')>()),
  fetchExamStrategies: vi.fn(async () => []),
}))
vi.mock('@/lib/telcPracticeApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/telcPracticeApi')>()),
  getPracticeOverview: vi.fn(async () => OVERVIEW),
  savePracticeDraft: h.draft,
  checkPracticeTeil: h.check,
  askPracticeItemAi: h.ask,
}))

import PracticeTeilRoute from '@/app/v2/student/mock-exam/practice/teil/page'

const ITEMS = [1, 2].map((n) => ({ id: String(n), question: `Frage ${n}`, options: { a: 'eins', b: 'zwei', c: 'drei' } }))
const OVERVIEW = {
  examId: 7,
  title: 'Modelltest 1',
  level: 'B1',
  format: 'TELC',
  sectionsJson: JSON.stringify({ sections: [{ name: 'LESEN', teile: [{ teil: 2, type: 'MULTIPLE_CHOICE', items: ITEMS }] }] }),
  teile: [{ key: 'LESEN-2', section: 'LESEN', teil: 2, type: 'MULTIPLE_CHOICE', items: 2, maxPoints: 25, suggestMinutes: 15, progress: { answers: {}, checked: false, score: null, max: 25, elapsedSeconds: 0, updatedAt: null, result: null } }],
}
const RESULT = {
  teilKey: 'LESEN-2', type: 'MULTIPLE_CHOICE', score: 0, max: 25, correctCount: 0, total: 2, unusedOptions: [],
  items: ITEMS.map((it) => ({ id: it.id, label: it.id, given: null, givenText: null, correct: 'a', correctText: 'eins', answered: false, isCorrect: false, points: 0, whyRight: null, whyWrong: null, trap: null, evidence: [], need: null, rule: null })),
}

beforeEach(() => {
  h.check.mockReset()
  h.draft.mockReset()
  h.push.mockReset()
  h.ask.mockReset()
  h.draft.mockResolvedValue(undefined)
  h.check.mockResolvedValue({ answers: {}, checked: true, score: 0, max: 25, elapsedSeconds: 0, updatedAt: null, result: RESULT })
  window.matchMedia = ((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  Element.prototype.getClientRects = function () {
    return [{}] as unknown as DOMRectList
  }
})

describe('Luyện Teil — kiểm tra khi còn câu trống', () => {
  it('"Vẫn kiểm tra" đóng hộp xác nhận, gửi bài trống và hiện kết quả', async () => {
    const user = userEvent.setup()
    render(<PracticeTeilRoute />)
    await user.click(await screen.findByRole('button', { name: /Kiểm tra Teil này/ }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Còn 2 câu chưa làm')
    await user.click(screen.getByRole('button', { name: 'Vẫn kiểm tra' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(h.check).toHaveBeenCalledWith(7, 'LESEN-2', {}, expect.any(Number), {})
    expect(await screen.findByRole('button', { name: /Làm lại/ })).toBeInTheDocument()
  })
})

describe('Luyện Teil — thoát giữa chừng', () => {
  it('chưa làm câu nào ⇒ thoát thẳng, không hỏi, không tạo nháp', async () => {
    const user = userEvent.setup()
    render(<PracticeTeilRoute />)
    await user.click(await screen.findByRole('button', { name: 'Bản đồ đề' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(h.push).toHaveBeenCalledWith('/v2/student/mock-exam/practice?examId=7')
  })

  it('vừa chọn đáp án rồi bấm thoát ngay ⇒ hỏi, lưu nháp ngay (không chờ hẹn giờ) rồi mới rời', async () => {
    const user = userEvent.setup()
    render(<PracticeTeilRoute />)
    await user.click((await screen.findAllByRole('radio', { name: /eins/ }))[0])
    await user.click(screen.getByRole('button', { name: 'Bản đồ đề' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Bạn đã làm 1/2 câu')
    expect(h.push).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Lưu và thoát' }))
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/v2/student/mock-exam/practice?examId=7'))
    expect(h.draft).toHaveBeenCalledWith(7, 'LESEN-2', { '1': 'a' }, expect.any(Number), {})
  })

  it('lưu nháp lỗi ⇒ ở lại màn, hộp báo chưa lưu được', async () => {
    h.draft.mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    render(<PracticeTeilRoute />)
    await user.click((await screen.findAllByRole('radio', { name: /eins/ }))[0])
    await user.click(screen.getByRole('button', { name: 'Bản đồ đề' }))
    await user.click(await screen.findByRole('button', { name: 'Lưu và thoát' }))
    expect(await screen.findByText(/Chưa lưu được nháp/)).toBeInTheDocument()
    expect(h.push).not.toHaveBeenCalled()
  })
})

describe('Luyện Teil — B3: vì sao tôi chọn + hỏi AI sau khi nộp', () => {
  const RESULT_B3 = {
    ...RESULT,
    items: [
      { ...RESULT.items[0], given: 'b', givenText: 'zwei', answered: true, whyRight: 'Bài nói „eins“.' },
      RESULT.items[1],
    ],
  }

  it('ghi chú gửi cùng lúc nộp, hiện cạnh giải thích; "Hỏi AI về câu này" gọi API một lần và hiện câu trả lời', async () => {
    h.check.mockResolvedValue({
      answers: { '1': 'b' }, checked: true, score: 0, max: 25, elapsedSeconds: 0, updatedAt: null,
      result: RESULT_B3, notes: { '1': 'Mình đoán theo chữ zwei' },
    })
    h.ask.mockResolvedValue({ itemId: '1', locale: 'vi', answer: 'Đáp án a vì bài viết „eins“.', cached: false })
    const user = userEvent.setup()
    render(<PracticeTeilRoute />)

    // Chưa trả lời thì chưa có ô ghi chú; trả lời xong mới hiện nút (không bắt buộc).
    expect(screen.queryByRole('button', { name: 'Ghi vì sao tôi chọn' })).toBeNull()
    await user.click((await screen.findAllByRole('radio', { name: /zwei/ }))[0])
    await user.click(screen.getByRole('button', { name: 'Ghi vì sao tôi chọn' }))
    await user.type(screen.getByLabelText('Vì sao tôi chọn câu 1 (không bắt buộc)'), 'Mình đoán theo chữ zwei')
    // Gõ chữ trong ô ghi chú không kích hoạt phím tắt chọn đáp án.
    expect(screen.getAllByRole('radio', { name: /zwei/ })[0]).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('button', { name: /Kiểm tra Teil này/ }))
    await user.click(await screen.findByRole('button', { name: 'Vẫn kiểm tra' }))
    await waitFor(() =>
      expect(h.check).toHaveBeenCalledWith(7, 'LESEN-2', { '1': 'b' }, expect.any(Number), { '1': 'Mình đoán theo chữ zwei' }),
    )

    expect(await screen.findByTestId('my-note')).toHaveTextContent('Mình đoán theo chữ zwei')
    expect(screen.getByText('Bạn đã ghi lúc làm bài')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Hỏi AI về câu này/ }))
    expect(await screen.findByTestId('ask-ai-answer')).toHaveTextContent('Đáp án a vì bài viết „eins“.')
    expect(h.ask).toHaveBeenCalledTimes(1)
    expect(h.ask).toHaveBeenCalledWith(7, 'LESEN-2', '1', 'vi')
    expect(screen.queryByRole('button', { name: /Hỏi AI về câu này/ })).toBeNull()
  })

  it('hết lượt AI ⇒ báo lỗi của server và cho thử lại', async () => {
    h.check.mockResolvedValue({ answers: {}, checked: true, score: 0, max: 25, elapsedSeconds: 0, updatedAt: null, result: RESULT })
    h.ask.mockRejectedValueOnce(new Error('429')).mockResolvedValueOnce({ itemId: '1', locale: 'vi', answer: 'Giải thích.', cached: true })
    const user = userEvent.setup()
    render(<PracticeTeilRoute />)
    await user.click(await screen.findByRole('button', { name: /Kiểm tra Teil này/ }))
    await user.click(await screen.findByRole('button', { name: 'Vẫn kiểm tra' }))

    await user.click(await screen.findByRole('button', { name: /Hỏi AI về câu này/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('lỗi')
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByTestId('ask-ai-answer')).toHaveTextContent('Giải thích.')
    expect(screen.getByText(/Đã có sẵn, không tính lượt AI/)).toBeInTheDocument()
  })
})
