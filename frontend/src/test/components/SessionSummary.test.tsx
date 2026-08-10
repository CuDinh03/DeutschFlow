/**
 * QA cho GR-1: SessionSummary render báo cáo AI THẬT (ConversationReport) cho COMMUNICATION/LESSON
 * thay điểm heuristic bịa. Phủ: có report đủ điểm, report rỗng, không report (degrade), min-turn
 * guard, và không đụng luồng INTERVIEW. next-intl mock trả key (parity các test hiện có).
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SessionSummary } from '@/components/features/ai-speaking/SessionSummary'
import type { ChatMessage } from '@/stores/useChatStore'
import type { ConversationReport } from '@/lib/aiSpeakingApi'

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))

const userTurns = (n: number): ChatMessage[] =>
  Array.from({ length: n }, (_, i) => ({ id: `u${i}`, role: 'user', contentDe: `Satz ${i}` })) as ChatMessage[]

const fullReport: ConversationReport = {
  sessionId: 1,
  topic: 'Alltag',
  levelEstimate: 'A2',
  overallScore: 7,
  summary: 'Bạn nói khá tốt.',
  strengths: ['Phát âm rõ ràng'],
  improvements: ['Chia động từ kỹ hơn'],
  grammarAccuracy: 'khoảng 80%',
  commonErrors: ['Sai giống danh từ'],
  vocabulary: 'Vốn từ ổn định',
  fluency: 'Nói khá trôi chảy',
  recommendedNext: ['Luyện chủ đề A2'],
  encouragement: 'Cố lên, bạn tiến bộ rồi!',
}

const emptyReport: ConversationReport = {
  sessionId: 2,
  topic: null,
  levelEstimate: null,
  overallScore: null,
  summary: null,
  strengths: [],
  improvements: [],
  grammarAccuracy: null,
  commonErrors: [],
  vocabulary: null,
  fluency: null,
  recommendedNext: [],
  encouragement: null,
}

const baseProps = { duration: '01:31', onRestart: () => {}, onExit: () => {} }

describe('SessionSummary — GR-1 báo cáo AI thật (COMMUNICATION/LESSON)', () => {
  it('có report + ≥3 lượt: hiện điểm /10 + nhận xét thật, KHÔNG hiện heuristic /100', () => {
    render(
      <SessionSummary {...baseProps} messages={userTurns(3)} isInterviewMode={false} conversationReport={fullReport} />,
    )
    expect(screen.getByText('điểm / 10')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('Bạn nói khá tốt.')).toBeInTheDocument()
    expect(screen.getByText('Phát âm rõ ràng')).toBeInTheDocument()
    expect(screen.getByText('khoảng 80%')).toBeInTheDocument()
    expect(screen.getByText('Cố lên, bạn tiến bộ rồi!')).toBeInTheDocument()
    // Không còn khối heuristic bịa
    expect(screen.queryByText('Tự đánh giá nhanh')).toBeNull()
    expect(screen.queryByText('/ 100')).toBeNull()
  })

  it('report rỗng (0 lượt server): hiện lời chúc mừng thay Card trống', () => {
    render(
      <SessionSummary {...baseProps} messages={userTurns(3)} isInterviewMode={false} conversationReport={emptyReport} />,
    )
    expect(screen.getByText(/Buổi luyện nói đã hoàn thành/)).toBeInTheDocument()
    expect(screen.queryByText('Tự đánh giá nhanh')).toBeNull()
  })

  it('KHÔNG có report + ≥3 lượt: rơi về heuristic "Tự đánh giá nhanh" (degrade an toàn)', () => {
    render(
      <SessionSummary {...baseProps} messages={userTurns(3)} isInterviewMode={false} conversationReport={null} />,
    )
    expect(screen.getByText('Tự đánh giá nhanh')).toBeInTheDocument()
  })

  it('có report + <3 lượt: ẩn điểm (min-turn guard) nhưng vẫn hiện nhận xét định tính', () => {
    render(
      <SessionSummary {...baseProps} messages={userTurns(1)} isInterviewMode={false} conversationReport={fullReport} />,
    )
    expect(screen.queryByText('điểm / 10')).toBeNull() // điểm bị ẩn dưới ngưỡng lượt
    expect(screen.getByText('Phát âm rõ ràng')).toBeInTheDocument() // nhận xét vẫn hữu ích
    expect(screen.queryByText('Chưa đủ để chấm điểm')).toBeNull() // block heuristic cũ bị siết
  })

  it('INTERVIEW có report AI: vòng tròn = điểm AI /10, KHÔNG còn heuristic /100 lẫn dòng "Đánh giá AI" phụ', () => {
    const interviewJson = JSON.stringify({
      overall_score: '5.5/10',
      verdict: 'CONDITIONAL_PASS',
      verdict_label_vi: 'Đạt có điều kiện',
      categories: [
        { name_vi: 'Cấu trúc & Sự cô đọng (Struktur & Prägnanz)', score: 6, red_flags_vi: ['Thiếu chi tiết'] },
        { name_vi: 'Kỹ năng chuyên môn (Fachkompetenz)', score: 5 },
      ],
    })
    render(
      <SessionSummary {...baseProps} messages={userTurns(2)} isInterviewMode={true} interviewReportJson={interviewJson} />,
    )
    expect(screen.getByText('5.5')).toBeInTheDocument()
    expect(screen.getByText('điểm / 10')).toBeInTheDocument()
    expect(screen.queryByText('/ 100')).toBeNull() // heuristic client-side không được đè lên điểm AI
    expect(screen.queryByText('Đánh giá AI:')).toBeNull() // hết dòng phụ trùng lặp
  })

  it('INTERVIEW overall_score không parse được: fallback trung bình category, vẫn không hiện /100', () => {
    const interviewJson = JSON.stringify({
      overall_score: 'Khá',
      verdict: 'PASS',
      verdict_label_vi: 'Đạt',
      categories: [
        { name_vi: 'A', score: 6 },
        { name_vi: 'B', score: 7 },
      ],
    })
    render(
      <SessionSummary {...baseProps} messages={userTurns(3)} isInterviewMode={true} interviewReportJson={interviewJson} />,
    )
    expect(screen.getByText('6.5')).toBeInTheDocument() // (6+7)/2
    expect(screen.queryByText('/ 100')).toBeNull()
  })

  it('INTERVIEW: không đụng — conversationReport bị bỏ qua, vẫn render đánh giá phỏng vấn', () => {
    const interviewJson = JSON.stringify({
      overall_score: '8/10',
      verdict: 'PASS',
      verdict_label_vi: 'Đạt',
      categories: [],
    })
    render(
      <SessionSummary
        {...baseProps}
        messages={userTurns(3)}
        isInterviewMode={true}
        interviewReportJson={interviewJson}
        conversationReport={fullReport}
      />,
    )
    expect(screen.queryByText('Bạn nói khá tốt.')).toBeNull() // report communication KHÔNG rò vào interview
    expect(screen.getByText(/Đạt/)).toBeInTheDocument() // verdict badge "✅ Đạt" (emoji cùng element)
  })
})

describe('SessionSummary — Đợt A 10/08: INTERVIEW không bao giờ hiện điểm bịa', () => {
  it('report INSUFFICIENT_DATA: nói thật "kết thúc quá sớm", không điểm /100, không Tự đánh giá nhanh', () => {
    const statusJson = JSON.stringify({
      type: 'INSUFFICIENT_DATA', user_turns: 1, user_words: 12, min_turns: 2, min_words: 30,
    })
    render(
      <SessionSummary {...baseProps} messages={userTurns(1)} isInterviewMode={true} interviewReportJson={statusJson} />,
    )
    expect(screen.getByText('Buổi phỏng vấn kết thúc quá sớm')).toBeInTheDocument()
    expect(screen.queryByText('/ 100')).toBeNull()
    expect(screen.queryByText('điểm / 10')).toBeNull()
    expect(screen.queryByText('Tự đánh giá nhanh')).toBeNull()
  })

  it('report EVAL_FAILED: hiện "Chưa chấm được phiên này" + gợi ý kết thúc lại, không điểm nào', () => {
    const statusJson = JSON.stringify({ type: 'EVAL_FAILED', failures: ['JSON cụt'] })
    render(
      <SessionSummary {...baseProps} messages={userTurns(5)} isInterviewMode={true} interviewReportJson={statusJson} />,
    )
    expect(screen.getByText('Chưa chấm được phiên này')).toBeInTheDocument()
    expect(screen.queryByText('/ 100')).toBeNull()
    expect(screen.queryByText('Tự đánh giá nhanh')).toBeNull()
  })

  it('INTERVIEW không có report (null) + đủ lượt: KHÔNG rơi về heuristic /100 như trước nữa', () => {
    render(
      <SessionSummary {...baseProps} messages={userTurns(5)} isInterviewMode={true} interviewReportJson={null} />,
    )
    expect(screen.getByText('Chưa chấm được phiên này')).toBeInTheDocument()
    expect(screen.queryByText('/ 100')).toBeNull()
    expect(screen.queryByText('Tự đánh giá nhanh')).toBeNull()
  })

  it('Đợt D: next_steps render nút hành động; answer_upgrades render cặp Bạn nói → Nên nói', () => {
    const interviewJson = JSON.stringify({
      overall_score: '5.5/10', verdict: 'CONDITIONAL_PASS', verdict_label_vi: 'Đạt có điều kiện',
      categories: [{ name_vi: 'A', score: 5 }],
      next_steps: [
        { code: 'RETRY_SAME_POSITION', reason_vi: 'Cần thêm ví dụ cụ thể ở Lượt 3' },
        { code: 'MÃ_LẠ_KHÔNG_RENDER', reason_vi: 'x' },
      ],
      answer_upgrades: [
        { original_quote: 'Ich weiß nicht.', better_de: 'Ich interessiere mich für diese Stelle, weil…' },
      ],
    })
    render(
      <SessionSummary {...baseProps} messages={userTurns(4)} isInterviewMode={true} interviewReportJson={interviewJson} />,
    )
    expect(screen.getByText('Bước tiếp theo cho bạn')).toBeInTheDocument()
    expect(screen.getByText(/Phỏng vấn lại vị trí này/)).toBeInTheDocument()
    expect(screen.getByText('Cần thêm ví dụ cụ thể ở Lượt 3')).toBeInTheDocument()
    expect(screen.queryByText(/MÃ_LẠ_KHÔNG_RENDER/)).toBeNull() // mã ngoài danh mục không render
    expect(screen.getByText('Nên nói thế nào')).toBeInTheDocument()
    expect(screen.getByText(/Ich interessiere mich für diese Stelle/)).toBeInTheDocument()
  })

  it('INTERVIEW report JSON hỏng (cụt): xử lý như chưa chấm được, không nổ render', () => {
    render(
      <SessionSummary {...baseProps} messages={userTurns(5)} isInterviewMode={true}
        interviewReportJson={'{"overall_score":"6/10","categories":[{"name_vi":"A"'} />,
    )
    expect(screen.getByText('Chưa chấm được phiên này')).toBeInTheDocument()
    expect(screen.queryByText('/ 100')).toBeNull()
  })
})
