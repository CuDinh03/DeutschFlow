import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl'
import landingVi from '../../../messages/v2/landing.vi.json'
import { GaLogo } from '@/components/ui-v2/GaLogo'
import { BrandPageLoader } from '@/components/ui-v2/BrandPageLoader'
import { AppStoreBadge, AppStoreHeaderPill } from '@/components/landing-v2/AppDownload'
import { APP_STORE_URL } from '@/components/landing-v2/links'
import { GaOtpField } from '@/app/v2/authShared'

const trackEvent = vi.fn()
vi.mock('@/hooks/useTracking', () => ({ useTracking: () => ({ trackEvent }) }))

beforeEach(() => {
  trackEvent.mockReset()
})

describe('PR 1 — Nhận diện thương hiệu v3.4 (GaLogo & BrandPageLoader)', () => {
  it('GaLogo giữ chữ Flow màu var(--ga-brand-red) trên cả nền sáng lẫn nền tối', () => {
    const { rerender, container } = render(<GaLogo tone="light" />)
    expect(container.textContent).toBe('myDeutschFlow')
    const lightFlow = screen.getByText('Flow')
    expect(lightFlow.getAttribute('style')).toContain('var(--ga-brand-red)')

    rerender(<GaLogo tone="dark" showTagline />)
    const darkFlow = screen.getByText('Flow')
    expect(darkFlow.getAttribute('style')).toContain('var(--ga-brand-red)')
    expect(screen.getByText('LEARN GERMAN. FIND YOUR FLOW.')).toBeInTheDocument()
  })

  it('BrandPageLoader hiển thị vòng xoay quỹ đạo chữ D vát cạnh với role="status"', () => {
    const { container } = render(<BrandPageLoader label="Đang tải myDeutschFlow" />)
    const loader = screen.getByRole('status')
    expect(loader).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Đang tải myDeutschFlow')).toBeInTheDocument()
    expect(container.querySelector('.df-orbit-cw')).not.toBeNull()
    expect(container.querySelector('.df-orbit-ccw')).not.toBeNull()
    expect(container.querySelector('.df-flow-tri')).not.toBeNull()
  })
})

describe('PR 1 — Điểm đặt App Store mới & Lưới OTP 6 ô chống tràn viền', () => {
  it('AppStoreHeaderPill và AppStoreBadge trỏ đúng id6785281013 và bắn event theo placement', async () => {
    const user = userEvent.setup()
    render(
      <NextIntlClientProvider locale="vi" messages={{ v2: { ...landingVi } } as unknown as AbstractIntlMessages}>
        <div>
          <AppStoreHeaderPill />
          <AppStoreBadge placement="brand_page" />
        </div>
      </NextIntlClientProvider>,
    )

    const pill = screen.getByRole('link', { name: /App iOS/ })
    expect(pill).toHaveAttribute('href', APP_STORE_URL)
    pill.addEventListener('click', (e) => e.preventDefault())
    await user.click(pill)
    expect(trackEvent).toHaveBeenCalledWith('landing_app_store_clicked', { placement: 'header' })

    const badge = screen.getByRole('link', { name: /Tải miễn phí trên App Store/ })
    expect(badge).toHaveAttribute('href', APP_STORE_URL)
    badge.addEventListener('click', (e) => e.preventDefault())
    await user.click(badge)
    expect(trackEvent).toHaveBeenCalledWith('landing_app_store_clicked', { placement: 'brand_page' })
  })

  it('GaOtpField dùng lưới .ga-otp-grid và 6 ô .ga-otp-cell kèm min-w-0 chống tràn viền', () => {
    const { container } = render(
      <GaOtpField label="Mã xác minh" value="48" onChange={() => undefined} error="Mã chưa đủ" />,
    )
    const input = screen.getByLabelText('Mã xác minh')
    expect(input.className).toContain('min-w-0')
    expect(input).not.toHaveAttribute('maxlength')
    expect(container.querySelector('.ga-otp-grid')).not.toBeNull()

    const cells = container.querySelectorAll('[data-slot="otp-cell"]')
    expect(cells).toHaveLength(6)
    expect(cells[0]).toHaveAttribute('data-filled', 'true')
    expect(cells[1]).toHaveAttribute('data-filled', 'true')
    expect(cells[2]).not.toHaveAttribute('data-filled')
    expect(cells[0]).toHaveAttribute('data-error', 'true')
  })

  it('galerie.css không gán trực tiếp background-color/color trong .ga-scope .ga-public để không đè bg-ga-ink trên Footer & AppDownloadBand', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../../styles/galerie.css'), 'utf8')
    const tokenBlock = css.match(/\.ga-scope\s+\.ga-public\s*\{([^}]+)\}/)
    expect(tokenBlock).not.toBeNull()
    expect(tokenBlock![1]).not.toMatch(/background-color\s*:/)
    expect(tokenBlock![1]).not.toMatch(/(^|\s|;)color\s*:/)
  })
})
