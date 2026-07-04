'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GaIcon } from './GaIcon'
import { notificationApi, type NotificationItem } from '@/lib/notificationApi'
import { subscribeNotificationUnread } from '@/lib/notificationStream'
import { TYPE_TONE, TYPE_ICON, notifTitle, notifBody, relTime, resolveNotificationHref } from '@/lib/notificationDisplay'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { RoleId } from './nav'

/**
 * NotificationBell — the top-bar bell with a live unread badge (all roles). Clicking opens a
 * lightweight dropdown panel showing the most recent notifications inline (mark read on click,
 * mark-all, and a "Xem tất cả" link to the full inbox at /v2/notifications). The full page opens
 * only via that link — not on the bell click itself.
 *
 * Unread count: initial from GET /notifications/unread-count, then a live SSE stream keeps the
 * badge realtime. The badge hides at 0 and on error (no fabricated number).
 */
export function NotificationBell({ role }: { role: RoleId }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [unread, setUnread] = React.useState(0)
  const [items, setItems] = React.useState<NotificationItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [err, setErr] = React.useState(false)

  // Once the SSE stream has produced a value, the one-shot initial fetch must not
  // overwrite it with a now-stale count (both fire on mount).
  const sseSeen = React.useRef(false)
  // Mirrors `open` so the SSE handler can refresh the list without resubscribing.
  const openRef = React.useRef(false)
  React.useEffect(() => {
    openRef.current = open
  }, [open])

  const fetchUnread = React.useCallback(async () => {
    try {
      const res = await notificationApi.unreadCount()
      setUnread(Number(res.data?.unreadCount) || 0)
    } catch {
      /* ignore poll errors */
    }
  }, [])

  const fetchList = React.useCallback(async () => {
    setErr(false)
    setLoading(true)
    try {
      const res = await notificationApi.list(0, 10)
      setItems(res.data.items ?? [])
    } catch {
      setErr(true)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial unread count (skipped if the SSE stream already produced one).
  React.useEffect(() => {
    let alive = true
    notificationApi
      .unreadCount()
      .then((res) => {
        if (alive && !sseSeen.current) setUnread(Number(res.data?.unreadCount) || 0)
      })
      .catch(() => {
        if (alive && !sseSeen.current) setUnread(0)
      })
    return () => {
      alive = false
    }
  }, [])

  // Live realtime updates — the SSE stream pushes the unread count on every change; refresh the
  // open panel so newly arrived items show without reopening.
  React.useEffect(() => {
    const ac = subscribeNotificationUnread(
      (n) => {
        sseSeen.current = true
        setUnread(n)
        if (openRef.current) void fetchList()
      },
      () => {},
    )
    return () => ac.abort()
  }, [fetchList])

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      void fetchList()
      void fetchUnread()
    }
  }

  const markRead = async (n: NotificationItem) => {
    if (n.read) return
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
    setUnread((u) => Math.max(0, u - 1))
    try {
      await notificationApi.markRead(n.id)
      void fetchUnread()
    } catch {
      void fetchList()
      void fetchUnread()
    }
  }

  const markAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })))
    setUnread(0)
    try {
      await notificationApi.markAllRead()
    } catch {
      void fetchList()
      void fetchUnread()
    }
  }

  // Clicking a row marks it read, closes the panel, and deep-links to where it belongs
  // (the assignment, the class, the chat thread, …). No destination → just marks read.
  const openNotification = (n: NotificationItem) => {
    void markRead(n)
    const href = resolveNotificationHref(n, role)
    setOpen(false)
    if (href) router.push(href)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Thông báo (${unread} chưa đọc)` : 'Thông báo'}
          className="relative grid h-[38px] w-[38px] place-items-center rounded-ga border border-ga-line text-ga-muted transition-colors hover:bg-ga-surface hover:text-ga-ink data-[state=open]:bg-ga-surface data-[state=open]:text-ga-ink"
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
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(100vw-2rem,24rem)] overflow-hidden rounded-ga border-ga-line bg-ga-card p-0 shadow-ga-panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ga-line bg-ga-surface px-4 py-3">
          <span className="font-ga-display text-[15px] font-semibold text-ga-ink">Thông báo</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markAll()}
              className="ga-ui text-[12px] font-semibold text-ga-accent transition-opacity hover:opacity-70"
            >
              Đánh dấu đã đọc
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[22rem] overflow-y-auto">
          {loading && items.length === 0 ? (
            <p className="ga-ui px-4 py-8 text-center text-[13px] text-ga-muted">Đang tải…</p>
          ) : err ? (
            <div className="px-4 py-8 text-center">
              <p className="ga-ui text-[13px] text-ga-muted">Không thể tải thông báo.</p>
              <button
                type="button"
                onClick={() => void fetchList()}
                className="ga-ui mt-2 text-[12px] font-semibold text-ga-accent hover:opacity-70"
              >
                Thử lại
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="font-ga-display text-[15px] font-medium text-ga-ink">Chưa có thông báo</p>
              <p className="ga-ui mt-1 text-[12.5px] text-ga-muted">Các cập nhật mới sẽ hiện ở đây.</p>
            </div>
          ) : (
            items.map((n, i) => {
              const tone = TYPE_TONE[n.type] ?? 'var(--ga-muted)'
              const body = notifBody(n)
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openNotification(n)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-ga-surface ${
                    i ? 'border-t border-ga-border' : ''
                  } ${!n.read ? 'bg-ga-accent-soft/40' : ''}`}
                >
                  <span
                    className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-ga"
                    style={{ background: `${tone}1a`, color: tone }}
                  >
                    <GaIcon name={TYPE_ICON[n.type] ?? 'notifications'} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold capitalize text-ga-ink">{notifTitle(n)}</p>
                    {body && <p className="ga-ui mt-0.5 line-clamp-2 text-[12px] text-ga-muted">{body}</p>}
                    <p className="ga-ui mt-1 text-[11px] text-ga-subtle">{relTime(n.createdAtUtc)}</p>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ga-accent" aria-label="chưa đọc" />
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Footer — the full inbox opens only from here */}
        <div className="border-t border-ga-line bg-ga-surface px-4 py-2.5">
          <Link
            href={`/v2/notifications?from=${role}`}
            onClick={() => setOpen(false)}
            className="ga-ui block text-center text-[12px] font-semibold text-ga-accent transition-opacity hover:opacity-70"
          >
            Xem tất cả thông báo →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
