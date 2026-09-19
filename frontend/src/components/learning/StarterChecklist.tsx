'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, BellRing, BookOpen, CheckCircle2, Map, Mic, Target } from 'lucide-react'
import api from '@/lib/api'
import { getMyLearningProfile, updateProfile } from '@/lib/profileApi'
import { useTracking } from '@/hooks/useTracking'
import { GaBtn, GaCap, GaProgress } from '@/components/ui-v2'
import {
  DEFAULT_REMINDER_HOUR,
  REMINDER_HOURS,
  buildStarterChecklist,
  type OnboardingProgress,
  type StarterChecklist as StarterChecklistModel,
  type StarterItemKey,
} from '@/features/onboarding/starterChecklist'

/**
 * W10 — Checklist tuần đầu trên dashboard (`HOME_WEEK1`, Đợt 4 PR-3 19/09/2026).
 *
 * Tự tải, tự ẩn: `GET /onboarding/progress` (trạng thái tích ô — nguồn thật, đồng bộ mobile) +
 * `GET /onboarding/me/profile` (trình độ, để mục đầu là Ngày 1 hay Kiểm tra đầu vào) +
 * `GET /profile/me` (giờ nhắc đã đặt chưa — W11, Đợt 6). Không có hàng progress / lỗi tải / đã xong /
 * quá 7 ngày ⇒ render null, dashboard không đổi gì. Luật ở `features/onboarding/starterChecklist.ts`
 * (có test); đây chỉ là vỏ.
 *
 * W11 (Đợt 6): mục "Đặt giờ nhắc" mở ô chọn giờ ngay tại chỗ → `PATCH /profile/me {reminderHourLocal}`;
 * server dùng giờ này cho nhắc chuỗi + lifecycle. Không xin Notification API trình duyệt (G-5).
 */

const ICON: Record<StarterItemKey, typeof BookOpen> = {
  first_lesson: BookOpen,
  placement: Target,
  roadmap_node: Map,
  mock_exam: Mic,
  reminder: BellRing,
}

export function StarterChecklist() {
  const t = useTranslations('v2.student.dashboard.starter')
  const { trackEvent } = useTracking()
  const [model, setModel] = useState<StarterChecklistModel | null>(null)
  const [progress, setProgress] = useState<OnboardingProgress | null>(null)
  const [level, setLevel] = useState<string | null>(null)
  const [reminderHour, setReminderHour] = useState<number>(DEFAULT_REMINDER_HOUR)
  const [savedHour, setSavedHour] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [reminderError, setReminderError] = useState(false)
  const aliveRef = useRef(true)

  useEffect(() => {
    let alive = true
    aliveRef.current = true
    Promise.allSettled([
      api.get<OnboardingProgress>('/onboarding/progress'),
      getMyLearningProfile(),
      api.get<{ reminderHourLocal?: number | null }>('/profile/me'),
    ]).then(([p, profile, me]) => {
      if (!alive || p.status !== 'fulfilled') return
      const lv = profile.status === 'fulfilled' ? profile.value?.currentLevel ?? null : null
      const hour = me.status === 'fulfilled' && typeof me.value.data?.reminderHourLocal === 'number' ? me.value.data.reminderHourLocal : null
      setProgress(p.value.data)
      setLevel(lv)
      setSavedHour(hour)
      if (hour !== null) setReminderHour(hour)
      setModel(buildStarterChecklist(p.value.data, { level: lv, reminderHourLocal: hour }))
    })
    return () => { alive = false; aliveRef.current = false }
  }, [])

  async function saveReminder() {
    if (saving) return
    setSaving(true)
    setReminderError(false)
    try {
      await updateProfile({ reminderHourLocal: reminderHour })
      trackEvent('onboarding_reminder_hour_set', { hour: reminderHour, surface: 'starter_checklist' })
      if (!aliveRef.current) return
      setSavedHour(reminderHour)
      setModel(buildStarterChecklist(progress, { level, reminderHourLocal: reminderHour }))
    } catch {
      if (aliveRef.current) setReminderError(true)
    } finally {
      if (aliveRef.current) setSaving(false)
    }
  }

  if (!model || !model.visible) return null
  const total = model.items.length

  return (
    <section
      aria-label={t('aria')}
      data-testid="starter-checklist"
      className="rounded-ga border border-ga-line bg-ga-card p-4 lg:p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <GaCap className="mb-1 block">{t('cap')}</GaCap>
          <h2 className="font-ga-display text-ga-h2 text-ga-ink">{t('title')}</h2>
        </div>
        <p className="ga-ui text-ga-caption font-bold text-ga-muted" data-testid="starter-progress">
          {t('progress', { done: model.doneCount, total })}
        </p>
      </div>
      <GaProgress className="mt-3" value={model.doneCount} max={total} label={t('progress', { done: model.doneCount, total })} />

      <ol className="mt-3 divide-y divide-ga-line border-t border-ga-line">
        {model.items.map((item) => {
          const Icon = ICON[item.key]
          const label = t(`items.${item.key}`)
          if (item.done) {
            return (
              <li key={item.key} className="flex items-center gap-3 py-3" data-testid={`starter-item-${item.key}`} data-done="true">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-ga-pill bg-ga-green-soft text-ga-green" aria-hidden="true">
                  <CheckCircle2 size={16} />
                </span>
                <span className="ga-ui min-w-0 flex-1 text-ga-small text-ga-muted line-through">{label}</span>
                <span className="text-ga-caption text-ga-green">
                  {item.key === 'reminder' && savedHour !== null
                    ? t('reminderHour', { hour: String(savedHour).padStart(2, '0') })
                    : t('done')}
                </span>
              </li>
            )
          }
          if (item.key === 'reminder') {
            return (
              <li key={item.key} className="py-3" data-testid="starter-item-reminder" data-done="false">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-ga-pill border border-ga-line bg-ga-bg text-ga-muted" aria-hidden="true">
                    <Icon size={15} />
                  </span>
                  <span className="ga-ui min-w-0 flex-1 text-ga-small font-bold text-ga-ink">{label}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-11">
                  <label className="ga-ui text-ga-caption text-ga-muted" htmlFor="starter-reminder-hour">{t('reminderLabel')}</label>
                  <select
                    id="starter-reminder-hour"
                    data-testid="starter-reminder-hour"
                    className="h-9 rounded-ga border border-ga-line bg-ga-card px-2 text-ga-small text-ga-ink"
                    value={reminderHour}
                    onChange={(e) => setReminderHour(Number(e.target.value))}
                    disabled={saving}
                  >
                    {REMINDER_HOURS.map((h) => (
                      <option key={h} value={h}>{t('reminderHour', { hour: String(h).padStart(2, '0') })}</option>
                    ))}
                  </select>
                  <GaBtn variant="primary" size="sm" loading={saving} onClick={saveReminder} data-testid="starter-reminder-save">
                    {t('reminderSave')}
                  </GaBtn>
                </div>
                {reminderError && (
                  <p className="mt-1 pl-11 text-ga-caption text-ga-red" role="alert">{t('reminderError')}</p>
                )}
              </li>
            )
          }
          return (
            <li key={item.key} data-testid={`starter-item-${item.key}`} data-done="false">
              <Link
                href={item.href}
                onClick={() => trackEvent('onboarding_starter_item_clicked', { key: item.key })}
                className="group flex items-center gap-3 py-3 transition-colors hover:text-ga-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-accent"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-ga-pill border border-ga-line bg-ga-bg text-ga-muted transition-colors group-hover:border-ga-accent group-hover:text-ga-accent" aria-hidden="true">
                  <Icon size={15} />
                </span>
                <span className="ga-ui min-w-0 flex-1 text-ga-small font-bold text-ga-ink group-hover:text-ga-accent">{label}</span>
                <ArrowRight size={14} className="shrink-0 text-ga-muted group-hover:text-ga-accent" aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-ga-caption text-ga-subtle">{t('note')}</p>
    </section>
  )
}
