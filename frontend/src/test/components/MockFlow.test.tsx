/**
 * Thi thử + Kết quả (đợt (d) làm mới Luyện thi, 07/11/2026): chọn kiểu lượt, chặng Lesen → Hören →
 * Schreiben không quay lại, màn sang Hören đếm 10 giây, kết quả có tiêu đề kết luận + nhãn "Ước tính"
 * + ba chỗ mất điểm mở Teil xem lại.
 */
import React from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi'))
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(async () => ({ data: [] })) }, apiMessage: () => 'lỗi', httpStatus: () => null, isAxiosErr: () => false }))

import { MockStart } from '@/components/exam/mock/MockStart'
import { HoerenRitual } from '@/components/exam/mock/HoerenRitual'
import { ResultSummary } from '@/components/exam/mock/ResultSummary'
import { firstIdxOf, gateView, lastIdxOf, lostRows, modeMinutes, nextStage, resumeStage, stagesOf } from '@/components/exam/mock/mockModel'
import type { AttemptAnalysis, AttemptResult } from '@/lib/exam/mockAttemptApi'
import type { FullTeil } from '@/components/exam/practice/fullExamModel'

const TEILE = [
  { section: 'LESEN' }, { section: 'LESEN' }, { section: 'SPRACHBAUSTEINE' },
  { section: 'HOEREN' }, { section: 'HOEREN' }, { section: 'SCHREIBEN' },
]

afterEach(() => {
  vi.useRealTimers()
  window.localStorage.clear()
})

describe('mockModel', () => {
  it('chặng theo thứ tự thi thật, đầu/cuối chặng, chặng kế tiếp', () => {
    expect(stagesOf(TEILE)).toEqual([0, 1, 2])
    expect(firstIdxOf(TEILE, 1)).toBe(3)
    expect(lastIdxOf(TEILE, 0)).toBe(2)
    expect(nextStage(TEILE, 0)).toBe(1)
    expect(nextStage(TEILE, 2)).toBeNull()
    expect(nextStage([{ section: 'LESEN' }, { section: 'SCHREIBEN' }], 0)).toBe(2)
  })

  it('mở lại lượt dở: lấy chặng sau hơn giữa máy và server, không quay lại chặng đã qua', () => {
    expect(resumeStage(TEILE, 1, null)).toBe(0)
    expect(resumeStage(TEILE, 1, 1)).toBe(1)
    expect(resumeStage(TEILE, 4, 0)).toBe(1)
  })

  it('thời lượng từng kiểu lượt theo telc B1', () => {
    expect(modeMinutes('written')).toBe(150)
    expect(modeMinutes('oral')).toBe(15)
    expect(modeMinutes('all')).toBe(165)
  })

  it('ba chỗ mất nhiều điểm nhất, bỏ Nói và dòng chưa chấm', () => {
    const rows = lostRows({
      totalMax: 300, earned: 150, lost: 75, pending: true, targets: [],
      losses: [
        { section: 'LESEN', teil: 2, max: 25, earned: 10, lost: 15, items: 5, correct: 2, pending: false },
        { section: 'SCHREIBEN', max: 45, earned: 25, lost: 20, pending: false },
        { section: 'HOEREN', teil: 2, max: 25, earned: 15, lost: 10, items: 10, correct: 6, pending: false },
        { section: 'LESEN', teil: 1, max: 25, earned: 20, lost: 5, items: 5, correct: 4, pending: false },
        { section: 'SPRECHEN', max: 75, pending: true },
      ],
    })
    expect(rows.map((r) => r.key)).toEqual(['SCHREIBEN-1', 'LESEN-2', 'HOEREN-2'])
    expect(rows[1].wrong).toBe(3)
  })

  it('cổng: khoảng cách tới ngưỡng; chưa thi thì null', () => {
    const gates = [
      { id: 'written', raw: 151, max: 225, min: 135, status: 'PASSED' },
      { id: 'oral', raw: 0, max: 75, min: 45, status: 'PENDING' },
    ]
    expect(gateView(gates, 'written')).toMatchObject({ margin: 16, markPct: 60 })
    expect(gateView(gates, 'oral')?.margin).toBeNull()
  })
})

describe('Màn trước khi thi thử', () => {
  it('ba kiểu lượt chọn bằng chuột hoặc phím mũi tên; phần nói mở phòng thi nói; phần viết gọi bắt đầu', async () => {
    const onStart = vi.fn()
    const user = userEvent.setup()
    render(<MockStart examTitle="Modelltest 2" running={false} backHref="/back" oralHref="/oral" onStart={onStart} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Modelltest 2' })).toBeInTheDocument()
    const group = screen.getByRole('radiogroup', { name: 'Phần thi' })
    const written = within(group).getByRole('radio', { name: /Phần viết/ })
    expect(written).toHaveAttribute('aria-checked', 'true')
    // phần không thi mờ đi (Sprechen khi chọn phần viết)
    expect(screen.getByText('Sprechen').closest('li')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('Vào Hören là không quay lại Lesen.')).toBeInTheDocument()

    written.focus()
    await user.keyboard('{ArrowRight}')
    const oral = within(group).getByRole('radio', { name: /Phần nói/ })
    expect(oral).toHaveAttribute('aria-checked', 'true')
    expect(oral).toHaveFocus()
    expect(screen.getByRole('link', { name: /Bắt đầu phần nói/ })).toHaveAttribute('href', '/oral')

    await user.click(within(group).getByRole('radio', { name: /Phần viết/ }))
    await user.click(screen.getByRole('button', { name: /Bắt đầu phần viết/ }))
    expect(onStart).toHaveBeenCalledWith('written')
  })

  it('đang có lượt dở ⇒ nút "Làm tiếp phần viết"', () => {
    render(<MockStart examTitle="Đề" running backHref="/b" oralHref="/o" onStart={() => undefined} />)
    expect(screen.getByRole('button', { name: /Làm tiếp phần viết/ })).toBeInTheDocument()
  })
})

describe('Màn sang Hören', () => {
  it('đếm 10 giây rồi tự bắt đầu; "Kiểm tra lại bài" quay về', async () => {
    vi.useFakeTimers()
    const onStart = vi.fn()
    const onBack = vi.fn()
    render(<HoerenRitual onStart={onStart} onBack={onBack} />)
    expect(screen.getByRole('heading', { name: 'Hörverstehen' })).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(9000)
    })
    expect(onStart).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(onStart).toHaveBeenCalledTimes(1)
    screen.getByRole('button', { name: /Kiểm tra lại bài/ }).click()
    expect(onBack).toHaveBeenCalled()
  })
})

describe('Kết quả thi thử', () => {
  const teile: FullTeil[] = [
    { key: 'LESEN-2', section: 'LESEN', sectionIndex: 0, no: 2, data: {} as FullTeil['data'] },
    { key: 'SCHREIBEN-1', section: 'SCHREIBEN', sectionIndex: 3, no: 1, data: {} as FullTeil['data'] },
  ]
  const analysis = { attemptId: 5, examId: 7, sectionsJson: '{}', teile: [], writingText: 'Hallo', writing: { status: 'AI_EVALUATED', total: 25, max: 45, leitpunkte_fehlt: [3] } } as unknown as AttemptAnalysis
  const base: AttemptResult = {
    id: 5, exam_title: 'Modelltest 1', finished_at: '2026-11-02T10:00:00Z', status: 'COMPLETED', total_score: 151,
    detailed_scores_json: JSON.stringify({ LESEN: { total: 50, max: 75 }, SCHREIBEN: { total: 25, max: 45 } }),
    gates: [
      { id: 'written', raw: 151, max: 225, min: 135, status: 'PASSED' },
      { id: 'oral', raw: 0, max: 75, min: 45, status: 'PENDING' },
    ],
    budget: {
      totalMax: 300, earned: 151, lost: 74, pending: true, targets: [],
      losses: [
        { section: 'SCHREIBEN', max: 45, earned: 25, lost: 20, pending: false },
        { section: 'LESEN', teil: 2, max: 25, earned: 10, lost: 15, items: 5, correct: 2, pending: false },
      ],
    },
  }

  it('đỗ: tiêu đề là kết luận, nhãn Ước tính, phần nói chưa thi có nút thi; chỗ mất điểm mở Teil', async () => {
    const onOpen = vi.fn()
    const user = userEvent.setup()
    render(<ResultSummary attemptId={5} result={base} analysis={analysis} teile={teile} byKey={new Map()} onOpen={onOpen} oralHref="/oral" hubHref="/hub" />)

    expect(screen.getByRole('heading', { level: 1, name: 'Đỗ phần viết, hơn ngưỡng 16 điểm' })).toBeInTheDocument()
    expect(screen.getByText('Ước tính · Đỗ · cần 135')).toBeInTheDocument()
    expect(screen.getByText(/không phải điểm chính thức/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Thi phần nói/ })).toHaveAttribute('href', '/oral')

    const lost = screen.getByRole('heading', { name: 'Lấy lại điểm' }).closest('section') as HTMLElement
    const rows = within(lost).getAllByRole('button')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('Thiếu 1 ý bắt buộc')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Sai 3/5 câu')).toBeInTheDocument()
    await user.click(rows[1])
    expect(onOpen).toHaveBeenCalledWith('LESEN-2')
    expect(screen.getByRole('link', { name: /Về hôm nay/ })).toHaveAttribute('href', '/hub')
  })

  it('chưa đỗ: "Còn thiếu N điểm phần viết"', () => {
    const failed = { ...base, gates: [{ id: 'written', raw: 126, max: 225, min: 135, status: 'FAILED' }] }
    render(<ResultSummary attemptId={6} result={failed} analysis={analysis} teile={teile} byKey={new Map()} onOpen={() => undefined} oralHref="/oral" hubHref="/hub" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Còn thiếu 9 điểm phần viết' })).toBeInTheDocument()
    expect(screen.getByText('Ước tính · Chưa đỗ · cần 135')).toBeInTheDocument()
  })
})
