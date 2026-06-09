import { Platform } from 'react-native'

/**
 * Whether to show in-app upgrade / paywall surfaces.
 *
 * Disabled on iOS: there is no StoreKit IAP wired yet, and App Store Review Guideline 3.1.1 forbids
 * steering users to an external (web) purchase to unlock features. Subscriptions bought on the web
 * still apply automatically (the account's `isPro` flag), so this only hides the upsell / steering
 * surfaces — it does NOT remove access for users who already have PRO.
 *
 * Flip back on (or delete this guard) once `react-native-iap` is wired and StoreKit products are live.
 */
export const PAYWALL_ENABLED = Platform.OS !== 'ios'
