// Tài khoản bị khoá/xoá trong lúc access token còn hạn: mọi request trả 401, kể cả chính lệnh
// POST /auth/refresh. Trước bản vá, lệnh refresh bị 401 đi lại vào nhánh refresh của interceptor
// và chờ refreshPromise — tức là chờ chính nó — nên request gốc treo vĩnh viễn: đăng xuất không
// xong, mở app lạnh thì fetchMe treo, màn trắng. Bộ test này chạy client `api` thật với một adapter
// giả để chứng minh request gốc kết thúc và phiên được dọn.

import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'

;(globalThis as { __DEV__?: boolean }).__DEV__ = false

const clearTokens = jest.fn().mockResolvedValue(undefined)
const setUser = jest.fn()
const clearDeviceSessionState = jest.fn().mockResolvedValue(undefined)
const queryClear = jest.fn()

jest.mock('@/lib/auth', () => ({
  getAccessToken: jest.fn().mockResolvedValue('access-cu'),
  getRefreshToken: jest.fn().mockResolvedValue('refresh-cu'),
  setTokens: jest.fn().mockResolvedValue(undefined),
  clearTokens: (...a: unknown[]) => clearTokens(...a),
}))
jest.mock('@/lib/observability', () => ({ reportApiError: jest.fn() }))
jest.mock('@/stores/useAuthStore', () => ({
  useAuthStore: { getState: () => ({ setUser }) },
}))
jest.mock('@/lib/deviceSessionState', () => ({
  clearDeviceSessionState: (...a: unknown[]) => clearDeviceSessionState(...a),
}))
jest.mock('@/lib/queryClient', () => ({
  queryClient: { clear: (...a: unknown[]) => queryClear(...a) },
}))

import api, { REFRESH_PATH } from '@/lib/api'

const seenUrls: string[] = []

function reject401(config: InternalAxiosRequestConfig): Promise<never> {
  seenUrls.push(config.url ?? '')
  const response = { status: 401, statusText: '', data: {}, headers: new AxiosHeaders(), config }
  return Promise.reject(new AxiosError('401', 'ERR_BAD_REQUEST', config, undefined, response))
}

beforeEach(() => {
  jest.clearAllMocks()
  seenUrls.length = 0
  api.defaults.adapter = reject401
})

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | 'TREO'> {
  return Promise.race([p, new Promise<'TREO'>((resolve) => setTimeout(() => resolve('TREO'), ms))])
}

describe('refresh bị từ chối bằng 401', () => {
  test('request gốc kết thúc bằng lỗi, không treo', async () => {
    const outcome = await withTimeout(api.get('/auth/me').then(() => 'OK', () => 'LOI'), 2000)
    expect(outcome).toBe('LOI')
    // Đúng một lần gọi refresh, không lặp.
    expect(seenUrls.filter((u) => u === REFRESH_PATH)).toHaveLength(1)
  })

  test('phiên được kết thúc và dọn: token, người dùng, cache máy chủ', async () => {
    await api.get('/auth/me').catch(() => undefined)
    expect(clearTokens).toHaveBeenCalledTimes(1)
    expect(setUser).toHaveBeenCalledWith(null)
    expect(clearDeviceSessionState).toHaveBeenCalledTimes(1)
    expect(queryClear).toHaveBeenCalledTimes(1)
  })
})
