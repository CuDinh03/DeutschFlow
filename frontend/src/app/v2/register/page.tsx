'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { setTokens } from '@/lib/authSession'
import { useUserStore } from '@/stores/useUserStore'
import { useTracking } from '@/hooks/useTracking'
import { GaCap, GaBtn } from '@/components/ui-v2'
import { GaAuthShell, GaField, AuthErrorBanner, AuthDivider, GoogleBtn, EMAIL_RE, pwStrength } from '../authShared'

// ─────────────────────────────────────────────────────────────────────────────
// Đăng ký (GaRegister) — Galerie 2.0 reskin of /register. Plumbing reused 1:1
// (zero backend): POST /auth/register → setTokens + setOrg + locale cookie →
// GET /auth/me → role redirect. Self-register users are STUDENT → land on the
// real onboarding funnel (legacy /onboarding; v2 onboarding is deferred — its
// 5-step value-first flow with placement test + mentor doesn't match the proto's
// 3-step demo, so it's not a faithful reskin).
//
// Field map (Option-1): the proto's Họ/Tên → real `displayName` (joined); the
// backend ALSO requires `phoneNumber` (VN format) + `locale`, so those are added
// in proto style rather than omitted (can't drop a required field).
// ─────────────────────────────────────────────────────────────────────────────

type FieldErrors = Record<string, string>
const PHONE_RE = /^0[35789]\d{8}$/

export default function V2RegisterPage() {
  const router = useRouter()
  const { trackEvent, identifyUser } = useTracking()
  const setOrg = useUserStore((s) => s.setOrg)
  const [f, setF] = useState({ first: '', last: '', email: '', phone: '', pw: '', locale: 'vi' })
  const [errs, setErrs] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k: keyof typeof f, v: string) => { setF((s) => ({ ...s, [k]: v })); setErrs((e) => ({ ...e, [k]: '' })) }
  const st = pwStrength(f.pw)

  const submit = async () => {
    if (loading) return
    const e: FieldErrors = {}
    if (!f.first.trim()) e.first = 'Nhập họ'
    if (!f.last.trim()) e.last = 'Nhập tên'
    if (!f.email.trim()) e.email = 'Vui lòng nhập email'
    else if (!EMAIL_RE.test(f.email)) e.email = 'Email không hợp lệ'
    if (!f.phone.trim()) e.phone = 'Vui lòng nhập số điện thoại'
    else if (!PHONE_RE.test(f.phone)) e.phone = 'Số VN 10 chữ số, bắt đầu bằng 03/05/07/08/09'
    if (!f.pw) e.pw = 'Vui lòng nhập mật khẩu'
    else if (f.pw.length < 8) e.pw = 'Mật khẩu cần ít nhất 8 ký tự'
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
          // Self-register = STUDENT → the real onboarding funnel (v2 onboarding deferred).
          router.replace('/onboarding')
          break
      }

      identifyUser(String(user.id), {
        email: user.email, name: user.displayName, role: user.role, locale: user.locale,
        created_at: new Date().toISOString(),
      })
      trackEvent('register_success', { role: user.role, locale: f.locale })
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { detail?: string; errors?: FieldErrors } } })?.response?.data
      if (res?.errors) setErrs(res.errors)
      else {
        setError(res?.detail ?? 'Không tạo được tài khoản. Vui lòng thử lại.')
        trackEvent('register_failed', { reason: res?.detail ?? 'unknown' })
      }
      setLoading(false)
    }
  }

  return (
    <GaAuthShell>
      <GaCap className="mb-3 block">Tạo tài khoản miễn phí</GaCap>
      <h1 className="m-0 mb-2 font-ga-display text-[38px] font-medium tracking-[-0.015em] text-ga-ink">Bắt đầu học tiếng Đức</h1>
      <p className="m-0 mb-7 text-[15px] text-ga-muted">Không cần thẻ tín dụng · 3 buổi phỏng vấn AI miễn phí mỗi tháng.</p>

      {error && <AuthErrorBanner><strong>{error}</strong></AuthErrorBanner>}

      <div className="grid grid-cols-2 gap-x-[18px]">
        <GaField label="Họ" placeholder="Nguyễn" autoComplete="family-name" value={f.first} onChange={(v) => set('first', v)} error={errs.first} required />
        <GaField label="Tên" placeholder="Lan" autoComplete="given-name" value={f.last} onChange={(v) => set('last', v)} error={errs.last} required />
      </div>
      <GaField label="Email" type="email" placeholder="lan@example.com" autoComplete="email" value={f.email} onChange={(v) => set('email', v)} error={errs.email} required />
      <GaField
        label="Số điện thoại"
        type="tel"
        placeholder="0912345678"
        autoComplete="tel"
        value={f.phone}
        onChange={(v) => set('phone', v)}
        error={errs.phone}
        hint="Số VN 10 chữ số, bắt đầu bằng 03/05/07/08/09"
        required
      />
      <GaField
        label="Mật khẩu"
        type="password"
        placeholder="Ít nhất 8 ký tự"
        autoComplete="new-password"
        value={f.pw}
        onChange={(v) => set('pw', v)}
        error={errs.pw}
        hint={st ? undefined : 'Kết hợp chữ hoa, chữ thường và số'}
        required
      />
      {st && !errs.pw && (
        <div className="-mt-2 mb-4">
          <div className="mb-1.5 flex gap-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-1 flex-1 transition-colors" style={{ background: i <= st.score ? st.color : 'var(--ga-line)' }} />
            ))}
          </div>
          <div className="text-[12px] text-ga-muted">Độ mạnh mật khẩu: <strong style={{ color: st.color }}>{st.label}</strong></div>
        </div>
      )}

      {/* Locale — backend stores it on the account; mirrors the legacy register select. */}
      <div className="mb-4">
        <label className="ga-ui mb-[7px] block text-[13px] font-semibold text-ga-ink">Ngôn ngữ giao diện</label>
        <select
          value={f.locale}
          onChange={(e) => set('locale', e.target.value)}
          className="ga-ui block w-full rounded-ga border border-ga-line bg-ga-card px-[15px] py-3 text-[15px] text-ga-ink outline-none"
        >
          <option value="vi">🇻🇳 Tiếng Việt</option>
          <option value="en">🇬🇧 English</option>
          <option value="de">🇩🇪 Deutsch</option>
        </select>
      </div>

      <GaBtn variant="yellow" size="lg" className="mb-3.5 mt-1.5 w-full" loading={loading} disabled={loading} onClick={submit}>
        {loading ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
      </GaBtn>

      <p className="mb-4 text-center text-[12px] leading-relaxed text-ga-muted">
        Bằng cách đăng ký, bạn đồng ý với <a href="#" className="text-ga-ink underline">Điều khoản dịch vụ</a> và{' '}
        <a href="#" className="text-ga-ink underline">Chính sách bảo mật</a> của chúng tôi.
      </p>

      <AuthDivider />
      <GoogleBtn />

      <div className="mt-6 text-center text-[14px] text-ga-muted">
        Đã có tài khoản?{' '}
        <Link href="/v2/login" className="font-bold text-ga-ink underline">
          Đăng nhập →
        </Link>
      </div>
    </GaAuthShell>
  )
}
