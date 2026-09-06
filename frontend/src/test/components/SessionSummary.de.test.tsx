/**
 * i18n đợt 3 (audit UTF-8/i18n 06/09/2026, F-I18N-02): SessionSummary đọc catalog
 * `v2.student.sessionSummary` thay chuỗi Việt cứng. Render với locale `de` (mock next-intl đọc catalog
 * THẬT) phải ra tiêu đề/khối/nút tiếng Đức, kể cả khoá nội suy {n}/{min}/{words} và nhãn hành động
 * tra theo mã next_steps. Props như SessionSummary.test.tsx (bản vi).
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SessionSummary } from '@/components/features/ai-speaking/SessionSummary'
import type { ChatMessage } from '@/stores/useChatStore'
import type { ConversationReport } from '@/lib/aiSpeakingApi'

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('de'))

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

const baseProps = { duration: '01:31', onRestart: () => {}, onExit: () => {} }

describe('SessionSummary — locale de đọc catalog v2.student.sessionSummary', () => {
  it('COMMUNICATION có report: tiêu đề, điểm /10, các khối nhận xét và nút hành động bằng tiếng Đức', () => {
    render(
      <SessionSummary {...baseProps} messages={userTurns(3)} isInterviewMode={false} conversationReport={fullReport} />,
    )
    expect(screen.getByText('Sprechübung beendet!')).toBeInTheDocument()
    expect(screen.getByText('Punkte / 10')).toBeInTheDocument()
    expect(screen.getByText('Stärken')).toBeInTheDocument()
    expect(screen.getByText('Verbesserungsbedarf')).toBeInTheDocument()
    expect(screen.getByText('Grammatik')).toBeInTheDocument()
    expect(screen.getByText('Als Nächstes üben')).toBeInTheDocument()
    expect(screen.getByText('Dauer')).toBeInTheDocument()
    expect(screen.getByText('Noch einmal üben')).toBeInTheDocument()
    expect(screen.getByText('Zur Startseite')).toBeInTheDocument()
    // Không còn chữ Việt cứng lọt sang locale khác
    expect(screen.queryByText('điểm / 10')).toBeNull()
    expect(screen.queryByText('Buổi luyện nói kết thúc!')).toBeNull()
    expect(screen.queryByText('Về trang chủ')).toBeNull()
  })

  it('INTERVIEW INSUFFICIENT_DATA: tiêu đề + thân nội suy {n}/{min}/{words} bằng tiếng Đức', () => {
    const statusJson = JSON.stringify({
      type: 'INSUFFICIENT_DATA', user_turns: 1, user_words: 12, min_turns: 2, min_words: 30,
    })
    render(
      <SessionSummary {...baseProps} messages={userTurns(1)} isInterviewMode={true} interviewReportJson={statusJson} />,
    )
    expect(screen.getByText('Interview beendet!')).toBeInTheDocument()
    expect(screen.getByText('Das Interview wurde zu früh beendet')).toBeInTheDocument()
    expect(
      screen.getByText(/Du hast bisher erst 1 Antworten gegeben\. Gib mindestens 2 Antworten \(etwa 30 Wörter oder mehr\)/),
    ).toBeInTheDocument()
    expect(screen.queryByText('Buổi phỏng vấn kết thúc quá sớm')).toBeNull()
  })

  it('Đợt D next_steps: nhãn hành động tra catalog theo mã (RETRY_SAME_POSITION) + khối "Nên nói" tiếng Đức', () => {
    const interviewJson = JSON.stringify({
      overall_score: '5.5/10', verdict: 'CONDITIONAL_PASS', verdict_label_vi: 'Đạt có điều kiện',
      categories: [{ name_vi: 'A', score: 5 }],
      next_steps: [{ code: 'RETRY_SAME_POSITION', reason_vi: 'x' }],
      answer_upgrades: [{ original_quote: 'Ich weiß nicht.', better_de: 'Ich interessiere mich für diese Stelle, weil…' }],
    })
    render(
      <SessionSummary {...baseProps} messages={userTurns(4)} isInterviewMode={true} interviewReportJson={interviewJson} />,
    )
    expect(screen.getByText('Deine nächsten Schritte')).toBeInTheDocument()
    expect(screen.getByText(/Interview für diese Stelle wiederholen/)).toBeInTheDocument()
    expect(screen.getByText('So sagst du es besser')).toBeInTheDocument()
    expect(screen.getByText('Du hast gesagt:')).toBeInTheDocument() // matcher mặc định trim khoảng trắng cuối
    expect(screen.getByText('Detaillierte Bewertung (KI)')).toBeInTheDocument()
  })
})
