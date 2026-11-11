/** Xưởng đề — nút chọn kênh tạo đề (Fireworks AI / 9Router) và tham số ?channel của các thao tác AI. */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminContentVi from '../../../messages/v2/adminContent.vi.json'
import adminContentEn from '../../../messages/v2/adminContent.en.json'
import adminContentDe from '../../../messages/v2/adminContent.de.json'

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: http, apiMessage: (e: unknown) => String(e) }))

import { ChannelSwitch, shortModel } from '@/components/admin/exam-studio/ChannelSwitch'
import { generateItems, getStudioChannel, setStudioChannel, verifyDraft, writeText } from '@/lib/adminExamStudioApi'

const FIREWORKS = { id: 'FIREWORKS', configured: true, writerModel: 'accounts/fireworks/models/kimi-k3', judgeModel: 'accounts/fireworks/models/deepseek-v4p1-flash' }
const ROUTER_ON = { id: 'ROUTER', configured: true, writerModel: 'claude-opus', judgeModel: 'grok-4' }
const ROUTER_OFF = { id: 'ROUTER', configured: false, writerModel: null, judgeModel: null }

function show() {
  render(
    <NextIntlClientProvider locale="vi" messages={{ v2: adminContentVi }} onError={() => undefined}>
      <ChannelSwitch />
    </NextIntlClientProvider>,
  )
}

describe('ChannelSwitch', () => {
  beforeEach(() => {
    http.get.mockReset()
    http.post.mockReset().mockResolvedValue({ data: {} })
    window.localStorage.clear()
    setStudioChannel('FIREWORKS')
  })

  it('chọn 9Router: nhớ lựa chọn, và mọi thao tác AI gửi ?channel=ROUTER', async () => {
    http.get.mockResolvedValue({ data: [FIREWORKS, ROUTER_ON] })
    show()
    const fw = await screen.findByRole('radio', { name: 'Fireworks AI' })
    expect(fw).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Viết: kimi-k3 · Chấm: deepseek-v4p1-flash')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: '9Router' }))
    expect(screen.getByRole('radio', { name: '9Router' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Viết: claude-opus · Chấm: grok-4')).toBeInTheDocument()
    expect(getStudioChannel()).toBe('ROUTER')
    expect(window.localStorage.getItem('df.examStudio.channel')).toBe('ROUTER')

    await writeText(5)
    await generateItems(5)
    await verifyDraft(5)
    for (const call of http.post.mock.calls) expect(call[2]).toMatchObject({ params: { channel: 'ROUTER' } })
    expect(http.post.mock.calls.map((c) => c[0])).toEqual([
      '/admin/exam-studio/drafts/5/text', '/admin/exam-studio/drafts/5/items', '/admin/exam-studio/drafts/5/verify',
    ])
  })

  it('9Router chưa cấu hình: nút không bấm được, có dòng hướng dẫn; lựa chọn cũ bị đưa về Fireworks', async () => {
    setStudioChannel('ROUTER')
    http.get.mockResolvedValue({ data: [FIREWORKS, ROUTER_OFF] })
    show()
    const router = await screen.findByRole('radio', { name: '9Router' })
    expect(router).toBeDisabled()
    expect(screen.getByText(/Kênh 9Router bật được sau khi/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Fireworks AI' })).toHaveAttribute('aria-checked', 'true')
    expect(getStudioChannel()).toBe('FIREWORKS')

    await generateItems(5)
    expect(http.post.mock.calls[0][2]).toMatchObject({ params: { channel: 'FIREWORKS' } })
  })

  it('shortModel bỏ tiền tố nhà cung cấp; ba ngôn ngữ đủ khoá', () => {
    expect(shortModel('accounts/fireworks/models/kimi-k3')).toBe('kimi-k3')
    expect(shortModel('claude-opus')).toBe('claude-opus')
    expect(shortModel(null)).toBe('')
    for (const msg of [adminContentVi, adminContentEn, adminContentDe]) {
      const ch = (msg as { adminContent: { examStudio: { channel: Record<string, string> } } }).adminContent.examStudio.channel
      for (const k of ['label', 'FIREWORKS', 'ROUTER', 'models', 'notConfigured', 'routerHint']) expect(ch[k]).toBeTruthy()
    }
  })
})
