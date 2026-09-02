'use client'

import { refreshAccessToken } from '@/lib/api'
import { getAccessToken } from '@/lib/authSession'

// SSE fetch must go directly to Spring Boot, not to the Next.js origin — a relative
// `/api/...` resolves against window.location.origin and hits Next.js → 404 retry loop.
// Mirror the baseURL derivation in api.ts / interviewReportApi.ts.
const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080').replace(/\/+$/, '')
const backendOrigin = backendUrl.replace(/\/api$/, '')
const SSE_BASE = `${backendOrigin}/api`


function sleepAbortable(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted || ms <= 0) {
      resolve()
      return
    }
    const t = window.setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(t)
        resolve()
      },
      { once: true },
    )
  })
}

function parseSseFrames(buf: string): { rest: string; frames: string[] } {
  const frames = buf.split('\n\n')
  const rest = frames.pop() ?? ''
  return { rest, frames }
}

export function parseSseDataLines(lines: string[]): { eventName: string; data: string } {
  let eventName = ''
  const dataParts: string[] = []
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '')
    if (!line || line.startsWith(':')) continue
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
      continue
    }
    if (line.startsWith('data:')) {
      const rest = line.slice(5)
      dataParts.push(rest.startsWith(' ') ? rest.slice(1) : rest)
    }
  }
  return { eventName, data: dataParts.join('\n') }
}

/**
 * The backend (NotificationSseBroadcaster) emits the unread count as a BARE
 * integer payload under the event name `unreadCount` (and the same on the
 * initial register snapshot). Tolerate a JSON object `{ unreadCount: n }` too,
 * so the client survives either wire format. Returns null for unparseable data.
 */
export function parseUnreadCount(data: string): number | null {
  const trimmed = data.trim()
  if (!trimmed) return null
  const direct = Number(trimmed)
  if (Number.isFinite(direct)) return Math.max(0, Math.floor(direct))
  try {
    const o = JSON.parse(trimmed) as { unreadCount?: unknown }
    if (typeof o.unreadCount === 'number' && Number.isFinite(o.unreadCount)) {
      return Math.max(0, Math.floor(o.unreadCount))
    }
  } catch {
    /* not JSON — fall through */
  }
  return null
}

/**
 * Subscribes to GET /notifications/stream (SSE via fetch ReadableStream).
 * Reconnects with exponential backoff (capped) until `AbortController.abort()`.
 *
 * W4 audit lag 02/09 — kỷ luật reconnect:
 *  - Refresh 401 đi qua {@link refreshAccessToken} (single-flight + latch chung với api.ts).
 *    Trước đây stream POST /auth/refresh bằng axios trần: một session chết vẫn refresh mỗi 4s
 *    VĨNH VIỄN (return chỉ thoát iteration, runner gọi lại) — góp bão 429 vào đúng lúc backend yếu.
 *  - Session chết dứt khoát → DỪNG HẲN runner (bell remount sau khi re-login sẽ subscribe lại).
 *  - Backoff lũy tiến 4s → 8s → … trần 60s khi lỗi liên tiếp; reset khi stream sống trở lại.
 *  - Tab ẩn → không mở vòng reconnect mới, chờ visibilitychange (stream đang sống thì giữ nguyên —
 *    đóng/mở theo mỗi lần chuyển tab còn đắt hơn một kết nối idle có ping).
 */
export function subscribeNotificationUnread(
  onUnread: (count: number) => void,
  onError?: (msg: string) => void,
  options?: {
    reconnectAfterMs?: number
    reconnectAfterRateLimitMs?: number
    maxReconnectMs?: number
  },
): AbortController {
  const ctrl = new AbortController()
  const reconnectDelay = options?.reconnectAfterMs ?? 4_000
  const retry429Ms = options?.reconnectAfterRateLimitMs ?? 30_000
  const maxReconnectMs = options?.maxReconnectMs ?? 60_000
  // Lỗi liên tiếp chưa xen một stream sống nào — mũ của backoff lũy tiến.
  let consecutiveFailures = 0
  // Bật khi session chết dứt khoát — runner thoát hẳn thay vì reconnect vô ích.
  let sessionDead = false

  function waitUntilVisible(): Promise<void> {
    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      const settle = () => {
        document.removeEventListener('visibilitychange', onChange)
        ctrl.signal.removeEventListener('abort', settle)
        resolve()
      }
      const onChange = () => {
        if (document.visibilityState === 'visible') settle()
      }
      document.addEventListener('visibilitychange', onChange)
      ctrl.signal.addEventListener('abort', settle, { once: true })
    })
  }

  async function iteration() {
    const url = `${SSE_BASE}/notifications/stream`
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
    }

    let pauseMs = Math.min(reconnectDelay * 2 ** consecutiveFailures, maxReconnectMs)
    consecutiveFailures += 1

    try {
      const doFetch = (token: string | null) =>
        fetch(url, {
          method: 'GET',
          headers: token ? { ...headers, Authorization: `Bearer ${token}` } : headers,
          signal: ctrl.signal,
        })

      let res = await doFetch(getAccessToken())
      if (res.status === 401) {
        // Access token expired — refresh qua đường single-flight chung. `null` = session chết
        // dứt khoát (latch đã bật / refresh bị từ chối, banner re-auth do api.ts lo): dừng hẳn.
        // Ném lỗi = thất bại thoáng qua: rơi xuống catch, backoff rồi thử lại.
        const token = await refreshAccessToken()
        if (token === null) {
          onError?.('unauthorized')
          sessionDead = true
          return
        }
        res = await doFetch(token)
      }

      if (res.status === 429) {
        onError?.('rate-limit')
        pauseMs = Math.max(pauseMs, retry429Ms)
        return
      }

      if (res.status === 401) {
        // Vẫn 401 với token vừa refresh xong — đừng vắt thêm refresh nào nữa.
        onError?.('unauthorized')
        sessionDead = true
        return
      }

      if (!res.ok || !res.body) {
        onError?.(`http-${res.status}`)
        return
      }

      // Stream sống — chuỗi lỗi kết thúc, backoff quay về mốc đầu.
      consecutiveFailures = 0
      pauseMs = reconnectDelay

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''

      while (!ctrl.signal.aborted) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const { rest, frames } = parseSseFrames(buf)
        buf = rest
        for (const frame of frames) {
          if (!frame.trim()) continue
          const lines = frame.split('\n')
          const { eventName, data } = parseSseDataLines(lines)
          // Backend event name is `unreadCount`; keep `unread` for forward-compat.
          if ((eventName === 'unreadCount' || eventName === 'unread') && data) {
            const n = parseUnreadCount(data)
            if (n !== null) onUnread(n)
          }
        }
      }
    } catch {
      if (!ctrl.signal.aborted) {
        onError?.('disconnect')
      }
    } finally {
      if (!ctrl.signal.aborted && !sessionDead) {
        await sleepAbortable(pauseMs, ctrl.signal)
      }
    }
  }

  async function runner() {
    while (!ctrl.signal.aborted && !sessionDead) {
      await waitUntilVisible()
      if (ctrl.signal.aborted || sessionDead) break
      await iteration()
    }
  }

  void runner()

  return ctrl
}
