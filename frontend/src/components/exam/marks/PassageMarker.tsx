'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { BookmarkPlus, Eraser, Hash, MapPin, MessageSquareText, Trash2, Underline } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  addMark,
  colorAt,
  coveredFully,
  erase,
  groupPieces,
  groupSelector,
  MARK_COLORS,
  MAX_NOTE,
  overlapsAny,
  recolor,
  removeGroup,
  setNote,
  setTag,
  toggleUnderline,
  type MarkColor,
  type Piece,
} from './marksModel'
import { rangeToPiece } from './selection'
import type { PassageMarks } from './usePassageMarks'
import { saveableText, sentenceAround } from './saveWord'
import { SaveWordCard, type SaveWordJob } from './SaveWordCard'

export interface MarkerItem {
  id: string
  label: string
}

interface Props {
  marks: PassageMarks
  /** Vùng chứa mọi khối chữ đánh dấu được (cột bài đọc + cột câu hỏi). */
  rootRef: React.RefObject<HTMLElement | null>
  /** Tạo / sửa đánh dấu được (màn ≥ 760px, đã tải, không đang ẩn). */
  canEdit: boolean
  items: readonly MarkerItem[]
  /** Câu đang làm — nút nhanh "Câu N". */
  currentItemId: string | null
  /** Luyện Teil: gắn câu + ghi chú. Thi thử / bài chẩn đoán (đợt 2): tắt. */
  full: boolean
  /** Mô tả vị trí cho tiêu đề ghi chú ("dòng 6–7"). */
  describe: (p: Piece) => string
  /**
   * Màn hẹp / cảm ứng (đợt 2b): thanh công cụ neo đáy màn (không đè menu chọn chữ của hệ thống, nằm trên
   * vùng chọn), ô ghi chú ở đầu màn (không bị bàn phím ảo che); chờ người dùng kéo xong hai đầu vùng chọn.
   */
  docked?: boolean
  /** Thanh neo đáy mở trên khối nào / đóng (`null`) — khung làm bài nhường chỗ cho bài đọc. */
  onDockedOpen?: (block: string | null) => void
}

type Bar =
  | { mode: 'select'; piece: Piece; range: Range }
  | { mode: 'edit'; gid: string }

const COLOR_KEYS: Record<string, MarkColor> = { '1': 'y', '2': 'g', '3': 'p' }
/** Tên lớp viết đủ để Tailwind JIT nhìn thấy (không ghép chuỗi). */
export const SWATCH: Record<MarkColor, string> = { y: 'bg-ga-mark-y', g: 'bg-ga-mark-g', p: 'bg-ga-mark-p' }

/**
 * Thanh công cụ đánh dấu (09/11/2026, theo bản mẫu đã duyệt). Bôi đen chữ ⇒ thanh nổi ngay trên vùng
 * chọn; bấm vào đoạn đã tô ⇒ thanh sửa của nhóm đó. Nút bấm chặn `mousedown` để vùng chọn không mất.
 * Đợt 1 chỉ cho chuột + bàn phím (màn ≥ 760px); cảm ứng / thanh neo dưới là đợt 2b.
 */
export function PassageMarker({ marks, rootRef, canEdit, items, currentItemId, full, describe, docked = false, onDockedOpen }: Props) {
  const t = useTranslations('v2.student.practice.marks')
  const [bar, setBar] = React.useState<Bar | null>(null)
  const [tagsOpen, setTagsOpen] = React.useState(false)
  const [noteFor, setNoteFor] = React.useState<string | null>(null)
  const [noteText, setNoteText] = React.useState('')
  const [announce, setAnnounce] = React.useState('')
  const [, setTick] = React.useState(0)
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const barRef = React.useRef<HTMLDivElement>(null)
  const noteRef = React.useRef<HTMLDivElement>(null)
  const textareaId = React.useId()

  const { pack, texts, apply } = marks
  const live = React.useRef({ bar, noteFor, canEdit, pack, docked })
  live.current = { bar, noteFor, canEdit, pack, docked }

  // "Lưu từ" (13/11/2026): chỉ ở Luyện Teil — chế độ đủ công cụ trên gói luyện. Bài chẩn đoán cũng lưu theo
  // gói luyện nhưng chạy chế độ thi (`full = false`) ⇒ không có; lượt thi thử (kể cả xem lại) chưa có.
  const practiceSource = marks.source?.kind === 'practice' ? marks.source : null
  const canSaveWord = full && practiceSource != null
  const [wordJob, setWordJob] = React.useState<SaveWordJob | null>(null)
  const wordSeq = React.useRef(0)
  const closeWord = React.useCallback(() => setWordJob(null), [])

  const close = React.useCallback(() => {
    setBar(null)
    setTagsOpen(false)
    setNoteFor(null)
  }, [])

  const openEdit = React.useCallback((gid: string) => {
    setBar({ mode: 'edit', gid })
    setTagsOpen(false)
  }, [])

  const openBlock = !docked || !bar ? null : bar.mode === 'select' ? bar.piece.b : groupPieces(pack, bar.gid)[0]?.b ?? null
  const dockedCb = React.useRef(onDockedOpen)
  dockedCb.current = onDockedOpen
  React.useEffect(() => {
    dockedCb.current?.(openBlock)
  }, [openBlock])
  React.useEffect(() => () => dockedCb.current?.(null), [])

  // Không còn sửa được (thu màn, ẩn đánh dấu) ⇒ đóng.
  React.useEffect(() => {
    if (!canEdit) close()
  }, [canEdit, close])

  // Nhóm đang sửa bị xoá (hoàn tác, tẩy) ⇒ đóng.
  React.useEffect(() => {
    if (bar?.mode === 'edit' && groupPieces(pack, bar.gid).length === 0) close()
  }, [bar, pack, close])

  // ── vùng chọn → thanh công cụ ──────────────────────────────────────────────
  React.useEffect(() => {
    let down = false
    let downType = 'mouse'
    let downInUi = false
    let timer: number | undefined
    const inUi = (n: Node | null) => !!n && (!!barRef.current?.contains(n) || !!noteRef.current?.contains(n))

    const evaluate = () => {
      const l = live.current
      if (!l.canEdit || l.noteFor) return
      const root = rootRef.current
      const sel = window.getSelection()
      if (!root || !sel || sel.rangeCount === 0 || sel.isCollapsed) {
        // Bấm nút trên thanh làm mất vùng chọn (Safari, trình duyệt bỏ qua preventDefault): KHÔNG đóng —
        // vị trí cần tô đã giữ trong `bar.piece`, thao tác vẫn áp đúng chỗ.
        if (l.bar?.mode === 'select' && !downInUi) setBar(null)
        return
      }
      const range = sel.getRangeAt(0)
      if (inUi(range.commonAncestorContainer) || !root.contains(range.commonAncestorContainer)) return
      const piece = rangeToPiece(range, root, texts)
      if (!piece) {
        if (l.bar?.mode === 'select') setBar(null)
        return
      }
      // Cùng vùng chọn (lần kiểm tra hẹn trễ chạy sau khi đã bấm nút) ⇒ giữ nguyên thanh, không đóng hàng chọn câu.
      const cur = l.bar?.mode === 'select' ? l.bar.piece : null
      if (cur && cur.b === piece.b && cur.s === piece.s && cur.e === piece.e) return
      setTagsOpen(false)
      setBar({ mode: 'select', piece, range: range.cloneRange() })
    }

    const onDown = (e: PointerEvent) => {
      down = true
      downType = e.pointerType
      downInUi = inUi(e.target as Node)
    }
    const onUp = () => {
      down = false
      if (!downInUi) window.setTimeout(evaluate, 10)
    }
    const onSelection = () => {
      if (down && downType === 'mouse') return // chuột: đợi thả tay
      window.clearTimeout(timer)
      // bàn phím (Shift + mũi tên) · cảm ứng: nhấn giữ rồi kéo hai đầu — đợi tay dừng lâu hơn
      timer = window.setTimeout(evaluate, live.current.docked ? 400 : 150)
    }
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target || !target.isConnected || inUi(target)) return // nút vừa vẽ lại: không coi là bấm ra ngoài
      if (target.closest('.ga-mark-tag')) return
      const sel = window.getSelection()
      if (sel && !sel.isCollapsed) return
      const seg = target.closest<HTMLElement>('[data-seg][data-gid]')
      if (seg && rootRef.current?.contains(seg) && live.current.canEdit) {
        openEdit(seg.dataset.gid!)
        return
      }
      if (live.current.bar?.mode === 'edit') close()
    }

    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('pointerup', onUp, true)
    document.addEventListener('selectionchange', onSelection)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('pointerup', onUp, true)
      document.removeEventListener('selectionchange', onSelection)
      document.removeEventListener('click', onClick)
      window.clearTimeout(timer)
    }
  }, [rootRef, texts, openEdit, close])

  // Cuộn / đổi cỡ ⇒ đặt lại vị trí.
  React.useEffect(() => {
    if (!bar) return
    let raf = 0
    const again = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setTick((n) => n + 1))
    }
    window.addEventListener('scroll', again, true)
    window.addEventListener('resize', again)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', again, true)
      window.removeEventListener('resize', again)
    }
  }, [bar])

  // ── thao tác ───────────────────────────────────────────────────────────────
  const say = (msg: string) => setAnnounce(msg)
  const labelOf = (id: string | null) => items.find((it) => it.id === id)?.label ?? ''

  const clearSelection = () => window.getSelection()?.removeAllRanges()

  const applyNew = (k: 'hl' | 'ul', c: MarkColor | null, q: string | null = null): string | null => {
    if (bar?.mode !== 'select') return null
    let gid: string | null = null
    apply((p) => {
      const r = addMark(p, texts, [bar.piece], k, c, q)
      gid = r.gid
      return r.pack
    })
    clearSelection()
    if (gid) openEdit(gid)
    else close()
    return gid
  }

  const onColor = (c: MarkColor) => {
    if (bar?.mode === 'select') applyNew('hl', c)
    else if (bar?.mode === 'edit') {
      let gid = bar.gid
      apply((p) => {
        const r = recolor(p, texts, bar.gid, c)
        gid = r.gid
        return r.pack
      })
      openEdit(gid)
    }
  }

  const onUnderline = () => {
    if (bar?.mode === 'select') applyNew('ul', null)
    else if (bar?.mode === 'edit') apply((p) => toggleUnderline(p, texts, bar.gid))
  }

  const onTag = (q: string | null) => {
    if (bar?.mode === 'select') {
      const gid = applyNew('hl', colorAt(pack, bar.piece) ?? 'g', q)
      if (gid && q) say(t('announceTag', { n: labelOf(q) }))
    } else if (bar?.mode === 'edit') {
      apply((p) => setTag(p, bar.gid, q))
      say(q ? t('announceTag', { n: labelOf(q) }) : t('announceUntag'))
    }
    setTagsOpen(false)
  }

  const onQuick = () => {
    if (bar?.mode !== 'select' || !currentItemId) return
    const gid = applyNew('hl', 'g', currentItemId)
    if (gid) say(t('announceTag', { n: labelOf(currentItemId) }))
  }

  const onNote = () => {
    let gid: string | null = null
    if (bar?.mode === 'select') gid = applyNew('hl', 'y')
    else if (bar?.mode === 'edit') gid = bar.gid
    if (!gid) return
    openEdit(gid)
    setNoteText(groupPieces(live.current.pack, gid)[0]?.n ?? '')
    setNoteFor(gid)
  }

  const saveNote = (text: string) => {
    if (!noteFor) return
    apply((p) => setNote(p, noteFor, text))
    say(text.trim() ? t('announceNote') : t('announceNoteDeleted'))
    close()
  }

  const onErase = () => {
    if (bar?.mode !== 'select') return
    apply((p) => erase(p, [bar.piece]))
    clearSelection()
    close()
    say(t('announceErase'))
  }

  const onDelete = () => {
    if (bar?.mode !== 'edit') return
    apply((p) => removeGroup(p, bar.gid))
    close()
    say(t('announceDelete'))
  }

  /** Chữ đang chọn lưu được vào sổ (1–5 từ) — `null` nếu không. */
  const wordOf = (piece: Piece): string | null => {
    const text = texts[piece.b]
    return text ? saveableText(text.slice(piece.s, piece.e)) : null
  }
  const selWord = canSaveWord && bar?.mode === 'select' ? wordOf(bar.piece) : null
  /** Phím S đọc qua ref (trình nghe phím gắn một lần). */
  const saveRef = React.useRef(false)
  saveRef.current = selWord != null

  const onSaveWord = () => {
    if (bar?.mode !== 'select' || !practiceSource) return
    const word = wordOf(bar.piece)
    if (!word) return
    const { b, s, e } = bar.piece
    const box = barRef.current?.getBoundingClientRect()
    const sel = bar.range.getBoundingClientRect()
    setWordJob({
      key: ++wordSeq.current,
      request: {
        text: word,
        sentence: sentenceAround(texts[b] ?? '', s, e),
        examId: practiceSource.examId,
        teilKey: practiceSource.teilKey,
        block: b,
        start: s,
        end: e,
      },
      anchor: { left: box?.left ?? sel.left, top: Math.min(box?.top ?? sel.top, sel.top), bottom: Math.max(box?.bottom ?? sel.bottom, sel.bottom) },
    })
    clearSelection()
    close()
  }

  // Mở ghi chú từ dấu ghi chú trong bài (MarkedText gọi qua sự kiện).
  React.useEffect(() => {
    const onOpen = (e: Event) => {
      const gid = (e as CustomEvent<string>).detail
      if (!live.current.canEdit || groupPieces(live.current.pack, gid).length === 0) return
      setBar({ mode: 'edit', gid })
      setNoteText(groupPieces(live.current.pack, gid)[0]?.n ?? '')
      setNoteFor(gid)
    }
    window.addEventListener('ga-marks-open-note', onOpen)
    return () => window.removeEventListener('ga-marks-open-note', onOpen)
  }, [])

  // ── phím tắt khi thanh đang mở ──────────────────────────────────────────────
  const act = React.useRef({ onColor, onUnderline, onQuick, onNote, onErase, onDelete, close, onSaveWord })
  act.current = { onColor, onUnderline, onQuick, onNote, onErase, onDelete, close, onSaveWord }
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const l = live.current
      if (!l.bar || l.noteFor || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target instanceof Element ? e.target : null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      const k = e.key.toLowerCase()
      let handled = true
      if (COLOR_KEYS[k]) act.current.onColor(COLOR_KEYS[k])
      else if (k === 'u') act.current.onUnderline()
      else if (k === 'q' && full && l.bar.mode === 'select') act.current.onQuick()
      else if (k === 't' && full) setTagsOpen((v) => !v)
      else if (k === 'n' && full) act.current.onNote()
      else if (k === 's' && l.bar.mode === 'select' && saveRef.current) act.current.onSaveWord()
      else if (k === 'delete' || k === 'backspace') {
        if (l.bar.mode === 'edit') act.current.onDelete()
        else act.current.onErase()
      } else if (k === 'escape') {
        act.current.close()
        window.getSelection()?.removeAllRanges()
      } else handled = false
      if (handled) {
        e.preventDefault()
        e.stopImmediatePropagation() // phím a/b/c, j/k, f của màn làm bài không chạy chồng
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [full])

  // ── vị trí ─────────────────────────────────────────────────────────────────
  const anchor = (): { top: number; bottom: number; cx: number } | null => {
    if (!bar) return null
    if (bar.mode === 'select') {
      const rects = bar.range.getClientRects()
      if (rects.length === 0) return null
      const u = bar.range.getBoundingClientRect()
      return { top: u.top, bottom: u.bottom, cx: (rects[0].left + rects[0].right) / 2 }
    }
    const els = rootRef.current?.querySelectorAll<HTMLElement>(groupSelector(bar.gid))
    if (!els || els.length === 0) return null
    const first = els[0].getClientRects()[0] ?? els[0].getBoundingClientRect()
    let top = Infinity
    let bottom = -Infinity
    els.forEach((el) => {
      const r = el.getBoundingClientRect()
      top = Math.min(top, r.top)
      bottom = Math.max(bottom, r.bottom)
    })
    return { top, bottom, cx: (first.left + first.right) / 2 }
  }

  const [pos, setPos] = React.useState<{ left: number; top: number; hidden: boolean } | null>(null)
  // Chạy mỗi lần vẽ (cuộn/đổi cỡ đã ép vẽ lại qua `setTick`); setPos giữ nguyên tham chiếu khi vị trí
  // không đổi nên không lặp vô hạn.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    if (!bar || !barRef.current) {
      setPos(null)
      return
    }
    const a = anchor()
    if (!a) {
      setPos(null)
      return
    }
    if (docked) {
      // Neo đáy màn: vị trí do CSS (`left/right/bottom`), luôn hiện.
      setPos((p) => (p && p.left === 0 && p.top === 0 && !p.hidden ? p : { left: 0, top: 0, hidden: false }))
      return
    }
    const w = barRef.current.offsetWidth
    const h = barRef.current.offsetHeight
    let top = a.top - h - 10
    if (top < 8) top = a.bottom + 10
    const left = Math.min(Math.max(8, a.cx - w / 2), window.innerWidth - w - 8)
    const hidden = a.bottom < 0 || a.top > window.innerHeight
    setPos((p) => (p && p.left === left && p.top === top && p.hidden === hidden ? p : { left, top, hidden }))
  })

  // Portal chỉ sau khi đã gắn lên trang: lần vẽ đầu phải khớp HTML từ server (server không có document).
  if (!mounted) return null

  // ── vẽ ─────────────────────────────────────────────────────────────────────
  let curColor: MarkColor | null = null
  let hasUl = false
  let curQ: string | null = null
  let hasNote = false
  let overlap = false
  if (bar?.mode === 'edit') {
    const ps = groupPieces(pack, bar.gid)
    const h = ps[0]
    if (h) {
      curColor = h.k === 'hl' ? h.c : null
      hasUl = h.k === 'ul' || ps.every((p) => coveredFully(pack.marks, p, 'ul'))
      curQ = h.q
      hasNote = !!h.n
    }
  } else if (bar?.mode === 'select') {
    overlap = overlapsAny(pack, [bar.piece])
  }

  const btn =
    'relative inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-ga-touch px-2 text-ga-small font-semibold text-ga-ink hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus aria-pressed:bg-ga-navy-soft aria-expanded:bg-ga-navy-soft'
  const sep = <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-ga-line" />
  // Neo đáy (cảm ứng): nút đủ 44px, màu có tên ngắn bên dưới, nhóm gắn câu / ghi chú xuống hàng riêng.
  const tap = docked ? 'h-11 min-w-11' : ''
  const colorShort = (c: MarkColor) => t(c === 'y' ? 'shortY' : c === 'g' ? 'shortG' : 'shortP')
  const keep = (e: React.MouseEvent | React.PointerEvent) => e.preventDefault() // giữ vùng chọn
  const colorName = (c: MarkColor) => t(c === 'y' ? 'colorY' : c === 'g' ? 'colorG' : 'colorP')

  const toolbar = bar && (
    <div
      ref={barRef}
      role="toolbar"
      aria-label={t('toolbar')}
      onMouseDown={keep}
      onPointerDown={keep}
      data-docked={docked || undefined}
      style={
        docked
          ? { left: 8, right: 8, bottom: 'calc(12px + env(safe-area-inset-bottom))', visibility: pos ? 'visible' : 'hidden' }
          : { left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos && !pos.hidden ? 'visible' : 'hidden' }
      }
      className="ga-ui fixed z-50 select-none rounded-ga-touch border border-ga-line bg-ga-card p-1 text-ga-ink shadow-ga-panel"
    >
      <div className={cn('flex items-center gap-0.5', docked && 'flex-wrap justify-center')}>
        {MARK_COLORS.map((c, i) => (
          <button
            key={c}
            type="button"
            className={cn(btn, docked && 'h-14 min-w-0 flex-1 flex-col gap-0.5 px-1')}
            aria-pressed={curColor === c}
            onClick={() => onColor(c)}
            aria-label={colorName(c)}
            title={`${colorName(c)} (${i + 1})`}
          >
            <span aria-hidden className={cn('rounded-ga-pill border-[1.5px] border-ga-line-strong', docked ? 'h-6 w-6' : 'h-5 w-5', SWATCH[c])} />
            {docked && <span aria-hidden className="max-w-full truncate text-ga-caption font-normal text-ga-muted">{colorShort(c)}</span>}
          </button>
        ))}
        <button type="button" className={cn(btn, docked && 'h-14 min-w-11')} aria-pressed={hasUl} onClick={onUnderline} aria-label={t('underline')} title={`${t('underline')} (U)`}>
          <Underline size={docked ? 20 : 17} aria-hidden />
        </button>
        {full && (
          <>
            {docked ? <span aria-hidden className="h-px basis-full bg-ga-line" /> : sep}
            {bar.mode === 'select' && currentItemId && (
              <button
                type="button"
                onClick={onQuick}
                title={t('quickHint')}
                aria-label={t('quickHint')}
                className={cn(btn, tap, 'bg-ga-yellow hover:bg-ga-yellow hover:brightness-95')}
              >
                <MapPin size={15} aria-hidden />
                {t('quick', { n: labelOf(currentItemId) })}
              </button>
            )}
            <button type="button" className={cn(btn, tap)} aria-expanded={tagsOpen} onClick={() => setTagsOpen((v) => !v)} aria-label={t('tag')} title={`${t('tag')} (T)`}>
              <Hash size={17} aria-hidden />
              {curQ && <span className="rounded-ga bg-ga-yellow px-1 text-ga-caption tabular-nums">{labelOf(curQ)}</span>}
            </button>
            <button type="button" className={cn(btn, tap)} onClick={onNote} aria-label={t('note')} title={`${t('note')} (N)`}>
              <MessageSquareText size={17} aria-hidden />
              {hasNote && <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 rounded-ga-pill bg-ga-orange" />}
            </button>
            {selWord && (
              <button type="button" className={cn(btn, tap)} onClick={onSaveWord} aria-label={t('saveWordHint')} title={t('saveWordHint')}>
                <BookmarkPlus size={17} aria-hidden />
                {t('saveWord')}
              </button>
            )}
          </>
        )}
        {(overlap || bar.mode === 'edit') && sep}
        {overlap && (
          <button type="button" className={cn(btn, tap)} onClick={onErase} aria-label={t('erase')} title={`${t('erase')} (Del)`}>
            <Eraser size={17} aria-hidden />
          </button>
        )}
        {bar.mode === 'edit' && (
          <button type="button" className={cn(btn, tap)} onClick={onDelete} aria-label={t('remove')} title={`${t('remove')} (Del)`}>
            <Trash2 size={17} aria-hidden />
          </button>
        )}
      </div>
      {full && tagsOpen && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-ga-line px-1 pb-0.5 pt-1.5">
          <span className="text-ga-caption text-ga-muted">{t('tagTo')}</span>
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => onTag(it.id)}
              aria-pressed={curQ === it.id}
              className={cn(
                'relative h-8 min-w-8 rounded-ga-touch border-[1.5px] px-2 text-ga-small font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
                curQ === it.id ? 'border-ga-yellow bg-ga-yellow text-ga-ink' : 'border-ga-line-strong bg-ga-card text-ga-ink hover:bg-ga-side-active',
              )}
              title={it.id === currentItemId ? t('currentItem') : undefined}
            >
              {it.label}
              {it.id === currentItemId && <span aria-hidden className="absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-ga-pill bg-ga-yellow" />}
            </button>
          ))}
          {curQ && (
            <button type="button" onClick={() => onTag(null)} className="h-8 rounded-ga-touch px-2 text-ga-caption font-semibold text-ga-muted hover:bg-ga-side-active">
              {t('untag')}
            </button>
          )}
        </div>
      )}
    </div>
  )

  const notePiece = noteFor ? groupPieces(pack, noteFor)[0] : null
  const barBox = barRef.current?.getBoundingClientRect()
  const noteTop = barBox ? (barBox.bottom + 8 + 220 > window.innerHeight ? Math.max(8, barBox.top - 228) : barBox.bottom + 8) : 80
  const note = noteFor && notePiece && (
    <div
      ref={noteRef}
      role="dialog"
      aria-label={t('noteTitle', { where: describe(notePiece) })}
      style={docked ? { left: 8, right: 8, top: 'calc(8px + env(safe-area-inset-top))' } : { left: Math.min(Math.max(8, barBox?.left ?? 8), window.innerWidth - 316), top: noteTop }}
      className={cn('ga-ui fixed z-50 rounded-ga-touch border border-ga-line bg-ga-card p-3 text-ga-ink shadow-ga-panel', !docked && 'w-[300px]')}
    >
      <label htmlFor={textareaId} className="mb-1.5 block text-ga-caption font-semibold text-ga-muted">
        {t('noteTitle', { where: describe(notePiece) })}
      </label>
      <textarea
        id={textareaId}
        autoFocus
        value={noteText}
        maxLength={MAX_NOTE}
        onChange={(e) => setNoteText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            saveNote(noteText)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            setNoteFor(null)
          }
        }}
        placeholder={t('notePlaceholder')}
        rows={3}
        className="block w-full resize-y rounded-ga-touch border border-ga-line bg-ga-bg px-2.5 py-2 text-ga-body text-ga-ink caret-ga-ink placeholder:text-ga-subtle focus:outline-none focus:ring-2 focus:ring-ga-focus"
      />
      <div className="mt-2.5 flex items-center gap-2">
        {notePiece.n && (
          <button type="button" onClick={() => saveNote('')} className="h-9 rounded-ga-touch border border-ga-line px-3 text-ga-small font-semibold text-ga-ink hover:bg-ga-side-active">
            {t('noteDelete')}
          </button>
        )}
        <span className="flex-1" />
        <button type="button" onClick={() => setNoteFor(null)} className="h-9 rounded-ga-touch border border-ga-line px-3 text-ga-small font-semibold text-ga-ink hover:bg-ga-side-active">
          {t('noteCancel')}
        </button>
        <button type="button" onClick={() => saveNote(noteText)} className="h-9 rounded-ga-touch bg-ga-ink px-3 text-ga-small font-semibold text-ga-card hover:opacity-90">
          {t('noteSave')}
        </button>
      </div>
      <p className="mt-1.5 text-ga-caption text-ga-subtle">{t('noteHint')}</p>
    </div>
  )

  // Portal ra body nằm ngoài `.ga-scope` của trang ⇒ tự bọc để token --ga-* có giá trị.
  return createPortal(
    <div className="ga-scope">
      {toolbar}
      {note}
      {wordJob && <SaveWordCard key={wordJob.key} job={wordJob} docked={docked} onClose={closeWord} onAnnounce={say} />}
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </div>,
    document.body,
  )
}
