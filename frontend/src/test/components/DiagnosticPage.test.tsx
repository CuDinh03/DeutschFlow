/**
 * Bài chẩn đoán `/v2/student/exam/diagnostic` (đợt (f) làm mới Luyện thi, 07/11/2026): khai ngày thi +
 * phút mỗi ngày → năm phần (ba Teil chấm qua luyện đề, Viết/Nói tự đánh giá) → kết quả + lịch ôn.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  get: vi.fn(),
  start: vi.fn(),
  saveSelf: vi.fn(),
  finish: vi.fn(),
  overview: vi.fn(),
  check: vi.fn(),
  plan: vi.fn(),
}))

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi'))
vi.mock('@/lib/examDiagnosticApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/examDiagnosticApi')>()),
  examDiagnosticApi: { get: h.get, start: h.start, saveSelf: h.saveSelf, finish: h.finish },
}))
vi.mock('@/lib/telcPracticeApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/telcPracticeApi')>()),
  getPracticeOverview: h.overview,
  checkPracticeTeil: h.check,
}))
vi.mock('@/lib/examPlanApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/examPlanApi')>()),
  examPlanApi: { get: h.plan },
}))

import DiagnosticPage from '@/app/v2/student/exam/diagnostic/page'
import { localIsoDate } from '@/lib/examPlanApi'
import type { DiagnosticView } from '@/lib/examDiagnosticApi'

const TEILE = ['LESEN-1', 'SPRACHBAUSTEINE-1', 'HOEREN-1']
const view = (over: Partial<DiagnosticView>): DiagnosticView => ({
  status: 'IN_PROGRESS', examId: 9, teile: TEILE, self: {}, skills: {}, selfRated: [], finishedAt: null, ...over,
})
const checked = { answers: {}, checked: true, score: 10, max: 25, elapsedSeconds: 0, updatedAt: null, result: null }
const overview = (done: string[]) => ({
  examId: 9, title: 'Đề 9', level: 'B1', format: 'TELC', sectionsJson: '{}',
  teile: TEILE.map((key) => ({ key, section: key.split('-')[0], teil: 1, type: null, items: 5, maxPoints: 25, suggestMinutes: 10, progress: done.includes(key) ? checked : null })),
})
const day = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return localIsoDate(d)
}

beforeEach(() => {
  Object.values(h).forEach((f) => f.mockReset())
  // jsdom không có matchMedia; khung làm bài đọc nó để chọn bố cục hai cột.
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia
})

describe('Bài chẩn đoán', () => {
  it('khai thông tin: ngày đã qua báo lỗi tại chỗ; ngày hợp lệ ⇒ bắt đầu với số phút đã chọn', async () => {
    h.get.mockResolvedValue(view({ status: 'NONE', examId: null }))
    h.start.mockResolvedValue(view({}))
    h.overview.mockResolvedValue(overview([]))
    const user = userEvent.setup()
    const { container } = render(<DiagnosticPage />)

    expect(await screen.findByRole('heading', { level: 1, name: /để biết nên luyện gì trước/ })).toBeInTheDocument()
    const date = container.querySelector('#diag-date') as HTMLInputElement
    await user.type(date, day(0))
    expect(screen.getByText('Ngày thi phải sau hôm nay.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Bắt đầu/ }))
    expect(h.start).not.toHaveBeenCalled()

    await user.clear(date)
    await user.type(date, day(35))
    expect(screen.getByText(/35 ngày/)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Mỗi ngày ôn được'), '45')
    await user.click(screen.getByRole('button', { name: /Bắt đầu/ }))
    expect(h.start).toHaveBeenCalledWith(day(35), 45)
    expect(await screen.findByText('Bài chẩn đoán · phần 1/5')).toBeInTheDocument()
  })

  it('làm dở: vào thẳng phần đang dở; nộp Teil qua luyện đề, tự đánh giá Viết/Nói rồi chốt', async () => {
    h.get.mockResolvedValue(view({}))
    h.overview.mockResolvedValue(overview(['LESEN-1', 'SPRACHBAUSTEINE-1']))
    h.check.mockResolvedValue(checked)
    h.saveSelf.mockImplementation(async (skill: string, level: number) =>
      view({ self: skill === 'SCHREIBEN' ? { SCHREIBEN: level } : { SCHREIBEN: 3, SPRECHEN: level } }),
    )
    h.finish.mockResolvedValue(view({ status: 'DONE', skills: { LESEN: 45, HOEREN: 80, SCHREIBEN: 65, SPRECHEN: 80 }, selfRated: ['SCHREIBEN', 'SPRECHEN'] }))
    h.plan.mockResolvedValue({ status: 'ACTIVE', totalWeeks: 5, weeklyMinutes: 210, warnings: [], weeks: [] })
    const user = userEvent.setup()
    render(<DiagnosticPage />)

    // Lesen, Bausteine đã xong ⇒ vào thẳng Hören (phần 3)
    expect(await screen.findByText('Bài chẩn đoán · phần 3/5')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Phần tiếp/ }))
    expect(h.check).toHaveBeenCalledWith(9, 'HOEREN-1', {}, expect.any(Number))

    expect(await screen.findByText('Bài chẩn đoán · phần 4/5')).toBeInTheDocument()
    const next = screen.getByRole('button', { name: /Phần tiếp/ })
    expect(next).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /Viết được, ít lỗi/ }))
    await user.click(next)
    expect(h.saveSelf).toHaveBeenCalledWith('SCHREIBEN', 3)

    await user.click(await screen.findByRole('radio', { name: /Nói trôi chảy/ }))
    await user.click(screen.getByRole('button', { name: /Xem kết quả/ }))
    expect(h.saveSelf).toHaveBeenCalledWith('SPRECHEN', 4)
    expect(h.finish).toHaveBeenCalled()
    expect(await screen.findByRole('heading', { level: 1, name: 'Lesen cần luyện trước' })).toBeInTheDocument()
  })

  it('kết quả: bốn kỹ năng, phần tự đánh giá có nhãn, lịch ôn sẵn sàng', async () => {
    h.get.mockResolvedValue(view({ status: 'DONE', skills: { LESEN: 45, HOEREN: 62, SCHREIBEN: 65, SPRECHEN: 50 }, selfRated: ['SCHREIBEN', 'SPRECHEN'] }))
    h.plan.mockResolvedValue({
      status: 'ACTIVE', totalWeeks: 5, weeklyMinutes: 210, warnings: [],
      weeks: [
        { weekNo: 1, tasks: [{ type: 'DIAGNOSTIC_EXAM' }] },
        { weekNo: 4, tasks: [{ type: 'FULL_EXAM' }, { type: 'ORAL_MOCK' }] },
      ],
    })
    render(<DiagnosticPage />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Lesen cần luyện trước' })).toBeInTheDocument()
    expect(screen.getAllByText('Tự đánh giá')).toHaveLength(2)
    expect(await screen.findByRole('heading', { name: 'Lịch ôn 5 tuần đã sẵn sàng' })).toBeInTheDocument()
    expect(screen.getByText('30 phút mỗi ngày · 2 lần thi thử')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Xem hôm nay/ })).toHaveAttribute('href', '/v2/student/exam')
  })
})
