'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft, BookOpen, EyeOff, FileText, Headphones, Layers, Lock, Mic, PenLine, PenTool, Play, Timer, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Glyph } from '@/components/exam/today/visual'
import { modeMinutes, TELC_B1_PARTS, type ModeId } from './mockModel'

const MODES: { id: ModeId; icon: LucideIcon }[] = [
  { id: 'all', icon: Layers },
  { id: 'written', icon: PenLine },
  { id: 'oral', icon: Mic },
]
const PART_ICON: Record<string, LucideIcon> = { LESEN: BookOpen, HOEREN: Headphones, SCHREIBEN: PenTool, SPRECHEN: Mic }
const RULES: { key: string; icon: LucideIcon }[] = [
  { key: 'ruleTimer', icon: Timer },
  { key: 'ruleHoeren', icon: Lock },
  { key: 'ruleNoAnswers', icon: EyeOff },
]

interface Props {
  examTitle: string
  /** Điểm tối đa từng phần lấy từ đề khi có; không có thì theo định dạng telc B1. */
  points?: Partial<Record<string, number>>
  running: boolean
  backHref: string
  oralHref: string
  onStart: (mode: ModeId) => void
}

/**
 * Màn trước khi thi thử: chọn kiểu lượt (Trọn đề · Phần viết · Phần nói), danh sách phần thi (phần
 * không thi mờ đi), ba quy tắc, nút bắt đầu. Trọn đề = phần viết rồi tới phòng thi nói; điểm nói tự
 * vào ngưỡng Nói của lượt thi. Phần nói thi ở phòng thi nói AI.
 */
export function MockStart({ examTitle, points, running, backHref, oralHref, onStart }: Props) {
  const t = useTranslations('v2.student.fullExam.start')
  const [mode, setMode] = React.useState<ModeId>('written')
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const n = (i + d + MODES.length) % MODES.length
    setMode(MODES[n].id)
    refs.current[n]?.focus()
  }

  const startLabel = mode === 'oral' ? t('startOral') : running ? t('continueWritten') : mode === 'all' ? t('startAll') : t('startWritten')
  const btn =
    'group ga-ui inline-flex min-h-12 items-center gap-2 rounded-ga-touch bg-ga-ink px-5 text-ga-body font-semibold text-ga-card transition-[transform,filter] duration-150 hover:-translate-y-px hover:brightness-110 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2'

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-7 px-4 py-6 sm:px-6 lg:py-8">
      <Link
        href={backHref}
        className="ga-ui -mb-4 inline-flex min-h-9 items-center gap-1.5 self-start text-ga-small font-semibold text-ga-navy underline decoration-1 underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
      >
        <ArrowLeft size={15} aria-hidden /> {t('back')}
      </Link>
      <header>
        <p className="ga-ui inline-flex items-center gap-1.5 text-ga-eyebrow uppercase text-ga-muted">
          <FileText size={14} aria-hidden /> {t('eyebrow')}
        </p>
        <h1 className="mt-1 break-words font-ga-display text-ga-h1 text-ga-ink">{examTitle}</h1>
      </header>

      <div role="radiogroup" aria-label={t('modeLabel')} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {MODES.map((m, i) => {
          const on = mode === m.id
          return (
            <button
              key={m.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => setMode(m.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                'ga-ui flex min-h-16 items-center gap-3 rounded-ga-touch border-[1.5px] bg-ga-card p-3.5 text-left transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2',
                on ? 'border-ga-ink ring-1 ring-inset ring-ga-ink' : 'border-ga-line hover:border-ga-line-strong',
              )}
            >
              <Glyph icon={m.icon} tone={on ? 'ink' : 'plain'} />
              <span className="min-w-0">
                <b className="block text-ga-body font-semibold text-ga-ink">{t(`mode.${m.id}`)}</b>
                <span className="block text-ga-small tabular-nums text-ga-muted">
                  {m.id === 'written' ? t('minutes', { n: modeMinutes(m.id) }) : t('aboutMinutes', { n: modeMinutes(m.id) })}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <ul className="border-t border-ga-line" aria-label={t('partsLabel')}>
        {TELC_B1_PARTS.map((p) => {
          const off = mode === 'oral' ? !p.oral : mode === 'written' ? p.oral : false
          const pts = points?.[p.id] ?? p.points
          return (
            <li
              key={p.id}
              aria-hidden={off || undefined}
              className={cn('ga-ui grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 border-b border-ga-line px-1 py-2.5 text-ga-body transition-opacity duration-200', off && 'opacity-35')}
            >
              <Glyph icon={PART_ICON[p.id]} size="sm" />
              <span lang="de" className="text-ga-ink">{t(`part.${p.id}`)}</span>
              <span className="whitespace-nowrap text-ga-small tabular-nums text-ga-muted">
                {p.id === 'LESEN' ? t('partMeta', { m: p.minutes, p: pts }) : t('partMetaAbout', { m: p.minutes, p: pts })}
              </span>
            </li>
          )
        })}
      </ul>

      {mode !== 'oral' && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {RULES.map((r) => (
            <li key={r.key} className="ga-ui flex items-start gap-2.5 text-ga-small text-ga-muted">
              <Glyph icon={r.icon} size="sm" tone="plain" />
              <span className="pt-1">{t(r.key)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {mode === 'oral' ? (
          <Link href={oralHref} className={btn}>
            <Play size={17} aria-hidden /> {startLabel}
          </Link>
        ) : (
          <button type="button" onClick={() => onStart(mode)} className={btn}>
            <Play size={17} aria-hidden /> {startLabel}
          </button>
        )}
        {running && mode !== 'oral' && <span className="ga-ui text-ga-small text-ga-muted">{t('runningNote')}</span>}
        {mode === 'all' && <span className="ga-ui text-ga-small text-ga-muted">{t('allNote')}</span>}
      </div>
    </div>
  )
}
