// Mobile mirror of the web `usePageTimeTracker`. Emits a `feature_session` event
// (same name + shape as web) when the user leaves a screen, counting only
// foreground-active time and dropping bounces under 3s. Drop it at the top of a
// screen component: `useScreenTime('guide')`.

import { useCallback, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { captureEvent, type AnalyticsProps } from '@/lib/analytics'

const MIN_ACTIVE_SECONDS = 3

export function useScreenTime(feature: string, metadata?: AnalyticsProps): void {
  const screenStart = useRef(0)
  const activeStart = useRef(0)
  const activeMs = useRef(0)

  useFocusEffect(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useCallback(() => {
      const now = Date.now()
      screenStart.current = now
      activeStart.current = now
      activeMs.current = 0

      // Pause the active timer while the app is backgrounded, resume on return.
      const onAppState = (state: AppStateStatus) => {
        if (state === 'active') {
          activeStart.current = Date.now()
        } else {
          activeMs.current += Date.now() - activeStart.current
        }
      }
      const sub = AppState.addEventListener('change', onAppState)

      return () => {
        sub.remove()
        if (AppState.currentState === 'active') {
          activeMs.current += Date.now() - activeStart.current
        }
        const activeSeconds = Math.round(activeMs.current / 1000)
        const totalSeconds = Math.round((Date.now() - screenStart.current) / 1000)
        if (activeSeconds < MIN_ACTIVE_SECONDS) return
        captureEvent('feature_session', {
          feature,
          active_seconds: activeSeconds,
          total_seconds: totalSeconds,
          hour_of_day: new Date().getHours(),
          day_of_week: new Date().toLocaleDateString('en', { weekday: 'long' }),
          ...metadata,
        })
      }
    }, [feature]),
  )
}
