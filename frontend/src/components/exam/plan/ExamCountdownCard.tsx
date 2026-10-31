'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, CalendarDays } from 'lucide-react'
import { GaCard, GaProgress } from '@/components/ui-v2'
import { currentWeekOf, examPlanApi, type ExamPlan } from '@/lib/examPlanApi'

const PLAN_HREF = '/v2/student/exam-plan'

/**
 * Thẻ "Còn N ngày tới kỳ thi · tuần X/Y" (LT3). Tự tải, tự ẩn khi không có kế hoạch hoặc API lỗi:
 * người không có ngày thi giữ nguyên trải nghiệm cũ.
 *
 * `invite` dùng ở trang Thi: thêm lời mời nhập ngày thi cho người đã chọn kỳ thi nhưng chưa có ngày.
 */
export function ExamCountdownCard({ invite = false }: { invite?: boolean }) {
  const [plan, setPlan] = useState<ExamPlan | null>(null)

  useEffect(() => {
    let alive = true
    examPlanApi
      .get()
      .then((r) => alive && setPlan(r.data))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  if (!plan) return null
  if (plan.status === 'ACTIVE') return <Countdown plan={plan} />
  if (invite && (plan.status === 'NEEDS_DATE' || plan.status === 'EXAM_PASSED')) return <SetupInvite />
  return null
}

function Countdown({ plan }: { plan: ExamPlan }) {
  const t = useTranslations('v2.student.examPlan')
  const week = currentWeekOf(plan)
  return (
    <Link href={PLAN_HREF} className="group block focus-visible:outline-none">
      <GaCard hover className="p-5 group-focus-visible:ring-2 group-focus-visible:ring-inset group-focus-visible:ring-ga-focus">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-ga bg-ga-accent-soft text-ga-accent">
            <CalendarDays size={20} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-ga-h3 text-ga-ink">
              {plan.daysLeft === 0 ? t('countdownToday') : t('countdown', { days: plan.daysLeft ?? 0 })}
            </h2>
            <p className="ga-ui mt-0.5 text-ga-small text-ga-muted">
              {plan.provider} {plan.level} · {t('weekOf', { week: plan.currentWeek ?? 1, total: plan.totalWeeks ?? 1 })}
            </p>
          </div>
          <ArrowRight size={16} className="mt-1 shrink-0 text-ga-subtle transition-colors group-hover:text-ga-accent" aria-hidden />
        </div>
        {week && week.totalTasks > 0 && (
          <div className="mt-4">
            <p className="ga-ui mb-1.5 text-ga-caption text-ga-muted">
              {t('weekProgress', { done: week.doneTasks, total: week.totalTasks })}
            </p>
            <GaProgress value={week.doneTasks} max={week.totalTasks} label={t('weekProgress', { done: week.doneTasks, total: week.totalTasks })} />
          </div>
        )}
      </GaCard>
    </Link>
  )
}

function SetupInvite() {
  const t = useTranslations('v2.student.examPlan')
  return (
    <Link href={PLAN_HREF} className="group block focus-visible:outline-none">
      <GaCard hover className="flex items-center gap-3 p-5 group-focus-visible:ring-2 group-focus-visible:ring-inset group-focus-visible:ring-ga-focus">
        <CalendarDays size={20} className="shrink-0 text-ga-accent" aria-hidden />
        <p className="min-w-0 flex-1 text-ga-h3 text-ga-ink">{t('setupTitle')}</p>
        <ArrowRight size={16} className="shrink-0 text-ga-subtle transition-colors group-hover:text-ga-accent" aria-hidden />
      </GaCard>
    </Link>
  )
}
