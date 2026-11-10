'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { Check, ChevronDown, ChevronRight, CircleSlash, Flag, MapPin, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PracticeItemResult, PracticeTeilResult } from '@/lib/telcPracticeApi'
import { evidenceRanges } from '@/lib/exam/evidenceRanges'
import { ReadingPassage, lineNumberAt, passageLineMap, passageText } from '@/components/exam/telc/ReadingPassage'
import { MarkedText, type MarkLayer } from '@/components/exam/marks/MarkedText'
import { MarkDiagnosis } from '@/components/exam/marks/MarkDiagnosis'
import { MarksBar } from '@/components/exam/marks/MarksBar'
import { PassageMarker } from '@/components/exam/marks/PassageMarker'
import { diagnose, groupSelector, groupsForItem, isStruck, lastPieces, setStruck, type Mark, type Piece } from '@/components/exam/marks/marksModel'
import { blockOrderOf, evidenceBlocks, evidencePieces, gapPieces, marksSupported } from '@/components/exam/marks/marksBlocks'
import type { PassageMarks } from '@/components/exam/marks/usePassageMarks'
import { parseGappedText } from '@/components/exam/telc/telcTeil'
import { ItemAnalysis, LetterBadge } from './ItemAnalysis'
import { FlagToggle, FlaggedList, ItemAssist, NoteField } from './itemAssist'
import { PracticeFootSlot } from './PracticeShell'
import { SplitPanes, type SheetSnap } from './SplitPanes'
import {
  NONE_OF_THEM,
  itemLabel,
  nextUnanswered,
  optionsFor,
  ownerOf,
  sharedPool,
  type PracticeItem,
  type PracticeKind,
  type PracticeTeilData,
} from './practiceModel'

interface Props {
  teil: PracticeTeilData
  kind: Exclude<PracticeKind, 'writing' | 'unknown'>
  answers: Record<string, string>
  onAnswer: (itemId: string, value: string | null) => void
  /** Có sau khi bấm "Kiểm tra Teil này" (hoặc mở lại Teil đã kiểm tra). */
  result: PracticeTeilResult | null
  /** ≥760px: hai cột cuộn riêng. Dưới đó: cột nguồn làm nền, cột trả lời trong ngăn kéo lên xuống. */
  wide: boolean
  tips: React.ReactNode
  /** Khối đặt ngay dưới câu lệnh (Hören: bài nghe cấp Teil). */
  intro?: React.ReactNode
  /** Khối đặt trên câu hỏi của từng câu (Hören: bài nghe của câu). */
  itemExtra?: (item: PracticeItem) => React.ReactNode
  /** Thay cột trả lời (Hören: câu hỏi còn khoá khi chưa bắt đầu / đang đọc hướng dẫn). */
  answersOverride?: React.ReactNode
  /** Câu cần đưa lên làm câu đang làm (Hören: đoạn đang nghe ứng với câu này). */
  focusId?: string | null
  /** Khối đặt trên cùng cột trả lời (Hören màn hẹp: trình phát của đoạn đang nghe). */
  answersTop?: React.ReactNode
  /**
   * Đánh dấu bài đọc (09/11/2026; Lesen 2 — luyện Teil, thi thử, xem lại lượt thi). Trang tạo bằng
   * `usePassageMarks`; không truyền ⇒ không có công cụ đánh dấu.
   */
  marks?: PassageMarks | null
  /**
   * `full` (mặc định): đủ công cụ — luyện Teil, xem lại sau khi nộp. `exam`: đang thi thử — chỉ màu, gạch
   * chân, tẩy, gạch bỏ đáp án; không gắn số câu, không ghi chú (owner chốt 09/11/2026; server cũng bỏ).
   */
  marksMode?: 'full' | 'exam'
}

export { marksTexts } from '@/components/exam/marks/marksBlocks'

type Req<T> = { n: number } & T

/**
 * Một Teil khách quan của luyện đề telc, trong khung hai vùng (đợt (a) 07/11/2026).
 *
 * Bên trái là NGUỒN, bên phải là TRẢ LỜI, mỗi bên cuộn riêng:
 * Lesen 1 — các text có ô chọn | kho tiêu đề · Lesen 2 — bài đọc | câu a/b/c ·
 * Lesen 3 — các mẩu rao vặt | tình huống + "không mẩu nào" · Sprachbausteine — thư có chỗ trống |
 * phương án của chỗ đang chọn + tổng quan các chỗ · Hören — bài nghe | richtig/falsch.
 *
 * Thao tác owner chốt (phương án A, 03/11/2026): chạm câu → chạm đáp án; lựa chọn đã dùng ở câu khác
 * thì viền đứt + "ở câu N" (vẫn chọn được — nó chuyển sang câu đang chọn); đúng/sai chỉ hiện sau khi
 * kiểm tra cả Teil. Hàng ô số câu nằm ở thanh dưới của vỏ (portal).
 *
 * B3 (09/11/2026, context `ItemAssist`): cờ "đánh dấu xem lại" cho MỌI dạng câu (trắc nghiệm trong thẻ câu,
 * dạng nối/chỗ trống/rao vặt cạnh câu đang chọn, phím F) + hàng "Câu đã đánh dấu" để nhảy tới; trang cấp
 * `flags` thì cờ do trang giữ (thi thử lưu cùng nháp). Ô "Vì sao tôi chọn" khi trang cấp `onNote` (luyện Teil).
 */
export function ObjectiveTeilView({ teil, kind, answers, onAnswer, result, wide, tips, intro, itemExtra, answersOverride, focusId, answersTop, marks, marksMode = 'full' }: Props) {
  const t = useTranslations('v2.student.practice')
  const tf = useTranslations('v2.student.practice.frame')
  const items = React.useMemo(() => teil.items ?? [], [teil.items])
  const checked = result != null
  const byId = React.useMemo(() => new Map(result?.items.map((r) => [r.id, r]) ?? []), [result])
  const isMc = kind === 'mc'
  const isGap = kind === 'gap-mc' || kind === 'gap-bank'
  const isAds = kind === 'match' && teil.type === 'MATCH_AD_X'
  const footSlot = React.useContext(PracticeFootSlot)
  const ta = useTranslations('v2.student.practice.assist')
  const assist = React.useContext(ItemAssist)
  const canNote = !checked && !!assist.onNote

  // Câu đang chọn đáp án (nối / chỗ trống) · câu đang làm (trắc nghiệm, cho phím tắt và ô số câu).
  const [active, setActive] = React.useState<string | null>(() => nextUnanswered(items, answers))
  const [current, setCurrent] = React.useState<string | null>(() => nextUnanswered(items, answers) ?? items[0]?.id ?? null)
  const [selected, setSelected] = React.useState<string | null>(null)
  const [localFlags, setLocalFlags] = React.useState<Set<string>>(() => new Set())
  const flags: ReadonlySet<string> = assist.flags ?? localFlags
  const [snapReq, setSnapReq] = React.useState<Req<{ snap: SheetSnap }> | undefined>()
  const [revealReq, setRevealReq] = React.useState<Req<{ selector: string }> | undefined>()
  const scrollTarget = React.useRef<string | null>(null)
  const requestSnap = (snap: SheetSnap) => !wide && setSnapReq((r) => ({ snap, n: (r?.n ?? 0) + 1 }))
  const reveal = (selector: string) => setRevealReq((r) => ({ selector, n: (r?.n ?? 0) + 1 }))

  // Sau khi kiểm tra: mở sẵn câu sai đầu tiên — đó là câu người học cần đọc nhất.
  React.useEffect(() => {
    if (!result) return
    const firstWrong = result.items.find((r) => !r.isCorrect) ?? result.items[0]
    setSelected(firstWrong?.id ?? null)
    setCurrent(firstWrong?.id ?? null)
    setActive(null)
    if (firstWrong) scrollTarget.current = firstWrong.id
  }, [result])

  // Hören: đoạn đang nghe đổi ⇒ câu tương ứng thành câu đang làm và cuộn tới.
  React.useEffect(() => {
    if (!focusId) return
    setCurrent(focusId)
    scrollTarget.current = focusId
  }, [focusId])

  React.useEffect(() => {
    if (!scrollTarget.current) return
    const id = scrollTarget.current
    scrollTarget.current = null
    const el = document.getElementById(`pq-${id}`) ?? document.getElementById(`pg-${id}`)
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })

  const pick = (key: string) => {
    if (!active || checked) return
    // Mỗi lựa chọn của kho dùng một lần: lấy lại từ câu đang giữ nó (trừ `x`).
    const holder = sharedPool(teil).length > 0 && key !== NONE_OF_THEM ? ownerOf(answers, key, items) : undefined
    if (holder && holder !== active) onAnswer(holder, null)
    onAnswer(active, answers[active] === key ? null : key)
    const nextAnswers = { ...answers, [active]: key }
    if (holder && holder !== active) delete nextAnswers[holder]
    const next = nextUnanswered(items, nextAnswers, active)
    if (next) {
      setActive(next)
      scrollTarget.current = next
    }
    // Màn hẹp: chọn xong thu ngăn để đọc tiếp; Lesen 3 ngược lại (mẩu rao vặt nằm ở nền).
    requestSnap(isAds ? 1 : 0)
  }

  /** Bấm câu / chỗ trống ở cột nguồn. */
  const openFromSource = (id: string) => {
    if (checked) {
      setSelected(id)
      setCurrent(id)
      requestSnap(1)
      return
    }
    setActive(id)
    setCurrent(id)
    requestSnap(1)
  }

  /** Bấm ô số câu ở thanh dưới. */
  const jumpTo = (id: string) => {
    setCurrent(id)
    if (checked) setSelected(id)
    else if (!isMc) setActive(id)
    scrollTarget.current = id
    requestSnap(isAds && !checked ? 0 : 1)
  }

  const toggleFlag = (id: string) => {
    if (assist.onToggleFlag) {
      assist.onToggleFlag(id)
      return
    }
    setLocalFlags((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const answerMc = (id: string, value: string) => {
    if (checked) return
    setCurrent(id)
    onAnswer(id, value)
  }

  // ── phím tắt ───────────────────────────────────────────────────────────────
  const locked = answersOverride != null
  const keyState = React.useRef({ items, answers, current, active, checked, isMc, locked })
  keyState.current = { items, answers, current, active, checked, isMc, locked }
  // Hàm mới nhất của mỗi lần vẽ — trình nghe phím chỉ gắn một lần cho mỗi Teil.
  const act = React.useRef({ pick, jumpTo, answerMc, toggleFlag })
  act.current = { pick, jumpTo, answerMc, toggleFlag }
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = keyState.current
      if (s.checked || s.locked || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target instanceof Element ? e.target : null
      if (target?.closest('input, textarea, select, [role="separator"], [contenteditable="true"]')) return
      if (document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]')) return
      const k = e.key.toLowerCase()
      if (s.isMc) {
        const idx = s.items.findIndex((it) => it.id === s.current)
        const cur = s.items[idx]
        if (!cur) return
        const opt = optionsFor(teil, cur).find((o) => o.key.toLowerCase().charAt(0) === k)
        if (k.length === 1 && opt) {
          e.preventDefault()
          act.current.answerMc(cur.id, opt.key)
        } else if (k === 'j' || k === 'k') {
          const next = s.items[Math.min(s.items.length - 1, Math.max(0, idx + (k === 'j' ? 1 : -1)))]
          if (next) act.current.jumpTo(next.id)
        } else if (k === 'f') {
          act.current.toggleFlag(cur.id)
        }
        return
      }
      const cur = s.items.find((it) => it.id === s.active)
      if (!cur) return
      const keys = optionsFor(teil, cur).map((o) => o.key.toLowerCase())
      if (teil.allow_none) keys.push(NONE_OF_THEM)
      if (k.length === 1 && keys.includes(k)) {
        e.preventDefault()
        const real = optionsFor(teil, cur).find((o) => o.key.toLowerCase() === k)?.key ?? k
        act.current.pick(real)
      } else if (k === 'f') {
        act.current.toggleFlag(cur.id)
      } else if (e.key === 'Enter') {
        const idx = s.items.findIndex((it) => it.id === cur.id)
        const next = s.items[(idx + 1) % s.items.length]
        if (next) {
          e.preventDefault()
          act.current.jumpTo(next.id)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teil])

  // ── đánh dấu bài đọc (09/11/2026; đợt 3 thêm Lesen 1, Lesen 3, Sprachbausteine — màn ≥ 760px) ──
  const tm = useTranslations('v2.student.practice.marks')
  const marksOn = !!marks && marksSupported(teil, kind) && marks.ready
  const canMark = marksOn && wide && !marks!.hidden
  const marksFull = marksMode === 'full'
  const marksRoot = React.useRef<HTMLDivElement>(null)
  const ctxText = React.useMemo(() => passageText(teil.context ?? ''), [teil.context])
  const ctxLines = React.useMemo(() => passageLineMap(ctxText), [ctxText])
  const blockOrder = React.useMemo(() => blockOrderOf(teil), [teil])
  const labelOfId = React.useCallback((id: string) => {
    const it = items.find((i) => i.id === id)
    return it ? itemLabel(it) : id
  }, [items])
  const describe = React.useCallback(
    (p: Piece) => {
      if (p.b.startsWith('q:')) return tm('inQuestion', { n: labelOfId(p.b.slice(2)) })
      if (p.b.startsWith('t:')) return tm('inText', { n: labelOfId(p.b.slice(2)) })
      if (p.b.startsWith('ad:')) return tm('inAd', { k: p.b.slice(3) })
      if (p.b === 'gap') return tm('inLetter')
      const a = lineNumberAt(ctxLines, p.s)
      const b = lineNumberAt(ctxLines, Math.max(p.s, p.e - 1))
      return a === b ? tm('line', { n: a }) : tm('lines', { a, b })
    },
    [ctxLines, labelOfId, tm],
  )
  const jumpRef = React.useRef(jumpTo)
  jumpRef.current = jumpTo
  const pack = marks?.pack
  const layer = React.useMemo<MarkLayer | null>(
    () =>
      marksOn && pack
        ? {
            pack,
            blockOrder,
            labelOf: labelOfId,
            onGoItem: (id) => jumpRef.current(id),
            onOpenNote: (gid) => window.dispatchEvent(new CustomEvent('ga-marks-open-note', { detail: gid })),
            tagLabel: (n) => tm('tagBadge', { n }),
            noteLabel: (note) => tm('noteBadge', { note }),
          }
        : null,
    [marksOn, pack, blockOrder, labelOfId, tm],
  )
  const markedItems = React.useMemo(
    () => new Set(pack && marksOn ? items.filter((it) => groupsForItem(pack, it.id, blockOrder).length > 0).map((it) => it.id) : []),
    [pack, marksOn, items, blockOrder],
  )

  // "Xem trong bài": cuộn tới đoạn đã gắn vào câu, bấm tiếp ⇒ đoạn sau.
  const [markCycle, setMarkCycle] = React.useState<Record<string, number>>({})
  const flashEls = (els: NodeListOf<HTMLElement> | undefined) =>
    els?.forEach((el) => {
      el.classList.remove('ga-mark-flash')
      void el.offsetWidth
      el.classList.add('ga-mark-flash')
      window.setTimeout(() => el.classList.remove('ga-mark-flash'), 1400)
    })
  const showMarksOf = (id: string) => {
    if (!pack) return
    const gs = groupsForItem(pack, id, blockOrder)
    if (gs.length === 0) return
    const i = (markCycle[id] ?? 0) % gs.length
    setMarkCycle((c) => ({ ...c, [id]: i + 1 }))
    const sel = groupSelector(gs[i])
    const first = pack.marks.find((m) => m.g === gs[i])
    // đề câu trắc nghiệm nằm ở cột trả lời; mọi khối khác ở cột nguồn (ngăn kéo màn hẹp phải mở ra)
    if (isMc && first?.b.startsWith('q:')) marksRoot.current?.querySelector<HTMLElement>(sel)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    else reveal(sel)
    window.setTimeout(() => flashEls(marksRoot.current?.querySelectorAll<HTMLElement>(sel)), 300)
  }

  const struck = (id: string, opt: string) => !!pack && marksOn && isStruck(pack, id, opt)
  const toggleStrike = (id: string, opt: string) => {
    if (!marks || checked) return
    const on = !isStruck(marks.pack, id, opt)
    marks.apply((p) => setStruck(p, id, opt, on))
    if (on && answers[id] === opt) onAnswer(id, null) // gạch bỏ phương án đang chọn ⇒ bỏ chọn
  }
  const pickMc = (id: string, opt: string) => {
    if (marks && marksOn && isStruck(marks.pack, id, opt)) marks.apply((p) => setStruck(p, id, opt, false))
    answerMc(id, opt)
  }

  const diagnosisFor = (res: PracticeItemResult): React.ReactNode => {
    if (!marksOn || !pack || res.evidence.length === 0) return null
    const ev = evidencePieces(marks!.texts, evidenceBlocks(teil, kind, res.id), res.evidence).sort(
      (x, y) => blockOrder(x.b) - blockOrder(y.b) || x.s - y.s,
    )
    if (ev.length === 0) return null
    const d = diagnose(pack, res.id, ev)
    const sameBlock = ev.every((p) => p.b === ev[0].b)
    const where = describe(sameBlock ? { b: ev[0].b, s: ev[0].s, e: ev[ev.length - 1].e } : ev[0])
    const mine = Array.from(new Set(d.tagged.map(describe))).join(', ')
    return <MarkDiagnosis diagnosis={d} where={where} mine={mine} isCorrect={res.isCorrect} />
  }

  // Trang yêu cầu nhảy tới một câu (danh sách câu đánh dấu của cả chặng thi). Teil mới gắn vào cũng nhận.
  const jumpReq = assist.jump
  React.useEffect(() => {
    if (!jumpReq || !items.some((it) => it.id === jumpReq.id)) return
    act.current.jumpTo(jumpReq.id)
  }, [jumpReq, items])

  const activeItem = items.find((it) => it.id === active) ?? null
  const currentItem = items.find((it) => it.id === current) ?? null
  const answered = items.filter((it) => answers[it.id]).length
  const selectedRes = selected ? byId.get(selected) ?? null : null

  // ── kho lựa chọn cho câu đang chọn ─────────────────────────────────────────
  const optionList = (forItem: PracticeItem | null, onlyNone = false) => {
    if (!forItem) return null
    const opts = onlyNone ? [] : optionsFor(teil, forItem)
    const shared = sharedPool(teil).length > 0
    const withNone = teil.allow_none ? [...opts, { key: NONE_OF_THEM, label: t('noneOfThem') }] : opts
    if (withNone.length === 0) return null
    return (
      <div className={cn(kind === 'gap-bank' ? 'grid grid-cols-2 gap-2' : 'space-y-2')} role="radiogroup" aria-label={t('pickFor', { n: itemLabel(forItem) })}>
        {withNone.map((o) => {
          const mine = answers[forItem.id] === o.key
          const holder = shared && o.key !== NONE_OF_THEM ? ownerOf(answers, o.key, items) : undefined
          const used = !!holder && holder !== forItem.id
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={mine}
              onClick={() => pick(o.key)}
              className={cn(
                'ga-ui flex min-h-12 w-full items-center gap-3 rounded-ga-touch px-3 py-2 text-left text-ga-body-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-1 active:scale-[0.995]',
                mine && 'border-[1.5px] border-ga-navy bg-ga-navy text-ga-card',
                !mine && used && 'border-[1.5px] border-dashed border-ga-line text-ga-muted hover:bg-ga-bg',
                !mine && !used && o.key === NONE_OF_THEM && 'border-[1.5px] border-dashed border-ga-line-strong bg-ga-card text-ga-ink hover:bg-ga-navy-soft',
                !mine && !used && o.key !== NONE_OF_THEM && 'border-[1.5px] border-ga-line-strong bg-ga-card text-ga-ink hover:bg-ga-navy-soft',
              )}
            >
              <LetterBadge value={o.key} tone={mine ? 'inverse' : used ? 'muted' : 'outline'} />
              <span lang="de" className="min-w-0 flex-1 break-words">{o.label}</span>
              {(mine || used) && (
                <span className={cn('shrink-0 text-ga-caption', mine ? 'text-ga-card' : 'text-ga-muted')}>
                  {mine ? t('picking') : t('usedAt', { n: itemLabel(items.find((it) => it.id === holder)!) })}
                </span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  const noteFor = (item: PracticeItem) => (
    <NoteField
      key={item.id}
      itemId={item.id}
      label={ta('noteLabel', { n: itemLabel(item) })}
      value={assist.notes?.[item.id] ?? ''}
      onChange={(v) => assist.onNote?.(item.id, v)}
    />
  )

  // Thân thẻ câu qua lớp đánh dấu: đề câu (`q:`) hoặc đoạn văn Lesen 1 (`t:`). Lesen 1 sau kiểm tra: câu
  // đang xem tô bằng chứng ngay trong đoạn văn (thay `highlight()` khi không có lớp đánh dấu).
  const stemFor = (item: PracticeItem): React.ReactNode => {
    const b = kind === 'match' && item.text ? `t:${item.id}` : item.question ? `q:${item.id}` : null
    const text = b ? marks!.texts[b] : undefined
    if (!b || text == null) return undefined
    const res = byId.get(item.id)
    const ev = b.startsWith('t:') && res && selected === item.id ? evidencePieces(marks!.texts, [b], res.evidence) : undefined
    return <MarkedText block={b} text={text} layer={layer} evidence={ev} />
  }

  const cardFor = (item: PracticeItem, analysisInline: boolean) => (
    <ItemCard
      key={item.id}
      item={item}
      kind={kind}
      teil={teil}
      answer={answers[item.id]}
      active={!checked && !isMc && active === item.id}
      current={isMc && !checked && current === item.id}
      flagged={flags.has(item.id)}
      onFlag={isMc && !checked ? () => toggleFlag(item.id) : undefined}
      note={canNote && isMc && (answers[item.id] || assist.notes?.[item.id]) ? noteFor(item) : undefined}
      res={byId.get(item.id)}
      selected={selected === item.id}
      wide={!analysisInline}
      extra={itemExtra?.(item)}
      onOpen={() => (isMc ? setSelected((cur) => (cur === item.id ? null : item.id)) : openFromSource(item.id))}
      onMc={(v) => pickMc(item.id, v)}
      onShowEvidence={isMc && teil.context ? () => reveal('mark[data-evidence]') : undefined}
      stem={layer ? stemFor(item) : undefined}
      struck={marksOn ? (opt) => struck(item.id, opt) : undefined}
      onStrike={marksOn && !checked ? (opt) => toggleStrike(item.id, opt) : undefined}
      marksChip={
        marksFull && markedItems.has(item.id) ? (
          <button
            type="button"
            onClick={() => showMarksOf(item.id)}
            className="ga-ui inline-flex min-h-8 items-center gap-1.5 rounded-ga-pill border border-ga-navy-soft bg-ga-navy-soft px-2.5 text-ga-caption font-semibold text-ga-navy hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
          >
            <MapPin size={13} aria-hidden />
            {tm('seeMarks', { count: groupsForItem(pack!, item.id, blockOrder).length })}
          </button>
        ) : undefined
      }
      analysisExtra={byId.get(item.id) ? diagnosisFor(byId.get(item.id)!) : undefined}
    />
  )

  // ── cột nguồn ──────────────────────────────────────────────────────────────
  const passageHighlights = isMc && checked && selectedRes ? selectedRes.evidence : NO_EVIDENCE
  const source = (
    <div className="mx-auto w-full max-w-[720px]">
      {tips}
      <TaskLine teil={teil} />
      {intro}
      {result && <ScoreLine result={result} />}
      {teil.examples && teil.examples.length > 0 && <Examples examples={teil.examples} />}
      {marksOn && <MarksBar marks={marks!} canEdit={wide} full={marksFull} />}
      {isMc && teil.context && (
        <ReadingPassage
          teil={teil}
          highlights={passageHighlights}
          evidenceLabel={selectedRes ? tm('evidenceTag', { n: selectedRes.label }) : undefined}
          layer={layer}
        />
      )}
      {isGap && (
        <GappedText
          teil={teil}
          items={items}
          answers={answers}
          active={active}
          selected={selected}
          byId={byId}
          onOpen={openFromSource}
          layer={layer}
          text={marks?.texts.gap}
        />
      )}
      {kind === 'match' && !isAds && items.map((item) => cardFor(item, false))}
      {isAds && (
        <AdPool
          teil={teil}
          items={items}
          answers={answers}
          active={activeItem}
          checked={checked}
          onPick={(key) => pick(key)}
          layer={layer}
          texts={marks?.texts}
        />
      )}
    </div>
  )

  // ── cột trả lời ────────────────────────────────────────────────────────────
  let answersPane: React.ReactNode
  if (isMc) {
    answersPane = (
      <div>
        {!checked && <p className="ga-ui mb-2.5 text-ga-eyebrow uppercase text-ga-muted">{t('answeredCount', { done: answered, total: items.length })}</p>}
        {items.map((item) => cardFor(item, true))}
      </div>
    )
  } else if (checked && result) {
    answersPane = (
      <div>
        {selectedRes && (
          <div className="mb-5">
            <ItemAnalysis
              item={selectedRes}
              title={itemTitle(t, kind, selectedRes)}
              onShowEvidence={kind === 'match' && !isAds && selectedRes.evidence.length > 0 ? () => reveal(`#pq-${selectedRes.id} mark`) : undefined}
              extra={diagnosisFor(selectedRes)}
            />
          </div>
        )}
        <p className="ga-ui mb-2.5 text-ga-eyebrow uppercase text-ga-muted">{t('resultsEach')}</p>
        <ul className="mb-4 overflow-hidden rounded-ga-touch border border-ga-line">
          {result.items.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(r.id)
                  setCurrent(r.id)
                }}
                aria-current={selected === r.id}
                className={cn(
                  'ga-ui flex min-h-12 w-full items-center gap-3 border-b border-ga-line px-3 text-left text-ga-body last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus',
                  selected === r.id ? 'bg-ga-navy-soft shadow-ga-selected-bar' : 'bg-ga-card hover:bg-ga-bg',
                )}
              >
                <LetterBadge value={r.given ?? '–'} tone={!r.answered ? 'empty' : r.isCorrect ? 'ok' : 'bad'} />
                <span className="min-w-0 flex-1 truncate">
                  {itemTitle(t, kind, r)} · {r.isCorrect ? t('correctShort') : r.answered ? t('wrongShort', { key: r.correct }) : t('emptyShort', { key: r.correct })}
                </span>
                <ChevronRight size={16} className="shrink-0 text-ga-subtle" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        {result.unusedOptions.length > 0 && <UnusedOptions result={result} />}
      </div>
    )
  } else if (isAds) {
    answersPane = (
      <div>
        <div className="mb-2.5 flex items-center gap-2">
          <p className="ga-ui min-w-0 flex-1 text-ga-small text-ga-muted">
            {activeItem ? (wide ? tf('pickAdLeft', { n: itemLabel(activeItem) }) : tf('pickAdAbove', { n: itemLabel(activeItem) })) : t('answeredCount', { done: answered, total: items.length })}
          </p>
          {activeItem && <FlagToggle label={tf('flag', { n: itemLabel(activeItem) })} flagged={flags.has(activeItem.id)} onToggle={() => toggleFlag(activeItem.id)} />}
        </div>
        {teil.allow_none && <div className="mb-4">{optionList(activeItem, true)}</div>}
        {canNote && activeItem && <div className="mb-4">{noteFor(activeItem)}</div>}
        <div className="space-y-2.5">
          {items.map((item) => (
            <SituationRow
              key={item.id}
              item={item}
              answer={answers[item.id]}
              answerText={answerLabel(teil, item, answers[item.id], t('noneOfThem'))}
              active={active === item.id}
              onOpen={() => {
                setActive(item.id)
                setCurrent(item.id)
                requestSnap(0)
              }}
            />
          ))}
        </div>
      </div>
    )
  } else {
    answersPane = activeItem ? (
      <div>
        <div className="mb-2.5 flex items-center gap-2">
          <p className="ga-ui min-w-0 flex-1 text-ga-eyebrow uppercase text-ga-muted">
            {kind === 'match' ? t('pickFor', { n: itemLabel(activeItem) }) : t('pickForGap', { n: itemLabel(activeItem) })}
          </p>
          <FlagToggle label={tf('flag', { n: itemLabel(activeItem) })} flagged={flags.has(activeItem.id)} onToggle={() => toggleFlag(activeItem.id)} />
        </div>
        {optionList(activeItem)}
        {canNote && <div className="mt-3">{noteFor(activeItem)}</div>}
        {kind === 'gap-bank' && <p className="ga-ui mt-3 text-ga-caption text-ga-muted">{t('singleUseHint')}</p>}
        {isGap && <GapOverview teil={teil} items={items} answers={answers} active={active} onOpen={(id) => jumpTo(id)} />}
      </div>
    ) : (
      <p className="ga-ui text-ga-body text-ga-muted">{t('answeredCount', { done: answered, total: items.length })}</p>
    )
  }

  // Hàng "Câu đã đánh dấu" trên cột trả lời khi đang làm.
  const flaggedItems = checked ? [] : items.filter((it) => flags.has(it.id)).map((it) => ({ id: it.id, label: itemLabel(it) }))
  if (flaggedItems.length > 0) answersPane = <>{<FlaggedList items={flaggedItems} onJump={jumpTo} />}{answersPane}</>

  const sheetItem = checked ? selectedRes : isMc ? currentItem : activeItem
  const sheetLabel = checked
    ? selectedRes
      ? tf('sheetReview', { n: selectedRes.label })
      : t('resultsEach')
    : sheetItem
      ? `${isGap ? t('gapTitle', { n: itemLabel(sheetItem) }) : t('itemTitle', { n: itemLabel(sheetItem) })} · ${answered}/${items.length}`
      : t('answeredCount', { done: answered, total: items.length })

  const panes = (
    <SplitPanes
      wide={wide}
      source={source}
      answers={answersOverride ?? (answersTop ? <>{answersTop}{answersPane}</> : answersPane)}
      sheetLabel={sheetLabel}
      snapRequest={snapReq}
      revealRequest={revealReq}
      sourceLabel={tf('sourceLabel')}
      answersLabel={tf('answersLabel')}
    />
  )

  return (
    <>
      {marks ? (
        // `contents`: không thêm hộp vào bố cục, chỉ làm gốc cho vùng chọn + lớp ẩn đánh dấu.
        // Có ngay từ đầu (không chờ tải) để SplitPanes không bị dựng lại khi đánh dấu về.
        <div ref={marksRoot} className={cn('contents', marks.hidden && 'ga-marks-hidden')}>
          {panes}
        </div>
      ) : (
        panes
      )}
      {marksOn && (
        <PassageMarker
          marks={marks!}
          rootRef={marksRoot}
          canEdit={canMark}
          items={items.map((it) => ({ id: it.id, label: itemLabel(it) }))}
          currentItemId={current}
          full={marksFull}
          describe={describe}
        />
      )}
      {footSlot &&
        createPortal(
          <QuestionDots
            items={items}
            answers={answers}
            byId={byId}
            current={checked ? selected : isMc ? current : active}
            flags={flags}
            marked={markedItems}
            onPick={jumpTo}
          />,
          footSlot,
        )}
      <span className="sr-only" aria-live="polite">{t('answeredCount', { done: answered, total: items.length })}</span>
    </>
  )
}

const NO_EVIDENCE: string[] = []

function answerLabel(teil: PracticeTeilData, item: PracticeItem, key: string | undefined, none: string): string | undefined {
  if (!key) return undefined
  if (key === NONE_OF_THEM) return none
  return optionsFor(teil, item).find((o) => o.key === key)?.label
}

function itemTitle(t: ReturnType<typeof useTranslations>, kind: Props['kind'], r: PracticeItemResult): string {
  if (kind === 'gap-mc' || kind === 'gap-bank') return t('gapTitle', { n: r.label })
  return t('itemTitle', { n: r.label })
}

/** Hàng ô số câu ở thanh dưới: đã làm (navy), đang chọn (viền vàng), đánh dấu (chấm vàng), đúng/sai sau khi kiểm tra. */
function QuestionDots({
  items,
  answers,
  byId,
  current,
  flags,
  marked,
  onPick,
}: {
  items: PracticeItem[]
  answers: Record<string, string>
  byId: Map<string, PracticeItemResult>
  current: string | null
  flags: ReadonlySet<string>
  /** Câu có đoạn gắn trong bài (đánh dấu bài đọc): vạch nhỏ dưới số. */
  marked?: Set<string>
  onPick: (id: string) => void
}) {
  const tf = useTranslations('v2.student.practice.frame')
  const checked = byId.size > 0
  const done = items.filter((it) => answers[it.id]).length
  return (
    <div role="group" data-tour="dots" aria-label={tf('dotsLabel')} className="ga-autoscroll -mx-1 flex min-w-0 flex-1 basis-full items-center gap-1.5 overflow-x-auto px-1 py-1 sm:basis-auto sm:flex-wrap sm:overflow-visible">
      {items.map((it, i) => {
        const res = byId.get(it.id)
        const label = itemLabel(it)
        const state = res ? (res.isCorrect ? tf('dotRight') : tf('dotWrong')) : answers[it.id] ? tf('dotDone') : tf('dotOpen')
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onPick(it.id)}
            aria-label={`${tf('dotItem', { n: label })}, ${state}${flags.has(it.id) ? `, ${tf('dotFlagged')}` : ''}`}
            aria-current={current === it.id}
            style={res ? { transitionDelay: `${i * 60}ms` } : undefined}
            className={cn(
              'ga-ui relative h-9 min-w-9 shrink-0 rounded-ga-touch border-[1.5px] px-1 text-ga-small font-semibold tabular-nums transition-colors duration-[240ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus motion-reduce:transition-none',
              !res && answers[it.id] && 'border-ga-navy bg-ga-navy text-ga-card',
              !res && !answers[it.id] && 'border-ga-line-strong bg-ga-card text-ga-ink',
              res?.isCorrect && 'border-ga-green bg-ga-green-soft text-ga-green',
              res && !res.isCorrect && 'border-ga-red bg-ga-red-soft text-ga-red',
              current === it.id && 'shadow-[0_0_0_2px_var(--ga-card),0_0_0_4px_var(--ga-yellow)]',
            )}
          >
            {label}
            {flags.has(it.id) && !res && (
              <span aria-hidden className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-ga-card bg-ga-yellow" />
            )}
            {marked?.has(it.id) && (
              <span aria-hidden className={cn('absolute bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-ga-pill', !res && answers[it.id] ? 'bg-ga-card' : 'bg-ga-navy')} />
            )}
          </button>
        )
      })}
      {!checked && <span className="ga-ui ml-1 shrink-0 text-ga-caption tabular-nums text-ga-muted">{tf('dotsCount', { done, total: items.length })}</span>}
    </div>
  )
}

function TaskLine({ teil }: { teil: PracticeTeilData }) {
  if (!teil.instruction_de && !teil.instruction_vi) return null
  return (
    <div className="ga-ui mb-4">
      {teil.instruction_de && <p lang="de" className="text-ga-body text-ga-ink">{teil.instruction_de}</p>}
      {teil.instruction_vi && <p className="mt-1 text-ga-small text-ga-muted">{teil.instruction_vi}</p>}
    </div>
  )
}

function ScoreLine({ result }: { result: PracticeTeilResult }) {
  const t = useTranslations('v2.student.practice')
  const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 })
  return (
    <div className="ga-ui mb-4 flex flex-wrap items-center gap-4 border border-ga-line bg-ga-card px-4 py-3">
      <span className="font-ga-display text-ga-stat-m tabular-nums text-ga-ink">
        {fmt(result.score)} <span className="text-ga-body text-ga-muted">/ {fmt(result.max)}</span>
      </span>
      <p className="text-ga-small text-ga-muted">
        <b className="text-ga-ink">{t('scoreCorrect', { done: result.correctCount, total: result.total })}</b>{' '}
        {result.correctCount < result.total ? t('scoreHintWrong') : t('scoreHintAll')}
      </p>
    </div>
  )
}

function Examples({ examples }: { examples: NonNullable<PracticeTeilData['examples']> }) {
  const t = useTranslations('v2.student.practice')
  return (
    <section className="ga-ui mb-4 rounded-ga border border-dashed border-ga-line bg-ga-card px-4 py-3">
      <p className="mb-1.5 text-ga-eyebrow uppercase text-ga-muted">{t('examples')}</p>
      <ol className="space-y-1.5">
        {examples.map((ex, i) => (
          <li key={i} className="flex items-baseline gap-3 text-ga-body">
            <span className="shrink-0 text-ga-small text-ga-muted">{ex.label ?? `0${i + 1}`}</span>
            <span lang="de" className="min-w-0 flex-1">{ex.situation}</span>
            <LetterBadge value={ex.answer} tone="muted" />
          </li>
        ))}
      </ol>
    </section>
  )
}

function highlight(text: string, evidence: string[]): React.ReactNode {
  if (evidence.length === 0) return text
  const parts: React.ReactNode[] = []
  let rest = text
  let key = 0
  for (;;) {
    let best: { at: number; ev: string } | null = null
    for (const ev of evidence) {
      const at = rest.indexOf(ev)
      if (at >= 0 && (best == null || at < best.at)) best = { at, ev }
    }
    if (!best) break
    if (best.at > 0) parts.push(rest.slice(0, best.at))
    parts.push(
      <mark key={key++} className="ga-evidence-glow rounded-ga bg-ga-yellow-soft text-ga-ink shadow-[inset_0_-2px_0_var(--ga-yellow)]">
        {best.ev}
      </mark>,
    )
    rest = rest.slice(best.at + best.ev.length)
  }
  parts.push(rest)
  return parts
}

function ItemCard({
  item,
  kind,
  teil,
  answer,
  active,
  current,
  flagged,
  onFlag,
  note,
  res,
  selected,
  wide,
  extra,
  onOpen,
  onMc,
  onShowEvidence,
  stem,
  struck,
  onStrike,
  marksChip,
  analysisExtra,
}: {
  item: PracticeItem
  kind: Props['kind']
  teil: PracticeTeilData
  answer?: string
  active: boolean
  current: boolean
  flagged: boolean
  onFlag?: () => void
  /** Ô "Vì sao tôi chọn" (B3) dưới các lựa chọn, khi đang luyện. */
  note?: React.ReactNode
  res?: PracticeItemResult
  selected: boolean
  /** `true` = phân tích nằm ở cột khác (không mở ngay trong thẻ). */
  wide: boolean
  extra?: React.ReactNode
  onOpen: () => void
  onMc: (value: string) => void
  onShowEvidence?: () => void
  /** Đề câu vẽ qua lớp đánh dấu (09/11/2026); không có ⇒ chữ trơn như cũ. */
  stem?: React.ReactNode
  /** Phương án đã gạch bỏ. */
  struck?: (opt: string) => boolean
  /** Có ⇒ hiện nút gạch bỏ cạnh mỗi phương án (trước khi kiểm tra). */
  onStrike?: (opt: string) => void
  /** "Đã đánh dấu N chỗ · Xem trong bài". */
  marksChip?: React.ReactNode
  /** Khối thêm vào phân tích (chẩn đoán tìm bằng chứng). */
  analysisExtra?: React.ReactNode
}) {
  const t = useTranslations('v2.student.practice')
  const tf = useTranslations('v2.student.practice.frame')
  const tm = useTranslations('v2.student.practice.marks')
  const label = itemLabel(item)
  const checked = res != null
  const pool = optionsFor(teil, item)
  const answerText = answer === NONE_OF_THEM ? t('noneOfThem') : pool.find((o) => o.key === answer)?.label
  const body = kind === 'match' ? item.text ?? item.question : item.question

  return (
    <article
      id={`pq-${item.id}`}
      className={cn(
        'mb-3.5 scroll-mt-14 border bg-ga-card transition-[border-color,box-shadow] duration-150 max-[759px]:scroll-mt-44',
        active ? 'border-ga-navy shadow-ga-selected-bar' : 'border-ga-line',
        current && 'shadow-[inset_3px_0_0_var(--ga-yellow)]',
        checked && (res.isCorrect ? 'shadow-[inset_4px_0_0_var(--ga-green)]' : 'shadow-[inset_4px_0_0_var(--ga-red)]'),
      )}
    >
      <div className="flex items-center gap-2.5 px-4 pt-3">
        <span className="font-ga-display text-ga-h2 text-ga-ink">{label}</span>
        {active && <span className="ga-ui text-ga-caption font-semibold text-ga-navy">{t('picking')}</span>}
        {checked && <StatusPill res={res} />}
        {onFlag && (
          <button
            type="button"
            onClick={onFlag}
            aria-pressed={flagged}
            aria-label={tf('flag', { n: label })}
            title={tf('flag', { n: label })}
            className={cn(
              'ml-auto inline-flex h-9 w-9 items-center justify-center rounded-ga-touch transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
              flagged ? 'text-ga-ink' : 'text-ga-subtle hover:bg-ga-side-active hover:text-ga-ink',
            )}
          >
            <Flag size={17} aria-hidden fill={flagged ? 'var(--ga-yellow)' : 'none'} />
          </button>
        )}
      </div>
      {extra && <div className="px-4 pt-2">{extra}</div>}
      {body && (
        <p lang="de" className="ga-ui px-4 pb-3 pt-1.5 text-ga-body-lg leading-relaxed text-ga-ink">
          {stem ?? (checked && selected ? highlight(body, res.evidence) : body)}
        </p>
      )}
      {marksChip && <div className="-mt-1 px-4 pb-3">{marksChip}</div>}

      {kind === 'mc' ? (
        <div className="space-y-2 border-t border-ga-line bg-ga-bg px-4 py-3" role="radiogroup" aria-label={t('itemTitle', { n: label })}>
          {pool.map((o) => {
            const mine = answer === o.key
            const isRight = checked && o.key === res.correct
            const isWrongPick = checked && mine && !res.isCorrect
            const out = struck?.(o.key) ?? false
            const option = (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={mine}
                disabled={checked}
                onClick={() => onMc(o.key)}
                className={cn(
                  'ga-ui flex min-h-12 w-full select-none items-center gap-3 rounded-ga-touch px-3 py-2 text-left text-ga-body-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
                  !checked && 'active:scale-[0.995]',
                  !checked && mine && 'border-[1.5px] border-ga-navy bg-ga-navy text-ga-card',
                  !checked && !mine && !out && 'border-[1.5px] border-ga-line-strong bg-ga-card hover:bg-ga-navy-soft',
                  !checked && !mine && out && 'border-[1.5px] border-ga-line bg-ga-card text-ga-subtle hover:bg-ga-navy-soft',
                  checked && isRight && 'border-[1.5px] border-ga-green bg-ga-green-soft',
                  checked && isWrongPick && 'border-[1.5px] border-ga-red bg-ga-red-soft',
                  checked && !isRight && !isWrongPick && 'border border-ga-line bg-ga-card text-ga-muted',
                )}
              >
                <LetterBadge value={o.key} tone={isRight ? 'ok' : isWrongPick ? 'bad' : !checked && mine ? 'inverse' : out ? 'muted' : 'outline'} />
                <span lang="de" className={cn('min-w-0 flex-1', out && 'line-through decoration-2')}>{o.label}</span>
                {isRight && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-ga-caption font-semibold text-ga-green">
                    <Check size={14} aria-hidden /> {t('correct')}
                  </span>
                )}
                {isWrongPick && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-ga-caption font-semibold text-ga-red">
                    <X size={14} aria-hidden /> {tf('yourPick')}
                  </span>
                )}
              </button>
            )
            if (!onStrike) return option
            return (
              <div key={o.key} className="flex items-stretch gap-2">
                <div className="min-w-0 flex-1">{option}</div>
                <button
                  type="button"
                  onClick={() => onStrike(o.key)}
                  aria-pressed={out}
                  aria-label={out ? tm('unstrike', { k: o.key }) : tm('strike', { k: o.key })}
                  title={out ? tm('unstrike', { k: o.key }) : tm('strike', { k: o.key })}
                  className={cn(
                    'inline-flex w-11 shrink-0 items-center justify-center rounded-ga-touch border text-ga-muted transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
                    out ? 'border-ga-ink bg-ga-ink text-ga-card' : 'border-dashed border-ga-line-strong hover:border-solid hover:text-ga-ink',
                  )}
                >
                  <CircleSlash size={18} aria-hidden />
                </button>
              </div>
            )
          })}
        </div>
      ) : !checked ? (
        <button
          type="button"
          onClick={onOpen}
          className="ga-ui flex min-h-14 w-full items-center gap-3 border-t border-ga-line bg-ga-bg px-4 py-2.5 text-left text-ga-body hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus"
        >
          <LetterBadge value={answer ?? '?'} tone={answer ? 'filled' : 'empty'} />
          {answer ? (
            <span lang="de" className="min-w-0 flex-1 break-words">{answerText}</span>
          ) : (
            <span className="min-w-0 flex-1 text-ga-muted">{t('tapToPick')}</span>
          )}
          <ChevronRight size={16} className="shrink-0 text-ga-subtle" aria-hidden />
        </button>
      ) : null}

      {note && <div className="border-t border-ga-line bg-ga-bg px-4 pb-2.5 pt-1">{note}</div>}
      {checked && (
        <div className="ga-ui flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ga-line px-4 py-2.5 text-ga-body">
          {kind !== 'mc' && (
            <span className="flex min-w-0 items-center gap-2">
              <LetterBadge value={res.given ?? '–'} tone={!res.answered ? 'empty' : res.isCorrect ? 'ok' : 'bad'} />
              <span lang="de" className="min-w-0 break-words">{res.givenText ?? t('notAnswered')}</span>
            </span>
          )}
          {kind !== 'mc' && !res.isCorrect && (
            <span className="flex min-w-0 items-center gap-2">
              <ChevronRight size={14} className="text-ga-subtle" aria-hidden />
              <LetterBadge value={res.correct} tone="ok" />
              <span lang="de" className="min-w-0 break-words">{res.correctText}</span>
            </span>
          )}
          <button
            type="button"
            onClick={onOpen}
            aria-expanded={selected}
            className="ga-ui ml-auto inline-flex min-h-10 items-center gap-1 rounded-ga-touch border-[1.5px] border-ga-line-strong px-3 text-ga-small font-semibold hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
          >
            {!wide && selected ? t('hideAnalysis') : t('showAnalysis')}
            {!wide && <ChevronDown size={14} className={cn('transition-transform', selected && 'rotate-180')} aria-hidden />}
          </button>
        </div>
      )}
      {checked && !wide && selected && (
        <div className="border-t border-ga-line px-4 py-4">
          <ItemAnalysis item={res} title={t('itemTitle', { n: label })} onShowEvidence={res.evidence.length > 0 ? onShowEvidence : undefined} extra={analysisExtra} />
        </div>
      )}
    </article>
  )
}

function StatusPill({ res }: { res: PracticeItemResult }) {
  const t = useTranslations('v2.student.practice')
  if (res.isCorrect)
    return (
      <span className="ga-ui inline-flex items-center gap-1 rounded-ga-pill bg-ga-green-soft px-2 py-0.5 text-ga-caption font-semibold text-ga-ink">
        <Check size={13} aria-hidden /> {t('correct')}
      </span>
    )
  return (
    <span className="ga-ui inline-flex items-center gap-1 rounded-ga-pill bg-ga-red-soft px-2 py-0.5 text-ga-caption font-semibold text-ga-ink">
      <X size={13} aria-hidden /> {res.answered ? t('wrong') : t('notAnswered')}
    </span>
  )
}

/** Lesen 3: các mẩu rao vặt ở cột nguồn — bấm một mẩu để gán cho tình huống đang chọn. */
function AdPool({
  teil,
  items,
  answers,
  active,
  checked,
  onPick,
  layer,
  texts,
}: {
  teil: PracticeTeilData
  items: PracticeItem[]
  answers: Record<string, string>
  active: PracticeItem | null
  checked: boolean
  onPick: (key: string) => void
  /** Có lớp đánh dấu (đợt 3) ⇒ mẩu rao vặt là ô chọn có chữ bôi đen được (nút `<button>` không cho bôi đen). */
  layer?: MarkLayer | null
  texts?: Record<string, string>
}) {
  const t = useTranslations('v2.student.practice')
  const pool = items[0] ? optionsFor(teil, items[0]) : []
  const last = React.useMemo(() => (layer ? lastPieces(layer.pack, layer.blockOrder) : undefined), [layer])
  return (
    <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label={active ? t('pickFor', { n: itemLabel(active) }) : undefined}>
      {pool.map((o) => {
        const holder = ownerOf(answers, o.key, items)
        const mine = !!active && holder === active.id
        const used = !!holder && !mine
        const adText = layer ? texts?.[`ad:${o.key}`] : undefined
        if (layer && adText != null) {
          return (
            <AdCard
              key={o.key}
              letter={o.key}
              mine={mine}
              used={used}
              usedLabel={used ? t('usedAt', { n: itemLabel(items.find((it) => it.id === holder)!) }) : undefined}
              disabled={checked || !active}
              onPick={() => onPick(o.key)}
            >
              <MarkedText block={`ad:${o.key}`} text={adText} layer={layer} lastByGroup={last} />
            </AdCard>
          )
        }
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={mine}
            disabled={checked || !active}
            onClick={() => onPick(o.key)}
            className={cn(
              'ga-ui flex min-h-[7rem] flex-col items-start gap-2 rounded-ga border-[1.5px] bg-ga-card p-3 text-left text-ga-body transition-[border-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus disabled:cursor-default',
              mine && 'border-ga-navy bg-ga-navy-soft',
              used && 'border-dashed border-ga-line opacity-60',
              !mine && !used && 'border-ga-line enabled:hover:-translate-y-px enabled:hover:border-ga-line-strong',
            )}
          >
            <span className="flex w-full items-center gap-2">
              <LetterBadge value={o.key} tone={mine ? 'filled' : used ? 'muted' : 'outline'} />
              {used && <span className="ml-auto text-ga-caption text-ga-muted">{t('usedAt', { n: itemLabel(items.find((it) => it.id === holder)!) })}</span>}
            </span>
            <span lang="de" className="whitespace-pre-wrap break-words">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Mẩu rao vặt khi có bút đánh dấu: ô chọn (`role="radio"`) thay cho `<button>` để bôi đen được chữ bên trong.
 * Thả chuột sau khi bôi đen, hoặc bấm vào đoạn đã tô (mở thanh sửa), thì KHÔNG tính là chọn mẩu này.
 */
function AdCard({
  letter,
  mine,
  used,
  usedLabel,
  disabled,
  onPick,
  children,
}: {
  letter: string
  mine: boolean
  used: boolean
  usedLabel?: string
  disabled: boolean
  onPick: () => void
  children: React.ReactNode
}) {
  return (
    <div
      role="radio"
      aria-checked={mine}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={(e) => {
        if (disabled) return
        const sel = window.getSelection()
        if (sel && !sel.isCollapsed && sel.toString().trim() !== '') return
        if ((e.target as Element).closest?.('[data-gid], .ga-mark-tag')) return
        onPick()
      }}
      onKeyDown={(e) => {
        if (disabled || (e.key !== 'Enter' && e.key !== ' ')) return
        e.preventDefault()
        onPick()
      }}
      className={cn(
        'ga-ui flex min-h-[7rem] flex-col items-start gap-2 rounded-ga border-[1.5px] bg-ga-card p-3 text-left text-ga-body transition-[border-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
        !disabled && 'cursor-pointer',
        mine && 'border-ga-navy bg-ga-navy-soft',
        used && 'border-dashed border-ga-line opacity-60',
        !mine && !used && 'border-ga-line',
        !mine && !used && !disabled && 'hover:border-ga-line-strong',
      )}
    >
      <span className="flex w-full items-center gap-2">
        <LetterBadge value={letter} tone={mine ? 'filled' : used ? 'muted' : 'outline'} />
        {usedLabel && <span className="ml-auto text-ga-caption text-ga-muted">{usedLabel}</span>}
      </span>
      <span lang="de" className="whitespace-pre-wrap break-words">{children}</span>
    </div>
  )
}

/** Lesen 3: một tình huống ở cột trả lời — bấm để chọn, ô bên dưới cho biết đã gán mẩu nào. */
function SituationRow({
  item,
  answer,
  answerText,
  active,
  onOpen,
}: {
  item: PracticeItem
  answer?: string
  answerText?: string
  active: boolean
  onOpen: () => void
}) {
  const t = useTranslations('v2.student.practice')
  return (
    <button
      id={`pq-${item.id}`}
      type="button"
      onClick={onOpen}
      aria-pressed={active}
      className={cn(
        'ga-ui flex w-full scroll-mt-14 flex-col gap-2 rounded-ga border bg-ga-card px-3.5 py-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
        active ? 'border-ga-navy bg-ga-yellow-soft shadow-[inset_3px_0_0_var(--ga-yellow)]' : 'border-ga-line hover:bg-ga-bg',
      )}
    >
      <span className="flex items-start gap-2.5">
        <span className="font-ga-display text-ga-h3 leading-none text-ga-ink">{itemLabel(item)}</span>
        <span lang="de" className="min-w-0 flex-1 text-ga-body text-ga-ink">{item.text ?? item.question}</span>
      </span>
      <span className="flex items-center gap-2 text-ga-small">
        <LetterBadge value={answer ?? '?'} tone={answer ? 'filled' : 'empty'} />
        <span lang="de" className={cn('min-w-0 flex-1 truncate', answer ? 'text-ga-ink' : 'text-ga-muted')}>
          {answerText ?? t('tapToPick')}
        </span>
      </span>
    </button>
  )
}

/** Sprachbausteine: tổng quan các chỗ trống dưới kho lựa chọn — bấm để nhảy tới chỗ đó. */
function GapOverview({
  teil,
  items,
  answers,
  active,
  onOpen,
}: {
  teil: PracticeTeilData
  items: PracticeItem[]
  answers: Record<string, string>
  active: string | null
  onOpen: (id: string) => void
}) {
  const tf = useTranslations('v2.student.practice.frame')
  return (
    <div className="mt-5">
      <p className="ga-ui mb-2 text-ga-eyebrow uppercase text-ga-muted">{tf('gapsOverview')}</p>
      <div className="grid grid-cols-5 gap-1.5">
        {items.map((it) => {
          const a = answers[it.id]
          const word = a ? optionsFor(teil, it).find((o) => o.key === a)?.label ?? a : '–'
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onOpen(it.id)}
              aria-current={active === it.id}
              className={cn(
                'ga-ui flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-ga border px-1 text-ga-caption focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
                active === it.id ? 'border-ga-yellow bg-ga-yellow-soft' : 'border-ga-line bg-ga-card hover:bg-ga-bg',
              )}
            >
              <span className="tabular-nums text-ga-muted">{itemLabel(it)}</span>
              <b lang="de" className="max-w-full truncate text-ga-ink">{word}</b>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function GappedText({
  teil,
  items,
  answers,
  active,
  selected,
  byId,
  onOpen,
  layer,
  text,
}: {
  teil: PracticeTeilData
  items: PracticeItem[]
  answers: Record<string, string>
  active: string | null
  selected: string | null
  byId: Map<string, PracticeItemResult>
  onOpen: (id: string) => void
  /** Có lớp đánh dấu (đợt 3) ⇒ các đoạn chữ giữa chỗ trống vẽ qua `MarkedText` (khối `gap`). */
  layer?: MarkLayer | null
  /** Chữ thư đã chuẩn hoá (`marksTexts().gap`). */
  text?: string
}) {
  const t = useTranslations('v2.student.practice')
  const byGap = new Map(items.map((it) => [Number(itemLabel(it)), it]))
  const last = React.useMemo(() => (layer ? lastPieces(layer.pack, layer.blockOrder) : undefined), [layer])
  const segments: Array<{ kind: 'text'; node: React.ReactNode } | { kind: 'gap'; gap: number }> =
    layer && text != null
      ? gapPieces(text).map((g) =>
          g.kind === 'gap'
            ? { kind: 'gap' as const, gap: g.gap }
            : { kind: 'text' as const, node: <MarkedText block="gap" text={text} from={g.s} to={g.e} layer={layer} lastByGroup={last} /> },
        )
      : parseGappedText(teil.gapped_text ?? '').map((g) => (g.kind === 'gap' ? g : { kind: 'text' as const, node: g.value }))
  const wordOf = (it: PracticeItem, key?: string) => (key ? optionsFor(teil, it).find((o) => o.key === key)?.label ?? key : '')

  return (
    <>
      {teil.stimulus_ad && (
        <aside className="ga-ui mb-4 whitespace-pre-wrap border-2 border-ga-line bg-ga-card px-4 py-3 text-ga-body text-ga-ink" lang="de">
          {teil.stimulus_ad}
        </aside>
      )}
      <div lang="de" className="ga-ui mb-4 whitespace-pre-wrap break-words border border-ga-line bg-ga-card px-4 py-4 text-ga-body-lg leading-[2.3] text-ga-ink lg:px-5">
        {segments.map((seg, i) => {
          if (seg.kind === 'text') return <span key={i}>{seg.node}</span>
          const it = byGap.get(seg.gap)
          if (!it) return <span key={i}>___{seg.gap}___</span>
          const res = byId.get(it.id)
          const a = answers[it.id]
          const isActive = !res && active === it.id
          return (
            <button
              key={i}
              id={`pg-${it.id}`}
              type="button"
              onClick={() => onOpen(it.id)}
              aria-label={t('gapTitle', { n: seg.gap })}
              aria-current={isActive || (res != null && selected === it.id)}
              className={cn(
                'mx-0.5 inline-flex min-h-9 min-w-[5.5rem] scroll-mt-14 items-center gap-1.5 rounded-ga-touch px-2.5 align-middle text-ga-body leading-tight transition-[background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
                !res && !a && !isActive && 'border-[1.5px] border-ga-line-strong bg-ga-card',
                !res && isActive && 'border-[1.5px] border-ga-navy bg-ga-navy-soft shadow-[0_0_0_3px_var(--ga-yellow)]',
                !res && a && !isActive && 'border-[1.5px] border-ga-navy bg-ga-navy font-semibold text-ga-card',
                res?.isCorrect && 'border-[1.5px] border-ga-green bg-ga-green-soft font-semibold',
                res && !res.isCorrect && 'border-[1.5px] border-ga-red bg-ga-red-soft font-semibold',
                res && selected === it.id && 'shadow-[0_0_0_3px_var(--ga-yellow)]',
              )}
            >
              <span className={cn('text-ga-caption font-semibold', !res && a && !isActive ? 'text-ga-card' : 'text-ga-muted')}>{seg.gap}</span>
              <span className={cn(res && !res.isCorrect && res.answered && 'line-through')}>{wordOf(it, a)}</span>
              {res && !res.isCorrect && <span>→ {res.correctText}</span>}
            </button>
          )
        })}
      </div>
    </>
  )
}

function UnusedOptions({ result }: { result: PracticeTeilResult }) {
  const t = useTranslations('v2.student.practice')
  return (
    <details className="ga-ui mt-4 rounded-ga-touch border border-ga-line bg-ga-card">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-ga-small font-semibold">
        {t('unusedTitle', { count: result.unusedOptions.length })}
        <ChevronDown size={14} aria-hidden />
      </summary>
      <div className="space-y-2 px-3 pb-3 text-ga-small">
        {result.unusedOptions.map((o) => (
          <p key={o.key}>
            <b>
              {o.key} · <span lang="de">{o.text}</span>
            </b>
            {o.note && (
              <>
                <br />
                {o.note}
              </>
            )}
          </p>
        ))}
      </div>
    </details>
  )
}
