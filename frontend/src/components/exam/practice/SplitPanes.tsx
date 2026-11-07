'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ChevronsDown, ChevronsUp } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Mốc dừng của ngăn trả lời trên màn hẹp, theo chiều cao vùng làm bài. */
export const SHEET_SNAPS = [0.28, 0.55, 0.88] as const
export type SheetSnap = 0 | 1 | 2

const SPLIT_KEY = 'df.practice.split'
const SPLIT_DEFAULT = 52
const SPLIT_MIN = 35
const SPLIT_MAX = 65
const SCROLL_IDLE_MS = 900

interface Props {
  /** Cột nguồn: bài đọc, thư có chỗ trống, các text, mẩu rao vặt, trình nghe. */
  source: React.ReactNode
  /** Cột trả lời: câu hỏi, kho lựa chọn, phân tích. */
  answers: React.ReactNode
  /** ≥760px: hai cột cạnh nhau. Dưới đó: nguồn làm nền, trả lời trong ngăn kéo lên xuống. */
  wide: boolean
  /** Dòng nhãn trên tay nắm của ngăn (màn hẹp), ví dụ "Câu 7 · 2/5". */
  sheetLabel?: React.ReactNode
  /**
   * Yêu cầu đưa ngăn về một mốc từ bên ngoài (chọn câu ở cột nguồn → mở ngăn; chọn xong → thu ngăn).
   * `n` tăng mỗi lần yêu cầu để cùng một mốc vẫn kích hoạt lại.
   */
  snapRequest?: { snap: SheetSnap; n: number }
  /** Cuộn cột nguồn tới phần tử này (bằng chứng trong bài). `n` tăng mỗi lần yêu cầu. */
  revealRequest?: { selector: string; n: number }
  sourceLabel?: string
  answersLabel?: string
}

/**
 * Khung hai vùng của màn làm bài luyện thi (đợt (a), 07/11/2026). Hai vùng cuộn RIÊNG để đọc tới đâu
 * vẫn thấy câu hỏi. Màn rộng: vạch chia kéo được 35–65% (nháy đúp về 52%, ←/→ đổi 2%, nhớ cho lần sau).
 * Màn hẹp: ngăn trả lời kéo lên xuống, thả ra dừng ở 28 · 55 · 88%; nút mở rộng/thu nhỏ và ↑/↓ làm
 * cùng việc cho người không kéo được. Thanh cuộn chỉ hiện khi đang lướt.
 */
export function SplitPanes({ source, answers, wide, sheetLabel, snapRequest, revealRequest, sourceLabel, answersLabel }: Props) {
  const t = useTranslations('v2.student.practice.frame')
  const rootRef = React.useRef<HTMLDivElement>(null)
  const sourceRef = React.useRef<HTMLDivElement>(null)
  const answersRef = React.useRef<HTMLDivElement>(null)

  // ── vạch chia (màn rộng) ─────────────────────────────────────────────────────
  const [split, setSplit] = React.useState(SPLIT_DEFAULT)
  const [dragging, setDragging] = React.useState(false)
  React.useEffect(() => {
    try {
      const v = Number(window.localStorage.getItem(SPLIT_KEY))
      if (v >= SPLIT_MIN && v <= SPLIT_MAX) setSplit(v)
    } catch {
      /* chế độ riêng tư: giữ mặc định */
    }
  }, [])
  const saveSplit = (v: number) => {
    try {
      window.localStorage.setItem(SPLIT_KEY, String(v))
    } catch {
      /* bỏ qua */
    }
  }
  const clampSplit = (v: number) => Math.round(Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, v)))
  const onGutterDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const onGutterMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !rootRef.current) return
    const r = rootRef.current.getBoundingClientRect()
    setSplit(clampSplit(((e.clientX - r.left) / r.width) * 100))
  }
  const onGutterUp = () => {
    if (!dragging) return
    setDragging(false)
    saveSplit(split)
  }
  const onGutterKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const v = clampSplit(split + (e.key === 'ArrowLeft' ? -2 : 2))
    setSplit(v)
    saveSplit(v)
  }

  // ── ngăn kéo (màn hẹp) ───────────────────────────────────────────────────────
  const [bodyH, setBodyH] = React.useState(0)
  const [snap, setSnap] = React.useState<SheetSnap>(1)
  const [dragH, setDragH] = React.useState<number | null>(null)
  const drag = React.useRef<{ y: number; h: number } | null>(null)
  React.useEffect(() => {
    const el = rootRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setBodyH(el.clientHeight))
    ro.observe(el)
    setBodyH(el.clientHeight)
    return () => ro.disconnect()
  }, [wide])
  React.useEffect(() => {
    if (snapRequest) setSnap(snapRequest.snap)
  }, [snapRequest])
  const sheetH = dragH ?? Math.round(bodyH * SHEET_SNAPS[snap])
  const onHandleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { y: e.clientY, h: sheetH }
    setDragH(sheetH)
  }
  const onHandleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const next = drag.current.h + (drag.current.y - e.clientY)
    setDragH(Math.min(bodyH * 0.92, Math.max(bodyH * 0.18, next)))
  }
  const onHandleUp = () => {
    if (!drag.current) return
    const ratio = (dragH ?? sheetH) / Math.max(1, bodyH)
    let best: SheetSnap = 0
    SHEET_SNAPS.forEach((s, i) => {
      if (Math.abs(s - ratio) < Math.abs(SHEET_SNAPS[best] - ratio)) best = i as SheetSnap
    })
    drag.current = null
    setDragH(null)
    setSnap(best)
  }
  const onHandleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSnap((s) => Math.min(2, s + 1) as SheetSnap)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSnap((s) => Math.max(0, s - 1) as SheetSnap)
    }
  }
  const expanded = snap === 2

  // ── bằng chứng trong bài: cuộn cột nguồn tới chỗ tô ──────────────────────────
  React.useEffect(() => {
    if (!revealRequest) return
    if (!wide) setSnap(0)
    const id = window.setTimeout(() => {
      const pane = sourceRef.current
      const el = pane?.querySelector<HTMLElement>(revealRequest.selector)
      if (!pane || !el) return
      const top = el.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop
      pane.scrollTo({ top: Math.max(0, top - pane.clientHeight * 0.3), behavior: 'smooth' })
    }, 260)
    return () => window.clearTimeout(id)
  }, [revealRequest, wide])

  useAutoHideScrollbar(sourceRef)
  useAutoHideScrollbar(answersRef)

  if (wide) {
    return (
      <div
        ref={rootRef}
        className="grid h-full"
        style={{ gridTemplateColumns: `minmax(0,${split}fr) 12px minmax(0,${100 - split}fr)` }}
      >
        <section ref={sourceRef} aria-label={sourceLabel} className="ga-autoscroll min-h-0 overflow-y-auto px-6 pb-10 pt-5">
          {source}
        </section>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t('gutter')}
          aria-valuemin={SPLIT_MIN}
          aria-valuemax={SPLIT_MAX}
          aria-valuenow={split}
          tabIndex={0}
          onPointerDown={onGutterDown}
          onPointerMove={onGutterMove}
          onPointerUp={onGutterUp}
          onPointerCancel={onGutterUp}
          onDoubleClick={() => {
            setSplit(SPLIT_DEFAULT)
            saveSplit(SPLIT_DEFAULT)
          }}
          onKeyDown={onGutterKey}
          className="group relative cursor-col-resize touch-none focus-visible:outline-none"
        >
          <span
            aria-hidden
            className={cn(
              'absolute inset-y-0 left-[5px] w-0.5 transition-colors duration-150',
              dragging ? 'bg-ga-line-strong' : 'bg-ga-line group-hover:bg-ga-line-strong group-focus-visible:bg-ga-focus',
            )}
          />
          <span
            aria-hidden
            className={cn(
              'absolute left-1/2 top-1/2 h-9 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-ga-pill border-[1.5px] border-ga-line-strong bg-ga-card transition-opacity duration-150',
              dragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
            )}
          />
        </div>
        <section ref={answersRef} aria-label={answersLabel} className="ga-autoscroll min-h-0 overflow-y-auto bg-ga-card px-5 pb-10 pt-5">
          {answers}
        </section>
      </div>
    )
  }

  return (
    <div ref={rootRef} className="relative h-full overflow-hidden">
      <section
        ref={sourceRef}
        aria-label={sourceLabel}
        className="ga-autoscroll absolute inset-0 overflow-y-auto px-3 pt-4"
        style={{ paddingBottom: sheetH + 24 }}
      >
        {source}
      </section>
      <section
        ref={answersRef}
        aria-label={answersLabel}
        className={cn(
          'ga-autoscroll absolute inset-x-0 bottom-0 overflow-y-auto rounded-t-[14px] border-t border-ga-line bg-ga-card px-3 pb-6 shadow-ga-drawer',
          dragH == null && 'transition-[height] duration-[240ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none',
        )}
        style={{ height: sheetH }}
      >
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={t('sheetHandle')}
          tabIndex={0}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          onKeyDown={onHandleKey}
          className="sticky top-0 z-10 -mx-3 mb-3 flex cursor-grab touch-none select-none flex-col items-center gap-1 border-b border-ga-line bg-ga-card pb-1.5 pt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus"
        >
          <span aria-hidden className="h-[5px] w-10 rounded-ga-pill bg-ga-line-strong" />
          <span className="flex w-full items-center gap-2 px-3">
            <span className="ga-ui min-w-0 flex-1 truncate text-ga-small font-semibold text-ga-ink">{sheetLabel}</span>
            <button
              type="button"
              onClick={() => setSnap(expanded ? 0 : 2)}
              aria-label={expanded ? t('collapse') : t('expand')}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ga-line bg-ga-card text-ga-muted hover:bg-ga-side-active hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
            >
              {expanded ? <ChevronsDown size={16} aria-hidden /> : <ChevronsUp size={16} aria-hidden />}
            </button>
          </span>
        </div>
        {answers}
      </section>
    </div>
  )
}

/** Gắn `data-scrolling` lúc đang cuộn để `.ga-autoscroll` hiện thanh cuộn, gỡ sau 900ms đứng yên. */
function useAutoHideScrollbar(ref: React.RefObject<HTMLElement>) {
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    let timer = 0
    const onScroll = () => {
      el.setAttribute('data-scrolling', '')
      window.clearTimeout(timer)
      timer = window.setTimeout(() => el.removeAttribute('data-scrolling'), SCROLL_IDLE_MS)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.clearTimeout(timer)
    }
  })
}
