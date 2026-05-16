'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { setTokens } from '@/lib/authSession'
import { DeutschFlowLogo } from '@/components/ui/DeutschFlowLogo'
import { useTracking } from '@/hooks/useTracking'

type FieldErrors = Record<string, string>

export default function RegisterPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const { trackEvent, identifyUser } = useTracking()
  const [form, setForm] = useState({ email: '', phoneNumber: '', password: '', displayName: '', locale: 'vi' })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setFieldErrors({})
    trackEvent('register_started', { locale: form.locale })
    try {
      const { data } = await api.post('/auth/register', form)
      setTokens(data)
      if (form.locale && ['vi', 'en', 'de'].includes(form.locale)) {
        document.cookie = `locale=${form.locale};path=/;max-age=31536000;SameSite=Lax`
      }
      router.refresh()

      const userRes = await api.get('/auth/me')
      const user = userRes.data

      // Identify newly registered user in PostHog
      identifyUser(String(user.id), {
        email: user.email,
        name: user.displayName,
        role: user.role,
        locale: user.locale,
        created_at: new Date().toISOString(),
      })
      trackEvent('register_success', { role: user.role, locale: form.locale })

      switch (user.role) {
        case 'ADMIN':
          router.push('/admin')
          break
        case 'TEACHER':
          router.push('/teacher')
          break
        case 'STUDENT':
        default:
          router.push('/onboarding')
          break
      }
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { detail?: string; errors?: FieldErrors } } })?.response?.data
      if (res?.errors) setFieldErrors(res.errors)
      else {
        setError(res?.detail ?? t('registerFailed'))
        trackEvent('register_failed', { reason: res?.detail ?? 'unknown' })
      }
    } finally {
      setLoading(false)
    }
  }

  const field = (name: keyof typeof form, label: string, type = 'text', placeholder = '') => (
    <div className="form-field">
      <label className="label">{label}</label>
      <input
        type={type}
        required
        value={form[name]}
        onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        className={`input ${fieldErrors[name] ? 'border-destructive focus:ring-destructive' : ''}`}
        placeholder={placeholder}
      />
      {fieldErrors[name] && (
        <p className="form-error">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {fieldErrors[name]}
        </p>
      )}
    </div>
  )

  return (
    <div className="auth-shell">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary-hover/8 to-brand-black-dark/10" />

      <div className="auth-container relative z-10">
        <div className="flex items-center justify-center mb-8">
          <DeutschFlowLogo variant="horizontal" size={220} animated />
        </div>

        {/* Card */}
        <div className="auth-card">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">{t('registerTitle')}</h2>
            <p className="text-muted-foreground">{t('subtitleRegister')}</p>
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
            {field('displayName', t('displayName'), 'text', t('placeholderDisplayName'))}
            {field('email', t('email'), 'email', t('placeholderEmail'))}

            {/* Phone number field — VN format */}
            <div className="form-field">
              <label className="label">Số điện thoại <span className="text-destructive">*</span></label>
              <input
                type="tel"
                required
                value={form.phoneNumber}
                onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))}
                className={`input ${fieldErrors['phoneNumber'] ? 'border-destructive focus:ring-destructive' : ''}`}
                placeholder="0912345678"
                maxLength={10}
                pattern="^0[35789]\d{8}$"
              />
              {fieldErrors['phoneNumber'] ? (
                <p className="form-error">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {fieldErrors['phoneNumber']}
                </p>
              ) : (
                <p className="form-help">Số VN 10 chữ số, bắt đầu bằng 03/05/07/08/09</p>
              )}
            </div>

            {field('password', t('password'), 'password', t('passwordHint'))}
            
            <div className="form-field">
              <label className="label">{t('uiLanguage')}</label>
              <select
                value={form.locale}
                onChange={e => setForm(f => ({ ...f, locale: e.target.value }))}
                className="input"
              >
                <option value="vi">🇻🇳 Tiếng Việt</option>
                <option value="en">🇬🇧 English</option>
                <option value="de">🇩🇪 Deutsch</option>
              </select>
              <p className="form-help">VI / EN / DE</p>
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
                  {t('creatingAccount')}
                </span>
              ) : (
                t('register')
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-center text-muted-foreground">
              {t('hasAccount')}{' '}
              <Link href="/login" className="text-primary hover:text-primary-hover font-semibold transition-colors">
                {t('login')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
