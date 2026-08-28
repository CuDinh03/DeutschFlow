// logout() phải dọn TOÀN BỘ dấu vết per-thiết bị của tài khoản vừa rời đi.
//
// QW-5 thêm việc gỡ lịch nhắc 20:00 vào danh sách đó: lịch nằm trong hệ điều
// hành, reset() của useStarterStore chỉ xoá cờ trong app nên thông báo vẫn chạy
// cho người đã đăng xuất (QA 2026-08-20, F-4). Danh sách dọn nay nằm ở
// lib/deviceSessionState.ts và được kiểm riêng trong deviceSessionState.test.ts;
// file này chỉ khoá phần WIRING của store.

const clearDeviceSessionState = jest.fn().mockResolvedValue(undefined)
const clearTokens = jest.fn().mockResolvedValue(undefined)
const resetAnalytics = jest.fn()

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { post: jest.fn().mockResolvedValue({ data: {} }), get: jest.fn() },
}))
jest.mock('@/lib/auth', () => ({
  setTokens: jest.fn(),
  clearTokens: (...a: unknown[]) => clearTokens(...a),
  getRoleFromToken: jest.fn(),
}))
jest.mock('@/lib/analytics', () => ({
  identifyUser: jest.fn(),
  resetAnalytics: (...a: unknown[]) => resetAnalytics(...a),
}))
jest.mock('@/lib/deviceSessionState', () => ({
  clearDeviceSessionState: (...a: unknown[]) => clearDeviceSessionState(...a),
}))

import { useAuthStore } from '@/stores/useAuthStore'

beforeEach(() => {
  jest.clearAllMocks()
  clearDeviceSessionState.mockResolvedValue(undefined)
  useAuthStore.setState({
    user: { id: 1, displayName: 'A', email: 'a@example.com', role: 'STUDENT' },
    isLoggedIn: true,
  })
})

describe('useAuthStore.logout', () => {
  test('dọn trạng thái per-thiết bị và kết thúc phiên', async () => {
    await useAuthStore.getState().logout()

    expect(clearTokens).toHaveBeenCalledTimes(1)
    expect(clearDeviceSessionState).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().isLoggedIn).toBe(false)
    expect(useAuthStore.getState().user).toBeNull()
    expect(resetAnalytics).toHaveBeenCalledTimes(1)
  })

  test('dọn dẹp hỏng cũng KHÔNG được treo phiên đăng xuất', async () => {
    // Nếu bước dọn ném ra thì set({ user: null }) và resetAnalytics() phía sau
    // không chạy ⇒ người dùng kẹt "đã đăng nhập" với token đã bị xoá, mọi
    // request 401 liên tục. Chế độ hỏng này nặng hơn chính bug QW-5 đang sửa.
    clearDeviceSessionState.mockRejectedValue(new Error('native lỗi'))

    await expect(useAuthStore.getState().logout()).resolves.toBeUndefined()

    expect(useAuthStore.getState().isLoggedIn).toBe(false)
    expect(useAuthStore.getState().user).toBeNull()
    expect(resetAnalytics).toHaveBeenCalledTimes(1)
  })
})
