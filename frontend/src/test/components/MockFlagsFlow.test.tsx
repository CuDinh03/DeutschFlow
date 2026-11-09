/**
 * Thi thử — đánh dấu xem lại (B3, 09/11/2026): câu đánh dấu lưu cùng nháp trên server (tải lại vẫn còn),
 * nút "Câu đánh dấu (N)" ở thanh dưới liệt kê câu của chặng đang thi và nhảy sang đúng Teil.
 */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ start: vi.fn(), save: vi.fn(), push: vi.fn(), replace: vi.fn() }))

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
  saveAttemptDraft: h.save,
}))

import FullExamRoute from '@/app/v2/student/mock-exam/full/page'

const mc = (id: string) => ({ id, question: `Frage ${id}`, options: { a: 'eins', b: 'zwei' } })
const SECTIONS = JSON.stringify({
  sections: [
    { name: 'LESEN', teile: [{ teil: 1, type: 'MULTIPLE_CHOICE', items: [mc('L1-1'), mc('L1-2')] }, { teil: 2, type: 'MULTIPLE_CHOICE', items: [mc('L2-3')] }] },
    { name: 'SCHREIBEN', teile: [{ teil: 1, type: 'EMAIL', writing_points: ['Dank'] }] },
  ],
})

beforeEach(() => {
  Object.values(h).forEach((f) => f.mockReset())
  h.start.mockResolvedValue({
    attemptId: 55, examId: 7, sectionsJson: SECTIONS, remainingSeconds: 3600, answers: {}, sectionIndex: 0,
    draftVersion: 3, flags: ['L1-2'], closedAttemptId: null,
  })
  h.save.mockResolvedValue({ kind: 'saved', version: 4, remainingSeconds: 3600 })
  window.matchMedia = ((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  Element.prototype.getClientRects = function () {
    return [{}] as unknown as DOMRectList
  }
})

describe('Thi thử — đánh dấu xem lại', () => {
  it('cờ đã lưu hiện lại khi làm tiếp; đánh dấu thêm ⇒ lưu nháp kèm flags', async () => {
    const user = userEvent.setup()
    render(<FullExamRoute />)

    expect(await screen.findByRole('button', { name: /Câu đánh dấu \(1\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đánh dấu câu 2 để xem lại' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Đánh dấu câu 1 để xem lại' }))
    expect(screen.getByRole('button', { name: /Câu đánh dấu \(2\)/ })).toBeInTheDocument()
    await waitFor(
      () => expect(h.save).toHaveBeenCalledWith(55, expect.objectContaining({ flags: ['L1-2', 'L1-1'] }), 3),
      { timeout: 5000 },
    )
  }, 10_000)

  it('danh sách câu đánh dấu nhảy về đúng Teil của chặng đang thi', async () => {
    const user = userEvent.setup()
    render(<FullExamRoute />)

    await user.click(await screen.findByRole('button', { name: 'Teil sau' }))
    expect(screen.getByText('Thi thử · Đọc hiểu · Teil 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Câu đánh dấu \(1\)/ }))
    const region = screen.getByRole('region', { name: 'Câu đánh dấu trong phần đang thi' })
    await user.click(within(region).getByRole('button', { name: 'Leseverstehen Teil 1 · câu 2' }))
    expect(screen.getByText('Thi thử · Đọc hiểu · Teil 1')).toBeInTheDocument()
  })
})
