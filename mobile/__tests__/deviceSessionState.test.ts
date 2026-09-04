// Trạng thái per-THIẾT BỊ phải được dọn ở CẢ HAI đường kết thúc phiên
// (QA 2026-08-20, F-3/F-4; mở rộng soát 02/09, F-23/F-24/F-25).

const tourReset = jest.fn().mockResolvedValue(undefined)
const starterReset = jest.fn().mockResolvedValue(undefined)
const clearDailyGoalMinutes = jest.fn().mockResolvedValue(undefined)
const clearOnboardingDraft = jest.fn().mockResolvedValue(undefined)
const disableStudyReminder = jest.fn().mockResolvedValue(undefined)
const chatOutboxClear = jest.fn()
const srsOfflineClear = jest.fn()
const clearActiveSession = jest.fn().mockResolvedValue(undefined)

jest.mock('@/stores/useTourStore', () => ({
  useTourStore: { getState: () => ({ reset: tourReset }) },
}))
jest.mock('@/stores/useStarterStore', () => ({
  useStarterStore: { getState: () => ({ reset: starterReset }) },
}))
jest.mock('@/stores/useChatOutboxStore', () => ({
  useChatOutboxStore: { getState: () => ({ clear: chatOutboxClear }) },
}))
jest.mock('@/stores/useSrsOfflineStore', () => ({
  useSrsOfflineStore: { getState: () => ({ clear: srsOfflineClear }) },
}))
jest.mock('@/lib/activeSession', () => ({
  clearActiveSession: (...a: unknown[]) => clearActiveSession(...a),
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
  for (const m of [tourReset, starterReset, clearDailyGoalMinutes, clearOnboardingDraft, disableStudyReminder, clearActiveSession]) {
    m.mockResolvedValue(undefined)
  }
})

describe('clearDeviceSessionState', () => {
  test('dọn đủ tám thứ bám theo thiết bị', () => {
    // Danh sách này là hợp đồng: thêm một thứ lưu per-thiết bị mà quên thêm vào
    // đây là mở lại đúng lỗ rò giữa hai tài khoản trên cùng máy.
    // 3 mục mới (soát 02/09): outbox chat (F-23 — lộ nguyên văn tin nhắn),
    // hàng đợi SRS offline (F-24), phiên luyện nói dở (F-25).
    return clearDeviceSessionState().then(() => {
      expect(tourReset).toHaveBeenCalledTimes(1)
      expect(starterReset).toHaveBeenCalledTimes(1)
      expect(clearDailyGoalMinutes).toHaveBeenCalledTimes(1)
      expect(clearOnboardingDraft).toHaveBeenCalledTimes(1)
      expect(disableStudyReminder).toHaveBeenCalledTimes(1)
      expect(chatOutboxClear).toHaveBeenCalledTimes(1)
      expect(srsOfflineClear).toHaveBeenCalledTimes(1)
      expect(clearActiveSession).toHaveBeenCalledTimes(1)
    })
  })

  test('một bước hỏng không chặn các bước còn lại, và không throw', async () => {
    disableStudyReminder.mockRejectedValue(new Error('native lỗi'))

    await expect(clearDeviceSessionState()).resolves.toBeUndefined()

    expect(tourReset).toHaveBeenCalledTimes(1)
    expect(clearOnboardingDraft).toHaveBeenCalledTimes(1)
    expect(chatOutboxClear).toHaveBeenCalledTimes(1)
  })

  test('store MMKV clear() throw ĐỒNG BỘ cũng không thoát được allSettled', async () => {
    // MMKV là native call — throw sync là chế độ hỏng thật. Nếu lời gọi không
    // được bọc promise, throw xảy ra NGAY LÚC DỰNG mảng và hàm này throw —
    // người dùng kẹt "đã đăng nhập" với token đã xoá.
    chatOutboxClear.mockImplementation(() => {
      throw new Error('mmkv chết')
    })

    await expect(clearDeviceSessionState()).resolves.toBeUndefined()

    expect(srsOfflineClear).toHaveBeenCalledTimes(1)
    expect(clearActiveSession).toHaveBeenCalledTimes(1)
  })
})
