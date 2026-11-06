'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare Turnstile — kiểm "người thật" ở form đăng ký (owner chốt 07/11/2026).
//
// - Chỉ hiện khi build có NEXT_PUBLIC_TURNSTILE_SITE_KEY (frontend-build.env). Không có key ⇒ không tải
//   script, không gửi header ⇒ hành vi y như trước (backend có công tắc riêng TURNSTILE_ENABLED).
// - Mode "Managed": đa số người dùng không phải bấm gì; nghi ngờ thì Cloudflare hiện ô tick.
// - Token chỉ dùng được MỘT lần ⇒ sau mỗi lần submit (thành công hay không) phải reset() lấy token mới.
// - Script tải bằng thẻ <script> tạo từ JS của chính bundle: CSP `strict-dynamic` cho qua vì bundle đã
//   mang nonce; frame-src thêm challenges.cloudflare.com ở middleware khi có site key.
// ─────────────────────────────────────────────────────────────────────────────

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id?: string) => void
  remove: (id?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = SCRIPT_SRC
      s.async = true
      s.defer = true
      s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')))
      s.onerror = () => {
        scriptPromise = null
        reject(new Error('turnstile load failed'))
      }
      document.head.appendChild(s)
    })
  }
  return scriptPromise
}

export type TurnstileHandle = { reset: () => void }

type Props = {
  /** Token mới (chuỗi rỗng khi hết hạn/lỗi — caller coi như chưa có token). */
  onToken: (token: string) => void
  /** Script không tải được (chặn quảng cáo, mạng) — caller hiện câu hướng dẫn. */
  onLoadError?: () => void
  locale?: string
}

export const TurnstileWidget = forwardRef<TurnstileHandle, Props>(function TurnstileWidget(
  { onToken, onLoadError, locale },
  ref,
) {
  const box = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const cb = useRef({ onToken, onLoadError })
  cb.current = { onToken, onLoadError }

  useImperativeHandle(ref, () => ({
    reset: () => {
      cb.current.onToken('')
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current)
    },
  }))

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !box.current) return
    let cancelled = false
    loadTurnstile()
      .then((ts) => {
        if (cancelled || !box.current) return
        widgetId.current = ts.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action: 'register',
          language: locale ?? 'auto',
          appearance: 'interaction-only',
          callback: (t: string) => cb.current.onToken(t),
          'expired-callback': () => cb.current.onToken(''),
          'error-callback': () => cb.current.onToken(''),
        })
      })
      .catch(() => {
        if (!cancelled) cb.current.onLoadError?.()
      })
    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [locale])

  if (!TURNSTILE_SITE_KEY) return null
  return <div ref={box} className="mb-3 flex justify-center" data-testid="turnstile" />
})
