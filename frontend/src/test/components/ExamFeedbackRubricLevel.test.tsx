/**
 * Nhãn rubric của phiếu chấm bài viết (07/09/2026): phải nói đúng trình độ đã chấm.
 * Trước đợt này catalog ghi cứng "Rubric Goethe A1 chính thức" cho MỌI đề — chạy thử đề B1 trên
 * prod thấy nhãn A1 nằm cạnh nhận xét chê "từ vựng vượt mức A1", tức thước đo sai bậc.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ExamFeedback } from '@/components/exam/ExamFeedback'

const intl = vi.hoisted(() => ({ locale: 'vi' as 'vi' | 'en' | 'de' }))
vi.mock('next-intl', async () => {
  const { catalogT } = await import('@/test/intlCatalog')
  return {
    useLocale: () => intl.locale,
    useTranslations: (ns?: string) => catalogT(ns, intl.locale),
  }
})

const danhGia = (extra: Record<string, unknown>) => ({
  SCHREIBEN: {
    teil2_email: {
      status: 'AI_EVALUATED',
      aufgabenerfuellung: 5, kohaerenz: 4, wortschatz: 3, strukturen: 3,
      total: 15, max: 15, feedback_vi: 'Bài viết mạch lạc.',
      ...extra,
    },
  },
})

describe('Phiếu chấm bài viết — nhãn rubric theo trình độ', () => {
  it('có trình độ thì nhãn nêu đúng bậc đã chấm', () => {
    intl.locale = 'vi'
    render(<ExamFeedback detailedScores={danhGia({ level: 'B2' })} />)
    expect(screen.getByText('Rubric Goethe B2 chính thức')).toBeInTheDocument()
    expect(screen.queryByText(/Goethe A1/)).not.toBeInTheDocument()
  })

  it('lượt cũ không có trình độ thì dùng nhãn trung tính, không bịa A1', () => {
    intl.locale = 'vi'
    render(<ExamFeedback detailedScores={danhGia({})} />)
    expect(screen.getByText('Rubric Goethe chính thức')).toBeInTheDocument()
    expect(screen.queryByText(/Goethe A1/)).not.toBeInTheDocument()
  })

  it('tiêu chí AI không chấm thì không vẽ thanh 0 điểm, thang tổng co theo', () => {
    intl.locale = 'vi'
    render(
      <ExamFeedback
        detailedScores={{
          SCHREIBEN: {
            teil2_email: {
              status: 'AI_EVALUATED', level: 'B2',
              aufgabenerfuellung: 5, kohaerenz: 4, wortschatz: 3,
              total: 12, max: 12, missing_criteria: ['strukturen'],
              feedback_vi: 'Ngữ pháp ở mức B2, chỉ vài lỗi nhỏ.',
            },
          },
        }}
      />,
    )
    expect(screen.getByText('/12')).toBeInTheDocument() // tổng chia theo thang đã co, không phải /15
    expect(screen.queryByText('0/3')).not.toBeInTheDocument()
    expect(screen.queryByText('Ngữ pháp & cấu trúc câu')).not.toBeInTheDocument()
    expect(screen.getByText(/AI không chấm 1 tiêu chí/)).toBeInTheDocument()
  })

  it('bản tiếng Đức cũng nêu bậc', () => {
    intl.locale = 'de'
    render(<ExamFeedback detailedScores={danhGia({ level: 'C1' })} />)
    expect(screen.getByText('Offizielles Goethe-Raster C1')).toBeInTheDocument()
  })

  // Đề telc chấm Viết bằng 3 Kriterien × 15. Danh sách tiêu chí trước đây ghi cứng bốn cột Goethe
  // kèm thang, nên phiếu telc sẽ không vẽ ra thanh nào — mà cũng không báo lỗi gì.
  const phieuTelc = (extra: Record<string, unknown> = {}) => ({
    SCHREIBEN: {
      teil2_email: {
        status: 'AI_EVALUATED', level: 'B1',
        leitpunkte: 12, kommunikative_gestaltung: 11, formale_richtigkeit: 9,
        criteria: [
          { key: 'leitpunkte', score: 12, max: 15 },
          { key: 'kommunikative_gestaltung', score: 11, max: 15 },
          { key: 'formale_richtigkeit', score: 9, max: 15 },
        ],
        total: 32, max: 45, feedback_vi: 'Đủ bốn ý.',
        ...extra,
      },
    },
  })

  it('bảng tiêu chí telc vẽ đủ ba cột trên thang 15, tổng /45', () => {
    intl.locale = 'vi'
    render(<ExamFeedback detailedScores={phieuTelc()} />)

    expect(screen.getByText('Bám sát các ý yêu cầu')).toBeInTheDocument()
    expect(screen.getByText('Bố cục & cách viết thư')).toBeInTheDocument()
    expect(screen.getByText('Ngữ pháp & chính tả')).toBeInTheDocument()
    expect(screen.getByText('12/15')).toBeInTheDocument()
    expect(screen.getByText('/45')).toBeInTheDocument()
    // Không được lẫn nhãn của bảng Goethe vào phiếu telc.
    expect(screen.queryByText('Từ vựng')).not.toBeInTheDocument()
  })

  it('tiêu chí lạ vẫn vẽ bằng nhãn chung, không biến mất và cũng không lộ khoá máy', () => {
    intl.locale = 'vi'
    render(
      <ExamFeedback
        detailedScores={phieuTelc({
          criteria: [{ key: 'ein_neues_kriterium', score: 7, max: 10 }],
          total: 7, max: 10,
        })}
      />,
    )
    expect(screen.getByText('Tiêu chí khác')).toBeInTheDocument()
    expect(screen.getByText('7/10')).toBeInTheDocument()
    expect(screen.queryByText(/ein_neues_kriterium/)).not.toBeInTheDocument()
  })

  it('HỒI QUY: phiếu Goethe cũ không có mảng criteria vẫn vẽ như trước', () => {
    intl.locale = 'vi'
    render(<ExamFeedback detailedScores={danhGia({ level: 'B1' })} />)
    expect(screen.getByText('Hoàn thành nhiệm vụ')).toBeInTheDocument()
    expect(screen.getByText('Từ vựng')).toBeInTheDocument()
    expect(screen.getByText('/15')).toBeInTheDocument()
  })
})
