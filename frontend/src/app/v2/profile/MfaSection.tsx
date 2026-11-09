'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { mfaApi, mfaErrorKind, type MfaStatus } from '@/lib/mfaApi'
import { GaBtn } from '@/components/ui-v2'
import { RecoveryCodesPanel } from '../_mfa/RecoveryCodesPanel'

const inputCls =
  'ga-ui w-full rounded-ga border border-ga-line bg-ga-card px-3.5 py-2.5 text-ga-body text-ga-ink outline-none transition-colors focus:border-ga-accent'

/**
 * Tab Bảo mật → Xác thực hai lớp (chỉ hiện cho ADMIN). Trạng thái + số mã khôi phục còn lại, và "Tạo mã khôi
 * phục mới": nhập mã 6 số hiện tại → 10 mã mới hiện MỘT lần (bộ cũ hết hiệu lực). Bật/tắt 2FA không làm ở
 * đây: ADMIN bắt buộc có 2FA và được dẫn bật ngay ở bước đăng nhập; mất điện thoại thì nhờ admin khác đặt lại.
 */
export function MfaSection() {
  const t = useTranslations('v2.account.profile')
  const locale = useLocale()
  const [status, setStatus] = useState<MfaStatus | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [regenOpen, setRegenOpen] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)

  const load = useCallback(async () => {
    try {
      const { data } = await mfaApi.status()
      setStatus(data)
      setLoadError(false)
    } catch {
      setLoadError(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const regenerate = async () => {
    if (busy || code.length !== 6) return
    setBusy(true)
    setError('')
    try {
      const { data } = await mfaApi.regenerateRecoveryCodes(code)
      setCodes(data.recoveryCodes)
      setRegenOpen(false)
      setCode('')
    } catch (e) {
      const kind = mfaErrorKind(e)
      setError(
        kind === 'codeInvalid'
          ? t('mfaErrorCode')
          : kind === 'rateLimited'
            ? t('mfaErrorRateLimited')
            : apiMessage(e),
      )
    } finally {
      setBusy(false)
    }
  }

  const enabledDate = (() => {
    if (!status?.enabledAt) return ''
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(status.enabledAt))
    } catch {
      return status.enabledAt
    }
  })()

  return (
    <section className="max-w-md border-t border-ga-line pt-6" data-testid="profile-mfa">
      <h3 className="ga-ui text-ga-body font-semibold text-ga-ink">{t('mfaTitle')}</h3>

      {loadError && <p className="ga-ui mt-1 text-ga-small text-ga-red">{t('mfaLoadError')}</p>}

      {status && !codes && (
        <>
          <p className="ga-ui mt-1 text-ga-small text-ga-muted">
            {status.enabled ? t('mfaOn', { date: enabledDate }) : t('mfaOff')}
          </p>
          {status.enabled && (
            <p
              className={`ga-ui mt-1 text-ga-small ${status.recoveryCodesRemaining < 3 ? 'font-semibold text-ga-red' : 'text-ga-muted'}`}
            >
              {t('mfaRemaining', { count: status.recoveryCodesRemaining })}
              {status.recoveryCodesRemaining < 3 && ` ${t('mfaLow')}`}
            </p>
          )}

          {status.enabled && !regenOpen && (
            <GaBtn variant="ghost" className="mt-3" onClick={() => setRegenOpen(true)}>
              {t('mfaRegenerate')}
            </GaBtn>
          )}

          {status.enabled && regenOpen && (
            <form
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                void regenerate()
              }}
              noValidate
            >
              <p className="ga-ui text-ga-small text-ga-muted">{t('mfaRegenerateDesc')}</p>
              <label className="block">
                <span className="ga-ui mb-1.5 block text-ga-eyebrow uppercase text-ga-muted">{t('mfaCodeLabel')}</span>
                <input
                  className={inputCls}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    setError('')
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  aria-invalid={error ? true : undefined}
                />
              </label>
              {error && (
                <p role="alert" className="ga-ui text-ga-small text-ga-red">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <GaBtn type="submit" variant="primary" loading={busy} disabled={busy || code.length !== 6}>
                  {busy ? t('mfaRegenerating') : t('mfaRegenerate')}
                </GaBtn>
                <GaBtn
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setRegenOpen(false)
                    setCode('')
                    setError('')
                  }}
                >
                  {t('mfaCancel')}
                </GaBtn>
              </div>
            </form>
          )}
        </>
      )}

      {codes && (
        <div className="mt-4">
          <RecoveryCodesPanel
            codes={codes}
            onContinue={() => {
              setCodes(null)
              toast.success(t('mfaCodesReplaced'))
              void load()
            }}
            labels={{
              title: t('mfaCodesTitle'),
              description: t('mfaCodesDesc'),
              copyAll: t('mfaCodesCopy'),
              copied: t('mfaCodesCopied'),
              download: t('mfaCodesDownload'),
              saved: t('mfaCodesSaved'),
              continueLabel: t('mfaCodesDone'),
              fileHeader: t('mfaCodesFileHeader'),
            }}
          />
        </div>
      )}
    </section>
  )
}
