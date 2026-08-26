'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { GaIcon } from './GaIcon'
import { useGaShellNav } from './GaShellNav'
import { ROLE_AREAS, resolveArea, isImmersiveRoute, type RoleId } from './nav'

/**
 * GaBottomNav — điều hướng đáy cho web mobile (<768px). Wave 1 / S-13, IA-D7.
 *
 * KHÔNG dùng lại `.df-bottom-nav` của native shell: đó là scope `html.native` với vật liệu
 * glass, nằm ngoài phạm vi redesign web (D5). Đây là component web riêng, thuần token Galerie.
 *
 * Quy tắc:
 *   - Student: đúng 5 area. Teacher: 4 area + "Mehr" (mở ngăn kéo chứa Berichte + tài khoản).
 *   - Ẩn HOÀN TOÀN trong route toàn màn hình (Exam Room · Interview Room · phiên nói đang chạy)
 *     để không thoát nhầm giữa chừng (IA §10.1).
 *   - Selected có indicator + weight + `aria-current`, không truyền trạng thái chỉ bằng màu.
 *   - Mỗi ô >=44px (D8); chừa safe-area đáy của iOS.
 */
export function GaBottomNav({ role }: { role: RoleId }) {
  const pathname = usePathname() ?? ''
  const t = useTranslations('v2')
  const { setOpen } = useGaShellNav()
  const roleAreas = ROLE_AREAS[role]
  if (!roleAreas || isImmersiveRoute(pathname)) return null

  const active = resolveArea(roleAreas, pathname)
  const visible = roleAreas.areas.filter((a) => !a.mobileInMore)
  const hasMore = roleAreas.areas.length > visible.length

  const itemClass =
    'flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-ga-eyebrow normal-case tracking-normal transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-inset'

  return (
    <nav
      aria-label={t('ui.areaNav')}
      className="flex shrink-0 items-stretch gap-0.5 border-t border-ga-line bg-ga-card px-1 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {visible.map((area) => {
        const isActive = active?.id === area.id
        return (
          <Link
            key={area.id}
            href={area.href}
            aria-current={isActive ? 'page' : undefined}
            // Nhãn Đức ngắn hiển thị; nghĩa tiếng Việt đi kèm qua accessible name (không in
            // hai dòng thường trực — IA §10.1).
            aria-label={`${t(`nav.areas.${area.id}`)} — ${t(`nav.areaHelper.${area.id}`)}`}
            className={cn(itemClass, isActive ? 'font-semibold text-ga-accent' : 'font-medium text-ga-muted')}
          >
            {/* Indicator ngoài màu: gạch trên khi đang chọn. */}
            <span
              aria-hidden
              className={cn('h-0.5 w-6 rounded-ga-pill', isActive ? 'bg-ga-accent' : 'bg-transparent')}
            />
            <GaIcon name={area.icon} size={20} className={isActive ? 'text-ga-accent' : 'text-ga-subtle'} />
            <span className="max-w-full truncate">{t(`nav.areas.${area.id}`)}</span>
          </Link>
        )
      })}

      {hasMore && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('ui.more')}
          aria-haspopup="menu"
          aria-controls="ga-shell-sidebar"
          className={cn(itemClass, 'font-medium text-ga-muted')}
        >
          <span aria-hidden className="h-0.5 w-6 rounded-ga-pill bg-transparent" />
          <GaIcon name="menu" size={20} className="text-ga-subtle" />
          <span className="max-w-full truncate">{t('nav.areas.more')}</span>
        </button>
      )}
    </nav>
  )
}
