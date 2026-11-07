'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Check, Headphones, Play } from 'lucide-react'
import { cn } from '@/lib/utils'

const COUNTDOWN = 10
const C = 2 * Math.PI * 15

/**
 * Màn chuyển sang Hören trong thi thử: nền tối, đếm 10 giây rồi tự bắt đầu. "Kiểm tra lại bài" dừng
 * đếm và quay về Teil cuối của Lesen/Sprachbausteine. Hiện mỗi lần sang Hören, giống thi thật.
 */
export function HoerenRitual({ onStart, onBack }: { onStart: () => void; onBack: () => void }) {
  const t = useTranslations('v2.student.fullExam.ritual')
  const [left, setLeft] = React.useState(COUNTDOWN)
  const startRef = React.useRef(onStart)
  startRef.current = onStart
  const btnRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    btnRef.current?.focus()
    const id = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(id)
  }, [])
  React.useEffect(() => {
    if (left === 0) startRef.current()
  }, [left])

  return (
    <div className="grid min-h-full place-items-center p-4">
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="ritual-title"
        className="ga-ritual flex w-full max-w-[560px] flex-col items-center gap-3.5 bg-ga-ink px-6 py-10 text-center text-ga-card"
      >
        <Headphones size={40} strokeWidth={1.9} className="text-ga-yellow" aria-hidden />
        <h2 id="ritual-title" lang="de" className="font-ga-display text-ga-h1">Hörverstehen</h2>
        <p className="ga-ui max-w-[40ch] text-ga-body opacity-80">{t('body')}</p>
        <div className="relative my-1 grid h-[76px] w-[76px] place-items-center" aria-live="polite">
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" className="stroke-white/20" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - left / COUNTDOWN)}
              className="stroke-ga-yellow transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <span className="ga-ui text-ga-h2 font-bold tabular-nums">
            <span className="sr-only">{t('startsIn')} </span>
            {left}
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          <button
            ref={btnRef}
            type="button"
            onClick={onStart}
            className="ga-ui inline-flex min-h-12 items-center gap-2 rounded-ga-touch bg-ga-yellow px-5 text-ga-body font-semibold text-ga-ink hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-ga-ink"
          >
            <Play size={17} aria-hidden /> {t('startNow')}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="ga-ui inline-flex min-h-12 items-center gap-2 rounded-ga-touch border-[1.5px] border-white/40 px-5 text-ga-body font-semibold text-ga-card hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-yellow"
          >
            <ArrowLeft size={17} aria-hidden /> {t('review')}
          </button>
        </div>
      </div>
    </div>
  )
}

export type GradingStep = 'done' | 'run' | 'wait'

/** Các bước chấm sau khi nộp: trắc nghiệm → bài viết (AI) → cập nhật lịch ôn. */
export function GradingSteps({ title, steps }: { title: string; steps: { label: string; state: GradingStep }[] }) {
  const t = useTranslations('v2.student.fullExam.ritual')
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-4 py-10">
      <h1 className="font-ga-display text-ga-h1 text-ga-ink">{title}</h1>
      <ol className="ga-ui flex flex-col gap-3.5" aria-live="polite">
        {steps.map((s) => (
          <li key={s.label} className={cn('flex items-center gap-3 text-ga-body', s.state === 'wait' ? 'text-ga-muted' : 'text-ga-ink')}>
            <span
              aria-hidden
              className={cn(
                'grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full',
                s.state === 'done' && 'bg-ga-green text-ga-card',
                s.state === 'run' && 'ga-spin border-[2.5px] border-ga-line border-t-ga-ink',
                s.state === 'wait' && 'border-[1.5px] border-dashed border-ga-line-strong',
              )}
            >
              {s.state === 'done' && <Check size={14} strokeWidth={3} />}
            </span>
            <span>
              {s.label}
              <span className="sr-only"> · {t(`step.${s.state}`)}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="ga-ui text-ga-small text-ga-muted">{t('canLeave')}</p>
    </div>
  )
}
