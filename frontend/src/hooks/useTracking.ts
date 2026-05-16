import { usePostHog } from 'posthog-js/react'
import { useEffect, useRef } from 'react'

export function useTracking() {
  const posthog = usePostHog()

  /**
   * Track a generic event
   */
  const trackEvent = (eventName: string, properties?: Record<string, any>) => {
    if (posthog) {
      posthog.capture(eventName, properties)
    }
  }

  /**
   * Identify a user after login/registration
   */
  const identifyUser = (userId: string, traits?: Record<string, any>) => {
    if (posthog) {
      posthog.identify(userId, traits)
    }
  }

  /**
   * Track specific onboarding steps to analyze drop-off
   */
  const trackOnboardingStep = (stepName: string, stepNumber: number, data?: Record<string, any>) => {
    if (posthog) {
      posthog.capture('onboarding_step_completed', {
        step_name: stepName,
        step_number: stepNumber,
        ...data,
      })
    }
  }

  return {
    trackEvent,
    identifyUser,
    trackOnboardingStep,
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
  }, [posthog, featureName]) // Metadata changes won't trigger re-run to avoid spam
}
