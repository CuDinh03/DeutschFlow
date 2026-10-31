'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useFormatter, useTranslations } from 'next-intl'
import { ArrowRight, Check, Lock, TriangleAlert } from 'lucide-react'
import { GaBtn, GaCap, GaCard, GaInput, GaProgress, TkBadge } from '@/components/ui-v2'
import { TeilStrategy } from '@/components/exam/strategy/TeilStrategy'
import { currentWeekOf, taskHref, type ExamPlan, type ExamPlanTask, type ExamPlanWeek } from '@/lib/examPlanApi'

/** Hôm nay theo máy người dùng, dạng `yyyy-mm-dd` cho `<input type="date">`. */
function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * Màn lộ trình đếm ngược (LT3): ngày thi, việc tuần này kèm tiến độ tính từ dữ liệu thật, rồi cả kế
 * hoạch. Mọi việc dẫn tới tính năng có sẵn; không có nút tick tay.
 */
export function ExamPlanView({
  plan,
  onSaveDate,
}: {
  plan: ExamPlan
  /** Trả về thông báo lỗi, hoặc `null` khi lưu xong. */
  onSaveDate: (date: string) => Promise<string | null>
}) {
  const t = useTranslations('v2.student.examPlan')

  if (plan.status === 'UNAVAILABLE') {
    return (
      <GaCard className="p-5">
        <h2 className="text-ga-h3 text-ga-ink">{t('unavailableTitle')}</h2>
        <p className="ga-ui mt-1 text-ga-small text-ga-muted">{t('unavailableHint')}</p>
      </GaCard>
    )
  }

  if (plan.status !== 'ACTIVE') {
    const passed = plan.status === 'EXAM_PASSED'
    return (
      <GaCard className="p-5">
        <h2 className="text-ga-h3 text-ga-ink">{passed ? t('passedTitle') : t('setupTitle')}</h2>
        <p className="ga-ui mb-4 mt-1 text-ga-small text-ga-muted">{passed ? t('passedHint') : t('setupHint')}</p>
        <DateForm initial={null} onSave={onSaveDate} />
      </GaCard>
    )
  }

  const week = currentWeekOf(plan)
  return (
    <div className="space-y-8">
      <PlanHeader plan={plan} onSaveDate={onSaveDate} />
      {plan.warnings.length > 0 && (
        <div className="space-y-2">
          {plan.warnings.map((code) => (
            <p key={code} className="ga-ui flex items-start gap-2 border border-ga-yellow bg-ga-yellow-soft px-4 py-3 text-ga-small text-ga-ink">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>{t(`warnings.${code}`, { minutes: plan.weeklyMinutes ?? 0 })}</span>
            </p>
          ))}
        </div>
      )}
      {week && <ThisWeek plan={plan} week={week} />}
      <AllWeeks plan={plan} />
      <p className="ga-ui text-ga-caption text-ga-subtle">{t('disclaimer')}</p>
    </div>
  )
}

function PlanHeader({ plan, onSaveDate }: { plan: ExamPlan; onSaveDate: (date: string) => Promise<string | null> }) {
  const t = useTranslations('v2.student.examPlan')
  const format = useFormatter()
  const [editing, setEditing] = useState(false)
  return (
    <GaCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <GaCap className="block">{plan.provider} {plan.level}</GaCap>
          <h2 className="font-ga-display mt-1 text-ga-h1-m text-ga-ink lg:text-ga-h1">
            {plan.daysLeft === 0 ? t('countdownToday') : t('countdown', { days: plan.daysLeft ?? 0 })}
          </h2>
          <p className="ga-ui mt-1 text-ga-small text-ga-muted">
            {plan.targetDate && format.dateTime(new Date(`${plan.targetDate}T00:00:00`), { dateStyle: 'long' })}
            {' · '}
            {t('weekOf', { week: plan.currentWeek ?? 1, total: plan.totalWeeks ?? 1 })}
          </p>
        </div>
        <GaBtn variant="ghost" size="md" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
          {t('dateChange')}
        </GaBtn>
      </div>
      {editing && (
        <div className="mt-4 border-t border-ga-line pt-4">
          <p className="ga-ui mb-3 text-ga-small text-ga-muted">{t('dateChangeNote')}</p>
          <DateForm initial={plan.targetDate ?? null} onSave={onSaveDate} onSaved={() => setEditing(false)} />
        </div>
      )}
    </GaCard>
  )
}

function DateForm({
  initial,
  onSave,
  onSaved,
}: {
  initial: string | null
  onSave: (date: string) => Promise<string | null>
  onSaved?: () => void
}) {
  const t = useTranslations('v2.student.examPlan')
  const [date, setDate] = useState(initial ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!date) return
    setSaving(true)
    setError(null)
    const message = await onSave(date)
    setSaving(false)
    if (message) setError(message)
    else onSaved?.()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0 sm:w-56">
        <label htmlFor="exam-plan-date" className="ga-ui mb-1 block text-ga-small font-semibold text-ga-ink">
          {t('dateLabel')}
        </label>
        <GaInput
          id="exam-plan-date"
          type="date"
          min={todayIso()}
          value={date}
          invalid={error != null}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <GaBtn type="submit" variant="primary" size="md" disabled={!date || saving}>
        {t('dateSave')}
      </GaBtn>
      {error && <p role="alert" className="ga-ui text-ga-small text-ga-red">{error}</p>}
    </form>
  )
}

function ThisWeek({ plan, week }: { plan: ExamPlan; week: ExamPlanWeek }) {
  const t = useTranslations('v2.student.examPlan')
  const tParts = useTranslations('v2.student.examResult.parts')
  return (
    <section aria-labelledby="this-week-heading">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="this-week-heading" className="text-ga-h2 text-ga-ink">{t('thisWeek')}</h2>
        <TkBadge tone="neutral">{t(`phases.${week.phase}`)}</TkBadge>
      </div>
      <p className="ga-ui mb-4 text-ga-small text-ga-muted">{t(`phaseHints.${week.phase}`)}</p>

      {week.totalTasks > 0 && (
        <div className="mb-4">
          <p className="ga-ui mb-1.5 text-ga-caption text-ga-muted">
            {t('weekProgress', { done: week.doneTasks, total: week.totalTasks })}
          </p>
          <GaProgress
            value={week.doneTasks}
            max={week.totalTasks}
            label={t('weekProgress', { done: week.doneTasks, total: week.totalTasks })}
          />
        </div>
      )}

      <ul className="space-y-2.5">
        {week.tasks.map((task) => (
          <TaskRow key={`${task.type}-${task.teil ?? 'all'}`} task={task} plan={plan} />
        ))}
      </ul>

      {week.focus.length > 0 && (
        <div className="mt-6">
          <h3 className="ga-ui mb-1 text-ga-body font-semibold text-ga-ink">{t('focus')}</h3>
          <p className="ga-ui mb-2 text-ga-small text-ga-muted">{t('focusHint')}</p>
          <ul className="space-y-3">
            {week.focus.map((f) => (
              <li key={`${f.section}-${f.teil}`} className="border border-ga-line bg-ga-card px-4 py-3">
                <p className="ga-ui text-ga-small font-semibold text-ga-ink">
                  {t('teilLabel', { section: tParts.has(f.section) ? tParts(f.section) : f.section, teil: f.teil })}
                </p>
                <TeilStrategy provider={plan.provider} level={plan.level} section={f.section} teil={f.teil} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function TaskRow({ task, plan }: { task: ExamPlanTask; plan: ExamPlan }) {
  const t = useTranslations('v2.student.examPlan')
  const href = taskHref(task, plan)
  const label = t(`tasks.${task.type}`, { teil: task.teil ?? 0, target: task.target })

  return (
    <li className="flex items-center gap-3 border border-ga-line bg-ga-card px-4 py-3">
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${task.done ? 'border-ga-accent bg-ga-accent text-ga-accent-ink' : 'border-ga-border text-transparent'}`}
        aria-hidden
      >
        <Check size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="ga-ui text-ga-small font-semibold text-ga-ink">{label}</p>
        <p className="ga-ui mt-0.5 text-ga-caption text-ga-muted">{taskMeta(task, t)}</p>
      </div>
      {task.done ? (
        <span className="ga-ui shrink-0 text-ga-caption font-semibold text-ga-green">{t('done')}</span>
      ) : task.comingSoon ? (
        <TkBadge tone="yellow">{t('comingSoon')}</TkBadge>
      ) : href ? (
        <Link
          href={href}
          className="ga-ui inline-flex min-h-11 shrink-0 items-center gap-1 text-ga-small font-semibold text-ga-ink lg:min-h-0"
        >
          {task.locked ? <Lock size={14} aria-hidden /> : null}
          {task.locked ? t('locked') : t('start')}
          {!task.locked && <ArrowRight size={14} aria-hidden />}
        </Link>
      ) : null}
    </li>
  )
}

function taskMeta(task: ExamPlanTask, t: ReturnType<typeof useTranslations>): string {
  if (task.comingSoon) return t('comingSoonExam')
  if (!task.counted) return t('optional')
  if (task.examTitle) return task.examTitle
  return t('progressCount', { done: Math.min(task.doneCount, task.target), target: task.target })
}

function AllWeeks({ plan }: { plan: ExamPlan }) {
  const t = useTranslations('v2.student.examPlan')
  const tParts = useTranslations('v2.student.examResult.parts')
  const format = useFormatter()
  const day = (iso: string) => format.dateTime(new Date(`${iso}T00:00:00`), { day: 'numeric', month: 'short' })

  return (
    <section aria-labelledby="all-weeks-heading">
      <h2 id="all-weeks-heading" className="mb-3 text-ga-h2 text-ga-ink">{t('allWeeks')}</h2>
      <ol className="divide-y divide-ga-line border border-ga-line bg-ga-card">
        {plan.weeks.map((week) => {
          const current = week.weekNo === plan.currentWeek
          return (
            <li key={week.weekNo} className={`px-4 py-3 ${current ? 'bg-ga-accent-soft' : ''}`} aria-current={current ? 'step' : undefined}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="ga-ui text-ga-small font-semibold text-ga-ink">
                  {t('weekLabel', { week: week.weekNo })} · {t(`phases.${week.phase}`)}
                </p>
                <p className="ga-ui text-ga-caption text-ga-muted">
                  {day(week.startDate)} – {day(week.endDate)}
                  {week.weekNo <= (plan.currentWeek ?? 1) && week.totalTasks > 0 && (
                    <> · {t('progressCount', { done: week.doneTasks, target: week.totalTasks })}</>
                  )}
                </p>
              </div>
              {week.focus.length > 0 && (
                <p className="ga-ui mt-0.5 text-ga-caption text-ga-muted">
                  {week.focus
                    .map((f) => t('teilLabel', { section: tParts.has(f.section) ? tParts(f.section) : f.section, teil: f.teil }))
                    .join(' · ')}
                </p>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
