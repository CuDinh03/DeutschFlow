import type { NotificationItem } from '@/lib/notificationApi'
import type { RoleId } from '@/components/ui-v2/nav'
import { formatDate } from '@/lib/i18n/format'

// Shared display helpers for notifications (icon / tone / label / title / body / time).
// Used by the full inbox page (v2/notifications) and the top-bar bell dropdown so both
// stay visually and semantically in sync. Keys MUST match backend NotificationType
// (com.deutschflow.notification.NotificationType). Unknown types fall back to a generic
// bell + muted tone below.
export const TYPE_ICON: Record<string, string> = {
  REVIEW_DUE: 'repeat',
  STREAK_REMINDER: 'local_fire_department',
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
  CLASS_CHANNEL_MESSAGE: 'forum',
  USER_REGISTERED: 'person',
  LEARNER_PLAN_UPDATED: 'description',
  ADMIN_LEARNER_PLAN_CHANGED: 'description',
  ADMIN_LEARNER_SUBSCRIBED: 'payments',
  ACCOUNT_DELETED: 'person_off',
  ADMIN_LEARNER_SUBSCRIPTION_ENDED: 'money_off',
  ADMIN_SYSTEM_ALERT: 'warning',
  ADMIN_ORG_CREATED: 'apartment',
  ADMIN_ORG_INVOICE_PAID: 'paid',
  // Thông báo nội bộ trung tâm (DEC-18) — chỉ giáo viên nhận.
  SCHEDULE_CHANGE_REJECTED: 'event_busy',
  TIMESHEET_PERIOD_APPROVED: 'fact_check',
  TIMESHEET_PERIOD_RETURNED: 'edit',
  // Ngày sinh do trung tâm đặt/sửa (Q-02, 14/09/2026) — người nhận là CHÍNH học viên.
  BIRTH_DATE_UPDATED: 'cake',
  CERTIFICATE_ISSUED: 'workspace_premium',
  // 2FA ADMIN (09/11/2026) — người nhận là chính chủ tài khoản quản trị.
  MFA_ENABLED: 'lock',
  MFA_RECOVERY_CODE_USED: 'lock_open',
  MFA_RECOVERY_CODES_LOW: 'warning',
  MFA_RESET_BY_ADMIN: 'lock_open',
  // Đội hỗ trợ đặt lại mật khẩu (đợt 2 admin, 09/11/2026) — người nhận là CHÍNH người bị đổi.
  PASSWORD_RESET_BY_ADMIN: 'key',
}

/**
 * Tông ô icon theo loại (rà icon 07/11/2026). Trước đây mỗi loại một màu (cam, xanh, tím, ngọc, vàng…)
 * nên chuông thông báo thành cầu vồng, lệch hệ ô nhận diện `GaGlyph` của mọi màn khác. Giờ chỉ còn nghĩa:
 * navy mặc định · red việc hỏng/huỷ/cảnh báo · green việc đã thành · plain việc phụ, chỉ để biết.
 */
export type NotifTone = 'navy' | 'red' | 'green' | 'plain'

const RED: string[] = ['CLASS_SESSION_CANCELLED', 'ACCOUNT_DELETED', 'ADMIN_SYSTEM_ALERT', 'SCHEDULE_CHANGE_REJECTED', 'MFA_RECOVERY_CODE_USED', 'MFA_RECOVERY_CODES_LOW', 'MFA_RESET_BY_ADMIN', 'PASSWORD_RESET_BY_ADMIN']
const GREEN: string[] = ['ASSIGNMENT_GRADED', 'JOIN_REQUEST_APPROVED', 'ADMIN_LEARNER_SUBSCRIBED', 'ADMIN_ORG_INVOICE_PAID', 'TIMESHEET_PERIOD_APPROVED', 'CERTIFICATE_ISSUED', 'MFA_ENABLED']
const PLAIN: string[] = ['CLASS_STUDENT_REMOVED', 'JOIN_REQUEST_REJECTED', 'USER_REGISTERED']

export function notifTone(type: string): NotifTone {
  if (RED.includes(type)) return 'red'
  if (GREEN.includes(type)) return 'green'
  if (PLAIN.includes(type) || !(type in TYPE_ICON)) return 'plain'
  return 'navy'
}

/**
 * Nhãn tiếng Việt theo loại (giữ làm fallback cuối khi catalog thiếu khoá). Từ 06/09/2026 nhãn hiển thị
 * đọc từ catalog chrome `v2.notif.types.<TYPE>` qua translator truyền vào notifTitle/relTime/dayBucket.
 */
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
  CLASS_CHANNEL_MESSAGE: 'Tin nhắn lớp',
  USER_REGISTERED: 'Người dùng đăng ký',
  LEARNER_PLAN_UPDATED: 'Gói học được cập nhật',
  ADMIN_LEARNER_PLAN_CHANGED: 'Gói học thay đổi',
  ADMIN_LEARNER_SUBSCRIBED: 'Đăng ký gói học mới',
  ACCOUNT_DELETED: 'Xoá tài khoản',
  ADMIN_LEARNER_SUBSCRIPTION_ENDED: 'Gói học kết thúc',
  ADMIN_SYSTEM_ALERT: 'Cảnh báo hệ thống',
  ADMIN_ORG_CREATED: 'Tổ chức mới',
  ADMIN_ORG_INVOICE_PAID: 'Hoá đơn đã thanh toán',
  SCHEDULE_CHANGE_REJECTED: 'Đề xuất đổi lịch bị từ chối',
  TIMESHEET_PERIOD_APPROVED: 'Kỳ công đã được duyệt',
  TIMESHEET_PERIOD_RETURNED: 'Kỳ công bị trả lại',
  BIRTH_DATE_UPDATED: 'Ngày sinh được cập nhật',
  CERTIFICATE_ISSUED: 'Có chứng nhận mới',
  MFA_ENABLED: 'Đã bật xác thực hai lớp',
  MFA_RECOVERY_CODE_USED: 'Đã dùng mã khôi phục',
  MFA_RECOVERY_CODES_LOW: 'Sắp hết mã khôi phục',
  MFA_RESET_BY_ADMIN: 'Xác thực hai lớp đã được đặt lại',
  PASSWORD_RESET_BY_ADMIN: 'Mật khẩu đã được đặt lại',
}


function pick(payload: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = payload[k]
    if (typeof v === 'string' && v.trim()) return v
  }
  return null
}

/** Translator của namespace `v2.notif` (chrome core — có ở mọi provider). */
export type NotifT = { (key: string, values?: Record<string, string | number>): string; has(key: string): boolean }

export function notifTitle(n: NotificationItem, t?: NotifT): string {
  // Prefer the server-rendered title; fall back to payload keys / a typed label.
  if (typeof n.title === 'string' && n.title.trim()) return n.title
  const fromPayload = pick(n.payload, 'title', 'heading', 'subject')
  if (fromPayload) return fromPayload
  if (t) return t.has(`types.${n.type}`) ? t(`types.${n.type}`) : TYPE_LABEL[n.type] ?? t('fallbackTitle')
  return TYPE_LABEL[n.type] ?? 'Thông báo'
}

export function notifBody(n: NotificationItem): string | null {
  if (typeof n.body === 'string' && n.body.trim()) return n.body
  return pick(n.payload, 'message', 'body', 'text', 'description')
}

export function relTime(iso: string, t?: NotifT, locale: string = 'vi'): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 36e5
  if (diff < 1) return t ? t('justNow') : 'vừa xong'
  if (diff < 24) return t ? t('hoursAgo', { n: Math.floor(diff) }) : `${Math.floor(diff)} giờ trước`
  const d = Math.floor(diff / 24)
  if (d < 7) return t ? t('daysAgo', { n: d }) : `${d} ngày trước`
  return formatDate(locale, iso)
}

export function dayBucket(iso: string, t?: NotifT): string {
  const d = new Date(iso)
  const today = new Date()
  const isSame = d.toDateString() === today.toDateString()
  const yest = new Date(today)
  yest.setDate(today.getDate() - 1)
  if (isSame) return t ? t('today') : 'Hôm nay'
  if (d.toDateString() === yest.toDateString()) return t ? t('yesterday') : 'Hôm qua'
  return t ? t('earlier') : 'Trước đó'
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
  const senderName = payloadId(p, 'senderName')
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
    case 'BIRTH_DATE_UPDATED':
      // Về hồ sơ của chính mình: thông báo này chỉ có ích khi người nhận đối chiếu được giá trị.
      return '/v2/profile'
    case 'MFA_ENABLED':
    case 'MFA_RECOVERY_CODE_USED':
    case 'MFA_RECOVERY_CODES_LOW':
    case 'MFA_RESET_BY_ADMIN':
      // 2FA: trạng thái + "Tạo mã khôi phục mới" nằm ở Hồ sơ → Bảo mật.
    case 'PASSWORD_RESET_BY_ADMIN':
      // Hồ sơ → tab Bảo mật có "Hoạt động bảo mật" và nút đổi mật khẩu.
      return '/v2/profile'
    case 'CERTIFICATE_ISSUED':
      return '/v2/student/certificates'
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
      // "Bài cần xem" means there is work to GRADE, so open the grading queue — not the student's
      // read-only detail page, where the teacher can look at the submission but not act on it.
      return '/v2/teacher/grading'
    case 'SCHEDULE_CHANGE_REJECTED':
      // Đề xuất bị từ chối nằm trong bảng đề xuất của màn lịch dạy (TeacherRequestsPanel).
      return '/v2/teacher/schedule'
    case 'TIMESHEET_PERIOD_APPROVED':
    case 'TIMESHEET_PERIOD_RETURNED':
      return '/v2/teacher/tc-timesheet'

    // ── Cross-role — route into the viewer's own area ─────────────────────────
    case 'NEW_MESSAGE': {
      // Open the exact sender thread (the messages page reads ?to=<userId>&name=<name>),
      // matching the mobile deep-link. No senderId → just the conversation list.
      const base = role === 'teacher' ? '/v2/teacher/messages' : '/v2/student/messages'
      if (!senderId) return base
      const q = new URLSearchParams({ to: senderId })
      if (senderName) q.set('name', senderName)
      return `${base}?${q.toString()}`
    }
    case 'CLASS_CHANNEL_MESSAGE': {
      // Group-channel message — open the class it belongs to, in the viewer's own area.
      const area = role === 'teacher' ? '/v2/teacher/classes' : '/v2/student/classes'
      return classId ? `${area}/${classId}` : area
    }

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
