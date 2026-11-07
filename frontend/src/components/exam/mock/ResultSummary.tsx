'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, CalendarCheck, ChevronRight, CircleAlert, CircleCheck, FileText, Play, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFmt } from '@/lib/i18n/useFmt'
import { sectionScores, type AttemptAnalysis, type AttemptResult } from '@/lib/exam/mockAttemptApi'
import { ExamBudgetPanel } from '@/components/exam/telc/ExamBudgetPanel'
import type { FullTeil } from '@/components/exam/practice/fullExamModel'
import type { PracticeTeilResult } from '@/lib/telcPracticeApi'
import { Bar, Glyph, SECTION_ICON } from '@/components/exam/today/visual'
import { TourHelpButton, useScreenTour } from '@/components/exam/tour/ScreenTour'
import { examPlanApi } from '@/lib/examPlanApi'
import { gateView, lostRows, type GateView } from './mockModel'

const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 })

/** Đếm từ 0 tới `to` trong 900ms; giảm chuyển động hoặc đã xem rồi thì hiện số ngay. */
function useCountUp(to: number, animate: boolean): number {
  const [v, setV] = React.useState(animate ? 0 : to)
  React.useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!animate || reduce) {
      setV(to)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 900)
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to, animate])
  return v
}

interface Props {
  attemptId: number
  result: AttemptResult
  analysis: AttemptAnalysis
  teile: FullTeil[]
  byKey: Map<string, PracticeTeilResult>
  onOpen: (key: string) => void
  oralHref: string
  hubHref: string
}

/**
 * Kết quả thi thử (đợt (d)): tiêu đề là kết luận; hai ô điểm (phần viết · phần nói) có thanh và vạch
 * ngưỡng, nhãn "Ước tính"; "Lấy lại điểm" — ba chỗ mất nhiều điểm nhất, bấm mở Teil ở chế độ xem lại;
 * bảng điểm từng phần thu gọn; khép lại bằng "Về hôm nay". Hiệu ứng đếm điểm chỉ chạy lần đầu mở.
 */
export function ResultSummary({ attemptId, result, analysis, teile, byKey, onOpen, oralHref, hubHref }: Props) {
  const t = useTranslations('v2.student.fullExam.result')
  const tp = useTranslations('v2.student.practice')
  const fmtd = useFmt()
  const tt = useTranslations('v2.student.tour')
  const tour = useScreenTour({
    key: 'exam.result',
    ready: true,
    steps: [
      { target: 'scores', icon: CircleCheck, title: tt('result.scores.t'), body: tt('result.scores.p') },
      { target: 'lost', icon: RotateCcw, title: tt('result.lost.t'), body: tt('result.lost.p') },
    ],
  })
  // Có lịch ôn thật thì mới nói "lịch đã tính lại" (nghiệm thu prod 07/11/2026: tài khoản chưa có
  // ngày thi từng thấy câu này).
  const [planActive, setPlanActive] = React.useState<boolean | null>(null)
  React.useEffect(() => {
    let alive = true
    examPlanApi
      .get()
      .then((p) => alive && setPlanActive(p?.status === 'ACTIVE'))
      .catch(() => alive && setPlanActive(false))
    return () => {
      alive = false
    }
  }, [])
  const [first] = React.useState(() => {
    try {
      const k = `df.mock.resultSeen.${attemptId}`
      const seen = window.localStorage.getItem(k) === '1'
      window.localStorage.setItem(k, '1')
      return !seen
    } catch {
      return false
    }
  })

  const written = gateView(result.gates, 'written')
  const oral = gateView(result.gates, 'oral')
  const scores = sectionScores(result.detailed_scores_json)
  const rows = lostRows(result.budget)
  const missingPoints = analysis.writing?.leitpunkte_fehlt?.length ?? 0
  const examTitle = result.exam_title ?? result.title ?? ''
  const when = result.finished_at ?? result.started_at

  let heading: string
  if (written && written.margin != null) {
    heading =
      written.margin > 0
        ? t('headPass', { n: fmt(written.margin) })
        : written.margin === 0
          ? t('headPassExact')
          : t('headFail', { n: fmt(-written.margin) })
  } else {
    heading = result.passed ? t('headPassPlain') : t('headDone')
  }

  const reasonOf = (r: (typeof rows)[number]) => {
    if (r.section === 'SCHREIBEN') {
      if (!analysis.writingText?.trim()) return t('lostWritingEmpty')
      return missingPoints > 0 ? t('lostMissing', { n: missingPoints }) : t('lostWriting')
    }
    if (r.wrong != null && r.items != null) return t('lostWrong', { wrong: r.wrong, total: r.items })
    return t('lostPoints')
  }
  const nameOf = (section: string, teil: number) =>
    section === 'SCHREIBEN' ? 'Schreiben' : `${tp(`sectionDe.${section}`)} · Teil ${teil}`

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-7 px-4 py-6 sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="ga-ui text-ga-eyebrow uppercase text-ga-muted">
            {examTitle}
            {when && <> · {fmtd.date(when)}</>}
          </p>
          <h1 className="mt-1 break-words font-ga-display text-ga-h1 text-ga-ink">{heading}</h1>
        </div>
        <TourHelpButton onClick={tour.start} />
      </header>
      {tour.overlay}

      <div>
        <div data-tour="scores" className="grid grid-cols-1 border-y border-ga-line sm:grid-cols-2">
          <ScoreBox label={t('written')} gate={written} animate={first} />
          <ScoreBox
            label={t('oral')}
            gate={oral}
            animate={first}
            className="border-t border-ga-line sm:border-l sm:border-t-0 sm:pl-7"
            action={
              oral?.status === 'PENDING' || !oral ? (
                <Link
                  href={oralHref}
                  className="ga-ui inline-flex min-h-10 items-center gap-1.5 self-start text-ga-small font-semibold text-ga-navy underline decoration-1 underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
                >
                  <Play size={14} aria-hidden /> {t('takeOral')}
                </Link>
              ) : null
            }
          />
        </div>
        <p className="ga-ui mt-2 text-ga-small text-ga-muted">{t('estimateNote')}</p>
      </div>

      {rows.length > 0 && (
        <section aria-labelledby="lost-title" data-tour="lost">
          <h2 id="lost-title" className="mb-3 font-ga-display text-ga-h2 text-ga-ink">{t('lostTitle')}</h2>
          <ul className="border-t border-ga-line">
            {rows.map((r, i) => (
              <li key={r.key} className={first ? 'ga-rise' : undefined} style={first ? { animationDelay: `${i * 60}ms` } : undefined}>
                <button
                  type="button"
                  onClick={() => onOpen(r.key)}
                  className="group ga-ui grid min-h-16 w-full grid-cols-[36px_minmax(0,1fr)_64px_18px] items-center gap-3.5 border-b border-ga-line px-1 py-2.5 text-left transition-colors duration-150 hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus"
                >
                  <Glyph icon={SECTION_ICON[r.section] ?? FileText} />
                  <span className="min-w-0">
                    <b lang="de" className="block truncate text-ga-body font-semibold text-ga-ink">{nameOf(r.section, r.teil)}</b>
                    <span className="block truncate text-ga-small text-ga-muted">{reasonOf(r)}</span>
                  </span>
                  <span className="text-right font-ga-display text-ga-h3 font-bold tabular-nums text-ga-red">−{fmt(r.lost)}</span>
                  <ChevronRight size={16} className="text-ga-subtle transition-transform duration-150 group-hover:translate-x-[3px]" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="group/more border-y border-ga-line">
        <summary className="ga-ui flex min-h-12 cursor-pointer list-none items-center gap-2 text-ga-body font-semibold text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus [&::-webkit-details-marker]:hidden">
          <ChevronRight size={16} className="text-ga-subtle transition-transform duration-200 group-open/more:rotate-90" aria-hidden />
          {t('detailTitle')}
        </summary>
        <div className="space-y-5 pb-5">
          <div className="overflow-x-auto">
            <table className="ga-ui w-full min-w-[320px] text-ga-small">
              <thead>
                <tr className="border-b border-ga-line text-left text-ga-muted">
                  <th className="py-2 font-semibold">{t('colPart')}</th>
                  <th className="py-2 text-right font-semibold">{t('colScore')}</th>
                  <th className="py-2 text-right font-semibold">{t('colMax')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(scores).map(([section, s]) => (
                  <tr key={section} className="border-b border-ga-line last:border-b-0">
                    <td lang="de" className="py-2 text-ga-ink">{tp.has(`sectionDe.${section}`) ? tp(`sectionDe.${section}`) : section}</td>
                    <td className="py-2 text-right tabular-nums text-ga-ink">{fmt(s.total)}</td>
                    <td className="py-2 text-right tabular-nums text-ga-muted">{fmt(s.max)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="ga-ui mb-1 text-ga-eyebrow uppercase text-ga-muted">{t('reviewTitle')}</h3>
            <ul className="border-t border-ga-line">
              {teile.map((x) => {
                const r = byKey.get(x.key)
                const isWriting = x.section === 'SCHREIBEN'
                const s = scores[x.section]
                const meta = isWriting
                  ? analysis.writing && analysis.writing.status !== 'PENDING_AI_EVALUATION'
                    ? t('rowWriting', { score: fmt(s?.total ?? analysis.writing.total ?? 0), max: fmt(s?.max ?? 45) })
                    : t('writingPending')
                  : r
                    ? t('rowCorrect', { done: r.correctCount, total: r.total })
                    : ''
                return (
                  <li key={x.key}>
                    <button
                      type="button"
                      onClick={() => onOpen(x.key)}
                      className="group ga-ui flex min-h-12 w-full items-center gap-3 border-b border-ga-line px-1 py-2 text-left hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus"
                    >
                      <span lang="de" className="w-36 shrink-0 text-ga-small text-ga-muted">{tp(`sectionDe.${x.section}`)} {x.no}</span>
                      <span className="min-w-0 flex-1 truncate text-ga-small text-ga-ink">{meta}</span>
                      <ChevronRight size={15} className="shrink-0 text-ga-subtle" aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          {result.budget && <ExamBudgetPanel budget={result.budget} strategyExam={{ provider: 'TELC', level: 'B1' }} />}
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 bg-ga-side-active p-4">
        <p className="ga-ui flex min-w-[220px] flex-1 items-center gap-2.5 text-ga-body text-ga-ink">
          <Glyph icon={CalendarCheck} size="sm" /> {planActive === null ? null : planActive ? t('planUpdated') : t('planNoDate')}
        </p>
        <Link
          href={hubHref}
          className="group ga-ui inline-flex min-h-12 items-center gap-2 rounded-ga-touch bg-ga-ink px-5 text-ga-body font-semibold text-ga-card transition-[transform,filter] duration-150 hover:-translate-y-px hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2"
        >
          {t('backToday')} <ArrowRight size={17} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  )
}

function ScoreBox({
  label,
  gate,
  animate,
  className,
  action,
}: {
  label: string
  gate: GateView | null
  animate: boolean
  className?: string
  action?: React.ReactNode
}) {
  const t = useTranslations('v2.student.fullExam.result')
  const has = !!gate && gate.status !== 'PENDING'
  const shown = useCountUp(has ? Math.round(gate!.raw) : 0, animate && has)
  const ok = gate?.status === 'PASSED'
  return (
    <div className={cn('flex flex-col gap-2.5 px-1 py-5', className)}>
      <span className="ga-ui text-ga-eyebrow uppercase text-ga-muted">{label}</span>
      <span className={cn('font-ga-display text-ga-stat leading-none tabular-nums', has ? 'text-ga-ink' : 'text-ga-muted')}>
        {has ? (animate ? shown : fmt(gate!.raw)) : '–'} <small className="ga-ui text-ga-body font-medium text-ga-muted">/ {gate ? fmt(gate.max) : '–'}</small>
      </span>
      <Bar pct={has ? gate!.pct : null} mark={gate?.markPct ?? 60} />
      {has && (
        <span className={cn('ga-ui inline-flex items-center gap-1.5 text-ga-small font-semibold', ok ? 'text-ga-green' : 'text-ga-red', animate && 'ga-pop')}>
          {ok ? <CircleCheck size={15} aria-hidden /> : <CircleAlert size={15} aria-hidden />}
          {t(ok ? 'statusPass' : 'statusFail', { min: fmt(gate!.min) })}
        </span>
      )}
      {action}
    </div>
  )
}
