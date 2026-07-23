import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { GaIcon } from './GaIcon'
import { GaSidebarToggle } from './GaShellNav'
import { TeacherPendingPill } from './TeacherPendingPill'
import { NotificationBell } from './NotificationBell'
import { LanguageToggle } from './LanguageToggle'
import type { RoleId } from './nav'

/**
 * GaTopBar — global utility bar above the content area (proto GaTopBar, proto-classroom.jsx:93):
 * decorative search + role status chip + notifications bell + help. Rendered by GaShell on every
 * logged-in screen. The search is intentionally non-functional (no v2 search backend), matching the
 * prototype. Status chip text avoids fabricated metrics (Option-1): admin shows a real health chip,
 * other roles show an honest role label tinted with the role accent.
 *
 * Mobile (<lg): hamburger mở ngăn kéo sidebar thay cho rail; ô tìm kiếm trang trí và chip vai trò
 * bị ẩn để nhường chỗ — chuông + đổi ngôn ngữ + trợ giúp vẫn luôn hiện.
 */
export interface GaTopBarProps {
  role: RoleId
}

// `/help` chưa bao giờ tồn tại (không có `src/app/help`) — nút trợ giúp trên thanh trên cùng của
// CẢ BỐN vai trò dẫn thẳng vào 404. `/support` là trang thật, công khai, và nằm trong nhóm được
// giữ lại khi cây v1 bị xoá.
const HELP_HREF: Record<RoleId, string> = {
  student: '/support',
  teacher: '/support',
  org: '/support',
  admin: '/support',
}

const ROLE_CHIP_KEY: Record<RoleId, string> = {
  admin: 'chipAdmin',
  teacher: 'chipTeacher',
  org: 'chipOrg',
  student: 'chipStudent',
}

export function GaTopBar({ role }: GaTopBarProps) {
  const t = useTranslations('v2.shell')
  return (
    <header className="flex h-[58px] shrink-0 items-center gap-3 border-b border-ga-line bg-ga-card px-4 lg:gap-4 lg:px-6">
      <GaSidebarToggle />

      <label className="hidden max-w-[420px] flex-1 items-center gap-2.5 rounded-ga border border-ga-line bg-ga-surface px-3.5 py-2.5 lg:flex">
        <GaIcon name="search" size={18} className="text-ga-subtle" />
        <input
          type="search"
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchAria')}
          className="ga-ui min-w-0 flex-1 border-none bg-transparent text-[14px] text-ga-ink outline-none placeholder:text-ga-subtle"
        />
      </label>

      <div className="ml-auto flex items-center gap-2 sm:gap-3.5">
        {/* Chip vai trò: trang trí, ẩn dưới md để nhường chỗ trên màn hình hẹp. */}
        {role === 'admin' ? (
          <span
            className="hidden whitespace-nowrap rounded-ga px-3 py-[7px] text-[12.5px] font-semibold md:inline-flex"
            style={{ background: 'rgba(30,158,97,0.12)', color: '#1E9E61' }}
          >
            {t(ROLE_CHIP_KEY.admin)}
          </span>
        ) : role === 'teacher' ? (
          <div className="hidden md:block">
            <TeacherPendingPill />
          </div>
        ) : (
          <span className="hidden whitespace-nowrap rounded-ga bg-ga-accent-soft px-3 py-[7px] text-[12.5px] font-semibold text-ga-accent md:inline-flex">
            {t(ROLE_CHIP_KEY[role])}
          </span>
        )}

        <LanguageToggle />

        <NotificationBell role={role} />

        <Link
          href={HELP_HREF[role]}
          aria-label={t('helpAria')}
          className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-ga border border-ga-line text-ga-muted transition-colors hover:bg-ga-surface hover:text-ga-ink"
        >
          <GaIcon name="help" size={20} />
        </Link>
      </div>
    </header>
  )
}
