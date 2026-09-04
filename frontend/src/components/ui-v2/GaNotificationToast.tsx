'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { GaIcon } from './GaIcon'
import { GaBtn } from './GaBtn'
import { TYPE_TONE, TYPE_ICON, toneSoft } from '@/lib/notificationDisplay'
import type { RoleId } from './nav'

/**
 * GaNotificationToast — thẻ thông báo realtime (Galerie 2.0) thay cho toast mặc định
 * của sonner khi có thông báo mới đổ về qua SSE (NotificationBell.notifyNewArrival).
 *
 * Cùng ngôn ngữ hình ảnh với dropdown chuông: icon tile nhuộm tone theo loại thông báo,
 * thanh nhấn 3px cạnh trái (họ hàng --ga-shadow-selected-bar của nav), tiêu đề serif
 * Newsreader. Sonner portal render trên document.body — NGOÀI subtree `.ga-scope` — nên
 * thẻ tự mang `ga-scope` + `data-role` theo PORTAL SCOPE CONTRACT (W0-C4).
 */

export interface GaNotificationToastLabels {
  /** Nhãn eyebrow, ví dụ "Thông báo". */
  kicker: string
  /** Mốc thời gian của lượt đến mới, ví dụ "vừa xong". */
  justNow: string
  /** Nhãn CTA mở deep-link, ví dụ "Xem chi tiết". */
  view: string
  /** aria-label nút đóng, ví dụ "Đóng thông báo". */
  close: string
}

export interface GaNotificationToastProps {
  /** NotificationType từ backend — quyết định icon + tone màu. */
  type: string
  title: string
  body?: string | null
  role: RoleId
  labels: GaNotificationToastLabels
  /** Có deep-link thì hiện CTA; không có thì thẻ chỉ thông tin + nút đóng. */
  onView?: () => void
  onClose: () => void
}

export function GaNotificationToast({
  type,
  title,
  body,
  role,
  labels,
  onView,
  onClose,
}: GaNotificationToastProps) {
  const tone = TYPE_TONE[type] ?? 'var(--ga-muted)'
  return (
    <div
      data-role={role}
      // 22.25rem = 356px — đúng bề rộng viewport mặc định của sonner để thẻ không tràn ol.
      className="ga-scope relative w-[min(calc(100vw-2rem),22.25rem)] overflow-hidden rounded-ga border border-ga-line bg-ga-card text-ga-ink shadow-ga-panel"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: tone }} />

      <div className="flex items-start gap-3 py-3.5 pl-4 pr-2.5">
        <span
          aria-hidden
          className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-ga"
          style={{ background: toneSoft(tone), color: tone }}
        >
          <GaIcon name={TYPE_ICON[type] ?? 'notifications'} size={17} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ga-subtle">
            {labels.kicker}
            <span aria-hidden className="mx-1.5 normal-case tracking-normal text-ga-faint">
              ·
            </span>
            <span className="font-medium normal-case tracking-normal">{labels.justNow}</span>
          </p>
          <p className="mt-1 font-ga-display text-[15px] font-semibold leading-snug">{title}</p>
          {body && (
            <p className="mt-0.5 line-clamp-2 break-words text-[12.5px] leading-relaxed text-ga-muted">
              {body}
            </p>
          )}
          {onView && (
            <div className="mt-2.5 pb-0.5">
              <GaBtn variant="ink" size="sm" onClick={onView}>
                {labels.view}
                <span aria-hidden>→</span>
              </GaBtn>
            </div>
          )}
        </div>

        {/* Touch target giữ ≥44px trên mobile (F-06/D8) — margin âm để hình vẫn gọn trong thẻ. */}
        <button
          type="button"
          onClick={onClose}
          aria-label={labels.close}
          className="-mr-0.5 -mt-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-surface hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus lg:-mt-1 lg:h-8 lg:w-8"
        >
          <GaIcon name="close" size={15} />
        </button>
      </div>
    </div>
  )
}

export interface ShowGaNotificationToastOptions {
  type: string
  title: string
  body?: string | null
  role: RoleId
  labels: GaNotificationToastLabels
  onView?: () => void
}

/** Bắn thẻ thông báo qua sonner (`toast.custom`); CTA/đóng tự dismiss đúng toast của mình. */
export function showGaNotificationToast(opts: ShowGaNotificationToastOptions) {
  const { onView, ...card } = opts
  toast.custom(
    (id) => (
      <GaNotificationToast
        {...card}
        onView={
          onView
            ? () => {
                toast.dismiss(id)
                onView()
              }
            : undefined
        }
        onClose={() => toast.dismiss(id)}
      />
    ),
    // Có nội dung + CTA để đọc/bấm nên cho đứng lâu hơn 4s mặc định. Góc dưới phải —
    // tách khỏi dòng toast hệ thống (top-center) để không che nội dung đang thao tác.
    { duration: 8000, position: 'bottom-right' },
  )
}
