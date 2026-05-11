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

      // Lấy thông tin user để redirect theo role
      const userRes = await api.get('/auth/me')
      const user = userRes.data
      
      // Redirect theo role
      switch (user.role) {
        case 'ADMIN':
          router.push('/admin')
          break
        case 'TEACHER':
          router.push('/teacher')
          break
        case 'STUDENT':
        default:
          // Luôn về dashboard: trang đó chỉ chuyển /onboarding khi /plan/me trả 404 (đúng nghĩa chưa onboarding).
          // Không được gọi /plan/me ở đây + catch moọi lỗi → dễ đẩy nhầm (lỗi mạng/500/user đã có lộ trình).
          router.push('/dashboard')
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
      {/* Language switcher */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>

      <div className="auth-container relative z-10">
        <div className="flex items-center justify-center mb-8">
          <DeutschFlowLogo variant="horizontal" size={220} animated />
        </div>

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

            <button
              type="submit"
              disabled={loading}
              className="btn-primary btn-md w-full"
            >
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

          {/* Demo accounts intentionally not shown in UI */}
        </div>
      </div>
    </div>
  )
}
