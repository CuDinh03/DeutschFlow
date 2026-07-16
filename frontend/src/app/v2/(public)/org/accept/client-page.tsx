'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  acceptInvitation, previewInvitation,
  type AcceptInvitationInput, type InvitationPreview,
} from '@/lib/orgApi'
import {
  setTokens, clearTokens, recordTokenRefresh,
} from '@/lib/authSession'
import { homeFor } from '@/lib/roleRouting'
import { useUserStore } from '@/stores/useUserStore'
import { apiMessage } from '@/lib/api'
import { GaBtn, GaCap, LoadingState } from '@/components/ui-v2'
import { GaAuthShell, GaField, AuthErrorBanner } from '../../../authShared'
import {
  Building2, AlertTriangle, CheckCircle2, ShieldCheck,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Nhận lời mời tổ chức — Galerie 2.0 reskin của /org/accept. Đường ống giữ NGUYÊN 1:1 (zero
// backend): GET /public/org-invitations/{token} để xem trước → POST …/accept để nhận lời mời,
// rồi setTokens + recordTokenRefresh + cookie locale → điều hướng theo vai trò.
//
// Đây là trang CÔNG KHAI (không sidebar, không role shell): khách đến từ link email, mang ?token=
// và thường CHƯA có tài khoản. `token` trong query CHÍNH LÀ bí mật — trang tự bảo vệ mình, backend
// xác thực token. Middleware miễn gate cho routeKey '/org/accept' (khối /v2/* strip tiền tố '/v2'
// rồi gọi chính requiresOrg()), nên URL này đi lọt tới đây mà không bị đá về /v2/login — mất
// ?token= là đứt hẳn luồng mời B2B.
//
// Chuỗi hiển thị đi qua next-intl ('v2.org.accept.…'), KHÔNG hardcode tiếng Việt như bản v1:
// GaAuthShell có sẵn <LanguageToggle>, nên người dùng đổi ngôn ngữ ngay trên trang này; và người
// đã dùng app với cookie `locale=en|de` rồi mới được trung tâm mời sẽ thấy khung EN/DE. Hardcode
// = nửa trang một thứ tiếng.
// ─────────────────────────────────────────────────────────────────────────────

type FormState = { displayName: string; password: string }

export default function V2OrgAcceptPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const t = useTranslations('v2.org.accept')

  const setUser = useUserStore((s) => s.setUser)
  const setOrg = useUserStore((s) => s.setOrg)
  const setAccessToken = useUserStore((s) => s.setAccessToken)

  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<InvitationPreview | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({ displayName: '', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const loadPreview = useCallback(async () => {
    if (!token) {
      setLoadError(t('errorMissingToken'))
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const data = await previewInvitation(token)
      setPreview(data)
    } catch (e) {
      setLoadError(apiMessage(e) || t('errorLoadFailed'))
    } finally {
      setLoading(false)
    }
  }, [token, t])

  useEffect(() => {
    loadPreview()
  }, [loadPreview])

  const handleAccept = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!preview || submitting) return
    setSubmitting(true)
    setSubmitError(null)

    // Preview no longer reveals whether the account exists (that would be an existence oracle),
    // so we always send the password. The backend treats it as ownership proof for an existing
    // account, or as the new password when creating one; displayName is used only in the latter.
    const body: AcceptInvitationInput = {
      password: form.password,
      displayName: form.displayName.trim() || undefined,
    }

    try {
      // Mirror the login flow: clear any stale token before establishing the new session.
      clearTokens()
      const auth = await acceptInvitation(token, body)

      setTokens(auth)
      recordTokenRefresh()

      // Hydrate the client store so UI reflects the new session immediately.
      setAccessToken(auth.accessToken)
      setUser({
        id: String(auth.userId),
        email: auth.email,
        roles: [auth.role],
        displayName: auth.displayName,
      })
      // KHÁC bản v1: đích đến bây giờ là console /v2/org, mà store (không chỉ cookie) là nơi bề mặt
      // v2 đọc ngữ cảnh tổ chức. /v2/login cũng gọi setOrg ngay sau setTokens — thiếu dòng này thì
      // phiên tạo từ lời mời có store orgId/orgRole = null trong khi cookie lại có, tức lệch nhau.
      setOrg({ orgId: auth.orgId, orgRole: auth.orgRole })

      if (auth.locale && ['vi', 'en', 'de'].includes(auth.locale)) {
        document.cookie = `locale=${auth.locale};path=/;max-age=31536000;SameSite=Lax`
      }

      // An invitation can be for ANY role (see the roles.* messages), not just TEACHER — a student or
      // centre owner invitee must not land on the teacher surface, so the destination comes from the
      // shared role map rather than a fixed path.
      router.replace(homeFor(auth.role, { orgRole: auth.orgRole }))
    } catch (err) {
      setSubmitError(apiMessage(err) || t('errorAcceptFailed'))
      setSubmitting(false)
    }
  }

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <GaAuthShell>
        <LoadingState label={t('loading')} />
      </GaAuthShell>
    )
  }

  // ─── Load error / invalid token ──────────────────────────────────────────────
  if (loadError || !preview) {
    return (
      <StatusCard
        tone="red"
        title={t('invalidTitle')}
        message={loadError ?? t('invalidFallback')}
        cta={t('loginCta')}
      />
    )
  }

  // ─── Expired invitation ───────────────────────────────────────────────────────
  if (preview.expired) {
    return (
      <StatusCard
        tone="orange"
        title={t('expiredTitle')}
        message={t.rich('expiredMessage', {
          email: preview.email,
          b: (chunks) => <strong className="font-semibold text-ga-ink">{chunks}</strong>,
        })}
        cta={t('loginCta')}
      />
    )
  }

  // Nhãn vai trò tra qua bảng thay vì t(`roles.${preview.role}`): giữ đúng fallback của v1
  // (`?? preview.role`) — backend có thể trả một vai trò chưa có nhãn, và next-intl với key thiếu
  // sẽ ném MISSING_MESSAGE thay vì hiện mã vai trò.
  const roleLabels: Record<string, string> = {
    OWNER: t('roles.OWNER'),
    ADMIN: t('roles.ADMIN'),
    TEACHER: t('roles.TEACHER'),
    STUDENT: t('roles.STUDENT'),
  }
  const roleLabel = roleLabels[preview.role] ?? preview.role
  // Password is always required (ownership proof for an existing account, or the new password
  // for a fresh one). We can't tell which case applies — the backend enforces displayName when
  // it turns out a new account must be created.
  const canSubmit = form.password.length > 0

  // ─── Valid invitation ─────────────────────────────────────────────────────────
  return (
    <GaAuthShell>
      {/* data-role="org": lấy accent teal của console trung tâm (galerie.css) — trang này nằm
          NGOÀI GaShell nên không có sẵn accent theo vai trò. */}
      <div data-role="org">
        <GaCap className="mb-3 block">{t('cap')}</GaCap>
        <h1 className="m-0 mb-2 font-ga-display text-[38px] font-medium tracking-[-0.015em] text-ga-ink">
          {t('title')}
        </h1>
        <p className="m-0 mb-7 text-[15px] text-ga-muted">{t('subtitle')}</p>

        <div className="mb-6 rounded-ga border border-ga-line bg-ga-card p-[15px]">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-ga bg-ga-accent-soft text-ga-accent">
              <Building2 size={20} />
            </span>
            <div className="min-w-0">
              <p className="ga-ui m-0 text-[12px] font-semibold text-ga-muted">{t('orgLabel')}</p>
              <p className="m-0 truncate font-ga-display text-[19px] font-medium text-ga-ink">{preview.orgName}</p>
            </div>
          </div>
          <div className="ga-ui mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-ga-line pt-3.5 text-[13px] text-ga-muted">
            <span>
              {t('emailLabel')}: <span className="font-semibold text-ga-ink">{preview.email}</span>
            </span>
            <span>
              {t('roleLabel')}: <span className="font-semibold text-ga-ink">{roleLabel}</span>
            </span>
          </div>
        </div>

        {submitError && <AuthErrorBanner><strong>{submitError}</strong></AuthErrorBanner>}

        <form onSubmit={handleAccept}>
          <div className="mb-5 flex items-start gap-2.5 rounded-ga border border-ga-line bg-ga-surface px-4 py-3.5">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-ga-accent" />
            <p className="ga-ui m-0 text-[13px] leading-relaxed text-ga-muted">
              {t.rich('passwordHint', {
                b: (chunks) => <span className="font-semibold text-ga-ink">{chunks}</span>,
              })}
            </p>
          </div>

          <GaField
            label={t('passwordField')}
            type="password"
            placeholder={t('passwordPlaceholder')}
            autoComplete="current-password"
            value={form.password}
            onChange={(v) => setForm((f) => ({ ...f, password: v }))}
            required
          />
          <GaField
            label={t('displayNameField')}
            placeholder={t('displayNamePlaceholder')}
            autoComplete="name"
            value={form.displayName}
            onChange={(v) => setForm((f) => ({ ...f, displayName: v }))}
            hint={t('displayNameHint')}
          />

          <GaBtn
            type="submit"
            size="lg"
            className="mt-1 w-full"
            loading={submitting}
            disabled={submitting || !canSubmit}
          >
            {!submitting && <CheckCircle2 size={18} />}
            {submitting ? t('submitting') : t('submit')}
          </GaBtn>
        </form>

        <p className="mt-6 text-center text-[12.5px] text-ga-muted">{t('terms')}</p>
      </div>
    </GaAuthShell>
  )
}

// ─── Trạng thái hỏng: token sai / bị thu hồi / hết hạn ────────────────────────────
// Lối thoát DUY NHẤT là /v2/login (bề mặt đăng nhập duy nhất còn lại — /login đã bị next.config
// redirect sang đây).

function StatusCard({
  tone,
  title,
  message,
  cta,
}: {
  tone: 'red' | 'orange'
  title: string
  message: React.ReactNode
  cta: string
}) {
  const toneClass = tone === 'red' ? 'bg-ga-red-soft text-ga-red' : 'bg-ga-orange-soft text-ga-orange'
  return (
    <GaAuthShell>
      <div className="flex flex-col items-center rounded-ga border border-ga-line bg-ga-card px-6 py-10 text-center">
        <span className={`grid h-14 w-14 place-items-center rounded-ga-pill ${toneClass}`}>
          <AlertTriangle size={26} />
        </span>
        <h1 className="mb-2 mt-5 font-ga-display text-[24px] font-medium text-ga-ink">{title}</h1>
        <p className="ga-ui m-0 max-w-sm text-[13.5px] leading-relaxed text-ga-muted">{message}</p>
        <GaBtn variant="ink" size="lg" className="mt-6" asChild>
          <Link href="/v2/login">{cta}</Link>
        </GaBtn>
      </div>
    </GaAuthShell>
  )
}
