import Constants from 'expo-constants'

/**
 * Crash / error reporting bootstrap — S14.
 *
 * Sentry was temporarily REMOVED: @sentry/react-native@7.2.0 caused a New
 * Architecture TurboModule init crash on the SDK 54 build (SIGABRT on
 * com.meta.react.turbomodulemanager.queue at launch). These exports remain as
 * no-ops so callers (app/_layout.tsx, screens) need no changes; re-add Sentry
 * once it can be verified on a device/dev build.
 */
const SENTRY_DSN =
  (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn ?? ''

export function initObservability(): void {
  if (__DEV__ && !SENTRY_DSN) {
    // eslint-disable-next-line no-console
    console.log('[observability] crash reporting disabled (Sentry removed pending New-Arch fix).')
  }
}

/** Report a caught error. No-op until crash reporting is re-enabled. */
export function reportError(_error: unknown): void {}

/** Root wrapper — identity passthrough while crash reporting is disabled. */
export function wrapWithObservability<T>(component: T): T {
  return component
}
