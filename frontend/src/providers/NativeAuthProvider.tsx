'use client'

import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { registerPushNotifications, usePushNotifications } from '@/hooks/usePushNotifications'
import type { ActionPerformed } from '@capacitor/push-notifications'
import api from '@/lib/api'
import { NetworkBanner } from '@/components/system/NetworkBanner'
import { initCrashReporting } from '@/lib/crashReporting'

// tokenCacheReady is initialized at module level in authSession.ts the moment
// that module is imported — no explicit warm-up call needed here.
//
// This component is the native-only boundary in the tree. On Capacitor it:
//   1. Marks <html> with a `.native` class so CSS can opt into native-only
//      behaviour (no overscroll bounce, no tap highlight, no text selection on
//      UI chrome) without affecting the web/PWA build.
//   2. Keeps the status bar from drawing under the webview content. Per-surface
//      icon styling (dark vs light icons) is handled by `useStatusBarStyle`.
//   3. Tracks keyboard height via --kb-height CSS variable so inputs stay
//      visible above the software keyboard.
//   4. Routes push notification taps to the correct in-app page.
export function NativeAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  // Crash reporting — inert unless NEXT_PUBLIC_SENTRY_DSN is set. Runs on every
  // platform (web + native), independent of the native-only effect below.
  useEffect(() => {
    initCrashReporting()
  }, [])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const root = document.documentElement
    root.classList.add('native')

    let cancelled = false

    const configureStatusBar = async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar')
        if (cancelled) return
        // Do not let the webview draw underneath the status bar; safe-area
        // padding in CSS handles spacing instead.
        await StatusBar.setOverlaysWebView({ overlay: false })
        // Set a global default of dark icons (light background) so every route
        // that doesn't call useStatusBarStyle() gets correct icons.
        // login/register/speaking override when they mount.
        await StatusBar.setStyle({ style: Style.Light })
      } catch {
        // Plugin unavailable (e.g. web preview) — ignore silently.
      }
    }

    const configureKeyboard = async () => {
      try {
        const { Keyboard } = await import('@capacitor/keyboard')
        if (cancelled) return
        Keyboard.addListener('keyboardWillShow', ({ keyboardHeight }) => {
          document.documentElement.style.setProperty('--kb-height', `${keyboardHeight}px`)
        })
        Keyboard.addListener('keyboardWillHide', () => {
          document.documentElement.style.setProperty('--kb-height', '0px')
        })
      } catch {
        // Plugin unavailable on web — ignore silently.
      }
    }

    void configureStatusBar()
    void configureKeyboard()

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

  // Route push notification taps to the correct page.
  // Backend sends { url: '/student/notifications' } or { path: '...' } in data.
  const handleNotificationTap = useCallback((action: ActionPerformed) => {
    const data = action.notification.data ?? {}
    const path = (data.url ?? data.path ?? '') as string
    if (path.startsWith('/')) {
      router.push(path)
    } else {
      router.push('/student/notifications')
    }
  }, [router])

  usePushNotifications({ onTap: handleNotificationTap })

  return (
    <>
      <NetworkBanner />
      {children}
    </>
  )
}
