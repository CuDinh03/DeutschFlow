/**
 * Trang "Về chúng tôi" kể thành câu chuyện (làm mới trang công khai 19/10/2026).
 *
 * Chốt: có mục "Về chúng tôi" trên menu và đánh dấu trang hiện tại; đủ ba chương; ảnh người làm sản
 * phẩm có alt; CTA vào phễu onboarding; bản tiếng Anh trỏ link theo `/en/`.
 */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl'
import { AboutStory } from '@/components/landing-v2/AboutStory'
import landingVi from '../../../messages/v2/landing.vi.json'
import landingEn from '../../../messages/v2/landing.en.json'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// Import tĩnh ảnh trả về chuỗi trong vitest — mock next/image thành <img> giữ alt (xem GaLanding.test).
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
      return React.cloneElement(child, { className: [child.props.className, className].filter(Boolean).join(' ') })
    }
    return <span className={className}>{children}</span>
  },
}))
vi.mock('@/components/ui-v2/LanguageToggle', () => ({ LanguageToggle: () => <span data-testid="lang-toggle" /> }))

const renderAbout = (locale: 'vi' | 'en' = 'vi') =>
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ v2: { ...(locale === 'vi' ? landingVi : landingEn) } } as unknown as AbstractIntlMessages}
    >
      <AboutStory />
    </NextIntlClientProvider>,
  )

describe('AboutStory — Về chúng tôi', () => {
  it('menu có mục Về chúng tôi, đánh dấu trang hiện tại', () => {
    renderAbout()
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' })
    const about = within(nav).getByRole('link', { name: 'Về chúng tôi' })
    expect(about.getAttribute('href')).toBe('/about/')
    expect(about.getAttribute('aria-current')).toBe('page')
    // Các mục còn lại trỏ về neo trên trang chủ, không phải neo trong trang này.
    expect(within(nav).getByRole('link', { name: 'Phỏng vấn theo nghề' }).getAttribute('href')).toBe('/#interview')
  })

  it('kể đủ bốn chương và có ảnh người làm sản phẩm', () => {
    renderAbout()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('đang học tiếng Đức.')
    for (const n of ['01', '02', '03', '04']) {
      expect(screen.getAllByText(`Chương ${n}`).length).toBeGreaterThan(0)
    }
    expect(screen.getByAltText('Đinh Huy Cự, người làm myDeutschFlow, mặc vest xám')).toBeTruthy()
    expect(screen.getByAltText('Ảnh chân dung Đinh Huy Cự')).toBeTruthy()
  })

  it('dòng thời gian: commit đầu tiên 12/04/2026, một mình làm', () => {
    renderAbout()
    expect(screen.getByText('12/04/2026')).toBeTruthy()
    expect(screen.getByText('Dòng code đầu tiên')).toBeTruthy()
    expect(screen.getByText(/do một mình mình làm/)).toBeTruthy()
  })

  it('nhà tuyển dụng ghi Sắp có — đúng sổ lời hứa', () => {
    renderAbout()
    const item = screen.getByRole('heading', { name: /Nhà tuyển dụng ở Đức/ })
    expect(item.textContent).toContain('Sắp có')
  })

  it('CTA cuối trang vào phễu onboarding, email liên hệ đúng', () => {
    renderAbout()
    const ctas = screen.getAllByRole('link', { name: /Học thử miễn phí$/ })
    expect(ctas.length).toBeGreaterThanOrEqual(2) // header + lời ký tên
    for (const a of ctas) expect(a.getAttribute('href')).toBe('/v2/onboarding')
    expect(screen.getByRole('link', { name: 'support@mydeutschflow.com' }).getAttribute('href')).toBe(
      'mailto:support@mydeutschflow.com',
    )
  })

  it('bản tiếng Anh: chữ tiếng Anh, link theo /en/', () => {
    renderAbout('en')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('learning German.')
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(nav).getByRole('link', { name: 'About us' }).getAttribute('href')).toBe('/en/about/')
    expect(within(nav).getByRole('link', { name: 'Interview by trade' }).getAttribute('href')).toBe('/en/#interview')
  })
})
