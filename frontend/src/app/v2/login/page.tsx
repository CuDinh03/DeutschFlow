'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import api from '@/lib/api'
import { setTokens, clearTokens, recordTokenRefresh } from '@/lib/authSession'
import { homeFor } from '@/lib/roleRouting'
import { useUserStore } from '@/stores/useUserStore'
import { useTracking } from '@/hooks/useTracking'
import { registerPushNotifications } from '@/hooks/usePushNotifications'
import { GaCap, GaBtn } from '@/components/ui-v2'
import { GaAuthShell, GaField, AuthErrorBanner, EMAIL_RE } from '../authShared'

// ─────────────────────────────────────────────────────────────────────────────
// Đăng nhập (GaLogin) — Galerie 2.0 reskin of /login. Plumbing reused 1:1 (zero
// backend): POST /auth/login → setTokens + setOrg + recordTokenRefresh + locale
// cookie → GET /auth/me → role redirect. PostHog identify + push reg are
// fire-and-forget after navigation (mirrors legacy login).
//
// Redirect targets land users in the v2 home that EXISTS today:
//   ADMIN → /v2/admin/users (the admin dashboard index is not built yet) ·
//   org OWNER/ADMIN → /v2/org · TEACHER → /v2/teacher.
//   STUDENT → /v2/student/dashboard (the working v2 student home).
//
// Toàn bộ chuỗi hiển thị lấy từ next-intl ('v2.auth.login.…'): đây là bề mặt đăng nhập DUY NHẤT
// sau khi cây v1 bị xoá, mà /login cũ mới là trang có 3 thứ tiếng — hard-code tiếng Việt ở đây
// đồng nghĩa với việc người dùng EN/DE mất bản dịch ngay lúc v1 biến mất.
//
// ĐÃ BỎ: checkbox "Ghi nhớ đăng nhập" và nút "Đăng nhập với Google".
//   · Checkbox chỉ có `defaultChecked` — không state, không handler, không ai đọc. Phiên đăng nhập
//     do `lib/authSession.ts` quyết định (access token → sessionStorage + cookie phiên; refresh
//     token → cookie HttpOnly dài hạn do backend đặt) và KHÔNG có chế độ "không nhớ" để tắt. Giữ
//     lại một ô tick vô hiệu là hứa với người dùng một quyền kiểm soát không tồn tại.
//   · Google SSO: backend không có endpoint OAuth nào (xem AuthController) → nút giả, đã gỡ.
// "Quên mật khẩu?" thì NGƯỢC LẠI: backend đã có /auth/forgot-password + /auth/reset-password nên
// nút này nay trỏ vào luồng thật ở /v2/forgot-password thay vì toast "sắp ra mắt".
// ─────────────────────────────────────────────────────────────────────────────

type FieldErrors = Record<string, string>

// ─── Maintenance Banner ──────────────────────────────────────────────────────
// Công cụ VẬN HÀNH (port từ /login legacy — mất nó là mất đường báo bảo trì cho người dùng).
// Cách bật/tắt:
//   - Thêm vào amplify.yml hoặc AWS Amplify env vars:
//       NEXT_PUBLIC_MAINTENANCE_MESSAGE="Máy chủ đang bảo trì từ 02:00–04:00 (giờ VN). Vui lòng thử lại sau."
//   - Để trống ("") hoặc xóa biến để ẩn banner.
// Nội dung thông báo do người vận hành viết (không qua i18n — họ tự chọn ngôn ngữ); chỉ tiêu đề và
// nhãn nút đóng là dịch được.
const MAINTENANCE_MSG = process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE ?? ''

function MaintenanceBanner() {
  const t = useTranslations('v2.auth')
  const [visible, setVisible] = useState(true)
  if (!MAINTENANCE_MSG || !visible) return null
  return (
    <div
      className="mb-5 flex items-start gap-2.5 rounded-ga px-4 py-3.5"
      style={{ background: 'var(--ga-yellow-soft)', border: '1px solid var(--ga-gold)' }}
      role="alert"
      aria-live="polite"
    >
      <span className="relative mt-0.5 flex shrink-0">
        <span className="absolute inline-flex h-[18px] w-[18px] animate-ping rounded-full bg-ga-gold opacity-60" />
        <span className="relative inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ga-gold">
          <svg className="h-2.5 w-2.5 text-ga-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="ga-ui m-0 text-[13px] font-semibold text-ga-ink">{t('maintenance.title')}</p>
        <p className="m-0 mt-0.5 text-[12.5px] leading-relaxed text-ga-muted">{MAINTENANCE_MSG}</p>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label={t('maintenance.dismiss')}
        className="mt-0.5 shrink-0 rounded-full p-0.5 text-ga-muted transition-colors hover:text-ga-ink"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

/**
 * `?next=` chỉ được phép là đường dẫn NỘI BỘ — cùng đúng một luật với `safeNext()` trong
 * `src/middleware.ts` (không import chung được: middleware chạy ở edge runtime riêng). `//evil.com`
 * và `https://evil.com` đều bị loại; chỉ nhận path bắt đầu bằng đúng một dấu "/".
 */
function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export default function V2LoginPage() {
  const t = useTranslations('v2.auth')
  const router = useRouter()
  const { trackEvent, identifyUser } = useTracking()
  const setOrg = useUserStore((s) => s.setOrg)
  const setUser = useUserStore((s) => s.setUser)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errs, setErrs] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (loading) return
    const e: FieldErrors = {}
    if (!email.trim()) e.email = t('login.emailRequired')
    else if (!EMAIL_RE.test(email)) e.email = t('login.emailInvalid')
    if (!password) e.password = t('login.passwordRequired')
    setErrs(e)
    if (Object.keys(e).length) return

    setLoading(true)
    setError('')
    trackEvent('login_started', { method: 'email' })
    try {
      // Clear any stale tokens before login (prevents an expired token in the header).
      clearTokens()
      // Trim only — drop stray leading/trailing whitespace (autofill/paste). We deliberately do NOT
      // lowercase here: the backend now matches email case-insensitively, and lowercasing client-side
      // would break users whose email was historically stored mixed-case while an older, still
      // case-sensitive backend is live during a rollout. Trimming is safe against any backend version.
      const { data } = await api.post('/auth/login', { email: email.trim(), password })
      setTokens(data)
      setOrg({ orgId: data.orgId ?? null, orgRole: data.orgRole ?? null })
      recordTokenRefresh()
      if (data.locale && ['vi', 'en', 'de'].includes(data.locale)) {
        document.cookie = `locale=${data.locale};path=/;max-age=31536000;SameSite=Lax`
      }

      const { data: user } = await api.get('/auth/me')
      // Populate the user store so shared screens (sidebar name/email, dashboard
      // greeting, achievements self-highlight) have an identity to read.
      setUser({
        // AuthResponse exposes the id as `userId` (not `id`); reading `user.id` here
        // stored the literal string "undefined" and broke PostHog identify + any
        // client-side id usage. Map from the correct field.
        id: String(user.userId),
        email: user.email,
        roles: [String(user.role)],
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      })
      // Bản đồ vai trò → trang chủ dùng chung với /login (@/lib/roleRouting): ADMIN → /v2/admin/users
      // (chưa có trang index), OWNER/MANAGER → /v2/org (console trung tâm), TEACHER legacy mang
      // orgRole OWNER/MANAGER cũng vào console, còn lại → /v2/student/dashboard.
      //
      // `?next=` (middleware đặt khi đá người CHƯA đăng nhập ra khỏi một trang cần quyền) được ưu
      // tiên hơn bản đồ trên — thiếu nhánh này thì mọi deep-link đều bị nuốt, ai cũng rơi về trang
      // chủ theo vai trò. Đọc thẳng `window.location` thay vì `useSearchParams()`: hook đó buộc
      // component phải nằm trong <Suspense>, mà khi đó Next chỉ prerender nổi phần fallback → bề mặt
      // đăng nhập DUY NHẤT của cả app chớp trắng rồi mới hydrate. Handler này chỉ chạy trên trình
      // duyệt nên đọc location là an toàn tuyệt đối với prerender.
      const next = safeNext(new URLSearchParams(window.location.search).get('next'))
      router.replace(next ?? homeFor(user.role, { orgRole: data.orgRole }))

      identifyUser(String(user.userId), { email: user.email, name: user.displayName, role: user.role, locale: user.locale })
      trackEvent('login_success', { role: user.role })
      registerPushNotifications()
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { detail?: string; errors?: FieldErrors } } })?.response?.data
      if (res?.errors) setErrs(res.errors)
      else {
        setError(res?.detail ?? t('login.failed'))
        trackEvent('login_failed', { reason: res?.detail ?? 'unknown' })
      }
      setLoading(false)
    }
  }

  return (
    <GaAuthShell>
      <GaCap className="mb-3 block">{t('login.cap')}</GaCap>
      <h1 className="m-0 mb-2 font-ga-display text-[38px] font-medium tracking-[-0.015em] text-ga-ink">{t('login.title')}</h1>
      <p className="m-0 mb-7 text-[15px] text-ga-muted">{t('login.subtitle')}</p>

      <MaintenanceBanner />

      {error && (
        <AuthErrorBanner>
          <strong>{error}</strong>{' '}
          {/* t.rich giữ trật tự câu theo từng ngôn ngữ — cắt chuỗi thành prefix/link/suffix sẽ vỡ ở DE. */}
          {t.rich('login.errorHelp', {
            reset: (chunks) => (
              <Link href="/v2/forgot-password" className="underline">
                {chunks}
              </Link>
            ),
          })}
        </AuthErrorBanner>
      )}

      {/* <form> + nút type="submit": /login legacy là form thật (handleSubmit(e: FormEvent)), nên Enter
          trong ô mật khẩu là cách đăng nhập của rất nhiều người — và trình quản lý mật khẩu chỉ nhận
          diện/điền cặp email+mật khẩu khi chúng nằm trong một <form>. Bản v2 dựng bằng <div> + onClick
          đã đánh rơi cả hai; sau khi v1 bị xoá thì đây là bề mặt đăng nhập DUY NHẤT, không được thiếu.
          `noValidate` để validation của TA (thông báo đã i18n) chạy, không phải bong bóng native. */}
      <form
        onSubmit={(e) => { e.preventDefault(); void submit() }}
        noValidate
      >
        <GaField
          label={t('login.emailLabel')}
          type="email"
          placeholder={t('login.emailPlaceholder')}
          autoComplete="email"
          value={email}
          onChange={(v) => { setEmail(v); setErrs((x) => ({ ...x, email: '' })) }}
          error={errs.email}
          required
        />
        <GaField
          label={t('login.passwordLabel')}
          type="password"
          placeholder={t('login.passwordPlaceholder')}
          autoComplete="current-password"
          value={password}
          onChange={(v) => { setPassword(v); setErrs((x) => ({ ...x, password: '' })) }}
          error={errs.password}
          required
        />

        <div className="mb-5 mt-1 flex justify-end">
          <Link
            href="/v2/forgot-password"
            className="ga-ui text-[13.5px] text-ga-muted underline transition-colors hover:text-ga-ink"
          >
            {t('login.forgot')}
          </Link>
        </div>

        <GaBtn
          type="submit"
          variant="yellow"
          size="lg"
          className="mb-4 w-full"
          loading={loading}
          disabled={loading}
        >
          {loading ? t('login.submitting') : t('login.submit')}
        </GaBtn>
      </form>

      <div className="mt-7 text-center text-[14px] text-ga-muted">
        {t('login.noAccount')}{' '}
        <Link href="/v2/register" className="font-bold text-ga-ink underline">
          {t('login.registerCta')}
        </Link>
      </div>
    </GaAuthShell>
  )
}
