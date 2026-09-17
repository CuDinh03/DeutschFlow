/**
 * Phần Viết kiểu telc trên trình chạy (17/09/2026): E-Mail của bạn in nguyên văn phía trên bài,
 * bốn Leitpunkte in xáo thứ tự như tờ đề thật. Đề Goethe (không khai `stimulus`) dựng như cũ.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ExamTaking, type ActiveExamData } from '@/app/v2/student/mock-exam/run/ExamTaking'

vi.mock('next-intl', async () => {
  const { catalogT } = await import('@/test/intlCatalog')
  return { useLocale: () => 'vi', useTranslations: (ns?: string) => catalogT(ns, 'vi') }
})
vi.mock('@/components/exam/AudioPlayer', () => ({ AudioPlayer: () => <div data-testid="audio" /> }))
vi.mock('@/components/exam/SprechenTeil2Simulator', () => ({
  SprechenTeil2Simulator: () => <div data-testid="sprechen-simulator" />,
}))

const noop = () => {}
const POINTS = [
  'Reaktion auf Lenas Vorschlag: Passt der Besuch im Juli?',
  'Etwas über Ihre neue Stadt',
  'Ein Tipp, wo Lena günstig übernachten kann',
  'Was es bei Ihnen Neues gibt',
]

function renderSchreiben(teil: Record<string, unknown>) {
  const data: ActiveExamData = {
    sections: [{ name: 'SCHREIBEN', label_vi: 'Viết', time_minutes: 30, max_points: 45, teile: [teil as never] }],
  }
  return render(
    <ExamTaking
      data={data}
      currentSectionIdx={0}
      onSectionChange={noop}
      answers={{}}
      onAnswerChange={noop}
      submitting={false}
      onSubmit={noop}
      onExit={noop}
    />,
  )
}

describe('Phần Viết telc — E-Mail kích thích và Leitpunkte xáo', () => {
  it('in E-Mail của bạn với người gửi, chủ đề, thân thư — và ô nhập bài', () => {
    renderSchreiben({
      teil: 1,
      instruction_de: 'Antworten Sie Ihrer Freundin.',
      prompt: 'Ihre Freundin Lena hat Ihnen geschrieben.',
      stimulus: { type: 'EMAIL', from: 'Lena', subject: 'Besuch im Juli?', body: 'Hallo!\n\nPasst dir der Juli?' },
      shuffle_points: true,
      writing_points: POINTS,
    })

    expect(screen.getByRole('region', { name: 'E-Mail bạn nhận được' })).toBeInTheDocument()
    expect(screen.getByText('Lena')).toBeInTheDocument()
    expect(screen.getByText('Besuch im Juli?')).toBeInTheDocument()
    expect(screen.getByText(/Passt dir der Juli\?/)).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    // Có E-Mail nguyên văn thì dòng `prompt` một câu không in nữa (thừa).
    expect(screen.queryByText('Ihre Freundin Lena hat Ihnen geschrieben.')).not.toBeInTheDocument()
  })

  it('bốn Leitpunkte in đủ nhưng KHÔNG theo thứ tự seed, kèm lời nhắc tự sắp thứ tự', () => {
    renderSchreiben({
      teil: 1,
      stimulus: { type: 'EMAIL', from: 'Lena', body: 'Hallo!' },
      shuffle_points: true,
      writing_points: POINTS,
    })

    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect([...items].sort()).toEqual([...POINTS].sort())
    expect(items).not.toEqual(POINTS)
    expect(screen.getByText(/in không theo thứ tự/)).toBeInTheDocument()
  })

  it('đề Goethe không khai stimulus/cờ xáo: đề bài và thứ tự ý y như cũ', () => {
    renderSchreiben({
      teil: 2,
      input_email: 'Betreff: Neue Wohnung. Wo wohnst du jetzt?',
      writing_points: ['Wo du jetzt wohnst', 'Wann Sara dich besuchen kann'],
    })

    expect(screen.getByText(/Betreff: Neue Wohnung/)).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Wo du jetzt wohnst',
      'Wann Sara dich besuchen kann',
    ])
    expect(screen.queryByText(/in không theo thứ tự/)).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'E-Mail bạn nhận được' })).not.toBeInTheDocument()
  })
})
