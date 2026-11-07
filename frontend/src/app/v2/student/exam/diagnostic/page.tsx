'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, BookOpen, CalendarDays, CircleAlert, Headphones, Mic, PenTool, Puzzle, RotateCcw, Route, type LucideIcon } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import { checkPracticeTeil, getPracticeOverview, gradePracticeWriting, WRITING_KEY, type PracticeOverview } from '@/lib/telcPracticeApi'
import { examDiagnosticApi, ORAL_PART, type DiagnosticView } from '@/lib/examDiagnosticApi'
import { examPlanApi, localIsoDate, type ExamPlan } from '@/lib/examPlanApi'
import { cn } from '@/lib/utils'
import { ErrorBanner, LoadingState } from '@/components/ui-v2'
import { PracticeShell } from '@/components/exam/practice/PracticeShell'
import { ObjectiveTeilView } from '@/components/exam/practice/ObjectiveTeilView'
import { HoerenTeilView } from '@/components/exam/practice/HoerenTeilView'
import { WritingTeilView } from '@/components/exam/practice/WritingTeilView'
import { displayedPoints, findTeil, kindOf, wordCount } from '@/components/exam/practice/practiceModel'
import { SPLIT_MIN_WIDTH, useWide } from '@/components/exam/practice/useWide'
import { Bar, Glyph, STATUS_TEXT_CLASS } from '@/components/exam/today/visual'
import { oralHref, statusOf } from '@/components/exam/today/todayModel'

const HUB = '/v2/student/exam'
const MINUTES = [20, 30, 45, 60]
/** Lesen T1 15' + Sprachbausteine T1 10' + Hören T1 8' + Schreiben 30' + thi nói ~20'. */
const ABOUT_MINUTES = 85
const PART_ICON: Record<string, LucideIcon> = { LESEN: BookOpen, SPRACHBAUSTEINE: Puzzle, HOEREN: Headphones, SCHREIBEN: PenTool, SPRECHEN: Mic }
const sectionOf = (part: string) => (part.includes('-') ? part.slice(0, part.lastIndexOf('-')) : part)

/**
 * Bài chẩn đoán — `/v2/student/exam/diagnostic` (đợt (f) làm mới Luyện thi, 07/11/2026).
 * Khai thông tin (kỳ thi, ngày thi, phút mỗi ngày) → năm phần ngắn (Lesen, Sprachbausteine, Hören chấm
 * theo đáp án; Schreiben, Sprechen tự đánh giá) → bản đồ kỹ năng + "Lịch ôn đã sẵn sàng". Rời giữa
 * chừng thì lần sau vào thẳng phần đang dở. Màn này là bước làm quen đầu tiên, không có hướng dẫn chồng lên.
 */
export default function DiagnosticPage() {
  const t = useTranslations('v2.student.diagnostic')
  const [view, setView] = React.useState<DiagnosticView | null>(null)
  const [overview, setOverview] = React.useState<PracticeOverview | null>(null)
  const [retake, setRetake] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const loadOverview = React.useCallback((v: DiagnosticView) => {
    if (v.status === 'IN_PROGRESS' && v.examId) {
      getPracticeOverview(v.examId)
        .then(setOverview)
        .catch((e) => setError(apiMessage(e)))
    }
  }, [])

  React.useEffect(() => {
    examDiagnosticApi
      .get()
      .then((v) => {
        setView(v)
        loadOverview(v)
      })
      .catch((e) => setError(apiMessage(e) || 'error'))
  }, [loadOverview])

  if (error && !view) return <div className="mx-auto max-w-[540px] p-6"><ErrorBanner message={error} /></div>
  if (!view) return <div className="p-6"><LoadingState label={t('loading')} /></div>

  if (view.status === 'NONE' || retake) {
    return (
      <DiagnosticForm
        onStarted={(v) => {
          setRetake(false)
          setOverview(null)
          setView(v)
          loadOverview(v)
        }}
      />
    )
  }
  if (view.status === 'IN_PROGRESS') {
    if (!overview) {
      return <div className="p-6">{error ? <ErrorBanner message={error} /> : <LoadingState label={t('loading')} />}</div>
    }
    return <DiagnosticRun view={view} overview={overview} onOverview={setOverview} onView={setView} />
  }
  return <DiagnosticResult view={view} onRetake={() => setRetake(true)} />
}

// ─── khai thông tin ──────────────────────────────────────────────────────────

function DiagnosticForm({ onStarted }: { onStarted: (v: DiagnosticView) => void }) {
  const t = useTranslations('v2.student.diagnostic')
  const [date, setDate] = React.useState('')
  const [minutes, setMinutes] = React.useState(30)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const dateRef = React.useRef<HTMLInputElement>(null)
  const today = localIsoDate()
  const days = date ? Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 864e5) : null
  const bad = days != null && days <= 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!date || bad) {
      dateRef.current?.focus()
      return
    }
    setBusy(true)
    setErr(null)
    try {
      onStarted(await examDiagnosticApi.start(date, minutes))
    } catch (x) {
      setErr(apiMessage(x) || t('startError'))
    } finally {
      setBusy(false)
    }
  }

  const label = 'ga-ui mb-1.5 block text-ga-small font-semibold text-ga-ink'
  const control =
    'ga-ui min-h-11 w-full rounded-ga-touch border-[1.5px] bg-ga-card px-3 text-ga-body text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus'

  return (
    <div className="mx-auto flex w-full max-w-[540px] flex-col gap-6 px-4 py-8">
      <Glyph icon={Route} size="lg" />
      <div>
        <h1 className="font-ga-display text-ga-h1 text-ga-ink">{t('formTitle', { n: ABOUT_MINUTES })}</h1>
        <p className="ga-ui mt-2 text-ga-body text-ga-muted">{t('formLead')}</p>
      </div>
      <ul className="ga-ui flex flex-wrap gap-2" aria-label={t('partsLabel')}>
        {['LESEN', 'SPRACHBAUSTEINE', 'HOEREN', 'SCHREIBEN', 'SPRECHEN'].map((p) => {
          const Icon = PART_ICON[p]
          return (
            <li key={p} lang="de" className="inline-flex items-center gap-1.5 rounded-ga-pill border border-ga-line bg-ga-card px-3 py-1 text-ga-small text-ga-ink">
              <Icon size={14} className="text-ga-navy" aria-hidden /> {t(`part.${p}`)}
            </li>
          )
        })}
      </ul>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div>
          <span className={label}>{t('examLabel')}</span>
          <p className="ga-ui min-h-11 rounded-ga-touch border-[1.5px] border-ga-line bg-ga-side-active px-3 py-2.5 text-ga-body text-ga-ink">telc Deutsch B1</p>
          <p className="ga-ui mt-1 text-ga-small text-ga-muted">{t('examHint')}</p>
        </div>
        <div>
          <label htmlFor="diag-date" className={label}>{t('dateLabel')}</label>
          <input
            ref={dateRef}
            id="diag-date"
            type="date"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={bad || undefined}
            aria-describedby="diag-date-note"
            className={cn(control, bad ? 'border-ga-red' : 'border-ga-line-strong')}
          />
          <p id="diag-date-note" className={cn('ga-ui mt-1 flex items-center gap-1.5 text-ga-small', bad ? 'text-ga-red' : 'text-ga-muted')} aria-live="polite">
            {bad ? (
              <>
                <CircleAlert size={14} aria-hidden /> {t('dateBad')}
              </>
            ) : days != null ? (
              t('daysLeft', { n: days })
            ) : (
              t('dateEmpty')
            )}
          </p>
        </div>
        <div>
          <label htmlFor="diag-min" className={label}>{t('minutesLabel')}</label>
          <select id="diag-min" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={cn(control, 'border-ga-line-strong')}>
            {MINUTES.map((m) => (
              <option key={m} value={m}>{t('minutes', { n: m })}</option>
            ))}
          </select>
        </div>
        {err && <ErrorBanner message={err} />}
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={busy}
            className="group ga-ui inline-flex min-h-12 items-center gap-2 rounded-ga-touch bg-ga-ink px-5 text-ga-body font-semibold text-ga-card transition-[transform,filter] duration-150 hover:-translate-y-px hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {t('start')} <ArrowRight size={17} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
          </button>
          <Link href={HUB} className="ga-ui text-ga-small font-semibold text-ga-navy underline decoration-1 underline-offset-[3px]">
            {t('skip')}
          </Link>
        </div>
      </form>
    </div>
  )
}

// ─── đang làm ────────────────────────────────────────────────────────────────

function DiagnosticRun({
  view,
  overview,
  onOverview,
  onView,
}: {
  view: DiagnosticView
  overview: PracticeOverview
  onOverview: (o: PracticeOverview) => void
  onView: (v: DiagnosticView) => void
}) {
  const t = useTranslations('v2.student.diagnostic')
  const tp = useTranslations('v2.student.practice')
  const wide = useWide(SPLIT_MIN_WIDTH)
  const parts = React.useMemo(() => [...view.teile, ORAL_PART], [view.teile])
  const done = (part: string) => (part === ORAL_PART ? view.oral != null : !!overview.teile.find((x) => x.key === part)?.progress?.checked)
  const idx = parts.findIndex((p) => !done(p))
  const part = idx >= 0 ? parts[idx] : null
  const [answers, setAnswers] = React.useState<Record<string, string>>({})
  const [text, setText] = React.useState('')
  const [ticks, setTicks] = React.useState<Record<string, boolean>>({})
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const startedAt = React.useRef(Date.now())
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    setAnswers({})
    setError(null)
    startedAt.current = Date.now()
  }, [part])

  // Làm xong cả năm phần ⇒ chốt kết quả.
  React.useEffect(() => {
    if (part !== null || busy) return
    setBusy(true)
    examDiagnosticApi
      .finish()
      .then(onView)
      .catch((e) => setError(apiMessage(e)))
      .finally(() => setBusy(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part])

  const onAnswer = React.useCallback((id: string, value: string | null) => {
    setAnswers((prev) => {
      const next = { ...prev }
      if (value == null) delete next[id]
      else next[id] = value
      return next
    })
  }, [])

  const elapsed = () => Math.round((Date.now() - startedAt.current) / 1000)

  const next = async () => {
    if (!part) return
    setBusy(true)
    setError(null)
    try {
      if (part === ORAL_PART) {
        const v = await examDiagnosticApi.get()
        onView(v)
        if (!v.oral) setError(t('oralNotYet'))
      } else if (part === WRITING_KEY) {
        const evaluation = await gradePracticeWriting(overview.examId, text, elapsed())
        if (evaluation.status !== 'AI_EVALUATED') setError(t('writingPending'))
        onOverview(await getPracticeOverview(overview.examId))
      } else {
        const progress = await checkPracticeTeil(overview.examId, part, answers, elapsed())
        onOverview({ ...overview, teile: overview.teile.map((x) => (x.key === part ? { ...x, progress } : x)) })
      }
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const section = part ? sectionOf(part) : 'LESEN'
  let body: React.ReactNode
  if (!part) {
    body = <div className="p-6">{error ? <ErrorBanner message={error} /> : <LoadingState label={t('finishing')} />}</div>
  } else if (part === ORAL_PART) {
    body = <OralCard />
  } else {
    const data = findTeil(overview.sectionsJson, part)
    const kind = kindOf(data, part)
    if (!data || kind === 'unknown') {
      body = <div className="p-6"><ErrorBanner message={tp('teilMissing')} /></div>
    } else if (kind === 'writing') {
      body = (
        <WritingTeilView
          key={part}
          teil={data}
          points={displayedPoints(data.writing_points, data.shuffle_points)}
          text={text}
          onText={setText}
          ticks={ticks}
          onTick={(label, on) => setTicks((prev) => ({ ...prev, [label]: on }))}
          wide={wide}
          tips={null}
          textareaRef={textareaRef}
        />
      )
    } else if (section === 'HOEREN') {
      body = <HoerenTeilView key={part} teil={data} answers={answers} onAnswer={onAnswer} result={null} wide={wide} tips={null} />
    } else {
      body = <ObjectiveTeilView key={part} teil={data} kind={kind} answers={answers} onAnswer={onAnswer} result={null} wide={wide} tips={null} />
    }
  }

  const label =
    part === ORAL_PART ? t('oralCheck') : part === WRITING_KEY ? (busy ? t('grading') : t('gradeWriting')) : t('nextPart')

  const footer = (
    <>
      {error && part && <div className="w-full"><ErrorBanner message={error} /></div>}
      <ol className="ga-ui flex min-w-0 flex-1 basis-full gap-1.5 sm:basis-auto" aria-label={t('progressLabel', { n: Math.max(0, idx) + 1, total: parts.length })}>
        {parts.map((p, i) => {
          const Icon = PART_ICON[sectionOf(p)]
          const state = done(p) ? 'done' : i === idx ? 'cur' : 'todo'
          return (
            <li key={p} className="min-w-0 flex-1" aria-current={state === 'cur' ? 'step' : undefined}>
              <span
                aria-hidden
                className={cn('block h-1.5 rounded-ga-pill transition-colors duration-ga-base', state === 'done' ? 'bg-ga-navy' : state === 'cur' ? 'bg-ga-ink' : 'bg-ga-line')}
              />
              <span className={cn('mt-1 hidden items-center gap-1 truncate text-ga-caption sm:flex', state === 'todo' ? 'text-ga-subtle' : 'text-ga-ink')}>
                <Icon size={12} aria-hidden /> <span lang="de" className="truncate">{t(`partShort.${sectionOf(p)}`)}</span>
              </span>
            </li>
          )
        })}
      </ol>
      <button
        type="button"
        disabled={busy || !part || (part === WRITING_KEY && wordCount(text) === 0)}
        onClick={() => void next()}
        className="ga-ui inline-flex min-h-11 items-center justify-center gap-1.5 rounded-ga-touch bg-ga-yellow px-4 text-ga-body font-semibold text-ga-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus disabled:opacity-50"
      >
        {label} <ArrowRight size={16} aria-hidden />
      </button>
    </>
  )

  return (
    <PracticeShell
      backHref={HUB}
      backLabel={t('leave')}
      section={part && part !== ORAL_PART ? section : null}
      subtitle={t('runSubtitle', { n: Math.max(0, idx) + 1, total: parts.length })}
      title={part ? t(`part.${section}`) : t('finishing')}
      footer={footer}
    >
      {body}
    </PracticeShell>
  )
}

/** Phần Nói: một lượt thi thử phần nói telc B1 với giám khảo AI, chấm theo tiêu chí telc. */
function OralCard() {
  const t = useTranslations('v2.student.diagnostic')
  return (
    <div className="mx-auto flex w-full max-w-[540px] flex-col gap-4 px-4 py-8">
      <Glyph icon={Mic} size="lg" />
      <h2 className="font-ga-display text-ga-h2 text-ga-ink">{t('oralTitle')}</h2>
      <p className="ga-ui text-ga-body text-ga-muted">{t('oralBody')}</p>
      <ul className="ga-ui space-y-1.5 text-ga-small text-ga-ink">
        <li>{t('oralRule1')}</li>
        <li>{t('oralRule2')}</li>
        <li>{t('oralRule3')}</li>
      </ul>
      <Link
        href={oralHref({ provider: 'TELC', level: 'B1' })}
        className="group ga-ui inline-flex min-h-12 items-center gap-2 self-start rounded-ga-touch bg-ga-ink px-5 text-ga-body font-semibold text-ga-card transition-[transform,filter] duration-150 hover:-translate-y-px hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2"
      >
        <Mic size={17} aria-hidden /> {t('oralCta')}
      </Link>
      <p className="ga-ui text-ga-small text-ga-muted">{t('oralBack')}</p>
    </div>
  )
}

// ─── kết quả ─────────────────────────────────────────────────────────────────

const RESULT_SKILLS = ['LESEN', 'HOEREN', 'SCHREIBEN', 'SPRECHEN'] as const

function DiagnosticResult({ view, onRetake }: { view: DiagnosticView; onRetake: () => void }) {
  const t = useTranslations('v2.student.diagnostic')
  const th = useTranslations('v2.student.examHub')
  const [plan, setPlan] = React.useState<ExamPlan | null>(null)
  React.useEffect(() => {
    examPlanApi.get().then(setPlan).catch(() => setPlan(null))
  }, [])

  const rows = RESULT_SKILLS.filter((s) => view.skills[s] != null).map((s) => ({ id: s, pct: view.skills[s] as number }))
  const weakest = rows.length ? rows.reduce((a, b) => (b.pct < a.pct ? b : a)) : null
  const mocks = plan?.weeks.flatMap((w) => w.tasks).filter((x) => x.type === 'FULL_EXAM' || x.type === 'DIAGNOSTIC_EXAM').length ?? 0
  const daily = plan?.weeklyMinutes ? Math.round(plan.weeklyMinutes / 7) : null

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-7 px-4 py-8 sm:px-6">
      <h1 className="font-ga-display text-ga-h1 text-ga-ink">
        {weakest ? t('resultTitle', { skill: th(`skill.${weakest.id}`) }) : t('resultTitlePlain')}
      </h1>
      <div className="border-t border-ga-line">
        {rows.map((r) => {
          const status = statusOf(r.pct)
          return (
            <div key={r.id} className="ga-ui grid min-h-16 grid-cols-[36px_minmax(0,1fr)_96px] items-center gap-x-3.5 gap-y-2 border-b border-ga-line px-1 py-3 sm:grid-cols-[36px_120px_minmax(0,1fr)_110px]">
              <Glyph icon={PART_ICON[r.id]} />
              <span>
                <span lang="de" className="block font-ga-display text-ga-h3 text-ga-ink">{th(`skill.${r.id}`)}</span>
                {(r.id === 'SCHREIBEN' || r.id === 'SPRECHEN') && <span className="block text-ga-caption text-ga-muted">{t('aiTag')}</span>}
              </span>
              <Bar pct={r.pct} className="col-span-2 col-start-2 row-start-2 sm:col-span-1 sm:col-start-auto sm:row-start-auto" />
              <span className={cn('text-right tabular-nums', STATUS_TEXT_CLASS[status])}>
                <b className="block text-ga-body font-bold">{r.pct}%</b>
                <span className="block text-ga-caption font-medium">{th(`status.${status}`)}</span>
              </span>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-4 border border-ga-line bg-ga-yellow-soft p-[18px] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:p-6">
        <Glyph icon={CalendarDays} tone="yellow" size="lg" />
        <div className="min-w-0">
          <h2 className="font-ga-display text-ga-h2 text-ga-ink">
            {plan?.status === 'ACTIVE' && plan.totalWeeks ? t('planReady', { n: plan.totalWeeks }) : t('planReadyPlain')}
          </h2>
          {plan?.status === 'ACTIVE' && daily != null && (
            <p className="ga-ui mt-1 text-ga-body text-ga-muted">{t('planMeta', { m: daily, k: mocks })}</p>
          )}
        </div>
        <Link
          href={HUB}
          className="group ga-ui col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-ga-touch bg-ga-ink px-5 text-ga-body font-semibold text-ga-card transition-[transform,filter] duration-150 hover:-translate-y-px hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2 sm:col-span-1"
        >
          {t('seeToday')} <ArrowRight size={17} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      <button
        type="button"
        onClick={onRetake}
        className="ga-ui inline-flex min-h-10 items-center gap-1.5 self-start text-ga-small font-semibold text-ga-navy underline decoration-1 underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
      >
        <RotateCcw size={14} aria-hidden /> {t('retake')}
      </button>
    </div>
  )
}
