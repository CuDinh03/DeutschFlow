import { refreshAccessToken } from '@/lib/api'
import { getAccessToken, isSupportMode, markSupportSessionEnded } from '@/lib/authSession'

/**
 * `fetch` có xác thực cho những nơi không đi được qua axios (SSE/stream, multipart, tải blob).
 *
 * - Gắn `Authorization: Bearer <access token>` khi có token; mặc định `credentials: 'include'`.
 * - Phản hồi 401 → làm mới token qua đường single-flight CHUNG của api.ts (`refreshAccessToken`, đọc
 *   cookie HttpOnly) rồi gửi lại ĐÚNG MỘT lần với token mới. Không có cơ chế làm mới thứ hai ở đây.
 * - Làm mới thất bại (phiên chết, hoặc lỗi thoáng qua) → trả nguyên phản hồi 401 ban đầu để nơi gọi
 *   xử lý như trước. Banner đăng nhập lại / xoá token do `refreshAccessToken` lo.
 * - Tab phiên hỗ trợ: KHÔNG làm mới (cookie refresh là của admin) — 401 nghĩa là phiên hỗ trợ đã kết
 *   thúc, đánh dấu rồi trả 401.
 * - Thân request chỉ gửi lại được khi dựng lại được (chuỗi, FormData, Blob, …). `ReadableStream` hoặc
 *   `input` là một `Request` thì không thử lại.
 *
 * `signal` (AbortController) và mọi tuỳ chọn khác của nơi gọi được giữ nguyên cho cả hai lần gửi.
 */
export async function authFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const send = (token: string | null): Promise<Response> => {
    const headers = new Headers(init.headers)
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(input, { ...init, headers, credentials: init.credentials ?? 'include' })
  }

  const res = await send(getAccessToken())
  if (res.status !== 401) return res

  if (isSupportMode()) {
    markSupportSessionEnded()
    return res
  }
  if (!isReplayableBody(init.body) || init.signal?.aborted) return res

  let newToken: string | null
  try {
    newToken = await refreshAccessToken()
  } catch {
    // Thất bại thoáng qua (mạng/429/5xx): không thử lại ở đây, nơi gọi nhận 401 gốc.
    return res
  }
  if (!newToken) return res

  return send(newToken)
}

function isReplayableBody(body: BodyInit | null | undefined): boolean {
  if (body == null) return true
  return !(typeof ReadableStream !== 'undefined' && body instanceof ReadableStream)
}
