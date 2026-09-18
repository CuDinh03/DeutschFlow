/**
 * Phiếu chấm Viết telc theo BẬC (17/09/2026): mỗi Kriterium in chữ A/B/C/D như Bewertungsbogen,
 * nhãn nói đúng kỳ thi (telc, không phải Goethe), và nói được ý nào thiếu, vì sao mất A.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ExamFeedback } from '@/components/exam/ExamFeedback'

vi.mock('next-intl', async () => {
  const { catalogT } = await import('@/test/intlCatalog')
  return { useLocale: () => 'vi', useTranslations: (ns?: string) => catalogT(ns, 'vi') }
})

const telcSheet = (extra: Record<string, unknown> = {}) => ({
  SCHREIBEN: {
    teil2_email: {
      status: 'AI_EVALUATED',
      level: 'B1',
      leitpunkte: 9,
      kommunikative_gestaltung: 9,
      formale_richtigkeit: 15,
      total: 33,
      max: 45,
      criteria: [
        { key: 'leitpunkte', score: 9, max: 15, band: 'B' },
        { key: 'kommunikative_gestaltung', score: 9, max: 15, band: 'B' },
        { key: 'formale_richtigkeit', score: 15, max: 15, band: 'A' },
      ],
      bands: { leitpunkte: 'B', kommunikative_gestaltung: 'B', formale_richtigkeit: 'A' },
      thema_verfehlt: false,
      situierung_verfehlt: false,
      leitpunkte_fehlt: [3],
      kein_a_weil: ['ICH_ANFANG'],
      feedback_vi: 'Thiếu ý 3.',
      ...extra,
    },
  },
})

describe('Phiếu chấm Viết telc — bậc A/B/C/D', () => {
  it('in bậc cạnh điểm từng Kriterium và nhãn bảng chấm telc, không phải Goethe', () => {
    render(<ExamFeedback detailedScores={telcSheet()} />)

    expect(screen.getAllByText('Bậc B')).toHaveLength(2)
    expect(screen.getByText('Bậc A')).toBeInTheDocument()
    expect(screen.getByText('Bảng chấm telc B1 chính thức (bậc A/B/C/D)')).toBeInTheDocument()
    expect(screen.queryByText(/Goethe/)).not.toBeInTheDocument()
    expect(screen.getByText('33')).toBeInTheDocument()
  })

  it('nói rõ ý nào thiếu và vì sao tiêu chí II mất A', () => {
    render(<ExamFeedback detailedScores={telcSheet()} />)

    expect(screen.getByText('Ý còn thiếu (số thứ tự theo đề): 3')).toBeInTheDocument()
    expect(screen.getByText(/Phần lớn câu mở đầu bằng „Ich“/)).toBeInTheDocument()
  })

  it('bài lạc đề: báo rõ cả ba tiêu chí nhận D', () => {
    render(
      <ExamFeedback
        detailedScores={telcSheet({
          thema_verfehlt: true, total: 0, leitpunkte: 0, kommunikative_gestaltung: 0, formale_richtigkeit: 0,
          criteria: [
            { key: 'leitpunkte', score: 0, max: 15, band: 'D' },
            { key: 'kommunikative_gestaltung', score: 0, max: 15, band: 'D' },
            { key: 'formale_richtigkeit', score: 0, max: 15, band: 'D' },
          ],
          bands: { leitpunkte: 'D', kommunikative_gestaltung: 'D', formale_richtigkeit: 'D' },
          leitpunkte_fehlt: [], kein_a_weil: [],
        })}
      />,
    )

    expect(screen.getByText(/Bài lạc đề/)).toBeInTheDocument()
    expect(screen.getAllByText('Bậc D')).toHaveLength(3)
  })

  it('HỒI QUY: phiếu Goethe không có bậc thì không in huy hiệu bậc, nhãn vẫn là Goethe', () => {
    render(
      <ExamFeedback
        detailedScores={{
          SCHREIBEN: {
            teil2_email: {
              status: 'AI_EVALUATED', level: 'A1',
              aufgabenerfuellung: 5, kohaerenz: 4, wortschatz: 3, strukturen: 3, total: 15, max: 15,
              criteria: [
                { key: 'aufgabenerfuellung', score: 5, max: 5 },
                { key: 'kohaerenz', score: 4, max: 4 },
              ],
              feedback_vi: 'Tốt.',
            },
          },
        }}
      />,
    )

    expect(screen.queryByText(/^Bậc /)).not.toBeInTheDocument()
    expect(screen.getByText('Rubric Goethe A1 chính thức')).toBeInTheDocument()
  })
})
