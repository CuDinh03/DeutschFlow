/** Xưởng đề — TeilPreview Lesen T1: 5 văn bản đánh số + bảng tiêu đề a–j; chế độ admin đánh dấu đáp án. */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminContentVi from '../../../messages/v2/adminContent.vi.json'
import { TeilPreview, type PreviewItem } from '@/components/admin/exam-studio/TeilPreview'

const text = { titleDe: '', vorspannDe: '', context: 'Erster Text\n\nZweiter Text', glossary: [] }
const items: PreviewItem[] = [
  { id: 'LV1-1', question: 'Text 1', options: { a: 'Eins', c: 'Drei' }, correct: 'a', explanationVi: 'Giải thích 1' },
  { id: 'LV1-2', question: 'Text 2', options: { b: 'Zwei', d: 'Vier' }, correct: 'b' },
]

function renderPreview(showAnswers: boolean) {
  render(
    <NextIntlClientProvider locale="vi" messages={{ v2: adminContentVi }}>
      <TeilPreview layout="MATCH_HEADLINE" text={text} items={items} showAnswers={showAnswers} />
    </NextIntlClientProvider>,
  )
}

describe('TeilPreview MATCH_HEADLINE', () => {
  it('như học viên: văn bản + 4 tiêu đề xếp a–d, không lộ đáp án', () => {
    renderPreview(false)
    expect(screen.getByText('Erster Text')).toBeInTheDocument()
    expect(screen.getByText('Zweiter Text')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((li) => li.textContent).filter((x) => /^[a-d]/.test(x ?? '')))
      .toEqual(['aEins', 'bZwei', 'cDrei', 'dVier'])
    expect(screen.queryByText(/Đáp án:/)).not.toBeInTheDocument()
  })
  it('chế độ admin: đáp án từng văn bản + giải thích', () => {
    renderPreview(true)
    expect(screen.getByText('Đáp án: a — Eins')).toBeInTheDocument()
    expect(screen.getByText('Giải thích 1')).toBeInTheDocument()
  })
})
