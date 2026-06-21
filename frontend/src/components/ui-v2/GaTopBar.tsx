import * as React from 'react'
import Link from 'next/link'
import { GaIcon } from './GaIcon'
import type { RoleId } from './nav'

/**
 * GaTopBar — global utility bar above the content area (proto GaTopBar, proto-classroom.jsx:93):
 * decorative search + role status chip + notifications bell + help. Rendered by GaShell on every
 * logged-in screen. The search is intentionally non-functional (no v2 search backend), matching the
 * prototype. Status chip text avoids fabricated metrics (Option-1): admin shows a real health chip,
 * other roles show an honest role label tinted with the role accent.
 */
export interface GaTopBarProps {
  role: RoleId
}

const HELP_HREF: Record<RoleId, string> = {
  student: '/v2/student/welcome',
  teacher: '/v2/teacher',
  org: '/v2/org',
  admin: '/v2/admin',
}

const ROLE_CHIP: Record<RoleId, string> = {
  admin: '● Hệ thống ổn định',
  teacher: 'Khu vực giáo viên',
  org: 'Khu vực tổ chức',
  student: 'Khu vực học viên',
}

export function GaTopBar({ role }: GaTopBarProps) {
  return (
    <header className="flex h-[58px] shrink-0 items-center gap-4 border-b border-ga-line bg-ga-card px-6">
      <label className="flex max-w-[420px] flex-1 items-center gap-2.5 rounded-ga border border-ga-line bg-ga-surface px-3.5 py-2.5">
        <GaIcon name="search" size={18} className="text-ga-subtle" />
        <input
          type="search"
          placeholder="Tìm bài học, từ vựng, lớp…"
          aria-label="Tìm kiếm"
          className="ga-ui min-w-0 flex-1 border-none bg-transparent text-[14px] text-ga-ink outline-none placeholder:text-ga-subtle"
        />
      </label>

      <div className="ml-auto flex items-center gap-3.5">
        {role === 'admin' ? (
          <span
            className="whitespace-nowrap rounded-ga px-3 py-[7px] text-[12.5px] font-semibold"
            style={{ background: 'rgba(30,158,97,0.12)', color: '#1E9E61' }}
          >
            {ROLE_CHIP.admin}
          </span>
        ) : (
          <span className="whitespace-nowrap rounded-ga bg-ga-accent-soft px-3 py-[7px] text-[12.5px] font-semibold text-ga-accent">
            {ROLE_CHIP[role]}
          </span>
        )}

        <Link
          href={`/v2/notifications?from=${role}`}
          aria-label="Thông báo"
          className="grid h-[38px] w-[38px] place-items-center rounded-ga border border-ga-line text-ga-muted transition-colors hover:bg-ga-surface hover:text-ga-ink"
        >
          <GaIcon name="notifications" size={20} />
        </Link>

        <Link
          href={HELP_HREF[role]}
          aria-label="Trợ giúp"
          className="grid h-[38px] w-[38px] place-items-center rounded-ga border border-ga-line text-ga-muted transition-colors hover:bg-ga-surface hover:text-ga-ink"
        >
          <GaIcon name="help" size={20} />
        </Link>
      </div>
    </header>
  )
}
