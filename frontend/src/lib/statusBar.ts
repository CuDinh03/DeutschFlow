'use client'

import { useEffect } from 'react'

export type StatusBarSurface = 'light' | 'dark'

/**
 * Native-only status-bar icon styling. **No-op on web.**
 *
 * The Capacitor native build was retired (S20b); the canonical native app is the Expo `mobile/`
 * client. The export is kept (same signature) so callers don't need to change.
 */
export function useStatusBarStyle(surface: StatusBarSurface): void {
  useEffect(() => {
    // Native status bar is not applicable on the web build — intentionally no-op.
  }, [surface])
}
