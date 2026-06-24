'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { setTokens, clearTokens, recordTokenRefresh } from '@/lib/authSession'
import { useUserStore } from '@/stores/useUserStore'
import { registerPushNotifications } from '@/hooks/usePushNotifications'
import { DeutschFlowLogo } from '@/components/ui/DeutschFlowLogo'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { useTracking } from '@/hooks/useTracking'
import { MobileLoginForm } from '@/components/auth/MobileLoginForm'
import { useStatusBarStyle } from '@/lib/statusBar'
import { lightImpact } from '@/lib/haptics'
import { useIsNative } from '@/lib/native'

type FieldErrors = Record<string, string>

// ─── Post-login redirect (W1.1 — Galerie v2 "route-in") ───────────────────────
// The galerie-v2 flag only EVICTS users from /v2 (see V2Gate); nothing routed a
// flagged user INTO /v2 — post-login always went to legacy. This pulls flagged
// web users to the v2 home per role. Redirect-map mirrors middleware v2RoleHome
// (/v2/admin/users, not /v2/admin, is the established admin landing).
function homeFor(role: string, v2: boolean): string {
  if (role === 'ADMIN') return v2 ? '/v2/admin/users' : '/admin'
  if (role === 'TEACHER') return v2 ? '/v2/teacher' : '/teacher'
  return v2 ? '/v2/student/dashboard' : '/dashboard'
}

// FULL CUTOVER: Galerie v2 is the default surface for every web user. The
// per-user `galerie-v2` PostHog flag proved unreliable (person-property
// propagation + cross-origin flag-reload latency from VN routinely lost the
// race against the bounded wait), so route-in no longer depends on it.
// Rollback lever = GALERIE_V2_DISABLED env, enforced globally in middleware.ts.

// ─── Maintenance Banner ──────────────────────────────────────────────────────
// Hiển thị thông báo bảo trì ở màn hình đăng nhập.
// Cách bật/tắt:
//   - Thêm vào amplify.yml hoặc AWS Amplify env vars:
//       NEXT_PUBLIC_MAINTENANCE_MESSAGE="Máy chủ đang bảo trì từ 02:00–04:00 (SA giờ VN). Vui lòng thử lại sau."
//   - Để trống ("") hoặc xóa biến để ẩn banner.
const MAINTENANCE_MSG = process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE ?? ''

function MaintenanceBanner() {
  const [visible, setVisible] = useState(true)
  if (!MAINTENANCE_MSG || !visible) return null
  return (
    <div
      className="w-full max-w-[480px] mx-auto mb-4 relative z-20"
      role="alert"
      aria-live="polite"
    >
      <div
        className="flex items-start gap-3 px-4 py-3.5 rounded-[14px] border border-amber-300/60 shadow-lg shadow-amber-500/10"
        style={{
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 60%, rgba(253,230,138,0.3) 100%)',
        }}
      >
        {/* Animated pulse icon */}
        <span className="relative mt-0.5 flex-shrink-0">
          <span className="absolute inline-flex h-5 w-5 rounded-full bg-amber-400 opacity-60 animate-ping" />
          <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </span>
        </span>
        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800">🔧 Máy chủ đang bảo trì</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">{MAINTENANCE_MSG}</p>
        </div>
        {/* Dismiss */}
        <button
          onClick={() => setVisible(false)}
          aria-label="Đóng thông báo"
          className="mt-0.5 flex-shrink-0 p-0.5 rounded-full text-amber-600 hover:text-amber-900 hover:bg-amber-200/60 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const { trackEvent, identifyUser } = useTracking()
  const setOrg = useUserStore((s) => s.setOrg)
  const setUser = useUserStore((s) => s.setUser)
  const isNative = useIsNative()
  // Native auth screen uses a dark background → light status bar icons.
  useStatusBarStyle('dark')
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    lightImpact()
    setLoading(true)
    setError('')
    setFieldErrors({})
    trackEvent('login_started', { method: 'email' })
    try {
      // BUG FIX #2: Clear any stale tokens before login attempt
      // This prevents old expired tokens from being sent in Authorization header
      clearTokens()

      const { data } = await api.post('/auth/login', form)
      setTokens(data)
      // Mirror org (tenant) context into the client store; null for B2C / non-org users.
      setOrg({ orgId: data.orgId ?? null, orgRole: data.orgRole ?? null })
      recordTokenRefresh() // BUG FIX #1: Initialize session keep-alive tracking
      if (data.locale && ['vi', 'en', 'de'].includes(data.locale)) {
        document.cookie = `locale=${data.locale};path=/;max-age=31536000;SameSite=Lax`
      }

      const userRes = await api.get('/auth/me')
      const user = userRes.data
      // Populate the user store so shared screens (sidebar name/email, dashboard
      // greeting, achievements self-highlight) have an identity to read.
      setUser({
        // AuthResponse exposes the id as `userId` (not `id`); `user.id` is undefined here.
        id: String(user.userId),
        email: user.email,
        roles: [String(user.role)],
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      })

      // Identify to PostHog BEFORE routing so the galerie-v2 flag is evaluated
      // for THIS user — the rollout targets internal accounts / cohorts by user
      // id, so an anonymous eval would miss them. identify() reloads flags.
      identifyUser(String(user.userId), {
        email: user.email,
        name: user.displayName,
        role: user.role,
        locale: user.locale,
      })

      // Route-in (FULL CUTOVER): every WEB user lands on the Galerie v2 home.
      // Native (Expo) is never sent to the desktop-first v2 surface. Legacy stays
      // reachable via direct links + the GALERIE_V2_DISABLED middleware kill-switch.
      const useV2 = !isNative
      router.replace(homeFor(user.role, useV2))

      // Fire-and-forget after navigation.
      trackEvent('login_success', { role: user.role, galerie_v2: useV2 })
      registerPushNotifications()
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { detail?: string; errors?: FieldErrors } } })?.response?.data
      if (res?.errors) setFieldErrors(res.errors)
      else {
        setError(res?.detail ?? t('loginFailed'))
        trackEvent('login_failed', { reason: res?.detail ?? 'unknown' })
      }
    } finally {
      setLoading(false)
    }
  }

  if (isNative) {
    return (
      <MobileLoginForm
        form={form}
        error={error}
        fieldErrors={fieldErrors}
        loading={loading}
        onChange={(field, value) => setForm(f => ({ ...f, [field]: value }))}
        onSubmit={handleSubmit}
      />
    )
  }

  return (
    <div className="auth-shell">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary-hover/8 to-brand-black-dark/10" />
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>

      <div className="auth-container relative z-10">
        <div className="flex items-center justify-center mb-8">
          <DeutschFlowLogo variant="horizontal" size={220} animated />
        </div>

        {/* Maintenance Banner — hiển thị khi NEXT_PUBLIC_MAINTENANCE_MESSAGE != '' */}
        <MaintenanceBanner />

        {/* Card */}
        <div className="auth-card">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">{t('loginTitle')}</h2>
            <p className="text-muted-foreground">{t('subtitleLogin')}</p>
          </div>

          {error && (
            <div className="mb-6 alert-error flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="form-field">
              <label className="label">{t('email')}</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className={`input ${fieldErrors.email ? 'border-destructive focus:ring-destructive' : ''}`}
                placeholder={t('placeholderLoginEmail')}
              />
              {fieldErrors.email && (
                <p className="form-error">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="form-field">
              <label className="label">{t('password')}</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className={`input ${fieldErrors.password ? 'border-destructive focus:ring-destructive' : ''}`}
                placeholder={t('passwordMaskPlaceholder')}
              />
              {fieldErrors.password && (
                <p className="form-error">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn-primary btn-md w-full">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('loggingIn')}
                </span>
              ) : (
                t('login')
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-center text-muted-foreground">
              {t('noAccount')}{' '}
              <Link href="/register" className="text-primary hover:text-primary-hover font-semibold transition-colors">
                {t('register')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
