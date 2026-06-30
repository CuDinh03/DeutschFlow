'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import { notificationApi, type NotificationItem } from '@/lib/notificationApi'
import { GaPageHdr, GaBtn, ErrorBanner, LoadingState, GaIcon } from '@/components/ui-v2'
import { RoleShell } from '../RoleShell'

// Reuse notificationApi (list / markRead / markAllRead) 1:1. LIST pattern + date groups +
// read/unread. Item content comes from `payload` (free-form) → render tolerantly.

// Keys MUST match backend NotificationType (com.deutschflow.notification.NotificationType).
// Unknown types fall back to the generic bell + muted tone below.
const TYPE_ICON: Record<string, string> = {
  REVIEW_DUE: 'schedule',
  STREAK_REMINDER: 'schedule',
  NEW_ASSIGNMENT: 'assignment',
  NEW_CLASS_ASSIGNMENT: 'assignment',
  ASSIGNMENT_GRADED: 'grading',
  QUIZ_SUBMISSION_RECEIVED: 'grading',
  ACHIEVEMENT_UNLOCKED: 'emoji_events',
  LEVEL_UP: 'emoji_events',
  ADDED_TO_CLASS: 'groups',
  CLASS_STUDENT_ADDED: 'groups',
  CLASS_STUDENT_REMOVED: 'groups',
  JOIN_REQUEST_APPROVED: 'groups',
  JOIN_REQUEST_REJECTED: 'groups',
  CLASS_JOIN_REQUEST_CREATED: 'group_add',
  ADMIN_BROADCAST: 'campaign',
  TEACHER_ANNOUNCEMENT: 'campaign',
  NEW_MESSAGE: 'chat',
  USER_REGISTERED: 'person',
  LEARNER_PLAN_UPDATED: 'description',
  ADMIN_LEARNER_PLAN_CHANGED: 'description',
  ADMIN_LEARNER_SUBSCRIBED: 'payments',
}
const TYPE_TONE: Record<string, string> = {
  REVIEW_DUE: 'var(--ga-orange)',
  STREAK_REMINDER: 'var(--ga-orange)',
  NEW_ASSIGNMENT: 'var(--ga-blue)',
  NEW_CLASS_ASSIGNMENT: 'var(--ga-blue)',
  ASSIGNMENT_GRADED: 'var(--ga-green)',
  QUIZ_SUBMISSION_RECEIVED: 'var(--ga-blue)',
  ACHIEVEMENT_UNLOCKED: 'var(--ga-gold)',
  LEVEL_UP: 'var(--ga-gold)',
  ADDED_TO_CLASS: 'var(--ga-violet)',
  CLASS_STUDENT_ADDED: 'var(--ga-violet)',
  CLASS_STUDENT_REMOVED: 'var(--ga-muted)',
  JOIN_REQUEST_APPROVED: 'var(--ga-green)',
  JOIN_REQUEST_REJECTED: 'var(--ga-muted)',
  CLASS_JOIN_REQUEST_CREATED: 'var(--ga-violet)',
  ADMIN_BROADCAST: 'var(--ga-teal)',
  TEACHER_ANNOUNCEMENT: 'var(--ga-teal)',
  NEW_MESSAGE: 'var(--ga-blue)',
  USER_REGISTERED: 'var(--ga-muted)',
  LEARNER_PLAN_UPDATED: 'var(--ga-blue)',
  ADMIN_LEARNER_PLAN_CHANGED: 'var(--ga-blue)',
  ADMIN_LEARNER_SUBSCRIBED: 'var(--ga-green)',
}

// Vietnamese labels for notification types when payload.title is absent.
const TYPE_LABEL: Record<string, string> = {
  REVIEW_DUE: 'Đến hạn ôn tập',
  STREAK_REMINDER: 'Nhắc nhở chuỗi học',
  NEW_ASSIGNMENT: 'Bài tập mới',
  NEW_CLASS_ASSIGNMENT: 'Bài tập lớp mới',
  ASSIGNMENT_GRADED: 'Bài tập đã được chấm',
  QUIZ_SUBMISSION_RECEIVED: 'Nhận bài kiểm tra',
  ACHIEVEMENT_UNLOCKED: 'Mở khóa thành tích',
  LEVEL_UP: 'Lên cấp độ',
  ADDED_TO_CLASS: 'Được thêm vào lớp',
  CLASS_STUDENT_ADDED: 'Học viên mới vào lớp',
  CLASS_STUDENT_REMOVED: 'Học viên rời lớp',
  JOIN_REQUEST_APPROVED: 'Yêu cầu tham gia được duyệt',
  JOIN_REQUEST_REJECTED: 'Yêu cầu tham gia bị từ chối',
  CLASS_JOIN_REQUEST_CREATED: 'Yêu cầu tham gia lớp',
  ADMIN_BROADCAST: 'Thông báo hệ thống',
  TEACHER_ANNOUNCEMENT: 'Thông báo từ giáo viên',
  NEW_MESSAGE: 'Tin nhắn mới',
  USER_REGISTERED: 'Người dùng đăng ký',
  LEARNER_PLAN_UPDATED: 'Gói học được cập nhật',
  ADMIN_LEARNER_PLAN_CHANGED: 'Gói học thay đổi',
  ADMIN_LEARNER_SUBSCRIBED: 'Đăng ký gói học mới',
}

function pick(payload: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = payload[k]
    if (typeof v === 'string' && v.trim()) return v
  }
  return null
}
function notifTitle(n: NotificationItem): string {
  // Prefer the server-rendered title; fall back to payload keys / a typed label.
  if (typeof n.title === 'string' && n.title.trim()) return n.title
  return pick(n.payload, 'title', 'heading', 'subject') ?? TYPE_LABEL[n.type] ?? 'Thông báo'
}
function notifBody(n: NotificationItem): string | null {
  if (typeof n.body === 'string' && n.body.trim()) return n.body
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
