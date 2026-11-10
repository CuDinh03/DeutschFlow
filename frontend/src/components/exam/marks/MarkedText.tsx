'use client'

import * as React from 'react'
import { MessageSquareText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { lastPieces, type Mark, type MarksPack, type Piece } from './marksModel'

/** Lớp đánh dấu dùng chung cho mọi khối chữ của một Teil. */
export interface MarkLayer {
  pack: MarksPack
  blockOrder: (b: string) => number
  /** Id câu → số hiển thị trên nhãn. */
  labelOf: (itemId: string) => string
  /** Bấm nhãn số câu trong bài ⇒ mở câu đó. */
  onGoItem?: (itemId: string) => void
  /** Bấm dấu ghi chú ⇒ mở ghi chú của nhóm. */
  onOpenNote?: (gid: string) => void
  tagLabel: (n: string) => string
  noteLabel: (note: string) => string
}

/**
 * Lớp đánh dấu của Teil cho khối chữ vẽ ở thành phần con không nhận prop trực tiếp (lời bài trong
 * `HoerenPlayer`, đợt 3b). `ObjectiveTeilView` cấp khi bút đánh dấu bật.
 */
export const MarkLayerContext = React.createContext<MarkLayer | null>(null)

export interface EvidenceRange extends Piece {
  /** Nhãn cuối đoạn, ví dụ "Đ/A 7". */
  label?: string
}

const EMPTY_TAGS = new Map<string, Mark>()

/**
 * Vẽ đoạn `[from, to)` của một khối chữ thành các `span[data-seg]` (vị trí đầu ở `data-s`) để vùng
 * chọn của trình duyệt đổi ngược ra ký tự được (`selection.ts`). Không có lớp nào ⇒ chữ trơn trong
 * một span — vẫn chọn được.
 */
export function MarkedText({
  block,
  text,
  from = 0,
  to = text.length,
  layer,
  evidence,
  lastByGroup,
}: {
  block: string
  text: string
  from?: number
  to?: number
  layer?: MarkLayer | null
  evidence?: readonly EvidenceRange[]
  /** Mảnh cuối của mỗi nhóm — truyền vào khi vẽ nhiều dòng của cùng khối để khỏi tính lại. */
  lastByGroup?: Map<string, Mark>
}) {
  const marks = layer ? layer.pack.marks.filter((m) => m.b === block && m.e > from && m.s < to) : []
  const evs = (evidence ?? []).filter((v) => v.b === block && v.e > from && v.s < to)
  const last = layer ? lastByGroup ?? lastPieces(layer.pack, layer.blockOrder) : EMPTY_TAGS

  const cuts = new Set<number>([from, to])
  for (const m of marks) {
    cuts.add(Math.max(from, m.s))
    cuts.add(Math.min(to, m.e))
  }
  for (const v of evs) {
    cuts.add(Math.max(from, v.s))
    cuts.add(Math.min(to, v.e))
  }
  const pts = Array.from(cuts).sort((a, b) => a - b)

  const out: React.ReactNode[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if (a === b) continue
    const cov = marks.filter((m) => m.s <= a && m.e >= b)
    let hl: Mark | undefined
    let top: Mark | undefined
    for (const m of cov) {
      if (m.k === 'hl') hl = m // phần tử sau nằm trên
      top = m
    }
    const ev = evs.find((v) => v.s <= a && v.e >= b)
    const cls = cn(
      hl && `ga-mark-${hl.c}`,
      cov.some((m) => m.k === 'ul') && 'ga-mark-ul',
      cov.length > 0 && 'ga-mark-on',
      ev && 'ga-mark-ev ga-evidence-glow',
    )
    const props = {
      'data-seg': '',
      'data-b': block,
      'data-s': a,
      ...(top ? { 'data-gid': top.g, 'data-gids': Array.from(new Set(cov.map((m) => m.g))).join(' ') } : {}),
      className: cls || undefined,
    }
    const chunk = text.slice(a, b)
    out.push(
      ev ? (
        <mark key={a} data-evidence="" {...props} className={cn(cls, 'bg-transparent text-inherit')}>
          {chunk}
        </mark>
      ) : (
        <span key={a} {...props}>
          {chunk}
        </span>
      ),
    )

    // nhãn: nhóm có mảnh cuối kết thúc tại b, và nhãn vị trí đáp án
    const tags: React.ReactNode[] = []
    if (layer) {
      for (const m of marks) {
        if (m.e !== b || last.get(m.g) !== m) continue
        if (m.q) {
          tags.push(
            <button
              key={`q${m.g}`}
              type="button"
              tabIndex={-1}
              onClick={() => layer.onGoItem?.(m.q!)}
              aria-label={layer.tagLabel(layer.labelOf(m.q))}
              title={layer.tagLabel(layer.labelOf(m.q))}
              className="ga-mark-tag ga-ui inline-flex h-4 min-w-4 items-center justify-center rounded-ga-pill bg-ga-navy px-1 text-ga-eyebrow tabular-nums text-ga-card"
            >
              {layer.labelOf(m.q)}
            </button>,
          )
        }
        if (m.n) {
          tags.push(
            <button
              key={`n${m.g}`}
              type="button"
              tabIndex={-1}
              data-note={m.g}
              onClick={() => layer.onOpenNote?.(m.g)}
              aria-label={layer.noteLabel(m.n)}
              title={m.n}
              className="ga-mark-tag inline-flex h-4 w-4 items-center justify-center rounded-ga-pill bg-ga-orange text-ga-card"
            >
              <MessageSquareText size={10} aria-hidden />
            </button>,
          )
        }
      }
    }
    for (const v of evs) {
      if (v.e === b && v.label) {
        tags.push(
          <span key={`e${v.s}`} className="ga-ui inline-flex h-4 items-center rounded-ga-pill bg-ga-green px-1 text-ga-eyebrow text-ga-card">
            {v.label}
          </span>,
        )
      }
    }
    if (tags.length) {
      out.push(
        <span key={`t${b}`} className="ga-mark-anchor" contentEditable={false} suppressContentEditableWarning>
          <span>{tags}</span>
        </span>,
      )
    }
  }
  return <>{out}</>
}
