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

export function notificationTypeLabel(type: string): string {
  switch (type) {
    case 'ACHIEVEMENT_UNLOCKED':
      return 'Thành tích mới'
    case 'LEVEL_UP':
      return 'Lên cấp'
    case 'NEW_ASSIGNMENT':
    case 'NEW_CLASS_ASSIGNMENT':
      return 'Bài tập mới'
    case 'ASSIGNMENT_GRADED':
      return 'Bài đã chấm'
    case 'CLASS_SESSION_SCHEDULED':
      return 'Lịch học mới'
    case 'CLASS_SESSION_CANCELLED':
      return 'Buổi học bị huỷ'
    case 'CLASS_SESSION_RESCHEDULED':
      return 'Đổi lịch học'
    default:
      return 'Thông báo'
  }
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
