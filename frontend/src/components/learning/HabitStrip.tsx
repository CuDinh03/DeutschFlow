'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Flame } from 'lucide-react'

/**
 * HabitStrip — Streak · XP gộp thành MỘT hàng nhỏ, đặt SAU learning progress (S-02).
 *
 * Hierarchy gamification đã chốt: learning progress > weekly goal > streak > XP (handoff §21).
 * XP là tín hiệu thưởng, không phải đại diện trình độ, nên nó nhỏ nhất và đứng cuối.
 *
 * Guardrail dữ liệu (P4-D2): chỉ hiển thị chỉ số CÓ nguồn thật. `weeklyGoal` chưa có nguồn
 * canonical nên KHÔNG vẽ — sẽ bổ sung khi domain có, không bịa bằng cách cộng dồn XP/buổi học.
 */
export interface HabitStripProps {
  /** Số ngày streak (nguồn: `/today/me` → progress.streakDays). */
  streakDays?: number
  /** XP (nguồn: `/xp/me`). Bỏ trống khi không tải được — không hiện 0 giả. */
  xp?: { level: number; progressInLevel: number; xpNeededForNext: number }
}

export function HabitStrip({ streakDays, xp }: HabitStripProps) {
  const t = useTranslations('v2.student.dashboard.habit')
  if (streakDays == null && !xp) return null

  const xpTotal = xp ? xp.progressInLevel + xp.xpNeededForNext : 0
  const xpPct = xp && xpTotal > 0 ? Math.round((xp.progressInLevel / xpTotal) * 100) : 0

  return (
    <section aria-label={t('label')} className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {streakDays != null && (
        <span className="inline-flex items-center gap-2 text-ga-small text-ga-muted">
          <Flame size={16} className="text-ga-streak" aria-hidden />
          <span className="font-semibold tabular-nums text-ga-ink">{streakDays}</span>
          {t('streak')}
        </span>
      )}

      {xp && (
        <Link
          href="/v2/student/achievements"
          className="inline-flex min-h-11 items-center gap-2 text-ga-small text-ga-muted transition-colors hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-inset lg:min-h-0"
        >
          <span className="font-semibold tabular-nums text-ga-ink">{t('level', { level: xp.level })}</span>
          {/* Thanh XP nhỏ, đặt sau streak — tín hiệu thưởng, không phải tiến độ học. */}
          <span aria-hidden className="h-1 w-16 overflow-hidden rounded-ga-pill bg-ga-side-active">
            <span className="block h-full rounded-ga-pill bg-ga-xp" style={{ width: `${xpPct}%` }} />
          </span>
          <span className="tabular-nums">{t('xpToNext', { xp: xp.xpNeededForNext })}</span>
        </Link>
      )}
    </section>
  )
}
