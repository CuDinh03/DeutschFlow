'use client'

import * as React from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Blocks,
  ChevronRight,
  CircleCheck,
  CircleX,
  FileText,
  Heading,
  Headphones,
  Lightbulb,
  ListChecks,
  Newspaper,
  PenTool,
  Puzzle,
  Repeat1,
  Repeat2,
  Target,
  TextCursorInput,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { apiMessage } from '@/lib/api'
import { WRITING_KEY, getPracticeOverview, type PracticeOverview, type PracticeTeil, type WritingEvaluation } from '@/lib/telcPracticeApi'
import { listMyAttempts, type MyAttempt } from '@/lib/exam/mockAttemptApi'
import { examPlanApi, teilKeyOf, todaySession } from '@/lib/examPlanApi'
import { useFmt } from '@/lib/i18n/useFmt'
import { ErrorBanner, LoadingState } from '@/components/ui-v2'
import { StrategyDrawer } from '@/components/exam/strategy/StrategyDrawer'
import { TourHelpButton, useScreenTour } from '@/components/exam/tour/ScreenTour'
import { findTeil, wordCount } from '@/components/exam/practice/practiceModel'
import { cn } from '@/lib/utils'
import { OralHistory, OralTeilGroup } from '@/components/exam/practice/OralTeilGroup'

export default function PracticeMapRoute() {
  return (
    <Suspense fallback={<LoadingState label="…" />}>
      <PracticeMapPage />
    </Suspense>
  )
}

const SECTION_ORDER = ['LESEN', 'SPRACHBAUSTEINE', 'HOEREN', 'SCHREIBEN'] as const
const SECTION_ICON: Record<string, LucideIcon> = { LESEN: BookOpen, SPRACHBAUSTEINE: Puzzle, HOEREN: Headphones, SCHREIBEN: PenTool }
const TYPE_ICON: Record<string, LucideIcon> = {
  MATCH_HEADLINE: Heading,
  MULTIPLE_CHOICE: ListChecks,
  MATCH_AD_X: Newspaper,
  GAP_MC: TextCursorInput,
  GAP_WORDBANK: Blocks,
}
const PASS_RATIO = 0.6
const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 })

/**
 * Màn Đề (đợt (c), 07/11/2026): một đề telc trên một màn. Đầu trang: tên đề, hai nhãn (Teil đã luyện,
 * lần thi thử gần nhất) và nút chính "Thi thử trọn đề" (đang có lượt dở thì "Làm tiếp thi thử").
 * "Luyện từng Teil" xếp theo phần thi; mỗi dòng: ô icon dạng bài · Teil + dạng · trạng thái (cột cố
 * định) · nút chiến thuật · mũi tên; cả dòng bấm được. "Thi thử đã làm": đường điểm theo lần thi với
 * vạch ngưỡng 60% phần viết, và danh sách lượt.
 */
function PracticeMapPage() {
  const t = useTranslations('v2.student.practice')
  const tm = useTranslations('v2.student.practice.map')
  const fmtd = useFmt()
  const params = useSearchParams()
  const examId = Number(params.get('examId'))
  const [overview, setOverview] = React.useState<PracticeOverview | null>(null)
  const [attempts, setAttempts] = React.useState<MyAttempt[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [strategyFor, setStrategyFor] = React.useState<PracticeTeil | null>(null)
  // Teil của buổi hôm nay trong lịch tuần (đợt (d)) ⇒ nhãn "Hôm nay" trên dòng Teil đó.
  const [todayKey, setTodayKey] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    if (!examId) return
    setError(null)
    getPracticeOverview(examId).then(setOverview).catch((e) => setError(apiMessage(e)))
    listMyAttempts()
      .then((all) => setAttempts(all.filter((a) => a.exam_id === examId)))
      .catch(() => setAttempts([]))
    examPlanApi
      .get()
      .then((p) => setTodayKey(teilKeyOf(todaySession(p))))
      .catch(() => setTodayKey(null))
  }, [examId])
  React.useEffect(load, [load])

  const tt = useTranslations('v2.student.tour')
  const tour = useScreenTour({
    key: 'exam.set',
    ready: !!overview,
    steps: [
      { target: 'teile', icon: ListChecks, title: tt('set.teile.t'), body: tt('set.teile.p') },
      { target: 'mock', icon: FileText, title: tt('set.mock.t'), body: tt('set.mock.p') },
      { target: 'history', icon: TrendingUp, title: tt('set.history.t'), body: tt('set.history.p') },
    ],
  })

  if (!examId) return <div className="p-6"><ErrorBanner message={t('badLink')} /></div>

  const teile = overview?.teile ?? []
  const done = teile.filter((x) => x.progress?.checked)
  const writtenMax = teile.reduce((s, x) => s + x.maxPoints, 0)
  const passMark = Math.round(writtenMax * PASS_RATIO)
  const completed = attempts
    .filter((a) => a.status === 'COMPLETED')
    .sort((a, b) => (a.finished_at ?? a.started_at).localeCompare(b.finished_at ?? b.started_at))
  const last = completed[completed.length - 1]
  const running = attempts.find((a) => a.status === 'IN_PROGRESS')
  const inProgress = teile.find((x) => {
    const p = x.progress
    if (!p || p.checked) return false
    return x.key === WRITING_KEY ? wordCount(p.answers?.text ?? '') > 0 : Object.keys(p.answers ?? {}).length > 0
  })
  const href = (key: string) => `/v2/student/mock-exam/practice/teil?examId=${examId}&teil=${key}`
  const sectionDe = (s: string) => t(`sectionDe.${s}`)
  // Phòng thi nói mở từ đây thì thoát / thi xong quay về đúng đề này.
  const selfHref = `/v2/student/mock-exam/practice?examId=${examId}`

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[960px] flex-col gap-8 px-4 py-6 sm:px-6 lg:py-8">
      <Link
        href="/v2/student/exam"
        className="ga-ui -mb-5 inline-flex min-h-9 items-center gap-1.5 self-start text-ga-small font-semibold text-ga-navy underline decoration-1 underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
      >
        <ArrowLeft size={15} aria-hidden /> {tm('back')}
      </Link>

      {error && <ErrorBanner message={error} onRetry={load} />}
      {!overview && !error && <LoadingState label={t('loading')} />}

      {overview && (
        <>
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-ga-display text-ga-h1 text-ga-ink">{overview.title}</h1>
              <div className="ga-ui mt-2.5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-ga-pill bg-ga-side-active px-2.5 py-0.5 text-ga-small font-semibold text-ga-muted">
                  <ListChecks size={14} aria-hidden /> {tm('teilDone', { done: done.length, total: teile.length })}
                </span>
                {last && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-ga-pill px-2.5 py-0.5 text-ga-small font-semibold tabular-nums',
                      (last.total_score ?? 0) >= passMark ? 'bg-ga-green-soft text-ga-green' : 'bg-ga-red-soft text-ga-red',
                    )}
                  >
                    {(last.total_score ?? 0) >= passMark ? <CircleCheck size={14} aria-hidden /> : <CircleX size={14} aria-hidden />}
                    {tm('lastMock', { score: fmt(last.total_score ?? 0), max: fmt(writtenMax) })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2.5">
            <TourHelpButton onClick={tour.start} />
            <Link
              data-tour="mock"
              href={`/v2/student/mock-exam/full?examId=${examId}`}
              className="ga-ui inline-flex min-h-12 items-center gap-2 rounded-ga-touch bg-ga-ink px-5 text-ga-body font-semibold text-ga-card transition-[transform,filter] duration-150 hover:-translate-y-px hover:brightness-110 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2"
            >
              <FileText size={17} aria-hidden /> {running ? tm('continueMock') : tm('fullMock')}
            </Link>
            </div>
          </header>

          {inProgress && (
            <div className="flex flex-wrap items-center gap-4 border border-ga-line bg-ga-yellow-soft px-4 py-3.5">
              <div className="min-w-[12rem] flex-1">
                <p className="ga-ui text-ga-caption text-ga-muted">{t('continueCap')}</p>
                <p className="ga-ui text-ga-body-lg font-semibold text-ga-ink">
                  {sectionDe(inProgress.section)} · Teil {inProgress.teil}
                </p>
              </div>
              <Link
                href={href(inProgress.key)}
                className="ga-ui inline-flex min-h-11 items-center gap-1.5 rounded-ga-touch bg-ga-ink px-4 text-ga-body font-semibold text-ga-card hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
              >
                {t('continue')} <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          )}

          {tour.overlay}
          <section aria-labelledby="teile-title" data-tour="teile">
            <h2 id="teile-title" className="mb-4 font-ga-display text-ga-h2 text-ga-ink">{tm('teileTitle')}</h2>
            <div className="space-y-6">
              {SECTION_ORDER.map((section) => {
                const rows = teile.filter((x) => x.section === section)
                if (rows.length === 0) return null
                const Icon = SECTION_ICON[section]
                return (
                  <div key={section}>
                    <div className="mb-2.5 flex items-center gap-2.5">
                      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-ga bg-ga-navy-soft text-ga-navy">
                        <Icon size={18} strokeWidth={1.9} />
                      </span>
                      <h3 lang="de" className="min-w-0 flex-1 break-words font-ga-display text-ga-h3 text-ga-ink">{sectionDe(section)}</h3>
                      <span className="ga-ui shrink-0 text-ga-small tabular-nums text-ga-muted">
                        {tm('groupDone', { done: rows.filter((r) => r.progress?.checked).length, total: rows.length })}
                      </span>
                    </div>
                    <div className="border-t border-ga-line">
                      {rows.map((x) => (
                        <TeilRow key={x.key} teil={x} overview={overview} href={href(x.key)} today={todayKey === x.key} onStrategy={() => setStrategyFor(x)} />
                      ))}
                    </div>
                  </div>
                )
              })}

              <OralTeilGroup level={overview.level} ret={selfHref} />
            </div>
          </section>

          <section aria-labelledby="history-title" data-tour="history">
            <h2 id="history-title" className="mb-4 font-ga-display text-ga-h2 text-ga-ink">{tm('historyTitle')}</h2>
            {completed.length === 0 && !running ? (
              <p className="ga-ui text-ga-body text-ga-muted">{tm('historyEmpty')}</p>
            ) : (
              <>
                {completed.length >= 2 && writtenMax > 0 && <ScoreChart attempts={completed.slice(-6)} passMark={passMark} max={writtenMax} />}
                <div className="mt-2 border-t border-ga-line">
                  {[...(running ? [running] : []), ...[...completed].reverse()].slice(0, 6).map((a) => {
                    const passed = (a.total_score ?? 0) >= passMark
                    const isRunning = a.status === 'IN_PROGRESS'
                    return (
                      <Link
                        key={a.id}
                        href={isRunning ? `/v2/student/mock-exam/full?examId=${examId}` : `/v2/student/mock-exam/full?attemptId=${a.id}`}
                        className="group ga-ui flex min-h-14 items-center gap-3.5 border-b border-ga-line px-1 py-2.5 transition-colors duration-150 hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus"
                      >
                        <span className="min-w-0 flex-1">
                          <b className="block text-ga-body font-semibold text-ga-ink">{fmtd.date(a.finished_at ?? a.started_at)}</b>
                          <span className="block text-ga-small tabular-nums text-ga-muted">
                            {isRunning ? tm('rowRunning') : tm('rowScore', { score: fmt(a.total_score ?? 0), max: fmt(writtenMax) })}
                          </span>
                        </span>
                        {!isRunning && (
                          <span
                            className={cn(
                              'inline-flex shrink-0 items-center gap-1 rounded-ga-pill px-2.5 py-0.5 text-ga-caption font-semibold',
                              passed ? 'bg-ga-green-soft text-ga-green' : 'bg-ga-red-soft text-ga-red',
                            )}
                          >
                            {passed ? <CircleCheck size={13} aria-hidden /> : <CircleX size={13} aria-hidden />}
                            {passed ? tm('passed') : tm('failed')}
                          </span>
                        )}
                        <ChevronRight size={16} className="shrink-0 text-ga-subtle transition-transform duration-150 group-hover:translate-x-[3px]" aria-hidden />
                      </Link>
                    )
                  })}
                </div>
              </>
            )}
            <OralHistory level={overview.level} ret={selfHref} />
          </section>
        </>
      )}

      {strategyFor && overview && (
        <StrategyDrawer
          open
          onOpenChange={(o) => !o && setStrategyFor(null)}
          provider="TELC"
          level={overview.level}
          section={strategyFor.section}
          teil={strategyFor.teil}
          title={`${sectionDe(strategyFor.section)} · Teil ${strategyFor.teil}`}
          fallbackSteps={(['t1', 't2', 't3'] as const).map((k) =>
            t(`fallbackTips.${['LESEN', 'SPRACHBAUSTEINE', 'HOEREN', 'SCHREIBEN'].includes(strategyFor.section) ? strategyFor.section : 'LESEN'}.${k}`),
          )}
        />
      )}
    </div>
  )
}

function TeilRow({ teil, overview, href, today, onStrategy }: { teil: PracticeTeil; overview: PracticeOverview; href: string; today?: boolean; onStrategy: () => void }) {
  const t = useTranslations('v2.student.practice')
  const tm = useTranslations('v2.student.practice.map')
  const data = findTeil(overview.sectionsJson, teil.key)
  const p = teil.progress
  const isWriting = teil.key === WRITING_KEY
  const Icon =
    teil.section === 'HOEREN' ? (data?.max_plays === 1 ? Repeat1 : Repeat2) : isWriting ? PenTool : TYPE_ICON[data?.type ?? ''] ?? ListChecks

  let tag: React.ReactNode
  if (p?.checked) {
    const score = p.score ?? 0
    const max = p.max ?? teil.maxPoints
    const pct = max > 0 ? Math.round((score / max) * 100) : 0
    const bands = isWriting ? (p.result as WritingEvaluation | null)?.bands : null
    tag =
      pct >= 60 ? (
        <span className="inline-flex items-center gap-1 rounded-ga-pill bg-ga-green-soft px-2.5 py-0.5 text-ga-caption font-semibold text-ga-green">
          <CircleCheck size={13} aria-hidden /> {tm('tagPass', { pct })}
        </span>
      ) : (
        <span className="rounded-ga-pill bg-ga-red-soft px-2.5 py-0.5 text-ga-caption font-semibold tabular-nums text-ga-red">
          {bands ? t('bands', { bands: Object.values(bands).join(' · ') }) : tm('tagScore', { score: fmt(score), max: fmt(max), pct })}
        </span>
      )
  } else if (p) {
    const n = isWriting ? wordCount(p.answers?.text ?? '') : Object.keys(p.answers ?? {}).length
    tag = (
      <span className="rounded-ga-pill border border-ga-yellow bg-ga-yellow-soft px-2.5 py-0.5 text-ga-caption font-semibold text-ga-ink">
        {isWriting ? tm('tagDoingWords', { n }) : tm('tagDoing', { done: n, total: teil.items })}
      </span>
    )
  } else {
    tag = <span className="rounded-ga-pill bg-ga-side-active px-2.5 py-0.5 text-ga-caption font-semibold text-ga-muted">{t('rowNew')}</span>
  }

  const meta = isWriting
    ? t('metaWriting', { minutes: teil.suggestMinutes ?? 30 })
    : t('metaItems', { n: teil.items, minutes: teil.suggestMinutes ?? 10 })
  const name = `${t(`sectionDe.${teil.section}`)} Teil ${teil.teil}`

  return (
    <div className="group relative grid min-h-16 grid-cols-[36px_minmax(0,1fr)_40px_18px] items-center gap-x-3.5 gap-y-1 border-b border-ga-line px-1 py-2.5 transition-colors duration-150 hover:bg-ga-side-active has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-ga-focus sm:grid-cols-[36px_minmax(0,1fr)_150px_40px_18px]">
      <span aria-hidden className="grid h-9 w-9 place-items-center rounded-ga bg-ga-side-active text-ga-muted">
        <Icon size={17} strokeWidth={1.9} />
      </span>
      <Link href={href} className="ga-ui min-w-0 text-ga-ink after:absolute after:inset-0 focus-visible:outline-none" aria-label={`${name} · ${t(`teilTitle.${data?.type ?? teil.section}`)}`}>
        <b className="block truncate text-ga-body font-semibold">
          Teil {teil.teil} <span className="font-normal text-ga-muted">· {t(`teilTitle.${data?.type ?? teil.section}`)}</span>
          {today && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-ga-pill bg-ga-yellow px-2 py-px align-[1px] text-ga-caption font-bold text-ga-ink">
              <Target size={12} aria-hidden /> {tm('today')}
            </span>
          )}
        </b>
        <span className="block truncate text-ga-small text-ga-muted">{meta}</span>
      </Link>
      <span className="ga-ui col-start-2 row-start-2 flex sm:col-start-auto sm:row-start-auto sm:justify-end">{tag}</span>
      <button
        type="button"
        onClick={onStrategy}
        aria-label={tm('strategyFor', { name })}
        title={tm('strategyFor', { name })}
        className="relative z-[1] row-span-2 grid h-10 w-10 place-items-center rounded-full border border-ga-line bg-ga-card text-ga-muted hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus sm:row-span-1"
      >
        <Lightbulb size={17} aria-hidden />
      </button>
      <ChevronRight size={16} className="row-span-2 text-ga-subtle transition-transform duration-150 group-hover:translate-x-[3px] sm:row-span-1" aria-hidden />
    </div>
  )
}

/** Đường điểm phần viết theo lần thi thử, có vạch ngưỡng 60%. Vẽ tĩnh, không chạy theo cuộn. */
function ScoreChart({ attempts, passMark, max }: { attempts: MyAttempt[]; passMark: number; max: number }) {
  const tm = useTranslations('v2.student.practice.map')
  const fmtd = useFmt()
  const W = 640
  const H = 180
  const L = 44
  const R = 20
  const T = 24
  const B = 34
  const scores = attempts.map((a) => a.total_score ?? 0)
  const lo = Math.max(0, Math.floor((Math.min(...scores, passMark) - 15) / 10) * 10)
  const hi = Math.min(max, Math.ceil((Math.max(...scores, passMark) + 15) / 10) * 10)
  const y = (v: number) => T + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - T - B)
  const x = (i: number) => L + (attempts.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (attempts.length - 1))
  const pts = scores.map((s, i) => `${x(i).toFixed(1)},${y(s).toFixed(1)}`)
  const ticks = [lo, Math.round((lo + hi) / 2), hi]
  const lastI = scores.length - 1
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={tm('chartLabel', { scores: scores.map(fmt).join(', '), mark: passMark })}
    >
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-ga-line" strokeWidth={1} />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-ga-muted font-ga-ui text-ga-caption">{v}</text>
        </g>
      ))}
      <line x1={L} x2={W - R} y1={y(passMark)} y2={y(passMark)} className="stroke-ga-ink" strokeWidth={1.5} strokeDasharray="4 4" />
      <text x={W - R} y={y(passMark) - 6} textAnchor="end" className="fill-ga-ink font-ga-ui text-ga-caption font-semibold">{tm('passLine', { n: passMark })}</text>
      <path d={`M${pts.join(' L')} L${x(lastI).toFixed(1)},${H - B} L${x(0).toFixed(1)},${H - B} Z`} className="fill-ga-navy-soft" />
      <path d={`M${pts.join(' L')}`} fill="none" className="stroke-ga-navy" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {scores.map((s, i) => (
        <g key={attempts[i].id}>
          <circle cx={x(i)} cy={y(s)} r={i === lastI ? 6 : 5} className={i === lastI ? 'fill-ga-navy' : 'fill-ga-card stroke-ga-navy'} strokeWidth={2.5} />
          <text x={x(i)} y={H - 12} textAnchor={i === 0 && scores.length > 1 ? 'start' : i === lastI && scores.length > 1 ? 'end' : 'middle'} className="fill-ga-muted font-ga-ui text-ga-caption">
            {fmtd.date(attempts[i].finished_at ?? attempts[i].started_at)}
          </text>
        </g>
      ))}
      <text x={x(lastI)} y={y(scores[lastI]) - 12} textAnchor="middle" className="fill-ga-ink font-ga-ui text-ga-small font-bold">{fmt(scores[lastI])}</text>
    </svg>
  )
}
