// Thin tracking hook — mirrors the web `useTracking` surface so call sites read
// the same on both platforms. Delegates to the PostHog singleton in
// lib/analytics (guarded no-op when analytics is disabled).

import { useMemo } from 'react'
import {
  captureEvent,
  identifyUser,
  trackFeatureAction,
  type AnalyticsProps,
  type FeatureAction,
} from '@/lib/analytics'

export function useTracking() {
  return useMemo(
    () => ({
      trackEvent: (event: string, properties?: AnalyticsProps) =>
        captureEvent(event, properties),
      trackFeatureAction: (feature: string, action: FeatureAction, metadata?: AnalyticsProps) =>
        trackFeatureAction(feature, action, metadata),
      identifyUser,
    }),
    [],
  )
}
