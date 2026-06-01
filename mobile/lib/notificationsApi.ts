// Notification list shapes + mapping. Pure (no imports) so it is trivially
// unit-testable. Backend GET /api/notifications -> NotificationPageResponse;
// title/body live inside a freeform `payload` map, status is `read`, timestamp
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
  const title = typeof p.title === 'string' && p.title ? p.title : notificationTypeLabel(item.type)
  const body =
    typeof p.body === 'string' && p.body
      ? p.body
      : typeof p.message === 'string' && p.message
        ? p.message
        : ''
  return { id: item.id, title, body, type: item.type, isRead: item.read, createdAt: item.createdAtUtc }
}
