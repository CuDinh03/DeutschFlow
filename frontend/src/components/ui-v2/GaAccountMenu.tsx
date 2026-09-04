'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { useUserStore } from '@/stores/useUserStore'
import { logout } from '@/lib/authSession'
import { GaIcon } from './GaIcon'
import { GaPopover, GaPopoverContent, GaPopoverTrigger } from './GaPopover'
import { ROLE_AREAS, type RoleId } from './nav'

/**
 * GaAccountMenu — nơi ở mới của các utility ĐÃ RỜI persistent navigation (Wave 1 / S-01, IA-D3):
 * hồ sơ, học phí, hướng dẫn, trợ giúp, đăng xuất. Trước đây chúng chiếm chỗ ngang với ý định học
 * tập trên sidebar, làm nav phình lên gần 30 mục (UX-02).
 *
 * Dùng GaPopover nên panel portaled vẫn giữ Galerie scope + role accent (portal contract W0-C4).
 */
function initials(name: string | null | undefined): string {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** `/help` chưa từng tồn tại; `/support` là trang thật, công khai. */
const HELP_HREF = '/support'

export function GaAccountMenu({ role }: { role: RoleId }) {
  const t = useTranslations('v2')
  const [open, setOpen] = React.useState(false)
  const user = useUserStore((s) => s.user)
  const utility = ROLE_AREAS[role]?.utility ?? []

  const displayName = user?.displayName || t(`nav.roles.${role}`)
  const email = user?.email || ''

  const itemClass =
    'flex min-h-11 items-center gap-3 px-4 text-ga-small font-medium text-ga-ink transition-colors ' +
    'hover:bg-ga-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-inset'

  return (
    <GaPopover gaRole={role} open={open} onOpenChange={setOpen}>
      <GaPopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('ui.account')}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-ga-pill bg-ga-accent text-ga-small font-semibold text-ga-accent-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ga-bg lg:h-9 lg:w-9"
        >
          {initials(displayName)}
        </button>
      </GaPopoverTrigger>

      <GaPopoverContent align="end" sideOffset={8} className="w-[min(100vw-2rem,17rem)] overflow-hidden p-0">
        <div className="border-b border-ga-line bg-ga-surface px-4 py-3">
          <p className="truncate text-ga-small font-semibold text-ga-ink">{displayName}</p>
          {email && <p className="truncate text-ga-caption text-ga-muted">{email}</p>}
        </div>

        <div className="flex flex-col py-1">
          {utility.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <GaIcon name={item.icon} size={18} className="text-ga-subtle" />
              <span>{t.has(`nav.items.${item.id}`) ? t(`nav.items.${item.id}`) : item.label}</span>
            </Link>
          ))}
          <Link href={HELP_HREF} onClick={() => setOpen(false)} className={itemClass}>
            <GaIcon name="help" size={18} className="text-ga-subtle" />
            <span>{t('ui.help')}</span>
          </Link>
        </div>

        {/* Đăng xuất tách khỏi nhóm trên bằng divider — hành động rời phiên, không phải điều hướng. */}
        <div className="border-t border-ga-line py-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              void logout()
            }}
            className={cn(itemClass, 'w-full text-left')}
          >
            <GaIcon name="logout" size={18} className="text-ga-subtle" />
            <span>{t('shell.logout')}</span>
          </button>
        </div>
      </GaPopoverContent>
    </GaPopover>
  )
}
