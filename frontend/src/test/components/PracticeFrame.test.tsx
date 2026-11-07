/**
 * Khung làm bài luyện thi (đợt (a), 07/11/2026): hai cột có vạch chia kéo được, Lesen 3 bấm mẩu rao
 * vặt ở cột nguồn để gán cho tình huống đang chọn, hàng ô số câu ở thanh dưới, phím tắt chọn đáp án.
 */
import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi'))

import { ObjectiveTeilView } from '@/components/exam/practice/ObjectiveTeilView'
import { PracticeFootSlot } from '@/components/exam/practice/PracticeShell'
import { SplitPanes } from '@/components/exam/practice/SplitPanes'
import type { PracticeTeilData } from '@/components/exam/practice/practiceModel'

function Harness({ teil, kind }: { teil: PracticeTeilData; kind: 'match' | 'mc' }) {
  const [answers, setAnswers] = React.useState<Record<string, string>>({})
  const [slot, setSlot] = React.useState<HTMLElement | null>(null)
  const onAnswer = (id: string, v: string | null) =>
    setAnswers((prev) => {
      const next = { ...prev }
      if (v == null) delete next[id]
      else next[id] = v
      return next
    })
  return (
    <>
      <PracticeFootSlot.Provider value={slot}>
        <ObjectiveTeilView teil={teil} kind={kind} answers={answers} onAnswer={onAnswer} result={null} wide tips={null} />
      </PracticeFootSlot.Provider>
      <footer data-testid="foot"><div ref={setSlot} /></footer>
      <output data-testid="answers">{JSON.stringify(answers)}</output>
    </>
  )
}

describe('Khung làm bài — vạch chia hai cột', () => {
  beforeEach(() => window.localStorage.clear())

  it('phím ←/→ đổi độ rộng 2%, giới hạn 35–65%, nhớ cho lần sau; nháy đúp về 52%', () => {
    render(<SplitPanes wide source={<p>Bài đọc</p>} answers={<p>Câu hỏi</p>} />)
    const gutter = screen.getByRole('separator', { name: 'Kéo để đổi độ rộng hai cột' })
    expect(gutter).toHaveAttribute('aria-valuenow', '52')
    fireEvent.keyDown(gutter, { key: 'ArrowRight' })
    expect(gutter).toHaveAttribute('aria-valuenow', '54')
    expect(window.localStorage.getItem('df.practice.split')).toBe('54')
    for (let i = 0; i < 20; i++) fireEvent.keyDown(gutter, { key: 'ArrowRight' })
    expect(gutter).toHaveAttribute('aria-valuenow', '65')
    fireEvent.doubleClick(gutter)
    expect(gutter).toHaveAttribute('aria-valuenow', '52')
  })

  it('màn hẹp: có tay nắm ngăn trả lời và nút mở rộng / thu nhỏ', async () => {
    const user = userEvent.setup()
    render(<SplitPanes wide={false} source={<p>Bài đọc</p>} answers={<p>Câu hỏi</p>} sheetLabel="Câu 6 · 0/5" />)
    expect(screen.getByRole('separator', { name: /Kéo lên xuống/ })).toHaveTextContent('Câu 6 · 0/5')
    await user.click(screen.getByRole('button', { name: 'Mở rộng' }))
    expect(screen.getByRole('button', { name: 'Thu nhỏ' })).toBeInTheDocument()
  })
})

describe('Khung làm bài — Lesen 3 và ô số câu', () => {
  const ads: PracticeTeilData = {
    teil: 3,
    type: 'MATCH_AD_X',
    allow_none: true,
    ads: { a: 'Kochkurse am Wochenende', b: 'Fahrradreparatur in 24 Stunden' },
    items: [
      { id: 'LV3-11', question: 'Sie möchten kochen lernen.' },
      { id: 'LV3-12', question: 'Sie suchen ein Zimmer für drei Monate.' },
    ],
  }

  it('bấm mẩu rao vặt ở cột nguồn gán cho tình huống đang chọn; "không mẩu nào" ở cột trả lời', async () => {
    const user = userEvent.setup()
    render(<Harness teil={ads} kind="match" />)
    expect(screen.getByText(/Bấm mẩu rao vặt bên trái cho câu 11/)).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Kochkurse am Wochenende/ }))
    expect(screen.getByTestId('answers').textContent).toBe('{"LV3-11":"a"}')
    // tự sang tình huống 12; mẩu a giờ ghi "ở câu 11"
    expect(screen.getByText(/Bấm mẩu rao vặt bên trái cho câu 12/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Kochkurse am Wochenende/ })).toHaveTextContent('ở câu 11')
    await user.click(screen.getByRole('radio', { name: /Không mẩu nào phù hợp/ }))
    expect(screen.getByTestId('answers').textContent).toBe('{"LV3-11":"a","LV3-12":"x"}')
  })

  it('thanh dưới có ô số câu: đã làm / chưa làm, bấm để chọn câu', async () => {
    const user = userEvent.setup()
    render(<Harness teil={ads} kind="match" />)
    const foot = within(screen.getByTestId('foot'))
    expect(foot.getByRole('button', { name: 'Câu 11, chưa làm' })).toHaveAttribute('aria-current', 'true')
    await user.click(foot.getByRole('button', { name: 'Câu 12, chưa làm' }))
    expect(screen.getByText(/Bấm mẩu rao vặt bên trái cho câu 12/)).toBeInTheDocument()
    expect(foot.getByText('0/2')).toBeInTheDocument()
  })
})

describe('Khung làm bài — trắc nghiệm, phím tắt và đánh dấu', () => {
  const mc: PracticeTeilData = {
    teil: 2,
    type: 'MULTIPLE_CHOICE',
    context: 'Ein Dorf teilt seine Autos.',
    items: [
      { id: 'LV2-6', question: 'Die Familien …', options: { a: 'verkaufen alles.', b: 'zahlen pro Kilometer.', c: 'fahren gratis.' } },
      { id: 'LV2-7', question: 'Die Idee kam …', options: { a: 'vom Rathaus.', b: 'vom Bus.', c: 'von Kindern.' } },
    ],
  }

  it('phím B chọn đáp án cho câu đang làm, J sang câu sau, F đánh dấu (chấm vàng trên ô số)', async () => {
    const user = userEvent.setup()
    render(<Harness teil={mc} kind="mc" />)
    await user.keyboard('b')
    expect(screen.getByTestId('answers').textContent).toBe('{"LV2-6":"b"}')
    await user.keyboard('j')
    await user.keyboard('f')
    const foot = within(screen.getByTestId('foot'))
    expect(foot.getByRole('button', { name: 'Câu 7, chưa làm, đã đánh dấu' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đánh dấu câu 7 để xem lại' })).toHaveAttribute('aria-pressed', 'true')
  })
})
