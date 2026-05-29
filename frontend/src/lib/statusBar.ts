'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

export type StatusBarSurface = 'light' | 'dark'

/**
 * Apply the correct iOS/Android status bar icon style for the current surface.
 *
 * Capacitor's `Style.Light` renders DARK icons (for light backgrounds) and
 * `Style.Dark` renders LIGHT icons (for dark backgrounds). We hide that quirk
 * behind a `surface` describing the background the status bar sits on.
 *
 * No-op on web. Safe to call on every render — it only re-applies on change.
 */
export function useStatusBarStyle(surface: StatusBarSurface): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let cancelled = false

    const apply = async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar')
        if (cancelled) return
        await StatusBar.setStyle({
          style: surface === 'dark' ? Style.Dark : Style.Light,
        })
      } catch {
        // Plugin unavailable — ignore.
      }
    }

    void apply()

    return () => {
      cancelled = true
    }
  }, [surface])
}
