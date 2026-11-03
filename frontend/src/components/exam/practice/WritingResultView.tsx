'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WritingEvaluation } from '@/lib/telcPracticeApi'
import { essaySegments, labelForLogical, type displayedPoints } from './practiceModel'

const BANDS = ['A', 'B', 'C', 'D'] as const
const CRITERIA = [
  { key: 'leitpunkte', no: 'I', name: 'Erfüllung der Leitpunkte' },
  { key: 'kommunikative_gestaltung', no: 'II', name: 'Kommunikative Gestaltung' },
  { key: 'formale_richtigkeit', no: 'III', name: 'Formale Richtigkeit' },
] as const

interface Props {
  evaluation: WritingEvaluation
  text: string
  points: ReturnType<typeof displayedPoints>
  wide: boolean
}

/**
 * Kết quả chấm Viết của chế độ luyện đề: lỗi chỉ ra NGAY TRONG bài (tô vàng + số; chỗ thiếu ý là
 * nhãn đỏ), mỗi ghi chú có bạn viết → nên viết → vì sao → quy tắc; ba tiêu chí telc với bậc A–D,
 * "vì sao bậc này", "để lên A"; và bài đã sửa để so trước/sau.
 */
export function WritingResultView({ evaluation, text, points, wide }: Props) {
  const t = useTranslations('v2.student.practice')
  const notes = React.useMemo(() => evaluation.annotations ?? [], [evaluation.annotations])
  const [current, setCurrent] = React.useState(0)
  const [showModel, setShowModel] = React.useState(false)
  const [lang, setLang] = React.useState<'vi' | 'de'>('vi')
  const segments = React.useMemo(() => essaySegments(text, notes), [text, notes])

  if (evaluation.status !== 'AI_EVALUATED') {
    return (
      <div className="ga-ui mx-auto max-w-[640px] px-4 py-10 text-center">
        <p className="font-ga-display text-ga-h2 text-ga-ink">{t('aiPendingTitle')}</p>
        <p className="mt-2 text-ga-body text-ga-muted">{evaluation.feedback_vi || t('aiPendingDesc')}</p>
      </div>
    )
  }

  const pct = evaluation.max > 0 ? Math.round((evaluation.total / evaluation.max) * 100) : 0
  const ref = Math.round(evaluation.max * 0.6)
  const note = notes[current]
  const missingLabels = (evaluation.leitpunkte_fehlt ?? []).map((n) => labelForLogical(points, n)).filter(Boolean) as string[]

  const essay = (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-2.5">
        <p className="ga-ui flex-1 text-ga-eyebrow uppercase text-ga-muted">{showModel ? t('modelHint') : t('essayHint')}</p>
        <Seg
          value={showModel ? 'model' : 'mine'}
          onChange={(v) => setShowModel(v === 'model')}
          options={[
            { value: 'mine', label: t('essayMine') },
            ...(evaluation.musterloesung ? [{ value: 'model', label: t('essayModel') }] : []),
          ]}
        />
      </div>
      <div lang="de" className="ga-ui whitespace-pre-wrap break-words border border-ga-line bg-ga-card px-4 py-4 text-ga-body-lg leading-[1.95] text-ga-ink">
        {showModel
          ? evaluation.musterloesung
          : segments.map((s, i) => {
              if (s.kind === 'text') return <span key={i}>{s.value}</span>
              const on = s.note === current
              if (s.kind === 'insert')
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrent(s.note)}
                    className={cn(
                      'mx-1 inline-flex min-h-8 items-center gap-1 rounded-ga-pill border-[1.5px] border-dashed border-ga-red px-2.5 align-middle text-ga-small font-semibold',
                      on ? 'border-solid bg-ga-red text-ga-card' : 'bg-ga-red-soft text-ga-ink',
                    )}
                  >
                    <sup className="font-semibold">{s.note + 1}</sup>
                    {notes[s.note].leitpunkt ? t('missingPointHere', { p: labelForLogical(points, notes[s.note].leitpunkt) ?? '' }) : t('missingHere')}
                  </button>
                )
              return (
                <mark
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => setCurrent(s.note)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setCurrent(s.note))}
                  className={cn(
                    'cursor-pointer rounded-ga px-0.5 text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
                    on ? 'bg-ga-yellow' : 'bg-ga-yellow-soft shadow-[inset_0_-2px_0_var(--ga-yellow)]',
                  )}
                >
                  <sup className="mr-0.5 font-semibold text-ga-navy">{s.note + 1}</sup>
                  {s.value}
                </mark>
              )
            })}
      </div>
    </section>
  )

  const detail = note ? (
    <section className="ga-ui text-ga-body">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-ga-display text-ga-h2 text-ga-ink">{t('noteOf', { n: current + 1, total: notes.length })}</h3>
        <span className="rounded-ga-pill bg-ga-navy-soft px-2.5 py-0.5 text-ga-caption font-semibold text-ga-navy">{t(`cat.${note.category}`)}</span>
        {note.kriterium && <span className="rounded-ga-pill bg-ga-side-active px-2.5 py-0.5 text-ga-caption font-semibold text-ga-muted">{t('criterionShort', { no: note.kriterium })}</span>}
      </div>
      <div className="mb-2.5 rounded-ga-touch bg-ga-red-soft px-3.5 py-3">
        <p className="text-ga-caption font-semibold uppercase tracking-wide text-ga-muted">{note.quote ? t('youWrote') : t('missingPart')}</p>
        <p lang="de" className={cn('mt-1', note.quote && 'line-through decoration-ga-red')}>
          {note.quote ?? (note.leitpunkt ? t('missingPointDesc', { p: labelForLogical(points, note.leitpunkt) ?? '' }) : t('missingDesc'))}
        </p>
      </div>
      {note.correction && (
        <div className="mb-2.5 rounded-ga-touch bg-ga-green-soft px-3.5 py-3">
          <p className="text-ga-caption font-semibold uppercase tracking-wide text-ga-muted">{t('shouldWrite')}</p>
          <p lang="de" className="mt-1 font-semibold text-ga-ink">{note.correction}</p>
        </div>
      )}
      <div className="mb-3 rounded-ga-touch border border-ga-line bg-ga-bg px-3.5 py-3">
        <p className="text-ga-caption font-semibold uppercase tracking-wide text-ga-muted">{t('why')}</p>
        <p className="mt-1 leading-relaxed text-ga-ink">{note.whyVi}</p>
        {note.ruleVi && (
          <p className="mt-2">
            <span className="rounded-ga-pill bg-ga-navy-soft px-2.5 py-0.5 text-ga-caption font-semibold text-ga-navy">{note.ruleVi}</span>
          </p>
        )}
      </div>
      {notes.length > 1 && (
        <div className="flex gap-2">
          <NavBtn onClick={() => setCurrent((c) => (c - 1 + notes.length) % notes.length)}>
            <ChevronLeft size={15} aria-hidden /> {t('notePrev')}
          </NavBtn>
          <NavBtn onClick={() => setCurrent((c) => (c + 1) % notes.length)}>
            {t('noteNext')} <ChevronRight size={15} aria-hidden />
          </NavBtn>
        </div>
      )}
    </section>
  ) : (
    <p className="ga-ui text-ga-body text-ga-muted">{t('noNotes')}</p>
  )

  const criteria = (
    <section>
      <p className="ga-ui mb-2.5 text-ga-eyebrow uppercase text-ga-muted">{t('criteriaTitle')}</p>
      {CRITERIA.map((c) => {
        const row = evaluation.criteria?.find((r) => r.key === c.key)
        if (!row) return null
        const band = row.band ?? evaluation.bands?.[c.key] ?? null
        return (
          <article key={c.key} className="ga-ui mb-2.5 border border-ga-line bg-ga-card px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <h4 className="min-w-[12rem] flex-1 text-ga-body font-semibold text-ga-ink">
                {c.no} · <span lang="de">{c.name}</span>
                <span className="block text-ga-small font-normal text-ga-muted">{t(`crit.${c.key}`)}</span>
              </h4>
              <div className="flex gap-1" aria-label={t('bandIs', { band: band ?? '–' })}>
                {BANDS.map((b) => (
                  <span key={b} className={cn('grid h-7 w-7 place-items-center rounded-ga text-ga-caption font-semibold', b === band ? 'bg-ga-ink text-ga-card' : 'bg-ga-side-active text-ga-subtle')}>
                    {b}
                  </span>
                ))}
              </div>
              <span className="min-w-[3.5rem] text-right font-ga-display text-ga-h2 tabular-nums text-ga-ink">
                {row.score}
                <span className="text-ga-small text-ga-muted">/{row.max}</span>
              </span>
            </div>
            {c.key === 'leitpunkte' && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {points.map((p) => {
                  const missing = missingLabels.includes(p.label)
                  return (
                    <span key={p.label} className={cn('inline-flex items-center gap-1 rounded-ga-pill px-2.5 py-0.5 text-ga-caption font-semibold text-ga-ink', missing ? 'bg-ga-red-soft' : 'bg-ga-green-soft')}>
                      {missing ? <X size={12} aria-hidden /> : <Check size={12} aria-hidden />}
                      {p.label}
                    </span>
                  )
                })}
              </div>
            )}
            {c.key === 'kommunikative_gestaltung' && (evaluation.kein_a_weil?.length ?? 0) > 0 && (
              <p className="mt-2 text-ga-small text-ga-ink">
                <span className="text-ga-muted">{t('noAWhy')} </span>
                {evaluation.kein_a_weil!.map((r) => t(`noA.${r}`)).join(' · ')}
              </p>
            )}
            {band && band !== 'A' && c.key === 'leitpunkte' && missingLabels.length > 0 && (
              <p className="mt-2 text-ga-small text-ga-ink">
                <span className="text-ga-muted">{t('toReachA')} </span>
                {t('toReachALeitpunkte', { list: missingLabels.join(', ') })}
              </p>
            )}
          </article>
        )
      })}
    </section>
  )

  const overall = (
    <details open={wide} className="ga-ui mt-3 rounded-ga-touch border border-ga-line bg-ga-card">
      <summary className="flex min-h-11 cursor-pointer list-none items-center px-3 text-ga-small font-semibold">{t('overall')}</summary>
      <div className="px-3 pb-3 text-ga-body">
        <Seg
          value={lang}
          onChange={(v) => setLang(v as 'vi' | 'de')}
          options={[
            { value: 'vi', label: 'Tiếng Việt' },
            { value: 'de', label: 'Deutsch' },
          ]}
        />
        <p lang={lang} className="mt-2 leading-relaxed text-ga-ink">{lang === 'vi' ? evaluation.feedback_vi : evaluation.feedback_de}</p>
        {(evaluation.strengths?.length ?? 0) > 0 && (
          <>
            <p className="mt-3 text-ga-caption font-semibold uppercase tracking-wide text-ga-muted">{t('strengths')}</p>
            <ul className="mt-1 list-disc pl-5">{evaluation.strengths!.map((s) => <li key={s}>{s}</li>)}</ul>
          </>
        )}
        {(evaluation.improvements?.length ?? 0) > 0 && (
          <>
            <p className="mt-3 text-ga-caption font-semibold uppercase tracking-wide text-ga-muted">{t('improvements')}</p>
            <ul className="mt-1 list-disc pl-5">{evaluation.improvements!.map((s) => <li key={s}>{s}</li>)}</ul>
          </>
        )}
      </div>
    </details>
  )

  const header = (
    <div className="ga-ui mb-4 flex flex-wrap items-center gap-4 border border-ga-line bg-ga-card px-4 py-3">
      <span className="font-ga-display text-ga-stat-m tabular-nums text-ga-ink">
        {evaluation.total} <span className="text-ga-body text-ga-muted">/ {evaluation.max}</span>
      </span>
      <p className="text-ga-small text-ga-muted">
        <b className="text-ga-ink">{t('writingPct', { pct })}</b> · {t('writingRef', { ref })}
        <br />
        {t('bandScale')}
      </p>
    </div>
  )

  if (!wide) {
    return (
      <div className="mx-auto w-full max-w-[760px] px-3 py-4">
        {header}
        {essay}
        {!showModel && <div className="mt-4">{detail}</div>}
        <div className="mt-5">{criteria}</div>
        {overall}
      </div>
    )
  }
  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_440px]">
      <div className="min-h-0 overflow-y-auto px-6 py-5">
        {header}
        {essay}
        <div className="mt-5">{criteria}</div>
      </div>
      <aside className="min-h-0 overflow-y-auto border-l border-ga-line bg-ga-card px-5 py-5">
        {showModel ? <p className="ga-ui text-ga-body text-ga-ink">{t('modelExplain')}</p> : detail}
        {overall}
      </aside>
    </div>
  )
}

function NavBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ga-ui inline-flex min-h-10 items-center gap-1 rounded-ga-touch border-[1.5px] border-ga-line-strong bg-ga-card px-3 text-ga-small font-semibold hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
    >
      {children}
    </button>
  )
}

export function Seg({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  if (options.length < 2) return null
  return (
    <div className="ga-ui inline-flex overflow-hidden rounded-ga-touch border-[1.5px] border-ga-line-strong bg-ga-card">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-10 whitespace-nowrap px-3 text-ga-small font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus',
            value === o.value ? 'bg-ga-ink font-semibold text-ga-card' : 'text-ga-ink hover:bg-ga-side-active',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
