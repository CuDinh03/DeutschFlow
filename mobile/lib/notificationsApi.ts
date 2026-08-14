// Notification list shapes + mapping. Pure (no imports) so it is trivially
// unit-testable. Backend GET /api/notifications -> NotificationPageResponse.
// The backend now renders `title`/`body` server-side (NotificationContentRenderer)
// so every type has meaningful, recorded content; we prefer those and fall back
// to the freeform `payload` map for older backends. Status is `read`, timestamp
// is `createdAtUtc`.

export interface Notification {
  id: number
  title: string
  body: string
  type: string
  isRead: boolean
  createdAt: string
  /** Freeform structured data (ids, codes) kept for deep-link routing on tap. */
  payload: Record<string, unknown>
}

export interface RawNotificationItem {
  id: number
  type: string
  title?: string | null
  body?: string | null
  payload: Record<string, unknown> | null
  read: boolean
  createdAtUtc: string
}

export interface NotificationPage {
  items: RawNotificationItem[]
}

/**
 * Mọi loại thông báo một HỌC VIÊN có thể nhận (đối chiếu backend `NotificationType`).
 * Các loại chỉ dành cho giáo viên/admin không có ở đây — app mobile chỉ cho vai trò STUDENT
 * đăng nhập nên chúng không bao giờ tới máy này.
 *
 * Danh sách này là hợp đồng của bộ test: thêm loại mới cho học viên mà quên nhãn/icon thì
 * test đỏ, thay vì âm thầm rơi về "Thông báo" + chuông chung.
 */
export const STUDENT_NOTIFICATION_TYPES = [
  'ACHIEVEMENT_UNLOCKED',
  'LEVEL_UP',
  'REVIEW_DUE',
  'STREAK_REMINDER',
  'NEW_ASSIGNMENT',
  'NEW_CLASS_ASSIGNMENT',
  'ASSIGNMENT_GRADED',
  'JOIN_REQUEST_APPROVED',
  'JOIN_REQUEST_REJECTED',
  'ADDED_TO_CLASS',
  'TEACHER_ANNOUNCEMENT',
  'ADMIN_BROADCAST',
  'NEW_MESSAGE',
  'CLASS_CHANNEL_MESSAGE',
  'CLASS_SESSION_SCHEDULED',
  'CLASS_SESSION_CANCELLED',
  'CLASS_SESSION_RESCHEDULED',
  'LEARNER_PLAN_UPDATED',
] as const

export function notificationTypeLabel(type: string): string {
  switch (type) {
    case 'ACHIEVEMENT_UNLOCKED':
      return 'Thành tích mới'
    case 'LEVEL_UP':
      return 'Lên cấp'
    case 'REVIEW_DUE':
      return 'Ôn tập hôm nay'
    case 'STREAK_REMINDER':
      return 'Chuỗi học tập'
    case 'NEW_ASSIGNMENT':
    case 'NEW_CLASS_ASSIGNMENT':
      return 'Bài tập mới'
    case 'ASSIGNMENT_GRADED':
      return 'Bài đã chấm'
    case 'JOIN_REQUEST_APPROVED':
      return 'Được duyệt vào lớp'
    case 'JOIN_REQUEST_REJECTED':
      return 'Yêu cầu vào lớp'
    case 'ADDED_TO_CLASS':
      return 'Thêm vào lớp'
    case 'TEACHER_ANNOUNCEMENT':
      return 'Thông báo từ giáo viên'
    case 'ADMIN_BROADCAST':
      return 'Thông báo hệ thống'
    case 'NEW_MESSAGE':
      return 'Tin nhắn mới'
    case 'CLASS_CHANNEL_MESSAGE':
      return 'Tin nhắn lớp'
    case 'CLASS_SESSION_SCHEDULED':
      return 'Lịch học mới'
    case 'CLASS_SESSION_CANCELLED':
      return 'Buổi học bị huỷ'
    case 'CLASS_SESSION_RESCHEDULED':
      return 'Đổi lịch học'
    case 'LEARNER_PLAN_UPDATED':
      return 'Cập nhật gói'
    default:
      return 'Thông báo'
  }
}

/**
 * Khoá icon theo loại thông báo — hàm THUẦN (không import icon) để test được ở môi trường node;
 * màn Thông báo mới ánh xạ khoá → component Lucide.
 *
 * Tách ra vì `stripLeadingEmoji` cắt emoji của MỌI tiêu đề: loại nào không có khoá riêng sẽ vừa
 * mất emoji vừa chỉ còn chuông chung — ít thông tin hơn trước khi cắt.
 */
export type NotificationIconKey =
  | 'trophy'
  | 'levelUp'
  | 'review'
  | 'streak'
  | 'assignment'
  | 'graded'
  | 'classJoinOk'
  | 'classJoinNo'
  | 'classAdded'
  | 'announcement'
  | 'message'
  | 'calendarAdd'
  | 'calendarCancel'
  | 'calendarMove'
  | 'plan'
  | 'bell'

export function notificationIconKey(type: string): NotificationIconKey {
  switch (type) {
    case 'ACHIEVEMENT_UNLOCKED':
      return 'trophy'
    case 'LEVEL_UP':
      return 'levelUp'
    case 'REVIEW_DUE':
      return 'review'
    case 'STREAK_REMINDER':
      return 'streak'
    case 'NEW_ASSIGNMENT':
    case 'NEW_CLASS_ASSIGNMENT':
      return 'assignment'
    case 'ASSIGNMENT_GRADED':
      return 'graded'
    case 'JOIN_REQUEST_APPROVED':
      return 'classJoinOk'
    case 'JOIN_REQUEST_REJECTED':
      return 'classJoinNo'
    case 'ADDED_TO_CLASS':
      return 'classAdded'
    case 'TEACHER_ANNOUNCEMENT':
    case 'ADMIN_BROADCAST':
      return 'announcement'
    case 'NEW_MESSAGE':
    case 'CLASS_CHANNEL_MESSAGE':
      return 'message'
    case 'CLASS_SESSION_SCHEDULED':
      return 'calendarAdd'
    case 'CLASS_SESSION_CANCELLED':
      return 'calendarCancel'
    case 'CLASS_SESSION_RESCHEDULED':
      return 'calendarMove'
    case 'LEARNER_PLAN_UPDATED':
      return 'plan'
  }
  // Loại lạ (backend thêm mới): đoán theo từ khoá rồi mới rơi về chuông.
  if (type.includes('STREAK')) return 'streak'
  if (type.includes('SRS') || type.includes('REVIEW')) return 'review'
  if (type.includes('MESSAGE') || type.includes('CHAT')) return 'message'
  if (type.includes('ASSIGNMENT')) return 'assignment'
  if (type.includes('CLASS')) return 'classAdded'
  return 'bell'
}

// Server-rendered titles historically open with a decorative emoji ("🔥 Chuỗi
// học tập"). The app renders its own themed icon per type, so the leading
// emoji is stripped for display. Manual code-point scan instead of \p{...}
// regex — Hermes' unicode-property support can't be relied on across OTA'd
// runtimes. Emoji elsewhere in the string (real content) is kept.
export function stripLeadingEmoji(s: string): string {
  const isEmojiCodePoint = (cp: number): boolean =>
    (cp >= 0x1f000 && cp <= 0x1ffff) || // pictographs & extended symbols
    (cp >= 0x2600 && cp <= 0x27bf) || // misc symbols + dingbats
    (cp >= 0x2b00 && cp <= 0x2bff) || // arrows/symbols (⬆ lives here)
    (cp >= 0x2190 && cp <= 0x21ff) || // classic arrows
    (cp >= 0x2300 && cp <= 0x23ff) || // technical (⏰, ⌛)
    cp === 0xfe0f || // variation selector-16
    cp === 0x200d || // zero-width joiner
    cp === 0x20e3 // combining keycap
  let i = 0
  while (i < s.length) {
    const cp = s.codePointAt(i)
    if (cp == null || !isEmojiCodePoint(cp)) break
    i += cp > 0xffff ? 2 : 1
  }
  if (i === 0) return s
  const rest = s.slice(i).replace(/^\s+/, '')
  // Emoji-only titles keep the original text rather than going blank.
  return rest ? rest : s
}

export function mapNotification(item: RawNotificationItem): Notification {
  const p = item.payload ?? {}
  // Prefer the server-rendered title/body; fall back to payload keys (older backend).
  const title =
    typeof item.title === 'string' && item.title
      ? item.title
      : typeof p.title === 'string' && p.title
        ? p.title
        : notificationTypeLabel(item.type)
  const body =
    typeof item.body === 'string' && item.body
      ? item.body
      : typeof p.body === 'string' && p.body
        ? p.body
        : typeof p.message === 'string' && p.message
          ? p.message
          : ''
  return { id: item.id, title, body, type: item.type, isRead: item.read, createdAt: item.createdAtUtc, payload: p }
}
