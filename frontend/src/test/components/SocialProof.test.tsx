/** Đợt B (08/11/2026): khung nhận xét ẩn — không hiện khi cờ tắt hoặc chưa đủ dữ liệu thật. */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl'
import landingVi from '../../../messages/v2/landing.vi.json'
import { SHOW_SOCIAL_PROOF, SocialProof } from '@/components/landing-v2/SocialProof'

vi.mock('@/components/ui-v2', () => ({ GaCap: ({ children }: { children?: React.ReactNode }) => <span>{children}</span> }))

const withProof = (items: unknown[], stats: unknown[]) => ({
  v2: { landing: { ...landingVi.landing, socialProof: { ...landingVi.landing.socialProof, items, stats } } },
}) as unknown as AbstractIntlMessages

const renderProof = (messages: AbstractIntlMessages, show: boolean) =>
  render(<NextIntlClientProvider locale="vi" messages={messages}><SocialProof show={show} /></NextIntlClientProvider>)

const T = (name: string) => ({ name, job: 'Koch', level: 'B1', result: `${name} đỗ phỏng vấn` })

describe('SocialProof', () => {
  it('cờ đang tắt và catalog chưa có nhận xét thật — không bịa nội dung', () => {
    expect(SHOW_SOCIAL_PROOF).toBe(false)
    expect(landingVi.landing.socialProof.items).toHaveLength(0)
    const { container } = renderProof(withProof([], []), true)
    expect(container.innerHTML).toBe('')
  })

  it('bật cờ nhưng chưa đủ 3 nhận xét + 1 con số thì vẫn không hiện', () => {
    const { container } = renderProof(withProof([T('A'), T('B')], [{ value: '120', label: 'buổi' }]), true)
    expect(container.innerHTML).toBe('')
  })

  it('đủ dữ liệu và bật cờ: hiện 3 thẻ + con số', () => {
    renderProof(withProof([T('A'), T('B'), T('C')], [{ value: '120', label: 'buổi luyện' }]), true)
    expect(screen.getByText('“A đỗ phỏng vấn”')).toBeTruthy()
    expect(screen.getByText('120')).toBeTruthy()
  })
})
