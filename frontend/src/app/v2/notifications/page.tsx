'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import { notificationApi, type NotificationItem } from '@/lib/notificationApi'
import { TYPE_TONE, TYPE_ICON, notifTitle, notifBody, relTime, dayBucket, resolveNotificationHref } from '@/lib/notificationDisplay'
import { GaPageHdr, GaBtn, ErrorBanner, LoadingState, GaIcon } from '@/components/ui-v2'
import { RoleShell, useViewerRole } from '../RoleShell'

// Reuse notificationApi (list / markRead / markAllRead) 1:1. LIST pattern + date groups +
// read/unread. Item content comes from `payload` (free-form) → render tolerantly.
// Type→icon/tone/label + title/body/time helpers are shared with the top-bar bell dropdown
// via @/lib/notificationDisplay so both surfaces stay in sync.

function NotificationsBody() {
  const router = useRouter()
  const role = useViewerRole()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await notificationApi.list(0, 40)
      setItems(res.data.items ?? [])
    } catch {
      setError('Không thể tải thông báo.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const unread = items.filter((n) => !n.read).length

  const markRead = async (n: NotificationItem) => {
    if (n.read) return
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
    try {
      await notificationApi.markRead(n.id)
    } catch {
      void load()
    }
  }
  const markAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })))
    try {
      await notificationApi.markAllRead()
      toast.success('Đã đánh dấu tất cả là đã đọc.')
    } catch {
      void load()
    }
  }

  // Clicking a row marks it read and deep-links to where it belongs (assignment, class, chat, …).
  const openNotification = (n: NotificationItem) => {
    void markRead(n)
    const href = resolveNotificationHref(n, role)
    if (href) router.push(href)
  }

  // Group by day bucket, preserving order.
  const buckets: { label: string; rows: NotificationItem[] }[] = []
  for (const n of items) {
    const b = dayBucket(n.createdAtUtc)
    const last = buckets[buckets.length - 1]
    if (last && last.label === b) last.rows.push(n)
    else buckets.push({ label: b, rows: [n] })
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Thông báo"
        subtitle={unread > 0 ? `${unread} thông báo chưa đọc` : 'Tất cả đã đọc'}
        right={
          unread > 0 ? (
            <GaBtn variant="ghost" size="sm" onClick={markAll}>
              <CheckCheck size={15} aria-hidden /> Đánh dấu đã đọc tất cả
            </GaBtn>
          ) : null
        }
      />
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={() => void load()} />
          </div>
        )}
        {loading ? (
          <LoadingState variant="skeleton" rows={5} />
        ) : items.length === 0 ? (
          <div className="border border-ga-line bg-ga-card py-16 text-center">
            <p className="font-ga-display text-[20px] font-medium text-ga-ink">Chưa có thông báo</p>
            <p className="ga-ui mt-2 text-[14px] text-ga-muted">Các cập nhật mới sẽ hiện ở đây.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {buckets.map((bucket) => (
              <div key={bucket.label}>
                <p className="ga-ui mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ga-subtle">
                  {bucket.label}
                </p>
                <div className="border border-ga-line bg-ga-card">
                  {bucket.rows.map((n, i) => {
                    const tone = TYPE_TONE[n.type] ?? 'var(--ga-muted)'
                    const body = notifBody(n)
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => openNotification(n)}
                        className={`flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-ga-surface lg:gap-3.5 lg:px-5 ${
                          i ? 'border-t border-ga-border' : ''
                        }`}
                      >
                        <span
                          className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-ga"
                          style={{ background: `${tone}1a`, color: tone }}
                        >
                          <GaIcon name={TYPE_ICON[n.type] ?? 'notifications'} size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-[14px] font-semibold capitalize text-ga-ink">{notifTitle(n)}</p>
                          {body && <p className="ga-ui mt-0.5 break-words text-[13px] text-ga-muted">{body}</p>}
                          <p className="ga-ui mt-1 text-[11.5px] text-ga-subtle">{relTime(n.createdAtUtc)}</p>
                        </div>
                        {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-ga-accent" aria-label="chưa đọc" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function V2NotificationsPage() {
  return (
    <RoleShell>
      <NotificationsBody />
    </RoleShell>
  )
}
