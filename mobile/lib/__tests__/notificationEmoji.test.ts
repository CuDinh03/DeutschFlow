import { mapNotification, type RawNotificationItem } from '@/lib/notificationsApi'

const raw = (over: Partial<RawNotificationItem>): RawNotificationItem => ({
  id: 1, type: 'ACHIEVEMENT_UNLOCKED', title: 'Thành tích mới', body: '', payload: null, read: false, createdAtUtc: '2026-11-20T07:00:00Z', ...over,
})

describe('mapNotification — mobile không hiện emoji trong thông báo', () => {
  test('bỏ emoji giữa nội dung (tên huy hiệu seed V111)', () => {
    const n = mapNotification(raw({ body: 'Bạn đã mở khóa huy hiệu "Người ôn tập 📚"! +50 XP' }))
    expect(n.body).toBe('Bạn đã mở khóa huy hiệu "Người ôn tập"! +50 XP')
  })
  test('bỏ emoji trong tiêu đề; tiêu đề toàn emoji thì giữ nguyên', () => {
    expect(mapNotification(raw({ title: '🔥 Chuỗi học tập' })).title).toBe('Chuỗi học tập')
    expect(mapNotification(raw({ title: '🎉' })).title).toBe('🎉')
  })
  test('chữ không có emoji giữ nguyên', () => {
    const n = mapNotification(raw({ body: 'Bạn có 1 thẻ cần ôn tập hôm nay' }))
    expect(n.body).toBe('Bạn có 1 thẻ cần ôn tập hôm nay')
  })
})
