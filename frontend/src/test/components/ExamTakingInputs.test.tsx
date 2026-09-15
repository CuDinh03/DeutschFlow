/**
 * Trình chạy thi thử (07/09/2026): mọi Teil của đề phải có chỗ làm bài.
 * Trước đợt này phần Viết của đề B1/B2/C1 để đề bài ở khoá `prompt` và KHÔNG có nhánh render nào,
 * nên học viên mở ra chỉ thấy đề dẫn, không có ô gõ; thẻ chủ đề/tình huống phần Nói cũng không hiện.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ExamTaking, type ActiveExamData } from '@/app/v2/student/mock-exam/run/ExamTaking'

vi.mock('next-intl', async () => {
  const { catalogT } = await import('@/test/intlCatalog')
  return { useLocale: () => 'vi', useTranslations: (ns?: string) => catalogT(ns, 'vi') }
})
// Hai widget này gọi TTS trình duyệt / micro nên chỉ cần biết chúng có mặt.
vi.mock('@/components/exam/AudioPlayer', () => ({ AudioPlayer: () => <div data-testid="audio" /> }))
vi.mock('@/components/exam/SprechenTeil2Simulator', () => ({
  SprechenTeil2Simulator: () => <div data-testid="sprechen-simulator" />,
}))

const noop = () => {}

function renderSection(data: ActiveExamData, sectionIdx = 0) {
  return render(
    <ExamTaking
      data={data}
      currentSectionIdx={sectionIdx}
      onSectionChange={noop}
      answers={{}}
      onAnswerChange={noop}
      submitting={false}
      onSubmit={noop}
      onExit={noop}
    />,
  )
}

describe('Trình chạy thi thử — chỗ làm bài của từng Teil', () => {
  it('phần Viết của đề B1+ (đề bài ở `prompt`) có ô nhập và hiện đề bài', () => {
    renderSection({
      sections: [
        {
          name: 'SCHREIBEN',
          label_vi: 'Viết',
          time_minutes: 25,
          max_points: 25,
          teile: [
            {
              teil: 1,
              instruction_vi: 'Viết bài đăng diễn đàn ~80 từ',
              prompt: 'Forum Bildung heute: Sollten Schulen mehr praktische Fächer anbieten?',
              writing_points: ['Ý kiến của bạn', 'Hai lập luận'],
            },
          ],
        },
      ],
    })

    expect(screen.getByText(/Forum Bildung heute/)).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByText('Hai lập luận')).toBeInTheDocument()
  })

  it('phần Viết kiểu A1/A2 vẫn dùng `input_email` và form điền', () => {
    renderSection({
      sections: [
        {
          name: 'SCHREIBEN',
          label_vi: 'Viết',
          time_minutes: 20,
          max_points: 25,
          teile: [
            {
              teil: 1,
              instruction_vi: 'Điền form',
              form_fields: [{ field: 'Vorname', instruction_vi: 'Tên' }],
            },
            {
              teil: 2,
              instruction_vi: 'Viết thư trả lời',
              input_email: 'Betreff: Neue Wohnung',
              writing_points: ['Nơi bạn ở'],
            },
          ],
        },
      ],
    })

    expect(screen.getByText(/Betreff: Neue Wohnung/)).toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(2) // một ô form + một ô viết thư
    expect(screen.getByText(/Vorname/)).toBeInTheDocument()
  })

  it('phần Nói hiện thẻ chủ đề, thẻ tình huống và đề bài dạng `prompt`', () => {
    renderSection({
      sections: [
        {
          name: 'SPRECHEN',
          label_vi: 'Nói',
          time_minutes: 15,
          max_points: 25,
          teile: [
            {
              teil: 2,
              instruction_vi: 'Hỏi và trả lời',
              topic_cards: [{ card: 'Wohnen', question_to_ask: 'Wie viele Zimmer hat Ihre Wohnung?' }],
            },
            {
              teil: 3,
              instruction_vi: 'Đưa ra yêu cầu',
              scenario_cards: [{ situation: 'In der Apotheke', request: 'Etwas gegen Husten kaufen' }],
            },
            { teil: 4, instruction_vi: 'Thuyết trình', prompt: 'Thema: Digitale Medien und Freizeit' },
          ],
        },
      ],
    })

    expect(screen.getByText('Wohnen')).toBeInTheDocument()
    expect(screen.getByText(/Wie viele Zimmer/)).toBeInTheDocument()
    expect(screen.getByText('In der Apotheke')).toBeInTheDocument()
    expect(screen.getByText(/Etwas gegen Husten/)).toBeInTheDocument()
    expect(screen.getByText(/Thema: Digitale Medien/)).toBeInTheDocument()
    expect(screen.getByTestId('sprechen-simulator')).toBeInTheDocument()
  })
})
