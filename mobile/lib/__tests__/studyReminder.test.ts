// Huỷ lịch nhắc học 20:00 khi đăng xuất (QA 2026-08-20, F-4).
//
// Lịch local sống trong hệ điều hành chứ không trong app. Trước bản vá này
// useStarterStore.reset() xoá cờ `df_starter_reminder_on` mà không gỡ lịch, nên
// app và OS lệch pha: người đã đăng xuất vẫn bị nhắc 20:00, và tài khoản kế tiếp
// trên cùng máy nhận thông báo mang mục tiêu phút/ngày của người trước.

const cancelScheduledNotificationAsync = jest.fn().mockResolvedValue(undefined)

jest.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: (...args: unknown[]) =>
    cancelScheduledNotificationAsync(...args),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}))

// analytics.ts đọc `__DEV__` ở cấp module — không mock thì test nổ ReferenceError
// lúc NẠP module, và thông báo lỗi trỏ vào analytics.ts nên rất dễ chẩn nhầm
// thành lỗi cấu hình jest.
jest.mock('../analytics', () => ({ captureEvent: jest.fn() }))

import { disableStudyReminder, REMINDER_ID } from '../studyReminder'

beforeEach(() => {
  jest.clearAllMocks()
  cancelScheduledNotificationAsync.mockResolvedValue(undefined)
})

describe('disableStudyReminder', () => {
  test('gỡ đúng lịch 20:00 khỏi hệ điều hành', async () => {
    await disableStudyReminder()

    expect(cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1)
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith(REMINDER_ID)
  })

  test('dùng đúng id lịch cũ trên máy người dùng', () => {
    // Đổi chuỗi này thì lệnh huỷ không trúng lịch đã đặt bằng bản trước, và
    // người dùng bị nhắc vĩnh viễn mà gỡ không được qua app.
    expect(REMINDER_ID).toBe('df-study-reminder-2000')
  })

  test('native ném lỗi → nuốt, KHÔNG throw', async () => {
    cancelScheduledNotificationAsync.mockRejectedValue(new Error('native module missing'))

    // logout() gom lời gọi này vào Promise.all: một rejection sẽ chặn luôn
    // set({ user: null }) phía sau và treo người dùng ở trạng thái "đã đăng
    // nhập" với token đã bị xoá — hỏng nặng hơn chính cái bug đang sửa.
    await expect(disableStudyReminder()).resolves.toBeUndefined()
  })
})
