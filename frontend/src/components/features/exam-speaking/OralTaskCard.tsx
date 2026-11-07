'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronRight, ClipboardList, Lightbulb } from 'lucide-react'
import type { ExamDirective, ExamProvider } from '@/types/exam-speaking'
import { TeilStrategy } from '@/components/exam/strategy/TeilStrategy'
import { StimulusCard } from './StimulusCard'

interface Props {
  directive: ExamDirective
  provider: ExamProvider
  level: string
  /** Gợi ý của bước hiện tại (đã dịch theo locale). */
  hint: string
  notesText: string | null
  /** Drill: hết giờ khuyến nghị của Teil (vẫn nói tiếp được). */
  drillTimeUp: boolean
  /** Nút sang phần kế — null khi không có (Teil cuối của thi thử). */
  advanceLabel: string | null
  onAdvance: () => void
  busy: boolean
}

/**
 * Thẻ đề bên phải phòng thi nói (mẫu 07/11/2026): Teil + tên, đề (StimulusCard), một mẹo của bước
 * hiện tại, chiến thuật Teil, ghi chú nháp, nút sang phần kế. Màn hẹp (<1024px) thẻ thu thành một
 * dòng "Thẻ đề" bấm để mở — giữ MỘT bản DOM cho mọi khổ màn.
 */
export function OralTaskCard({ directive, provider, level, hint, notesText, drillTimeUp, advanceLabel, onAdvance, busy }: Props) {
  const t = useTranslations('v2.student.examSpeaking.room')
  const [open, setOpen] = useState(false)
  return (
    <aside
      className="order-first max-h-[50vh] shrink-0 overflow-y-auto border-b border-ga-line bg-ga-card lg:order-none lg:max-h-none lg:border-b-0 lg:border-l"
      data-testid="oral-task-card"
      data-tour="oral-task"
      aria-label={t('oral.taskCard')}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="ga-ui flex w-full items-center gap-2 px-4 py-2.5 text-left text-ga-body font-semibold text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus lg:hidden"
      >
        <ClipboardList size={16} className="shrink-0 text-ga-navy" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          {t('oral.taskCard')} · {t('teilCap', { n: directive.teilNo })}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-ga-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <div className={`${open ? 'flex' : 'hidden'} flex-col gap-3 px-4 pb-4 lg:flex lg:pt-4`}>
        <div>
          <span className="ga-ui inline-flex items-center gap-1.5 text-ga-caption font-semibold uppercase tracking-wide text-ga-muted">
            <ClipboardList size={14} aria-hidden /> {t('teilCap', { n: directive.teilNo })}
          </span>
          <h2 lang="de" className="mt-1 font-ga-display text-ga-h3 text-ga-ink">
            {directive.title}
          </h2>
        </div>
        <StimulusCard stimulus={directive.stimulus} stepIndex={directive.stepIndex} candidateAction={directive.candidateAction} coveredPoints={directive.coveredPoints} />
        <div className="ga-ui flex gap-2 rounded-ga-touch bg-ga-yellow-soft p-3 text-ga-small text-ga-ink">
          <Lightbulb size={16} className="mt-0.5 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p data-testid="directive-hint">{hint}</p>
            {drillTimeUp && (
              <p className="mt-1.5 font-semibold text-ga-red" data-testid="drill-time-up">
                {t('drillTimeUp')}
              </p>
            )}
          </div>
        </div>
        <TeilStrategy provider={provider} level={level} section="SPRECHEN" teil={directive.teilNo} />
        {notesText && (
          <details className="group rounded-ga-touch border border-ga-line">
            <summary className="ga-ui flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-ga-small font-semibold text-ga-ink">
              <ChevronRight size={14} className="transition-transform duration-150 group-open:rotate-90" aria-hidden />
              {t('myNotes')}
            </summary>
            <p lang="de" className="whitespace-pre-wrap px-3 pb-3 font-ga-display text-ga-body text-ga-muted">
              {notesText}
            </p>
          </details>
        )}
        {advanceLabel && (
          <button
            type="button"
            onClick={onAdvance}
            disabled={busy}
            className="ga-ui mt-1 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-ga-touch border border-ga-line bg-ga-card px-4 text-ga-body font-semibold text-ga-ink hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus disabled:opacity-50"
            data-testid="advance-part"
          >
            {advanceLabel} <ChevronRight size={16} aria-hidden />
          </button>
        )}
      </div>
    </aside>
  )
}
