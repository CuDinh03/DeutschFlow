import axios, { type AxiosError, type AxiosResponse } from 'axios'
import { getAccessToken, getRefreshToken, setTokens, recordTokenRefresh, isNative, getPlatform, clearTokens } from '@/lib/authSession'
import { useAuthRecoveryStore } from '@/stores/useAuthRecoveryStore'

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

const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080').replace(/\/+$/, '')
const backendOrigin = backendUrl.replace(/\/api$/, '')
const apiBaseUrl = `${backendOrigin}/api`
const authBaseUrl = `${backendOrigin}/api`

function notifyAuthRecovery(message = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'): void {
  useAuthRecoveryStore.getState().setNeedsReauth(message)
}

// Dead-session latch. Once a token refresh has definitively failed, every subsequent 401 must STOP
// re-attempting /auth/refresh: a logged-out page fires many parallel API calls, and without this each
// 401 would POST another refresh until the backend rate-limits us to 429 "Too many refresh attempts"
// (QA 2026-07-16 — the /v2/admin/users refresh storm). The latch is cleared as soon as a stored access
// token reappears (successful login/refresh — see the request interceptor), so genuine mid-session
// expiry can still trigger a fresh refresh later. Module-scoped ⇒ one latch per browser tab.
let sessionInvalid = false

const api = axios.create({
  baseURL: apiBaseUrl,
  // 8s default — admin pages fail fast instead of freezing
  // AI speaking streams use { timeout: 0 } explicitly via longRunning flag
  timeout: 8000,
  // withCredentials: true — cần thiết để browser gửi HttpOnly refresh_token cookie
  // khi gọi /api/auth/refresh (cross-origin với backend trên EC2).
  // Backend đã có allowCredentials(true) + specific allowedOrigins (không dùng wildcard).
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Retry on transient failures — idempotent requests only ──────────────────
// Retries are deliberately scoped to safe/idempotent methods (GET/HEAD/OPTIONS):
//  • a timed-out POST/PUT/PATCH/DELETE must never be silently re-sent — the server
//    may have already processed it (double-submit / double-grade).
//  • when the backend is overloaded (5xx/503 from DB-pool saturation), retrying
//    every concurrent call 3× in lockstep AMPLIFIES the load and deepens the
//    brownout. We cap retries low and jitter the backoff to break the herd.
const MAX_RETRIES = 2
const RETRYABLE_METHODS = new Set(['get', 'head', 'options'])

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const config = error.config
    if (!config) return Promise.reject(error)

    if (!config._retryCount) {
      config._retryCount = 0
    }

    const method = (config.method ?? 'get').toLowerCase()
    const status = error.response?.status

    // Retry conditions: idempotent method + (network error, rate limit, or 5xx)
    const isRetryable = (
      RETRYABLE_METHODS.has(method) &&
      config._retryCount < MAX_RETRIES &&
      (
        !error.response ||  // Network error
        status === 429 ||   // Rate limit
        (typeof status === 'number' && status >= 500) ||  // Server error (5xx)
        error.code === 'ECONNABORTED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ETIMEDOUT'
      )
    )

    if (isRetryable) {
      config._retryCount++
      // Exponential backoff with jitter — half fixed, half random — so many
      // concurrent failing calls don't retry in synchronized waves.
      const base = Math.min(1000 * Math.pow(2, config._retryCount - 1), 5000)
      const delay = Math.round(base / 2 + Math.random() * (base / 2))
      console.log(`⚠️ Retry ${config._retryCount}/${MAX_RETRIES} (${method.toUpperCase()}) in ${delay}ms`)
      await new Promise(r => setTimeout(r, delay))
      return api(config)
    }

    return Promise.reject(error)
  }
)

// Attach access token + platform header automatically
api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
    // A stored token means we are (re)authenticated — release the dead-session latch so a genuine
    // future expiry can trigger a fresh refresh again. Cheap and idempotent, so run it every request.
    sessionInvalid = false
  }
  config.headers['X-Request-Id'] = crypto.randomUUID()
  if (isNative()) config.headers['X-Platform'] = getPlatform()
  return config
})

// Auto-refresh on 401
// Flow: access token expired → 401 → call /api/auth/refresh (browser sends HttpOnly cookie) → retry once.
// If refresh cookie missing/invalid → backend returns 4xx → redirect to /login.
type RefreshResponseData = {
  accessToken?: string
  refreshToken?: string | null
}

let refreshPromise: Promise<AxiosResponse<RefreshResponseData>> | null = null

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true

      // Session already known-dead (a prior refresh failed) → do NOT spawn another /auth/refresh.
      // Surface the ORIGINAL 401 (not a refresh-side 429) so callers route to /v2/login cleanly.
      // This is what breaks the storm: after the first failed refresh, every other 401 short-circuits.
      if (sessionInvalid) {
        notifyAuthRecovery()
        return Promise.reject(error)
      }

      // Refresh token nằm trong HttpOnly cookie — browser tự gửi khi gọi /api/auth/refresh.
      // Không cần (và không thể) kiểm tra token tồn tại từ JS nữa.
      // Nếu cookie không có / đã hết hạn, backend trả 4xx → catch bên dưới → redirect login.
      try {
        if (!refreshPromise) {
          // Web:    body rỗng, backend đọc refresh token từ HttpOnly cookie.
          // Native: gửi refreshToken trong body (cookie không hoạt động cross-origin từ Capacitor).
          const nativeRefreshToken = isNative() ? getRefreshToken() : null
          const refreshHeaders: Record<string, string> = {}
          if (isNative()) refreshHeaders['X-Platform'] = getPlatform()
          refreshPromise = axios.post<RefreshResponseData>(
            `${authBaseUrl}/auth/refresh`,
            nativeRefreshToken ? { refreshToken: nativeRefreshToken } : {},
            { withCredentials: true, headers: refreshHeaders }
          )
        }

        const { data } = await refreshPromise
        refreshPromise = null
        sessionInvalid = false

        setTokens(data)
        recordTokenRefresh()
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return api(original)
      } catch (refreshError) {
        refreshPromise = null
        // Latch so the NEXT 401 short-circuits above instead of POSTing yet another refresh.
        sessionInvalid = true
        // Only a definitive auth rejection (no / expired refresh cookie) means the session is truly
        // gone — clear the stale client mirror so getAccessToken() stays null and the middleware sees
        // an anonymous request. Transient failures (429 rate-limit, 5xx, network) leave tokens intact
        // so recovery is still possible once the latch releases; we just stopped the immediate storm.
        const refreshStatus = httpStatus(refreshError)
        if (refreshStatus === 400 || refreshStatus === 401 || refreshStatus === 403) {
          clearTokens()
        }
        notifyAuthRecovery()
        // Reject with the ORIGINAL 401 (the API call that started this), never the refresh error —
        // downstream code keys off httpStatus === 401 to redirect, and must not see the raw 429.
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export default api
