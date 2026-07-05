import type { NotificationItem } from '@/lib/notificationApi'
import type { RoleId } from '@/components/ui-v2/nav'

// Shared display helpers for notifications (icon / tone / label / title / body / time).
// Used by the full inbox page (v2/notifications) and the top-bar bell dropdown so both
// stay visually and semantically in sync. Keys MUST match backend NotificationType
// (com.deutschflow.notification.NotificationType). Unknown types fall back to a generic
// bell + muted tone below.
export const TYPE_ICON: Record<string, string> = {
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
  CLASS_SESSION_SCHEDULED: 'event',
  CLASS_SESSION_CANCELLED: 'event_busy',
  CLASS_SESSION_RESCHEDULED: 'edit_calendar',
  NEW_MESSAGE: 'chat',
  USER_REGISTERED: 'person',
  LEARNER_PLAN_UPDATED: 'description',
  ADMIN_LEARNER_PLAN_CHANGED: 'description',
  ADMIN_LEARNER_SUBSCRIBED: 'payments',
  ACCOUNT_DELETED: 'person_off',
  ADMIN_LEARNER_SUBSCRIPTION_ENDED: 'money_off',
  ADMIN_SYSTEM_ALERT: 'warning',
  ADMIN_ORG_CREATED: 'apartment',
  ADMIN_ORG_INVOICE_PAID: 'paid',
}

export const TYPE_TONE: Record<string, string> = {
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
  CLASS_SESSION_SCHEDULED: 'var(--ga-teal)',
  CLASS_SESSION_CANCELLED: 'var(--ga-red)',
  CLASS_SESSION_RESCHEDULED: 'var(--ga-orange)',
  NEW_MESSAGE: 'var(--ga-blue)',
  USER_REGISTERED: 'var(--ga-muted)',
  LEARNER_PLAN_UPDATED: 'var(--ga-blue)',
  ADMIN_LEARNER_PLAN_CHANGED: 'var(--ga-blue)',
  ADMIN_LEARNER_SUBSCRIBED: 'var(--ga-green)',
  ACCOUNT_DELETED: 'var(--ga-red)',
  ADMIN_LEARNER_SUBSCRIPTION_ENDED: 'var(--ga-orange)',
  ADMIN_SYSTEM_ALERT: 'var(--ga-red)',
  ADMIN_ORG_CREATED: 'var(--ga-teal)',
  ADMIN_ORG_INVOICE_PAID: 'var(--ga-green)',
}

// Vietnamese labels for notification types when payload/title is absent.
export const TYPE_LABEL: Record<string, string> = {
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
  CLASS_SESSION_SCHEDULED: 'Lịch học mới',
  CLASS_SESSION_CANCELLED: 'Buổi học bị huỷ',
  CLASS_SESSION_RESCHEDULED: 'Đổi lịch học',
  NEW_MESSAGE: 'Tin nhắn mới',
  USER_REGISTERED: 'Người dùng đăng ký',
  LEARNER_PLAN_UPDATED: 'Gói học được cập nhật',
  ADMIN_LEARNER_PLAN_CHANGED: 'Gói học thay đổi',
  ADMIN_LEARNER_SUBSCRIBED: 'Đăng ký gói học mới',
  ACCOUNT_DELETED: 'Xoá tài khoản',
  ADMIN_LEARNER_SUBSCRIPTION_ENDED: 'Gói học kết thúc',
  ADMIN_SYSTEM_ALERT: 'Cảnh báo hệ thống',
  ADMIN_ORG_CREATED: 'Tổ chức mới',
  ADMIN_ORG_INVOICE_PAID: 'Hoá đơn đã thanh toán',
}

function pick(payload: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = payload[k]
    if (typeof v === 'string' && v.trim()) return v
  }
  return null
}

export function notifTitle(n: NotificationItem): string {
  // Prefer the server-rendered title; fall back to payload keys / a typed label.
  if (typeof n.title === 'string' && n.title.trim()) return n.title
  return pick(n.payload, 'title', 'heading', 'subject') ?? TYPE_LABEL[n.type] ?? 'Thông báo'
}

export function notifBody(n: NotificationItem): string | null {
  if (typeof n.body === 'string' && n.body.trim()) return n.body
  return pick(n.payload, 'message', 'body', 'text', 'description')
}

export function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 36e5
  if (diff < 1) return 'vừa xong'
  if (diff < 24) return `${Math.floor(diff)} giờ trước`
  const d = Math.floor(diff / 24)
  if (d < 7) return `${d} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN')
}

export function dayBucket(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const isSame = d.toDateString() === today.toDateString()
  const yest = new Date(today)
  yest.setDate(today.getDate() - 1)
  if (isSame) return 'Hôm nay'
  if (d.toDateString() === yest.toDateString()) return 'Hôm qua'
  return 'Trước đó'
}

/** Read the first non-empty payload value among `keys`, as a string (ids arrive as numbers). */
function payloadId(payload: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = payload[k]
    if (v !== null && v !== undefined && String(v).trim() !== '') return String(v)
  }
  return null
}

/**
 * Resolve the in-app destination for a notification on the Galerie v2 surface — the href to open
 * when the row is clicked. `role` is the VIEWER's area (from the shell), used to keep cross-role
 * types (e.g. NEW_MESSAGE) inside the viewer's own section. Returns `null` when there is no useful
 * destination (the row then just marks itself read). Payload keys are verbatim from the backend
 * producers (UserNotificationService / MessageService / StudentAssignmentController).
 */
export function resolveNotificationHref(item: NotificationItem, role: RoleId): string | null {
  const p = item.payload ?? {}
  const classId = payloadId(p, 'classId')
  const assignmentId = payloadId(p, 'assignmentId')
  const studentId = payloadId(p, 'studentId')
  const senderId = payloadId(p, 'senderId')
  const referenceId = payloadId(p, 'referenceId')

  switch (item.type) {
    // ── Student ─────────────────────────────────────────────────────────────
    case 'NEW_ASSIGNMENT':
    case 'NEW_CLASS_ASSIGNMENT':
      if (classId && (assignmentId || referenceId))
        return `/v2/student/classes/${classId}/assignments/${assignmentId ?? referenceId}`
      return classId ? `/v2/student/classes/${classId}` : null
    case 'ASSIGNMENT_GRADED':
      // Speaking sessions live under review; other graded work has no classId in the payload,
      // so fall back to the class list rather than fabricate a broken per-assignment URL.
      if (String(p.assignmentType) === 'SPEAKING') return '/v2/student/review'
      return '/v2/student/classes'
    case 'ADDED_TO_CLASS':
    case 'JOIN_REQUEST_APPROVED':
    case 'TEACHER_ANNOUNCEMENT':
    case 'CLASS_SESSION_SCHEDULED':
    case 'CLASS_SESSION_CANCELLED':
    case 'CLASS_SESSION_RESCHEDULED':
      return classId ? `/v2/student/classes/${classId}` : '/v2/student/classes'
    case 'JOIN_REQUEST_REJECTED':
      return '/v2/student/classes'
    case 'REVIEW_DUE':
      return '/v2/student/review'
    case 'STREAK_REMINDER':
      return '/v2/student/dashboard'
    case 'ACHIEVEMENT_UNLOCKED':
    case 'LEVEL_UP':
      return '/v2/student/achievements'

    // ── Teacher ─────────────────────────────────────────────────────────────
    case 'CLASS_STUDENT_ADDED':
    case 'CLASS_STUDENT_REMOVED':
      if (classId && studentId) return `/v2/teacher/classes/${classId}/students/${studentId}`
      return classId ? `/v2/teacher/classes/${classId}` : null
    case 'CLASS_JOIN_REQUEST_CREATED':
      return classId ? `/v2/teacher/classes/${classId}` : null
    case 'QUIZ_SUBMISSION_RECEIVED':
      if (classId && studentId) return `/v2/teacher/classes/${classId}/students/${studentId}`
      return '/v2/teacher/grading'

    // ── Cross-role — route into the viewer's own area ─────────────────────────
    case 'NEW_MESSAGE':
      return role === 'teacher' ? '/v2/teacher/messages' : '/v2/student/messages'

    // ── Admin / Org ───────────────────────────────────────────────────────────
    case 'USER_REGISTERED':
    case 'ADMIN_LEARNER_PLAN_CHANGED':
    case 'ADMIN_LEARNER_SUBSCRIBED':
    case 'ADMIN_LEARNER_SUBSCRIPTION_ENDED':
    case 'ACCOUNT_DELETED':
      return '/v2/admin/users'
    case 'ADMIN_ORG_CREATED':
      return '/v2/admin/organizations'
    case 'ADMIN_ORG_INVOICE_PAID':
      return role === 'org' ? '/v2/org/billing' : '/v2/admin/organizations'
    case 'ADMIN_BROADCAST':
      return role === 'admin' ? '/v2/admin/broadcast' : null

    default:
      return null
  }
}
