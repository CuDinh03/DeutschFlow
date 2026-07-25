import axios, { type AxiosError, type AxiosResponse } from 'axios'
import { Platform } from 'react-native'
import { API_BASE_URL } from './constants'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth'
import { router } from 'expo-router'

export function isAxiosErr(e: unknown): e is AxiosError {
  return axios.isAxiosError(e)
}

/**
 * Thông điệp lỗi để hiển thị cho người dùng.
 *
 * Backend trả RFC-7807 Problem Details, nên câu tiếng Việt nằm ở `detail` — KHÔNG phải `message`.
 * Thứ tự đọc đi từ cụ thể nhất tới chung nhất; `title` là chốt chặn cuối trước lớp phân loại.
 *
 * KHÔNG BAO GIỜ trả về chuỗi kỹ thuật của axios (audit speaking 24/07, R-M1): đêm 23/07 người
 * dùng thấy nguyên văn "Request failed with status code 503" / "timeout of 15000ms exceeded"
 * vì nhánh fallback cũ trả `e.message`. Mọi ca không có body dùng được (timeout, mất mạng,
 * 5xx không body JSON) giờ được phân loại thành câu tiếng Việt thân thiện tại đây — một điểm
 * duy nhất phủ toàn bộ ~79 call-site Alert của app.
 */
export function apiMessage(e: unknown): string {
  if (isAxiosErr(e)) {
    const d = e.response?.data
    if (d && typeof d === 'object') {
      const problem = d as Record<string, unknown>
      for (const key of ['detail', 'message', 'error', 'title'] as const) {
        const value = problem[key]
        if (typeof value === 'string' && value.trim()) return value
      }
    }
    if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT' || /timeout/i.test(e.message ?? '')) {
      return 'Kết nối chậm — máy chủ có thể vẫn đang xử lý. Thử lại sau ít giây.'
    }
    if (!e.response) {
      return 'Mất kết nối mạng. Kiểm tra Wi-Fi/4G rồi thử lại.'
    }
    if (e.response.status >= 500) {
      return 'Hệ thống đang bận, vui lòng thử lại sau ít phút.'
    }
    return 'Yêu cầu không thực hiện được, vui lòng thử lại.'
  }
  if (e instanceof Error) return e.message
  return 'Lỗi không xác định'
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// Attach access token + platform header
api.interceptors.request.use(async (config) => {
  const token = await getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  // Backend uses X-Platform to return refreshToken in body instead of HttpOnly cookie.
  // Must be 'ios'/'android' (Platform.OS) — the backend's isMobileRequest() only matches those,
  // otherwise it treats the app as web and withholds the refresh token.
  config.headers['X-Platform'] = Platform.OS
  return config
})

// Auto-refresh on 401
type RefreshResponseData = { accessToken?: string; refreshToken?: string | null }
type RefreshResult = { accessToken: string; newRefresh: string }
// Assign synchronously before any await so concurrent 401s share one refresh request.
let refreshPromise: Promise<RefreshResult> | null = null

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    // Dev-only: surface the failing request in the Metro console so screen-level
    // "Không thể tải dữ liệu" errors are diagnosable (method, url, status, body).
    if (__DEV__) {
      const cfg = error.config
      const status = error.response?.status ?? 'NO_RESPONSE'
      const body = error.response?.data ?? error.message
      // eslint-disable-next-line no-console
      console.warn(`[API] ${cfg?.method?.toUpperCase() ?? '?'} ${cfg?.url ?? '?'} → ${status}`, body)
    }

    const original = error.config as typeof error.config & { _retry?: boolean }
    if (error.response?.status !== 401 || original?._retry) {
      return Promise.reject(error)
    }
    original._retry = true

    try {
      if (!refreshPromise) {
        refreshPromise = (async (): Promise<RefreshResult> => {
          const refreshToken = await getRefreshToken()
          if (!refreshToken) throw new Error('no_refresh_token')
          const res = await api.post<RefreshResponseData>('/auth/refresh', { refreshToken })
          const { accessToken, refreshToken: newRefresh } = res.data
          if (!accessToken || !newRefresh) throw new Error('invalid_refresh_response')
          await setTokens(accessToken, newRefresh)
          return { accessToken, newRefresh }
        })().finally(() => { refreshPromise = null })
      }
      const { accessToken } = await refreshPromise
      original!.headers!.Authorization = `Bearer ${accessToken}`
      return api(original!)
    } catch {
      refreshPromise = null
      await clearTokens()
      // Reset the auth store too, not just the tokens. Otherwise isLoggedIn stays true after the
      // bounce: the app shows an authenticated shell whose every request 401s, and — because the
      // push-token effect keys on the logged-in user id — a re-login by the SAME account would not
      // re-fire. setUser(null) flips isLoggedIn=false so the next login is a real id transition that
      // re-registers this device's push token for whoever logs in.
      //
      // Loaded with a lazy require, NOT a top-level import: statically importing useAuthStore here
      // creates an api ↔ useAuthStore cycle that drags analytics/PostHog into api.ts's module graph,
      // which crashes every jest suite that imports an API wrapper. At runtime (a real 401) the
      // module is already loaded, so require() just returns it.
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const { useAuthStore } = require('@/stores/useAuthStore') as typeof import('@/stores/useAuthStore')
      useAuthStore.getState().setUser(null)
      router.replace('/(auth)/login')
      return Promise.reject(error)
    }
  }
)

export default api
