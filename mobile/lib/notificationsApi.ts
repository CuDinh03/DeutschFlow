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
    default:
      return 'Thông báo'
  }
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
  return { id: item.id, title, body, type: item.type, isRead: item.read, createdAt: item.createdAtUtc }
}
