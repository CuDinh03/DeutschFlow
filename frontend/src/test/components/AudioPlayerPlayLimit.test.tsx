/**
 * Giới hạn số lần nghe (đề telc: HV Teil 1 một lần, Teil 2–3 hai lần).
 *
 * Hai điều dễ làm sai và làm hỏng bài thi của người học:
 *   • tính "phát tiếp sau khi tạm dừng" thành một lượt mới ⇒ mất lượt vì lỡ tay;
 *   • siết cả màn XEM LẠI sau khi nộp, nơi không có lý do gì để siết.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const tts = vi.hoisted(() => ({
  state: 'idle' as string,
  speak: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn(),
}))

vi.mock('@/hooks/useGermanTTS', () => ({
  useGermanTTS: () => ({ state: tts.state, progress: 0, speak: tts.speak, pause: tts.pause, resume: tts.resume, stop: tts.stop }),
}))
vi.mock('next-intl', async () => {
  const { catalogT } = await import('@/test/intlCatalog')
  return { useTranslations: (ns?: string) => catalogT(ns, 'vi'), useLocale: () => 'vi' }
})

import { AudioPlayer } from '@/components/exam/AudioPlayer'

beforeEach(() => {
  tts.state = 'idle'
  tts.speak.mockClear()
})

describe('số lần nghe', () => {
  it('không khai max_plays thì nghe bao nhiêu lần cũng được — mọi đề Goethe giữ nguyên', async () => {
    render(<AudioPlayer script="Guten Tag." />)
    const nút = screen.getByRole('button', { name: /Phát audio/i })

    await userEvent.click(nút)
    await userEvent.click(nút)
    await userEvent.click(nút)

    expect(tts.speak).toHaveBeenCalledTimes(3)
    expect(nút).not.toBeDisabled()
    expect(screen.queryByText(/Hết lượt nghe/)).not.toBeInTheDocument()
  })

  it('HV Teil 1 chỉ một lượt: phát xong thì khoá nút và nói rõ lý do', async () => {
    render(<AudioPlayer script="Guten Tag." maxPlays={1} />)
    const nút = screen.getByRole('button', { name: /Phát audio/i })
    expect(screen.getByText(/Còn 1 lượt nghe/)).toBeInTheDocument()

    await userEvent.click(nút)

    expect(tts.speak).toHaveBeenCalledTimes(1)
    expect(nút).toBeDisabled()
    expect(screen.getByText(/đúng như đề thật/)).toBeInTheDocument()
  })

  it('bấm thêm khi đã hết lượt thì không phát nữa', async () => {
    render(<AudioPlayer script="Guten Tag." maxPlays={1} />)
    const nút = screen.getByRole('button', { name: /Phát audio/i })

    await userEvent.click(nút)
    await userEvent.click(nút)

    expect(tts.speak).toHaveBeenCalledTimes(1)
  })

  it('tạm dừng rồi phát tiếp KHÔNG tính là lượt mới', async () => {
    const { rerender } = render(<AudioPlayer script="Guten Tag." maxPlays={2} />)
    const nút = screen.getByRole('button', { name: /Phát audio/i })

    await userEvent.click(nút)          // lượt 1
    tts.state = 'playing'
    rerender(<AudioPlayer script="Guten Tag." maxPlays={2} />)
    await userEvent.click(nút)          // tạm dừng
    expect(tts.pause).toHaveBeenCalled()

    tts.state = 'paused'
    rerender(<AudioPlayer script="Guten Tag." maxPlays={2} />)
    await userEvent.click(nút)          // phát tiếp
    expect(tts.resume).toHaveBeenCalled()

    tts.state = 'done'
    rerender(<AudioPlayer script="Guten Tag." maxPlays={2} />)
    expect(screen.getByText(/Còn 1 lượt nghe/)).toBeInTheDocument()  // vẫn còn 1, không mất oan
  })
})
