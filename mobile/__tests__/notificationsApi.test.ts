import { mapNotification, notificationTypeLabel, stripLeadingEmoji, type RawNotificationItem } from '@/lib/notificationsApi'

describe('mapNotification', () => {
  it('reads title/body from the payload map and maps read/createdAtUtc', () => {
    const raw: RawNotificationItem = {
      id: 5,
      type: 'BROADCAST',
      payload: { title: 'Bảo trì', body: 'Hệ thống bảo trì lúc 2h sáng' },
      read: true,
      createdAtUtc: '2026-06-01T02:00:00Z',
    }

    expect(mapNotification(raw)).toEqual({
      id: 5,
      title: 'Bảo trì',
      body: 'Hệ thống bảo trì lúc 2h sáng',
      type: 'BROADCAST',
      isRead: true,
      createdAt: '2026-06-01T02:00:00Z',
      payload: { title: 'Bảo trì', body: 'Hệ thống bảo trì lúc 2h sáng' },
    })
  })

  it('prefers the server-rendered title/body over payload', () => {
    const raw: RawNotificationItem = {
      id: 8,
      type: 'LEVEL_UP',
      title: '⬆️ Lên cấp',
      body: 'Chúc mừng! Bạn đã lên Level 5!',
      payload: { oldLevel: 4, newLevel: 5 },
      read: false,
      createdAtUtc: '2026-06-01T05:00:00Z',
    }
    const mapped = mapNotification(raw)
    expect(mapped.title).toBe('⬆️ Lên cấp')
    expect(mapped.body).toBe('Chúc mừng! Bạn đã lên Level 5!')
  })

  it('falls back to a typed label when payload has no title, and to message for body', () => {
    const raw: RawNotificationItem = {
      id: 6,
      type: 'LEVEL_UP',
      payload: { message: 'Bạn đã lên cấp 3' },
      read: false,
      createdAtUtc: '2026-06-01T03:00:00Z',
    }

    const mapped = mapNotification(raw)
    expect(mapped.title).toBe('Lên cấp')
    expect(mapped.body).toBe('Bạn đã lên cấp 3')
    expect(mapped.isRead).toBe(false)
  })

  it('handles a null payload without throwing', () => {
    const raw: RawNotificationItem = {
      id: 7,
      type: 'UNKNOWN_TYPE',
      payload: null,
      read: false,
      createdAtUtc: '2026-06-01T04:00:00Z',
    }
    const mapped = mapNotification(raw)
    expect(mapped.title).toBe('Thông báo')
    expect(mapped.body).toBe('')
  })
})

describe('notificationTypeLabel', () => {
  it('maps known types and defaults unknown ones', () => {
    expect(notificationTypeLabel('ACHIEVEMENT_UNLOCKED')).toBe('Thành tích mới')
    expect(notificationTypeLabel('NEW_CLASS_ASSIGNMENT')).toBe('Bài tập mới')
    expect(notificationTypeLabel('SOMETHING_ELSE')).toBe('Thông báo')
  })
})

describe('stripLeadingEmoji', () => {
  it('strips a single leading emoji + space', () => {
    expect(stripLeadingEmoji('🏆 Thành tích mới')).toBe('Thành tích mới')
    expect(stripLeadingEmoji('🔥 Chuỗi học tập')).toBe('Chuỗi học tập')
    expect(stripLeadingEmoji('📚 Ôn tập hôm nay')).toBe('Ôn tập hôm nay')
  })

  it('strips multi-codepoint emoji (variation selector, ZWJ sequences)', () => {
    expect(stripLeadingEmoji('⬆️ Lên cấp')).toBe('Lên cấp')
    expect(stripLeadingEmoji('👨‍🏫 Bài tập mới')).toBe('Bài tập mới')
  })

  it('leaves titles without a leading emoji untouched', () => {
    expect(stripLeadingEmoji('Lên cấp')).toBe('Lên cấp')
    expect(stripLeadingEmoji('Huy hiệu "Trí nhớ thép 🧠"!')).toBe('Huy hiệu "Trí nhớ thép 🧠"!')
  })

  it('keeps emoji-only titles instead of blanking them', () => {
    expect(stripLeadingEmoji('🔥')).toBe('🔥')
  })
})
