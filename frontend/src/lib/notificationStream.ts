'use client'

import axios from 'axios'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '@/lib/authSession'

const SSE_BASE = '/api'


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

function parseSseDataLines(lines: string[]): { eventName: string; data: string } {
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
 * Subscribes to GET /notifications/stream (SSE via fetch ReadableStream).
 * Reconnects with backoff until `AbortController.abort()`.
 */
export function subscribeNotificationUnread(
  onUnread: (count: number) => void,
  onError?: (msg: string) => void,
  options?: {
    reconnectAfterMs?: number
    reconnectAfterRateLimitMs?: number
  },
): AbortController {
  const ctrl = new AbortController()
  const reconnectDelay = options?.reconnectAfterMs ?? 4_000
  const retry429Ms = options?.reconnectAfterRateLimitMs ?? 30_000

  async function iteration() {
    const url = `${SSE_BASE}/notifications/stream`
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
    }

    let pauseMs = reconnectDelay

    try {
      const doFetch = (token: string | null) =>
        fetch(url, {
          method: 'GET',
          headers: token ? { ...headers, Authorization: `Bearer ${token}` } : headers,
          signal: ctrl.signal,
        })

      let res = await doFetch(getAccessToken())
      if (res.status === 401) {
        const rt = getRefreshToken()
        if (!rt) {
          clearTokens()
          if (typeof window !== 'undefined') window.location.href = '/login'
          return
        }
        try {
          const { data } = await axios.post<{ accessToken?: string; refreshToken?: string | null }>(
            '/api/auth/refresh',
            { refreshToken: rt },
          )
          setTokens(data)
          res = await doFetch(data.accessToken ?? null)
        } catch {
          clearTokens()
          if (typeof window !== 'undefined') window.location.href = '/login'
          return
        }
      }

      if (res.status === 429) {
        onError?.('rate-limit')
        pauseMs = retry429Ms
        return
      }

      if (res.status === 401) {
        onError?.('unauthorized')
        return
      }

      if (!res.ok || !res.body) {
        onError?.(`http-${res.status}`)
        return
      }

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
          if (eventName === 'unread' && data) {
            try {
              const o = JSON.parse(data) as { unreadCount?: unknown }
              const n = o.unreadCount
              if (typeof n === 'number' && Number.isFinite(n)) {
                onUnread(Math.max(0, Math.floor(n)))
              }
            } catch {
              /* skip malformed */
            }
          }
        }
      }
    } catch {
      if (!ctrl.signal.aborted) {
        onError?.('disconnect')
      }
    } finally {
      if (!ctrl.signal.aborted) {
        await sleepAbortable(pauseMs, ctrl.signal)
      }
    }
  }

  async function runner() {
    while (!ctrl.signal.aborted) {
      await iteration()
    }
  }

  void runner()

  return ctrl
}
