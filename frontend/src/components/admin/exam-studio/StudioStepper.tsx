'use client'

import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { WIZARD_STEPS } from '@/lib/examStudioLogic'
import { cn } from '@/lib/utils'

interface Props {
  /** Bước đang xem (chỉ số trong WIZARD_STEPS). */
  current: number
  /** Bước xa nhất mở được; các bước sau bị khoá. */
  maxReachable: number
  /** Bước đã xong theo máy chủ (hiện dấu tick). */
  done: number
  onSelect: (index: number) => void
}

/** Thanh 5 bước: Khung · Nguồn · Bài đọc · Câu hỏi · Kiểm & duyệt. Bấm lùi về bước đã mở. */
export function StudioStepper({ current, maxReachable, done, onSelect }: Props) {
  const t = useTranslations('v2.adminContent.examStudio')
  return (
    <nav aria-label={t('stepper.label')} className="overflow-x-auto">
      <ol className="flex min-w-max items-stretch gap-1.5">
        {WIZARD_STEPS.map((s, i) => {
          const reachable = i <= maxReachable
          const isCurrent = i === current
          const isDone = i < done
          return (
            <li key={s}>
              <button
                type="button"
                disabled={!reachable}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => onSelect(i)}
                className={cn(
                  'ga-ui flex min-h-11 items-center gap-2 rounded-ga border px-3 py-1.5 text-ga-small font-semibold transition-colors lg:min-h-9',
                  isCurrent
                    ? 'border-ga-ink bg-ga-ink text-ga-bg'
                    : reachable
                      ? 'border-ga-line bg-ga-card text-ga-ink hover:bg-ga-surface'
                      : 'border-ga-line bg-ga-card text-ga-muted opacity-60',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'inline-flex h-5 w-5 items-center justify-center rounded-full text-ga-caption',
                    isCurrent ? 'bg-ga-bg text-ga-ink' : isDone ? 'bg-ga-green text-ga-bg' : 'bg-ga-side-active text-ga-muted',
                  )}
                >
                  {isDone && !isCurrent ? <Check size={12} /> : i + 1}
                </span>
                {t(`step.${s}`)}
                {isDone && <span className="sr-only">{t('stepper.done')}</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
