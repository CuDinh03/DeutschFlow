import { Platform } from 'react-native'

/**
 * Master switch for the StoreKit in-app purchase flow.
 *
 * Keep this FALSE until the purchase + restore flow has been verified on a real device with an App
 * Store sandbox tester. `expo-iap` adds a native module, so turning this on ships in a NEW EAS build
 * that must clear App Review — it cannot be delivered over OTA. Flipping the flag alone does nothing
 * without that build.
 */
export const IAP_ENABLED = false

/**
 * Whether to show in-app upgrade / paywall surfaces.
 *
 * Android: always on — PRO is managed on the web and simply reflected via `isPro`.
 * iOS: off until StoreKit IAP is live ({@link IAP_ENABLED}). App Store Review Guideline 3.1.1 forbids
 * steering to an external (web) purchase, so with no StoreKit flow we hide the upsell entirely.
 * Subscriptions bought on the web still unlock automatically — this only gates the upsell surfaces.
 */
export const PAYWALL_ENABLED = Platform.OS !== 'ios' || IAP_ENABLED

/**
 * v1.0: iOS ships fully free — no purchase, no locked content, no "PRO"/"upgrade" wording — so the app
 * clears App Store Review 2.1(b) (business model) and removes any 3.1.1 "unlock content bought outside
 * IAP" risk. When true, every PRO *feature* gate opens and every commercial label is hidden on iOS.
 *
 * v1.1: flip {@link IAP_ENABLED} to `true` and this derives back to `false` automatically — all PRO
 * gates and labels return to normal with no per-screen edits. See `plans/appstore/IOS_FREE_MODE.md`.
 */
export const PRO_UNLOCKED_FREE = Platform.OS === 'ios' && !IAP_ENABLED
