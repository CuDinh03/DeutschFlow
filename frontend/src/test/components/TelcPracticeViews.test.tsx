/**
 * Luyện đề telc (03/11/2026) — thao tác owner chốt (phương án A): chạm câu → chạm đáp án; lựa chọn
 * của kho dùng một lần (chọn lại thì chuyển sang câu đang chọn); kiểm tra xong mỗi câu có đủ vì sao
 * sai / vì sao đúng / dấu hiệu; bài Viết chấm xong chỉ lỗi ngay trong bài.
 */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi'))

import { ObjectiveTeilView } from '@/components/exam/practice/ObjectiveTeilView'
import { WritingResultView } from '@/components/exam/practice/WritingResultView'
import { displayedPoints, type PracticeTeilData } from '@/components/exam/practice/practiceModel'
import type { PracticeTeilResult, WritingEvaluation } from '@/lib/telcPracticeApi'

const teil: PracticeTeilData = {
  teil: 1,
  type: 'MATCH_HEADLINE',
  headlines: { a: 'Nachtbusse fahren länger', b: 'Busfahren wird teurer', c: 'Neue Bibliothek' },
  items: [
    { id: 'LV1-1', question: 'Text 1', text: 'Die Nachtbusse fahren jetzt die ganze Nacht.' },
    { id: 'LV1-2', question: 'Text 2', text: 'Die neue Bibliothek öffnet am Montag.' },
  ],
}

function Harness({ result = null }: { result?: PracticeTeilResult | null }) {
  const [answers, setAnswers] = React.useState<Record<string, string>>({})
  const onAnswer = (id: string, v: string | null) =>
    setAnswers((prev) => {
      const next = { ...prev }
      if (v == null) delete next[id]
      else next[id] = v
      return next
    })
  return (
    <>
      <ObjectiveTeilView teil={teil} kind="match" answers={answers} onAnswer={onAnswer} result={result} wide tips={null} />
      <output data-testid="answers">{JSON.stringify(answers)}</output>
    </>
  )
}

describe('Luyện đề telc — Teil khách quan', () => {
  it('chạm đáp án gán cho câu đang chọn rồi chuyển sang câu kế; chọn lại lựa chọn đã dùng thì nó chuyển câu', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.getByText('Chọn đáp án cho câu 1')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Busfahren wird teurer/ }))
    expect(screen.getByTestId('answers').textContent).toBe('{"LV1-1":"b"}')

    // câu 1 đã có đáp án ⇒ kho giờ dành cho câu 2, lựa chọn b ghi "ở câu 1"
    expect(screen.getByText('Chọn đáp án cho câu 2')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Busfahren wird teurer/ })).toHaveTextContent('ở câu 1')

    await user.click(screen.getByRole('radio', { name: /Busfahren wird teurer/ }))
    expect(screen.getByTestId('answers').textContent).toBe('{"LV1-2":"b"}')
  })

  it('sau khi kiểm tra: câu sai đầu tiên mở sẵn, có vì sao sai + bẫy + vì sao đúng + dấu hiệu tô trong bài', () => {
    const result: PracticeTeilResult = {
      teilKey: 'LESEN-1', type: 'MATCH_HEADLINE', score: 5, max: 10, correctCount: 1, total: 2, unusedOptions: [],
      items: [
        { id: 'LV1-1', label: '1', given: 'a', givenText: 'Nachtbusse fahren länger', correct: 'a', correctText: 'Nachtbusse fahren länger',
          answered: true, isCorrect: true, points: 5, whyRight: 'Xe buýt đêm.', whyWrong: null, trap: null, evidence: [], need: null, rule: null },
        { id: 'LV1-2', label: '2', given: 'b', givenText: 'Busfahren wird teurer', correct: 'c', correctText: 'Neue Bibliothek',
          answered: true, isCorrect: false, points: 5, whyRight: 'Bài nói thư viện mới mở.', whyWrong: 'Bài không nói chuyện giá vé.',
          trap: 'Bẫy cùng chủ đề', evidence: ['neue Bibliothek'], need: null, rule: null },
      ],
    }
    render(<Harness result={result} />)

    expect(screen.getByText('Đúng 1/2.')).toBeInTheDocument()
    expect(screen.getByText('Bài không nói chuyện giá vé.')).toBeInTheDocument()
    expect(screen.getByText('Bẫy cùng chủ đề')).toBeInTheDocument()
    expect(screen.getByText('Bài nói thư viện mới mở.')).toBeInTheDocument()
    const card = document.getElementById('pq-LV1-2')!
    expect(within(card).getByText('neue Bibliothek', { selector: 'mark' })).toBeInTheDocument()
  })
})

describe('Luyện đề telc — kết quả Viết', () => {
  const text = 'Hallo Lena, ich gratuliere dir zu der neuen Arbeit. Bis bald, Tim'
  const points = displayedPoints(['Gratulieren', 'Tipps', 'Besuch', 'Frage'], false)
  const evaluation: WritingEvaluation = {
    status: 'AI_EVALUATED', total: 33, max: 45,
    criteria: [
      { key: 'leitpunkte', score: 9, max: 15, band: 'B' },
      { key: 'kommunikative_gestaltung', score: 9, max: 15, band: 'B' },
      { key: 'formale_richtigkeit', score: 15, max: 15, band: 'A' },
    ],
    leitpunkte_fehlt: [4], kein_a_weil: ['UNVERBUNDEN'],
    annotations: [
      { quote: 'zu der neuen Arbeit', insertAfter: null, correction: 'zur neuen Arbeit', category: 'GRAMMATIK', kriterium: 'III', leitpunkt: null, whyVi: 'zu + der gộp thành zur.', ruleVi: 'zu + der → zur' },
      { quote: null, insertAfter: 'Arbeit.', correction: 'Was machst du dort?', category: 'INHALT', kriterium: 'I', leitpunkt: 4, whyVi: 'Thiếu câu hỏi.', ruleVi: '' },
    ],
    musterloesung: 'Hallo Lena, ich gratuliere dir zur neuen Arbeit. Was machst du dort?',
  }

  it('tô lỗi trong bài, chỗ thiếu ý gắn đúng nhãn P, bấm từng ghi chú để xem bạn viết → nên viết → vì sao', async () => {
    const user = userEvent.setup()
    render(<WritingResultView evaluation={evaluation} text={text} points={points} wide />)

    // Ô điểm (đợt (d)): nhãn Ước tính + một dòng điểm AI không phải điểm chính thức
    expect(screen.getByText('Ước tính · Đạt 60% của phần này')).toBeInTheDocument()
    expect(screen.getByText(/không phải điểm chính thức/)).toBeInTheDocument()
    expect(screen.getByText('zur neuen Arbeit')).toBeInTheDocument()
    expect(screen.getByText('zu + der gộp thành zur.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /thiếu P4 ở đây/ }))
    expect(screen.getByText('Was machst du dort?')).toBeInTheDocument()
    expect(screen.getByText('Thiếu câu hỏi.')).toBeInTheDocument()
    expect(screen.getByText(/câu rời rạc, thiếu từ nối/)).toBeInTheDocument()
  })
})
