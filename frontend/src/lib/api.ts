import axios, { type AxiosError } from 'axios'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '@/lib/authSession'

// ─── Error helpers ────────────────────────────────────────────────────────────

export function isAxiosErr(e: unknown): e is AxiosError {
  return axios.isAxiosError(e)
}

/** HTTP status from an Axios error, 0 for non-Axios errors. */
export function httpStatus(e: unknown): number {
  return isAxiosErr(e) ? (e.response?.status ?? 0) : 0
}

/** Human-readable message from an Axios error or generic Error. */
export function apiMessage(e: unknown): string {
  if (isAxiosErr(e)) {
    const d = e.response?.data
    if (d && typeof d === 'object' && 'message' in d) return String(d.message)
    if (d && typeof d === 'object' && 'error' in d) return String((d as { error?: unknown }).error)
    if (d && typeof d === 'object' && 'detail' in d) return String((d as { detail?: unknown }).detail)
    if (d && typeof d === 'object' && 'title' in d) return String((d as { title?: unknown }).title)
    return e.message ?? 'Lỗi không xác định'
  }
  if (e instanceof Error) return e.message
  return 'Lỗi không xác định'
}

const api = axios.create({
  baseURL: '/api',
  // 8s default — admin pages fail fast instead of freezing
  // AI speaking streams use { timeout: 0 } explicitly via longRunning flag
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
    // Cache-Control removed: Next.js response headers đã handle per-route
  },
})

// Attach access token automatically
api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  config.headers['X-Request-Id'] = crypto.randomUUID()
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = getRefreshToken()
        const { data } = await axios.post('/api/auth/refresh', { refreshToken })
        setTokens(data)
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return api(original)
      } catch {
        clearTokens()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
