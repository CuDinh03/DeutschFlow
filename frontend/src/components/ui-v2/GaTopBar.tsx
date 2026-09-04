import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { GaIcon } from './GaIcon'
import { GaSidebarToggle } from './GaShellNav'
import { TeacherPendingPill } from './TeacherPendingPill'
import { NotificationBell } from './NotificationBell'
import { LanguageToggle } from './LanguageToggle'
import { GaAccountMenu } from './GaAccountMenu'
import { ROLE_AREAS, type RoleId } from './nav'

/**
 * GaTopBar — global utility bar above the content area (proto GaTopBar, proto-classroom.jsx:93):
 * role status chip + notifications bell + help. Rendered by GaShell on every logged-in screen.
 * Status chip text avoids fabricated metrics (Option-1): admin shows a real health chip,
 * other roles show an honest role label tinted with the role accent.
 *
 * Mobile (<lg): hamburger mở ngăn kéo sidebar thay cho rail; chip vai trò bị ẩn để nhường chỗ —
 * chuông + đổi ngôn ngữ + trợ giúp vẫn luôn hiện.
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

// Khóa i18n cho chip vai trò (v2.ui.*) — copy qua catalog, không hardcode (W0-C8).
const ROLE_CHIP_KEY: Record<RoleId, string> = {
  admin: 'roleChipAdmin',
  teacher: 'roleChipTeacher',
  org: 'roleChipOrg',
  student: 'roleChipStudent',
}

export function GaTopBar({ role }: GaTopBarProps) {
  const t = useTranslations('v2.ui')
  // Role đã chuyển sang area navigation (Wave 1 / S-01): topbar mang utility (inbox + account
  // menu) và BỎ ô tìm kiếm trang trí — global search không có backend và tìm kiếm thuộc về từng
  // màn thư viện (IA §13.4).
  const roleAreas = ROLE_AREAS[role]
  const inbox = roleAreas?.inbox

  return (
    <header data-ga-chrome className="flex h-[58px] shrink-0 items-center gap-3 border-b border-ga-line bg-ga-card px-4 lg:gap-4 lg:px-6">
      <GaSidebarToggle />

      <div className="ml-auto flex items-center gap-2 sm:gap-3.5">
        {/* Chip vai trò: chỉ giữ khi mang dữ liệu thật (admin health, teacher pending). */}
        {role === 'admin' ? (
          <span className="hidden whitespace-nowrap rounded-ga bg-ga-green-soft px-3 py-[7px] text-[12.5px] font-semibold text-ga-green md:inline-flex">
            {t(ROLE_CHIP_KEY.admin)}
          </span>
        ) : role === 'teacher' ? (
          <div className="hidden md:block">
            <TeacherPendingPill />
          </div>
        ) : !roleAreas ? (
          <span className="hidden whitespace-nowrap rounded-ga bg-ga-accent-soft px-3 py-[7px] text-[12.5px] font-semibold text-ga-accent md:inline-flex">
            {t(ROLE_CHIP_KEY[role])}
          </span>
        ) : null}

        <LanguageToggle />

        {inbox && (
          <Link
            href={inbox.href}
            aria-label={t('messages')}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-ga border border-ga-line text-ga-muted transition-colors hover:bg-ga-surface hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ga-bg lg:h-[38px] lg:w-[38px]"
          >
            <GaIcon name={inbox.icon} size={20} />
          </Link>
        )}

        <NotificationBell role={role} />

        {roleAreas ? (
          // Trợ giúp + hồ sơ + học phí + đăng xuất gom vào account menu (IA-D3).
          <GaAccountMenu role={role} />
        ) : (
          <Link
            href={HELP_HREF[role]}
            aria-label={t('help')}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-ga border border-ga-line text-ga-muted transition-colors hover:bg-ga-surface hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ga-bg lg:h-[38px] lg:w-[38px]"
          >
            <GaIcon name="help" size={20} />
          </Link>
        )}
      </div>
    </header>
  )
}
