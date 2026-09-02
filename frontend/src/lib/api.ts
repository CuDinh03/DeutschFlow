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

/**
 * Thông điệp lỗi thân thiện cho người dùng.
 *
 * Audit 24/07 (R-W7, song song R-M1 mobile): KHÔNG BAO GIỜ trả chuỗi kỹ thuật của axios
 * ("Network Error" / "timeout of ...ms exceeded" / "Request failed with status code 503").
 * Đọc `detail` của RFC-7807 ProblemDetail TRƯỚC (câu tiếng Việt backend dày công viết nằm ở đó),
 * rồi tới message/error/title; khi không có body dùng được thì phân loại thành câu tiếng Việt.
 */
export function apiMessage(e: unknown): string {
  if (isAxiosErr(e)) {
    const d = e.response?.data
    if (d && typeof d === 'object') {
      const problem = d as Record<string, unknown>
      for (const key of ['detail', 'message', 'error', 'title'] as const) {
        const v = problem[key]
        if (typeof v === 'string' && v.trim()) return v
      }
    }
    if (e.code === 'ECONNABORTED' || /timeout/i.test(e.message ?? '')) {
      return 'Kết nối chậm — máy chủ có thể vẫn đang xử lý. Thử lại sau ít giây.'
    }
    if (!e.response) return 'Mất kết nối mạng. Kiểm tra đường truyền rồi thử lại.'
    if ((e.response.status ?? 0) >= 500) return 'Hệ thống đang bận, vui lòng thử lại sau ít phút.'
    return 'Yêu cầu không thực hiện được, vui lòng thử lại.'
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
// W6 audit lag 02/09: 2 retry × timeout 8s + backoff = treo cảm nhận tới ~27s cho MỘT call xấu,
// và khi backend brownout thì mỗi client nhân ba tải đúng lúc server yếu nhất. 1 retry là đủ cứu
// blip mạng thật; lỗi dai dẳng thì hiện lỗi sớm còn hơn quay spinner nửa phút.
const MAX_RETRIES = 1
const RETRYABLE_METHODS = new Set(['get', 'head', 'options'])
// Chỉ 502/503 (gateway/deploy promote/quá tải thoáng qua — thử lại có cửa thành công). 500 là bug
// xác định (lần hai vẫn 500), 504 là upstream đã treo đủ lâu để nginx bỏ cuộc — retry chỉ giữ
// người dùng chờ thêm một vòng timeout nữa và đổ thêm tải.
const RETRYABLE_STATUSES = new Set([502, 503])
// Longest Retry-After we will sit through before giving up and surfacing the error. The backend's
// throttles span a wide range: the auth bulkhead says 1s (a transient capacity blip, worth waiting
// out), while the per-IP and public limiters say 60s or more (a spent budget — no amount of waiting
// inside one page load helps, and blocking the UI that long is worse than showing the error).
const MAX_RETRY_AFTER_SECONDS = 5

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

    // A 429 is the server telling us a budget is spent, and it says HOW LONG in Retry-After.
    // Retrying after our own ~500ms while the header says 60s is three guaranteed-failing requests
    // sent exactly when the server is least able to absorb them — the client turns "slow down" into
    // "push harder". So honour the header: retry only when the wait is short enough to be worth
    // sitting through, and give up otherwise. Missing/garbage header → treat as "don't retry",
    // because we have no evidence the next attempt would fare any better.
    const retryAfterMs = (() => {
      if (status !== 429) return null
      const raw = error.response?.headers?.['retry-after']
      const seconds = Number(raw)
      if (!Number.isFinite(seconds) || seconds < 0) return null
      return seconds <= MAX_RETRY_AFTER_SECONDS ? seconds * 1000 : null
    })()
    const rateLimitedButWorthRetrying = status === 429 && retryAfterMs !== null

    // Retry conditions: idempotent method + (network error, short-backoff rate limit, or 502/503)
    const isRetryable = (
      RETRYABLE_METHODS.has(method) &&
      config._retryCount < MAX_RETRIES &&
      (
        !error.response ||  // Network error
        rateLimitedButWorthRetrying ||  // 429 with a Retry-After we can actually wait out
        (typeof status === 'number' && RETRYABLE_STATUSES.has(status)) ||
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
      const backoff = Math.round(base / 2 + Math.random() * (base / 2))
      // When the server named a wait, obey it — but keep the jitter on top so a crowd of clients
      // released by the same Retry-After does not stampede back in one synchronized wave.
      const delay = retryAfterMs !== null
        ? retryAfterMs + Math.round(Math.random() * 500)
        : backoff
      if (process.env.NODE_ENV !== 'production') {
        console.log(`⚠️ Retry ${config._retryCount}/${MAX_RETRIES} (${method.toUpperCase()}) in ${delay}ms`)
      }
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

/**
 * Single-flight refresh dùng CHUNG cho interceptor lẫn SSE stream (notificationStream.ts).
 *
 * W4 audit lag 02/09: stream từng POST /auth/refresh bằng axios trần — bỏ qua cả latch
 * `sessionInvalid` lẫn `refreshPromise`, không timeout ⇒ bell + API calls đua nhau refresh và
 * một session chết vẫn bắn refresh mỗi 4s vĩnh viễn. Giờ mọi đường refresh đi qua đây.
 *
 * Hợp đồng:
 *  - trả access token mới khi thành công (latch nhả);
 *  - trả `null` khi session chết DỨT KHOÁT — latch đang bật, hoặc refresh bị từ chối 400/401/403
 *    (token client được xoá, banner re-login đã hiện) → caller DỪNG, đừng thử lại;
 *  - ném lỗi khi thất bại THOÁNG QUA (mạng/429/5xx — latch bật để chặn bão, token client giữ
 *    nguyên, latch tự nhả ở request có token kế tiếp) → caller tự quyết backoff.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (sessionInvalid) {
    notifyAuthRecovery()
    return null
  }
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
        // Timeout riêng: instance `api` có 8s nhưng đây là axios gốc — thiếu nó một refresh treo
        // sẽ giữ MỌI request 401 đứng chờ vô hạn (tất cả await chung refreshPromise).
        { withCredentials: true, headers: refreshHeaders, timeout: 10_000 }
      )
    }

    const { data } = await refreshPromise
    refreshPromise = null
    sessionInvalid = false

    setTokens(data)
    recordTokenRefresh()
    return data.accessToken ?? null
  } catch (refreshError) {
    refreshPromise = null
    // Latch so the NEXT 401 short-circuits above instead of POSTing yet another refresh.
    sessionInvalid = true
    // Only a definitive auth rejection (no / expired refresh cookie) means the session is truly
    // gone — clear the stale client mirror so getAccessToken() stays null and the middleware sees
    // an anonymous request. Transient failures (429 rate-limit, 5xx, network) leave tokens intact
    // so recovery is still possible once the latch releases; we just stopped the immediate storm.
    const refreshStatus = httpStatus(refreshError)
    notifyAuthRecovery()
    if (refreshStatus === 400 || refreshStatus === 401 || refreshStatus === 403) {
      clearTokens()
      return null
    }
    throw refreshError
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true

      // Session already known-dead (a prior refresh failed) → refreshAccessToken() short-circuits to
      // null without another POST. Surface the ORIGINAL 401 (not a refresh-side 429) so callers route
      // to /v2/login cleanly. This is what breaks the storm.
      try {
        const accessToken = await refreshAccessToken()
        if (!accessToken) {
          return Promise.reject(error)
        }
        original.headers.Authorization = `Bearer ${accessToken}`
        return api(original)
      } catch {
        // Transient refresh failure — reject with the ORIGINAL 401 (the API call that started this),
        // never the refresh error: downstream code keys off httpStatus === 401 to redirect, and must
        // not see the raw 429.
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export default api
