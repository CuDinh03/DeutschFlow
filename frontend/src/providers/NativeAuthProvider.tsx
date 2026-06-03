'use client'

import { useEffect } from 'react'
import { NetworkBanner } from '@/components/system/NetworkBanner'
import { initCrashReporting } from '@/lib/crashReporting'

// Top-level web app boundary.
//
// The Capacitor native build was retired (S20b), so the former native-only effects (status bar,
// keyboard height, push-notification registration + tap routing) are gone — the canonical native
// app is the Expo `mobile/` client. This now just bootstraps crash reporting and renders the
// offline banner. Name kept to avoid churn at the import site (app/layout.tsx).
export function NativeAuthProvider({ children }: { children: React.ReactNode }) {
  // Crash reporting — inert unless NEXT_PUBLIC_SENTRY_DSN is set.
  useEffect(() => {
    initCrashReporting()
  }, [])

  return (
    <>
      <NetworkBanner />
      {children}
    </>
  )
}
