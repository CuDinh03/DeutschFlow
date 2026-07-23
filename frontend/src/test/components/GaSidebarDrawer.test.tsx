/**
 * Tests cho hành vi NGĂN KÉO mobile của GaSidebar + GaSidebarToggle qua GaShellNavProvider.
 *
 * Ngăn kéo dùng transform (`-translate-x-full` khi đóng ↔ `translate-x-0` khi mở) nên jsdom
 * không tính được vị trí thật; ta kiểm tra qua className của <aside id="ga-shell-sidebar"> và
 * aria-expanded của nút hamburger. next-intl / store / authSession / next-link được mock để
 * component chạy trong jsdom.
 */
import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { GaShellNavProvider, GaSidebarToggle, GaSidebar } from '@/components/ui-v2'
import { ROLE_NAV } from '@/components/ui-v2'

vi.mock('next/link', () => ({
  default: ({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault() // chặn jsdom điều hướng thật (chỉ test hành vi đóng ngăn kéo)
        onClick?.()
      }}
    >
      {children}
    </a>
  ),
}))

vi.mock('next/navigation', () => ({ usePathname: () => '/v2/student/dashboard' }))

// Mock đọc catalog vi THẬT (chrome area) thay vì trả key thô: GaSidebarToggle giờ lấy aria qua
// t('openNavAria') nên test tìm nút theo accessible name phải thấy đúng bản dịch — và không gãy
// nếu wording trong catalog đổi. `has` giữ false cho key lồng → GaSidebar vẫn dùng fallback VN
// của nav.ts như hành vi cũ.
vi.mock('next-intl', async () => {
  const chrome = (await import('../../../messages/v2/chrome.vi.json')).default as Record<string, unknown>
  const resolve = (ns?: string): Record<string, unknown> | undefined => {
    if (!ns) return chrome
    let node: unknown = chrome
    for (const p of ns.replace(/^v2\.?/, '').split('.').filter(Boolean)) {
      node = (node as Record<string, unknown> | undefined)?.[p]
    }
    return node as Record<string, unknown> | undefined
  }
  return {
    useTranslations: (ns?: string) => {
      const table = resolve(ns)
      const f = (k: string) => {
        let node: unknown = table
        for (const p of k.split('.')) node = (node as Record<string, unknown> | undefined)?.[p]
        return typeof node === 'string' ? node : k
      }
      ;(f as unknown as { has: (k: string) => boolean }).has = (k: string) =>
        typeof table?.[k] === 'string'
      return f
    },
  }
})

vi.mock('@/stores/useUserStore', () => ({
  useUserStore: (sel: (s: unknown) => unknown) =>
    sel({ user: { displayName: 'Nguyễn Văn A', email: 'a@example.com' } }),
}))

const logout = vi.fn()
vi.mock('@/lib/authSession', () => ({
  getOrgRole: () => 'STUDENT',
  logout: () => logout(),
}))

function renderShellNav() {
  return render(
    <GaShellNavProvider>
      <GaSidebarToggle />
      <GaSidebar nav={ROLE_NAV.student} />
    </GaShellNavProvider>,
  )
}

const drawer = () => document.getElementById('ga-shell-sidebar') as HTMLElement
const toggle = () => screen.getByRole('button', { name: 'Mở menu điều hướng' })

describe('GaSidebar — ngăn kéo mobile', () => {
  it('mặc định đóng: aside trượt khỏi màn hình, hamburger aria-expanded=false', () => {
    renderShellNav()
    expect(drawer().className).toContain('-translate-x-full')
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
  })

  it('bấm hamburger mở ngăn kéo (translate-x-0) và cập nhật aria-expanded', () => {
    renderShellNav()
    fireEvent.click(toggle())
    expect(drawer().className).toContain('translate-x-0')
    expect(drawer().className).not.toContain('-translate-x-full')
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
  })

  it('bấm nút đóng (X) trong ngăn kéo thì đóng lại', () => {
    renderShellNav()
    fireEvent.click(toggle())
    fireEvent.click(screen.getByRole('button', { name: 'Đóng menu' }))
    expect(drawer().className).toContain('-translate-x-full')
  })

  it('chọn một mục điều hướng thì tự đóng ngăn kéo', () => {
    renderShellNav()
    fireEvent.click(toggle())
    expect(drawer().className).toContain('translate-x-0')
    const link = within(drawer()).getAllByRole('link')[0]
    fireEvent.click(link)
    expect(drawer().className).toContain('-translate-x-full')
  })

  it('phím Escape đóng ngăn kéo khi đang mở', () => {
    renderShellNav()
    fireEvent.click(toggle())
    expect(drawer().className).toContain('translate-x-0')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(drawer().className).toContain('-translate-x-full')
  })

  it('bấm backdrop đóng ngăn kéo', () => {
    const { container } = renderShellNav()
    fireEvent.click(toggle())
    // backdrop là div aria-hidden có class fixed inset-0 z-40
    const backdrop = container.querySelector('div[aria-hidden].fixed.inset-0') as HTMLElement
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop)
    expect(drawer().className).toContain('-translate-x-full')
  })
})
