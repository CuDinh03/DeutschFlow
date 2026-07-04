import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { router } from 'expo-router'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/useAuthStore'
import { invalidateNotificationQueries } from '@/lib/queryClient'
import { resolveNotificationRoute } from '@/lib/notificationRoute'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // SDK 54 (expo-notifications): `shouldShowAlert` was split into
    // `shouldShowBanner` (heads-up banner) + `shouldShowList` (Notification Center).
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

/**
 * Requests notification permission (and sets the Android channel). Runs on every
 * platform — including the iOS Simulator — so notification *display* can be
 * exercised with `xcrun simctl push` even though an Expo push *token* is only
 * obtainable on a physical device.
 */
async function ensureNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'DeutschFlow',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F5C842',
    })
  }

  return finalStatus === 'granted'
}

/** Dev-only push diagnostics. `__DEV__` blocks are stripped from production bundles. */
function logPush(message: string, extra?: unknown): void {
  if (__DEV__) console.log(`[push] ${message}`, extra ?? '')
}

async function registerForPushNotifications(): Promise<string | null> {
  if (!(await ensureNotificationPermission())) {
    logPush('skipped: notification permission not granted')
    return null
  }

  // The Expo push token requires a real device (the simulator has no APNs token).
  if (!Device.isDevice) {
    logPush('skipped: not a physical device (simulator has no APNs token)')
    return null
  }

  // projectId is required by SDK 49+. Without it, getExpoPushTokenAsync throws.
  // Fall back gracefully so the rest of the app is unaffected before `eas init`.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId as string | undefined

  if (!projectId || projectId === 'YOUR_EAS_PROJECT_ID') {
    logPush('skipped: missing/placeholder EAS projectId (run `eas init`)')
    return null
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId })
    return token.data
  } catch (error) {
    logPush('getExpoPushTokenAsync failed', error)
    return null
  }
}

export function usePushNotifications() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const notificationListener = useRef<Notifications.EventSubscription | null>(null)
  const responseListener = useRef<Notifications.EventSubscription | null>(null)

  // Register the Expo push token ONLY for an authenticated session, and re-run
  // when the user logs in. Posting while logged out hits /profile/me/push-token
  // with no auth → 401 → the api interceptor's refresh path fails → the user is
  // bounced to the login screen. Gating on isLoggedIn avoids that race and is the
  // correct behaviour anyway (a push token belongs to the logged-in user).
  useEffect(() => {
    if (!isLoggedIn) return
    void registerForPushNotifications().then(async (token) => {
      if (!token) return
      try {
        await api.post('/profile/me/push-token', { token, platform: Platform.OS })
        logPush('token registered with backend')
      } catch (error) {
        // non-critical — push token registration failure must not break the app
        logPush('failed to send token to /profile/me/push-token', error)
      }
    })
  }, [isLoggedIn])

  // Display/routing listeners are auth-independent (tap-routing lands on a screen
  // that itself enforces auth); mount once for the app's lifetime.
  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // Foreground push: the OS badge updates on its own, but the in-app unread
      // badge + inbox are react-query caches — invalidate them so they refetch now
      // instead of waiting for the stale window / a manual pull-to-refresh.
      invalidateNotificationQueries()
    })

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      // Tapping a push deep-links to where it belongs (assignment, class, chat, …). The push
      // `data` carries the notification `type` + payload ids (backend pushForNotification). Older
      // pushes without a resolvable route fall back to the inbox.
      invalidateNotificationQueries()
      const data = response?.notification?.request?.content?.data as Record<string, unknown> | undefined
      const type = typeof data?.type === 'string' ? data.type : ''
      const route = type ? resolveNotificationRoute(type, data ?? null) : null
      router.push(route ?? '/(student)/notifications')
    })

    return () => {
      notificationListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [])
}
