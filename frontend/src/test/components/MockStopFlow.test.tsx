/**
 * Thi thử — dừng giữa chừng (owner chốt 07/11/2026): bấm thoát khi chưa chạm câu nào ⇒ huỷ lượt, rời
 * thẳng; đã làm ⇒ hộp liệt kê Teil sẽ tính / không tính, xác nhận ⇒ /stop rồi mở kết quả "Dừng giữa
 * chừng" (không Đỗ/Chưa đỗ, Viết dở không chấm).
 */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn(), save: vi.fn(), push: vi.fn(), replace: vi.fn() }))

vi.mock('@/lib/api', () => ({
  default: { defaults: {}, get: vi.fn(async () => ({ data: [] })), put: vi.fn(async () => ({ data: {} })) },
  apiMessage: () => 'lỗi',
  httpStatus: () => null,
  isAxiosErr: () => false,
}))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('examId=7&start=1'),
  useRouter: () => ({ push: h.push, replace: h.replace }),
}))
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
vi.mock('@/hooks/useTracking', () => ({ useTracking: () => ({ trackFeatureAction: vi.fn() }) }))
vi.mock('@/lib/exam/mockAttemptApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/exam/mockAttemptApi')>()),
  startAttempt: h.start,
  stopAttempt: h.stop,
  saveAttemptDraft: h.save,
}))

import FullExamRoute from '@/app/v2/student/mock-exam/full/page'
import { PartialSummary } from '@/components/exam/mock/PartialSummary'
import { partialInfo, type AttemptResult } from '@/lib/exam/mockAttemptApi'

const mc = (id: string) => ({ id, question: `Frage ${id}`, options: { a: 'eins', b: 'zwei' } })
const SECTIONS = JSON.stringify({
  sections: [
    { name: 'LESEN', teile: [{ teil: 1, type: 'MULTIPLE_CHOICE', items: [mc('L1-1'), mc('L1-2')] }, { teil: 2, type: 'MULTIPLE_CHOICE', items: [mc('L2-1')] }] },
    { name: 'SCHREIBEN', teile: [{ teil: 1, type: 'EMAIL', writing_points: ['Dank'] }] },
  ],
})

beforeEach(() => {
  Object.values(h).forEach((f) => f.mockReset())
  h.start.mockResolvedValue({ attemptId: 55, examId: 7, sectionsJson: SECTIONS, remainingSeconds: 3600, answers: {}, sectionIndex: 0, draftVersion: 0, closedAttemptId: null })
  h.save.mockResolvedValue({ kind: 'saved', version: 1, remainingSeconds: 3600 })
  window.matchMedia = ((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  Element.prototype.getClientRects = function () {
    return [{}] as unknown as DOMRectList
  }
})

describe('Thi thử — dừng giữa chừng', () => {
  it('chưa chạm câu nào ⇒ huỷ lượt và rời thẳng, không hỏi', async () => {
    h.stop.mockResolvedValue({ attemptId: 55, status: 'CANCELLED', alreadyClosed: false })
    const user = userEvent.setup()
    render(<FullExamRoute />)

    await user.click(await screen.findByRole('button', { name: 'Về Luyện thi' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(h.stop).toHaveBeenCalledWith(55, {})
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/v2/student/exam'))
  })

  it('đã làm ⇒ hộp nói rõ sẽ tính / không tính; xác nhận ⇒ /stop rồi mở kết quả lượt dừng', async () => {
    h.stop.mockResolvedValue({ attemptId: 55, status: 'PARTIAL', alreadyClosed: false })
    const user = userEvent.setup()
    render(<FullExamRoute />)

    await user.click((await screen.findAllByRole('radio', { name: /eins/ }))[0])
    await user.click(screen.getByRole('button', { name: 'Về Luyện thi' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Dừng lượt thi thử?')
    expect(dialog).toHaveTextContent('Sẽ tính: Leseverstehen Teil 1 (1/2 câu, 1 câu trống tính 0)')
    expect(dialog).toHaveTextContent('Không tính: Leseverstehen Teil 2, Schreiben')
    expect(h.stop).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Dừng và lưu phần đã làm' }))
    expect(h.stop).toHaveBeenCalledWith(55, { 'L1-1': 'a' })
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/v2/student/mock-exam/full?attemptId=55'))
  })

  it('dừng lỗi mạng ⇒ ở lại lượt thi, hộp báo chưa dừng được', async () => {
    h.stop.mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    render(<FullExamRoute />)

    await user.click((await screen.findAllByRole('radio', { name: /eins/ }))[0])
    await user.click(screen.getByRole('button', { name: 'Về Luyện thi' }))
    await user.click(await screen.findByRole('button', { name: 'Dừng và lưu phần đã làm' }))
    expect(await screen.findByText(/Chưa dừng được lượt thi/)).toBeInTheDocument()
    expect(h.replace).not.toHaveBeenCalled()
    expect(h.push).not.toHaveBeenCalled()
  })
})

describe('Kết quả lượt dừng giữa chừng', () => {
  const detailed = JSON.stringify({
    partial: { reason: 'STOPPED', teile_done: 2, teile_counted: 1, teile_total: 3 },
    teile: {
      'LESEN-1': { status: 'SCORED', score: 12.5, max: 25, answered: 3, total: 5 },
      'LESEN-2': { status: 'NOT_ATTEMPTED', answered: 0, total: 5 },
      'SCHREIBEN-1': { status: 'WRITTEN_NOT_GRADED', answered: 1, total: 1 },
    },
  })
  const result: AttemptResult = { id: 55, exam_id: 7, exam_title: 'Modelltest 1', status: 'PARTIAL', detailed_scores_json: detailed, finished_at: '2026-11-07T10:00:00Z' }

  it('partialInfo đọc khối partial; lượt nộp cả đề ⇒ null', () => {
    expect(partialInfo(detailed)).toMatchObject({ reason: 'STOPPED', teileDone: 2, teileCounted: 1, teileTotal: 3 })
    expect(partialInfo(JSON.stringify({ LESEN: { total: 50, max: 75 } }))).toBeNull()
  })

  it('không Đỗ/Chưa đỗ; Teil có điểm mở xem lại, Viết dở ghi không chấm, Teil chưa làm ghi không tính', async () => {
    const onOpen = vi.fn()
    const user = userEvent.setup()
    render(<PartialSummary result={result} info={partialInfo(detailed)!} teile={[]} onOpen={onOpen} examHref="/again" hubHref="/hub" />)

    expect(screen.getByRole('heading', { level: 1, name: 'Dừng giữa chừng' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Đã làm 2/3 Teil' })).toBeInTheDocument()
    expect(screen.getByText('12,5/25')).toBeInTheDocument()
    expect(screen.getByText('Chưa làm · không tính')).toBeInTheDocument()
    expect(screen.getByText(/Đã viết, không chấm/)).toBeInTheDocument()
    expect(screen.queryByText(/Chưa đỗ|Đỗ phần viết/)).toBeNull()
    await user.click(screen.getByRole('button', { name: /Leseverstehen · Teil 1/ }))
    expect(onOpen).toHaveBeenCalledWith('LESEN-1')
    expect(screen.getByRole('link', { name: /Thi thử lại đề này/ })).toHaveAttribute('href', '/again')
  })
})
