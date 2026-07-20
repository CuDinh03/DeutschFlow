'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { useUserStore } from '@/stores/useUserStore'
import { getOrgRole, logout } from '@/lib/authSession'
import { GaLogo } from './GaLogo'
import { GaIcon } from './GaIcon'
import { useGaShellNav } from './GaShellNav'
import { managerNav } from './nav'
import type { RoleNav } from './nav'

/**
 * GaSidebar — role navigation (70-admin-users hi-fi): 248px card rail, role pill,
 * sectioned nav (active = roleAccent.soft + inset 3px bar), user footer.
 *
 * Nhãn menu/heading dịch qua next-intl (namespace v2.nav): item theo `id`, section theo `labelKey`,
 * role theo `role`. Nhãn tiếng Việt trong nav.ts là fallback khi thiếu khoá i18n.
 */
export interface GaSidebarProps {
  nav: RoleNav
}

function isActive(href: string, rootHref: string, pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/'
  if (href === rootHref) return p === rootHref
  return p === href || p.startsWith(href + '/')
}
function initials(name: string | null | undefined): string {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function GaSidebar({ nav }: GaSidebarProps) {
  const pathname = usePathname() ?? ''
  const t = useTranslations('v2')
  const user = useUserStore((s) => s.user)
  const { open, setOpen } = useGaShellNav()
  const close = React.useCallback(() => setOpen(false), [setOpen])

  // Đóng ngăn kéo mỗi khi điều hướng xong (mobile). onClick trên link đã đóng trước
  // khi rời trang; hiệu ứng theo pathname là lưới an toàn cho back/forward và cho việc
  // click lại chính trang hiện tại. Ở lg+ ngăn kéo tĩnh nên đóng/mở vô hại.
  React.useEffect(() => { setOpen(false) }, [pathname, setOpen])

  // Esc để đóng — chuẩn cho lớp phủ có backdrop.
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  // Org shell serves TWO org roles. OWNER (giám đốc) gets `orgNav`; MANAGER (nhân sự) gets the
  // ops-first `managerNav` — same shell/routes, different menu, no finance/billing at all.
  // orgRole is read from the cookie/JWT after mount (client only) to stay SSR-safe; until then we
  // assume NOT owner, so an owner-only item can never flash to a MANAGER. The `ownerOnly` filter
  // below stays as a second layer of defence. Backend (OrgGuard) is the real enforcement.
  const [isOwner, setIsOwner] = React.useState(false)
  React.useEffect(() => { setIsOwner(getOrgRole() === 'OWNER') }, [])

  const resolved: RoleNav = nav.role === 'org' && !isOwner ? managerNav : nav
  const roleLabel = t(`nav.roles.${resolved.roleLabelKey ?? resolved.role}`)
  const displayName = user?.displayName || roleLabel
  const email = user?.email || ''

  return (
    <>
      {/* Backdrop — chỉ mobile khi ngăn kéo mở. Bấm ra ngoài để đóng. */}
      <div
        onClick={close}
        aria-hidden
        className={cn(
          'fixed inset-0 z-40 bg-ga-ink/40 transition-opacity duration-200 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        id="ga-shell-sidebar"
        aria-label={t('shell.mainNav')}
        className={cn(
          // Mobile: ngăn kéo trượt cố định, NGOÀI luồng flex → nội dung chiếm trọn chiều ngang.
          'fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col border-r border-ga-line bg-ga-card p-5',
          'transition-transform duration-200 ease-out',
          // lg+: trả lại rail tĩnh 248px như thiết kế gốc (không hiệu ứng, không đổ bóng).
          'lg:static lg:z-auto lg:w-[248px] lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:shadow-none lg:transition-none',
          open ? 'translate-x-0 shadow-[0_16px_48px_rgba(22,21,19,0.18)]' : '-translate-x-full',
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <GaLogo />
          <button
            type="button"
            onClick={close}
            aria-label="Đóng menu"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-ga text-ga-muted transition-colors hover:bg-ga-surface hover:text-ga-ink lg:hidden"
          >
            <GaIcon name="close" size={20} />
          </button>
        </div>
        <span className="mb-5 inline-flex w-fit rounded-ga-pill bg-ga-accent px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ga-accent-ink">
          {roleLabel}
        </span>

        <nav className="flex-1 space-y-5 overflow-y-auto" aria-label={t('shell.mainNav')}>
          {resolved.sections.map((section, si) => (
            <div key={section.labelKey ?? section.label ?? si} className="space-y-0.5">
              {section.label && (
                <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-ga-subtle">
                  {section.labelKey && t.has(`nav.sections.${section.labelKey}`)
                    ? t(`nav.sections.${section.labelKey}`)
                    : section.label}
                </p>
              )}
              {section.items.filter((item) => !item.ownerOnly || isOwner).map((item) => {
                const active = isActive(item.href, resolved.rootHref, pathname)
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={close}
                    aria-current={active ? 'page' : undefined}
                    style={active ? { boxShadow: 'inset 3px 0 0 var(--ga-accent)' } : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-ga px-3 py-2.5 text-[14.5px] transition-colors',
                      active
                        ? 'bg-ga-accent-soft font-semibold text-ga-accent'
                        : 'font-medium text-ga-muted hover:bg-ga-surface hover:text-ga-ink',
                    )}
                  >
                    <GaIcon
                      name={item.icon}
                      size={18}
                      className={active ? 'text-ga-accent' : 'text-ga-subtle'}
                    />
                    <span className="truncate">
                      {t.has(`nav.items.${item.id}`) ? t(`nav.items.${item.id}`) : item.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t border-ga-line pt-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-ga-pill bg-ga-accent text-[13px] font-semibold text-ga-accent-ink">
              {initials(displayName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-ga-ink">{displayName}</p>
              {email && <p className="truncate text-[12px] text-ga-muted">{email}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => { close(); void logout() }}
            className="mt-3 flex w-full items-center gap-3 rounded-ga px-3 py-2.5 text-[14.5px] font-medium text-ga-muted transition-colors hover:bg-ga-surface hover:text-ga-ink"
          >
            <GaIcon name="logout" size={18} className="text-ga-subtle" />
            <span>{t('shell.logout')}</span>
          </button>
        </div>
      </aside>
    </>
  )
}
