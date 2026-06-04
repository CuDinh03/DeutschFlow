// Global screen-time tracker. Mounted once in the (student) layout: watches the
// active route via usePathname and emits a `feature_session` event (same name +
// shape as the web usePageTimeTracker) whenever the user leaves a screen,
// counting only foreground-active time and dropping bounces under 3s.
//
// This covers EVERY student screen automatically — present and future — so no
// per-screen hook is needed. Renders nothing.

import { useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { usePathname } from 'expo-router'
import { captureEvent } from '@/lib/analytics'

const MIN_ACTIVE_SECONDS = 3

/** Map an expo-router pathname to a stable feature name (groups are stripped by
 *  expo-router, so '/' is the home/dashboard tab). */
function featureFromPath(path: string): string {
  const slug = path.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\//g, '_')
  return slug === '' ? 'dashboard' : slug
}

export function ScreenTimeTracker() {
  const pathname = usePathname()
  const feature = useRef<string | null>(null)
  const screenStart = useRef(0)
  const activeStart = useRef(0)
  const activeMs = useRef(0)

  // Emit the accumulated session for the screen we're leaving.
  const flush = () => {
    if (!feature.current) return
    if (AppState.currentState === 'active') {
      activeMs.current += Date.now() - activeStart.current
    }
    const activeSeconds = Math.round(activeMs.current / 1000)
    const totalSeconds = Math.round((Date.now() - screenStart.current) / 1000)
    if (activeSeconds >= MIN_ACTIVE_SECONDS) {
      captureEvent('feature_session', {
        feature: feature.current,
        active_seconds: activeSeconds,
        total_seconds: totalSeconds,
        hour_of_day: new Date().getHours(),
        day_of_week: new Date().toLocaleDateString('en', { weekday: 'long' }),
      })
    }
  }

  // On route change: flush the previous screen, then start timing the new one.
  useEffect(() => {
    flush()
    feature.current = featureFromPath(pathname)
    const now = Date.now()
    screenStart.current = now
    activeStart.current = now
    activeMs.current = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Pause the active timer while backgrounded; flush on unmount.
  useEffect(() => {
    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        activeStart.current = Date.now()
      } else {
        activeMs.current += Date.now() - activeStart.current
      }
    }
    const sub = AppState.addEventListener('change', onAppState)
    return () => {
      flush()
      sub.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
