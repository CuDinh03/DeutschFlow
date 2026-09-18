/**
 * Cổng nghi thức bài nghe telc (17/09/2026): Ansage → đếm ngược đọc câu hỏi → câu khung → nghe được.
 *
 * Ba điều phải đúng, vì sai là học viên luyện một bài dễ hơn bài sẽ thi:
 *   • chưa bấm bắt đầu thì câu hỏi ẩn; đang đọc/đếm ngược thì nút nghe KHOÁ và nói rõ lý do
 *     (không phải "hết lượt");
 *   • đếm ngược đúng số giây của đề (30 ở Teil 1), Teil không có câu khung thì không đọc gì thêm;
 *   • đề Goethe không khai `ansage_de` ⇒ không có cổng, mọi thứ như cũ.
 */
import React from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const tts = vi.hoisted(() => ({
  speakExamLine: vi.fn(async () => {}),
  stopExamTts: vi.fn(),
}))
vi.mock('@/components/features/exam-speaking/examTts', () => tts)
vi.mock('next-intl', async () => {
  const { catalogT } = await import('@/test/intlCatalog')
  return { useTranslations: (ns?: string) => catalogT(ns, 'vi'), useLocale: () => 'vi' }
})

import { HoerenGate } from '@/components/exam/HoerenGate'
import { DialogueAudioPlayer } from '@/components/exam/DialogueAudioPlayer'
import { itemTurns, parseHoerenGate, type HoerenGatePhase } from '@/components/exam/audioScript'

beforeEach(() => {
  tts.speakExamLine.mockClear()
  tts.stopExamTts.mockClear()
})
afterEach(() => {
  vi.useRealTimers()
})

function Harness({ readingSeconds, framing }: { readingSeconds: number; framing?: string }) {
  const [phase, setPhase] = React.useState<HoerenGatePhase>('idle')
  return (
    <>
      <HoerenGate
        teilNo={1}
        spec={{ ansage: 'Sie hören nun fünf kurze Texte.', readingSeconds, framing }}
        phase={phase}
        onPhaseChange={setPhase}
      />
      <span data-testid="phase">{phase}</span>
    </>
  )
}

describe('cổng nghi thức bài nghe', () => {
  it('Teil 1: đọc Ansage → đếm 30 giây → đọc câu khung → mở', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Harness readingSeconds={30} framing="Wie kommen Sie zur Arbeit?" />)

    expect(screen.getByTestId('phase')).toHaveTextContent('idle')
    expect(screen.getByText(/Câu hỏi hiện ra khi bạn bấm bắt đầu/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Bắt đầu Teil 1/ }))

    // Ansage đọc bằng giọng người dẫn, rồi vào pha đọc câu hỏi.
    expect(tts.speakExamLine).toHaveBeenCalledWith('PRUEFER', 'Sie hören nun fünf kurze Texte.')
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('phase')).toHaveTextContent('reading')
    expect(screen.getByText(/còn 30 giây/)).toBeInTheDocument()

    await act(async () => { vi.advanceTimersByTime(10_000) })
    expect(screen.getByText(/còn 20 giây/)).toBeInTheDocument()
    expect(screen.getByTestId('phase')).toHaveTextContent('reading')

    await act(async () => { vi.advanceTimersByTime(20_000) })
    await act(async () => { await Promise.resolve() })
    // Hết giờ đọc ⇒ câu khung của Teil 1 được đọc, rồi mới mở.
    expect(tts.speakExamLine).toHaveBeenLastCalledWith('PRUEFER', 'Wie kommen Sie zur Arbeit?')
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('phase')).toHaveTextContent('ready')
    expect(screen.getByText(/Bắt đầu nghe được rồi/)).toBeInTheDocument()
  })

  it('Teil 3: không có thời gian đọc, không có câu khung ⇒ Ansage xong là mở ngay', async () => {
    render(<Harness readingSeconds={0} />)
    await userEvent.click(screen.getByRole('button', { name: /Bắt đầu Teil 1/ }))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(tts.speakExamLine).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('phase')).toHaveTextContent('ready')
  })

  it('nút nghe bị khoá khi cổng chưa mở — nói rõ lý do, KHÔNG phải "hết lượt", và không phát', async () => {
    render(
      <DialogueAudioPlayer
        turns={[{ speaker: 'PRUEFER', text: 'Guten Tag.' }]}
        maxPlays={1}
        locked
        compact
      />,
    )
    const nút = screen.getByRole('button', { name: /Phát audio/ })
    expect(nút).toBeDisabled()
    expect(screen.getByText(/Nghe hướng dẫn và đọc câu hỏi xong mới phát được/)).toBeInTheDocument()
    expect(screen.queryByText(/Hết lượt nghe/)).not.toBeInTheDocument()

    await userEvent.click(nút)
    expect(tts.speakExamLine).not.toHaveBeenCalled()
  })

  it('cổng mở thì bài của một câu phát câu dẫn (giọng người dẫn) rồi bài (giọng người nói)', async () => {
    const turns = itemTurns({
      audio_script: 'Ja, es ist ein gebrauchter Computer, zwei Jahre alt.',
      lead_in_de: 'Sie rufen wegen einer Anzeige an und bekommen folgende Auskunft.',
      speaker: 'PARTNER',
    })!
    render(<DialogueAudioPlayer turns={turns} maxPlays={2} compact />)

    await userEvent.click(screen.getByRole('button', { name: /Phát audio/ }))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(tts.speakExamLine.mock.calls).toEqual([
      ['PRUEFER', 'Sie rufen wegen einer Anzeige an und bekommen folgende Auskunft.'],
      ['PARTNER', 'Ja, es ist ein gebrauchter Computer, zwei Jahre alt.'],
    ])
    // Một người nói + câu dẫn = bài của một câu ⇒ dạng thu gọn, không liệt kê "Người 1/Người 2".
    expect(screen.queryByText('Người 2')).not.toBeInTheDocument()
  })

  it('đề Goethe không khai ansage_de ⇒ không có cổng', () => {
    expect(parseHoerenGate({})).toBeNull()
    expect(parseHoerenGate({ ansage_de: '  ' })).toBeNull()
    expect(parseHoerenGate({ ansage_de: 'Sie hören…', reading_seconds: 30, framing_de: 'Thema' }))
      .toEqual({ ansage: 'Sie hören…', readingSeconds: 30, framing: 'Thema' })
    // Không khai giây đọc ⇒ 0, không phải NaN hay undefined.
    expect(parseHoerenGate({ ansage_de: 'Sie hören…' })).toEqual({ ansage: 'Sie hören…', readingSeconds: 0, framing: undefined })
  })
})
