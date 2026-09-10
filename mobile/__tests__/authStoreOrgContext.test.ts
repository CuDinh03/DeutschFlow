// V-12c: `/auth/me` (AuthResponse backend) trả sẵn orgId/orgRole, nhưng AuthUser của app khai
// thiếu hai trường ấy — payload vẫn về nguyên trong store, chỉ là TypeScript cắt mất nên KHÔNG
// màn nào đọc được: app hoàn toàn không biết học viên thuộc trung tâm nào.
//
// Test này khoá cả hai mặt: kiểu (truy cập `user.orgId` phải compile — ts-jest type-check, gỡ
// trường khỏi AuthUser là suite này đỏ ngay ở bước biên dịch) và runtime (giá trị về đúng).

const getRefreshToken = jest.fn<Promise<string | null>, []>()
const apiGet = jest.fn()

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: (...a: unknown[]) => apiGet(...a), post: jest.fn() },
}))
jest.mock('@/lib/auth', () => ({
  setTokens: jest.fn(),
  clearTokens: jest.fn(),
  getRefreshToken: (...a: []) => getRefreshToken(...a),
  getRoleFromToken: jest.fn(),
}))
jest.mock('@/lib/analytics', () => ({
  identifyUser: jest.fn(),
  resetAnalytics: jest.fn(),
}))
jest.mock('@/lib/deviceSessionState', () => ({
  clearDeviceSessionState: jest.fn().mockResolvedValue(undefined),
}))

import { useAuthStore, type AuthUser } from '@/stores/useAuthStore'

beforeEach(() => {
  jest.clearAllMocks()
  useAuthStore.setState({ user: null, isLoggedIn: false, isLoading: true })
})

describe('useAuthStore.fetchMe — giữ bối cảnh trung tâm (V-12c)', () => {
  test('học viên của trung tâm: orgId/orgRole đọc được từ store', async () => {
    apiGet.mockResolvedValue({
      data: {
        id: 5, displayName: 'Học viên', email: 'hv@example.com', role: 'STUDENT',
        orgId: 7, orgRole: 'STUDENT',
      },
    })

    await useAuthStore.getState().fetchMe()

    const user: AuthUser | null = useAuthStore.getState().user
    expect(user?.orgId).toBe(7)
    expect(user?.orgRole).toBe('STUDENT')
  })

  test('người dùng B2C: hai trường về null, không phải undefined ngẫu nhiên', async () => {
    apiGet.mockResolvedValue({
      data: {
        id: 6, displayName: 'B2C', email: 'b2c@example.com', role: 'STUDENT',
        orgId: null, orgRole: null,
      },
    })

    await useAuthStore.getState().fetchMe()

    expect(useAuthStore.getState().user?.orgId).toBeNull()
    expect(useAuthStore.getState().user?.orgRole).toBeNull()
  })
})
