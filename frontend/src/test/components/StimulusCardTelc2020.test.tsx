/**
 * Thẻ đề thi Nói telc B1 dạng 2020 (Gói D, 17/09/2026):
 *   1. TOPIC_OPINION_PAIR: chủ đề + trích dẫn + người nói (tên, tuổi, nghề); partnerOpinion không lộ dù
 *      có lọt tới client.
 *   2. TASK_SITUATION: trước đây rơi xuống thẻ khoá–giá trị thô; nay dựng như thẻ tình huống và in
 *      câu lệnh bốn bước của đề thật thay cho gợi ý chung.
 * Catalog vi THẬT — thiếu khoá i18n là đỏ.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import studentVi from '../../../messages/v2/student.vi.json'
import { StimulusCard } from '@/components/features/exam-speaking/StimulusCard'

function renderCard(stimulus: Record<string, unknown>) {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...studentVi } }}>
      <StimulusCard stimulus={stimulus} stepIndex={0} candidateAction="SPEAK" />
    </NextIntlClientProvider>,
  )
}

describe('StimulusCard — thẻ ý kiến trái chiều (TOPIC_OPINION_PAIR)', () => {
  const card = {
    type: 'TOPIC_OPINION_PAIR',
    thema: 'Haustiere in der Wohnung',
    instruction: 'Berichten Sie kurz, was diese Person meint.',
    candidateOpinion: { name: 'Sophie Berger', age: 27, job: 'Verkäuferin', quote: 'Mein Hund macht mich glücklich.' },
    partnerOpinion: { name: 'Markus Weiß', age: 52, job: 'Steuerberater', quote: 'GEHEIM' },
  }

  it('in chủ đề, trích dẫn trong ngoặc kép Đức và dòng người nói „Tên, tuổi, nghề"', () => {
    renderCard(card)
    expect(screen.getByTestId('stimulus-opinion-card')).toBeInTheDocument()
    expect(screen.getByText('Haustiere in der Wohnung')).toBeInTheDocument()
    expect(screen.getByText('„Mein Hund macht mich glücklich.“')).toBeInTheDocument()
    expect(screen.getByText('— Sophie Berger, 27, Verkäuferin')).toBeInTheDocument()
    expect(screen.getByText('Berichten Sie kurz, was diese Person meint.')).toBeInTheDocument()
    expect(screen.getByText('Thẻ ý kiến của bạn')).toBeInTheDocument()
  })

  it('ý kiến của bạn thi KHÔNG BAO GIỜ hiện, kể cả khi server lỡ gửi', () => {
    const { container } = renderCard(card)
    expect(container.textContent).not.toContain('GEHEIM')
    expect(container.textContent).not.toContain('Markus')
  })

  it('không có instruction thì in gợi ý chung từ catalog', () => {
    renderCard({ ...card, instruction: undefined })
    expect(screen.getByText(/Thuật lại ý kiến này cho bạn thi/)).toBeInTheDocument()
  })
})

describe('StimulusCard — tình huống Teil 3 telc (TASK_SITUATION)', () => {
  it('dựng như thẻ tình huống với Zettel, và in câu lệnh bốn bước thay gợi ý chung', () => {
    renderCard({
      type: 'TASK_SITUATION',
      situation: 'Sie beide planen einen Fahrradausflug.',
      instruction: 'Entscheiden Sie zuerst, was zu tun ist. Einigen Sie sich, wer welche Aufgabe übernimmt.',
      prompts: ['Wohin und wie weit?', 'Wer übernimmt welche Aufgabe?'],
    })
    expect(screen.getByTestId('stimulus-planning-card')).toBeInTheDocument()
    expect(screen.getByText('Sie beide planen einen Fahrradausflug.')).toBeInTheDocument()
    expect(screen.getByText(/Wohin und wie weit\?/)).toBeInTheDocument()
    expect(screen.getByText(/Entscheiden Sie zuerst, was zu tun ist\./)).toBeInTheDocument()
    expect(screen.queryByText('Đề xuất, phản hồi đề xuất của bạn thi và cùng quyết định từng điểm.')).toBeNull()
  })

  it('HỒI QUY: PLANNING_CARD của Goethe không có instruction vẫn in gợi ý chung', () => {
    renderCard({ type: 'PLANNING_CARD', situation: 'Abschlussfeier', prompts: ['Wann?'] })
    expect(screen.getByText('Đề xuất, phản hồi đề xuất của bạn thi và cùng quyết định từng điểm.')).toBeInTheDocument()
  })
})
