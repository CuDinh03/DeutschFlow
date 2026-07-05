import { Alert, type AlertButton } from 'react-native'
import { router } from 'expo-router'
import { apiMessage } from '@/lib/api'
import { usePlanStore } from '@/stores/usePlanStore'
import { isQuotaExceededError, quotaExceededMessage } from '@/lib/quota'
import { PAYWALL_ENABLED } from '@/lib/paywall'

/**
 * Central handler for errors from AI calls.
 *
 * When the failure is "AI quota / 7-day trial exhausted", show a message with a path forward
 * (route to the upgrade screen) instead of a dead-end "OK" alert — this is the moment a trial user
 * hits the wall and the single biggest churn/review risk. The upgrade CTA is only offered where a
 * paywall surface exists ({@link PAYWALL_ENABLED}); on iOS without StoreKit live it stays purely
 * informational (App Store 3.1.1 — no steering to an external purchase).
 *
 * Any other error keeps the caller's existing generic alert.
 */
export function handleAiError(error: unknown, fallbackTitle = 'Lỗi'): void {
  if (isQuotaExceededError(error)) {
    // The trial expiry is virtual (reconciled asynchronously), so the locally cached tier can lag —
    // refresh it so PRO-gated surfaces reflect reality on the next render.
    void usePlanStore.getState().fetchPlan()
    const message = quotaExceededMessage(error) ?? 'Bạn đã dùng hết lượt AI. Hãy nâng cấp để tiếp tục.'
    const buttons: AlertButton[] = [{ text: 'Để sau', style: 'cancel' }]
    if (PAYWALL_ENABLED) {
      buttons.push({ text: 'Nâng cấp', onPress: () => router.push('/(student)/upgrade') })
    }
    Alert.alert('Hết lượt AI', message, buttons)
    return
  }
  Alert.alert(fallbackTitle, apiMessage(error))
}
