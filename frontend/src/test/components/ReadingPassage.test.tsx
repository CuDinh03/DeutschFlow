/**
 * Bài đọc dài kiểu đề thật (LV Teil 2 telc, 17/09/2026): Vorspann in đậm, số dòng mỗi 5 dòng theo
 * dòng tác giả ngắt (không đếm dòng trống), chú thích từ khó. Đề Goethe không khai gì ⇒ không đi
 * nhánh này.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ReadingPassage, isRichPassage, passageLines } from '@/components/exam/telc/ReadingPassage'

vi.mock('next-intl', async () => {
  const { catalogT } = await import('@/test/intlCatalog')
  return { useTranslations: (ns?: string) => catalogT(ns, 'vi'), useLocale: () => 'vi' }
})

const teil = {
  title_de: 'Ehrenamt im Wandel',
  vorspann_de: 'Wer sich engagiert, tut das heute anders.',
  context_lines: true,
  context: ['Zeile eins', 'Zeile zwei', 'Zeile drei', 'Zeile vier', 'Zeile fünf', '', 'Zeile sechs', 'Zeile sieben', 'Zeile acht', 'Zeile neun', 'Zeile zehn', 'Zeile elf'].join('\n'),
  glossary: [{ term: 'Ehrenamt', explanation_de: 'freiwillige, unbezahlte Arbeit' }],
}

describe('bài đọc dài kiểu đề thật', () => {
  it('đề Goethe (chỉ có context) không đi nhánh này', () => {
    expect(isRichPassage({ context: 'Guten Tag.' })).toBe(false)
    expect(isRichPassage({ context: 'x', context_lines: true })).toBe(true)
    expect(isRichPassage({ context: 'x', vorspann_de: 'Lead' })).toBe(true)
    expect(isRichPassage({ context: 'x', glossary: [] })).toBe(false)
  })

  it('số dòng hiện ở dòng 5 và 10, dòng trống giữa hai đoạn KHÔNG được đếm', () => {
    render(<ReadingPassage teil={teil} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.queryByText('11')).not.toBeInTheDocument()
    // dòng 10 là "Zeile zehn" (dòng trống không tính), không phải "Zeile neun"
    const ten = screen.getByText('10').parentElement!
    expect(ten).toHaveTextContent('Zeile zehn')
  })

  it('tiêu đề, Vorspann in đậm và chú thích từ khó đều hiện', () => {
    render(<ReadingPassage teil={teil} />)
    expect(screen.getByRole('heading', { name: 'Ehrenamt im Wandel' })).toBeInTheDocument()
    expect(screen.getByText('Wer sich engagiert, tut das heute anders.')).toHaveClass('font-semibold')
    expect(screen.getByText('*Ehrenamt:')).toBeInTheDocument()
    expect(screen.getByText('freiwillige, unbezahlte Arbeit')).toBeInTheDocument()
  })

  it('không khai context_lines thì không đánh số nhưng vẫn dựng Vorspann', () => {
    render(<ReadingPassage teil={{ ...teil, context_lines: false }} />)
    expect(screen.queryByText('5')).not.toBeInTheDocument()
    expect(screen.getByText('Wer sich engagiert, tut das heute anders.')).toBeInTheDocument()
    expect(passageLines('a\r\nb')).toEqual(['a', 'b'])
  })
})
