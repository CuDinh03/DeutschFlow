'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Eye } from 'lucide-react'
import {
  SUPPORT_SESSION_ENDED_EVENT,
  SUPPORT_SESSION_ENDED_ROUTE,
  endSupportSessionFromTab,
  getSupportSession,
  markSupportSessionEnded,
  type SupportSessionInfo,
} from '@/lib/authSession'
import { GaBtn } from './GaBtn'

/** mm:ss từ số mili-giây còn lại (âm → 00:00). */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Đóng tab hỗ trợ; trình duyệt không cho đóng (tab không do script mở) → về trang "đã kết thúc". */
export function closeSupportTab(): void {
  window.close()
  window.setTimeout(() => {
    if (!window.closed) window.location.assign(SUPPORT_SESSION_ENDED_ROUTE)
  }, 150)
}

/**
 * Dải báo "đang xem như người dùng" của phiên hỗ trợ chỉ-đọc (V370) — chỉ hiện trong TAB hỗ trợ
 * (`isSupportMode()`), cạnh MaintenanceBanner trong GaShell. Đếm ngược tới `expiresAt`; hết giờ, nhận 401, hoặc
 * bấm "Kết thúc" → trạng thái "phiên đã kết thúc" (token + cookie auth_support bị bỏ, không đụng phiên admin).
 */
export function SupportSessionBanner() {
  const t = useTranslations('v2.supportSession')
  const [info, setInfo] = useState<SupportSessionInfo | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [ending, setEnding] = useState(false)

  useEffect(() => {
    setInfo(getSupportSession())
    const onEnded = () => setInfo(getSupportSession())
    window.addEventListener(SUPPORT_SESSION_ENDED_EVENT, onEnded)
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      window.removeEventListener(SUPPORT_SESSION_ENDED_EVENT, onEnded)
      window.clearInterval(tick)
    }
  }, [])

  const remainingMs = info ? Date.parse(info.expiresAt) - now : 0
  const expired = Boolean(info) && !info?.ended && remainingMs <= 0

  useEffect(() => {
    if (expired) markSupportSessionEnded()
  }, [expired])

  if (!info) return null
  const ended = info.ended || remainingMs <= 0

  if (ended) {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="support-session-banner"
        data-state="ended"
        className="sticky top-0 z-30 flex flex-wrap items-center gap-2.5 border-b border-ga-line bg-ga-red-soft px-4 py-2 text-ga-small text-ga-ink"
      >
        <Eye size={15} aria-hidden className="flex-none" />
        <span className="min-w-0 flex-1">
          <b className="font-semibold">{t('ended')}</b> · {t('endedBody')}
        </span>
        <GaBtn variant="ink" size="sm" onClick={closeSupportTab}>
          {t('close')}
        </GaBtn>
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="support-session-banner"
      data-state="active"
      className="sticky top-0 z-30 flex flex-wrap items-center gap-2.5 border-b border-ga-line bg-ga-warning-soft px-4 py-2 text-ga-small text-ga-ink"
    >
      <Eye size={15} aria-hidden className="flex-none" />
      <span className="min-w-0 flex-1">
        <b className="font-semibold">{t('bannerViewing', { name: info.targetName, email: info.targetEmail })}</b>
        {' · '}
        {t('bannerReadOnly')}
        {' · '}
        <span className="tabular-nums">{t('bannerRemaining', { time: formatRemaining(remainingMs) })}</span>
      </span>
      <GaBtn
        variant="ink"
        size="sm"
        disabled={ending}
        onClick={() => {
          setEnding(true)
          void endSupportSessionFromTab()
        }}
        data-testid="support-session-end"
      >
        {t('end')}
      </GaBtn>
    </div>
  )
}
