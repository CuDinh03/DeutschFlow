// Trạng thái per-THIẾT BỊ phải được dọn ở CẢ HAI đường kết thúc phiên
// (QA 2026-08-20, F-3/F-4).

const tourReset = jest.fn().mockResolvedValue(undefined)
const starterReset = jest.fn().mockResolvedValue(undefined)
const clearDailyGoalMinutes = jest.fn().mockResolvedValue(undefined)
const clearOnboardingDraft = jest.fn().mockResolvedValue(undefined)
const disableStudyReminder = jest.fn().mockResolvedValue(undefined)

jest.mock('@/stores/useTourStore', () => ({
  useTourStore: { getState: () => ({ reset: tourReset }) },
}))
jest.mock('@/stores/useStarterStore', () => ({
  useStarterStore: { getState: () => ({ reset: starterReset }) },
}))
jest.mock('@/lib/dailyGoal', () => ({
  clearDailyGoalMinutes: (...a: unknown[]) => clearDailyGoalMinutes(...a),
}))
jest.mock('@/lib/onboardingDraft', () => ({
  clearOnboardingDraft: (...a: unknown[]) => clearOnboardingDraft(...a),
}))
jest.mock('@/lib/studyReminder', () => ({
  disableStudyReminder: (...a: unknown[]) => disableStudyReminder(...a),
}))

import { clearDeviceSessionState } from '@/lib/deviceSessionState'

beforeEach(() => {
  jest.clearAllMocks()
  for (const m of [tourReset, starterReset, clearDailyGoalMinutes, clearOnboardingDraft, disableStudyReminder]) {
    m.mockResolvedValue(undefined)
  }
})

describe('clearDeviceSessionState', () => {
  test('dọn đủ năm thứ bám theo thiết bị', () => {
    // Danh sách này là hợp đồng: thêm một thứ lưu per-thiết bị mà quên thêm vào
    // đây là mở lại đúng lỗ rò giữa hai tài khoản trên cùng máy.
    return clearDeviceSessionState().then(() => {
      expect(tourReset).toHaveBeenCalledTimes(1)
      expect(starterReset).toHaveBeenCalledTimes(1)
      expect(clearDailyGoalMinutes).toHaveBeenCalledTimes(1)
      expect(clearOnboardingDraft).toHaveBeenCalledTimes(1)
      expect(disableStudyReminder).toHaveBeenCalledTimes(1)
    })
  })

  test('một bước hỏng không chặn các bước còn lại, và không throw', async () => {
    disableStudyReminder.mockRejectedValue(new Error('native lỗi'))

    await expect(clearDeviceSessionState()).resolves.toBeUndefined()

    expect(tourReset).toHaveBeenCalledTimes(1)
    expect(clearOnboardingDraft).toHaveBeenCalledTimes(1)
  })
})
