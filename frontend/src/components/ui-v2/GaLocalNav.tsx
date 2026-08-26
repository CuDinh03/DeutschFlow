'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { GaIcon } from './GaIcon'
import { ROLE_AREAS, resolveArea, isUnder, isImmersiveRoute, type RoleId } from './nav'

/**
 * GaLocalNav — điều hướng CẤP 2 bên trong area đang mở (Wave 1 / S-01).
 *
 * Persistent nav chỉ còn 5 area (IA-D1); mọi destination cũ sống ở đây, dưới area chủ sở hữu.
 * Render ở tầng shell (không phải trong page) nên các màn chưa redesign vẫn có đường vào đầy đủ
 * mà không phải sửa một dòng page nào — đúng ràng buộc "regroup navigation trước" (IA-D8).
 *
 * Ẩn khi: role chưa chuyển sang area nav · area không có local nav (vd Heute) · route toàn màn hình.
 */
export function GaLocalNav({ role }: { role: RoleId }) {
  const pathname = usePathname() ?? ''
  const t = useTranslations('v2')
  const roleAreas = ROLE_AREAS[role]
  if (!roleAreas || isImmersiveRoute(pathname)) return null

  const area = resolveArea(roleAreas, pathname)
  const items = area?.local
  if (!area || !items?.length) return null

  return (
    <nav
      aria-label={t('ui.sectionNav')}
      // Cuộn ngang trong container riêng — trang không bao giờ cuộn ngang (responsive contract).
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-ga-line bg-ga-card px-4 lg:gap-2 lg:px-6"
    >
      {items.map((item) => {
        const active = isUnder(pathname, item.href)
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-2 text-ga-small font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-inset',
              active
                ? 'border-ga-accent text-ga-ink'
                : 'border-transparent text-ga-muted hover:text-ga-ink',
            )}
          >
            <GaIcon name={item.icon} size={16} className={active ? 'text-ga-accent' : 'text-ga-subtle'} />
            <span>{t.has(`nav.items.${item.id}`) ? t(`nav.items.${item.id}`) : item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
