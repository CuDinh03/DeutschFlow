'use client'

import * as Sentry from '@sentry/browser'

// Crash reporting is inert until NEXT_PUBLIC_SENTRY_DSN is configured. This keeps
// local/dev builds quiet and lets production opt in purely via env, with no code
// change. Safe to call init() multiple times — guarded by `initialized`.
const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN
const ENVIRONMENT = process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.NODE_ENV

let initialized = false

export function initCrashReporting(): void {
  if (initialized || !DSN || typeof window === 'undefined') return
  initialized = true

  Sentry.init({
    dsn: DSN,
    environment: ENVIRONMENT,
    // Conservative defaults — capture errors, no perf/session-replay noise until
    // we decide we want (and want to pay for) those volumes.
    tracesSampleRate: 0,
    sampleRate: 1,
  })
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return
  Sentry.captureException(error, context ? { extra: context } : undefined)
}

export function setUserContext(user: { id?: string | number; email?: string } | null): void {
  if (!initialized) return
  Sentry.setUser(user ? { id: user.id ? String(user.id) : undefined, email: user.email } : null)
}
