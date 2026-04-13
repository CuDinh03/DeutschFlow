'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'

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
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      
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
          try {
            await api.get('/plan/me')
            router.push('/student')
          } catch {
            router.push('/onboarding')
          }
          break
      }
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { detail?: string; errors?: FieldErrors } } })?.response?.data
      if (res?.errors) setFieldErrors(res.errors)
      else setError(res?.detail ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-hover to-navy-blue-dark opacity-5 pointer-events-none" />
      
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center shadow-md">
            <span className="text-accent-foreground font-bold text-2xl">D</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">DeutschFlow</h1>
        </div>

        {/* Card */}
        <div className="card p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">{t('loginTitle')}</h2>
            <p className="text-muted-foreground">Tiếp tục hành trình học tiếng Đức của bạn</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">{t('email')}</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className={`input ${fieldErrors.email ? 'border-destructive focus:ring-destructive' : ''}`}
                placeholder="student@deutschflow.com"
              />
              {fieldErrors.email && (
                <p className="mt-2 text-sm text-destructive flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label className="label">{t('password')}</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className={`input ${fieldErrors.password ? 'border-destructive focus:ring-destructive' : ''}`}
                placeholder="••••••••"
              />
              {fieldErrors.password && (
                <p className="mt-2 text-sm text-destructive flex items-center gap-1">
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
                  Đang đăng nhập...
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

          {/* Demo Accounts Info */}
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-xs font-semibold text-foreground mb-2">Tài khoản demo:</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>• student@deutschflow.com</p>
              <p>• teacher@deutschflow.com</p>
              <p>• admin@deutschflow.com</p>
              <p className="mt-2 font-medium">Password: <code className="bg-background px-2 py-0.5 rounded">password123</code></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
