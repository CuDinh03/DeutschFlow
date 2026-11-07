'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { toast } from 'sonner'
import { Lock } from 'lucide-react'
import api from '@/lib/api'
import { GaCap, GaBtn } from '@/components/ui-v2'
import { GaAuthShell, GaField, GaOtpField, AuthErrorBanner, EMAIL_RE, pwStrength, fmtCountdown } from '../authShared'

// ─────────────────────────────────────────────────────────────────────────────
// Quên mật khẩu (/v2/forgot-password) — ba bước, theo trang mẫu owner chọn 08/11/2026:
//   1 · email     POST /auth/forgot-password { email } → 204 LUÔN LUÔN (chống dò email).
//   2 · mã        chỉ ở client: nhập 6 số rồi "Tiếp tục" (backend không có bước kiểm mã riêng).
//   3 · mật khẩu  POST /auth/reset-password { email, code, newPassword } → 204.
//                 400 extensions.code = RESET_CODE_INVALID cho MỌI kiểu mã hỏng (sai/đã dùng/hết hạn/
//                 tài khoản không còn) ⇒ một câu chung + "Nhập lại mã". 400 khác = luật mật khẩu (detail).
//
// CHỐNG DÒ EMAIL — người lạ không được biết một email đã đăng ký hay chưa:
//   • Bước 2 hiện y hệt với mọi email; câu chữ luôn là "Nếu … có tài khoản".
//   • Lỗi mã luôn là một câu, không theo `detail` của backend.
//   • Gửi lại có đếm ngược như nhau; backend gửi thư chạy nền nên thời gian trả lời cũng như nhau.
//
// Không truyền email qua query string (không rải email vào URL/lịch sử/referrer, khỏi phải bọc
// useSearchParams trong <Suspense>): cả ba bước là state của MỘT component.
// ─────────────────────────────────────────────────────────────────────────────

type FieldErrors = Record<string, string>
type Step = 'request' | 'code' | 'password'
const CODE_LEN = 6
/** Khớp trần gửi lại phía server theo cảm nhận người dùng; server vẫn tự giới hạn (429). */
const RESEND_COOLDOWN_S = 60
const STEP_NO: Record<Step, number> = { request: 1, code: 2, password: 3 }

type ApiErr = { response?: { status?: number; data?: { detail?: string; extensions?: { code?: string } } } }

export default function V2ForgotPasswordPage() {
  const t = useTranslations('v2.auth')
  const router = useRouter()
  const [step, setStep] = useState<Step>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errs, setErrs] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [codeRejected, setCodeRejected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sentAt, setSentAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const st = pwStrength(pw)

  useEffect(() => {
    if (step !== 'code') return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [step])

  const resendLeft = Math.max(0, Math.ceil((sentAt + RESEND_COOLDOWN_S * 1000 - now) / 1000))

  const requestCode = async (): Promise<boolean> => {
    try {
      await api.post('/auth/forgot-password', { email: email.trim() })
      setSentAt(Date.now())
      setNow(Date.now())
      return true
    } catch (err: unknown) {
      // 204 kể cả khi email không tồn tại → lỗi ở đây chỉ có thể là rate-limit (429) hoặc sự cố mạng.
      const status = (err as ApiErr)?.response?.status
      setError(status === 429 ? t('forgot.tooMany') : t('forgot.requestFailed'))
      return false
    }
  }

  const sendCode = async () => {
    if (loading) return
    const e: FieldErrors = {}
    if (!email.trim()) e.email = t('forgot.emailRequired')
    else if (!EMAIL_RE.test(email.trim())) e.email = t('forgot.emailInvalid')
    setErrs(e)
    if (Object.keys(e).length) return
    setLoading(true)
    setError('')
    if (await requestCode()) setStep('code')
    setLoading(false)
  }

  const resend = async () => {
    if (loading || resendLeft > 0) return
    setLoading(true)
    setError('')
    setCodeRejected(false)
    if (await requestCode()) {
      setCode('')
      toast.success(t('forgot.resent'))
    }
    setLoading(false)
  }

  const toPassword = (value = code) => {
    if (!value) { setErrs({ code: t('forgot.codeRequired') }); return }
    if (value.length !== CODE_LEN) { setErrs({ code: t('forgot.codeInvalid') }); return }
    setErrs({})
    setError('')
    setCodeRejected(false)
    setStep('password')
  }

  const backToCode = () => {
    setStep('code')
    setCode('')
    setError('')
    setCodeRejected(false)
    setErrs({})
  }

  const switchEmail = () => {
    setStep('request')
    setCode(''); setPw(''); setConfirm('')
    setErrs({}); setError(''); setCodeRejected(false)
  }

  const resetPassword = async () => {
    if (loading) return
    const e: FieldErrors = {}
    if (!pw) e.pw = t('forgot.newPasswordRequired')
    else if (pw.length < 8) e.pw = t('forgot.newPasswordTooShort')
    if (pw !== confirm) e.confirm = t('forgot.confirmMismatch')
    setErrs(e)
    if (Object.keys(e).filter((k) => e[k]).length) return

    setLoading(true)
    setError('')
    setCodeRejected(false)
    try {
      await api.post('/auth/reset-password', { email: email.trim(), code, newPassword: pw })
      toast.success(t('forgot.success'))
      // Backend KHÔNG cấp token ở endpoint này → phải đăng nhập lại bằng mật khẩu mới.
      router.replace('/v2/login')
    } catch (err: unknown) {
      const resp = (err as ApiErr)?.response
      if (resp?.data?.extensions?.code === 'RESET_CODE_INVALID') setCodeRejected(true)
      else if (resp?.status === 429) setError(t('forgot.tooMany'))
      else setError(resp?.data?.detail ?? t('forgot.resetFailed'))
      setLoading(false)
    }
  }

  const bold = (chunks: React.ReactNode) => <strong className="font-semibold text-ga-ink">{chunks}</strong>
  const title =
    step === 'request' ? t('forgot.requestTitle') : step === 'code' ? t('forgot.codeTitle') : t('forgot.resetTitle')

  return (
    <GaAuthShell>
      <GaCap className="mb-3 block">{t('forgot.capStep', { step: STEP_NO[step] })}</GaCap>
      <h1 className="m-0 mb-3 font-ga-display text-ga-h1-m text-ga-ink sm:text-ga-h1 lg:text-ga-display">{title}</h1>
      <p className="m-0 mb-7 break-words text-ga-body-lg text-ga-muted" role={step === 'code' ? 'status' : undefined}>
        {step === 'request' && t('forgot.requestSubtitle')}
        {step === 'code' && t.rich('forgot.sentNotice', { email: email.trim(), b: bold })}
        {step === 'password' && t('forgot.resetSubtitle')}
      </p>

      {error && <AuthErrorBanner><strong>{error}</strong></AuthErrorBanner>}

      {/* Mỗi bước là một <form> + nút type="submit": gõ xong bấm Enter là chạy, như mọi form đăng nhập.
          `noValidate` để câu lỗi (đã i18n) của ta hiện, không phải bong bóng validation native. */}
      {step === 'request' && (
        <form onSubmit={(e) => { e.preventDefault(); void sendCode() }} noValidate>
          <GaField
            name="email"
            label={t('forgot.emailLabel')}
            type="email"
            placeholder={t('forgot.emailPlaceholder')}
            autoComplete="email"
            value={email}
            onChange={(v) => { setEmail(v); setErrs((x) => ({ ...x, email: '' })) }}
            error={errs.email}
            required
          />
          <GaBtn type="submit" variant="yellow" size="lg" className="mt-1 w-full" loading={loading} disabled={loading}>
            {loading ? t('forgot.sending') : t('forgot.sendCode')}
          </GaBtn>
          <div className="mt-6 flex items-start gap-2.5 rounded-ga border border-ga-line bg-ga-card px-4 py-3.5 text-ga-caption leading-relaxed text-ga-muted">
            <Lock size={16} aria-hidden className="mt-0.5 shrink-0" />
            <span>{t('forgot.privacyNote')}</span>
          </div>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={(e) => { e.preventDefault(); toPassword() }} noValidate>
          <GaOtpField
            name="code"
            label={t('forgot.codeLabel')}
            value={code}
            onChange={(digits) => { setCode(digits); setErrs({}) }}
            onComplete={(digits) => toPassword(digits)}
            error={errs.code}
            autoFocus
          />
          <GaBtn type="submit" variant="yellow" size="lg" className="w-full" disabled={loading}>
            {t('forgot.continue')}
          </GaBtn>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-ga-small">
            <button
              type="button"
              onClick={resend}
              disabled={loading || resendLeft > 0}
              className="ga-ui min-h-[40px] text-ga-muted underline transition-colors hover:text-ga-ink disabled:no-underline disabled:opacity-70 lg:min-h-0"
            >
              {resendLeft > 0 ? t('forgot.resendIn', { time: fmtCountdown(resendLeft) }) : t('forgot.resend')}
            </button>
            <button
              type="button"
              onClick={switchEmail}
              disabled={loading}
              className="ga-ui min-h-[40px] text-ga-muted underline transition-colors hover:text-ga-ink disabled:opacity-50 lg:min-h-0"
            >
              {t('forgot.changeEmail')}
            </button>
          </div>
          <p className="m-0 mt-8 border-t border-ga-line pt-5 text-ga-caption leading-relaxed text-ga-muted">
            {t.rich('forgot.noMailHint', {
              link: (chunks) => <Link href="/v2/register" className="font-semibold text-ga-ink underline">{chunks}</Link>,
            })}
          </p>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={(e) => { e.preventDefault(); void resetPassword() }} noValidate>
          {codeRejected && (
            <AuthErrorBanner>
              <strong>{t('forgot.codeRejected')}</strong>{' '}
              <button type="button" onClick={backToCode} className="ga-ui font-semibold text-ga-ink underline">
                {t('forgot.reenterCode')}
              </button>{' '}
              {t('forgot.orResend')}
            </AuthErrorBanner>
          )}
          <GaField
            name="new-password"
            label={t('forgot.newPasswordLabel')}
            type="password"
            placeholder={t('forgot.newPasswordPlaceholder')}
            autoComplete="new-password"
            value={pw}
            onChange={(v) => { setPw(v); setErrs((x) => ({ ...x, pw: '' })) }}
            error={errs.pw}
            required
          />
          {st && !errs.pw && (
            <div className="-mt-2 mb-4">
              <div className="mb-1.5 flex gap-1.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-1 flex-1 transition-colors" style={{ background: i <= st.score ? st.color : 'var(--ga-line)' }} />
                ))}
              </div>
              <div className="text-ga-caption text-ga-muted">
                {t('strength.label')}: <strong style={{ color: st.color }}>{t(`strength.${st.labelKey}`)}</strong>
              </div>
            </div>
          )}
          <GaField
            name="confirm-password"
            label={t('forgot.confirmLabel')}
            type="password"
            placeholder={t('forgot.confirmPlaceholder')}
            autoComplete="new-password"
            value={confirm}
            onChange={(v) => { setConfirm(v); setErrs((x) => ({ ...x, confirm: '' })) }}
            error={errs.confirm || (confirm && pw !== confirm ? t('forgot.confirmMismatch') : undefined)}
            required
          />
          <GaBtn type="submit" variant="yellow" size="lg" className="mt-1 w-full" loading={loading} disabled={loading}>
            {loading ? t('forgot.submitting') : t('forgot.submit')}
          </GaBtn>
        </form>
      )}

      <div className="mt-8 text-center text-ga-body">
        <Link href="/v2/login" className="font-bold text-ga-ink underline">
          {t('forgot.backToLogin')}
        </Link>
      </div>
    </GaAuthShell>
  )
}
