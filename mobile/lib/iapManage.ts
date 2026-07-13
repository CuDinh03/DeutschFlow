/**
 * Subscription management entry points for the iOS StoreKit paywall.
 *
 * Cancellation and refunds for App Store subscriptions are handled by Apple, NOT the app — App Store
 * policy forbids the app from cancelling or refunding directly. The correct, Guideline-compliant UX is
 * to deep-link the user into Apple's own management surfaces. Everything here is best-effort and never
 * throws, mirroring `lib/legal.ts`.
 */
import { Linking } from 'react-native'
import { deepLinkToSubscriptions } from 'expo-iap'

/** App Store subscriptions page — fallback when the native deep link is unavailable. */
const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions'
/** Apple's official "report a problem" / refund-request page. Refunds are processed by Apple. */
const APPLE_REFUND_URL = 'https://reportaproblem.apple.com'

/**
 * Open the platform's subscription-management UI, where the user can change or **cancel** their plan.
 * Uses StoreKit's native manage-subscriptions surface; falls back to the web subscriptions page.
 */
export async function openManageSubscriptions(): Promise<void> {
  try {
    await deepLinkToSubscriptions()
  } catch {
    Linking.openURL(APPLE_SUBSCRIPTIONS_URL).catch(() => {})
  }
}

/**
 * Open Apple's refund-request page. Subscriptions bought via In-App Purchase can only be refunded by
 * Apple — the app cannot issue refunds itself — so this points the user at the official channel.
 */
export function openRefundRequest(): void {
  Linking.openURL(APPLE_REFUND_URL).catch(() => {})
}
