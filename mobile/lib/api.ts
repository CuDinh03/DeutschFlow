import axios, { type AxiosError, type AxiosResponse } from 'axios'
import { Platform } from 'react-native'
import { API_BASE_URL } from './constants'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth'
import { router } from 'expo-router'

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
let refreshPromise: Promise<AxiosResponse<RefreshResponseData>> | null = null

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
        const refreshToken = await getRefreshToken()
        if (!refreshToken) throw new Error('no_refresh_token')
        refreshPromise = api.post<RefreshResponseData>('/auth/refresh', { refreshToken })
      }
      const res = await refreshPromise
      refreshPromise = null
      const { accessToken, refreshToken: newRefresh } = res.data
      if (accessToken && newRefresh) {
        await setTokens(accessToken, newRefresh)
        original!.headers!.Authorization = `Bearer ${accessToken}`
        return api(original!)
      }
      throw new Error('invalid_refresh_response')
    } catch {
      refreshPromise = null
      await clearTokens()
      router.replace('/(auth)/login')
      return Promise.reject(error)
    }
  }
)

export default api
