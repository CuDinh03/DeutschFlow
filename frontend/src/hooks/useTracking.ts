import { useEffect, useRef, useCallback } from 'react'
import { usePostHogClient, withPostHog } from '@/lib/posthogClient'

/**
 * Đợt A 26/10/2026: không còn `usePostHog()` của posthog-js/react — thư viện giờ tải động (xem
 * `@/lib/posthogClient`). Mọi lời gọi đi qua `withPostHog`: gọi trước lúc thư viện sẵn sàng thì
 * xếp hàng, không mất sự kiện. Các callback không còn phụ thuộc instance nên identity bền suốt
 * vòng đời component.
 */
export function useTracking() {
  // Instance thô cho chỗ cần gọi thẳng (mock-exam). `null` cho tới khi thư viện tải xong.
  const posthog = usePostHogClient()

  /**
   * Track a generic event.
   *
   * Memoized so the identity is stable across renders — consumers safely list
   * it in effect dependency arrays without re-running the effect every render.
   */
  const trackEvent = useCallback((eventName: string, properties?: Record<string, any>) => {
    withPostHog((ph) => ph.capture(eventName, properties))
  }, [])

  /**
   * Identify a user after login/registration
   */
  const identifyUser = useCallback((userId: string, traits?: Record<string, any>) => {
    if (userId && userId !== 'undefined') {
      withPostHog((ph) => ph.identify(userId, traits))
    }
  }, [])

  /**
   * Track specific onboarding steps to analyze drop-off
   */
  const trackOnboardingStep = useCallback((stepName: string, stepNumber: number, data?: Record<string, any>) => {
    withPostHog((ph) => ph.capture('onboarding_step_completed', {
      step_name: stepName,
      step_number: stepNumber,
      ...data,
    }))
  }, [])

  /**
   * Track feature actions (started, completed, quit)
   */
  const trackFeatureAction = useCallback((
    feature: string,
    // 'resumed' tách riêng khỏi 'started' có chủ ý: gộp chúng lại thì số phiên bắt đầu bị thổi
    // lên bởi những lần mở lại một phiên cũ, và không còn cách nào đo xem nút "Tiếp tục" có ai
    // dùng hay không — mà đó chính là câu hỏi khiến nó được làm (S-06 AC-2).
    action: 'started' | 'resumed' | 'completed' | 'quit' | 'latency' | 'paywall_viewed' | 'checkout_started' | 'checkout_completed' | 'checkout_abandoned' | 'paywall_gate_viewed' | 'clicked',
    metadata?: Record<string, any>
  ) => {
    withPostHog((ph) => ph.capture(`feature_${feature}_${action}`, {
      feature: feature,
      action,
      ...metadata,
    }))
  }, [])

  return {
    trackEvent,
    identifyUser,
    trackOnboardingStep,
    trackFeatureAction,
    posthog, // Expose raw instance if needed
  }
}

/**
 * Hook to automatically track time spent on a specific feature
 * Emits 'feature_ended' with duration_seconds when component unmounts
 */
export function useFeatureTimeTracker(featureName: string, metadata?: Record<string, any>) {
  const startTime = useRef(Date.now())

  useEffect(() => {
    // Component mounted
    withPostHog((ph) => ph.capture('feature_started', { feature: featureName, ...metadata }))
    
    startTime.current = Date.now()

    // Component unmounted
    return () => {
      const durationSeconds = Math.round((Date.now() - startTime.current) / 1000)
      withPostHog((ph) => ph.capture('feature_ended', {
        feature: featureName,
        duration_seconds: durationSeconds,
        ...metadata,
      }))
    }
  }, [featureName, metadata])
}
