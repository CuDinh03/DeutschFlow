// Nhắc học 20:00 hằng tối (local notification — onboarding v1 §7.2).
//
// Pre-permission pattern: app KHÔNG xin quyền lúc mở. Sheet ngữ cảnh hỏi trước;
// chỉ khi user đồng ý trên sheet mới gọi hộp thoại hệ thống — nên một lần "Để
// sau" trên sheet không đốt lượt hỏi quyền OS. expo-notifications đã có trong
// binary (installed dep) → bật được qua OTA, không cần build mới.

import * as Notifications from 'expo-notifications'
import { captureEvent } from './analytics'

export const REMINDER_HOUR = 20
const REMINDER_ID = 'df-study-reminder-2000'

/**
 * Xin quyền hệ thống (nếu cần) rồi đặt nhắc lặp hằng ngày lúc 20:00.
 * Trả về true khi quyền được cấp và lịch đã đặt. Không bao giờ throw.
 */
export async function enableStudyReminder(dailyGoalMinutes: number | null): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync()
    let granted = current.granted
    if (!granted) {
      const asked = await Notifications.requestPermissionsAsync()
      granted = asked.granted
    }
    captureEvent('onb_notif_permission', { granted })
    if (!granted) return false

    // Idempotent: gỡ lịch cũ (nếu có) rồi đặt lại.
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => undefined)
    const goal = dailyGoalMinutes && dailyGoalMinutes > 0 ? dailyGoalMinutes : 15
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: {
        title: 'Giữ chuỗi hôm nay 🔥',
        body: `${goal} phút tiếng Đức trước khi ngủ — đủ để chuỗi của bạn sống thêm một ngày.`,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: REMINDER_HOUR,
        minute: 0,
      },
    })
    return true
  } catch {
    return false
  }
}
