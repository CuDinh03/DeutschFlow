'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import api from '@/lib/api'
import { setTokens } from '@/lib/authSession'
import { useUserStore } from '@/stores/useUserStore'
import { useTracking } from '@/hooks/useTracking'
import { GaCap, GaBtn } from '@/components/ui-v2'
import { GaAuthShell, GaField, AuthErrorBanner, EMAIL_RE, pwStrength } from '../authShared'

// ─────────────────────────────────────────────────────────────────────────────
// Đăng ký (GaRegister) — Galerie 2.0 reskin of /register. Plumbing reused 1:1
// (zero backend): POST /auth/register → setTokens + setOrg + locale cookie →
// GET /auth/me → role redirect. Self-register users are STUDENT → land on the
// real onboarding funnel, ported to /v2/onboarding (5 bước value-first: trình độ →
// động lực → nhịp học → quick win/placement → mentor). Trước đây chỗ này đá sang
// /onboarding của v1 — chính là deep-link ngược cuối cùng của luồng đăng ký.
//
// Field map (Option-1): the proto's Họ/Tên → real `displayName` (joined); the
// backend ALSO requires `phoneNumber` (VN format) + `locale`, so those are added
// in proto style rather than omitted (can't drop a required field).
//
// Chuỗi hiển thị: next-intl ('v2.auth.register.…') — /register legacy có 3 thứ tiếng, bản v2 này
// hard-code tiếng Việt, nên phải dịch trước khi xoá v1 (nếu không, EN/DE mất bản dịch).
// Link Điều khoản/Bảo mật trước đây là href="#" (chết) dù /terms và /privacy đã tồn tại → nối thật.
// Nút "Đăng nhập với Google" đã gỡ khỏi authShared: backend không có endpoint OAuth.
// ─────────────────────────────────────────────────────────────────────────────

type FieldErrors = Record<string, string>
const PHONE_RE = /^0[35789]\d{8}$/

export default function V2RegisterPage() {
  const t = useTranslations('v2.auth')
  const router = useRouter()
  const { trackEvent, identifyUser } = useTracking()
  const setOrg = useUserStore((s) => s.setOrg)
  // Mặc định ô "ngôn ngữ" = ngôn ngữ ĐANG hiển thị, không phải 'vi' cứng. GaAuthShell nay có
  // LanguageToggle, nên khách EN/DE đổi giao diện rồi đăng ký: nếu vẫn gửi locale='vi' thì tài khoản
  // bị ghim tiếng Việt, và ngay dòng dưới ta lại ghi đè cookie `locale=vi` → giao diện lật về tiếng
  // Việt ngay sau khi đăng ký. Người dùng vẫn đổi được bằng tay ở select.
  const initialLocale = useLocale()
  const [f, setF] = useState({ first: '', last: '', email: '', phone: '', pw: '', locale: initialLocale })
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
    if (!f.phone.trim()) e.phone = t('register.phoneRequired')
    else if (!PHONE_RE.test(f.phone)) e.phone = t('register.phoneInvalid')
    if (!f.pw) e.pw = t('register.passwordRequired')
    else if (f.pw.length < 8) e.pw = t('register.passwordTooShort')
    setErrs(e)
    if (Object.keys(e).filter((k) => e[k]).length) return

    setLoading(true)
    setError('')
    trackEvent('register_started', { locale: f.locale })
    try {
      const displayName = `${f.first.trim()} ${f.last.trim()}`.trim()
      const { data } = await api.post('/auth/register', {
        email: f.email.trim(),
        phoneNumber: f.phone.trim(),
        password: f.pw,
        displayName,
        locale: f.locale,
      })
      setTokens(data)
      setOrg({ orgId: data.orgId ?? null, orgRole: data.orgRole ?? null })
      if (['vi', 'en', 'de'].includes(f.locale)) {
        document.cookie = `locale=${f.locale};path=/;max-age=31536000;SameSite=Lax`
      }

      const { data: user } = await api.get('/auth/me')
      switch (user.role) {
        case 'ADMIN':
          router.replace('/v2/admin/users')
          break
        case 'TEACHER':
          router.replace('/v2/teacher')
          break
        case 'STUDENT':
        default:
          // Self-register = STUDENT → the onboarding funnel, now on v2 (/v2/onboarding). A guest who
          // ran the funnel BEFORE signing up left a draft in localStorage; that page replays it here.
          router.replace('/v2/onboarding')
          break
      }

      identifyUser(String(user.userId), {
        email: user.email, name: user.displayName, role: user.role, locale: user.locale,
        created_at: new Date().toISOString(),
      })
      trackEvent('register_success', { role: user.role, locale: f.locale })
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { detail?: string; errors?: FieldErrors } } })?.response?.data
      if (res?.errors) setErrs(res.errors)
      else {
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
          <GaField label={t('register.familyNameLabel')} placeholder={t('register.familyNamePlaceholder')} autoComplete="family-name" value={f.first} onChange={(v) => set('first', v)} error={errs.first} required />
          <GaField label={t('register.givenNameLabel')} placeholder={t('register.givenNamePlaceholder')} autoComplete="given-name" value={f.last} onChange={(v) => set('last', v)} error={errs.last} required />
        </div>
        <GaField label={t('register.emailLabel')} type="email" placeholder={t('register.emailPlaceholder')} autoComplete="email" value={f.email} onChange={(v) => set('email', v)} error={errs.email} required />
        <GaField
          label={t('register.phoneLabel')}
          type="tel"
          placeholder={t('register.phonePlaceholder')}
          autoComplete="tel"
          value={f.phone}
          onChange={(v) => set('phone', v)}
          error={errs.phone}
          hint={t('register.phoneHint')}
          required
        />
        <GaField
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

        {/* Locale — backend stores it on the account; mirrors the legacy register select. */}
        <div className="mb-4">
          <label className="ga-ui mb-[7px] block text-[13px] font-semibold text-ga-ink">{t('register.localeLabel')}</label>
          <select
            value={f.locale}
            onChange={(e) => set('locale', e.target.value)}
            className="ga-ui block w-full rounded-ga border border-ga-line bg-ga-card px-[15px] py-3 text-[15px] text-ga-ink outline-none"
          >
            {/* Tên ngôn ngữ luôn viết bằng chính ngôn ngữ đó (endonym) — không dịch. */}
            <option value="vi">🇻🇳 Tiếng Việt</option>
            <option value="en">🇬🇧 English</option>
            <option value="de">🇩🇪 Deutsch</option>
          </select>
        </div>

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
