import Constants from 'expo-constants'

/**
 * Crash / error reporting via Sentry — S14.
 *
 * History: @sentry/react-native 7.2.0 SIGABRT'd at launch on the SDK 54 New-Architecture build — the
 * `mobileReplayIntegration` postInit path installed a breadcrumb converter over a nil replay instance
 * and threw an ObjC exception through a void TurboModule (com.meta.react.turbomodulemanager.queue).
 * That whole crash class was fixed in 8.6.0 (PR #5858) and never backported to any 7.x. This project
 * pins **8.17.1** (also carries the Android 16 KB page-align fix from #6396) and deliberately does
 * NOT enable session replay — the exact configuration the fix makes safe.
 *
 * Activation is gated on a DSN. With `extra.sentryDsn` empty, the `@sentry/react-native` JS module is
 * never even `require`d, so a build without a DSN cannot touch the native SDK from JS at launch.
 *
 * BEFORE setting a real DSN: verify a **Release** build on a **physical iPhone** does not crash at
 * launch (idle 5s+ through the ~0.4s post-launch breadcrumb window). The original bug only reproduced
 * on release + New Arch — never in dev or the simulator — so this device check is mandatory, not a
 * formality. See lib/paywall.ts's IAP_ENABLED for the same "wire it, gate it, device-verify" pattern.
 */
const SENTRY_DSN =
  (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn ?? ''

type SentryModule = typeof import('@sentry/react-native')

// Load the SDK's JS only when a DSN is configured. No DSN → this branch never runs → the app never
// touches @sentry/react-native from JS, keeping launch identical to the removed-Sentry state.
let sentry: SentryModule | null = null
if (SENTRY_DSN) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sentry = require('@sentry/react-native') as SentryModule
}

export function initObservability(): void {
  if (!sentry) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[observability] crash reporting disabled (no Sentry DSN configured).')
    }
    return
  }
  sentry.init({
    dsn: SENTRY_DSN,
    // Intentionally NO session replay. Do NOT set `replaysSessionSampleRate` / `replaysOnErrorSampleRate`
    // here — NOT EVEN to 0: the SDK enables mobileReplayIntegration whenever either key is `typeof
    // 'number'` (integrations/default.js), so `…: 0` still instantiates the replay path — the exact
    // postInit path that SIGABRT'd on 7.2.0. Leaving both unset is what 8.6.0/#5858 makes safe on the
    // New Architecture. Enabling replay is a separate change with its own device test.
    sendDefaultPii: false,
    // Pure crash/error reporting; no performance-tracing surface for this launch-sensitive re-add.
    tracesSampleRate: 0,
  })
}

/** Report a caught error. No-op until a DSN is configured. */
export function reportError(error: unknown): void {
  sentry?.captureException(error)
}

/** Root wrapper — Sentry.wrap when enabled, identity passthrough otherwise. */
export function wrapWithObservability<T>(component: T): T {
  return sentry ? (sentry.wrap(component as never) as T) : component
}
