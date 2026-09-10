/**
 * Owner 11/09/2026: màn luyện/thi nói đang in mã máy ("WORD_ORDER.V2_MAIN_CLAUSE",
 * "ARTICLE.PLURAL_DECLENSION") ngay cạnh câu sửa. Học viên chỉ được đọc TÊN LỖI.
 *
 * Chốt cả ba nơi nhả nhãn lỗi trong phòng thi/luyện, và chốt luôn phần đuôi
 * ngữ cảnh (điểm, "T1") vẫn còn nguyên — bỏ mã không được làm mất thông tin khác.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import studentVi from '../../../messages/v2/student.vi.json'
import { ExamTranscript } from '@/components/features/exam-speaking/ExamTranscript'
import { DrillSummary } from '@/components/features/exam-speaking/DrillSummary'
import { Ergebnisbogen } from '@/components/features/exam-speaking/Ergebnisbogen'
import { getErrorSnippet } from '@/lib/errors/errorTaxonomy'
import type { RoomLine, ScoreSheet } from '@/types/exam-speaking'

function renderVi(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...studentVi } }}>
      {node}
    </NextIntlClientProvider>,
  )
}

const LINES: RoomLine[] = [
  { id: 'l1', role: 'PRUEFER', text: 'Wie heißen Sie?' },
  {
    id: 'l2',
    role: 'CANDIDATE',
    text: 'Ich bin Cu und ich wohne in HaNoi. Was ist von Beruf',
    eval: {
      score: 5,
      feedbackVi: 'Câu trả lời đã đưa ra thông tin cơ bản nhưng còn lỗi trật tự từ.',
      corrections: [
        { code: 'WORD_ORDER.V2_MAIN_CLAUSE', original: 'Was ist von Beruf', correction: 'Was bist du von Beruf?' },
        { code: 'CASE.PREP_DAT_MIT', original: 'mit der Bus', correction: 'mit dem Bus' },
      ],
    },
  },
]

/** Mọi mã trong ErrorCatalog đều có dạng NHÓM.CHI_TIET — không được xuất hiện trên màn. */
const RAW_CODE = /[A-Z]{3,}[._][A-Z0-9_]{3,}/

describe('phòng luyện nói — chấm nhanh dưới mỗi lượt', () => {
  it('hiện tên lỗi tiếng Việt, không hiện mã máy', () => {
    renderVi(<ExamTranscript lines={LINES} mode="DRILL" />)

    expect(screen.getByText('Sai vị trí động từ')).toBeInTheDocument()
    expect(screen.getByText('Sai cách sau giới từ “mit”')).toBeInTheDocument()
    expect(screen.getByTestId('drill-eval').textContent).not.toMatch(RAW_CODE)
  })

  it('giữ nguyên điểm và câu sửa bên cạnh nhãn', () => {
    renderVi(<ExamTranscript lines={LINES} mode="DRILL" />)

    const card = screen.getByTestId('drill-eval')
    expect(card.textContent).toContain('Was ist von Beruf')
    expect(card.textContent).toContain('Was bist du von Beruf?')
    expect(card.textContent).toContain('5')
  })

  it('chế độ MOCK không chấm giữa chừng nên không có thẻ lỗi nào', () => {
    renderVi(<ExamTranscript lines={LINES} mode="MOCK" />)
    expect(screen.queryByTestId('drill-eval')).not.toBeInTheDocument()
  })
})

describe('tổng kết drill', () => {
  it('danh sách lỗi cần ôn dùng tên lỗi, không dùng mã', () => {
    renderVi(<DrillSummary lines={LINES} />)

    const summary = screen.getByTestId('drill-summary')
    expect(summary.textContent).toContain('Sai vị trí động từ')
    expect(summary.textContent).not.toMatch(RAW_CODE)
  })
})

describe('phiếu kết quả thi thử', () => {
  const sheet: ScoreSheet = {
    rubricRef: { provider: 'GOETHE', level: 'B1', version: 1 },
    parts: [],
    global: [],
    total: 44, totalLow: 40, totalHigh: 48, maxPoints: 84, officialMax: 100,
    passed: false, passRule: '', passes: 1,
    errors: [
      { code: 'ARTICLE.GENDER_WRONG_DER_DIE_DAS', original: 'der Küche', correction: 'die Küche', severity: 'MAJOR', teilNo: 2 },
    ],
    notes: [],
  } as unknown as ScoreSheet

  it('dòng "lỗi kéo điểm" hiện tên lỗi + số Teil, không hiện mã', () => {
    renderVi(<Ergebnisbogen sheet={sheet} />)

    const label = getErrorSnippet('ARTICLE.GENDER_WRONG_DER_DIE_DAS', 'vi').title
    expect(label).toBe('Sai giống danh từ')
    expect(screen.getByText(`${label} · T2`)).toBeInTheDocument()
    expect(screen.queryByText(/ARTICLE\./)).not.toBeInTheDocument()
  })
})
