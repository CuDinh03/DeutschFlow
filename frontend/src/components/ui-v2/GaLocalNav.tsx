'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { GaIcon } from './GaIcon'
import { GaPopover, GaPopoverContent, GaPopoverTrigger } from './GaPopover'
import {
  ROLE_AREAS,
  resolveArea,
  isUnder,
  isImmersiveRoute,
  isLocalGroup,
  type LocalGroup,
  type NavItem,
  type RoleId,
} from './nav'

/**
 * GaLocalNav — điều hướng CẤP 2 bên trong area đang mở (Wave 1 / S-01).
 *
 * Persistent nav chỉ còn 5 area (IA-D1); mọi destination cũ sống ở đây, dưới area chủ sở hữu.
 * Render ở tầng shell (không phải trong page) nên các màn chưa redesign vẫn có đường vào đầy đủ
 * mà không phải sửa một dòng page nào — đúng ràng buộc "regroup navigation trước" (IA-D8).
 *
 * B-05: một ô cấp 1 có thể là destination đi thẳng HOẶC một nhóm mở ra menu. Lernen từng có 10 ô
 * phẳng và phải cuộn ngang ngay ở 1440; gom nhóm đưa nó về 5 ô mà không bỏ destination nào. Nhóm
 * chỉ có một destination thì khai thẳng là item — bắt mở menu để tới đúng một chỗ là chi phí thừa.
 *
 * Ẩn khi: role chưa chuyển sang area nav · area không có local nav (vd Heute) · route toàn màn hình.
 */

/** Ô cấp 1 dùng chung một hình dạng dù là link hay nút mở nhóm — khác nhau thì hàng tab sẽ lệch. */
function tabClass(active: boolean): string {
  return cn(
    'flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-2 text-ga-small font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-inset',
    active ? 'border-ga-accent text-ga-ink' : 'border-transparent text-ga-muted hover:text-ga-ink',
  )
}

function LocalLink({ item, active }: { item: NavItem; active: boolean }) {
  const t = useTranslations('v2')
  return (
    <Link href={item.href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
      <GaIcon name={item.icon} size={16} className={active ? 'text-ga-accent' : 'text-ga-subtle'} />
      <span>{t.has(`nav.items.${item.id}`) ? t(`nav.items.${item.id}`) : item.label}</span>
    </Link>
  )
}

/**
 * Một nhóm cấp 1. Trạng thái "đang ở trong nhóm này" phải đọc được mà KHÔNG cần mở menu, nên
 * trigger mang cả gạch chân accent (dấu hiệu hình khối, không chỉ màu) lẫn `aria-current`; còn
 * destination cụ thể thì `aria-current="page"` bên trong menu chỉ ra chính xác.
 */
function LocalGroupTab({
  group,
  role,
  pathname,
}: {
  group: LocalGroup
  role: RoleId
  pathname: string
}) {
  const t = useTranslations('v2')
  const [open, setOpen] = React.useState(false)
  const activeItem = group.items.find((item) => isUnder(pathname, item.href))
  const label = t.has(`nav.localGroups.${group.id}`)
    ? t(`nav.localGroups.${group.id}`)
    : group.label

  return (
    <GaPopover gaRole={role} open={open} onOpenChange={setOpen}>
      <GaPopoverTrigger asChild>
        <button
          type="button"
          aria-current={activeItem ? 'true' : undefined}
          className={tabClass(Boolean(activeItem))}
        >
          <GaIcon
            name={group.icon}
            size={16}
            className={activeItem ? 'text-ga-accent' : 'text-ga-subtle'}
          />
          <span>{label}</span>
          <GaIcon name="expand_more" size={14} className="text-ga-subtle" />
        </button>
      </GaPopoverTrigger>

      <GaPopoverContent
        align="start"
        sideOffset={2}
        className="w-[min(100vw-2rem,15rem)] overflow-hidden p-1"
      >
        <div className="flex flex-col">
          {group.items.map((item) => {
            const active = item === activeItem
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-ga px-3 text-ga-small transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-inset',
                  active
                    ? 'bg-ga-accent-soft font-semibold text-ga-accent'
                    : 'font-medium text-ga-ink hover:bg-ga-surface',
                )}
              >
                <GaIcon
                  name={item.icon}
                  size={18}
                  className={active ? 'text-ga-accent' : 'text-ga-subtle'}
                />
                <span>{t.has(`nav.items.${item.id}`) ? t(`nav.items.${item.id}`) : item.label}</span>
              </Link>
            )
          })}
        </div>
      </GaPopoverContent>
    </GaPopover>
  )
}

export function GaLocalNav({ role }: { role: RoleId }) {
  const pathname = usePathname() ?? ''
  const t = useTranslations('v2')
  const roleAreas = ROLE_AREAS[role]
  if (!roleAreas || isImmersiveRoute(pathname)) return null

  const area = resolveArea(roleAreas, pathname)
  const entries = area?.local
  if (!area || !entries?.length) return null

  return (
    <nav
      data-ga-chrome
      aria-label={t('ui.sectionNav')}
      // Cuộn ngang trong container riêng — trang không bao giờ cuộn ngang (responsive contract).
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-ga-line bg-ga-card px-4 lg:gap-2 lg:px-6"
    >
      {entries.map((entry) =>
        isLocalGroup(entry) ? (
          <LocalGroupTab key={entry.id} group={entry} role={role} pathname={pathname} />
        ) : (
          <LocalLink key={entry.id} item={entry} active={isUnder(pathname, entry.href)} />
        ),
      )}
    </nav>
  )
}
