'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useMaintenanceStore } from '@/stores/useMaintenanceStore'

/**
 * Banner đếm ngược lịch bảo trì sắp tới — render trong GaShell như MỘT FLEX SIBLING phía
 * trên GaTopBar (thiết kế §7: layout shell là flex h-[100dvh], banner dạng `fixed` sẽ che
 * content). Nguồn: `upcoming` của useMaintenanceStore, nuôi bằng poll 5 phút + khi tab
 * focus lại. Ẩn được theo TỪNG lịch (localStorage theo id+startsAt — đổi giờ là hiện lại).
 */

const POLL_MS = 5 * 60_000
const TICK_MS = 30_000
const SHOW_WITHIN_MS = 24 * 60 * 60_000
const WARN_WITHIN_MS = 60 * 60_000
const DISMISS_KEY = 'df-maintenance-dismissed'

function readDismissed(): string {
  try {
    return window.localStorage.getItem(DISMISS_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeDismissed(v: string): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, v)
  } catch {
    /* private mode — banner sẽ hiện lại, vô hại */
  }
}

export function MaintenanceBanner() {
  const t = useTranslations('v2.maintenance')
  const locale = useLocale()
  const { upcoming, active, clockSkewMs, refresh } = useMaintenanceStore()
  const [dismissed, setDismissed] = useState('')
  const [, setTick] = useState(0)

  useEffect(() => {
    setDismissed(readDismissed())
    void refresh()
    const poll = setInterval(() => void refresh(), POLL_MS)
    const tick = setInterval(() => setTick((n) => n + 1), TICK_MS)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(poll)
      clearInterval(tick)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  const view = useMemo(() => {
    if (!upcoming || active) return null
    const startsAt = Date.parse(upcoming.startsAtUtc)
    if (!Number.isFinite(startsAt)) return null
    const remainMs = startsAt - (Date.now() + clockSkewMs)
    if (remainMs > SHOW_WITHIN_MS) return null
    const key = `${upcoming.id}:${upcoming.startsAtUtc}`
    if (dismissed === key) return null

    const totalMin = Math.max(0, Math.ceil(remainMs / 60_000))
    const hours = Math.floor(totalMin / 60)
    const minutes = totalMin % 60
    const d = new Date(startsAt)
    const sameDay = new Date(Date.now() + clockSkewMs).toDateString() === d.toDateString()
    const timeLabel =
      d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) +
      (sameDay ? '' : ` ${d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })}`)

    return {
      key,
      title: upcoming.title,
      timeLabel,
      countdown: hours > 0 ? t('bannerCountdownHours', { hours, minutes }) : t('bannerCountdownMinutes', { minutes: totalMin }),
      warn: remainMs <= WARN_WITHIN_MS,
    }
  }, [upcoming, active, clockSkewMs, dismissed, locale, t])

  if (!view) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2.5 border-b px-4 py-2 text-[13px] leading-snug"
      style={
        view.warn
          ? { background: '#FAE6E2', borderColor: '#E8C7C0', color: '#7C1D16' }
          : { background: '#FFF3BF', borderColor: '#EADFB0', color: '#5C4A00' }
      }
    >
      <span
        className="h-2 w-2 flex-none rounded-full"
        style={{
          background: view.warn ? '#B3271E' : '#D9A800',
          boxShadow: view.warn ? '0 0 0 3px rgba(179,39,30,.2)' : '0 0 0 3px rgba(217,168,0,.25)',
        }}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">
        <b className="font-semibold">{t('bannerUpcoming', { time: view.timeLabel })}</b>
        {' · '}
        {view.title}
        {' · '}
        {view.countdown}
      </span>
      <button
        type="button"
        aria-label={t('bannerDismiss')}
        className="flex-none px-1.5 text-[15px] leading-none opacity-70 transition-opacity hover:opacity-100"
        onClick={() => {
          writeDismissed(view.key)
          setDismissed(view.key)
        }}
      >
        ✕
      </button>
    </div>
  )
}
