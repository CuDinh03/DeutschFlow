// MB-06 (owner tái hiện 03/09 khi QA OTA M1+M2): mở app lúc OFFLINE → fetchMe lỗi mạng →
// bản cũ set logged-out → login wall, dù refresh token còn nguyên trong SecureStore (bằng
// chứng: bật mạng mở lại là vào thẳng, không cần đăng nhập). Hợp đồng mới, cùng triết lý
// M2 (#479): lỗi fetchMe + CÒN refresh token = CÒN PHIÊN (vào app, màn tự hiện lỗi tải);
// không còn token (interceptor 401 đã clear vì phiên chết thật) = về login như cũ.

const getRefreshToken = jest.fn<Promise<string | null>, []>()
const apiGet = jest.fn()
const identifyUser = jest.fn()

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
  identifyUser: (...a: unknown[]) => identifyUser(...a),
  resetAnalytics: jest.fn(),
}))
jest.mock('@/lib/deviceSessionState', () => ({
  clearDeviceSessionState: jest.fn().mockResolvedValue(undefined),
}))

import { useAuthStore } from '@/stores/useAuthStore'

beforeEach(() => {
  jest.clearAllMocks()
  useAuthStore.setState({ user: null, isLoggedIn: false, isLoading: true })
})

describe('useAuthStore.fetchMe — offline giữ phiên (MB-06)', () => {
  test('lỗi mạng + CÒN refresh token → vẫn đăng nhập, vào app (user tạm null)', async () => {
    apiGet.mockRejectedValue(Object.assign(new Error('Network Error'), { isAxiosError: true }))
    getRefreshToken.mockResolvedValue('refresh-token-con-song')

    await useAuthStore.getState().fetchMe()

    const s = useAuthStore.getState()
    expect(s.isLoggedIn).toBe(true)
    expect(s.isLoading).toBe(false)
    expect(s.user).toBeNull()
  })

  test('lỗi + KHÔNG còn refresh token (phiên đã bị interceptor kết liễu) → về login', async () => {
    apiGet.mockRejectedValue(Object.assign(new Error('Request failed 401'), { isAxiosError: true }))
    getRefreshToken.mockResolvedValue(null)

    await useAuthStore.getState().fetchMe()

    const s = useAuthStore.getState()
    expect(s.isLoggedIn).toBe(false)
    expect(s.isLoading).toBe(false)
    expect(s.user).toBeNull()
  })

  test('thành công → set user + identify như cũ', async () => {
    apiGet.mockResolvedValue({ data: { id: 7, displayName: 'An', email: 'a@x.vn', role: 'STUDENT' } })

    await useAuthStore.getState().fetchMe()

    const s = useAuthStore.getState()
    expect(s.isLoggedIn).toBe(true)
    expect(s.user?.id).toBe(7)
    expect(identifyUser).toHaveBeenCalledWith(7, { role: 'STUDENT' })
    expect(getRefreshToken).not.toHaveBeenCalled()
  })
})
