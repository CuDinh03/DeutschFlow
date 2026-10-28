/**
 * Lối tải ứng dụng iPhone trên trang chủ (26/10/2026). Render với catalog tiếng Việt thật
 * (v2.landing), mock PostHog (`useTracking`).
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl'
import landingVi from '../../../messages/v2/landing.vi.json'

const trackEvent = vi.fn()
vi.mock('@/hooks/useTracking', () => ({ useTracking: () => ({ trackEvent }) }))

import { AppDownloadBand, AppStoreFooterLink, AppStoreHeroLink } from '@/components/landing-v2/AppDownload'
import { APP_STORE_URL } from '@/components/landing-v2/links'

function renderWithCatalog(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...landingVi } } as unknown as AbstractIntlMessages}>
      {ui}
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  trackEvent.mockReset()
})

describe('AppDownload — lối tải app iPhone', () => {
  it('link App Store đúng app, mở thẻ mới và không lộ window.opener', () => {
    renderWithCatalog(<AppDownloadBand />)
    const link = screen.getByRole('link', { name: /Tải trên App Store/ })
    expect(link).toHaveAttribute('href', APP_STORE_URL)
    expect(APP_STORE_URL).toBe('https://apps.apple.com/app/id6785281013')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('tên đọc được chứa chữ đang hiện và báo mở thẻ mới (WCAG 2.5.3)', () => {
    renderWithCatalog(<AppStoreHeroLink />)
    expect(screen.getByRole('link', { name: 'Có ứng dụng cho iPhone (mở trong thẻ mới)' })).toBeInTheDocument()
  })

  it('dải app có tiêu đề làm nhãn cho section và đủ ba ý', () => {
    renderWithCatalog(<AppDownloadBand />)
    expect(screen.getByRole('region', { name: 'Luyện phỏng vấn ngay trên điện thoại' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it.each([
    ['app_band', <AppDownloadBand key="band" />, /Tải trên App Store/],
    ['hero', <AppStoreHeroLink key="hero" />, /Có ứng dụng cho iPhone/],
    ['footer', <AppStoreFooterLink key="footer" />, /Ứng dụng iPhone/],
  ])('bấm ở vị trí %s bắn landing_app_store_clicked kèm vị trí', async (placement, ui, name) => {
    const user = userEvent.setup()
    renderWithCatalog(ui)
    const link = screen.getByRole('link', { name })
    // jsdom không điều hướng thật; chặn mặc định để không cảnh báo "navigation not implemented".
    link.addEventListener('click', (e) => e.preventDefault())
    await user.click(link)
    expect(trackEvent).toHaveBeenCalledWith('landing_app_store_clicked', { placement })
  })
})
