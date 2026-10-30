import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl'
import { CastSection } from '@/components/landing-v2/CastSection'
import { INTERVIEW_SAMPLES, fillPosition } from '@/data/interviewSamples'
import { PERSONA_LIST } from '@/lib/personas'
import landingVi from '../../../messages/v2/landing.vi.json'

vi.mock('@/components/ui-v2', () => ({
  GaCap: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

const setReducedMotion = (matches: boolean) => {
  vi.stubGlobal('matchMedia', () => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
}

const renderCast = () =>
  render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...landingVi } } as unknown as AbstractIntlMessages}>
      <CastSection />
    </NextIntlClientProvider>,
  )

const expectedLine = (id: 'lena' | 'klaus') => {
  const p = PERSONA_LIST.find((x) => x.id === id)!
  return fillPosition(INTERVIEW_SAMPLES[id][0], p.interviewPositions?.[0]?.labelDe ?? p.role)
}

describe('CastSection — nhân vật cất tiếng', () => {
  beforeEach(() => setReducedMotion(false))
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('HTML ban đầu đã có nguyên câu của Klaus, không chờ JS hay cuộn trang', () => {
    renderCast()
    expect(screen.getByText(`Klaus: ${expectedLine('klaus')}`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xem Klaus hỏi gì' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('chọn một thẻ: người đó nói đúng câu trong ngân hàng, miệng dừng khi chạy chữ xong', () => {
    vi.useFakeTimers()
    renderCast()
    const card = screen.getByRole('button', { name: 'Xem Lena hỏi gì' })
    const closed = card.querySelector('svg')?.innerHTML

    fireEvent.click(card)
    expect(screen.getByText(`Lena: ${expectedLine('lena')}`)).toBeInTheDocument()
    expect(card).toHaveAttribute('aria-pressed', 'true')

    act(() => { vi.advanceTimersByTime(120) })
    expect(card.querySelector('svg')?.innerHTML).not.toBe(closed)

    act(() => { vi.advanceTimersByTime(10_000) })
    expect(card.querySelector('svg')?.innerHTML).toBe(closed)
  })

  it('giảm chuyển động: đổi câu ngay, không chạy chữ, miệng đứng yên', () => {
    setReducedMotion(true)
    vi.useFakeTimers()
    renderCast()
    const card = screen.getByRole('button', { name: 'Xem Lena hỏi gì' })
    const closed = card.querySelector('svg')?.innerHTML

    fireEvent.click(card)
    act(() => { vi.advanceTimersByTime(120) })

    const visual = document.querySelector('p[aria-hidden]') as HTMLElement
    expect(within(visual).queryByText(/./, { selector: '.invisible' })).toBeNull()
    expect(visual.textContent).toContain(expectedLine('lena'))
    expect(card.querySelector('svg')?.innerHTML).toBe(closed)
  })

  it('giữ nguyên hai nghề Sắp có của sổ lời hứa', () => {
    renderCast()
    expect(screen.getAllByText('Sắp có')).toHaveLength(2)
  })
})
