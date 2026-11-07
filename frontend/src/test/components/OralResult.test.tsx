/**
 * Kết quả thi thử phần nói (Đợt 3 phòng thi nói, mẫu 07/11/2026): tiêu đề là kết luận theo ngưỡng
 * riêng phần nói, nhãn "Ước tính", điểm từng Teil + tiêu chí chung, "Xem lại hội thoại" (lời đã lưu +
 * lỗi theo Teil), phiếu chi tiết thu gọn, nút về nơi đã vào.
 */
import React from 'react'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import studentVi from '../../../messages/v2/student.vi.json'
import { OralResult } from '@/components/features/exam-speaking/OralResult'
import type { BlueprintSummary, ExamResultView } from '@/types/exam-speaking'

const api = vi.hoisted(() => ({ getTranscript: vi.fn() }))
vi.mock('@/lib/examSpeakingApi', () => ({ examSpeakingApi: api }))

const BP = {
  id: 9, provider: 'TELC', level: 'B1', version: 1, title: 'telc B1', prepSec: 1200, rubricScale: 'A_D', maxTotal: 75, speakingOnlyMin: 45,
  parts: [
    { teilNo: 1, archetype: 'CONTACT', title: 'Kontakt aufnehmen', durationSec: 180, flow: 'PAIR', hasPartner: true },
    { teilNo: 2, archetype: 'DEBATE', title: 'Über ein Thema sprechen', durationSec: 300, flow: 'PAIR', hasPartner: true },
    { teilNo: 3, archetype: 'PLAN', title: 'Gemeinsam etwas planen', durationSec: 360, flow: 'PAIR', hasPartner: true },
  ],
} as BlueprintSummary

function result(total: number, passed: boolean | null, extra: Partial<ExamResultView> = {}): ExamResultView {
  return {
    sessionId: 801, provider: 'TELC', level: 'B1', rubricVersion: 1, total, totalLow: total - 3, totalHigh: total + 3, max: 75, passed,
    createdAt: '2026-11-07T10:00:00Z',
    scoreSheet: {
      rubricRef: { provider: 'TELC', level: 'B1', version: 1 },
      parts: [
        { teilNo: 1, criteria: [], points: 11, max: 15, zeroed: false, comment: 'Hỏi lại được, thiếu câu hỏi mở' },
        { teilNo: 2, criteria: [], points: 17, max: 30, zeroed: false, comment: null },
        { teilNo: 3, criteria: [], points: 10, max: 15, zeroed: true, comment: null },
      ],
      global: [{ code: 'AUSSPRACHE', label: 'Aussprache und Intonation', band: 'B', points: 10, max: 15, scored: true, confidence: 'high', evidence: [] }],
      total, totalLow: total - 3, totalHigh: total + 3, maxPoints: 75, officialMax: 75, passed, passRule: '', errors: [
        { code: 'WORD_ORDER.V2_MAIN_CLAUSE', original: 'Ich morgen komme', correction: 'Ich komme morgen', severity: 'MAJOR', teilNo: 2 },
      ],
      notes: [], passes: 2,
    },
    ...extra,
  }
}

function renderResult(r: ExamResultView, bp: BlueprintSummary | null = BP, returnHref = '/v2/student/exam') {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...studentVi } }}>
      <OralResult result={r} blueprint={bp} sessionId={801} againHref="/v2/student/mock-exam/oral?mode=MOCK" returnHref={returnHref} />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('Kết quả thi thử phần nói', () => {
  it('đỗ: tiêu đề nói hơn ngưỡng bao nhiêu, nhãn Ước tính, cần 45, khoảng điểm', () => {
    renderResult(result(48, true))
    expect(screen.getByTestId('oral-result-title').textContent).toBe('Đỗ phần nói, hơn ngưỡng 3 điểm')
    const score = screen.getByTestId('oral-result-score')
    expect(score.textContent).toContain('48')
    expect(score.textContent).toContain('/ 75')
    expect(screen.getByTestId('oral-result-status').textContent).toContain('Ước tính · Đỗ')
    expect(screen.getByTestId('oral-result-status').textContent).toContain('cần 45')
    expect(score.textContent).toContain('45–51')
    expect(score.textContent).toContain('không phải điểm chính thức')
  })

  it('chưa đỗ / sát ngưỡng / không có ngưỡng riêng', () => {
    const { unmount } = renderResult(result(40, false))
    expect(screen.getByTestId('oral-result-title').textContent).toBe('Chưa đỗ phần nói, còn thiếu 5 điểm')
    unmount()
    const b = renderResult(result(44, false, { borderline: true }))
    expect(screen.getByTestId('oral-result-title').textContent).toBe('Phần nói sát ngưỡng đỗ')
    expect(screen.getByTestId('oral-result-status').textContent).toContain('Sát ngưỡng')
    b.unmount()
    renderResult({ ...result(20, null), provider: 'GOETHE', level: 'A1', max: 25 }, null)
    expect(screen.getByTestId('oral-result-title').textContent).toBe('Phần nói: 20/25 điểm')
    expect(screen.getByTestId('oral-result-status').textContent).not.toContain('cần')
  })

  it('điểm từng Teil có tên Teil + nhận xét; Teil tính 0 ghi rõ; tiêu chí chung (phát âm)', () => {
    renderResult(result(48, true))
    const t1 = screen.getByTestId('oral-result-teil-1')
    expect(t1.textContent).toContain('Teil 1 · Kontakt aufnehmen')
    expect(t1.textContent).toContain('Hỏi lại được, thiếu câu hỏi mở')
    expect(t1.textContent).toContain('11/15')
    expect(screen.getByTestId('oral-result-teil-3').textContent).toContain('cả Teil tính 0')
    expect(screen.getByTestId('oral-result-global-AUSSPRACHE').textContent).toContain('Aussprache und Intonation')
    expect(screen.getByTestId('oral-result-global-AUSSPRACHE').textContent).toContain('10/15')
  })

  it('Xem lại hội thoại: tải lời đã lưu, có vạch Teil và lỗi cần sửa theo Teil', async () => {
    api.getTranscript.mockResolvedValue({
      data: [
        { teilNo: 1, seq: 0, role: 'PRUEFER', text: 'Teil 1: Stellen Sie sich vor.', eval: null },
        { teilNo: 1, seq: 1, role: 'CANDIDATE', text: 'Ich heiße Minh.', eval: null },
        { teilNo: 2, seq: 2, role: 'PARTNER', text: 'Was denkst du?', eval: null },
      ],
    })
    const user = userEvent.setup()
    renderResult(result(48, true))
    await user.click(screen.getByTestId('review-open'))
    await waitFor(() => expect(api.getTranscript).toHaveBeenCalledWith(801))
    const panel = await screen.findByTestId('review-panel')
    expect(within(panel).getAllByTestId('transcript-teil')).toHaveLength(2)
    expect(panel.textContent).toContain('Ich heiße Minh.')
    const errors = within(panel).getByTestId('review-errors')
    expect(errors.textContent).toContain('Ich morgen komme')
    expect(errors.textContent).toContain('Ich komme morgen')
    expect(screen.getByTestId('review-open').textContent).toContain('Ẩn hội thoại')
  })

  it('tải hội thoại lỗi → báo lỗi, không vỡ màn', async () => {
    api.getTranscript.mockRejectedValue(new Error('net'))
    const user = userEvent.setup()
    renderResult(result(48, true))
    await user.click(screen.getByTestId('review-open'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được hội thoại')
  })

  it('phiếu chi tiết thu gọn; nút về đúng nơi đã vào', () => {
    renderResult(result(48, true))
    expect(screen.getByTestId('result-details')).not.toHaveAttribute('open')
    expect(within(screen.getByTestId('result-details')).getByTestId('ergebnisbogen')).toBeInTheDocument()
    expect(screen.getByTestId('room-back')).toHaveAttribute('href', '/v2/student/exam')
    expect(screen.getByTestId('room-back').textContent).toContain('Về hôm nay')
    expect(screen.getByTestId('room-again')).toHaveAttribute('href', '/v2/student/mock-exam/oral?mode=MOCK')
  })

  it('vào từ màn Đề → nút ghi "Quay lại"', () => {
    renderResult(result(48, true), BP, '/v2/student/mock-exam/practice?examId=7')
    expect(screen.getByTestId('room-back').textContent).toContain('Quay lại')
  })
})
