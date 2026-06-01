import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import api from '@/lib/api'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'DeutschFlow',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F5C842',
    })
  }

  // projectId is required by SDK 49+. Without it, getExpoPushTokenAsync throws.
  // Fall back gracefully so the rest of the app is unaffected during development
  // or before `eas init` has been run.
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

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>
      // Deep link handled by expo-notifications plugin in app.json
      void data
    })

    return () => {
      notificationListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [])
}
