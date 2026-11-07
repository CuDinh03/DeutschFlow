/**
 * Màn Đề (đợt (c), 07/11/2026): nhóm phần thi có tiêu đề nổi, dòng Teil có trạng thái + nút chiến
 * thuật, ngăn Chiến thuật (Các bước · Bẫy · Mất điểm vì → chữa bằng), thi thử đã làm có đỗ/chưa đỗ.
 */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getMock = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => getMock(...a) }, apiMessage: () => 'lỗi' }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('examId=7') }))
vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi'))
vi.mock('@/lib/telcPracticeApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/telcPracticeApi')>()),
  getPracticeOverview: vi.fn(async () => OVERVIEW),
}))
vi.mock('@/lib/exam/mockAttemptApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/exam/mockAttemptApi')>()),
  listMyAttempts: vi.fn(async () => ATTEMPTS),
}))

import PracticeMapRoute from '@/app/v2/student/mock-exam/practice/page'
import { clearStrategyCache } from '@/components/exam/strategy/examStrategy'

const SECTIONS = JSON.stringify({
  sections: [
    { name: 'LESEN', teile: [{ teil: 1, type: 'MATCH_HEADLINE' }, { teil: 2, type: 'MULTIPLE_CHOICE' }] },
    { name: 'HOEREN', teile: [{ teil: 1, max_plays: 1 }] },
  ],
})
const OVERVIEW = {
  examId: 7,
  title: 'Modelltest 1',
  level: 'B1',
  format: 'TELC',
  sectionsJson: SECTIONS,
  teile: [
    { key: 'LESEN-1', section: 'LESEN', teil: 1, type: 'MATCH_HEADLINE', items: 5, maxPoints: 25, suggestMinutes: 10, progress: { answers: {}, checked: true, score: 25, max: 25, elapsedSeconds: 0, updatedAt: null, result: { correctCount: 5, total: 5 } } },
    { key: 'LESEN-2', section: 'LESEN', teil: 2, type: 'MULTIPLE_CHOICE', items: 5, maxPoints: 25, suggestMinutes: 15, progress: { answers: {}, checked: true, score: 10, max: 25, elapsedSeconds: 0, updatedAt: null, result: { correctCount: 2, total: 5 } } },
    { key: 'HOEREN-1', section: 'HOEREN', teil: 1, type: null, items: 5, maxPoints: 25, suggestMinutes: 10, progress: null },
  ],
}
// tổng điểm viết tối đa 75 ⇒ ngưỡng 45
const ATTEMPTS = [
  { id: 1, exam_id: 7, started_at: '2026-10-17T08:00:00Z', finished_at: '2026-10-17T10:00:00Z', total_score: 40, status: 'COMPLETED' },
  { id: 2, exam_id: 7, started_at: '2026-10-24T08:00:00Z', finished_at: '2026-10-24T10:00:00Z', total_score: 52, status: 'COMPLETED' },
  { id: 3, exam_id: 9, started_at: '2026-10-25T08:00:00Z', finished_at: '2026-10-25T10:00:00Z', total_score: 70, status: 'COMPLETED' },
]

beforeEach(() => {
  getMock.mockReset()
  clearStrategyCache()
})

describe('Màn Đề', () => {
  it('đầu trang, nhóm phần thi, trạng thái từng Teil và thi thử của riêng đề này', async () => {
    render(<PracticeMapRoute />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Modelltest 1' })).toBeInTheDocument()
    expect(screen.getByText('2/3 Teil đã luyện')).toBeInTheDocument()
    expect(screen.getByText('Thi thử 52/75')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Thi thử trọn đề/ })).toHaveAttribute('href', '/v2/student/mock-exam/full?examId=7')
    expect(screen.getByRole('heading', { level: 3, name: 'Leseverstehen' })).toBeInTheDocument()
    expect(screen.getByText('2/2 đã luyện')).toBeInTheDocument()
    expect(screen.getByText('Đạt 100%')).toBeInTheDocument()
    expect(screen.getByText('10/25 · 40%')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Leseverstehen Teil 2/ })).toHaveAttribute('href', '/v2/student/mock-exam/practice/teil?examId=7&teil=LESEN-2')
    // thi thử: chỉ hai lượt của đề 7, mới nhất trước; ngưỡng 60% của 75 = 45
    expect(screen.getByRole('img', { name: /40, 52; ngưỡng 45/ })).toBeInTheDocument()
    const rows = screen.getAllByRole('link', { name: /điểm phần viết/ })
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('Đỗ')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Chưa đỗ')).toBeInTheDocument()
  })

  it('nút bóng đèn mở ngăn Chiến thuật của đúng Teil với bước, bẫy, cách chữa', async () => {
    getMock.mockResolvedValue({
      data: [{ section: 'LESEN', teil: 2, points: 25, status: 'REVIEWED', content: { title: 'Lesen 2', format: 'Bài dài, 5 câu a/b/c.', steps: ['Đọc câu hỏi trước.'], traps: ['Đúng một nửa.'], fixes: [{ cause: 'Chọn theo đại ý', fix: 'Tìm câu bằng chứng' }] } }],
    })
    const user = userEvent.setup()
    render(<PracticeMapRoute />)
    await user.click(await screen.findByRole('button', { name: 'Chiến thuật Leseverstehen Teil 2' }))
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByText('Leseverstehen · Teil 2')).toBeInTheDocument()
    expect(await within(drawer).findByText('Đọc câu hỏi trước.')).toBeInTheDocument()
    expect(within(drawer).getByText('Đúng một nửa.')).toBeInTheDocument()
    expect(within(drawer).getByText('Tìm câu bằng chứng')).toBeInTheDocument()
    expect(getMock).toHaveBeenCalledWith('/exam-strategies', { params: { provider: 'TELC', level: 'B1', lang: 'vi' } })
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Teil chưa có chiến thuật đã duyệt: hiện mẹo chung và dòng "sắp có"', async () => {
    getMock.mockResolvedValue({ data: [{ section: 'HOEREN', teil: 1, points: 25, status: 'COMING_SOON' }] })
    const user = userEvent.setup()
    render(<PracticeMapRoute />)
    await user.click(await screen.findByRole('button', { name: 'Chiến thuật Hörverstehen Teil 1' }))
    const drawer = await screen.findByRole('dialog')
    expect(await within(drawer).findByText('Chiến thuật cho Teil này: sắp có.')).toBeInTheDocument()
    expect(within(drawer).getByText(/Dùng thời gian đọc để gạch từ khoá/)).toBeInTheDocument()
  })
})
