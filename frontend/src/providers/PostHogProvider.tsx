"use client"

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const SHARED_DASHBOARD_URL = process.env.NEXT_PUBLIC_POSTHOG_SHARED_DASHBOARD_URL

// Separate component to track page views on route change
function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (pathname && posthog.__loaded) {
      let url = window.origin + pathname
      if (searchParams?.toString()) {
        url = `${url}?${searchParams.toString()}`
      }
      posthog.capture('$pageview', { '$current_url': url })
    }
  }, [pathname, searchParams])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY || 'phc_dummy'
      const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

      if (!posthog.__loaded) {
        posthog.init(posthogKey, {
          api_host: posthogHost,
          person_profiles: 'always',
          // Selective autocapture: chỉ ghi nhận element có data-ph-capture="true"
          autocapture: {
            css_selector_allowlist: ['[data-ph-capture="true"]'],
          },
          capture_pageview: false, // Tự track thủ công qua PostHogPageView
          session_recording: {
            maskAllInputs: true,   // Ẩn password/PII
          },
        })
        // Track lần đầu mở app trong session này
        posthog.capture('app_opened', {
          referrer: document.referrer || 'direct',
          screen_width: window.screen.width,
          screen_height: window.screen.height,
          hour_of_day: new Date().getHours(),
          day_of_week: new Date().toLocaleDateString('en', { weekday: 'long' }),
        })
      }

      // Bắt lỗi JS để ghi nhận lên PostHog (kèm session recording nếu có)
      const handleError = (errorEvent: ErrorEvent) => {
        posthog.capture('frontend_error', {
          message: errorEvent.message,
          filename: errorEvent.filename,
          lineno: errorEvent.lineno,
          colno: errorEvent.colno,
          error: errorEvent.error ? errorEvent.error.stack : null,
        })
      }
      window.addEventListener('error', handleError)
      return () => {
        window.removeEventListener('error', handleError)
      }
    }
  }, [])

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  )
}
