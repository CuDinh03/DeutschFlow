// Nhắc học 20:00 hằng tối (local notification — onboarding v1 §7.2).
//
// Pre-permission pattern: app KHÔNG xin quyền lúc mở. Sheet ngữ cảnh hỏi trước;
// chỉ khi user đồng ý trên sheet mới gọi hộp thoại hệ thống — nên một lần "Để
// sau" trên sheet không đốt lượt hỏi quyền OS. expo-notifications đã có trong
// binary (installed dep) → bật được qua OTA, không cần build mới.

import * as Notifications from 'expo-notifications'
import { captureEvent } from './analytics'
import { classifyPermission, type PermissionOutcome } from './permissionOutcome'

export const REMINDER_HOUR = 20
const REMINDER_ID = 'df-study-reminder-2000'

/**
 * Xin quyền hệ thống (nếu cần) rồi đặt nhắc lặp hằng ngày lúc 20:00.
 * Không bao giờ throw.
 *
 * Trả 'granted' | 'denied' | 'blocked' thay vì boolean: 'blocked' nghĩa là OS
 * KHÔNG cho hỏi nữa (iOS chỉ hiện hộp thoại đúng một lần cho cả vòng đời cài
 * đặt). Gộp 'blocked' vào 'denied' như bản cũ khiến sheet im lặng vào cooldown
 * rồi 3 ngày lại hỏi — lặp vô hạn mà không bao giờ bật được (F-14, QA 2026-08-20).
 * Caller phải chỉ đường vào Cài đặt khi gặp 'blocked'.
 */
export async function enableStudyReminder(dailyGoalMinutes: number | null): Promise<PermissionOutcome> {
  try {
    let outcome = classifyPermission(await Notifications.getPermissionsAsync())
    if (outcome === 'denied') {
      // Còn hỏi lại được → ĐÂY là lúc hỏi thật: user vừa bấm đồng ý trên sheet.
      outcome = classifyPermission(await Notifications.requestPermissionsAsync())
    }
    captureEvent('onb_notif_permission', { granted: outcome === 'granted', outcome })
    if (outcome !== 'granted') return outcome

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
    return 'granted'
  } catch {
    // Native lỗi / module chưa link — coi như không xin được, để UI cho lối thoát thủ công.
    return 'blocked'
  }
}
