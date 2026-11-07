'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { BookOpen, Check, CircleHelp, Clock, Eye, EyeOff, Headphones, Lightbulb, PenLine, Puzzle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useImmersiveChrome } from '@/components/ui-v2/useImmersiveChrome'
import { formatClock } from './practiceModel'

export type PracticeSaveState = 'idle' | 'saving' | 'saved' | 'error'

interface PracticeShellProps {
  backHref: string
  subtitle: string
  title: string
  /** Phần thi (LESEN, SPRACHBAUSTEINE, HOEREN, SCHREIBEN) — chọn ô icon cạnh tên Teil. */
  section?: string | null
  /** "3/5" — số câu đã làm hoặc đúng. */
  progress?: React.ReactNode
  /** Đồng hồ của Teil (giây). `null` = không hiện đồng hồ (màn kết quả, màn bản đồ). */
  seconds?: number | null
  suggestMinutes?: number | null
  tipsOpen?: boolean
  onToggleTips?: () => void
  /** Nút dấu hỏi mở lại hướng dẫn lần đầu của màn (đợt (e)). */
  onHelp?: () => void
  saveState?: PracticeSaveState
  footer?: React.ReactNode
  children: React.ReactNode
  /** Nhãn nút quay lại (mặc định "Về bản đồ đề"). */
  backLabel?: string
  /** Thi thử trọn đề: `seconds` là thời gian CÒN LẠI; còn 5 phút đổi cam, còn 1 phút đổi đỏ. */
  countdown?: boolean
}

const HIDE_CLOCK_KEY = 'df.practice.hideClock'
const SAVED_VISIBLE_MS = 1200

/**
 * Chỗ trong thanh dưới để màn làm bài gắn hàng ô số câu (portal) — thanh dưới thuộc vỏ, còn câu đang
 * chọn và câu đánh dấu thuộc màn làm bài.
 */
export const PracticeFootSlot = React.createContext<HTMLElement | null>(null)

const SECTION_ICON: Record<string, typeof BookOpen> = {
  LESEN: BookOpen,
  SPRACHBAUSTEINE: Puzzle,
  HOEREN: Headphones,
  SCHREIBEN: PenLine,
}

/**
 * Vỏ của màn làm bài luyện thi (đợt (a) 07/11/2026). Thanh trên chỉ ba thứ chính: thoát · ô icon +
 * tên Teil · đồng hồ (kèm nút chiến thuật). Thanh dưới: ô số câu (do màn làm bài gắn vào), "Đã lưu",
 * nút chính. Thân KHÔNG tự cuộn — màn làm bài tự chia hai vùng cuộn riêng (`SplitPanes`); màn khác
 * (kết quả, đang tải) cuộn trong thân như cũ.
 *
 * Đồng hồ luyện đếm LÊN theo Teil, chỉ gợi ý, ẩn được (owner chốt 03/11/2026). Thi thử đếm XUỐNG:
 * còn 5 phút nền cam, còn 1 phút nền đỏ nhấp nháy.
 */
export function PracticeShell({
  backHref,
  subtitle,
  title,
  section,
  progress,
  seconds = null,
  suggestMinutes = null,
  tipsOpen,
  onToggleTips,
  onHelp,
  saveState = 'idle',
  footer,
  children,
  backLabel,
  countdown = false,
}: PracticeShellProps) {
  const t = useTranslations('v2.student.practice')
  useImmersiveChrome()
  const [slot, setSlot] = React.useState<HTMLElement | null>(null)

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

  // "Đã lưu" hiện một lúc rồi mờ đi; đang lưu / lỗi thì giữ nguyên.
  const [savedVisible, setSavedVisible] = React.useState(false)
  React.useEffect(() => {
    if (saveState !== 'saved') {
      setSavedVisible(false)
      return
    }
    setSavedVisible(true)
    const id = window.setTimeout(() => setSavedVisible(false), SAVED_VISIBLE_MS)
    return () => window.clearTimeout(id)
  }, [saveState])

  const tone = countdown
    ? seconds != null && seconds <= 60
      ? 'danger'
      : seconds != null && seconds <= 5 * 60
        ? 'warn'
        : 'normal'
    : seconds != null && suggestMinutes != null && seconds > suggestMinutes * 60
      ? 'warn'
      : 'normal'
  const back = backLabel ?? t('backToMap')
  const Icon = section ? SECTION_ICON[section] : undefined

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ga-bg">
      <header className="shrink-0 border-b border-ga-line bg-ga-card">
        <div className="flex min-h-14 items-center gap-2 px-2 py-1.5 lg:gap-3 lg:px-4">
          <Link
            href={backHref}
            aria-label={back}
            title={back}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ga-line bg-ga-card text-ga-muted hover:bg-ga-side-active hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
          >
            <X size={18} aria-hidden />
          </Link>
          {Icon && (
            <span aria-hidden className="hidden h-9 w-9 shrink-0 place-items-center rounded-ga bg-ga-navy-soft text-ga-navy sm:grid">
              <Icon size={18} strokeWidth={1.9} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="ga-ui truncate text-ga-caption text-ga-muted">{subtitle}</p>
            <h1 className="truncate font-ga-display text-ga-h3 text-ga-ink">{title}</h1>
          </div>
          {progress != null && (
            <span className="ga-ui hidden shrink-0 text-ga-small font-semibold tabular-nums text-ga-ink sm:inline">{progress}</span>
          )}
          {onHelp && (
            <button
              type="button"
              onClick={onHelp}
              aria-label={t('help')}
              title={t('help')}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ga-line bg-ga-card text-ga-muted hover:bg-ga-side-active hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
            >
              <CircleHelp size={17} aria-hidden />
            </button>
          )}
          {onToggleTips && (
            <button
              type="button"
              data-tour="strategy"
              onClick={onToggleTips}
              aria-pressed={!!tipsOpen}
              aria-label={t('tips')}
              title={t('tips')}
              className={cn(
                'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
                tipsOpen ? 'border-ga-yellow bg-ga-yellow-soft text-ga-ink' : 'border-ga-line bg-ga-card text-ga-muted hover:bg-ga-side-active hover:text-ga-ink',
              )}
            >
              <Lightbulb size={17} aria-hidden />
            </button>
          )}
          {seconds != null && (
            <>
              {!clockHidden && (
                <span
                  role="timer"
                  aria-live="off"
                  className={cn(
                    'ga-ui inline-flex shrink-0 items-center gap-1.5 rounded-ga-pill px-2.5 py-1 text-ga-body font-semibold tabular-nums transition-colors duration-[240ms]',
                    tone === 'normal' && 'text-ga-ink',
                    tone === 'warn' && 'bg-ga-warning-soft text-ga-warning',
                    tone === 'danger' && 'ga-timer-pulse bg-ga-red-soft text-ga-red',
                  )}
                >
                  <Clock size={16} aria-hidden />
                  {formatClock(seconds)}
                  {!countdown && suggestMinutes != null && (
                    <span className="hidden text-ga-small font-normal lg:inline">
                      {tone === 'warn'
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
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ga-muted hover:bg-ga-side-active hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
              >
                {clockHidden ? <Eye size={17} aria-hidden /> : <EyeOff size={17} aria-hidden />}
              </button>
            </>
          )}
        </div>
      </header>
      <PracticeFootSlot.Provider value={slot}>
        <div className="relative min-h-0 flex-1 overflow-y-auto">{children}</div>
      </PracticeFootSlot.Provider>
      {footer && (
        <footer className="flex shrink-0 flex-wrap items-center gap-2.5 border-t border-ga-line bg-ga-card px-3 py-2.5 lg:px-5">
          <div ref={setSlot} className="contents" />
          {saveState !== 'idle' && (
            <span
              aria-live="polite"
              className={cn(
                'ga-ui inline-flex shrink-0 items-center gap-1 text-ga-caption transition-opacity duration-[400ms]',
                saveState === 'error' ? 'text-ga-red' : 'text-ga-muted',
                saveState === 'saved' && !savedVisible && 'opacity-0',
              )}
            >
              {saveState === 'saved' && <Check size={14} className="text-ga-green" aria-hidden />}
              {saveState === 'saving' ? t('saveSaving') : saveState === 'saved' ? t('saveSaved') : t('saveError')}
            </span>
          )}
          {footer}
        </footer>
      )}
    </div>
  )
}

/** Mẹo trước khi làm: 3 dòng, đóng được, mở lại bằng nút bóng đèn trên thanh trên. */
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
        <X size={16} aria-hidden />
      </button>
    </section>
  )
}
