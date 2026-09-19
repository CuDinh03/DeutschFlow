'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, BookOpen, CheckCircle2, Map, Mic, Target } from 'lucide-react'
import api from '@/lib/api'
import { getMyLearningProfile } from '@/lib/profileApi'
import { useTracking } from '@/hooks/useTracking'
import { GaCap, GaProgress } from '@/components/ui-v2'
import {
  buildStarterChecklist,
  type OnboardingProgress,
  type StarterChecklist as StarterChecklistModel,
  type StarterItemKey,
} from '@/features/onboarding/starterChecklist'

/**
 * W10 — Checklist tuần đầu trên dashboard (`HOME_WEEK1`, Đợt 4 PR-3 19/09/2026).
 *
 * Tự tải, tự ẩn: `GET /onboarding/progress` (trạng thái tích ô — nguồn thật, đồng bộ mobile) +
 * `GET /onboarding/me/profile` (trình độ, để mục đầu là Ngày 1 hay Kiểm tra đầu vào). Không có hàng
 * progress / lỗi tải / đã xong / quá 7 ngày ⇒ render null, dashboard không đổi gì. Luật ở
 * `features/onboarding/starterChecklist.ts` (có test); đây chỉ là vỏ.
 */

const ICON: Record<StarterItemKey, typeof BookOpen> = {
  first_lesson: BookOpen,
  placement: Target,
  roadmap_node: Map,
  mock_exam: Mic,
}

export function StarterChecklist() {
  const t = useTranslations('v2.student.dashboard.starter')
  const { trackEvent } = useTracking()
  const [model, setModel] = useState<StarterChecklistModel | null>(null)

  useEffect(() => {
    let alive = true
    Promise.allSettled([api.get<OnboardingProgress>('/onboarding/progress'), getMyLearningProfile()])
      .then(([p, profile]) => {
        if (!alive || p.status !== 'fulfilled') return
        const level = profile.status === 'fulfilled' ? profile.value?.currentLevel : null
        setModel(buildStarterChecklist(p.value.data, { level }))
      })
    return () => { alive = false }
  }, [])

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
                <span className="text-ga-caption text-ga-green">{t('done')}</span>
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
