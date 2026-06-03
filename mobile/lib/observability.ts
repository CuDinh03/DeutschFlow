import Constants from 'expo-constants'

/**
 * Crash / error reporting bootstrap (Sentry) — S14.
 *
 * Currently a GUARDED NO-OP so it can ship without a native dependency or device build:
 * nothing imports `@sentry/react-native` until you activate it, so Metro keeps bundling.
 *
 * To ACTIVATE (needs your Sentry + Expo accounts):
 *   1. `npx expo install @sentry/react-native`
 *   2. Add the Sentry Expo config plugin to app.json `plugins`
 *      (see docs/security/PHASE1_MOBILE_HARDENING.md).
 *   3. Set the DSN: app.json `extra.sentryDsn`, or inject `SENTRY_DSN` via EAS env.
 *   4. Add `import * as Sentry from '@sentry/react-native'` at the top of this file and
 *      uncomment the `Sentry.init({...})` block below.
 *   5. Optionally wrap the root export with `Sentry.wrap(RootLayout)` in app/_layout.tsx.
 */
const SENTRY_DSN =
  (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn ?? ''

export function initObservability(): void {
  if (!SENTRY_DSN) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[observability] Sentry DSN not set — crash reporting disabled (scaffold).')
    }
    return
  }

  // --- ACTIVATE: uncomment after `npx expo install @sentry/react-native` ---
  // Sentry.init({
  //   dsn: SENTRY_DSN,
  //   environment: __DEV__ ? 'development' : 'production',
  //   tracesSampleRate: 0.2,
  //   enableNativeCrashHandling: true,
  //   // Scrub PII before sending — never ship access/refresh tokens or emails.
  //   beforeSend: (event) => {
  //     if (event.request?.headers) delete event.request.headers['Authorization']
  //     return event
  //   },
  // })

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[observability] Sentry DSN present but SDK not installed yet — see lib/observability.ts.')
  }
}
