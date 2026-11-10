/**
 * Khối chữ đánh dấu được của một Teil (đánh dấu bài đọc; đợt 3 — 10/11/2026 mở thêm Lesen 1, Lesen 3,
 * Sprachbausteine). Phép thuần, cùng luật với `PassageMarksValidator.blocksOf` ở server:
 *
 * | khối      | chữ                         | Teil                 |
 * |-----------|-----------------------------|----------------------|
 * | `ctx`     | `teil.context`              | Lesen 2 (bài đọc)    |
 * | `q:<id>`  | `item.question`             | đề câu (Lesen 2)     |
 * | `t:<id>`  | `item.text`                 | đoạn văn Lesen 1     |
 * | `ad:<k>`  | `teil.ads[k]`               | mẩu rao vặt Lesen 3  |
 * | `gap`     | `teil.gapped_text`          | thư Sprachbausteine  |
 * | `h:<p>:<i>` | dòng i lời bài nghe (`p` = `teil` hoặc id câu) | Hören, chỉ sau kiểm tra (đợt 3b) |
 *
 * Xuống dòng chuẩn hoá `\r\n`/`\r` → `\n` (vị trí ký tự tính trên chữ đã chuẩn hoá).
 */
import { findQuote } from '@/lib/exam/evidenceRanges'
import type { PracticeKind, PracticeTeilData } from '@/components/exam/practice/practiceModel'
import type { Piece } from './marksModel'

/** Phần thi có bút đánh dấu (Schreiben không có; Hören chỉ lời bài sau kiểm tra). */
export const MARK_SECTIONS: readonly string[] = ['LESEN', 'SPRACHBAUSTEINE', 'HOEREN']

export function blockText(text: string): string {
  return text.replace(/\r\n?/g, '\n')
}

function adEntries(teil: PracticeTeilData): Array<[string, string]> {
  return Object.entries(teil.ads ?? {}).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1].trim() !== '')
}

/** `String.prototype.trim` rồi chuẩn hoá xuống dòng — đúng thứ tự `HoerenPlayer` (normalizeTurns) + server. */
function lineText(text: string): string {
  return blockText(text.trim())
}

/** Dòng lời bài của một kịch bản, y như `normalizeTurns` của trình phát: bỏ lượt rỗng, cắt khoảng trắng. */
function scriptLines(script: unknown, leadIn?: unknown): string[] {
  const out: string[] = []
  if (typeof leadIn === 'string' && leadIn.trim()) out.push(lineText(leadIn))
  if (Array.isArray(script)) {
    for (const turn of script) {
      const text = turn && typeof turn === 'object' && typeof (turn as { text?: unknown }).text === 'string' ? (turn as { text: string }).text : ''
      if (text.trim()) out.push(lineText(text))
    }
  } else if (typeof script === 'string' && script.trim()) {
    out.push(lineText(script))
  }
  return out
}

/**
 * Lời bài nghe theo dòng (đợt 3b): bài cấp Teil (`h:teil:<i>`, Teil 2 — không có câu dẫn) và bài từng câu
 * (`h:<id>:<i>`, câu dẫn `lead_in_de` là dòng đầu). Khớp chữ `HoerenPlayer` hiện ở "Lời thoại".
 */
export function hoerenLines(teil: PracticeTeilData): Array<[string, string]> {
  const out: Array<[string, string]> = []
  scriptLines(teil.audio_script).forEach((text, i) => out.push([`h:teil:${i}`, text]))
  for (const it of teil.items ?? []) {
    scriptLines(it.audio_script, it.lead_in_de).forEach((text, i) => out.push([`h:${it.id}:${i}`, text]))
  }
  return out
}

/** Chữ của mọi khối có trong Teil — mô hình dùng để kiểm/ghi hash. */
export function marksTexts(teil: PracticeTeilData): Record<string, string> {
  const out: Record<string, string> = {}
  if (teil.context) out.ctx = blockText(teil.context)
  if (teil.gapped_text && teil.gapped_text.trim()) out.gap = blockText(teil.gapped_text)
  for (const [k, v] of adEntries(teil)) out[`ad:${k}`] = blockText(v)
  for (const it of teil.items ?? []) {
    if (it.question && it.question.trim()) out[`q:${it.id}`] = blockText(it.question)
    if (it.text && it.text.trim()) out[`t:${it.id}`] = blockText(it.text)
  }
  for (const [b, text] of hoerenLines(teil)) out[b] = text
  return out
}

/** Teil có bút đánh dấu: Lesen 2 (bài đọc), Lesen 1 (đoạn văn), Lesen 3 (rao vặt), Sprachbausteine (thư). */
export function marksSupported(teil: PracticeTeilData | null | undefined, kind: PracticeKind): boolean {
  if (!teil) return false
  if (kind === 'mc') return !!teil.context || hoerenLines(teil).length > 0
  if (kind === 'gap-mc' || kind === 'gap-bank') return !!teil.gapped_text && teil.gapped_text.trim() !== ''
  if (kind === 'match') {
    if (teil.type === 'MATCH_AD_X') return adEntries(teil).length > 0
    return (teil.items ?? []).some((it) => !!it.text && it.text.trim() !== '')
  }
  return false
}

/** Khối có thể chứa bằng chứng của một câu, theo thứ tự tìm. */
export function evidenceBlocks(teil: PracticeTeilData, kind: PracticeKind, itemId: string): string[] {
  if (kind === 'mc' && teil.context) return ['ctx']
  if (kind === 'mc') {
    // Hören: lời bài của câu trước, rồi bài cấp Teil
    const lines = hoerenLines(teil).map(([b]) => b)
    return [...lines.filter((b) => b.startsWith(`h:${itemId}:`)), ...lines.filter((b) => b.startsWith('h:teil:'))]
  }
  if (kind === 'gap-mc' || kind === 'gap-bank') return ['gap']
  if (kind === 'match' && teil.type === 'MATCH_AD_X') return [...adEntries(teil).map(([k]) => `ad:${k}`), `q:${itemId}`]
  if (kind === 'match') return [`t:${itemId}`]
  return []
}

/** Câu trích bằng chứng → mảnh `[s, e)` trên khối đầu tiên chứa nó (bỏ câu không tìm thấy). */
export function evidencePieces(texts: Record<string, string>, blocks: readonly string[], quotes: readonly string[]): Piece[] {
  const out: Piece[] = []
  for (const quote of quotes) {
    for (const b of blocks) {
      const text = texts[b]
      const r = text ? findQuote(text, quote) : null
      if (r) {
        out.push({ b, s: r[0], e: r[1] })
        break
      }
    }
  }
  return out
}

/** Thứ tự khối trên màn (để biết mảnh nào là "cuối" của một nhóm vắt nhiều khối). */
export function blockOrderOf(teil: PracticeTeilData): (b: string) => number {
  const ads = adEntries(teil).map(([k]) => k)
  const ids = (teil.items ?? []).map((it) => it.id)
  return (b: string) => {
    if (b === 'ctx' || b === 'gap') return 0
    if (b.startsWith('ad:')) return 1 + ads.indexOf(b.slice(3))
    if (b.startsWith('h:')) {
      const [, scope, line] = b.split(':')
      return scope === 'teil' ? 100 + Number(line) : 1000 + 2 * ids.indexOf(scope) + Number(line) / 1000
    }
    const i = ids.indexOf(b.slice(2))
    return 1000 + 2 * i + (b.startsWith('q:') ? 1 : 0)
  }
}

export type GapPiece = { kind: 'text'; s: number; e: number } | { kind: 'gap'; gap: number; s: number; e: number }

/** Như `parseGappedText` nhưng giữ vị trí trên chữ đã chuẩn hoá — để vẽ từng đoạn chữ qua lớp đánh dấu. */
export function gapPieces(text: string): GapPiece[] {
  const out: GapPiece[] = []
  const pattern = /_{3,}\s*(\d+)\s*_{3,}/g
  let cursor = 0
  let m: RegExpExecArray | null
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > cursor) out.push({ kind: 'text', s: cursor, e: m.index })
    out.push({ kind: 'gap', gap: Number(m[1]), s: m.index, e: m.index + m[0].length })
    cursor = m.index + m[0].length
  }
  if (cursor < text.length) out.push({ kind: 'text', s: cursor, e: text.length })
  return out
}
