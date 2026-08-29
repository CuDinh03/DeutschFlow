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
import { GaLanding } from '@/components/landing-v2/GaLanding'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
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

const menuPanel = () => document.getElementById('ga-mobile-menu')

describe('GaLanding — menu mobile', () => {
  it('mở và đóng menu bằng nút hamburger, đồng bộ aria-expanded', () => {
    render(<GaLanding />)

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
    render(<GaLanding />)

    fireEvent.click(screen.getByRole('button', { name: 'Mở menu' }))
    const panel = menuPanel()
    expect(panel).not.toBeNull()

    fireEvent.click(within(panel as HTMLElement).getByText('Lộ trình học'))
    expect(menuPanel()).toBeNull()
  })

  it('menu chứa đủ liên kết điều hướng, Đăng nhập và CTA Học thử', () => {
    render(<GaLanding />)

    fireEvent.click(screen.getByRole('button', { name: 'Mở menu' }))
    const panel = within(menuPanel() as HTMLElement)

    expect(panel.getByText('Tính năng')).toBeDefined()
    expect(panel.getByText('Luyện thi')).toBeDefined()
    expect(panel.getByText('Dành cho giáo viên')).toBeDefined()
    expect(panel.getByText('Đăng nhập')).toBeDefined()
    expect(panel.getByText('Học thử miễn phí')).toBeDefined()
  })

  it('CTA phụ dẫn tới nội dung thật thay vì giả làm video demo', () => {
    render(<GaLanding />)

    const cta = screen.getByRole('link', { name: 'Xem cách hoạt động' })
    expect(cta).toHaveAttribute('href', '#how-it-works')
    expect(screen.queryByText('Xem demo 90 giây')).not.toBeInTheDocument()
  })

  it('các control chính trên header mobile có vùng chạm tối thiểu 44px', () => {
    render(<GaLanding />)

    expect(screen.getByRole('button', { name: 'Mở menu' }).className).toContain('h-11')
    expect(screen.getByRole('link', { name: /Học thử Học thử miễn phí/ }).className).toContain('h-11')
  })

  it('không dùng số liệu hoặc lời chứng thực chưa có nguồn', () => {
    render(<GaLanding />)

    expect(screen.queryByText('92%')).not.toBeInTheDocument()
    expect(screen.queryByText('2.400+')).not.toBeInTheDocument()
    expect(screen.queryByText('Nguyễn Thị Lan')).not.toBeInTheDocument()
  })
})
