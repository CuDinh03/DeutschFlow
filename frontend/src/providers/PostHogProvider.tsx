"use client"

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { loadPostHog, withPostHog } from '@/lib/posthogClient'

const SHARED_DASHBOARD_URL = process.env.NEXT_PUBLIC_POSTHOG_SHARED_DASHBOARD_URL

// Separate component to track page views on route change
function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (pathname) {
      let url = window.origin + pathname
      if (searchParams?.toString()) {
        url = `${url}?${searchParams.toString()}`
      }
      // Pageview đầu tiên xảy ra TRƯỚC khi thư viện tải xong → xếp hàng (trước đây `__loaded`
      // false là mất luôn pageview đầu của mỗi phiên).
      withPostHog((posthog) => posthog.capture('$pageview', { '$current_url': url }))
    }
  }, [pathname, searchParams])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY || 'phc_dummy'
      const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

      // W7 audit lag 02/09: init PostHog TRONG requestIdleCallback thay vì ngay nhịp effect
      // đầu — init đồng bộ (dựng autocapture + recorder + XHR flush) từng tranh main thread với
      // hydrate + fetch dữ liệu đầu trang của chính người dùng. Analytics là việc nhàn rỗi:
      // để trình duyệt rảnh mới chạy, trần 3s để vẫn kịp bắt app_opened của phiên rời sớm.
      // Event trước lúc init (pageview đầu, error sớm) xếp hàng trong posthogClient.
      // Đợt A 26/10/2026: thư viện cũng tải động ở đây (không còn import tĩnh) — xem posthogClient.
      const idleInit = () => {
        void loadPostHog((posthog) => {
          posthog.init(posthogKey, {
            api_host: posthogHost,
            person_profiles: 'always',
            // Bật autocapture toàn bộ để theo dõi Rage Clicks, Dead Clicks và Navigation
            autocapture: true,
            capture_pageview: false, // Tự track thủ công qua PostHogPageView
            session_recording: {
              maskAllInputs: true,   // Ẩn password/PII
              maskTextSelector: "[data-ph-mask='true']",
            },
          })
          // Super-property cho MỌI sự kiện (spec onboarding §6.4, Đợt 1 17/09): phiên bản luồng
          // onboarding + nền tảng, để funnel web↔mobile tách cohort mà không sửa từng call site.
          // Mobile đã có `platform`/`app_version` qua registerSuperProperties(); web trước đây chưa
          // register gì cả.
          posthog.register({ flow_version: 'onb_v3', platform: 'web' })
          // Track lần đầu mở app trong session này
          posthog.capture('app_opened', {
            referrer: document.referrer || 'direct',
            screen_width: window.screen.width,
            screen_height: window.screen.height,
            hour_of_day: new Date().getHours(),
            day_of_week: new Date().toLocaleDateString('en', { weekday: 'long' }),
          })
        })
      }
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(idleInit, { timeout: 3000 })
      } else {
        // Safari cũ chưa có rIC — lùi một nhịp macrotask là đủ nhường đường hydrate.
        window.setTimeout(idleInit, 1)
      }

      // Bắt lỗi JS để ghi nhận lên PostHog (kèm session recording nếu có)
      const handleError = (errorEvent: ErrorEvent) => {
        withPostHog((posthog) => posthog.capture('frontend_error', {
          message: errorEvent.message,
          filename: errorEvent.filename,
          lineno: errorEvent.lineno,
          colno: errorEvent.colno,
          error: errorEvent.error ? errorEvent.error.stack : null,
          path: window.location.pathname,
        }))
      }
      // Promise rejections không bắn 'error' event — bắt riêng để không bỏ sót lỗi async.
      const handleRejection = (event: PromiseRejectionEvent) => {
        const reason = event.reason as unknown
        const isError = reason instanceof Error
        withPostHog((posthog) => posthog.capture('frontend_unhandled_rejection', {
          message: isError ? (reason as Error).message : String(reason),
          error: isError ? (reason as Error).stack : null,
          path: window.location.pathname,
        }))
      }
      window.addEventListener('error', handleError)
      window.addEventListener('unhandledrejection', handleRejection)
      return () => {
        window.removeEventListener('error', handleError)
        window.removeEventListener('unhandledrejection', handleRejection)
      }
    }
  }, [])

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </>
  )
}
