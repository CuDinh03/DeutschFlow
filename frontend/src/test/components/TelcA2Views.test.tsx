/**
 * telc A2 (đợt 4) — màn làm đề của học viên: Lesen Teil 2 richtig/falsch, Schreiben Teil 1 form 5 ô (khoá
 * `form_<i>`, không lộ đáp án), Schreiben Teil 2 tin nhắn ngắn (chọn 3 trong 4 ý, ~40 từ).
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi'))

import { ObjectiveTeilView } from '@/components/exam/practice/ObjectiveTeilView'
import { FormTeilView } from '@/components/exam/practice/FormTeilView'
import { WritingTeilView } from '@/components/exam/practice/WritingTeilView'
import { displayedPoints, type PracticeTeilData } from '@/components/exam/practice/practiceModel'

describe('Lesen A2 Teil 2 — TRUE_FALSE', () => {
  it('câu không khai options vẫn có hai lựa chọn Richtig/Falsch; bài in phía trên', async () => {
    const teil: PracticeTeilData = {
      teil: 2, type: 'TRUE_FALSE', title_de: 'Ein Wochenende in Wien', context: 'Liebe Mia, wir waren in Wien.',
      items: [{ id: 'LV2-6', question: 'Mia war in Wien.' }],
    }
    const onAnswer = vi.fn()
    render(<ObjectiveTeilView teil={teil} kind="mc" answers={{}} onAnswer={onAnswer} result={null} wide tips={null} />)
    expect(screen.getByText(/wir waren in Wien/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /Falsch/ }))
    expect(onAnswer).toHaveBeenCalledWith('LV2-6', 'falsch')
  })
})

describe('Schreiben A2 Teil 1 — FILL_FORM', () => {
  const teil: PracticeTeilData = {
    teil: 1, type: 'FILL_FORM', context: 'Anna Berg wohnt in Graz. Ihre Telefonnummer ist 0316 4455.',
    form_title: 'Anmeldung Schwimmkurs',
    form_fields: [{ field: 'Name' }, { field: 'Telefon' }],
  }
  it('hiện đoạn văn, tên form, ô theo field; gõ vào ô gửi khoá form_<i>', async () => {
    const onAnswer = vi.fn()
    render(<FormTeilView teil={teil} answers={{}} onAnswer={onAnswer} wide />)
    expect(screen.getByText(/Anna Berg wohnt in Graz/)).toBeInTheDocument()
    expect(screen.getByText('Anmeldung Schwimmkurs')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/Telefon/), '0')
    expect(onAnswer).toHaveBeenLastCalledWith('form_1', '0')
    expect(screen.getByText(/ô có số/)).toBeInTheDocument()
  })
  it('xem lại: hiện đúng/sai và đáp án khi có kết quả', () => {
    render(<FormTeilView teil={teil} answers={{ form_0: 'Ana Berg' }} onAnswer={vi.fn()} wide readOnly
      results={[{ given: 'Ana Berg', answer: 'Anna Berg', isCorrect: true }, { given: null, answer: '0316 4455', isCorrect: false }]} />)
    expect(screen.getByText('Đúng')).toBeInTheDocument()
    expect(screen.getByText(/đáp án: 0316 4455/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Name/)).toHaveAttribute('readonly')
  })
})

describe('Schreiben A2 Teil 2 — WRITE_NOTE', () => {
  it('tình huống, "Chọn 3 trong 4 ý", mục tiêu 40 từ', () => {
    const teil: PracticeTeilData = {
      teil: 2, type: 'WRITE_NOTE', prompt: 'Sie können heute nicht zum Kurs kommen.',
      writing_points: ['Grund', 'Entschuldigung', 'neuer Termin', 'Hausaufgaben'], choose_points: 3, word_target: 40,
    }
    const ref = React.createRef<HTMLTextAreaElement>()
    render(<WritingTeilView teil={teil} points={displayedPoints(teil.writing_points, false)} text="" onText={vi.fn()}
      ticks={{}} onTick={vi.fn()} wide tips={null} textareaRef={ref} />)
    expect(screen.getByText('Sie können heute nicht zum Kurs kommen.')).toBeInTheDocument()
    expect(screen.getByText(/Chọn 3 trong 4 ý/)).toBeInTheDocument()
    expect(screen.getByText(/khoảng 40 từ/)).toBeInTheDocument()
    expect(screen.getAllByText(/40/).length).toBeGreaterThan(1) // + bộ đếm "/ 40 từ"
  })
})
