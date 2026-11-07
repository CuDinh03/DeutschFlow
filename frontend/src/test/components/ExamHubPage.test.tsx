/**
 * Luyện thi · Hôm nay `/v2/student/exam` (đợt (d) làm mới Luyện thi, 07/11/2026).
 *
 * Thứ tự Hôm nay → Bốn kỹ năng → Tuần này → Đề luyện. Thẻ Hôm nay lấy buổi của hôm nay trong lịch
 * tuần; bấm hai buổi chưa làm thì đổi chỗ (máy chủ lưu) và thẻ Hôm nay đổi theo; chưa có ngày thi
 * thì gợi ý Teil yếu nhất và có ô đặt ngày thi. Chỉ đề telc (Goethe ẩn trên web).
 */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, it, expect, vi } from 'vitest'

const h = vi.hoisted(() => ({
  getMockPacks: vi.fn(),
  getMockPack: vi.fn(),
  getPracticeAccess: vi.fn(),
  getPracticeOverview: vi.fn(),
  listMyAttempts: vi.fn(),
  planGet: vi.fn(),
  swapDays: vi.fn(),
  updateTargetDate: vi.fn(),
  listResults: vi.fn(),
  seenTours: vi.fn(),
  markTourSeen: vi.fn(),
  diagGet: vi.fn(),
}))

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi'))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/mockPackApi', () => ({ getMockPacks: h.getMockPacks, getMockPack: h.getMockPack }))
vi.mock('@/lib/telcPracticeApi', () => ({
  WRITING_KEY: 'SCHREIBEN-1',
  getPracticeAccess: h.getPracticeAccess,
  getPracticeOverview: h.getPracticeOverview,
}))
vi.mock('@/lib/exam/mockAttemptApi', () => ({ listMyAttempts: h.listMyAttempts }))
vi.mock('@/lib/examDiagnosticApi', () => ({ examDiagnosticApi: { get: h.diagGet } }))
vi.mock('@/lib/uiToursApi', () => ({ loadSeenTours: () => h.seenTours(), markTourSeen: h.markTourSeen }))
vi.mock('@/lib/examSpeakingApi', () => ({ examSpeakingApi: { listResults: h.listResults } }))
vi.mock('@/lib/examPlanApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/examPlanApi')>()),
  examPlanApi: { get: h.planGet, swapDays: h.swapDays, updateTargetDate: h.updateTargetDate },
}))

import V2StudentExamHubPage from '@/app/v2/student/exam/page'
import { localIsoDate, type ExamPlan, type ExamPlanDay } from '@/lib/examPlanApi'

const day = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return localIsoDate(d)
}

function planWith(days: ExamPlanDay[]): ExamPlan {
  return {
    status: 'ACTIVE', provider: 'TELC', level: 'B1', targetDate: day(30), daysLeft: 30, totalWeeks: 5, currentWeek: 2, weeklyMinutes: 200, warnings: [],
    weeks: [
      { weekNo: 1, startDate: day(-8), endDate: day(-2), phase: 'TEIL', focus: [], tasks: [], doneTasks: 0, totalTasks: 0 },
      { weekNo: 2, startDate: day(-1), endDate: day(5), phase: 'TEIL', focus: [], tasks: [], doneTasks: 1, totalTasks: 3, days },
    ],
  }
}

const DAYS: ExamPlanDay[] = [
  { date: day(-1), kind: 'TEIL', section: 'HOEREN', teil: 1, minutes: 35, status: 'DONE', movable: false },
  { date: day(0), kind: 'TEIL', section: 'LESEN', teil: 2, minutes: 35, status: 'TODAY', movable: true },
  { date: day(1), kind: 'ORAL_DRILL', section: 'SPRECHEN', teil: 3, minutes: 15, status: 'UPCOMING', movable: true },
  { date: day(2), kind: 'FULL_EXAM', minutes: 150, status: 'UPCOMING', movable: true, examId: 101, examTitle: 'Đề số 1' },
  { date: day(3), kind: 'REST', minutes: 0, status: 'REST', movable: true },
  { date: day(4), kind: 'REST', minutes: 0, status: 'REST', movable: true },
  { date: day(5), kind: 'REST', minutes: 0, status: 'REST', movable: true },
]

const progress = (score: number, max: number) => ({ answers: {}, checked: true, score, max, elapsedSeconds: 0, updatedAt: '2026-11-05T10:00:00Z', result: null })

function setup() {
  h.getPracticeAccess.mockResolvedValue(true)
  h.getMockPacks.mockResolvedValue([
    { id: 6, title: 'Luyện thi telc B1', descriptionVi: null, cefrLevel: 'B1', examFormat: 'TELC', examCount: 2, requiresPaid: false, locked: false },
    { id: 1, title: 'Goethe A1', descriptionVi: null, cefrLevel: 'A1', examFormat: 'GOETHE', examCount: 5, requiresPaid: false, locked: false },
  ])
  h.getMockPack.mockImplementation(async (id: number) =>
    id === 6
      ? {
          id: 6, title: 'Luyện thi telc B1', descriptionVi: null, cefrLevel: 'B1', examFormat: 'TELC',
          exams: [
            { id: 101, title: 'telc Deutsch B1 — Đề số 1', totalPoints: 300, passPoints: 180, timeLimitMinutes: 150, comingSoon: false },
            { id: 102, title: 'telc Deutsch B1 — Đề số 2', totalPoints: 300, passPoints: 180, timeLimitMinutes: 150, comingSoon: true },
          ],
        }
      : { id: 1, title: 'Goethe A1', descriptionVi: null, cefrLevel: 'A1', examFormat: 'GOETHE', exams: [{ id: 1, title: 'Goethe A1 — Set 1', totalPoints: 100, passPoints: 60, timeLimitMinutes: 80 }] },
  )
  h.getPracticeOverview.mockResolvedValue({
    examId: 101, title: 'Đề 1', level: 'B1', format: 'TELC', sectionsJson: '{}',
    teile: [
      { key: 'LESEN-1', section: 'LESEN', teil: 1, type: 'MATCH_HEADLINE', items: 5, maxPoints: 25, suggestMinutes: 10, progress: progress(25, 25) },
      { key: 'LESEN-2', section: 'LESEN', teil: 2, type: 'MULTIPLE_CHOICE', items: 5, maxPoints: 25, suggestMinutes: 15, progress: progress(10, 25) },
      { key: 'HOEREN-1', section: 'HOEREN', teil: 1, type: null, items: 5, maxPoints: 25, suggestMinutes: 10, progress: null },
    ],
  })
  h.listMyAttempts.mockResolvedValue([
    { id: 900, exam_id: 101, exam_title: 'telc Deutsch B1 — Đề số 1', started_at: '2026-11-05T08:00:00Z', finished_at: '2026-11-05T10:30:00Z', total_score: 52, status: 'COMPLETED' },
    { id: 902, exam_id: 1, exam_title: 'Goethe A1 — Set 1', started_at: '2026-10-01T08:00:00Z', finished_at: '2026-10-01T09:00:00Z', total_score: 70, status: 'COMPLETED' },
  ])
  h.planGet.mockResolvedValue(planWith(DAYS))
  h.listResults.mockResolvedValue({ data: [] })
  h.seenTours.mockResolvedValue(new Set(['exam.today']))
  h.diagGet.mockResolvedValue({ status: 'DONE' })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Luyện thi · Hôm nay', () => {
  it('thẻ Hôm nay theo lịch tuần, bốn kỹ năng, bảy buổi, đề telc (Goethe ẩn)', async () => {
    setup()
    render(<V2StudentExamHubPage />)

    const title = await screen.findByRole('heading', { level: 2, name: 'Lesen · Teil 2' })
    expect(screen.getByText('Lần luyện gần nhất đúng 40%.')).toBeInTheDocument()
    expect(screen.getByText('Hôm nay · 35 phút')).toBeInTheDocument()
    const card = title.closest('div')!.parentElement as HTMLElement
    expect(within(card).getByRole('link', { name: /Bắt đầu/ })).toHaveAttribute('href', '/v2/student/mock-exam/practice/teil?examId=101&teil=LESEN-2')
    expect(screen.getByText('30 ngày')).toBeInTheDocument()

    // Lesen = (25 + 10) / 50
    const lesen = screen.getByRole('button', { name: /Lesen.*70%/ })
    expect(lesen).toHaveAttribute('aria-expanded', 'false')

    const week = screen.getByRole('heading', { name: 'Tuần này' }).closest('section') as HTMLElement
    expect(within(week).getAllByRole('listitem')).toHaveLength(7)
    // buổi đã làm không phải nút; buổi chưa làm là nút đổi chỗ được
    expect(within(week).getByRole('group', { name: /Hören T1 · đã làm/ })).toBeInTheDocument()
    expect(within(week).getByRole('button', { name: /Sprechen T3/ })).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /telc Deutsch B1 — Đề số 1/ })).toHaveAttribute('href', '/v2/student/mock-exam/practice?examId=101')
    // ba Teil có trong đề = 75 điểm, ngưỡng 60% = 45; lần thi thử 52 ⇒ Đỗ
    expect(within(screen.getByRole('link', { name: /Đề số 1/ })).getByText('Đỗ')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Đề số 2/ })).toBeNull()
    expect(screen.getByText('Sắp có')).toBeInTheDocument()
    expect(screen.queryByText('Goethe A1 — Set 1')).toBeNull()
    expect(h.getMockPack).not.toHaveBeenCalledWith(1)
  })

  it('bấm kỹ năng mở điểm từng Teil và nút luyện Teil yếu nhất', async () => {
    setup()
    const user = userEvent.setup()
    render(<V2StudentExamHubPage />)
    const lesen = await screen.findByRole('button', { name: /Lesen.*70%/ })
    await user.click(lesen)
    expect(lesen).toHaveAttribute('aria-expanded', 'true')
    const panel = document.getElementById(lesen.getAttribute('aria-controls')!) as HTMLElement
    expect(within(panel).getByText('40%')).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Luyện Lesen T2' })).toHaveAttribute('href', '/v2/student/mock-exam/practice/teil?examId=101&teil=LESEN-2')
  })

  it('bấm hai buổi ⇒ gọi API đổi chỗ, thẻ Hôm nay đổi theo lịch máy chủ trả về', async () => {
    setup()
    const swapped = DAYS.map((d) => ({ ...d }))
    Object.assign(swapped[1], { kind: 'ORAL_DRILL', section: 'SPRECHEN', teil: 3, minutes: 15 })
    Object.assign(swapped[2], { kind: 'TEIL', section: 'LESEN', teil: 2, minutes: 35 })
    h.swapDays.mockResolvedValue(planWith(swapped))
    const user = userEvent.setup()
    render(<V2StudentExamHubPage />)

    const week = (await screen.findByRole('heading', { name: 'Tuần này' })).closest('section') as HTMLElement
    const drill = within(week).getByRole('button', { name: /Sprechen T3/ })
    await user.click(drill)
    expect(drill).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(week).getByRole('button', { name: /Lesen T2/ }))

    expect(h.swapDays).toHaveBeenCalledWith(2, day(1), day(0))
    expect(await screen.findByRole('heading', { level: 2, name: 'Sprechen · Teil 3' })).toBeInTheDocument()
  })

  it('chưa có ngày thi: gợi ý Teil yếu nhất, ô đặt ngày thi gọi API', async () => {
    setup()
    h.planGet.mockResolvedValue({ status: 'NEEDS_DATE', provider: 'TELC', level: 'B1', warnings: [], weeks: [] })
    h.updateTargetDate.mockResolvedValue(planWith(DAYS))
    const user = userEvent.setup()
    const { container } = render(<V2StudentExamHubPage />)

    // Hören chưa luyện (–) đứng trước Lesen 70% ⇒ gợi ý Hören Teil 1
    expect(await screen.findByRole('heading', { level: 2, name: 'Hören · Teil 1' })).toBeInTheDocument()
    expect(screen.getByText('Bắt đầu từ một Teil chưa luyện.')).toBeInTheDocument()
    expect(screen.getByText('Chưa có ngày thi')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Tuần này' })).toBeNull()

    const input = container.querySelector('input[type="date"]') as HTMLInputElement
    await user.type(input, day(40))
    await user.click(screen.getByRole('button', { name: 'Lưu ngày thi' }))
    expect(h.updateTargetDate).toHaveBeenCalledWith(day(40))
    expect(await screen.findByRole('heading', { name: 'Tuần này' })).toBeInTheDocument()
  })

  it('cờ luyện thi tắt ⇒ báo chưa mở, không có thẻ Hôm nay', async () => {
    setup()
    h.getPracticeAccess.mockResolvedValue(false)
    render(<V2StudentExamHubPage />)

    expect(await screen.findByText(/chưa mở cho tài khoản này/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Bắt đầu/ })).toBeNull()
  })

  it('đã quen màn: nút gợi ý dưới thẻ Hôm nay (Teil yếu kế tiếp, thi thử sắp tới)', async () => {
    setup()
    render(<V2StudentExamHubPage />)
    const nav = await screen.findByRole('navigation', { name: 'Gợi ý' })
    // Hören T1 chưa luyện là Teil yếu kế tiếp (Lesen T2 đang ở thẻ Hôm nay); thi thử 2 ngày nữa
    expect(within(nav).getByRole('link', { name: /Hören T1/ })).toHaveAttribute('href', '/v2/student/mock-exam/practice/teil?examId=101&teil=HOEREN-1')
    expect(within(nav).getByRole('link', { name: /Thi thử/ })).toHaveAttribute('href', '/v2/student/mock-exam/full?examId=101')
  })

  it('lần đầu vào màn: hướng dẫn tự mở và đánh dấu đã xem theo tài khoản', async () => {
    setup()
    h.seenTours.mockResolvedValue(new Set())
    const rects = Element.prototype.getClientRects
    Element.prototype.getClientRects = function () {
      return [{}] as unknown as DOMRectList
    }
    try {
      render(<V2StudentExamHubPage />)
      const dialog = await screen.findByRole('dialog', {}, { timeout: 3000 })
      expect(dialog).toHaveTextContent('Việc của hôm nay')
      expect(h.markTourSeen).toHaveBeenCalledWith('exam.today')
    } finally {
      Element.prototype.getClientRects = rects
    }
  })

  it('người mới (chưa chẩn đoán, chưa có ngày thi): chỉ thẻ bài chẩn đoán, không thẻ Hôm nay, không ô ngày thi', async () => {
    setup()
    h.diagGet.mockResolvedValue({ status: 'NONE' })
    h.planGet.mockResolvedValue({ status: 'NEEDS_DATE', provider: 'TELC', level: 'B1', warnings: [], weeks: [] })
    render(<V2StudentExamHubPage />)
    expect(await screen.findByText('Làm bài chẩn đoán')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Bắt đầu/ })).toHaveAttribute('href', '/v2/student/exam/diagnostic')
    expect(screen.queryByText('Chưa có ngày thi')).toBeNull()
    expect(screen.queryByRole('heading', { level: 2, name: /Teil/ })).toBeNull()
    // đã quen màn nhưng là người mới ⇒ vẫn không có nút gợi ý
    expect(screen.queryByRole('navigation', { name: 'Gợi ý' })).toBeNull()
  })

  it('bài chẩn đoán đang dở ⇒ "Làm tiếp"', async () => {
    setup()
    h.diagGet.mockResolvedValue({ status: 'IN_PROGRESS' })
    render(<V2StudentExamHubPage />)
    expect(await screen.findByText('Bài chẩn đoán đang làm dở')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Làm tiếp/ })).toHaveAttribute('href', '/v2/student/exam/diagnostic')
  })
})
