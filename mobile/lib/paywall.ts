import { Platform } from 'react-native'

/**
 * Master switch for the StoreKit in-app purchase flow.
 *
 * v1.0(10): ON. App Review rejected 1.0(9) under 3.1.1 because web-purchased PRO (SePay) unlocked
 * on iOS with no IAP path. Per 3.1.3(b), cross-platform PRO may keep unlocking on iOS ONLY while
 * the same subscription is also purchasable via IAP — so this stays true from now on.
 * Requires the 4 auto-renewable products (lib/iapProducts.ts) to be approved in App Store Connect,
 * and a NEW EAS build (native module — not OTA-able). Verify purchase + restore with a sandbox
 * tester before submitting.
 */
export const IAP_ENABLED = true

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
