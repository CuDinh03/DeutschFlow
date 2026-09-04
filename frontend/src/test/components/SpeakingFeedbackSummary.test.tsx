/**
 * S-07 AC-3: "Feedback mặc định là tóm tắt; chi tiết chỉ mở khi yêu cầu."
 *
 * Phủ thêm hai ràng buộc không được phép trôi:
 *  · chiều nào KHÔNG có dữ liệu thật thì không render (S-14 — cùng lý do đã bỏ waveform giả);
 *  · mức không truyền chỉ bằng màu (plan §Accessibility) — mỗi mức phải có nhãn CHỮ.
 *
 * next-intl mock trả thẳng key (parity với các test component hiện có), nên khẳng định theo key.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SpeakingFeedbackSummary } from '@/components/features/ai-speaking/SpeakingFeedbackSummary'
import type { ErrorItem, Suggestion } from '@/lib/aiSpeakingApi'
import type { PhonemeEvalResult } from '@/lib/phonemeApi'

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))
// `next/dynamic` nạp bất đồng bộ nên bảng phoneme sẽ không có mặt ngay ở lượt render đầu; thay
// bằng stub để phép đo nói về hành vi mở/đóng bằng chứng chứ không về thời điểm nạp chunk.
vi.mock('next/dynamic', () => ({
  default: () =>
    function PhonemePanelStub() {
      return <div data-testid="phoneme-panel" />
    },
}))

const err = (errorCode: string, severity = 'MAJOR'): ErrorItem => ({
  errorCode,
  severity,
  confidence: 0.9,
  wrongSpan: 'ich habe gegangen',
  correctedSpan: 'ich bin gegangen',
  ruleViShort: 'Động từ chuyển động dùng sein.',
  exampleCorrectDe: 'Ich bin nach Hause gegangen.',
})

const suggestion: Suggestion = {
  german_text: 'Mir geht es gut.',
  vietnamese_translation: 'Tôi khoẻ.',
  level: 'A2',
  why_to_use: 'Ngắn và an toàn.',
  usage_context: 'Chào hỏi',
  lego_structure: 'S+V',
}

const phoneme: PhonemeEvalResult = {
  transcribed: 'hallo',
  target: 'hallo',
  score: 42,
  emoji: '😕',
  feedbackVi: 'Cần rõ âm cuối.',
  words: [{ word: 'hallo', correct: false, similarity: 0.4 }],
} as PhonemeEvalResult

const base = {
  analysedErrors: undefined,
  suggestions: [],
  suggestionsVisible: false,
  phonemeResult: null,
  turnStatus: null,
  turnNote: null,
  onSuggestionSelect: () => {},
}

describe('SpeakingFeedbackSummary — tóm tắt trước, bằng chứng sau', () => {
  it('không có chiều nào có dữ liệu thì không render gì', () => {
    const { container } = render(<SpeakingFeedbackSummary {...base} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('mặc định chỉ hiện tóm tắt — span sai/đúng NẰM NGOÀI màn hình cho tới khi yêu cầu', () => {
    render(<SpeakingFeedbackSummary {...base} analysedErrors={[err('VERB.PERFEKT_AUX')]} />)

    expect(screen.getByText('fbGrammarIssues')).toBeInTheDocument()
    expect(screen.queryByText(/ich habe gegangen/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Động từ chuyển động dùng sein/)).not.toBeInTheDocument()
  })

  it('bấm "xem bằng chứng" mới mở chi tiết, và nút khai đúng trạng thái cho screen reader', async () => {
    const user = userEvent.setup()
    render(<SpeakingFeedbackSummary {...base} analysedErrors={[err('VERB.PERFEKT_AUX')]} />)

    const toggle = screen.getByRole('button', { name: /showEvidence/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)

    expect(screen.getByText(/ich bin gegangen/)).toBeInTheDocument()
    expect(screen.getByText(/Động từ chuyển động dùng sein/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hideEvidence/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('mức có nhãn CHỮ, không chỉ dựa vào màu', () => {
    render(<SpeakingFeedbackSummary {...base} analysedErrors={[]} />)
    expect(screen.getByText('level.good')).toBeInTheDocument()
  })

  it('chưa chấm phát âm thì không dựng chiều phát âm', () => {
    render(<SpeakingFeedbackSummary {...base} analysedErrors={[]} suggestions={[suggestion]} suggestionsVisible />)
    expect(screen.queryByText('dimension.pronunciation')).not.toBeInTheDocument()
    expect(screen.getByText('dimension.grammar')).toBeInTheDocument()
  })

  it('có kết quả phát âm thì bằng chứng là bảng phoneme, vẫn nằm sau nút mở', async () => {
    const user = userEvent.setup()
    render(<SpeakingFeedbackSummary {...base} phonemeResult={phoneme} />)

    expect(screen.queryByTestId('phoneme-panel')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /showEvidence/ }))
    expect(screen.getByTestId('phoneme-panel')).toBeInTheDocument()
  })

  it('bấm một câu gợi ý thì trả đúng câu đó về cho phiên', async () => {
    const user = userEvent.setup()
    const onSuggestionSelect = vi.fn()
    render(
      <SpeakingFeedbackSummary
        {...base}
        analysedErrors={[]}
        suggestions={[suggestion]}
        suggestionsVisible
        onSuggestionSelect={onSuggestionSelect}
      />,
    )

    await user.click(screen.getByRole('button', { name: /showEvidence/ }))
    await user.click(screen.getByRole('button', { name: /Mir geht es gut/ }))

    expect(onSuggestionSelect).toHaveBeenCalledWith('Mir geht es gut.')
  })

  it('xếp chiều cần sửa lên đầu danh sách', () => {
    render(
      <SpeakingFeedbackSummary
        {...base}
        analysedErrors={[]}
        phonemeResult={phoneme}
        turnStatus="EXCELLENT"
      />,
    )
    const labels = screen.getAllByText(/^dimension\./).map((n) => n.textContent)
    expect(labels[0]).toBe('dimension.pronunciation')
  })
})
