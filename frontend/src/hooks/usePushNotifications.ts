import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import type { Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PushHandlers {
  onToken?: (token: string) => void
  onNotification?: (notification: PushNotificationSchema) => void
  onTap?: (action: ActionPerformed) => void
}

// ─── One-time registration (call after user logs in) ─────────────────────────

export async function registerPushNotifications(onToken?: (token: string) => void): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const status = await PushNotifications.requestPermissions()
  if (status.receive !== 'granted') return

  await PushNotifications.register()

  if (onToken) {
    PushNotifications.addListener('registration', (token: Token) => {
      onToken(token.value)
    })
  }
}

// ─── Hook — attach notification listeners while mounted ───────────────────────

export function usePushNotifications({ onToken, onNotification, onTap }: PushHandlers = {}) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const listeners: Promise<{ remove: () => Promise<void> }>[] = []

    if (onToken) {
      listeners.push(
        PushNotifications.addListener('registration', (token: Token) => {
          onToken(token.value)
        })
      )
    }

    if (onNotification) {
      listeners.push(
        PushNotifications.addListener(
          'pushNotificationReceived',
          (notification: PushNotificationSchema) => {
            onNotification(notification)
          }
        )
      )
    }

    if (onTap) {
      listeners.push(
        PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (action: ActionPerformed) => {
            onTap(action)
          }
        )
      )
    }

    return () => {
      listeners.forEach(p => p.then(l => l.remove()))
    }
  }, [onToken, onNotification, onTap])
}
