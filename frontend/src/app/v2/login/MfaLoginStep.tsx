'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Copy } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import { mfaApi, mfaErrorKind, type AuthSession, type MfaChallenge, type MfaErrorKind } from '@/lib/mfaApi'
import { GaCap, GaBtn } from '@/components/ui-v2'
import { GaField, GaOtpField, AuthErrorBanner } from '../authShared'
import { RecoveryCodesPanel } from '../_mfa/RecoveryCodesPanel'

type Phase = 'verify' | 'intro' | 'email' | 'scan' | 'codes'

/**
 * Bước 2 của đăng nhập cho tài khoản quản trị (2FA bắt buộc, 09/11/2026). Trang đăng nhập hiện bước này khi
 * `/auth/login` trả thử thách `{mfaRequired, mfaToken, enrolled, emailHint}` — lúc đó CHƯA có token nào.
 *
 * - `enrolled=true`: nhập mã 6 số từ ứng dụng xác thực, hoặc bật "Dùng mã khôi phục".
 * - `enrolled=false`: giải thích → gửi mã email → nhập mã email → quét QR (+ khoá nhập tay) → nhập mã đầu tiên
 *   → hiện 10 mã khôi phục MỘT lần (phải tick "đã lưu") → vào trang.
 *
 * Mọi bước gọi `onSession(phiên)` khi có phiên; trang đăng nhập lo phần còn lại (setTokens, /auth/me, điều
 * hướng). `onRestart` quay về ô mật khẩu khi token thử thách hết hạn (5 phút).
 */
export function MfaLoginStep({
  challenge,
  onSession,
  onRestart,
}: {
  challenge: MfaChallenge
  onSession: (session: AuthSession) => Promise<void>
  onRestart: () => void
}) {
  const t = useTranslations('v2.auth.mfa')
  const [phase, setPhase] = useState<Phase>(challenge.enrolled ? 'verify' : 'intro')
  const [token, setToken] = useState(challenge.mfaToken)
  const [busy, setBusy] = useState(false)
  const [errorKind, setErrorKind] = useState<MfaErrorKind | null>(null)
  const [errorText, setErrorText] = useState('')

  // verify
  const [code, setCode] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [recovery, setRecovery] = useState('')

  // enroll
  const [emailHint, setEmailHint] = useState(challenge.emailHint)
  const [emailCode, setEmailCode] = useState('')
  const [secret, setSecret] = useState('')
  const [otpauthUri, setOtpauthUri] = useState('')
  const [qr, setQr] = useState('')
  const [secretCopied, setSecretCopied] = useState(false)
  const [totp, setTotp] = useState('')
  const [codes, setCodes] = useState<string[]>([])
  const [session, setSession] = useState<AuthSession | null>(null)

  useEffect(() => {
    if (!otpauthUri) return
    let alive = true
    // Nạp thư viện QR khi cần (chỉ admin đang bật 2FA thấy bước này) — không đè lên bundle trang đăng nhập.
    import('qrcode')
      .then((m) => (m.default ?? m).toDataURL(otpauthUri, { margin: 1, width: 208, errorCorrectionLevel: 'M' }))
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(''))
    return () => {
      alive = false
    }
  }, [otpauthUri])

  const fail = (e: unknown) => {
    const kind = mfaErrorKind(e)
    setErrorKind(kind)
    setErrorText(kind === 'other' ? apiMessage(e) : '')
  }

  const clearError = () => {
    setErrorKind(null)
    setErrorText('')
  }

  const run = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    clearError()
    try {
      await fn()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const finish = async (s: AuthSession) => {
    await onSession(s)
  }

  const submitVerify = () =>
    run(async () => {
      const factor = useRecovery ? { recoveryCode: recovery.trim() } : { code }
      const { data } = await mfaApi.verify(token, factor)
      await finish(data)
    })

  const sendEmail = () =>
    run(async () => {
      const { data } = await mfaApi.sendEmailCode(token)
      setEmailHint(data.emailHint)
      setEmailCode('')
      setPhase('email')
    })

  const startEnroll = () =>
    run(async () => {
      const { data } = await mfaApi.startEnrollment(token, emailCode)
      setToken(data.mfaToken)
      setSecret(data.secretBase32)
      setOtpauthUri(data.otpauthUri)
      setTotp('')
      setPhase('scan')
    })

  const confirmEnroll = () =>
    run(async () => {
      const { data } = await mfaApi.confirmEnrollment(token, totp)
      setCodes(data.recoveryCodes)
      setSession(data.session)
      setPhase('codes')
    })

  const continueAfterCodes = () =>
    run(async () => {
      if (session) await finish(session)
    })

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret)
      setSecretCopied(true)
    } catch {
      setSecretCopied(false)
    }
  }

  const errorMessage = (() => {
    switch (errorKind) {
      case null:
        return ''
      case 'codeInvalid':
        return t('errors.codeInvalid')
      case 'rateLimited':
        return t('errors.rateLimited')
      case 'expired':
        return t('errors.expired')
      case 'notConfigured':
        return t('errors.notConfigured')
      case 'emailUnavailable':
        return t('errors.emailUnavailable')
      case 'alreadyEnabled':
        return t('errors.alreadyEnabled')
      case 'notEnrolled':
        return t('errors.notEnrolled')
      default:
        return errorText || t('errors.failed')
    }
  })()
  // Token thử thách hỏng/hết hạn hoặc trạng thái đăng ký đã đổi: chỉ còn đường đăng nhập lại.
  const mustRestart = errorKind === 'expired' || errorKind === 'alreadyEnabled' || errorKind === 'notEnrolled'

  return (
    <div data-testid="mfa-step">
      <GaCap className="mb-3 block">{t('cap')}</GaCap>

      {errorMessage && (
        <AuthErrorBanner>
          <strong>{errorMessage}</strong>
          {mustRestart && (
            <>
              {' '}
              <button type="button" onClick={onRestart} className="underline">
                {t('restart')}
              </button>
            </>
          )}
        </AuthErrorBanner>
      )}

      {phase === 'verify' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submitVerify()
          }}
          noValidate
        >
          <h1 className="m-0 mb-2 font-ga-display text-ga-h1 font-medium text-ga-ink">{t('verifyTitle')}</h1>
          <p className="m-0 mb-6 text-ga-body text-ga-muted">
            {useRecovery ? t('recoveryDesc') : t('verifyDesc')}
          </p>
          {useRecovery ? (
            <GaField
              name="recoveryCode"
              label={t('recoveryLabel')}
              placeholder={t('recoveryPlaceholder')}
              autoComplete="off"
              value={recovery}
              onChange={(v) => {
                setRecovery(v)
                clearError()
              }}
              hint={t('recoveryHint')}
              required
            />
          ) : (
            <GaOtpField
              name="totp"
              label={t('codeLabel')}
              value={code}
              onChange={(v) => {
                setCode(v)
                clearError()
              }}
              autoFocus
              disabled={busy}
            />
          )}
          <GaBtn
            type="submit"
            variant="yellow"
            size="lg"
            className="mb-4 w-full"
            loading={busy}
            disabled={busy || (useRecovery ? recovery.trim().length < 10 : code.length !== 6)}
          >
            {busy ? t('verifying') : t('verify')}
          </GaBtn>
          <div className="flex flex-wrap justify-between gap-2">
            <button
              type="button"
              className="ga-ui min-h-[40px] text-ga-small text-ga-muted underline hover:text-ga-ink lg:min-h-0"
              onClick={() => {
                setUseRecovery((x) => !x)
                clearError()
              }}
            >
              {useRecovery ? t('useTotp') : t('useRecovery')}
            </button>
            <button
              type="button"
              className="ga-ui min-h-[40px] text-ga-small text-ga-muted underline hover:text-ga-ink lg:min-h-0"
              onClick={onRestart}
            >
              {t('backToLogin')}
            </button>
          </div>
        </form>
      )}

      {phase === 'intro' && (
        <div>
          <h1 className="m-0 mb-2 font-ga-display text-ga-h1 font-medium text-ga-ink">{t('enrollTitle')}</h1>
          <p className="m-0 mb-3 text-ga-body text-ga-muted">{t('enrollIntro')}</p>
          <p className="m-0 mb-6 text-ga-body text-ga-muted">{t('enrollEmailIntro', { email: emailHint })}</p>
          <GaBtn
            type="button"
            variant="yellow"
            size="lg"
            className="mb-4 w-full"
            loading={busy}
            disabled={busy}
            onClick={() => void sendEmail()}
          >
            {busy ? t('sending') : t('sendEmail')}
          </GaBtn>
          <BackLink label={t('backToLogin')} onClick={onRestart} />
        </div>
      )}

      {phase === 'email' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void startEnroll()
          }}
          noValidate
        >
          <h1 className="m-0 mb-2 font-ga-display text-ga-h1 font-medium text-ga-ink">{t('emailTitle')}</h1>
          <p className="m-0 mb-6 text-ga-body text-ga-muted">{t('emailSent', { email: emailHint })}</p>
          <GaOtpField
            name="emailCode"
            label={t('emailCodeLabel')}
            value={emailCode}
            onChange={(v) => {
              setEmailCode(v)
              clearError()
            }}
            autoFocus
            disabled={busy}
          />
          <GaBtn
            type="submit"
            variant="yellow"
            size="lg"
            className="mb-4 w-full"
            loading={busy}
            disabled={busy || emailCode.length !== 6}
          >
            {t('continue')}
          </GaBtn>
          <div className="flex flex-wrap justify-between gap-2">
            <button
              type="button"
              className="ga-ui min-h-[40px] text-ga-small text-ga-muted underline hover:text-ga-ink lg:min-h-0"
              onClick={() => void sendEmail()}
              disabled={busy}
            >
              {t('resend')}
            </button>
            <BackLink label={t('backToLogin')} onClick={onRestart} />
          </div>
        </form>
      )}

      {phase === 'scan' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void confirmEnroll()
          }}
          noValidate
        >
          <h1 className="m-0 mb-2 font-ga-display text-ga-h1 font-medium text-ga-ink">{t('scanTitle')}</h1>
          <p className="m-0 mb-5 text-ga-body text-ga-muted">{t('scanDesc')}</p>
          <div className="mb-5 flex justify-center">
            {qr ? (
              // Ảnh data: URL dựng tại máy từ otpauth URI — không gửi bí mật tới dịch vụ QR bên ngoài.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt={t('qrAlt')}
                width={208}
                height={208}
                data-testid="mfa-qr"
                className="rounded-ga border border-ga-line bg-ga-card p-2"
              />
            ) : (
              <div className="h-52 w-52 animate-pulse rounded-ga bg-ga-surface" aria-hidden />
            )}
          </div>
          <p className="ga-ui m-0 mb-2 text-ga-small text-ga-muted">{t('manualLabel')}</p>
          <div className="mb-6 flex items-center gap-2">
            <code
              data-testid="mfa-secret"
              className="min-w-0 flex-1 break-all rounded-ga border border-ga-line bg-ga-surface px-3 py-2 font-mono text-ga-small tracking-wider text-ga-ink"
            >
              {secret}
            </code>
            <GaBtn type="button" variant="ghost" size="sm" onClick={() => void copySecret()}>
              <Copy size={14} aria-hidden /> {secretCopied ? t('copied') : t('copy')}
            </GaBtn>
          </div>
          <GaOtpField
            name="enrollTotp"
            label={t('codeLabel')}
            value={totp}
            onChange={(v) => {
              setTotp(v)
              clearError()
            }}
            disabled={busy}
          />
          <GaBtn
            type="submit"
            variant="yellow"
            size="lg"
            className="mb-4 w-full"
            loading={busy}
            disabled={busy || totp.length !== 6}
          >
            {busy ? t('confirming') : t('confirm')}
          </GaBtn>
        </form>
      )}

      {phase === 'codes' && (
        <RecoveryCodesPanel
          codes={codes}
          loading={busy}
          onContinue={() => void continueAfterCodes()}
          labels={{
            title: t('codesTitle'),
            description: t('codesDesc'),
            copyAll: t('codesCopy'),
            copied: t('copied'),
            download: t('codesDownload'),
            saved: t('codesSaved'),
            continueLabel: t('codesContinue'),
            fileHeader: t('codesFileHeader'),
          }}
        />
      )}
    </div>
  )
}

function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="ga-ui min-h-[40px] text-ga-small text-ga-muted underline hover:text-ga-ink lg:min-h-0"
      onClick={onClick}
    >
      {label}
    </button>
  )
}
