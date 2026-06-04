// Product analytics (PostHog) for the mobile app.
//
// Mirrors the WEB taxonomy so web + iOS + Android events land in the SAME
// PostHog project, split by the `platform` super-property. This makes funnels
// and insights built on web (e.g. guide_tour_started -> guide_tour_finished)
// work for mobile users too, with no extra dashboard setup.
//
// GUARDED NO-OP when no key is configured: the app builds and runs with
// analytics simply disabled (same scaffold pattern as lib/observability.ts).
//
// To ACTIVATE: set `extra.posthogKey` in app.json to the same `phc_*` project
// key the web app uses (NEXT_PUBLIC_POSTHOG_KEY). `posthogHost` defaults to
// PostHog US cloud — change it if the project is on EU/self-hosted.

import { PostHog } from 'posthog-react-native'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

type AnalyticsExtra = { posthogKey?: string; posthogHost?: string }
const extra = (Constants.expoConfig?.extra ?? {}) as AnalyticsExtra
const KEY = (extra.posthogKey ?? '').trim()
const HOST = (extra.posthogHost ?? '').trim() || 'https://us.i.posthog.com'

export const analyticsEnabled = KEY.length > 0

/** Singleton client — null when analytics is disabled (no key). Usable outside
 *  React (e.g. in the auth store) where the usePostHog hook isn't available. */
export const posthog: PostHog | null = analyticsEnabled
  ? new PostHog(KEY, { host: HOST, enableSessionReplay: false, captureAppLifecycleEvents: true })
  : null

if (!analyticsEnabled && __DEV__) {
  // eslint-disable-next-line no-console
  console.log('[analytics] PostHog key not set — product analytics disabled (scaffold). See lib/analytics.ts.')
}

/** Action verbs accepted by {@link trackFeatureAction} — mirrors the web hook. */
export type FeatureAction =
  | 'started'
  | 'completed'
  | 'quit'
  | 'clicked'
  | 'paywall_viewed'
  | 'checkout_started'
  | 'checkout_completed'
  | 'checkout_abandoned'

/** JSON-safe property bag accepted by PostHog (values must be serialisable). */
export type AnalyticsProps = Record<string, string | number | boolean | null>

/** Attach platform + app version to every event so web↔mobile funnels can split. */
export function registerSuperProperties(): void {
  void posthog?.register({
    platform: Platform.OS,
    app_version: Constants.expoConfig?.version ?? 'dev',
  })
}

/** Set the subscription tier as a super-property (parity with web person props). */
export function setSubscriptionTier(tier: string | null | undefined): void {
  if (!tier) return
  void posthog?.register({ subscription_tier: tier })
}

export function identifyUser(id: string | number, props?: AnalyticsProps): void {
  posthog?.identify(String(id), props)
}

export function resetAnalytics(): void {
  posthog?.reset()
}

export function captureEvent(event: string, props?: AnalyticsProps): void {
  void posthog?.capture(event, props)
}

/** Mirrors web's trackFeatureAction → emits `feature_<feature>_<action>`. */
export function trackFeatureAction(
  feature: string,
  action: FeatureAction,
  metadata?: AnalyticsProps,
): void {
  void posthog?.capture(`feature_${feature}_${action}`, { feature, action, ...metadata })
}

// Register baseline super-properties as soon as this module is first imported.
registerSuperProperties()
