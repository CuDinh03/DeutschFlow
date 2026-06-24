import { usePostHog } from 'posthog-js/react'
import { useEffect, useRef, useCallback } from 'react'

export function useTracking() {
  const posthog = usePostHog()

  /**
   * Track a generic event.
   *
   * Memoized so the identity is stable across renders — consumers safely list
   * it in effect dependency arrays without re-running the effect every render.
   */
  const trackEvent = useCallback((eventName: string, properties?: Record<string, any>) => {
    if (posthog) {
      posthog.capture(eventName, properties)
    }
  }, [posthog])

  /**
   * Identify a user after login/registration
   */
  const identifyUser = useCallback((userId: string, traits?: Record<string, any>) => {
    if (posthog && userId && userId !== 'undefined') {
      posthog.identify(userId, traits)
    }
  }, [posthog])

  /**
   * Track specific onboarding steps to analyze drop-off
   */
  const trackOnboardingStep = useCallback((stepName: string, stepNumber: number, data?: Record<string, any>) => {
    if (posthog) {
      posthog.capture('onboarding_step_completed', {
        step_name: stepName,
        step_number: stepNumber,
        ...data,
      })
    }
  }, [posthog])

  /**
   * Track feature actions (started, completed, quit)
   */
  const trackFeatureAction = useCallback((
    feature: string,
    action: 'started' | 'completed' | 'quit' | 'latency' | 'paywall_viewed' | 'checkout_started' | 'checkout_completed' | 'checkout_abandoned' | 'paywall_gate_viewed' | 'clicked',
    metadata?: Record<string, any>
  ) => {
    if (posthog) {
      posthog.capture(`feature_${feature}_${action}`, {
        feature: feature,
        action,
        ...metadata,
      })
    }
  }, [posthog])

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
  const posthog = usePostHog()
  const startTime = useRef(Date.now())

  useEffect(() => {
    // Component mounted
    if (posthog) {
      posthog.capture('feature_started', { feature: featureName, ...metadata })
    }
    
    startTime.current = Date.now()

    // Component unmounted
    return () => {
      const durationSeconds = Math.round((Date.now() - startTime.current) / 1000)
      if (posthog) {
        posthog.capture('feature_ended', { 
          feature: featureName, 
          duration_seconds: durationSeconds,
          ...metadata 
        })
      }
    }
  }, [posthog, featureName, metadata])
}
