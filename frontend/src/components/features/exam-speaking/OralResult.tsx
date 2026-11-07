'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight, AudioLines, ChevronRight, CircleAlert, CircleCheck, CircleX, Loader2, MessageCircle, Mic, RotateCcw, Users, type LucideIcon } from 'lucide-react'
import { examSpeakingApi } from '@/lib/examSpeakingApi'
import { getErrorSnippet } from '@/lib/errors/errorTaxonomy'
import { useFmt } from '@/lib/i18n/useFmt'
import { cn } from '@/lib/utils'
import type { BlueprintSummary, ExamResultView, RoomLine } from '@/types/exam-speaking'
import { Ergebnisbogen } from './Ergebnisbogen'
import { ExamTranscript } from './ExamTranscript'

interface Props {
  result: ExamResultView
  blueprint: BlueprintSummary | null
  sessionId: number
  againHref: string
  returnHref: string
}

const TEIL_ICON: Record<number, LucideIcon> = { 1: MessageCircle, 2: MessageCircle, 3: Users }
const fmt = (n: number) => Number(n.toFixed(2)).toString()

type Review = { state: 'closed' } | { state: 'loading' } | { state: 'error' } | { state: 'open'; lines: RoomLine[] }

/**
 * Kết quả thi thử phần nói (mẫu 07/11/2026, Đợt 3): tiêu đề là kết luận, ô điểm "Ước tính" có vạch
 * ngưỡng, điểm từng Teil kèm nhận xét của giám khảo + các tiêu chí chung (phát âm…), "Xem lại hội
 * thoại" (lời đã lưu + lỗi theo Teil), phiếu chấm chi tiết thu gọn, nút về nơi đã vào.
 */
export function OralResult({ result, blueprint, sessionId, againHref, returnHref }: Props) {
  const t = useTranslations('v2.student.examSpeaking.room.oral.result')
  const fmtd = useFmt()
  const sheet = result.scoreSheet
  const total = result.total ?? sheet.total ?? 0
  const max = result.max ?? sheet.maxPoints ?? 0
  // Ngưỡng riêng phần nói (telc B1: 45/75) chỉ khi điểm cùng thang với blueprint.
  const min = blueprint && blueprint.speakingOnlyMin > 0 && Math.abs(blueprint.maxTotal - max) < 0.01 ? blueprint.speakingOnlyMin : null
  const borderline = !!(result.borderline ?? sheet.borderline)
  const passed = result.passed ?? sheet.passed
  const diff = min != null ? total - min : null
  const pct = max > 0 ? Math.min(100, Math.round((total / max) * 100)) : 0
  // Phiếu cũ có thể thiếu trường — mọi chỗ đọc phiếu đều chịu được dữ liệu thiếu.
  const range = sheet.totalLow != null && sheet.totalHigh != null && sheet.totalLow !== sheet.totalHigh ? `${fmt(sheet.totalLow)}–${fmt(sheet.totalHigh)}` : null
  const titles = Object.fromEntries((blueprint?.parts ?? []).map((p) => [p.teilNo, p.title]))

  const title = borderline
    ? t('titleBorderline')
    : passed === true
      ? diff != null && diff > 0
        ? t('titlePassBy', { n: fmt(diff) })
        : t('titlePass')
      : passed === false
        ? diff != null && diff < 0
          ? t('titleFailBy', { n: fmt(-diff) })
          : t('titleFail')
        : t('titleScore', { total: fmt(total), max: fmt(max) })
  const tone = borderline ? 'warn' : passed === true ? 'ok' : passed === false ? 'bad' : 'plain'
  const statusLabel = borderline ? t('statusBorderline') : passed === true ? t('statusPass') : passed === false ? t('statusFail') : t('statusNone')
  const StatusIcon = tone === 'ok' ? CircleCheck : tone === 'bad' ? CircleX : CircleAlert

  const [review, setReview] = useState<Review>({ state: 'closed' })
  const openReview = async () => {
    if (review.state === 'open') {
      setReview({ state: 'closed' })
      return
    }
    setReview({ state: 'loading' })
    try {
      const { data } = await examSpeakingApi.getTranscript(sessionId)
      setReview({ state: 'open', lines: data.map((l) => ({ id: `t${l.seq}`, role: l.role, text: l.text, teilNo: l.teilNo, eval: l.eval })) })
    } catch {
      setReview({ state: 'error' })
    }
  }
  const backIsToday = returnHref === '/v2/student/exam'

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-7" data-testid="oral-result">
      <header>
        <p className="ga-ui inline-flex items-center gap-1.5 text-ga-caption font-semibold uppercase tracking-wide text-ga-muted">
          <Mic size={14} aria-hidden /> <span lang="de">Mündliche Prüfung</span> · {result.provider === 'GOETHE' ? 'Goethe' : 'telc'} {result.level} ·{' '}
          {fmtd.date(result.createdAt)}
        </p>
        <h1 className="mt-1 font-ga-display text-ga-h1 text-ga-ink" data-testid="oral-result-title">
          {title}
        </h1>
      </header>

      <section className="rounded-ga-touch border border-ga-line bg-ga-card p-5" aria-label={t('scoreLabel')} data-testid="oral-result-score">
        <p className="font-ga-display text-ga-display-m tabular-nums text-ga-ink">
          {fmt(total)} <small className="text-ga-h2 text-ga-muted">/ {fmt(max)}</small>
        </p>
        <div className="relative mt-3 h-2.5 rounded-ga-pill bg-ga-side-active" role="img" aria-label={t('barLabel', { pct })}>
          <span
            className={cn('absolute inset-y-0 left-0 rounded-ga-pill', tone === 'ok' ? 'bg-ga-green' : tone === 'bad' ? 'bg-ga-red' : tone === 'warn' ? 'bg-ga-warning' : 'bg-ga-navy')}
            style={{ width: `${pct}%` }}
          />
          {min != null && max > 0 && (
            <span aria-hidden className="absolute -inset-y-1 w-0.5 bg-ga-ink" style={{ left: `${Math.round((min / max) * 100)}%` }} />
          )}
        </div>
        <p
          className={cn(
            'ga-ui mt-3 inline-flex items-center gap-1.5 text-ga-body font-semibold',
            tone === 'ok' ? 'text-ga-green' : tone === 'bad' ? 'text-ga-red' : tone === 'warn' ? 'text-ga-warning' : 'text-ga-ink',
          )}
          data-testid="oral-result-status"
        >
          <StatusIcon size={17} aria-hidden /> {statusLabel}
          {min != null && <span className="font-normal text-ga-muted">· {t('needMin', { n: fmt(min) })}</span>}
        </p>
        {range && <p className="ga-ui mt-1 text-ga-small text-ga-muted">{t('range', { range })}</p>}
        <p className="ga-ui mt-2 text-ga-small text-ga-muted">{t('estimateNote')}</p>
      </section>

      <section aria-labelledby="oral-parts-title">
        <h2 id="oral-parts-title" className="mb-3 font-ga-display text-ga-h2 text-ga-ink">
          {t('partsTitle')}
        </h2>
        <ul className="border-t border-ga-line">
          {(sheet.parts ?? []).map((p) => {
            const Icon = TEIL_ICON[p.teilNo] ?? MessageCircle
            return (
              <ScoreRow
                key={p.teilNo}
                icon={Icon}
                title={
                  <>
                    Teil {p.teilNo}
                    {titles[p.teilNo] && (
                      <span lang="de" className="font-normal text-ga-muted">
                        {' '}· {titles[p.teilNo]}
                      </span>
                    )}
                  </>
                }
                sub={p.zeroed ? t('zeroed') : p.comment ?? null}
                points={p.points}
                max={p.max}
                testId={`oral-result-teil-${p.teilNo}`}
              />
            )
          })}
          {(sheet.global ?? [])
            .filter((c) => c.scored)
            .map((c) => (
              <ScoreRow key={c.code} icon={AudioLines} title={<span lang="de">{c.label}</span>} sub={c.band ? t('band', { band: c.band }) : null} points={c.points} max={c.max} testId={`oral-result-global-${c.code}`} />
            ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="oral-review-title">
        <div className="flex flex-wrap items-center gap-3 rounded-ga-touch border border-ga-line bg-ga-card p-4">
          <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-ga bg-ga-navy-soft text-ga-navy">
            <MessageCircle size={18} strokeWidth={1.9} />
          </span>
          <p id="oral-review-title" className="ga-ui min-w-[12rem] flex-1 text-ga-body text-ga-ink">
            {t('reviewDesc')}
          </p>
          <button
            type="button"
            onClick={() => void openReview()}
            aria-expanded={review.state === 'open'}
            className="ga-ui inline-flex min-h-11 items-center gap-2 rounded-ga-touch border border-ga-line bg-ga-card px-4 text-ga-body font-semibold text-ga-ink hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
            data-testid="review-open"
          >
            {review.state === 'loading' ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <AudioLines size={16} aria-hidden />}
            {review.state === 'open' ? t('reviewClose') : t('reviewOpen')}
          </button>
        </div>
        {review.state === 'error' && (
          <p className="ga-ui text-ga-small text-ga-red" role="alert">
            {t('reviewError')}
          </p>
        )}
        {review.state === 'open' && <ReviewPanel lines={review.lines} sheet={sheet} titles={titles} />}
      </section>

      <details className="group rounded-ga-touch border border-ga-line bg-ga-card" data-testid="result-details">
        <summary className="ga-ui flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-ga-body font-semibold text-ga-ink">
          <ChevronRight size={16} className="transition-transform duration-150 group-open:rotate-90" aria-hidden /> {t('details')}
        </summary>
        <div className="border-t border-ga-line p-4">
          <Ergebnisbogen sheet={sheet} />
        </div>
      </details>

      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href={againHref}
          className="ga-ui inline-flex min-h-11 items-center gap-1.5 rounded-ga-touch border border-ga-line bg-ga-card px-4 text-ga-body font-semibold text-ga-ink hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
          data-testid="room-again"
        >
          <RotateCcw size={16} aria-hidden /> {t('again')}
        </Link>
        <Link
          href={returnHref}
          className="ga-ui inline-flex min-h-11 items-center gap-1.5 rounded-ga-touch bg-ga-ink px-5 text-ga-body font-semibold text-ga-bg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2"
          data-testid="room-back"
        >
          {backIsToday ? t('backToday') : t('back')} <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </div>
  )
}

function ScoreRow({ icon: Icon, title, sub, points, max, testId }: { icon: LucideIcon; title: ReactNode; sub: string | null; points: number; max: number; testId: string }) {
  return (
    <li className="grid min-h-16 grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-3.5 border-b border-ga-line px-1 py-2.5" data-testid={testId}>
      <span aria-hidden className="grid h-9 w-9 place-items-center rounded-ga bg-ga-side-active text-ga-muted">
        <Icon size={17} strokeWidth={1.9} />
      </span>
      <span className="ga-ui min-w-0">
        <b className="block text-ga-body font-semibold text-ga-ink">{title}</b>
        {sub && <span className="block text-ga-small text-ga-muted">{sub}</span>}
      </span>
      <span className="ga-ui text-right text-ga-body font-semibold tabular-nums text-ga-ink">
        {fmt(points)}/{fmt(max)}
      </span>
    </li>
  )
}

function ReviewPanel({ lines, sheet, titles }: { lines: RoomLine[]; sheet: ExamResultView['scoreSheet']; titles: Record<number, string> }) {
  const t = useTranslations('v2.student.examSpeaking.room.oral.result')
  const locale = useLocale()
  const errors = sheet.errors ?? []
  const teile = Array.from(new Set(errors.map((e) => e.teilNo))).sort((a, b) => a - b)
  return (
    <div className="flex flex-col gap-5 rounded-ga-touch border border-ga-line bg-ga-card p-4" data-testid="review-panel">
      {lines.length === 0 ? (
        <p className="ga-ui text-ga-body text-ga-muted">{t('reviewEmpty')}</p>
      ) : (
        <ExamTranscript lines={lines} mode="MOCK" teilTitles={titles} />
      )}
      {teile.length > 0 && (
        <div className="border-t border-ga-line pt-4" data-testid="review-errors">
          <h3 className="ga-ui mb-2 text-ga-body font-semibold text-ga-ink">{t('errorsTitle')}</h3>
          {teile.map((n) => (
            <div key={n} className="mb-3">
              <p className="ga-ui text-ga-small font-semibold text-ga-muted">Teil {n}</p>
              <ul className="mt-1 flex flex-col gap-1">
                {errors
                  .filter((e) => e.teilNo === n)
                  .map((e, i) => (
                    <li key={i} className="ga-ui text-ga-small">
                      <span lang="de" className="text-ga-red line-through">
                        {e.original}
                      </span>
                      <span className="mx-1.5 text-ga-muted" aria-hidden>
                        →
                      </span>
                      <span lang="de" className="font-semibold text-ga-green">
                        {e.correction}
                      </span>
                      <span className="ml-1.5 text-ga-caption text-ga-muted">{getErrorSnippet(e.code, locale).title}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
