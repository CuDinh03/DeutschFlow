'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'
import api from '@/lib/api'
import { GaCap, GaBtn } from '@/components/ui-v2'
import { GaAuthShell, GaField, AuthErrorBanner, EMAIL_RE, pwStrength } from '../authShared'

// ─────────────────────────────────────────────────────────────────────────────
// Quên mật khẩu (/v2/forgot-password) — MỚI trên web. Trước đây /v2/login chỉ toast "sắp ra mắt",
// dù backend đã có sẵn hai endpoint (AuthController):
//   POST /auth/forgot-password { email }                    → 204 LUÔN LUÔN (chống dò email:
//       không lộ việc email có tồn tại hay không) → không được suy ra gì từ mã 204.
//   POST /auth/reset-password  { email, code, newPassword } → 204; code = 6 chữ số, TTL 15 phút.
// Luồng/validation bám đúng bản mobile đã chạy thật (mobile/app/(auth)/forgot-password.tsx +
// reset-password.tsx) để hai client không lệch nhau: 6 chữ số, mật khẩu ≥ 8 ký tự, nhập lại khớp.
//
// Hai bước nằm trong CÙNG một component (state `step`), không truyền email qua query string:
//   1) tránh useSearchParams() → khỏi phải bọc <Suspense> (nếu không, Next chỉ prerender được
//      fallback và trang chớp trắng),
//   2) không rải địa chỉ email của người dùng vào URL/lịch sử trình duyệt/referrer.
// ─────────────────────────────────────────────────────────────────────────────

type FieldErrors = Record<string, string>
const CODE_LEN = 6

function apiDetail(err: unknown): string | undefined {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
}

export default function V2ForgotPasswordPage() {
  const t = useTranslations('v2.auth')
  const router = useRouter()
  const [step, setStep] = useState<'request' | 'reset'>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errs, setErrs] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const st = pwStrength(pw)

  const sendCode = async () => {
    if (loading) return
    const e: FieldErrors = {}
    if (!email.trim()) e.email = t('forgot.emailRequired')
    else if (!EMAIL_RE.test(email.trim())) e.email = t('forgot.emailInvalid')
    setErrs(e)
    if (Object.keys(e).length) return

    setLoading(true)
    setError('')
    try {
      await api.post('/auth/forgot-password', { email: email.trim() })
      setStep('reset')
    } catch (err: unknown) {
      // 204 kể cả khi email không tồn tại → lỗi ở đây chỉ có thể là rate-limit (429) hoặc sự cố mạng.
      setError(apiDetail(err) ?? t('forgot.requestFailed'))
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/forgot-password', { email: email.trim() })
      toast.success(t('forgot.sentNotice', { email: email.trim() }))
    } catch (err: unknown) {
      setError(apiDetail(err) ?? t('forgot.requestFailed'))
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async () => {
    if (loading) return
    const e: FieldErrors = {}
    if (!code.trim()) e.code = t('forgot.codeRequired')
    else if (code.trim().length !== CODE_LEN) e.code = t('forgot.codeInvalid')
    if (!pw) e.pw = t('forgot.newPasswordRequired')
    else if (pw.length < 8) e.pw = t('forgot.newPasswordTooShort')
    if (pw !== confirm) e.confirm = t('forgot.confirmMismatch')
    setErrs(e)
    if (Object.keys(e).filter((k) => e[k]).length) return

    setLoading(true)
    setError('')
    try {
      await api.post('/auth/reset-password', { email: email.trim(), code: code.trim(), newPassword: pw })
      toast.success(t('forgot.success'))
      // Backend KHÔNG cấp token ở endpoint này → phải đăng nhập lại bằng mật khẩu mới.
      router.replace('/v2/login')
    } catch (err: unknown) {
      setError(apiDetail(err) ?? t('forgot.resetFailed'))
      setLoading(false)
    }
  }

  return (
    <GaAuthShell>
      <GaCap className="mb-3 block">{t('forgot.cap')}</GaCap>
      <h1 className="m-0 mb-2 font-ga-display text-[26px] font-medium tracking-[-0.015em] text-ga-ink sm:text-[30px] lg:text-[38px]">
        {step === 'request' ? t('forgot.requestTitle') : t('forgot.resetTitle')}
      </h1>
      <p className="m-0 mb-7 text-[15px] text-ga-muted">
        {step === 'request' ? t('forgot.requestSubtitle') : t('forgot.resetSubtitle')}
      </p>

      {error && <AuthErrorBanner><strong>{error}</strong></AuthErrorBanner>}

      {/* Mỗi bước là một <form> riêng + nút type="submit": người dùng gõ email/mã rồi bấm Enter là
          hành vi mặc định của mọi form đăng nhập — /login legacy cũng là form thật. Không có <form>
          thì Enter không làm gì cả. `noValidate` để thông báo lỗi (đã i18n) của ta chạy, không phải
          bong bóng validation native. */}
      {step === 'request' ? (
        <form onSubmit={(e) => { e.preventDefault(); void sendCode() }} noValidate>
          <GaField
            label={t('forgot.emailLabel')}
            type="email"
            placeholder={t('forgot.emailPlaceholder')}
            autoComplete="email"
            value={email}
            onChange={(v) => { setEmail(v); setErrs((x) => ({ ...x, email: '' })) }}
            error={errs.email}
            required
          />
          <GaBtn type="submit" variant="yellow" size="lg" className="mb-4 mt-1 w-full" loading={loading} disabled={loading}>
            {loading ? t('forgot.sending') : t('forgot.sendCode')}
          </GaBtn>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void resetPassword() }} noValidate>
          <div
            className="mb-5 flex items-start gap-2.5 rounded-ga px-4 py-3.5"
            style={{ background: 'var(--ga-green-soft)', border: '1px solid color-mix(in srgb, var(--ga-green) 35%, transparent)' }}
            role="status"
          >
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ga-green" />
            <div className="min-w-0 flex-1 break-words text-[13.5px] leading-relaxed text-ga-ink">
              {t('forgot.sentNotice', { email: email.trim() })}
            </div>
          </div>

          <GaField
            label={t('forgot.codeLabel')}
            placeholder={t('forgot.codePlaceholder')}
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={CODE_LEN}
            value={code}
            // Chỉ giữ chữ số + cắt đúng 6 ký tự ngay khi gõ (khớp bản mobile): backend @Size(min=6,max=6).
            onChange={(v) => { setCode(v.replace(/\D/g, '').slice(0, CODE_LEN)); setErrs((x) => ({ ...x, code: '' })) }}
            error={errs.code}
            required
          />
          <GaField
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
              <div className="text-[12px] text-ga-muted">
                {t('strength.label')}: <strong style={{ color: st.color }}>{t(`strength.${st.labelKey}`)}</strong>
              </div>
            </div>
          )}
          <GaField
            label={t('forgot.confirmLabel')}
            type="password"
            placeholder={t('forgot.confirmPlaceholder')}
            autoComplete="new-password"
            value={confirm}
            onChange={(v) => { setConfirm(v); setErrs((x) => ({ ...x, confirm: '' })) }}
            error={errs.confirm || (confirm && pw !== confirm ? t('forgot.confirmMismatch') : undefined)}
            required
          />

          <GaBtn type="submit" variant="yellow" size="lg" className="mb-3 mt-1 w-full" loading={loading} disabled={loading}>
            {loading ? t('forgot.submitting') : t('forgot.submit')}
          </GaBtn>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13.5px] lg:flex-nowrap lg:gap-0">
            <button
              type="button"
              onClick={resend}
              disabled={loading}
              className="ga-ui min-h-[40px] text-ga-muted underline transition-colors hover:text-ga-ink disabled:opacity-50 lg:min-h-0"
            >
              {t('forgot.resend')}
            </button>
            <button
              type="button"
              onClick={() => { setStep('request'); setCode(''); setPw(''); setConfirm(''); setErrs({}); setError('') }}
              disabled={loading}
              className="ga-ui min-h-[40px] text-ga-muted underline transition-colors hover:text-ga-ink disabled:opacity-50 lg:min-h-0"
            >
              {t('forgot.changeEmail')}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 text-center text-[14px] text-ga-muted">
        <Link href="/v2/login" className="font-bold text-ga-ink underline">
          {t('forgot.backToLogin')}
        </Link>
      </div>
    </GaAuthShell>
  )
}
