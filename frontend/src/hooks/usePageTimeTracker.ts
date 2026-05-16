'use client'

/**
 * usePageTimeTracker
 * ─────────────────────────────────────────
 * Tự động đo thời gian user ở lại một trang/tính năng.
 * Gửi event `feature_session` khi:
 *  1. User rời trang (component unmount)
 *  2. User chuyển tab / tắt trình duyệt (visibilitychange)
 *
 * Đặt ở top của page component: usePageTimeTracker('roadmap')
 */

import { useEffect, useRef } from 'react'
import posthog from 'posthog-js'

export function usePageTimeTracker(featureName: string, metadata?: Record<string, unknown>) {
  const startTime = useRef(Date.now())
  const visibilityStart = useRef(Date.now())
  const activeMs = useRef(0) // Chỉ tính thời gian tab đang active

  useEffect(() => {
    startTime.current = Date.now()
    visibilityStart.current = Date.now()
    activeMs.current = 0

    // Track khi user chuyển tab / quay lại
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab bị ẩn: cộng dồn thời gian active
        activeMs.current += Date.now() - visibilityStart.current
      } else {
        // Tab hiện lại: reset điểm bắt đầu
        visibilityStart.current = Date.now()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      // Cộng thời gian còn lại khi component unmount
      if (document.visibilityState !== 'hidden') {
        activeMs.current += Date.now() - visibilityStart.current
      }

      const totalMs = Date.now() - startTime.current
      const activeSeconds = Math.round(activeMs.current / 1000)
      const totalSeconds = Math.round(totalMs / 1000)

      // Chỉ gửi nếu user ở ít nhất 3 giây (loại bỏ bounced visits)
      if (activeSeconds >= 3 && posthog.__loaded) {
        posthog.capture('feature_session', {
          feature: featureName,
          active_seconds: activeSeconds,
          total_seconds: totalSeconds,
          hour_of_day: new Date().getHours(),
          day_of_week: new Date().toLocaleDateString('en', { weekday: 'long' }),
          ...metadata,
        })
      }
    }
  }, [featureName]) // eslint-disable-line react-hooks/exhaustive-deps
}
