'use client'

import * as React from 'react'
import Link from 'next/link'
import { GaIcon } from './GaIcon'
import { notificationApi } from '@/lib/notificationApi'
import { subscribeNotificationUnread } from '@/lib/notificationStream'
import type { RoleId } from './nav'

/**
 * NotificationBell — the top-bar bell with a live unread badge (all roles). Replaces the static bell
 * link. Initial count from GET /notifications/unread-count; afterwards a live SSE stream keeps the
 * badge realtime. The badge hides at 0 and on error (no fabricated number). Clicking opens
 * /v2/notifications.
 */
export function NotificationBell({ role }: { role: RoleId }) {
  const [unread, setUnread] = React.useState(0)

  React.useEffect(() => {
    let alive = true
    notificationApi
      .unreadCount()
      .then((res) => {
        if (alive) setUnread(Number(res.data?.unreadCount) || 0)
      })
      .catch(() => {
        if (alive) setUnread(0)
      })
    return () => {
      alive = false
    }
  }, [])

  // Live realtime updates — the SSE stream pushes the unread count on every change.
  React.useEffect(() => {
    const ac = subscribeNotificationUnread(
      (n) => setUnread(n),
      () => {},
    )
    return () => ac.abort()
  }, [])

  return (
    <Link
      href={`/v2/notifications?from=${role}`}
      aria-label={unread > 0 ? `Thông báo (${unread} chưa đọc)` : 'Thông báo'}
      className="relative grid h-[38px] w-[38px] place-items-center rounded-ga border border-ga-line text-ga-muted transition-colors hover:bg-ga-surface hover:text-ga-ink"
    >
      <GaIcon name="notifications" size={20} />
      {unread > 0 && (
        <span
          className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold leading-none"
          style={{ background: '#ef4444', color: '#fff' }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}
