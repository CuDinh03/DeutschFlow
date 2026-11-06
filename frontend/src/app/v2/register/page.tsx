'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import api from '@/lib/api'
import { clearGuestSessionCache } from '@/lib/guestSessionStore'
import { isValidVnPhone, normalizeVnPhone } from '@/lib/vnPhone'
import { useTracking } from '@/hooks/useTracking'
import { GaCap, GaBtn } from '@/components/ui-v2'
import { GaAuthShell, GaField, AuthErrorBanner, EMAIL_RE, pwStrength } from '../authShared'
import { readPendingSignup, savePendingSignup, useCompleteSignup, type RegisterPayload } from '../authSignup'

// ─────────────────────────────────────────────────────────────────────────────
// Đăng ký (GaRegister) — Galerie 2.0 reskin of /register. Plumbing reused 1:1
// (zero backend): POST /auth/register → setTokens + setOrg + locale cookie →
// GET /auth/me → role redirect. Self-register users are STUDENT → land on the
// real onboarding funnel, ported to /v2/onboarding (5 bước value-first: trình độ →
// động lực → nhịp học → quick win/placement → mentor). Trước đây chỗ này đá sang
// /onboarding của v1 — chính là deep-link ngược cuối cùng của luồng đăng ký.
//
// Field map (Option-1): the proto's Họ/Tên → real `displayName` (joined).
// 18/10/2026 (đợt 0): `phoneNumber` KHÔNG bắt buộc ở backend (RegisterRequest: `^$|` + AuthService
// lưu NULL khi trống, App Store 5.1.1(v)) — form trước bắt buộc chặt hơn backend, làm khách bỏ dở ở
// bước đăng ký. Nay ô số điện thoại là tuỳ chọn, chỉ kiểm định dạng khi có nhập. Ô chọn `locale` đã gỡ:
// gửi đúng ngôn ngữ đang hiển thị (khách đổi bằng LanguageToggle trên header nếu muốn).
//
// Chuỗi hiển thị: next-intl ('v2.auth.register.…') — /register legacy có 3 thứ tiếng, bản v2 này
// hard-code tiếng Việt, nên phải dịch trước khi xoá v1 (nếu không, EN/DE mất bản dịch).
// Link Điều khoản/Bảo mật trước đây là href="#" (chết) dù /terms và /privacy đã tồn tại → nối thật.
// Nút "Đăng nhập với Google" đã gỡ khỏi authShared: backend không có endpoint OAuth.
//
// 06/11/2026 — xác nhận mã PIN (plans/2026-11-05-thiet-ke-ma-pin-xac-nhan-dang-ky.md §7.1): form gọi
// POST /auth/register/start trước. 202 ⇒ CHƯA có tài khoản, mã đã gửi tới email ⇒ sang /v2/verify-email
// (form giữ trong sessionStorage, KHÔNG giữ mật khẩu). 501 ⇒ công tắc backend đang tắt ⇒ lùi về
// POST /auth/register cũ y như trước. Nhánh thành công dùng chung useCompleteSignup() với trang nhập mã.
// ─────────────────────────────────────────────────────────────────────────────

type FieldErrors = Record<string, string>

export default function V2RegisterPage() {
  // Đợt 2 onboarding (17/09): rời màn này mà CHƯA đăng ký xong thì vứt con trỏ phiên khách trên máy —
  // khách A bỏ dở ở đây, B đăng ký sau trên cùng máy không được claim phiên (câu trả lời) của A.
  // Cùng luật với draft (mobile register.tsx đã làm từ F-3). Phiên trên server tự hết hạn 72 h.
  const signedUpRef = useRef(false)
  useEffect(
    () => () => {
      if (!signedUpRef.current) clearGuestSessionCache()
    },
    [],
  )
  const t = useTranslations('v2.auth')
  const router = useRouter()
  const { trackEvent } = useTracking()
  const completeSignup = useCompleteSignup()
  // Mặc định ô "ngôn ngữ" = ngôn ngữ ĐANG hiển thị, không phải 'vi' cứng. GaAuthShell nay có
  // LanguageToggle, nên khách EN/DE đổi giao diện rồi đăng ký: nếu vẫn gửi locale='vi' thì tài khoản
  // bị ghim tiếng Việt, và ngay dòng dưới ta lại ghi đè cookie `locale=vi` → giao diện lật về tiếng
  // Việt ngay sau khi đăng ký. Muốn ngôn ngữ khác thì đổi bằng LanguageToggle trên header.
  const initialLocale = useLocale()
  const [f, setF] = useState({ first: '', last: '', email: '', phone: '', pw: '', locale: initialLocale })
  // "Đổi email" từ trang nhập mã quay về đây: nạp lại phần form đã gõ (trừ mật khẩu — không giữ phía client).
  useEffect(() => {
    const d = readPendingSignup()
    if (d) setF((s) => ({ ...s, first: d.first, last: d.last, email: d.email, phone: d.phone }))
  }, [])
  const [errs, setErrs] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k: keyof typeof f, v: string) => { setF((s) => ({ ...s, [k]: v })); setErrs((e) => ({ ...e, [k]: '' })) }
  const st = pwStrength(f.pw)

  const submit = async () => {
    if (loading) return
    const e: FieldErrors = {}
    if (!f.first.trim()) e.first = t('register.familyNameRequired')
    if (!f.last.trim()) e.last = t('register.givenNameRequired')
    if (!f.email.trim()) e.email = t('register.emailRequired')
    else if (!EMAIL_RE.test(f.email)) e.email = t('register.emailInvalid')
    // Số điện thoại tuỳ chọn: chỉ kiểm khi có nhập. Chuẩn hoá TRƯỚC khi kiểm (F-07/F-08):
    // `0912 345 678` và `+84912345678` là cách người dùng thật vẫn gõ — và cũng là cách autofill
    // trình duyệt chèn. Backend vốn đã `.trim()`, nên form không được phép chặt hơn backend.
    if (f.phone.trim() && !isValidVnPhone(f.phone)) e.phone = t('register.phoneInvalid')
    if (!f.pw) e.pw = t('register.passwordRequired')
    else if (f.pw.length < 8) e.pw = t('register.passwordTooShort')
    setErrs(e)
    if (Object.keys(e).filter((k) => e[k]).length) return

    setLoading(true)
    setError('')
    trackEvent('register_started', { locale: f.locale })
    try {
      const displayName = `${f.first.trim()} ${f.last.trim()}`.trim()
      const payload: RegisterPayload = {
        email: f.email.trim(),
        // Gửi đúng giá trị ĐÃ chuẩn hoá — cùng chuỗi mà isValidVnPhone() vừa chấp nhận. Bỏ trống thì
        // gửi chuỗi rỗng: backend coi rỗng là "không có" và lưu NULL.
        phoneNumber: f.phone.trim() ? normalizeVnPhone(f.phone) : '',
        password: f.pw,
        displayName,
        locale: f.locale,
      }

      let started: { email: string; expiresInSeconds: number; resendAfterSeconds: number } | null = null
      try {
        const { data } = await api.post('/auth/register/start', payload)
        started = data
      } catch (startErr: unknown) {
        // 501 = công tắc mã PIN tắt ở backend ⇒ đường cũ. Lỗi khác (400/429/503) để catch ngoài hiện.
        if ((startErr as { response?: { status?: number } })?.response?.status !== 501) throw startErr
      }

      if (started) {
        savePendingSignup({
          first: f.first, last: f.last, email: started.email, phone: f.phone, locale: f.locale,
          expiresInSeconds: started.expiresInSeconds, resendAfterSeconds: started.resendAfterSeconds,
          sentAt: Date.now(),
        })
        trackEvent('register_code_sent', { locale: f.locale })
        // Vẫn là "đang đăng ký": phiên khách (câu trả lời onboarding) phải sống qua trang nhập mã.
        signedUpRef.current = true
        router.push('/v2/verify-email')
        return
      }

      const { data } = await api.post('/auth/register', payload)
      await completeSignup(data, f.locale, () => { signedUpRef.current = true })
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { detail?: string; errors?: FieldErrors } } })?.response
      const res = resp?.data
      if (res?.errors) setErrs(res.errors)
      else if (resp?.status === 503) {
        // Backend KHÔNG báo "đã gửi" khi chưa gửi được mã — email là lối vào duy nhất.
        setError(t('verify.sendFailed'))
        trackEvent('register_failed', { reason: 'SEND_FAILED' })
      } else {
        setError(res?.detail ?? t('register.failed'))
        trackEvent('register_failed', { reason: res?.detail ?? 'unknown' })
      }
      setLoading(false)
    }
  }

  return (
    <GaAuthShell>
      <GaCap className="mb-3 block">{t('register.cap')}</GaCap>
      <h1 className="m-0 mb-2 font-ga-display text-[26px] font-medium tracking-[-0.015em] text-ga-ink sm:text-[30px] lg:text-[38px]">{t('register.title')}</h1>
      <p className="m-0 mb-7 text-[15px] text-ga-muted">{t('register.subtitle')}</p>

      {error && <AuthErrorBanner><strong>{error}</strong></AuthErrorBanner>}

      {/* <form> + nút type="submit": /register legacy là form thật (onSubmit) → Enter ở ô cuối là gửi
          form, và trình quản lý mật khẩu chỉ đề nghị LƯU mật khẩu khi nó nằm trong một <form> được
          submit. Bản v2 dựng bằng <div> + onClick nên mất cả hai. `noValidate` để validation của TA
          (đã i18n) chạy thay cho bong bóng native của trình duyệt. */}
      <form
        onSubmit={(e) => { e.preventDefault(); void submit() }}
        noValidate
      >
        <div className="grid grid-cols-1 gap-x-[18px] sm:grid-cols-2">
          <GaField name="family-name" label={t('register.familyNameLabel')} placeholder={t('register.familyNamePlaceholder')} autoComplete="family-name" value={f.first} onChange={(v) => set('first', v)} error={errs.first} required />
          <GaField name="given-name" label={t('register.givenNameLabel')} placeholder={t('register.givenNamePlaceholder')} autoComplete="given-name" value={f.last} onChange={(v) => set('last', v)} error={errs.last} required />
        </div>
        <GaField name="email" label={t('register.emailLabel')} type="email" placeholder={t('register.emailPlaceholder')} autoComplete="email" value={f.email} onChange={(v) => set('email', v)} error={errs.email} required />
        <GaField
          name="tel"
          label={t('register.phoneLabel')}
          type="tel"
          placeholder={t('register.phonePlaceholder')}
          autoComplete="tel"
          value={f.phone}
          onChange={(v) => set('phone', v)}
          error={errs.phone}
          hint={t('register.phoneHint')}
        />
        <GaField
          name="new-password"
          label={t('register.passwordLabel')}
          type="password"
          placeholder={t('register.passwordPlaceholder')}
          autoComplete="new-password"
          value={f.pw}
          onChange={(v) => set('pw', v)}
          error={errs.pw}
          hint={st ? undefined : t('register.passwordHint')}
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

        <GaBtn type="submit" variant="yellow" size="lg" className="mb-3.5 mt-1.5 w-full" loading={loading} disabled={loading}>
          {loading ? t('register.submitting') : t('register.submit')}
        </GaBtn>
      </form>

      <p className="mb-4 text-center text-[12px] leading-relaxed text-ga-muted">
        {t.rich('register.terms', {
          terms: (chunks) => <Link href="/terms" className="text-ga-ink underline">{chunks}</Link>,
          privacy: (chunks) => <Link href="/privacy" className="text-ga-ink underline">{chunks}</Link>,
        })}
      </p>

      <div className="mt-6 text-center text-[14px] text-ga-muted">
        {t('register.hasAccount')}{' '}
        <Link href="/v2/login" className="font-bold text-ga-ink underline">
          {t('register.loginCta')}
        </Link>
      </div>
    </GaAuthShell>
  )
}
