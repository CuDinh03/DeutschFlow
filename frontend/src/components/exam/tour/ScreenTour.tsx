'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArrowRight, CircleHelp, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { loadSeenTours, markTourSeen } from '@/lib/uiToursApi'

export interface TourStep {
  /** Giá trị `data-tour` của vùng được khoanh. Vùng không hiện trên màn thì bước đó bị bỏ. */
  target: string
  icon: LucideIcon
  title: string
  body: string
}

interface Options {
  /** Khoá màn, lưu theo tài khoản (`exam.today`…). */
  key: string
  steps: TourStep[]
  /** Màn đã có nội dung để khoanh (đã tải xong). */
  ready: boolean
}

/**
 * Hướng dẫn lần đầu của một màn (đợt (e) làm mới Luyện thi, 07/11/2026). Lần đầu vào màn: tự mở sau
 * 450ms, nền tối, khoanh vàng vùng đang nói, thẻ 1–2 câu, Tiếp / Bỏ qua, chấm tiến độ; Enter tiếp,
 * Esc bỏ qua. Đã xem (theo tài khoản) thì không tự mở; nút dấu hỏi mở lại. `familiar` = đã xem hướng
 * dẫn màn này ⇒ màn hiện thêm nút gợi ý.
 */
export function useScreenTour({ key, steps, ready }: Options) {
  const t = useTranslations('v2.student.tour')
  const [seen, setSeen] = React.useState<boolean | null>(null)
  // Đã xem TRƯỚC lần vào màn này — gợi ý chỉ hiện từ lần sau, không hiện ngay khi hướng dẫn vừa mở
  // lần đầu (nghiệm thu prod 07/11/2026).
  const [seenBefore, setSeenBefore] = React.useState<boolean | null>(null)
  const [active, setActive] = React.useState(false)
  const stepsRef = React.useRef(steps)
  stepsRef.current = steps

  React.useEffect(() => {
    let alive = true
    void loadSeenTours().then((s) => {
      if (!alive) return
      setSeen(s.has(key))
      setSeenBefore(s.has(key))
    })
    return () => {
      alive = false
    }
  }, [key])

  const start = React.useCallback(() => {
    setActive(true)
    setSeen((was) => {
      if (!was) void markTourSeen(key)
      return true
    })
  }, [key])

  React.useEffect(() => {
    if (!ready || seen !== false || active) return
    const id = window.setTimeout(start, 450)
    return () => window.clearTimeout(id)
  }, [ready, seen, active, start])

  const close = React.useCallback(
    (done: boolean) => {
      setActive(false)
      if (done) toast(t('replayHint'))
    },
    [t],
  )

  return {
    active,
    start,
    familiar: seenBefore === true,
    overlay: active ? <TourOverlay steps={stepsRef.current} onClose={close} /> : null,
  }
}

/** Nút dấu hỏi ở góc trên của màn: mở lại hướng dẫn. */
export function TourHelpButton({ onClick, className }: { onClick: () => void; className?: string }) {
  const t = useTranslations('v2.student.tour')
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('help')}
      title={t('help')}
      className={cn(
        'grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ga-line bg-ga-card text-ga-muted transition-colors hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
        className,
      )}
    >
      <CircleHelp size={18} aria-hidden />
    </button>
  )
}

function visibleTarget(target: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`)
  return el && el.getClientRects().length > 0 ? el : null
}

interface Box {
  top: number
  left: number
  width: number
  height: number
}

function TourOverlay({ steps: all, onClose }: { steps: TourStep[]; onClose: (done: boolean) => void }) {
  const t = useTranslations('v2.student.tour')
  const [steps] = React.useState(() => all.filter((s) => visibleTarget(s.target)))
  const [i, setI] = React.useState(0)
  const [spot, setSpot] = React.useState<Box | null>(null)
  const [card, setCard] = React.useState<{ top: number; left: number } | null>(null)
  const cardRef = React.useRef<HTMLDivElement>(null)
  const nextRef = React.useRef<HTMLButtonElement>(null)
  const step = steps[i]
  const last = i === steps.length - 1

  React.useEffect(() => {
    if (steps.length === 0) onClose(false)
  }, [steps.length, onClose])

  const place = React.useCallback(() => {
    if (!step) return
    const el = visibleTarget(step.target)
    if (!el) return
    const r = el.getBoundingClientRect()
    const pad = 6
    const top = Math.max(r.top - pad, 4)
    const left = Math.max(r.left - pad, 4)
    const width = Math.min(r.width + pad * 2, window.innerWidth - 8)
    // Vùng tràn khỏi màn: khung vàng cắt theo mép màn, không vẽ ra ngoài.
    const height = Math.max(0, Math.min(r.bottom + pad, window.innerHeight - 4) - top)
    setSpot({ top, left, width, height })
    const cw = cardRef.current?.offsetWidth ?? 320
    const ch = cardRef.current?.offsetHeight ?? 180
    let cy = top + height + 12
    if (cy + ch > window.innerHeight - 12) cy = top - ch - 12
    // Không đủ chỗ trên/dưới (vùng cao gần bằng màn): thẻ nằm sát đáy màn, đè ít nội dung nhất.
    if (cy < 12) cy = Math.max(12, window.innerHeight - ch - 16)
    setCard({ top: cy, left: Math.min(Math.max(12, left + width / 2 - cw / 2), window.innerWidth - cw - 12) })
  }, [step])

  React.useEffect(() => {
    if (!step) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const el = visibleTarget(step.target)
    // Vùng cao hơn ~60% màn: cuộn tới ĐẦU vùng để thấy tiêu đề, thay vì giữa vùng.
    const tall = !!el && el.getBoundingClientRect().height > window.innerHeight * 0.6
    el?.scrollIntoView?.({ block: tall ? 'start' : 'center', behavior: reduce ? 'auto' : 'smooth' })
    place()
    const id = window.setTimeout(() => {
      place()
      nextRef.current?.focus({ preventScroll: true })
    }, reduce ? 0 : 320)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [step, place])

  const next = React.useCallback(() => (last ? onClose(true) : setI((n) => n + 1)), [last, onClose])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose(false)
      } else if (e.key === 'Enter' && !(e.target instanceof Element && e.target.closest('[data-tour-card] button'))) {
        e.preventDefault()
        next()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [next, onClose])

  if (!step || typeof document === 'undefined') return null
  const Icon = step.icon
  return createPortal(
    <div className="ga-scope">
      <div className="fixed inset-0 z-[110]" aria-hidden />
      {spot && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[111] rounded-ga-touch transition-[top,left,width,height] duration-ga-base ease-out motion-reduce:transition-none"
          style={{ ...spot, boxShadow: '0 0 0 2px var(--ga-yellow), 0 0 0 9999px var(--ga-overlay)' }}
        />
      )}
      <div
        ref={cardRef}
        data-tour-card
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        key={i}
        className="ga-pop-now fixed z-[112] flex w-[min(320px,calc(100vw-32px))] flex-col gap-3 rounded-ga-touch bg-ga-card p-[18px] text-ga-ink shadow-ga-drawer"
        style={card ?? { top: -9999, left: -9999 }}
      >
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-ga bg-ga-navy-soft text-ga-navy">
            <Icon size={18} strokeWidth={1.9} />
          </span>
          <h3 id="tour-title" className="font-ga-display text-ga-h3">{step.title}</h3>
        </div>
        <p id="tour-body" className="ga-ui text-ga-body text-ga-muted">{step.body}</p>
        <div className="flex items-center gap-2.5">
          <span className="flex flex-1 gap-1.5" aria-label={t('progress', { n: i + 1, total: steps.length })} role="img">
            {steps.map((s, k) => (
              <i key={s.target} className={cn('block h-1.5 rounded-ga-pill transition-[width,background-color] duration-150', k === i ? 'w-4 bg-ga-ink' : 'w-1.5 bg-ga-line')} />
            ))}
          </span>
          <button type="button" onClick={() => onClose(false)} className="ga-ui min-h-10 px-1.5 text-ga-small text-ga-muted hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus">
            {t('skip')}
          </button>
          <button
            ref={nextRef}
            type="button"
            onClick={next}
            className="ga-ui inline-flex min-h-10 items-center gap-1.5 rounded-ga-touch bg-ga-ink px-3.5 text-ga-small font-semibold text-ga-card hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2"
          >
            {last ? t('done') : t('next')} <ArrowRight size={15} aria-hidden />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
