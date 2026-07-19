import axios, { type AxiosError, type AxiosResponse } from 'axios'
import { Platform } from 'react-native'
import { API_BASE_URL } from './constants'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth'
import { router } from 'expo-router'
import { useAuthStore } from '@/stores/useAuthStore'

export function isAxiosErr(e: unknown): e is AxiosError {
  return axios.isAxiosError(e)
}

export function apiMessage(e: unknown): string {
  if (isAxiosErr(e)) {
    const d = e.response?.data
    if (d && typeof d === 'object' && 'message' in d) return String(d.message)
    if (d && typeof d === 'object' && 'error' in d) return String((d as { error?: unknown }).error)
    return e.message ?? 'Lỗi không xác định'
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
      // re-registers this device's push token for whoever logs in. (getState() defers the import to
      // runtime, sidestepping the api ↔ useAuthStore module cycle.)
      useAuthStore.getState().setUser(null)
      router.replace('/(auth)/login')
      return Promise.reject(error)
    }
  }
)

export default api
