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
  GaBtn: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
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
})
