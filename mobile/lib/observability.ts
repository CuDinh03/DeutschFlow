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

/** Ngữ cảnh kèm theo một lỗi API, đủ để nhóm và đo tần suất mà không kèm dữ liệu người dùng. */
export type ApiErrorContext = {
  /** Đường dẫn đã bỏ id số — `/ai-speaking/sessions/{id}/chat`. Dùng làm tag nhóm. */
  endpoint: string
  method: string
  /** HTTP status, hoặc `network` khi không có response (mất mạng), `timeout` khi axios huỷ. */
  status: string
  /** `extensions.code` của RFC-7807 (AI_BUSY, QUOTA_EXCEEDED…) nếu backend có gửi. */
  aiCode?: string
  /**
   * Mức Sentry. Mặc định 'error'. Đêm owner QA offline 03/09: mỗi lần một thiết bị mất mạng là
   * MỘT LOẠT AxiosError level error → email "high priority" — trong khi mất mạng là chuyện
   * thường nhật của mobile (thang máy, tàu điện), không phải sự cố hệ thống. Network/timeout
   * giờ đi mức 'warning': vẫn ĐẾM được tần suất trên dashboard (mục đích gốc R-M6, đêm 23/07)
   * nhưng không còn réo email; 5xx/429 giữ nguyên 'error'.
   */
  level?: 'error' | 'warning'
}

/**
 * Báo cáo một lỗi API kèm tag để đếm được theo mã.
 *
 * Audit speaking 24/07 (R-M6): trước đây mọi lỗi đã catch chỉ dẫn tới `Alert.alert`, còn log API
 * bị bọc trong `__DEV__` — nên **không có bất kỳ số liệu nào** về tần suất 503/timeout thật trên
 * prod. Đêm 23/07 không ai biết đang có sự cố cho tới khi người dùng chụp màn hình gửi.
 *
 * Không gửi thân request/response: chúng chứa câu nói của người học. Chỉ endpoint + status + mã lỗi.
 */
export function reportApiError(error: unknown, context: ApiErrorContext): void {
  sentry?.captureException(error, {
    level: context.level ?? 'error',
    tags: {
      endpoint: context.endpoint,
      method: context.method,
      status: context.status,
      ...(context.aiCode ? { ai_code: context.aiCode } : {}),
    },
    // `api` để tách hẳn khỏi crash JS trong Sentry — hai loại này cần hai cách xử lý khác nhau.
    fingerprint: ['api', context.endpoint, context.status, context.aiCode ?? ''],
  })
}

/** Root wrapper — Sentry.wrap when enabled, identity passthrough otherwise. */
export function wrapWithObservability<T>(component: T): T {
  return sentry ? (sentry.wrap(component as never) as T) : component
}
