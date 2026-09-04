'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { useMaintenanceStore } from '@/stores/useMaintenanceStore'

/**
 * Màn chặn toàn cục khi hệ thống bảo trì (thiết kế plans/2026-09-03 §7) — nhân bản
 * pattern AuthRecoveryDialog: mount MỘT lần ở root layout, render theo
 * `useMaintenanceStore` (interceptor bắn tín hiệu, probe xác nhận).
 *
 * Hành vi chốt trong thiết kế:
 *  - Poll 30s; hệ thống sống lại → TỰ HẠ MÀN + toast, KHÔNG ép reload — bài học viên
 *    đang làm dở (textarea…) còn nguyên dưới overlay, ép reload là xoá bài của họ.
 *    Nút "Tải lại trang" dành cho ai muốn sạch.
 *  - Countdown tính bằng đồng hồ SERVER (clockSkewMs từ probe), không tin đồng hồ máy.
 *  - Style tự đứng (không dựa token .ga-* — overlay chạy cả ngoài khu Galerie).
 */

const POLL_MS = 30_000
const TICK_MS = 15_000

function formatTimeVn(iso: string, locale: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const sameDay = new Date().toDateString() === d.toDateString()
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return time
  return `${time} ${d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })}`
}

export function MaintenanceOverlay() {
  const t = useTranslations('v2.maintenance')
  const locale = useLocale()
  const { active, info, clockSkewMs, refresh } = useMaintenanceStore()
  const [checking, setChecking] = useState(false)
  const [, setTick] = useState(0) // re-render nhịp 15s để countdown chạy

  const check = useCallback(async () => {
    setChecking(true)
    try {
      const recovered = await refresh()
      if (recovered) {
        toast.success(t('restoredToast'), {
          duration: 10_000,
          action: { label: t('reloadPage'), onClick: () => window.location.reload() },
        })
      }
    } finally {
      setChecking(false)
    }
  }, [refresh, t])

  useEffect(() => {
    if (!active) return
    const poll = setInterval(() => void check(), POLL_MS)
    const tick = setInterval(() => setTick((n) => n + 1), TICK_MS)
    return () => {
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [active, check])

  if (!active) return null

  const endsAt = info?.endsAtUtc ? Date.parse(info.endsAtUtc) : NaN
  const serverNow = Date.now() + clockSkewMs
  const remainingMin = Number.isFinite(endsAt) ? Math.ceil((endsAt - serverNow) / 60_000) : null

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="df-maintenance-title"
      className="fixed inset-0 z-[80] flex items-center justify-center px-5"
      style={{ background: '#FAF7EF' }}
    >
      <div className="w-full max-w-md text-center" style={{ color: '#211B0C' }}>
        <span
          className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full"
          style={{ background: '#FFF3BF', color: '#8A6C00' }}
        >
          <Wrench size={26} aria-hidden />
        </span>
        <h1 id="df-maintenance-title" className="text-[22px] font-bold leading-tight">
          {info?.title || t('overlayTitle')}
        </h1>
        {/* Sản phẩm dạy tiếng Đức — một câu Đức là giọng của chính nó, giữ nguyên ở mọi locale. */}
        <p className="mt-1 text-[13px] font-semibold" style={{ color: '#8A6C00' }}>
          Wir sind gleich zurück!
        </p>
        <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed" style={{ color: '#6A6149' }}>
          {info?.note || t('overlayNote')}
        </p>

        <div
          className="mx-auto mt-5 inline-flex items-baseline gap-2 rounded-lg border px-4 py-2.5"
          style={{ borderColor: '#E6DFC9', background: '#FFFFFF' }}
        >
          {info?.endsAtUtc ? (
            <>
              <span className="text-[16px] font-bold tabular-nums">{formatTimeVn(info.endsAtUtc, locale)}</span>
              <span className="text-[12px]" style={{ color: '#6A6149' }}>
                {remainingMin !== null && remainingMin > 0
                  ? t('etaCountdown', { minutes: remainingMin })
                  : t('etaOverdue')}
              </span>
            </>
          ) : (
            <span className="text-[13px]" style={{ color: '#6A6149' }}>
              {t('etaUnknown')}
            </span>
          )}
        </div>

        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            type="button"
            disabled={checking}
            onClick={() => void check()}
            className="rounded-lg px-6 py-2.5 text-[14px] font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: '#211B0C' }}
          >
            {checking ? t('retryChecking') : t('retryNow')}
          </button>
          <span className="text-[12px]" style={{ color: '#9A9078' }}>
            {t('autoRetry')}
          </span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-1 text-[12.5px] underline underline-offset-2"
            style={{ color: '#6A6149' }}
          >
            {t('reloadPage')}
          </button>
        </div>
      </div>
    </div>
  )
}
