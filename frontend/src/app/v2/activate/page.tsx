'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'
import api from '@/lib/api'
import { GaCap, GaBtn } from '@/components/ui-v2'
import { GaAuthShell, GaField, AuthErrorBanner, pwStrength } from '../authShared'

// ─────────────────────────────────────────────────────────────────────────────
// Đặt mật khẩu LẦN ĐẦU cho tài khoản do trung tâm tạo từ CSV (Q-09, owner chốt 14/09/2026).
//
// Vì sao màn này tồn tại: tài khoản do `OrgRosterRowImporter` tạo có mật khẩu ngẫu nhiên mà KHÔNG ai
// biết — kể cả trung tâm. Trước bản này đường vào duy nhất là học viên tự bấm "Quên mật khẩu"; với
// một lớp 20 em, đó là 20 lần hướng dẫn một thao tác các em không có lý do gì để đoán ra.
//
//   GET  /auth/activate?token=…                → { state, maskedEmail, orgName }; 200 KỂ CẢ token lạ
//   POST /auth/activate { token, newPassword } → 204
//
// KHÁC màn /v2/forgot-password ở hai điểm cố ý:
//   1. token đến từ URL (email), nên ở đây BUỘC phải dùng useSearchParams → bọc <Suspense>, nếu
//      không Next chỉ prerender được fallback và trang chớp trắng;
//   2. hỏi trạng thái TRƯỚC khi hiện form. Để người dùng gõ xong mật khẩu rồi mới báo "liên kết hết
//      hạn" là bắt họ làm việc thừa đúng lúc họ đang bối rối nhất.
// ─────────────────────────────────────────────────────────────────────────────

type State = 'VALID' | 'EXPIRED' | 'USED' | 'UNKNOWN'
type Preview = { state: State; maskedEmail: string; orgName: string }
type FieldErrors = Record<string, string>

function apiDetail(err: unknown): string | undefined {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
}

function ActivateInner() {
  const t = useTranslations('v2.auth')
  const router = useRouter()
  const token = (useSearchParams().get('token') ?? '').trim()

  const [preview, setPreview] = useState<Preview | null>(null)
  const [checking, setChecking] = useState(true)
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errs, setErrs] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const st = pwStrength(pw)

  const check = useCallback(async () => {
    if (!token) {
      setPreview({ state: 'UNKNOWN', maskedEmail: '', orgName: '' })
      setChecking(false)
      return
    }
    try {
      const res = await api.get<Preview>('/auth/activate', { params: { token } })
      setPreview(res.data)
    } catch {
      // Mạng hỏng hoặc 429: coi như chưa biết, cho người dùng thử lại bằng cách tải lại trang.
      setPreview({ state: 'UNKNOWN', maskedEmail: '', orgName: '' })
    } finally {
      setChecking(false)
    }
  }, [token])

  useEffect(() => { void check() }, [check])

  const submit = async () => {
    if (loading) return
    const e: FieldErrors = {}
    if (!pw) e.pw = t('activate.newPasswordRequired')
    else if (pw.length < 8) e.pw = t('activate.newPasswordTooShort')
    if (pw !== confirm) e.confirm = t('activate.confirmMismatch')
    setErrs(e)
    if (Object.keys(e).filter((k) => e[k]).length) return

    setLoading(true)
    setError('')
    try {
      await api.post('/auth/activate', { token, newPassword: pw })
      toast.success(t('activate.success'))
      // Endpoint không cấp token phiên — vào bằng chính mật khẩu vừa đặt, như mọi lần sau.
      router.replace('/v2/login')
    } catch (err: unknown) {
      setError(apiDetail(err) ?? t('activate.failed'))
      setLoading(false)
      // Liên kết có thể vừa chết (hết hạn/đã dùng ở tab khác) — hỏi lại để màn đổi sang đúng ca.
      void check()
    }
  }

  const state = preview?.state
  const deadReasonKey = state === 'EXPIRED' ? 'expired' : state === 'USED' ? 'used' : 'unknown'

  return (
    <GaAuthShell>
      <GaCap className="mb-3 block">{t('activate.cap')}</GaCap>
      <h1 className="m-0 mb-2 font-ga-display text-ga-h1-m font-medium text-ga-ink sm:text-ga-h1 lg:text-ga-display">
        {t('activate.title')}
      </h1>

      {checking ? (
        <div className="ga-shimmer h-[120px]" aria-hidden />
      ) : state !== 'VALID' ? (
        <div data-testid="activate-dead">
          <p className="m-0 mb-5 text-ga-body-lg text-ga-muted">{t(`activate.${deadReasonKey}`)}</p>
          {/* Lối thoát phải nằm ngay đây: đường "Quên mật khẩu" vẫn sống và vẫn đưa các em vào được. */}
          <Link href="/v2/forgot-password" className="block">
            <GaBtn variant="yellow" size="lg" className="mb-3 w-full">{t('activate.goForgot')}</GaBtn>
          </Link>
          <Link href="/v2/login" className="text-ga-body text-ga-muted underline">{t('activate.goLogin')}</Link>
        </div>
      ) : (
        <>
          <p className="m-0 mb-7 text-ga-body-lg text-ga-muted">{t('activate.subtitle')}</p>

          <div
            className="mb-5 flex items-start gap-2.5 rounded-ga px-4 py-3.5"
            style={{ background: 'var(--ga-green-soft)', border: '1px solid color-mix(in srgb, var(--ga-green) 35%, transparent)' }}
            role="status"
            data-testid="activate-account-notice"
          >
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ga-green" />
            <div className="min-w-0 flex-1 break-words text-ga-small leading-relaxed text-ga-ink">
              {preview?.orgName
                ? t('activate.accountNoticeWithOrg', { email: preview.maskedEmail, org: preview.orgName })
                : t('activate.accountNotice', { email: preview?.maskedEmail ?? '' })}
            </div>
          </div>

          {error && <AuthErrorBanner><strong>{error}</strong></AuthErrorBanner>}

          <form onSubmit={(e) => { e.preventDefault(); void submit() }} noValidate>
            <GaField
              name="new-password"
              label={t('activate.newPasswordLabel')}
              type="password"
              placeholder={t('activate.newPasswordPlaceholder')}
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
              label={t('activate.confirmLabel')}
              type="password"
              placeholder={t('activate.confirmPlaceholder')}
              autoComplete="new-password"
              value={confirm}
              onChange={(v) => { setConfirm(v); setErrs((x) => ({ ...x, confirm: '' })) }}
              error={errs.confirm || (confirm && pw !== confirm ? t('activate.confirmMismatch') : undefined)}
              required
            />
            <GaBtn type="submit" variant="yellow" size="lg" className="mb-4 mt-1 w-full"
                   loading={loading} disabled={loading} data-testid="activate-submit">
              {loading ? t('activate.saving') : t('activate.submit')}
            </GaBtn>
          </form>
        </>
      )}
    </GaAuthShell>
  )
}

export default function V2ActivatePage() {
  return (
    <Suspense fallback={<GaAuthShell><div className="ga-shimmer h-[200px]" aria-hidden /></GaAuthShell>}>
      <ActivateInner />
    </Suspense>
  )
}
