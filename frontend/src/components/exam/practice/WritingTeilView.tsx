'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { WritingStimulus } from '@/components/exam/telc/WritingStimulus'
import { isWritingStimulus } from '@/components/exam/telc/writingTask'
import { wordCount, type displayedPoints, type PracticeTeilData } from './practiceModel'
import { Seg } from './WritingResultView'
import { SplitPanes } from './SplitPanes'

/** Cụm hay dùng trong thư bạn bè telc B1 — chèn vào CHỖ CON TRỎ. */
const REDEMITTEL = [
  'Vielen Dank für deine E-Mail!',
  'Ich freue mich, dass …',
  'Leider kann ich nicht kommen, weil …',
  'Deshalb …',
  'Außerdem …',
  'Hast du Lust, …?',
  'Viele Grüße',
]

const TARGET_WORDS = 80

interface Props {
  teil: PracticeTeilData
  points: ReturnType<typeof displayedPoints>
  text: string
  onText: (v: string) => void
  ticks: Record<string, boolean>
  onTick: (label: string, on: boolean) => void
  wide: boolean
  tips: React.ReactNode
  textareaRef: React.RefObject<HTMLTextAreaElement>
}

/**
 * Màn viết của chế độ luyện đề: đề (thư cần trả lời + 4 điểm P1–P4 theo thứ tự in đã xáo) và ô viết
 * cạnh nhau trên máy tính; trên điện thoại là hai thẻ „Đề bài | Bài viết" để không phải cuộn qua đề
 * mới tới ô viết. Người học tự đánh dấu điểm đã viết — không tốn AI, và là lời nhắc trước khi chấm.
 */
export function WritingTeilView({ teil, points, text, onText, ticks, onTick, wide, tips, textareaRef }: Props) {
  const t = useTranslations('v2.student.practice')
  const [tab, setTab] = React.useState<'task' | 'write'>('write')
  const words = wordCount(text)

  const insert = (phrase: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart ?? text.length
    const end = ta.selectionEnd ?? start
    const before = text.slice(0, start)
    const pad = before && !/\s$/.test(before) ? ' ' : ''
    const next = before + pad + phrase + text.slice(end)
    onText(next)
    const pos = (before + pad + phrase).length
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(pos, pos)
    })
  }

  const pointList = (
    <ul className="space-y-2">
      {points.map((p) => (
        <li key={p.label}>
          <label
            className={cn(
              'ga-ui flex min-h-12 cursor-pointer items-start gap-3 rounded-ga-touch border px-3 py-2.5 text-ga-body',
              ticks[p.label] ? 'border-ga-navy-soft bg-ga-navy-soft' : 'border-ga-line bg-ga-card',
            )}
          >
            <input
              type="checkbox"
              checked={!!ticks[p.label]}
              onChange={(e) => onTick(p.label, e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ga-navy)]"
            />
            <span className="w-7 shrink-0 font-semibold text-ga-navy">{p.label}</span>
            <span lang="de" className="min-w-0 flex-1 text-ga-ink">{p.text}</span>
          </label>
        </li>
      ))}
    </ul>
  )

  const task = (
    <div data-tour="task">
      {tips}
      {teil.instruction_de && <p lang="de" className="ga-ui text-ga-body text-ga-ink">{teil.instruction_de}</p>}
      {teil.instruction_vi && <p className="ga-ui mb-4 mt-1 text-ga-small text-ga-muted">{teil.instruction_vi}</p>}
      {isWritingStimulus(teil.stimulus) && (
        <div className="mb-4">
          <WritingStimulus stimulus={teil.stimulus} />
        </div>
      )}
      <p className="ga-ui mb-2 text-ga-eyebrow uppercase text-ga-muted">{t('pointsTitle')}</p>
      {pointList}
    </div>
  )

  const editor = (
    <div className="flex h-full flex-col">
      {!wide && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {points.map((p) => (
            <button
              key={p.label}
              type="button"
              aria-pressed={!!ticks[p.label]}
              onClick={() => onTick(p.label, !ticks[p.label])}
              title={p.text}
              className={cn(
                'ga-ui min-h-9 rounded-ga-pill border-[1.5px] px-3 text-ga-small font-semibold',
                ticks[p.label] ? 'border-ga-navy bg-ga-navy text-ga-card' : 'border-ga-line-strong bg-ga-card text-ga-ink',
              )}
            >
              {ticks[p.label] && <Check size={14} aria-hidden className="mr-1 inline align-[-2px]" />}
              {p.label}
            </button>
          ))}
        </div>
      )}
      {wide && <p className="ga-ui mb-2 text-ga-eyebrow uppercase text-ga-muted">{t('yourText')}</p>}
      <textarea
        data-tour="editor"
        ref={textareaRef}
        value={text}
        onChange={(e) => onText(e.target.value)}
        lang="de"
        spellCheck={false}
        aria-label={t('yourText')}
        placeholder={t('writePlaceholder')}
        className="ga-ui min-h-[16rem] w-full flex-1 resize-none rounded-ga-touch border-[1.5px] border-ga-line-strong bg-ga-card p-3.5 text-ga-body-lg leading-[1.75] text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
      />
      <div className="ga-ui my-3 flex items-center gap-3 text-ga-small text-ga-muted">
        <span className="tabular-nums">
          <b className="text-ga-ink">{words}</b> {t('wordsOf', { target: TARGET_WORDS })}
        </span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-ga-pill bg-ga-side-active">
          <span className="block h-full bg-ga-navy" style={{ width: `${Math.min(100, Math.round((words / TARGET_WORDS) * 100))}%` }} />
        </span>
      </div>
      <p className="ga-ui mb-2 text-ga-eyebrow uppercase text-ga-muted">{t('redemittel')}</p>
      <div className="flex flex-wrap gap-1.5">
        {REDEMITTEL.map((r) => (
          <button
            key={r}
            type="button"
            lang="de"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insert(r)}
            className="ga-ui min-h-9 rounded-ga-pill border border-ga-line-strong bg-ga-card px-3 text-ga-small text-ga-ink hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  )

  if (!wide) {
    return (
      <div>
        <div className="sticky top-0 z-10 border-b border-ga-line bg-ga-bg px-3 py-2.5">
          <Seg
            value={tab}
            onChange={(v) => setTab(v as 'task' | 'write')}
            options={[
              { value: 'task', label: t('tabTask') },
              { value: 'write', label: t('tabWrite', { words }) },
            ]}
          />
        </div>
        <div className="px-3 py-4">{tab === 'task' ? task : editor}</div>
      </div>
    )
  }
  // Máy tính: đề | ô viết, hai cột cuộn riêng, vạch chia kéo được như các Teil khác.
  return <SplitPanes wide source={task} answers={editor} sourceLabel={t('tabTask')} answersLabel={t('yourText')} />
}
