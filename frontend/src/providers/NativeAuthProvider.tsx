'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { registerPushNotifications } from '@/hooks/usePushNotifications'
import api from '@/lib/api'

// tokenCacheReady is initialized at module level in authSession.ts the moment
// that module is imported — no explicit warm-up call needed here.
//
// This component is the native-only boundary in the tree. On Capacitor it:
//   1. Marks <html> with a `.native` class so CSS can opt into native-only
//      behaviour (no overscroll bounce, no tap highlight, no text selection on
//      UI chrome) without affecting the web/PWA build.
//   2. Keeps the status bar from drawing under the webview content. Per-surface
//      icon styling (dark vs light icons) is handled by `useStatusBarStyle`.
export function NativeAuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const root = document.documentElement
    root.classList.add('native')

    let cancelled = false

    const configureStatusBar = async () => {
      try {
        const { StatusBar } = await import('@capacitor/status-bar')
        if (cancelled) return
        // Do not let the webview draw underneath the status bar; safe-area
        // padding in CSS handles spacing instead.
        await StatusBar.setOverlaysWebView({ overlay: false })
      } catch {
        // Plugin unavailable (e.g. web preview) — ignore silently.
      }
    }

    void configureStatusBar()

    void registerPushNotifications((token) => {
      void api.post('/profile/me/push-token', { token, platform: 'ios' }).catch(() => {
        // Non-critical — silent fail, token will be retried on next launch
      })
    })

    return () => {
      cancelled = true
      root.classList.remove('native')
    }
  }, [])

  return <>{children}</>
}
