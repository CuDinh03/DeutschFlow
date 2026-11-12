/**
 * Hören đợt (b), 07/11/2026: Chuẩn bị → Hướng dẫn → Đọc câu hỏi → Nghe; câu hỏi khoá tới khi xong
 * hướng dẫn; lượt nghe theo `max_plays` (Teil 1 một lần mỗi đoạn, tự sang đoạn sau; Teil 2 hai lần cả
 * bài); "Luyện thoải mái" nghe tuỳ ý, có lời thoại, báo trang tắt đồng hồ.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tts = vi.hoisted(() => ({
  speakExamLine: vi.fn(async () => {}),
  stopExamTts: vi.fn(),
}))
vi.mock('@/components/features/exam-speaking/examTts', () => tts)
vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi'))

import { HoerenTeilView } from '@/components/exam/practice/HoerenTeilView'
import type { PracticeTeilData } from '@/components/exam/practice/practiceModel'

const teil1: PracticeTeilData = {
  teil: 1,
  max_plays: 1,
  reading_seconds: 30,
  ansage_de: 'Hörverstehen, Teil 1. Sie hören diese Texte nur einmal.',
  items: [
    { id: 'H1-41', question: 'Der Zug fährt von Gleis 7.', audio_script: 'Der Zug fährt heute von Gleis 9.', speaker: 'M' },
    { id: 'H1-42', question: 'Frau Albers soll zurückrufen.', audio_script: 'Bitte rufen Sie uns zurück.', speaker: 'F' },
  ],
}

const teil2: PracticeTeilData = {
  teil: 2,
  max_plays: 2,
  reading_seconds: 60,
  ansage_de: 'Hörverstehen, Teil 2. Sie hören das Gespräch zweimal.',
  audio_script: [
    { speaker: 'PRUEFER', text: 'Frau Berger, seit wann sind Sie Tierärztin?' },
    { speaker: 'KANDIDAT', text: 'Seit fünf Jahren.' },
  ],
  items: [{ id: 'H2-46', question: 'Sie arbeitet seit zehn Jahren als Tierärztin.' }],
}

function Harness({ teil, allowRelaxed = true, onRelaxed = () => undefined }: { teil: PracticeTeilData; allowRelaxed?: boolean; onRelaxed?: (r: boolean) => void }) {
  const [answers, setAnswers] = React.useState<Record<string, string>>({})
  return (
    <HoerenTeilView
      teil={teil}
      answers={answers}
      onAnswer={(id, v) => setAnswers((p) => ({ ...p, [id]: v ?? '' }))}
      result={null}
      wide
      tips={null}
      allowRelaxed={allowRelaxed}
      onRelaxedChange={onRelaxed}
    />
  )
}

beforeEach(() => {
  tts.speakExamLine.mockClear()
  tts.stopExamTts.mockClear()
  window.localStorage.clear()
})

describe('Hören — trang cha dựng lại object Teil ở mỗi lần render', () => {
  /** Giống bài chẩn đoán trước khi sửa: mỗi lần chọn đáp án, trang parse lại đề ⇒ object Teil mới, nội dung y cũ. */
  function Reparsing() {
    const [answers, setAnswers] = React.useState<Record<string, string>>({})
    const fresh = JSON.parse(JSON.stringify(teil1)) as PracticeTeilData
    return (
      <HoerenTeilView teil={fresh} answers={answers} result={null} wide tips={null}
        onAnswer={(id, v) => setAnswers((p) => ({ ...p, [id]: v ?? '' }))} />
    )
  }

  it('hướng dẫn chỉ chạy một lần: chọn đáp án không đưa màn hình về bước chuẩn bị', async () => {
    const user = userEvent.setup()
    render(<Reparsing />)
    await user.click(screen.getByRole('button', { name: /Bắt đầu Teil 1/ }))
    await waitFor(() => expect(tts.speakExamLine).toHaveBeenCalledTimes(1))
    await user.click(await screen.findByRole('button', { name: /Bỏ qua|Nghe luôn|Bắt đầu nghe/ }).catch(() => screen.getAllByRole('button')[0]))
    await waitFor(() => expect(screen.getByText('Der Zug fährt von Gleis 7.')).toBeInTheDocument())

    // Trả lời một câu ⇒ trang render lại với object Teil mới.
    await user.click(screen.getAllByRole('radio')[0])
    expect(screen.queryByRole('button', { name: /Bắt đầu Teil 1/ })).not.toBeInTheDocument()
    expect(screen.getByText('Der Zug fährt von Gleis 7.')).toBeInTheDocument()
    expect(tts.speakExamLine).toHaveBeenCalledTimes(1) // hướng dẫn không đọc lại
  })
})

describe('Hören — như thi thật', () => {
  it('chuẩn bị: nói rõ nghe mấy lần, câu hỏi khoá; bắt đầu ⇒ đọc Ansage, đọc câu hỏi rồi mới nghe', async () => {
    const user = userEvent.setup()
    render(<Harness teil={teil1} />)
    expect(screen.getByText('Nghe 1 lần')).toBeInTheDocument()
    expect(screen.getByText('30 giây')).toBeInTheDocument()
    expect(screen.getByText('Câu hỏi hiện khi bắt đầu')).toBeInTheDocument()
    expect(screen.queryByText('Der Zug fährt von Gleis 7.')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Bắt đầu Teil 1/ }))
    expect(tts.speakExamLine).toHaveBeenCalledWith('PRUEFER', teil1.ansage_de)
    // Ansage xong ⇒ đếm ngược đọc câu hỏi, câu hỏi đã hiện
    expect(await screen.findByText('Der Zug fährt von Gleis 7.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Đã đọc xong/ }))
    expect(screen.getByText('Đoạn 1 · câu 41')).toBeInTheDocument()
  })

  it('Teil 1: mỗi đoạn nghe một lần, nghe xong tự sang đoạn sau, không quay lại', async () => {
    const user = userEvent.setup()
    render(<Harness teil={teil1} />)
    await user.click(screen.getByRole('button', { name: /Bắt đầu Teil 1/ }))
    await user.click(await screen.findByRole('button', { name: /Đã đọc xong/ }))
    await user.click(screen.getByRole('button', { name: 'Phát' }))
    expect(tts.speakExamLine).toHaveBeenLastCalledWith('M', 'Der Zug fährt heute von Gleis 9.')
    expect(await screen.findByText('Đoạn 2 · câu 42')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Phát' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Đã hết lượt nghe' })).toBeDisabled())
    expect(screen.getByText('Đã nghe xong. Kiểm tra lại rồi nộp.')).toBeInTheDocument()
  })

  it('Teil 2: cả bài nghe hai lần; sau lần hai nút phát tắt', async () => {
    const user = userEvent.setup()
    render(<Harness teil={teil2} />)
    expect(screen.getByText('Nghe 2 lần')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Bắt đầu Teil 2/ }))
    await user.click(await screen.findByRole('button', { name: /Đã đọc xong/ }))
    await user.click(screen.getByRole('button', { name: 'Phát' }))
    expect(await screen.findByText('Còn 1/2 lượt nghe')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Phát' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Đã hết lượt nghe' })).toBeDisabled())
  })

  it('thi thử (không cho luyện thoải mái): không có lựa chọn cách luyện, không có nút bỏ qua', async () => {
    const user = userEvent.setup()
    render(<Harness teil={teil1} allowRelaxed={false} />)
    expect(screen.queryByText('Luyện thoải mái')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Bắt đầu Teil 1/ }))
    await screen.findByText('Der Zug fährt von Gleis 7.')
    expect(screen.queryByRole('button', { name: /Đã đọc xong/ })).not.toBeInTheDocument()
  })
})

describe('Hören — luyện thoải mái', () => {
  it('câu hỏi hiện ngay, nghe tuỳ ý, có lời thoại, báo trang tắt đồng hồ, nhớ lựa chọn', async () => {
    const user = userEvent.setup()
    const onRelaxed = vi.fn()
    const { unmount } = render(<Harness teil={teil2} onRelaxed={onRelaxed} />)
    await user.click(screen.getByRole('radio', { name: /Luyện thoải mái/ }))
    expect(onRelaxed).toHaveBeenLastCalledWith(true)
    expect(screen.getByText('Sie arbeitet seit zehn Jahren als Tierärztin.')).toBeInTheDocument()
    expect(screen.getByText('Nghe không giới hạn')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Xem lời thoại/ }))
    expect(screen.getByText('Seit fünf Jahren.')).toBeInTheDocument()
    unmount()

    render(<Harness teil={teil2} />)
    expect(await screen.findByText(/Đang luyện thoải mái/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Chuyển sang như thi thật' }))
    expect(screen.getByText('Câu hỏi hiện khi bắt đầu')).toBeInTheDocument()
  })
})
