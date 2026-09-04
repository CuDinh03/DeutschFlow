import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GaTopBar } from '@/components/ui-v2/GaTopBar'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

vi.mock('@/components/ui-v2/GaShellNav', () => ({ GaSidebarToggle: () => <button>Mở menu</button> }))
vi.mock('@/components/ui-v2/TeacherPendingPill', () => ({ TeacherPendingPill: () => null }))
vi.mock('@/components/ui-v2/NotificationBell', () => ({ NotificationBell: () => <button>Thông báo</button> }))
vi.mock('@/components/ui-v2/LanguageToggle', () => ({ LanguageToggle: () => <div>VI EN DE</div> }))
vi.mock('@/components/ui-v2/GaAccountMenu', () => ({ GaAccountMenu: () => <button>Tài khoản</button> }))

describe('GaTopBar', () => {
  it.each(['admin', 'org', 'student', 'teacher'] as const)(
    'does not expose a decorative search input for %s',
    (role) => {
      render(<GaTopBar role={role} />)
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    },
  )
})
