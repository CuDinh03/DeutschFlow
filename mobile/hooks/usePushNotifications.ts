import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { router } from 'expo-router'
import api from '@/lib/api'

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

async function registerForPushNotifications(): Promise<string | null> {
  if (!(await ensureNotificationPermission())) return null

  // The Expo push token requires a real device (the simulator has no APNs token).
  if (!Device.isDevice) return null

  // projectId is required by SDK 49+. Without it, getExpoPushTokenAsync throws.
  // Fall back gracefully so the rest of the app is unaffected before `eas init`.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId as string | undefined

  if (!projectId || projectId === 'YOUR_EAS_PROJECT_ID') return null

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId })
    return token.data
  } catch {
    return null
  }
}

export function usePushNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null)
  const responseListener = useRef<Notifications.EventSubscription | null>(null)

  useEffect(() => {
    void registerForPushNotifications().then(async (token) => {
      if (!token) return
      try {
        await api.post('/profile/me/push-token', { token, platform: Platform.OS })
      } catch {
        // non-critical — push token registration failure is silent
      }
    })

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // foreground notification received — badge updates automatically
    })

    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
      // Tapping a notification opens the in-app notifications inbox. Per-item deep
      // links are a follow-up (needs a shared route scheme between backend and app).
      router.push('/(student)/notifications')
    })

    return () => {
      notificationListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [])
}
