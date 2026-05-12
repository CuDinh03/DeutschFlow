'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { setTokens } from '@/lib/authSession'
import { DeutschFlowLogo } from '@/components/ui/DeutschFlowLogo'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'

type FieldErrors = Record<string, string>

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
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setFieldErrors({})
    try {
      const { data } = await api.post('/auth/login', form)
      setTokens(data)
      if (data.locale && ['vi', 'en', 'de'].includes(data.locale)) {
        document.cookie = `locale=${data.locale};path=/;max-age=31536000;SameSite=Lax`
      }
      router.refresh()

      const userRes = await api.get('/auth/me')
      const user = userRes.data
      switch (user.role) {
        case 'ADMIN':
          router.replace('/admin')
          break
        case 'TEACHER':
          router.replace('/teacher')
          break
        case 'STUDENT':
        default:
          router.replace('/dashboard')
          break
      }
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { detail?: string; errors?: FieldErrors } } })?.response?.data
      if (res?.errors) setFieldErrors(res.errors)
      else setError(res?.detail ?? t('loginFailed'))
    } finally {
      setLoading(false)
    }
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
