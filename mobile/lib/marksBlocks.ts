// Khối chữ đánh dấu được của một Teil (Đợt 4f, 20/11/2026) — bản app của
// `frontend/src/components/exam/marks/marksBlocks.ts`, cùng luật với `PassageMarksValidator.blocksOf` phía
// server. Hàm thuần, đọc thẳng Teil THÔ trong `sectionsJson` (không qua `parseExamSections`) để chữ của
// khối đúng từng ký tự với chữ server băm:
//
// | khối        | chữ                       | Teil                     |
// |-------------|---------------------------|--------------------------|
// | `ctx`       | `teil.context`            | Lesen 2 (bài đọc)        |
// | `q:<id>`    | `item.question`           | đề câu (Lesen 2, Lesen 3)|
// | `t:<id>`    | `item.text`               | đoạn văn Lesen 1         |
// | `ad:<k>`    | `teil.ads[k]`             | mẩu rao vặt Lesen 3      |
// | `gap`       | `teil.gapped_text`        | thư Sprachbausteine      |
// | `h:<p>:<i>` | dòng i lời bài nghe       | Hören, chỉ sau kiểm tra  |
//
// App KHÔNG dựng khối `h:` (màn nghe trên app cố ý không in lời thoại) nên Hören không có bút trên app;
// chữ các dòng đó vẫn có trong `marksTexts` để kiểm/ghi hash y như web.

import { normalizeBlock } from './passageMarks'

export type RawTeil = Record<string, unknown>
export type TeilKind = 'mc' | 'gap-mc' | 'gap-bank' | 'match' | 'writing' | 'form' | 'unknown'

/** Phần thi web có bút (Hören chỉ lời bài sau kiểm tra). */
export const MARK_SECTIONS: readonly string[] = ['LESEN', 'SPRACHBAUSTEINE', 'HOEREN']
/** Phần thi app có bút: như web, trừ Hören (app không in lời bài nghe — xem đầu tệp). */
export const APP_MARK_SECTIONS: readonly string[] = ['LESEN', 'SPRACHBAUSTEINE']

export const blockText = normalizeBlock

/** Teil thô theo khoá `LESEN-2`: khớp số `teil`, đề không đánh số thì theo vị trí. */
export function rawTeilOf(sectionsJson: string | null | undefined, teilKey: string): RawTeil | null {
  const m = /^([A-Z]+)-(\d+)$/.exec(teilKey)
  if (!sectionsJson || !m) return null
  try {
    const root = JSON.parse(sectionsJson) as { sections?: { name?: unknown; teile?: unknown }[] }
    const section = (root.sections ?? []).find((s) => s?.name === m[1])
    const teile = Array.isArray(section?.teile) ? (section.teile as RawTeil[]) : []
    const n = Number(m[2])
    const teil = teile.find((t) => t?.teil === n) ?? (teile.every((t) => t?.teil == null) ? teile[n - 1] : undefined)
    return teil && typeof teil === 'object' ? teil : null
  } catch {
    return null
  }
}

/** Dạng Teil y như `kindOf` của web (Hören telc: mọi câu dựng như trắc nghiệm từng câu). */
export function teilKindOf(teil: RawTeil | null, key: string): TeilKind {
  if (key.startsWith('SCHREIBEN')) return teil?.type === 'FILL_FORM' ? 'form' : 'writing'
  if (key.startsWith('HOEREN')) return teil ? 'mc' : 'unknown'
  switch (teil?.type) {
    case 'MATCH_HEADLINE':
    case 'MATCH_AD_X':
      return 'match'
    case 'MULTIPLE_CHOICE':
    case 'TRUE_FALSE':
      return 'mc'
    case 'GAP_MC':
      return 'gap-mc'
    case 'GAP_WORDBANK':
      return 'gap-bank'
    default:
      return 'unknown'
  }
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const filled = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

function items(teil: RawTeil): RawTeil[] {
  return Array.isArray(teil.items) ? (teil.items as RawTeil[]).filter((it) => it && typeof it === 'object') : []
}

function adEntries(teil: RawTeil): [string, string][] {
  const ads = teil.ads
  if (!ads || typeof ads !== 'object') return []
  return Object.entries(ads as Record<string, unknown>).filter((e): e is [string, string] => filled(e[1]))
}

function scriptLines(script: unknown, leadIn?: unknown): string[] {
  const out: string[] = []
  const line = (t: string) => blockText(t.trim())
  if (filled(leadIn)) out.push(line(leadIn))
  if (Array.isArray(script)) {
    for (const turn of script) {
      const text = turn && typeof turn === 'object' ? str((turn as { text?: unknown }).text) ?? '' : ''
      if (text.trim()) out.push(line(text))
    }
  } else if (filled(script)) {
    out.push(line(script))
  }
  return out
}

/** Lời bài nghe theo dòng (`h:teil:<i>` cấp Teil, `h:<id>:<i>` từng câu kèm câu dẫn) — như web. */
export function hoerenLines(teil: RawTeil): [string, string][] {
  const out: [string, string][] = []
  scriptLines(teil.audio_script).forEach((text, i) => out.push([`h:teil:${i}`, text]))
  for (const it of items(teil)) {
    scriptLines(it.audio_script, it.lead_in_de).forEach((text, i) => out.push([`h:${String(it.id)}:${i}`, text]))
  }
  return out
}

/** Chữ của mọi khối có trong Teil (đã chuẩn hoá xuống dòng) — mô hình dùng để kiểm/ghi hash. */
export function marksTexts(teil: RawTeil | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!teil) return out
  if (typeof teil.context === 'string' && teil.context) out.ctx = blockText(teil.context)
  if (filled(teil.gapped_text)) out.gap = blockText(teil.gapped_text)
  for (const [k, v] of adEntries(teil)) out[`ad:${k}`] = blockText(v)
  for (const it of items(teil)) {
    const id = String(it.id)
    if (filled(it.question)) out[`q:${id}`] = blockText(it.question)
    if (filled(it.text)) out[`t:${id}`] = blockText(it.text)
  }
  for (const [b, text] of hoerenLines(teil)) out[b] = text
  return out
}

/** Teil có bút trên web: Lesen 2 (bài đọc) hoặc Hören có lời bài, Lesen 1 (đoạn văn), Lesen 3 (rao vặt), Sprachbausteine. */
export function marksSupported(teil: RawTeil | null, kind: TeilKind): boolean {
  if (!teil) return false
  if (kind === 'mc') return (typeof teil.context === 'string' && teil.context !== '') || hoerenLines(teil).length > 0
  if (kind === 'gap-mc' || kind === 'gap-bank') return filled(teil.gapped_text)
  if (kind === 'match') {
    if (teil.type === 'MATCH_AD_X') return adEntries(teil).length > 0
    return items(teil).some((it) => filled(it.text))
  }
  return false
}

/**
 * Teil có bút trên APP: đúng luật web (`MARK_SECTIONS` + `marksSupported`), bỏ Hören. Trả chữ các khối, hoặc
 * `null` khi không có bút.
 */
export function appMarkTexts(sectionsJson: string | null | undefined, teilKey: string): Record<string, string> | null {
  const section = /^([A-Z]+)-\d+$/.exec(teilKey)?.[1] ?? ''
  if (!APP_MARK_SECTIONS.includes(section)) return null
  const teil = rawTeilOf(sectionsJson, teilKey)
  if (!marksSupported(teil, teilKindOf(teil, teilKey))) return null
  return marksTexts(teil)
}

/**
 * Khối của một chữ đang hiện trên màn, chỉ khi chữ đó TRÙNG từng ký tự với khối (sau chuẩn hoá xuống dòng):
 * chữ app dựng lệch chữ server băm thì không cho tô (vị trí sẽ sai), chữ hiện như thường.
 */
export function matchBlock(texts: Record<string, string> | null | undefined, block: string, shown: string | null | undefined): string | null {
  if (!texts || shown == null) return null
  const t = texts[block]
  return t != null && t === blockText(shown) ? block : null
}

export type GapPiece = { kind: 'text'; s: number; e: number } | { kind: 'gap'; gap: number; s: number; e: number }

/** Thư có ô trống `___31___` thành đoạn chữ / ô trống, giữ vị trí trên chữ đã chuẩn hoá (như web). */
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
