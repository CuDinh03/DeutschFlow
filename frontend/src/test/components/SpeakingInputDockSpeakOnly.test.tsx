/**
 * SpeakingInputDock ở lớp có chương trình luyện (đặc tả luyendeu ORG-65, AC-ORG-46/47):
 *   - không có nút "Gõ thay", thay bằng câu nhắc;
 *   - chữ từ mic hiện trong ô CHỈ ĐỌC, vẫn gửi được; nút đóng thành "Bỏ câu vừa ghi" và xoá chữ;
 *   - mic bị chặn → câu hướng dẫn cho phép micro, không có đường gõ.
 * Học viên ngoài lớp như vậy giữ nguyên nút "Gõ thay". Catalog vi THẬT để canh khoá i18n.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/dom'
import { describe, it, expect, vi } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import vi_ from '../../../messages/vi.json'
import { SpeakingInputDock } from '@/components/features/ai-speaking/SpeakingInputDock'

vi.mock('@/lib/haptics', () => ({ lightImpact: () => {} }))

type DockProps = React.ComponentProps<typeof SpeakingInputDock>

function renderDock(over: Partial<DockProps> = {}) {
  const props: DockProps = {
    inputText: '',
    onInputChange: vi.fn(),
    onSubmit: vi.fn(),
    isListening: false,
    isTranscribing: false,
    isEvaluatingPhoneme: false,
    streamIdle: true,
    repairBlocking: false,
    companionName: 'Lukas',
    inputTip: 'tip',
    onToggleMic: vi.fn(),
    ...over,
  }
  render(
    <NextIntlClientProvider locale="vi" messages={vi_ as never}>
      <SpeakingInputDock {...props} />
    </NextIntlClientProvider>,
  )
  return props
}

const chat = vi_.speaking.chat

describe('SpeakingInputDock — lớp chỉ nói', () => {
  it('học viên thường vẫn có nút gõ thay', () => {
    renderDock()
    expect(screen.getByText(chat.typeInstead)).toBeTruthy()
    expect(screen.queryByTestId('speak-only-hint')).toBeNull()
  })

  it('lớp chỉ nói: không có nút gõ thay, có câu nhắc', () => {
    renderDock({ speakOnly: true })
    expect(screen.queryByText(chat.typeInstead)).toBeNull()
    expect(screen.getByTestId('speak-only-hint').textContent).toBe(chat.speakOnlyHint)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('lớp chỉ nói: chữ từ mic chỉ đọc, gửi được, nút đóng xoá chữ', () => {
    const p = renderDock({ speakOnly: true, inputText: 'Ich heiße Lan.' })
    const box = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(box.readOnly).toBe(true)
    fireEvent.click(screen.getByLabelText(chat.sendMessage))
    expect(p.onSubmit).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByLabelText(chat.speakOnlyDiscard))
    expect(p.onInputChange).toHaveBeenCalledWith('')
  })

  it('lớp chỉ nói + mic bị chặn: hướng dẫn cho phép micro, không có đường gõ', () => {
    renderDock({ speakOnly: true, micBlocked: true })
    expect(screen.getByTestId('speak-only-hint').textContent).toBe(chat.speakOnlyMicBlocked)
    expect(screen.queryByText(chat.typeInstead)).toBeNull()
  })
})
