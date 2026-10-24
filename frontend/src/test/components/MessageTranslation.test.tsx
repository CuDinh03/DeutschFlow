/** K4 A+B+E: nút "Dịch" dưới câu trợ lý trong phiên nói — gọi backend một lần, sau đó chỉ ẩn/hiện. */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl'
import vi_ from '../../../messages/vi.json'
import en from '../../../messages/en.json'

const translateMock = vi.fn()
vi.mock('@/lib/aiSpeakingApi', () => ({
  aiSpeakingApi: { translateMessage: (...a: unknown[]) => translateMock(...a) },
}))

import { MessageTranslation } from '@/components/speaking/MessageTranslation'

function renderAt(locale: 'vi' | 'en' | 'de') {
  const messages = (locale === 'en' ? en : vi_) as unknown as AbstractIntlMessages
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <MessageTranslation sessionId={12} messageId={345} />
    </NextIntlClientProvider>,
  )
}

describe('MessageTranslation', () => {
  beforeEach(() => translateMock.mockReset())

  it('bấm "Dịch": gọi đúng phiên/tin/ngôn ngữ, hiện bản dịch; bấm lại chỉ ẩn, không gọi lại', async () => {
    translateMock.mockResolvedValue('Bạn ghi chép bàn giao ca thế nào?')
    renderAt('vi')

    fireEvent.click(screen.getByRole('button', { name: 'Dịch' }))
    expect(await screen.findByText('Bạn ghi chép bàn giao ca thế nào?')).toBeTruthy()
    expect(translateMock).toHaveBeenCalledWith(12, 345, 'vi')

    fireEvent.click(screen.getByRole('button', { name: 'Ẩn bản dịch' }))
    expect(screen.queryByText('Bạn ghi chép bàn giao ca thế nào?')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Dịch' }))
    expect(screen.getByText('Bạn ghi chép bàn giao ca thế nào?')).toBeTruthy()
    expect(translateMock).toHaveBeenCalledTimes(1)
  })

  it('giao diện tiếng Anh dịch sang tiếng Anh; lỗi thì cho thử lại', async () => {
    translateMock.mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce('How do you document a handover?')
    renderAt('en')

    fireEvent.click(screen.getByRole('button', { name: 'Translate' }))
    fireEvent.click(await screen.findByRole('button', { name: "Couldn't translate, tap to retry" }))
    expect(await screen.findByText('How do you document a handover?')).toBeTruthy()
    expect(translateMock).toHaveBeenLastCalledWith(12, 345, 'en')
  })

  it('giao diện tiếng Đức: không có nút', () => {
    const { container } = renderAt('de')
    expect(container.textContent).toBe('')
  })
})
