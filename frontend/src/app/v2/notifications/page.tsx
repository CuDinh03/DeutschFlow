'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import { notificationApi, type NotificationItem } from '@/lib/notificationApi'
import { GaPageHdr, GaBtn, ErrorBanner, LoadingState, GaIcon } from '@/components/ui-v2'
import { RoleShell } from '../RoleShell'

// Reuse notificationApi (list / markRead / markAllRead) 1:1. LIST pattern + date groups +
// read/unread. Item content comes from `payload` (free-form) → render tolerantly.

const TYPE_ICON: Record<string, string> = {
  SRS_DUE: 'schedule',
  ASSIGNMENT: 'assignment',
  GRADE: 'grading',
  CLASS: 'groups',
  ACHIEVEMENT: 'emoji_events',
  BROADCAST: 'campaign',
  SYSTEM: 'info',
}
const TYPE_TONE: Record<string, string> = {
  SRS_DUE: 'var(--ga-orange)',
  ASSIGNMENT: 'var(--ga-blue)',
  GRADE: 'var(--ga-green)',
  CLASS: 'var(--ga-violet)',
  ACHIEVEMENT: 'var(--ga-gold)',
  BROADCAST: 'var(--ga-teal)',
  SYSTEM: 'var(--ga-muted)',
}

function pick(payload: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = payload[k]
    if (typeof v === 'string' && v.trim()) return v
  }
  return null
}
function notifTitle(n: NotificationItem): string {
  return pick(n.payload, 'title', 'heading', 'subject') ?? n.type.replace(/_/g, ' ')
}
function notifBody(n: NotificationItem): string | null {
  return pick(n.payload, 'message', 'body', 'text', 'description')
}
function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 36e5
  if (diff < 1) return 'vừa xong'
  if (diff < 24) return `${Math.floor(diff)} giờ trước`
  const d = Math.floor(diff / 24)
  if (d < 7) return `${d} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN')
}
function dayBucket(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const isSame = d.toDateString() === today.toDateString()
  const yest = new Date(today)
  yest.setDate(today.getDate() - 1)
  if (isSame) return 'Hôm nay'
  if (d.toDateString() === yest.toDateString()) return 'Hôm qua'
  return 'Trước đó'
}

function NotificationsBody() {
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

  // Group by day bucket, preserving order.
  const buckets: { label: string; rows: NotificationItem[] }[] = []
  for (const n of items) {
    const b = dayBucket(n.createdAtUtc)
    const last = buckets[buckets.length - 1]
    if (last && last.label === b) last.rows.push(n)
    else buckets.push({ label: b, rows: [n] })
  }

  return (
    <div className="flex min-h-screen flex-col">
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
      <div className="flex-1 px-10 py-6">
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
                        onClick={() => markRead(n)}
                        className={`flex w-full items-start gap-3.5 px-5 py-4 text-left transition-colors hover:bg-ga-surface ${
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
                          <p className="text-[14px] font-semibold capitalize text-ga-ink">{notifTitle(n)}</p>
                          {body && <p className="ga-ui mt-0.5 text-[13px] text-ga-muted">{body}</p>}
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
