/**
 * Wave 1 / S-01 + S-13 — hành vi render của chrome điều hướng mới:
 * GaBottomNav (mobile web), GaLocalNav (điều hướng cấp 2), GaAccountMenu (utility).
 */
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GaBottomNav } from '@/components/ui-v2/GaBottomNav'
import { GaLocalNav } from '@/components/ui-v2/GaLocalNav'
import { GaAccountMenu } from '@/components/ui-v2/GaAccountMenu'
import { GaShellNavProvider } from '@/components/ui-v2/GaShellNav'

let pathname = '/v2/student/dashboard'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const f = (k: string) => k
    ;(f as unknown as { has: (k: string) => boolean }).has = () => false
    return f
  },
  useLocale: () => 'vi',
}))

const logoutMock = vi.fn()
vi.mock('@/lib/authSession', () => ({
  logout: () => logoutMock(),
  getOrgRole: () => 'STUDENT',
  getAccessToken: () => null,
}))

vi.mock('@/stores/useUserStore', () => ({
  useUserStore: (sel: (s: unknown) => unknown) =>
    sel({ user: { displayName: 'Nguyễn Văn A', email: 'a@example.com' } }),
}))

beforeEach(() => {
  pathname = '/v2/student/dashboard'
  logoutMock.mockClear()
})

const renderBottom = (role: 'student' | 'teacher' = 'student') =>
  render(
    <GaShellNavProvider>
      <GaBottomNav role={role} />
    </GaShellNavProvider>,
  )

describe('GaBottomNav (S-13)', () => {
  it('student: đúng 5 ô, mỗi ô ≥44px và ẩn từ md trở lên', () => {
    const { container } = renderBottom()
    const nav = container.querySelector('nav')!
    expect(nav.className).toContain('md:hidden')
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(5)
    for (const l of links) expect(l.className).toContain('min-h-11')
  })

  it('ô đang chọn có aria-current + indicator ngoài màu (không chỉ đổi màu)', () => {
    pathname = '/v2/student/roadmap'
    const { container } = renderBottom()
    const current = container.querySelector('[aria-current="page"]') as HTMLElement
    expect(current.getAttribute('href')).toBe('/v2/student/roadmap')
    expect(current.className).toContain('font-semibold')
    // indicator: thanh nhỏ bg-ga-accent bên trong ô đang chọn
    expect(current.querySelector('.bg-ga-accent')).not.toBeNull()
  })

  it('accessible name gồm nhãn Đức + nghĩa tiếng Việt (song ngữ không in hai dòng)', () => {
    renderBottom()
    const first = screen.getAllByRole('link')[0]
    expect(first.getAttribute('aria-label')).toBe('nav.areas.heute — nav.areaHelper.heute')
  })

  it('ẩn HOÀN TOÀN trong route toàn màn hình (Exam Room)', () => {
    pathname = '/v2/student/mock-exam/run'
    const { container } = renderBottom()
    expect(container.querySelector('nav')).toBeNull()
  })

  it('teacher: 4 ô + nút "Mehr" mở ngăn kéo', () => {
    pathname = '/v2/teacher'
    renderBottom('teacher')
    expect(screen.getAllByRole('link')).toHaveLength(4)
    const more = screen.getByRole('button', { name: 'ui.more' })
    expect(more.getAttribute('aria-controls')).toBe('ga-shell-sidebar')
    expect(more.className).toContain('min-h-11')
    fireEvent.click(more) // không ném lỗi = context ngăn kéo hoạt động
  })

  it('role chưa chuyển sang area nav (admin) thì không render gì', () => {
    pathname = '/v2/admin'
    const { container } = render(
      <GaShellNavProvider>
        <GaBottomNav role="admin" />
      </GaShellNavProvider>,
    )
    expect(container.querySelector('nav')).toBeNull()
  })
})

describe('GaLocalNav (S-01, điều hướng cấp 2)', () => {
  it('Lernen: hiện đủ local nav, đánh dấu mục đang mở', () => {
    pathname = '/v2/student/vocabulary'
    render(<GaLocalNav role="student" />)
    const links = screen.getAllByRole('link')
    expect(links.length).toBeGreaterThanOrEqual(9)
    const current = screen.getByRole('link', { current: 'page' })
    expect(current.getAttribute('href')).toBe('/v2/student/vocabulary')
  })

  it('route con vẫn giữ mục cha active (vocabulary/swipe)', () => {
    pathname = '/v2/student/vocabulary/swipe'
    render(<GaLocalNav role="student" />)
    expect(screen.getByRole('link', { current: 'page' }).getAttribute('href')).toBe(
      '/v2/student/vocabulary',
    )
  })

  it('Heute không có local nav → không render', () => {
    pathname = '/v2/student/dashboard'
    const { container } = render(<GaLocalNav role="student" />)
    expect(container.firstChild).toBeNull()
  })

  it('ẩn trong route toàn màn hình', () => {
    pathname = '/v2/student/interviews'
    const { container } = render(<GaLocalNav role="student" />)
    expect(container.firstChild).toBeNull()
  })

  it('mọi mục ≥44px và có focus ring', () => {
    pathname = '/v2/student/exam'
    render(<GaLocalNav role="student" />)
    for (const l of screen.getAllByRole('link')) {
      expect(l.className).toContain('min-h-11')
      expect(l.className).toContain('ring-ga-focus')
    }
  })
})

describe('GaAccountMenu (S-01, utility rời persistent nav)', () => {
  it('mở menu: có hồ sơ/học phí/hướng dẫn/trợ giúp + đăng xuất', async () => {
    render(<GaAccountMenu role="student" />)
    fireEvent.click(screen.getByRole('button', { name: 'ui.account' }))
    const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'))
    expect(hrefs).toEqual(
      expect.arrayContaining(['/v2/profile', '/v2/student/tuition', '/v2/student/welcome', '/support']),
    )
    const logoutBtn = screen.getByRole('button', { name: /shell.logout/ })
    fireEvent.click(logoutBtn)
    expect(logoutMock).toHaveBeenCalled()
    cleanup()
  })

  it('trigger có touch target ≥44px mobile và focus ring', () => {
    render(<GaAccountMenu role="student" />)
    const trigger = screen.getByRole('button', { name: 'ui.account' })
    expect(trigger.className).toContain('h-11')
    expect(trigger.className).toContain('ring-ga-focus')
  })
})
