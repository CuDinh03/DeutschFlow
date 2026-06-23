'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import api from '@/lib/api'
import { setTokens, clearTokens, recordTokenRefresh } from '@/lib/authSession'
import { useUserStore } from '@/stores/useUserStore'
import { useTracking } from '@/hooks/useTracking'
import { registerPushNotifications } from '@/hooks/usePushNotifications'
import { GaCap, GaBtn } from '@/components/ui-v2'
import { GaAuthShell, GaField, AuthErrorBanner, AuthDivider, GoogleBtn, EMAIL_RE } from '../authShared'

// ─────────────────────────────────────────────────────────────────────────────
// Đăng nhập (GaLogin) — Galerie 2.0 reskin of /login. Plumbing reused 1:1 (zero
// backend): POST /auth/login → setTokens + setOrg + recordTokenRefresh + locale
// cookie → GET /auth/me → role redirect. PostHog identify + push reg are
// fire-and-forget after navigation (mirrors legacy login).
//
// Redirect targets land users in the v2 home that EXISTS today:
//   ADMIN → /v2/admin/users (the admin dashboard index is not built yet) ·
//   org OWNER/ADMIN → /v2/org · TEACHER → /v2/teacher.
//   STUDENT → /v2/student/dashboard (the working v2 student home).
// Google sign-in / "quên mật khẩu" have no backend → honest toast (Option-1).
// ─────────────────────────────────────────────────────────────────────────────

type FieldErrors = Record<string, string>

export default function V2LoginPage() {
  const router = useRouter()
  const { trackEvent, identifyUser } = useTracking()
  const setOrg = useUserStore((s) => s.setOrg)
  const setUser = useUserStore((s) => s.setUser)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errs, setErrs] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (loading) return
    const e: FieldErrors = {}
    if (!email.trim()) e.email = 'Vui lòng nhập email'
    else if (!EMAIL_RE.test(email)) e.email = 'Email không hợp lệ'
    if (!password) e.password = 'Vui lòng nhập mật khẩu'
    setErrs(e)
    if (Object.keys(e).length) return

    setLoading(true)
    setError('')
    trackEvent('login_started', { method: 'email' })
    try {
      // Clear any stale tokens before login (prevents an expired token in the header).
      clearTokens()
      // Trim only — drop stray leading/trailing whitespace (autofill/paste). We deliberately do NOT
      // lowercase here: the backend now matches email case-insensitively, and lowercasing client-side
      // would break users whose email was historically stored mixed-case while an older, still
      // case-sensitive backend is live during a rollout. Trimming is safe against any backend version.
      const { data } = await api.post('/auth/login', { email: email.trim(), password })
      setTokens(data)
      setOrg({ orgId: data.orgId ?? null, orgRole: data.orgRole ?? null })
      recordTokenRefresh()
      if (data.locale && ['vi', 'en', 'de'].includes(data.locale)) {
        document.cookie = `locale=${data.locale};path=/;max-age=31536000;SameSite=Lax`
      }

      const { data: user } = await api.get('/auth/me')
      // Populate the user store so shared screens (sidebar name/email, dashboard
      // greeting, achievements self-highlight) have an identity to read.
      setUser({
        id: String(user.id),
        email: user.email,
        roles: [String(user.role)],
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      })
      const orgRole = String(data.orgRole ?? '').toUpperCase()
      switch (user.role) {
        case 'ADMIN':
          // /v2/admin has no index page yet → land on the locked canonical list.
          router.replace('/v2/admin/users')
          break
        case 'OWNER':
        case 'MANAGER':
          // First-class org-admin platform roles land in the org console.
          router.replace('/v2/org')
          break
        case 'TEACHER':
          // Legacy tokens minted before org admins became first-class roles still carry role=TEACHER
          // with an OWNER/MANAGER orgRole — keep routing them to the console until the token refreshes.
          router.replace(
            orgRole === 'OWNER' || orgRole === 'MANAGER' || orgRole === 'ADMIN' ? '/v2/org' : '/v2/teacher',
          )
          break
        case 'STUDENT':
        default:
          // Full cutover: students land on the v2 dashboard (matches the /login route-in).
          router.replace('/v2/student/dashboard')
          break
      }

      identifyUser(String(user.id), { email: user.email, name: user.displayName, role: user.role, locale: user.locale })
      trackEvent('login_success', { role: user.role })
      registerPushNotifications()
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { detail?: string; errors?: FieldErrors } } })?.response?.data
      if (res?.errors) setErrs(res.errors)
      else {
        setError(res?.detail ?? 'Email hoặc mật khẩu không đúng.')
        trackEvent('login_failed', { reason: res?.detail ?? 'unknown' })
      }
      setLoading(false)
    }
  }

  return (
    <GaAuthShell>
      <GaCap className="mb-3 block">Chào mừng trở lại</GaCap>
      <h1 className="m-0 mb-2 font-ga-display text-[38px] font-medium tracking-[-0.015em] text-ga-ink">Đăng nhập</h1>
      <p className="m-0 mb-7 text-[15px] text-ga-muted">Tiếp tục hành trình tiếng Đức của bạn.</p>

      {error && (
        <AuthErrorBanner>
          <strong>{error}</strong>{' '}
          Vui lòng kiểm tra lại hoặc{' '}
          <button type="button" onClick={() => toast('Đã gửi link đặt lại mật khẩu (sắp ra mắt)')} className="underline">
            đặt lại mật khẩu
          </button>
          .
        </AuthErrorBanner>
      )}

      <GaField
        label="Email"
        type="email"
        placeholder="lan@example.com"
        autoComplete="email"
        value={email}
        onChange={(v) => { setEmail(v); setErrs((x) => ({ ...x, email: '' })) }}
        error={errs.email}
        required
      />
      <GaField
        label="Mật khẩu"
        type="password"
        placeholder="Nhập mật khẩu"
        autoComplete="current-password"
        value={password}
        onChange={(v) => { setPassword(v); setErrs((x) => ({ ...x, password: '' })) }}
        error={errs.password}
        required
      />

      <div className="mb-5 mt-1 flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-[14px] text-ga-muted">
          <input type="checkbox" defaultChecked style={{ accentColor: 'var(--ga-ink)' }} /> Ghi nhớ đăng nhập
        </label>
        <button
          type="button"
          onClick={() => toast('Đã gửi link đặt lại mật khẩu (sắp ra mắt)')}
          className="ga-ui text-[13.5px] text-ga-muted underline transition-colors hover:text-ga-ink"
        >
          Quên mật khẩu?
        </button>
      </div>

      <GaBtn
        variant="yellow"
        size="lg"
        className="mb-4 w-full"
        loading={loading}
        disabled={loading}
        onClick={submit}
      >
        {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </GaBtn>

      <AuthDivider />
      <GoogleBtn />

      <div className="mt-7 text-center text-[14px] text-ga-muted">
        Chưa có tài khoản?{' '}
        <Link href="/v2/register" className="font-bold text-ga-ink underline">
          Đăng ký miễn phí →
        </Link>
      </div>
    </GaAuthShell>
  )
}
