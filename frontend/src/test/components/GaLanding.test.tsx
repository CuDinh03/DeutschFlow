/**
 * Tests for the GaLanding mobile navigation (hamburger menu).
 *
 * ui-v2 primitives and next/link are mocked so the full landing renders in
 * jsdom. The mobile menu panel is asserted via its #ga-mobile-menu id because
 * the desktop nav renders the same link labels (hidden only by CSS).
 */
import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl'
import { GaLanding } from '@/components/landing-v2/GaLanding'
import landingVi from '../../../messages/v2/landing.vi.json'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

/**
 * next/image phải mock ở jsdom vì ảnh chụp sản phẩm được import TĨNH (`landingShots.ts`).
 * Trong Next, import tĩnh trả về `{src, width, height}` — đó là thứ cho next/image biết tỉ lệ để
 * giữ chỗ. Vite/vitest thì trả về một CHUỖI đường dẫn, nên component thật ném lỗi
 * `Image ... is missing required "width" property` và làm đỏ cả tệp test vì một lý do không liên
 * quan đến hành vi đang kiểm. Mock thành <img> giữ nguyên `alt` — các phép đo a11y vẫn đúng.
 */
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string | { src: string }; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : src.src} alt={alt} />
  ),
}))

vi.mock('@/components/ui-v2', () => ({
  GaLogo: () => <span>myDeutschFlow</span>,
  GaCap: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  GaBtn: ({ children, className, asChild }: { children?: React.ReactNode; className?: string; asChild?: boolean }) => {
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>
      return React.cloneElement(child, {
        className: [child.props.className, className].filter(Boolean).join(' '),
      })
    }
    return <span className={className}>{children}</span>
  },
}))

// 06/09/2026 (F-I18N-02a): landing đọc catalog v2.landing → render trong provider với bản vi
// (nguồn sự thật); LanguageToggle (VI/EN/DE) mock để không kéo router/api vào jsdom.
vi.mock('@/components/ui-v2/LanguageToggle', () => ({ LanguageToggle: () => <span data-testid="lang-toggle" /> }))

const renderLanding = () =>
  render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...landingVi } } as unknown as AbstractIntlMessages}>
      <GaLanding />
    </NextIntlClientProvider>,
  )

const menuPanel = () => document.getElementById('ga-mobile-menu')

describe('GaLanding — menu mobile', () => {
  it('mở và đóng menu bằng nút hamburger, đồng bộ aria-expanded', () => {
    renderLanding()

    expect(menuPanel()).toBeNull()
    const openBtn = screen.getByRole('button', { name: 'Mở menu' })
    expect(openBtn.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(openBtn)
    expect(menuPanel()).not.toBeNull()
    const closeBtn = screen.getByRole('button', { name: 'Đóng menu' })
    expect(closeBtn.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(closeBtn)
    expect(menuPanel()).toBeNull()
  })

  it('đóng menu khi chọn một liên kết điều hướng', () => {
    renderLanding()

    fireEvent.click(screen.getByRole('button', { name: 'Mở menu' }))
    const panel = menuPanel()
    expect(panel).not.toBeNull()

    fireEvent.click(within(panel as HTMLElement).getByText('Lộ trình học'))
    expect(menuPanel()).toBeNull()
  })

  it('menu chứa đủ liên kết điều hướng, Đăng nhập và CTA Học thử', () => {
    renderLanding()

    fireEvent.click(screen.getByRole('button', { name: 'Mở menu' }))
    const panel = within(menuPanel() as HTMLElement)

    expect(panel.getByText('Tính năng')).toBeDefined()
    expect(panel.getByText('Luyện thi')).toBeDefined()
    expect(panel.getByText('Dành cho giáo viên')).toBeDefined()
    expect(panel.getByText('Đăng nhập')).toBeDefined()
    expect(panel.getByText('Học thử miễn phí')).toBeDefined()
  })

  it('CTA phụ dẫn tới nội dung thật thay vì giả làm video demo', () => {
    renderLanding()

    // Bản funnel value-first: CTA demo duy nhất là bảng giáo viên và trỏ route thật,
    // không còn nút giả làm video ("Xem demo 90 giây" đã bị gỡ từ P0.2).
    const cta = screen.getByRole('link', { name: 'Xem demo bảng giáo viên →' })
    expect(cta).toHaveAttribute('href', '/v2/login')
    expect(screen.queryByText('Xem demo 90 giây')).not.toBeInTheDocument()
  })

  it('các control chính trên header mobile có vùng chạm tối thiểu 44px', () => {
    renderLanding()

    expect(screen.getByRole('button', { name: 'Mở menu' }).className).toContain('h-11')
    expect(screen.getByRole('link', { name: /Học thử Học thử miễn phí/ }).className).toContain('h-11')
  })

  it('không dùng số liệu hoặc lời chứng thực chưa có nguồn', () => {
    renderLanding()

    expect(screen.queryByText('92%')).not.toBeInTheDocument()
    expect(screen.queryByText('2.400+')).not.toBeInTheDocument()
    expect(screen.queryByText('Nguyễn Thị Lan')).not.toBeInTheDocument()
  })
})
