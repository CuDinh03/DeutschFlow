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
