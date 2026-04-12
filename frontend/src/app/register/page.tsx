'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'

type FieldErrors = Record<string, string>

export default function RegisterPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '', displayName: '', locale: 'vi' })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setFieldErrors({})
    try {
      const { data } = await api.post('/auth/register', form)
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      router.push('/dashboard')
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { detail?: string; errors?: FieldErrors } } })?.response?.data
      if (res?.errors) setFieldErrors(res.errors)
      else setError(res?.detail ?? 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const field = (name: keyof typeof form, label: string, type = 'text') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        required
        value={form[name]}
        onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors[name] ? 'border-red-400' : 'border-gray-300'}`}
      />
      {fieldErrors[name] && <p className="mt-1 text-xs text-red-600">{fieldErrors[name]}</p>}
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('registerTitle')}</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {field('displayName', t('displayName'))}
          {field('email', t('email'), 'email')}
          {field('password', t('password'), 'password')}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ giao diện</label>
            <select
              value={form.locale}
              onChange={e => setForm(f => ({ ...f, locale: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? '...' : t('register')}
          </button>
        </form>

        <p className="mt-4 text-sm text-center text-gray-600">
          {t('hasAccount')}{' '}
          <Link href="/login" className="text-blue-500 hover:underline font-medium">
            {t('login')}
          </Link>
        </p>
      </div>
    </div>
  )
}
