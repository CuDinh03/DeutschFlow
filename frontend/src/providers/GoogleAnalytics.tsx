'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { GA_MEASUREMENT_ID, isGaHost, isGaTrackedPath } from '@/lib/analytics/googleAnalytics'
import { scrubUrl } from '@/lib/analytics/scrubUrl'

// ─────────────────────────────────────────────────────────────────────────────
// Google Analytics 4 — chỉ trang công khai trên mydeutschflow.com (xem lib/analytics/googleAnalytics.ts).
//
// - Script gtag chỉ tải khi người dùng mở một trang công khai; vào thẳng trang trong app thì không tải gì.
// - Script tạo bằng thẻ <script> từ JS của chính bundle (giống Turnstile): CSP `strict-dynamic` cho qua
//   vì bundle đã mang nonce; không có script inline nào cần nonce.
// - Lượt xem trang gửi TAY với URL đã lọc (scrubUrl: bỏ fragment, chỉ giữ query trong danh sách cho phép),
//   `send_page_view: false` để GA không tự gửi URL thô. Rời sang trang không đo (vd. vào /v2) thì bật cờ
//   `ga-disable-<ID>` — cờ tắt chính thức của gtag — nên các sự kiện tự động (cuộn, nhấp liên kết…) cũng dừng.
// ─────────────────────────────────────────────────────────────────────────────

type Gtag = (...args: unknown[]) => void

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
  }
}

const DISABLE_FLAG = `ga-disable-${GA_MEASUREMENT_ID}`
let started = false

function setDisabled(disabled: boolean) {
  ;(window as unknown as Record<string, unknown>)[DISABLE_FLAG] = disabled
}

function ensureGtag(pageLocation: string): Gtag {
  if (!started) {
    started = true
    window.dataLayer = window.dataLayer || []
    // gtag phải đẩy chính đối tượng `arguments` (không phải mảng) — thư viện phân biệt hai loại.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments)
    }
    // THỨ TỰ QUAN TRỌNG (đo trên prod 15/11/2026): đặt `page_location` vào `config` thì gtag hiện hành
    // VẪN tự bắn một page_view với URL thô (document.location, còn nguyên query lạ) dù `send_page_view:false`
    // — mỗi lượt mở trang thành 2 page_view. Đặt cả hai bằng `set` TRƯỚC `config`, `config` không mang
    // page_location ⇒ chỉ còn đúng page_view gửi tay ở dưới.
    window.gtag('set', { send_page_view: false, page_location: pageLocation })
    window.gtag('js', new Date())
    window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false })
    const s = document.createElement('script')
    s.async = true
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`
    document.head.appendChild(s)
  }
  return window.gtag!
}

export function GoogleAnalytics() {
  const pathname = usePathname()

  useEffect(() => {
    if (!GA_MEASUREMENT_ID || !pathname) return
    try {
      if (!isGaHost(window.location.hostname)) return
      if (!isGaTrackedPath(pathname)) {
        if (started) setDisabled(true)
        return
      }
      setDisabled(false)
      const pageLocation = scrubUrl(window.location.href)
      const gtag = ensureGtag(pageLocation)
      gtag('set', { page_location: pageLocation })
      gtag('event', 'page_view', { page_location: pageLocation, page_title: document.title })
    } catch {
      // analytics hỏng không được làm hỏng trang
    }
    // Chỉ theo pathname: đổi query trên cùng trang (lọc, tab) không tính là lượt xem mới.
  }, [pathname])

  return null
}
