/**
 * Kết quả thi thử (đợt 3 audit UTF-8/i18n, 06/09/2026): DetailedScoreBreakdown + WeakAreasRecommendation
 * đọc nhãn từ catalog THẬT `v2.student.examResult` — người dùng DE phải thấy tiếng Đức (không còn
 * `labelVi`/`tipVi` ghim cứng), người dùng VI thấy ĐÚNG chữ cũ.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DetailedScoreBreakdown } from '@/components/exam/DetailedScoreBreakdown'
import { WeakAreasRecommendation } from '@/components/exam/WeakAreasRecommendation'

const intl = vi.hoisted(() => ({ locale: 'de' as 'vi' | 'en' | 'de' }))
vi.mock('next-intl', async () => {
  const { catalogT } = await import('@/test/intlCatalog')
  return {
    useLocale: () => intl.locale,
    useTranslations: (ns?: string) => catalogT(ns, intl.locale),
  }
})

const scores = {
  LESEN: { total: 20, max: 25, percentage: 80 },
  HOEREN: { total: 10, max: 25, percentage: 40 },
  SCHREIBEN: { total_provisional: 0, total_max: 25, status: 'PENDING_AI_EVALUATION' },
}

describe('Kết quả thi thử — catalog de', () => {
  it('DetailedScoreBreakdown: nhãn phần thi, trạng thái và ghi chú chờ chấm bằng tiếng Đức', () => {
    intl.locale = 'de'
    render(<DetailedScoreBreakdown detailedScores={scores} totalScore={30} passed={false} />)
    expect(screen.getByText('Punkte nach Prüfungsteil')).toBeInTheDocument()
    expect(screen.getByText('Bestehensgrenze (60 %)')).toBeInTheDocument()
    expect(screen.getByText('Leseverstehen')).toBeInTheDocument()
    expect(screen.getByText('Hörverstehen')).toBeInTheDocument()
    expect(screen.getByText('Nicht bestanden')).toBeInTheDocument()
    expect(screen.getByText('Bewertung ausstehend')).toBeInTheDocument()
    expect(screen.getByText('Die E-Mail wird von der KI bewertet')).toBeInTheDocument()
    expect(screen.getByText('Gesamtpunktzahl (vorläufig)')).toBeInTheDocument()
    expect(screen.queryByText(/Đọc hiểu|Chờ chấm|Chưa đạt|Điểm chi tiết/)).not.toBeInTheDocument()
  })

  it('WeakAreasRecommendation: tiêu đề, nhãn phần, lời khuyên và CTA bằng tiếng Đức', () => {
    intl.locale = 'de'
    render(<WeakAreasRecommendation weakAreas={['HOEREN']} />)
    expect(screen.getByText('Deine Schwachpunkte')).toBeInTheDocument()
    expect(screen.getByText('HOEREN — Hörverstehen')).toBeInTheDocument()
    expect(screen.getByText('Unter 60 %')).toBeInTheDocument()
    expect(screen.getByText(/Deutsch-A1-Podcasts/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Jetzt üben/ })).toHaveAttribute('href', '/student/practice')
    expect(screen.queryByText(/Luyện tập|Nghe hiểu/)).not.toBeInTheDocument()
  })

  it('WeakAreasRecommendation: không có điểm yếu → lời khen tiếng Đức', () => {
    intl.locale = 'de'
    render(<WeakAreasRecommendation weakAreas={[]} />)
    expect(screen.getByText('Ausgezeichnet! Keine Schwächen')).toBeInTheDocument()
  })
})

describe('Kết quả thi thử — catalog vi giữ ĐÚNG chữ cũ', () => {
  it('WeakAreasRecommendation vi: nhãn + lời khuyên nguyên văn', () => {
    intl.locale = 'vi'
    render(<WeakAreasRecommendation weakAreas={['LESEN']} />)
    expect(screen.getByText('Điểm yếu cần cải thiện')).toBeInTheDocument()
    expect(screen.getByText('LESEN — Đọc hiểu')).toBeInTheDocument()
    expect(screen.getByText('Dưới 60%')).toBeInTheDocument()
    expect(
      screen.getByText('Luyện đọc văn bản tiếng Đức ngắn hàng ngày, chú ý từ vựng chủ đề sinh hoạt hàng ngày.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Luyện tập ngay/ })).toHaveAttribute('href', '/student/grammar-practice')
  })

  it('DetailedScoreBreakdown vi: trạng thái chờ chấm / đạt / chưa đạt nguyên văn', () => {
    intl.locale = 'vi'
    render(<DetailedScoreBreakdown detailedScores={scores} totalScore={30} passed={false} />)
    expect(screen.getByText('Điểm chi tiết theo phần')).toBeInTheDocument()
    expect(screen.getByText('Chờ chấm')).toBeInTheDocument()
    expect(screen.getByText('Chưa đạt')).toBeInTheDocument()
    expect(screen.getByText('Phần viết email sẽ được AI chấm điểm')).toBeInTheDocument()
    expect(screen.getByText('Điểm chính thức sau khi chấm xong')).toBeInTheDocument()
  })
})
