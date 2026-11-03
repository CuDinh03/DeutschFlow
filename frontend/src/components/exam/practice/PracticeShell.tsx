'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronLeft, Clock, Eye, EyeOff, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useImmersiveChrome } from '@/components/ui-v2/useImmersiveChrome'
import { formatClock } from './practiceModel'

export type PracticeSaveState = 'idle' | 'saving' | 'saved' | 'error'

interface PracticeShellProps {
  backHref: string
  subtitle: string
  title: string
  /** "3/5" — số câu đã làm hoặc đúng. */
  progress?: React.ReactNode
  /** Đồng hồ của Teil (giây). `null` = không hiện đồng hồ (màn kết quả, màn bản đồ). */
  seconds?: number | null
  suggestMinutes?: number | null
  tipsOpen?: boolean
  onToggleTips?: () => void
  saveState?: PracticeSaveState
  footer?: React.ReactNode
  children: React.ReactNode
}

const HIDE_CLOCK_KEY = 'df.practice.hideClock'

/**
 * Vỏ của chế độ luyện đề: một hàng trên cùng (về bản đồ đề · tên Teil · tiến độ · đồng hồ · mẹo ·
 * trạng thái lưu), thân cuộn, chân cố định. Khác `ExamShell` (thi thử): đồng hồ đếm LÊN theo Teil,
 * chỉ gợi ý, ẩn được, không tự nộp — owner chốt 03/11/2026 (phương án A).
 */
export function PracticeShell({
  backHref,
  subtitle,
  title,
  progress,
  seconds = null,
  suggestMinutes = null,
  tipsOpen,
  onToggleTips,
  saveState = 'idle',
  footer,
  children,
}: PracticeShellProps) {
  const t = useTranslations('v2.student.practice')
  useImmersiveChrome()

  const [clockHidden, setClockHidden] = React.useState(false)
  React.useEffect(() => {
    try {
      setClockHidden(window.localStorage.getItem(HIDE_CLOCK_KEY) === '1')
    } catch {
      /* chế độ riêng tư: giữ mặc định */
    }
  }, [])
  const toggleClock = () => {
    setClockHidden((v) => {
      try {
        window.localStorage.setItem(HIDE_CLOCK_KEY, v ? '0' : '1')
      } catch {
        /* bỏ qua */
      }
      return !v
    })
  }

  const over = seconds != null && suggestMinutes != null && seconds > suggestMinutes * 60
  const saveLabel =
    saveState === 'saving' ? t('saveSaving') : saveState === 'saved' ? t('saveSaved') : saveState === 'error' ? t('saveError') : ''

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ga-bg">
      <header className="shrink-0 border-b border-ga-line bg-ga-card">
        <div className="flex min-h-14 items-center gap-2 px-2 py-1.5 lg:gap-4 lg:px-5">
          <Link
            href={backHref}
            aria-label={t('backToMap')}
            className="ga-ui inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-ga-touch px-2 text-ga-small font-medium text-ga-muted hover:bg-ga-side-active hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
          >
            <ChevronLeft size={18} aria-hidden />
            <span className="hidden lg:inline">{t('backToMap')}</span>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="ga-ui truncate text-ga-caption text-ga-muted">{subtitle}</p>
            <h1 className="truncate font-ga-display text-ga-h3 text-ga-ink lg:text-ga-h2">{title}</h1>
          </div>
          {progress != null && (
            <span className="ga-ui shrink-0 text-ga-small font-semibold tabular-nums text-ga-ink">{progress}</span>
          )}
          {seconds != null && (
            <>
              {!clockHidden && (
                <span
                  aria-live="off"
                  className={cn('ga-ui inline-flex shrink-0 items-center gap-1.5 text-ga-small tabular-nums', over ? 'text-ga-warning' : 'text-ga-muted')}
                >
                  <Clock size={15} aria-hidden />
                  {formatClock(seconds)}
                  {suggestMinutes != null && (
                    <span className="hidden lg:inline">
                      {over
                        ? t('clockOver', { minutes: Math.floor((seconds - suggestMinutes * 60) / 60) })
                        : t('clockSuggest', { minutes: suggestMinutes })}
                    </span>
                  )}
                </span>
              )}
              <button
                type="button"
                onClick={toggleClock}
                aria-label={clockHidden ? t('showClock') : t('hideClock')}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-ga-touch text-ga-muted hover:bg-ga-side-active hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
              >
                {clockHidden ? <Eye size={17} aria-hidden /> : <EyeOff size={17} aria-hidden />}
              </button>
            </>
          )}
          {onToggleTips && (
            <button
              type="button"
              onClick={onToggleTips}
              aria-pressed={!!tipsOpen}
              className={cn(
                'ga-ui inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-ga-touch px-2 text-ga-small font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
                tipsOpen ? 'bg-ga-yellow-soft text-ga-ink' : 'text-ga-muted hover:bg-ga-side-active hover:text-ga-ink',
              )}
            >
              <Lightbulb size={17} aria-hidden />
              <span className="hidden lg:inline">{t('tips')}</span>
            </button>
          )}
          {saveLabel && (
            <span className={cn('ga-ui hidden shrink-0 text-ga-caption lg:inline', saveState === 'error' ? 'text-ga-red' : 'text-ga-muted')}>
              {saveLabel}
            </span>
          )}
        </div>
      </header>
      <div className="relative min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer && (
        <footer className="flex shrink-0 flex-wrap items-center gap-2.5 border-t border-ga-line bg-ga-card px-3 py-2.5 lg:px-5">
          {footer}
        </footer>
      )}
    </div>
  )
}

/** Mẹo trước khi làm: 3 dòng, đóng được, mở lại bằng nút Mẹo trên thanh trên. */
export function TipsCard({ steps, onClose }: { steps: string[]; onClose: () => void }) {
  const t = useTranslations('v2.student.practice')
  if (steps.length === 0) return null
  return (
    <section aria-label={t('tips')} className="relative mb-4 rounded-ga-touch bg-ga-yellow-soft px-4 py-3 pr-12">
      <h2 className="ga-ui mb-1.5 flex items-center gap-2 text-ga-small font-semibold text-ga-ink">
        <Lightbulb size={16} aria-hidden />
        {t('tipsTitle')}
      </h2>
      <ol className="ga-ui list-decimal space-y-1 pl-5 text-ga-small text-ga-ink">
        {steps.slice(0, 3).map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('closeTips')}
        className="ga-ui absolute right-1 top-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-ga-touch text-ga-muted hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
      >
        ×
      </button>
    </section>
  )
}
