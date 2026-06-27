import Constants from 'expo-constants'
import * as Sentry from '@sentry/react-native'

/**
 * Crash / error reporting bootstrap (Sentry) — S14.
 *
 * NO-OP when extra.sentryDsn is empty, so dev/local builds send nothing. The
 * native module + Expo config plugin are wired, so turning Sentry on later is just:
 * set extra.sentryDsn (and, for symbolicated source maps, the plugin
 * organization/project + a SENTRY_AUTH_TOKEN EAS secret) — no code change.
 */
const SENTRY_DSN =
  (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn ?? ''

export function initObservability(): void {
  if (!SENTRY_DSN) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[observability] Sentry DSN not set — crash reporting disabled.')
    }
    return
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    // Even with a DSN present, stay silent in dev to keep local noise out of Sentry.
    enabled: !__DEV__,
    tracesSampleRate: 0.2,
    // Scrub PII before sending — never ship Authorization headers / tokens.
    beforeSend: (event) => {
      if (event.request?.headers) {
        delete event.request.headers['Authorization']
      }
      return event
    },
  })
}

/** Report a caught error to Sentry. Safe no-op when Sentry isn't initialised. */
export function reportError(error: unknown): void {
  Sentry.captureException(error)
}

/**
 * Wrap the root component for Sentry's touch/profiler/error instrumentation.
 * Sentry.wrap always injects its wrapper components, but they are inert no-ops
 * until initObservability() runs with a DSN (a benign dev-only "wrap was called
 * before init" warning is expected until then).
 */
export const wrapWithObservability = Sentry.wrap
