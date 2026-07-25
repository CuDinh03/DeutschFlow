import axios, { type AxiosError, type AxiosResponse } from 'axios'
import { Platform } from 'react-native'
import { API_BASE_URL } from './constants'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth'
import { reportApiError } from './observability'
import { router } from 'expo-router'

export function isAxiosErr(e: unknown): e is AxiosError {
  return axios.isAxiosError(e)
}

/**
 * Lỗi THOÁNG QUA (đáng thử lại): mất mạng / timeout (không có response) hoặc 5xx. 4xx là server từ
 * chối có chủ đích (hết quota, sai định dạng…) → KHÔNG tự thử lại. Dùng cho outbox lượt speaking
 * (MB-3) và song song cách phân loại của chat outbox DM/class.
 */
export function isTransientFailure(err: unknown): boolean {
  if (!isAxiosErr(err)) return false
  const status = err.response?.status
  return status == null || status >= 500
}

/**
 * Mã lỗi máy-đọc-được backend gửi trong `extensions.code` của ProblemDetail (AI_BUSY,
 * QUOTA_EXCEEDED, STT_FAILED…). Dùng làm tag telemetry, KHÔNG dùng để hiển thị.
 */
export function apiErrorCode(e: unknown): string | undefined {
  if (!isAxiosErr(e)) return undefined
  const d = e.response?.data
  if (!d || typeof d !== 'object') return undefined
  const code = (d as Record<string, unknown>).code
  return typeof code === 'string' && code.trim() ? code : undefined
}

/**
 * Nhãn status cho telemetry: mã HTTP, hoặc `timeout`/`network` khi không có response — hai ca này
 * chiếm phần lớn sự cố đêm 23/07 nhưng không có mã HTTP nào để đếm.
 */
export function apiStatusLabel(e: unknown): string {
  if (!isAxiosErr(e)) return 'unknown'
  if (e.response) return String(e.response.status)
  if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT' || /timeout/i.test(e.message ?? '')) {
    return 'timeout'
  }
  return 'network'
}

/** `/ai-speaking/sessions/8421/chat` → `/ai-speaking/sessions/{id}/chat` (gộp tag, tránh nổ cardinality). */
export function normalizeEndpoint(url: string | undefined): string {
  if (!url) return 'unknown'
  return url.split('?')[0].replace(/\/\d+/g, '/{id}')
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

/**
 * Gửi lỗi API tới Sentry — MỘT chỗ duy nhất phủ toàn bộ call-site, cùng triết lý với `apiMessage`
 * (R-M1 vá một dòng, sạch cả 79 Alert). Rải `captureException` vào từng catch màn hình vừa bỏ sót
 * vừa đếm trùng khi một lỗi đi qua nhiều lớp.
 *
 * Lọc có chủ đích — chỉ báo cáo thứ phản ánh sức khoẻ hệ thống:
 *  • mất mạng / timeout: chiếm phần lớn sự cố đêm 23/07, không có mã HTTP nào để đếm;
 *  • 5xx: lỗi phía server;
 *  • 429: chạm trần quota/rate-limit — cần biết tần suất để chỉnh hạn mức.
 * BỎ QUA 401 (đường refresh token tự xử lý) và 4xx còn lại (server từ chối có chủ đích:
 * sai định dạng, không đủ quyền…) — đưa vào chỉ làm nhiễu tín hiệu.
 */
export function shouldReportApiFailure(error: unknown): boolean {
  if (!isAxiosErr(error)) return false
  const status = error.response?.status
  return status == null || status >= 500 || status === 429
}

function reportApiFailure(error: AxiosError): void {
  if (!shouldReportApiFailure(error)) return

  reportApiError(error, {
    endpoint: normalizeEndpoint(error.config?.url),
    method: error.config?.method?.toUpperCase() ?? 'UNKNOWN',
    status: apiStatusLabel(error),
    aiCode: apiErrorCode(error),
  })
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

    // MB-4 (audit R-M4): thử lại MỘT lần cho GET idempotent khi lỗi thoáng qua — mất mạng, timeout,
    // hoặc 502/503 lúc backend cold-start / blue-green deploy. CHỈ GET: POST/PATCH có thể tạo bản
    // ghi hoặc trừ quota nên không tự thử lại (tránh double-charge, R-M5). Backoff ngắn cố định.
    const transientCfg = error.config as (typeof error.config & { _transientRetry?: boolean }) | undefined
    const method = transientCfg?.method?.toLowerCase()
    const st = error.response?.status
    const isTransient = !error.response || error.code === 'ECONNABORTED' || st === 502 || st === 503
    if (transientCfg && method === 'get' && isTransient && !transientCfg._transientRetry) {
      transientCfg._transientRetry = true
      await new Promise((resolve) => setTimeout(resolve, 700))
      return api(transientCfg)
    }

    // Báo cáo SAU nhánh retry: một GET hỏng thoáng qua rồi thử lại thành công thì người dùng
    // không thấy lỗi nào — đếm nó vào telemetry sẽ thổi phồng tần suất sự cố. Lượt thử lại nếu
    // hỏng tiếp sẽ quay lại chính interceptor này và được báo cáo đúng một lần.
    reportApiFailure(error)

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
