'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { toast } from 'sonner'
import api from '@/lib/api'
import { clearGuestSessionCache } from '@/lib/guestSessionStore'
import { useTracking } from '@/hooks/useTracking'
import { GaCap, GaBtn } from '@/components/ui-v2'
import { GaAuthShell, GaOtpField, AuthErrorBanner, fmtCountdown, MAIL_SENDER } from '../authShared'
import { readPendingSignup, savePendingSignup, useCompleteSignup, type PendingSignupDraft } from '../authSignup'

// ─────────────────────────────────────────────────────────────────────────────
// Nhập mã xác minh đăng ký (/v2/verify-email) — thiết kế mã PIN 05/11 §7.1.
//   POST /auth/register/verify { email, code } → 201 AuthResponse (y hệt /auth/register) → onboarding
//       400 extensions.reason: INVALID_CODE (+ remainingAttempts) | LOCKED | EXPIRED · 409 · 429
//   POST /auth/register/resend { email }       → 204 LUÔN LUÔN
// Trang công khai (middleware không chặn), KHÔNG thuộc LOGIN_ROUTES. Email đọc từ sessionStorage do
// /v2/register ghi; không có thì đưa về form đăng ký. Giao diện không hiện mã máy (`reason`), chỉ chọn câu.
// Giao diện: mẫu "A · Sáu ô tách rời" owner chọn 08/11/2026 (GaOtpField).
// ─────────────────────────────────────────────────────────────────────────────

const CODE_LEN = 6

type VerifyError = {
  response?: {
    status?: number
    data?: { detail?: string; extensions?: { reason?: string; remainingAttempts?: number } }
  }
}

export default function V2VerifyEmailPage() {
  const t = useTranslations('v2.auth')
  const router = useRouter()
  const { trackEvent } = useTracking()
  const completeSignup = useCompleteSignup()
  const [draft, setDraft] = useState<PendingSignupDraft | null>(null)
  const [ready, setReady] = useState(false)
  const [code, setCode] = useState('')
  const [codeErr, setCodeErr] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const lastSubmitted = useRef('')

  // Rời trang mà chưa xác minh (và không phải "Đổi email") ⇒ vứt phiên khách, cùng luật với /v2/register.
  const keepGuestRef = useRef(false)
  useEffect(
    () => () => {
      if (!keepGuestRef.current) clearGuestSessionCache()
    },
    [],
  )

  useEffect(() => {
    setDraft(readPendingSignup())
    setReady(true)
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const resendLeft = draft
    ? Math.max(0, Math.ceil((draft.sentAt + draft.resendAfterSeconds * 1000 - now) / 1000))
    : 0

  const verify = async (value: string) => {
    if (loading || !draft) return
    if (value.length !== CODE_LEN) {
      setCodeErr(t('verify.codeInvalid'))
      return
    }
    lastSubmitted.current = value
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/auth/register/verify', { email: draft.email, code: value })
      trackEvent('register_code_verified', { locale: draft.locale })
      await completeSignup(data, draft.locale, () => { keepGuestRef.current = true })
    } catch (err: unknown) {
      const resp = (err as VerifyError)?.response
      const reason = resp?.data?.extensions?.reason
      const remaining = resp?.data?.extensions?.remainingAttempts
      trackEvent('register_code_failed', { reason: reason ?? String(resp?.status ?? 'network') })
      if (resp?.status === 429) setError(t('verify.tooMany'))
      else if (resp?.status === 409) setError(t('verify.accountExists'))
      else if (reason === 'LOCKED') setError(t('verify.locked'))
      else if (reason === 'EXPIRED') setError(t('verify.expired'))
      else if (typeof remaining === 'number') setError(t('verify.wrongWithRemaining', { count: remaining }))
      else setError(t('verify.wrong'))
      setCode('')
      setLoading(false)
    }
  }

  const resend = async () => {
    if (loading || !draft || resendLeft > 0) return
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/register/resend', { email: draft.email })
      const next = { ...draft, sentAt: Date.now() }
      savePendingSignup(next)
      setDraft(next)
      setCode('')
      lastSubmitted.current = ''
      trackEvent('register_code_resent', { locale: draft.locale })
      toast.success(t('verify.resent', { email: draft.email }))
    } catch (err: unknown) {
      const status = (err as VerifyError)?.response?.status
      setError(status === 429 ? t('verify.tooMany') : t('verify.resendFailed'))
    } finally {
      setLoading(false)
    }
  }

  const changeEmail = () => {
    keepGuestRef.current = true
    router.push('/v2/register')
  }

  if (ready && !draft) {
    return (
      <GaAuthShell>
        <GaCap className="mb-3 block">{t('verify.cap')}</GaCap>
        <h1 className="m-0 mb-2 font-ga-display text-ga-h1-m text-ga-ink sm:text-ga-h1">
          {t('verify.missingTitle')}
        </h1>
        <p className="m-0 mb-7 text-ga-body-lg text-ga-muted">{t('verify.missingBody')}</p>
        <Link href="/v2/register" className="font-bold text-ga-ink underline">{t('verify.backToRegister')}</Link>
      </GaAuthShell>
    )
  }

  const bold = (chunks: React.ReactNode) => <strong className="font-semibold text-ga-ink">{chunks}</strong>

  return (
    <GaAuthShell>
      <GaCap className="mb-3 block">{t('verify.cap')}</GaCap>
      <h1 className="m-0 mb-3 font-ga-display text-ga-h1-m text-ga-ink sm:text-ga-h1 lg:text-ga-display">
        {t('verify.title')}
      </h1>
      {draft && (
        <p className="m-0 mb-7 break-words text-ga-body-lg text-ga-muted" role="status">
          {t.rich('verify.sentTo', { email: draft.email, minutes: Math.round(draft.expiresInSeconds / 60), b: bold })}
        </p>
      )}

      {error && <AuthErrorBanner><strong>{error}</strong></AuthErrorBanner>}

      <form onSubmit={(e) => { e.preventDefault(); void verify(code) }} noValidate>
        <GaOtpField
          name="code"
          label={t('verify.codeLabel')}
          value={code}
          // Đủ 6 số (gõ hoặc dán) là tự gửi, nhưng không gửi lại đúng mã vừa bị từ chối.
          onChange={(digits) => { setCode(digits); setCodeErr('') }}
          onComplete={(digits) => { if (digits !== lastSubmitted.current) void verify(digits) }}
          error={codeErr}
          disabled={loading}
          autoFocus
        />
        <GaBtn type="submit" variant="yellow" size="lg" className="w-full" loading={loading} disabled={loading}>
          {loading ? t('verify.submitting') : t('verify.submit')}
        </GaBtn>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-ga-small">
          <button
            type="button"
            onClick={resend}
            disabled={loading || resendLeft > 0}
            className="ga-ui min-h-[40px] text-ga-muted underline transition-colors hover:text-ga-ink disabled:no-underline disabled:opacity-70 lg:min-h-0"
          >
            {resendLeft > 0 ? t('verify.resendIn', { time: fmtCountdown(resendLeft) }) : t('verify.resend')}
          </button>
          <button
            type="button"
            onClick={changeEmail}
            disabled={loading}
            className="ga-ui min-h-[40px] text-ga-muted underline transition-colors hover:text-ga-ink disabled:opacity-50 lg:min-h-0"
          >
            {t('verify.changeEmail')}
          </button>
        </div>
      </form>

      <p className="m-0 mt-8 border-t border-ga-line pt-5 text-ga-caption leading-relaxed text-ga-muted">
        {t.rich('verify.spamHint', { sender: MAIL_SENDER, b: bold })}
      </p>
    </GaAuthShell>
  )
}
