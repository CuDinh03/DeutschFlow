import { notificationIconKey, notificationTypeLabel, STUDENT_NOTIFICATION_TYPES } from '@/lib/notificationsApi'
import { resolveNotificationRoute } from '@/lib/notificationRoute'

/** Đợt 6 (19/09/2026): 6 loại lifecycle phải có nhãn riêng, glyph riêng và route đúng — không rơi về chuông chung. */
const LIFECYCLE = ['ONBOARDING_D0_WELCOME', 'ONBOARDING_D1_NEXT_LESSON', 'ONBOARDING_D3_CHECKIN', 'ONBOARDING_D7_SUMMARY'] as const
const TRIAL = ['TRIAL_ENDING_SOON', 'TRIAL_ENDED'] as const

describe('loại thông báo lifecycle Đợt 6', () => {
  it('nằm trong hợp đồng STUDENT_NOTIFICATION_TYPES', () => {
    for (const t of [...LIFECYCLE, ...TRIAL]) expect(STUDENT_NOTIFICATION_TYPES).toContain(t)
  })

  it('nhãn tiếng Việt riêng, không phải "Thông báo"', () => {
    for (const t of [...LIFECYCLE, ...TRIAL]) {
      expect(notificationTypeLabel(t)).not.toBe('Thông báo')
      expect(notificationTypeLabel(t)).not.toBe(notificationTypeLabel('KHONG_CO'))
    }
    expect(notificationTypeLabel('TRIAL_ENDING_SOON')).not.toMatch(/7 ngày|45 ngày/)
  })

  it('glyph: tuần đầu = chuỗi, trial = gói; route: tuần đầu → Trang chủ, trial → Hồ sơ', () => {
    for (const t of LIFECYCLE) {
      expect(notificationIconKey(t)).toBe('streak')
      expect(resolveNotificationRoute(t, {})).toBe('/(student)')
    }
    for (const t of TRIAL) {
      expect(notificationIconKey(t)).toBe('plan')
      expect(resolveNotificationRoute(t, {})).toBe('/(student)/profile')
    }
  })
})
