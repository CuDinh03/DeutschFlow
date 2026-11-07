'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArrowRight, CalendarClock, CalendarDays, ChartNoAxesColumn, Check, ChevronRight, CircleCheck, CircleX, Clock, FileText, Headphones, Lock, Mic, RotateCcw, Target, type LucideIcon } from 'lucide-react'
import { getMockPack, getMockPacks, type PackExam } from '@/lib/mockPackApi'
import { getPracticeAccess, getPracticeOverview, type PracticeOverview } from '@/lib/telcPracticeApi'
import { listMyAttempts, type MyAttempt } from '@/lib/exam/mockAttemptApi'
import { examPlanApi, currentWeekOf, localIsoDate, swapLocally, teilKeyOf, todaySession, type ExamPlan, type ExamPlanDay } from '@/lib/examPlanApi'
import { examSpeakingApi } from '@/lib/examSpeakingApi'
import { apiMessage } from '@/lib/api'
import { useFmt } from '@/lib/i18n/useFmt'
import { cn } from '@/lib/utils'
import { ErrorBanner, LoadingState } from '@/components/ui-v2'
import type { ExamResultView } from '@/types/exam-speaking'
import { SkillBars } from '@/components/exam/today/SkillBars'
import { WeekPlan } from '@/components/exam/today/WeekPlan'
import { Glyph, dayIcon } from '@/components/exam/today/visual'
import { latestOral, oralHref, pickExamFor, skillsFrom, suggestionsFor, teilHref, todayCard, type Suggestion, type TodayCardModel } from '@/components/exam/today/todayModel'
import { TourHelpButton, useScreenTour } from '@/components/exam/tour/ScreenTour'

/**
 * Luyện thi · Hôm nay — `/v2/student/exam` (đợt (d) làm mới Luyện thi, 07/11/2026).
 *
 * Thứ tự: Hôm nay → Bốn kỹ năng → Tuần này → Đề luyện. Mỗi khối chỉ có tiêu đề; giải thích nằm trong
 * hướng dẫn lần đầu (đợt (e)). Lịch tuần lấy từ lộ trình đếm ngược `GET /exam-plan` (tuần hiện tại có
 * buổi theo ngày, đổi chỗ được); bốn kỹ năng tính từ lần luyện từng Teil gần nhất và lần thi nói gần
 * nhất. Chưa có ngày thi thì thẻ Hôm nay gợi ý Teil yếu nhất và có ô đặt ngày thi.
 */

interface ExamRow {
  exam: PackExam
  packTitle: string
}

interface LockedPack {
  id: number
  title: string
}

const PASS_RATIO = 0.6
const fmtN = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 })

export default function V2StudentExamHubPage() {
  const t = useTranslations('v2.student.examHub')
  const [access, setAccess] = React.useState<boolean | null>(null)
  const [rows, setRows] = React.useState<ExamRow[] | null>(null)
  const [locked, setLocked] = React.useState<LockedPack[]>([])
  const [attempts, setAttempts] = React.useState<MyAttempt[]>([])
  const [overviews, setOverviews] = React.useState<PracticeOverview[]>([])
  const [plan, setPlan] = React.useState<ExamPlan | null>(null)
  const [oral, setOral] = React.useState<ExamResultView | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  // Hàm dịch có thể đổi danh tính mỗi lần render: giữ trong ref để `load` không chạy lại vô hạn.
  const tRef = React.useRef(t)
  tRef.current = t

  const load = React.useCallback(async () => {
    setError(null)
    try {
      const [enabled, packs, mine, p, orals] = await Promise.all([
        getPracticeAccess(),
        getMockPacks(),
        listMyAttempts().catch(() => [] as MyAttempt[]),
        examPlanApi.get().catch(() => null),
        examSpeakingApi
          .listResults()
          .then((r) => r.data ?? [])
          .catch(() => [] as ExamResultView[]),
      ])
      setAccess(enabled)
      setAttempts(mine)
      setPlan(p)
      setOral(latestOral(orals, p?.provider ?? 'TELC', p?.level ?? 'B1'))
      const telc = packs.filter((x) => x.examFormat?.toUpperCase() === 'TELC')
      setLocked(telc.filter((x) => x.locked).map((x) => ({ id: x.id, title: x.title })))
      const details = await Promise.all(telc.filter((x) => !x.locked).map((x) => getMockPack(x.id).catch(() => null)))
      const list: ExamRow[] = []
      details.forEach((d) => d?.exams.forEach((exam) => list.push({ exam, packTitle: d.title })))
      setRows(list)
      if (enabled) {
        const ready = list.filter((r) => !r.exam.comingSoon)
        const ovs = await Promise.all(ready.map((r) => getPracticeOverview(r.exam.id).catch(() => null)))
        setOverviews(ovs.filter((o): o is PracticeOverview => !!o))
      }
    } catch (e) {
      setError(apiMessage(e) || tRef.current('loadError'))
    }
  }, [])
  React.useEffect(() => {
    void load()
  }, [load])

  const skills = React.useMemo(() => skillsFrom(overviews, oral), [overviews, oral])
  const week = currentWeekOf(plan)
  const today = todaySession(plan)
  const card = todayCard(today, plan, overviews, skills)
  const oralLink = oralHref(plan)

  const tt = useTranslations('v2.student.tour')
  const tour = useScreenTour({
    key: 'exam.today',
    ready: !!rows && access === true,
    steps: [
      { target: 'today', icon: Target, title: tt('today.today.t'), body: tt('today.today.p') },
      { target: 'skills', icon: ChartNoAxesColumn, title: tt('today.skills.t'), body: tt('today.skills.p') },
      { target: 'week', icon: CalendarDays, title: tt('today.week.t'), body: tt('today.week.p') },
      { target: 'exams', icon: FileText, title: tt('today.exams.t'), body: tt('today.exams.p') },
    ],
  })
  // Gợi ý chỉ hiện khi đã quen màn (đã xem hướng dẫn), tối đa 3.
  const suggestions = tour.familiar
    ? suggestionsFor(overviews, skills, plan, card?.kind === 'TEIL' ? `${card.section}-${card.teil}` : teilKeyOf(today), !!oral, localIsoDate())
    : []

  const onSwap = async (from: string, to: string) => {
    if (!plan || !week) return
    const before = plan
    setPlan(swapLocally(plan, from, to))
    try {
      setPlan(await examPlanApi.swapDays(week.weekNo, from, to))
      toast.success(t('swapped'))
    } catch (e) {
      setPlan(before)
      toast.error(apiMessage(e) || t('swapError'))
      throw e
    }
  }

  const dayLabel = (d: ExamPlanDay) => {
    switch (d.kind) {
      case 'TEIL':
        return `${t(`short.${d.section}`)} T${d.teil}`
      case 'ORAL_DRILL':
        return `Sprechen T${d.teil}`
      default:
        return t(`kind.${d.kind}`)
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[960px] flex-col gap-9 px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="ga-ui text-ga-eyebrow uppercase text-ga-muted">telc Deutsch {plan?.level ?? 'B1'}</p>
          <h1 className="mt-1 font-ga-display text-ga-h1 text-ga-ink">{t('title')}</h1>
        </div>
        <div className="flex items-center gap-2.5">
          {plan?.status === 'ACTIVE' && plan.daysLeft != null && plan.targetDate && <CountChip daysLeft={plan.daysLeft} date={plan.targetDate} />}
          {rows && access === true && <TourHelpButton onClick={tour.start} />}
        </div>
      </header>
      {tour.overlay}

      {error && <ErrorBanner message={error} onRetry={load} />}
      {!rows && !error && <LoadingState label={t('loading')} />}
      {rows && access === false && (
        <p className="ga-ui max-w-[60ch] border border-ga-line bg-ga-card px-4 py-3 text-ga-body text-ga-muted">{t('notOpen')}</p>
      )}

      {rows && access !== false && (
        <>
          <div className="flex flex-col gap-3">
            {card && <TodayCard card={card} />}
            {suggestions.length > 0 && <SuggestionRow items={suggestions} />}
            {plan && (plan.status === 'NEEDS_DATE' || plan.status === 'EXAM_PASSED') && (
              <DateCard passed={plan.status === 'EXAM_PASSED'} onSaved={setPlan} />
            )}
          </div>

          <section aria-labelledby="skills-title" data-tour="skills">
            <h2 id="skills-title" className="mb-3 font-ga-display text-ga-h2 text-ga-ink">{t('skillsTitle')}</h2>
            <SkillBars
              skills={skills}
              oralHref={oralLink}
              teilHref={(key) => {
                const id = pickExamFor(key, overviews)
                return id ? teilHref(id, key) : null
              }}
            />
          </section>

          {week?.days && week.days.length > 0 && (
            <section aria-labelledby="week-title" data-tour="week">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="week-title" className="font-ga-display text-ga-h2 text-ga-ink">{t('weekTitle')}</h2>
                <span className="ga-ui text-ga-small tabular-nums text-ga-muted">
                  {t('weekOf', { n: week.weekNo, total: plan?.totalWeeks ?? week.weekNo })}
                </span>
              </div>
              <WeekPlan days={week.days} labelOf={dayLabel} onSwap={onSwap} />
            </section>
          )}

          <section aria-labelledby="exams-title" data-tour="exams">
            <h2 id="exams-title" className="mb-3 font-ga-display text-ga-h2 text-ga-ink">{t('examsTitle')}</h2>
            {rows.length === 0 && locked.length === 0 ? (
              <p className="ga-ui text-ga-body text-ga-muted">{t('empty')}</p>
            ) : (
              <div className="border-t border-ga-line">
                {rows.map((r) => (
                  <ExamRowView
                    key={r.exam.id}
                    exam={r.exam}
                    overview={overviews.find((o) => o.examId === r.exam.id)}
                    attempts={attempts.filter((a) => a.exam_id === r.exam.id)}
                  />
                ))}
                {locked.map((p) => (
                  <div key={p.id} className="ga-ui grid min-h-16 grid-cols-[36px_minmax(0,1fr)] items-center gap-3.5 border-b border-ga-line px-1 py-2.5 text-ga-muted">
                    <Glyph icon={Lock} tone="plain" />
                    <span className="min-w-0">
                      <b className="block truncate text-ga-body font-semibold">{p.title}</b>
                      <span className="block text-ga-small">{t('lockedPack')}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function CountChip({ daysLeft, date }: { daysLeft: number; date: string }) {
  const t = useTranslations('v2.student.examHub')
  const fmt = useFmt()
  const when = fmt.date(`${date}T00:00:00`)
  return (
    <span
      title={t('examOn', { date: when })}
      className="ga-ui inline-flex items-center gap-2 rounded-ga-pill border border-ga-line bg-ga-card px-3 py-1.5 text-ga-small"
    >
      <CalendarClock size={16} className="text-ga-navy" aria-hidden />
      {daysLeft === 0 ? (
        <b className="text-ga-body">{t('examToday')}</b>
      ) : (
        <>
          <b className="text-ga-body tabular-nums">{t('days', { n: daysLeft })}</b>
          <span className="text-ga-muted">{t('daysLeft')}</span>
        </>
      )}
      <span className="sr-only">{t('examOn', { date: when })}</span>
    </span>
  )
}

function TodayCard({ card }: { card: TodayCardModel }) {
  const t = useTranslations('v2.student.examHub')
  const icon = dayIcon(card.kind === 'TEIL' ? { kind: 'TEIL', section: card.section } : { kind: card.kind })
  const done = 'done' in card && card.done
  const minutes = 'minutes' in card ? card.minutes : null

  let title: string
  let reason: string
  switch (card.kind) {
    case 'TEIL':
      title = `${t(`short.${card.section}`)} · Teil ${card.teil}`
      reason =
        card.pct != null
          ? card.fromPlan
            ? t('reasonLastPct', { pct: card.pct })
            : t('reasonWeakest', { pct: card.pct })
          : card.fromPlan
            ? t('reasonNew')
            : t('reasonStart')
      break
    case 'FULL_EXAM':
      title = t('todayFull')
      reason = card.examTitle ? t('reasonFull', { title: card.examTitle }) : t('reasonNoExam')
      break
    case 'ORAL_MOCK':
      title = t('todayOralMock')
      reason = t('reasonOralMock')
      break
    case 'ORAL_DRILL':
      title = `Sprechen · Teil ${card.teil ?? 1}`
      reason = t('reasonOralDrill')
      break
    case 'ROADMAP':
      title = t('todayRoadmap')
      reason = t('reasonRoadmap')
      break
    case 'REST':
      title = t('todayRest')
      reason = t('reasonRest')
      break
    case 'EXAM_DAY':
      title = t('todayExam')
      reason = t('reasonExam')
      break
  }
  const href = 'href' in card ? card.href : null

  return (
    <div data-tour="today" className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-4 border border-ga-line bg-ga-yellow-soft p-[18px] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:p-6">
      <Glyph icon={done ? Check : icon} tone="yellow" size="lg" />
      <div className="min-w-0">
        <p className="ga-ui inline-flex items-center gap-1.5 text-ga-eyebrow uppercase text-ga-muted">
          <Clock size={14} aria-hidden />
          {done ? t('todayDone') : minutes ? t('todayMinutes', { n: minutes }) : t('today')}
        </p>
        <h2 lang={card.kind === 'TEIL' || card.kind === 'ORAL_DRILL' ? 'de' : undefined} className="mt-0.5 break-words font-ga-display text-ga-h2 text-ga-ink">
          {title}
        </h2>
        <p className="ga-ui mt-1 text-ga-body text-ga-muted">{reason}</p>
      </div>
      {href && (
        <Link
          href={href}
          className={cn(
            'group ga-ui col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-ga-touch px-5 text-ga-body font-semibold transition-[transform,filter] duration-150 hover:-translate-y-px active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2 sm:col-span-1',
            done ? 'border-[1.5px] border-ga-line-strong bg-ga-card text-ga-ink' : 'bg-ga-ink text-ga-card hover:brightness-110',
          )}
        >
          {done ? t('practiceMore') : t('start')}
          <ArrowRight size={17} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  )
}

function DateCard({ passed, onSaved }: { passed: boolean; onSaved: (p: ExamPlan) => void }) {
  const t = useTranslations('v2.student.examHub')
  const [date, setDate] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const tomorrow = React.useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return localIsoDate(d)
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!date || date < tomorrow) {
      setErr(t('dateInvalid'))
      return
    }
    setBusy(true)
    setErr(null)
    try {
      onSaved(await examPlanApi.updateTargetDate(date))
      toast.success(t('dateSaved'))
    } catch (x) {
      setErr(apiMessage(x) || t('dateError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="ga-ui flex flex-wrap items-center gap-x-4 gap-y-3 border border-ga-line bg-ga-card px-4 py-3.5" noValidate>
      <Glyph icon={CalendarClock} tone="plain" />
      <div className="min-w-[12rem] flex-1">
        <p className="text-ga-body font-semibold text-ga-ink">{passed ? t('datePassed') : t('dateMissing')}</p>
        <p className="text-ga-small text-ga-muted">{t('dateWhy')}</p>
      </div>
      <label className="flex flex-col">
        <span className="sr-only">{t('dateLabel')}</span>
        <input
          type="date"
          min={tomorrow}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-invalid={!!err || undefined}
          aria-describedby={err ? 'date-err' : undefined}
          className="min-h-11 rounded-ga-touch border-[1.5px] border-ga-line-strong bg-ga-card px-3 text-ga-body text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-11 items-center rounded-ga-touch bg-ga-ink px-4 text-ga-body font-semibold text-ga-card hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus disabled:opacity-50"
      >
        {t('dateSave')}
      </button>
      {err && (
        <p id="date-err" role="alert" className="basis-full text-ga-small text-ga-red">{err}</p>
      )}
    </form>
  )
}

function ExamRowView({ exam, overview, attempts }: { exam: PackExam; overview?: PracticeOverview; attempts: MyAttempt[] }) {
  const t = useTranslations('v2.student.examHub')
  if (exam.comingSoon) {
    return (
      <div className="ga-ui grid min-h-16 grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-ga-line px-1 py-2.5 text-ga-muted">
        <Glyph icon={FileText} tone="plain" />
        <b className="truncate text-ga-body font-semibold">{exam.title}</b>
        <span className="rounded-ga-pill bg-ga-side-active px-2.5 py-0.5 text-ga-caption font-semibold">{t('comingSoon')}</span>
      </div>
    )
  }
  const teile = overview?.teile ?? []
  const done = teile.filter((x) => x.progress?.checked).length
  const max = teile.reduce((s, x) => s + x.maxPoints, 0)
  const passMark = Math.round(max * PASS_RATIO)
  const last = attempts
    .filter((a) => a.status === 'COMPLETED')
    .sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? ''))[0]
  const running = attempts.some((a) => a.status === 'IN_PROGRESS')
  const meta = [
    overview ? t('teilDone', { done, total: teile.length }) : null,
    last ? (max > 0 ? `${fmtN(last.total_score ?? 0)}/${fmtN(max)}` : fmtN(last.total_score ?? 0)) : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const passed = last && max > 0 ? (last.total_score ?? 0) >= passMark : null

  let tag: React.ReactNode
  if (running) {
    tag = <span className="rounded-ga-pill border border-ga-yellow bg-ga-yellow-soft px-2.5 py-0.5 text-ga-caption font-semibold text-ga-ink">{t('mockRunning')}</span>
  } else if (passed === true) {
    tag = (
      <span className="inline-flex items-center gap-1 rounded-ga-pill bg-ga-green-soft px-2.5 py-0.5 text-ga-caption font-semibold text-ga-green">
        <CircleCheck size={13} aria-hidden /> {t('passed')}
      </span>
    )
  } else if (passed === false) {
    tag = (
      <span className="inline-flex items-center gap-1 rounded-ga-pill bg-ga-red-soft px-2.5 py-0.5 text-ga-caption font-semibold text-ga-red">
        <CircleX size={13} aria-hidden /> {t('failed')}
      </span>
    )
  } else {
    tag = <span className="rounded-ga-pill bg-ga-side-active px-2.5 py-0.5 text-ga-caption font-semibold text-ga-muted">{t('noMock')}</span>
  }

  return (
    <Link
      href={`/v2/student/mock-exam/practice?examId=${exam.id}`}
      className="group ga-ui grid min-h-16 grid-cols-[36px_minmax(0,1fr)_auto_18px] items-center gap-3.5 border-b border-ga-line px-1 py-2.5 transition-colors duration-150 hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus"
    >
      <Glyph icon={FileText} />
      <span className="min-w-0">
        <b className="block truncate text-ga-body font-semibold text-ga-ink">{exam.title}</b>
        {meta && <span className="block truncate text-ga-small tabular-nums text-ga-muted">{meta}</span>}
      </span>
      {tag}
      <ChevronRight size={16} className="text-ga-subtle transition-transform duration-150 group-hover:translate-x-[3px]" aria-hidden />
    </Link>
  )
}

const SUGGEST_ICON: Record<Suggestion['kind'], LucideIcon> = { review: RotateCcw, weak: Target, mock: FileText, oral: Mic }

/** Nút gợi ý dưới thẻ Hôm nay (đợt (e)): nhấc 1px khi rê, mỗi nút một việc + thời lượng. */
function SuggestionRow({ items }: { items: Suggestion[] }) {
  const t = useTranslations('v2.student.examHub')
  const name = (section: string, teil: number) => `${t(`short.${section}`)} T${teil}`
  return (
    <nav aria-label={t('suggestLabel')} className="flex flex-wrap gap-2">
      {items.map((s) => {
        const Icon = s.kind === 'weak' && s.section === 'HOEREN' ? Headphones : SUGGEST_ICON[s.kind]
        let label: string
        let meta: string | null = null
        switch (s.kind) {
          case 'review':
            label = t('suggestReview', { n: s.wrong, name: name(s.section, s.teil) })
            break
          case 'weak':
            label = name(s.section, s.teil)
            meta = t('suggestMinutes', { n: s.minutes })
            break
          case 'mock':
            label = t('suggestMock', { day: t(`wd.${new Date(`${s.date}T00:00:00`).getDay()}`) })
            break
          case 'oral':
            label = t('suggestOral')
            meta = t('suggestMinutes', { n: 15 })
            break
        }
        return (
          <Link
            key={`${s.kind}-${s.href}`}
            href={s.href}
            className="ga-ui inline-flex min-h-10 items-center gap-2 rounded-ga-pill border border-ga-line bg-ga-card py-2 pl-2.5 pr-3.5 text-ga-small font-medium text-ga-ink transition-[border-color,transform] duration-ga-fast hover:-translate-y-px hover:border-ga-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
          >
            <Icon size={16} className="text-ga-navy" aria-hidden />
            <span lang={s.kind === 'weak' ? 'de' : undefined}>{label}</span>
            {meta && <span className="font-normal text-ga-muted">{meta}</span>}
          </Link>
        )
      })}
    </nav>
  )
}
