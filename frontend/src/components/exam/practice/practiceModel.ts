/**
 * Phép thuần của chế độ luyện đề telc (03/11/2026). Không gọi API, không đụng React — để test được.
 */
import type { WritingAnnotation } from '@/lib/telcPracticeApi'
import { orderedWritingPoints } from '@/components/exam/telc/writingTask'
import type { AudioScript } from '@/components/exam/audioScript'

export type PracticeKind = 'match' | 'mc' | 'gap-mc' | 'gap-bank' | 'writing' | 'unknown'

export interface PracticeItem {
  id: string
  question?: string
  text?: string
  gap?: number
  options?: Record<string, string>
  /** Hören: bài nghe của câu (Teil 1, 3), câu dẫn tình huống, giọng người nói. */
  audio_script?: AudioScript
  lead_in_de?: string
  speaker?: string
  person?: string
}

export interface PracticeTeilData {
  teil?: number
  type?: string
  instruction_de?: string
  instruction_vi?: string
  headlines?: Record<string, string>
  ads?: Record<string, string>
  word_bank?: Record<string, string>
  gapped_text?: string
  stimulus_ad?: string
  examples?: Array<{ label?: string; situation: string; answer: string }>
  allow_none?: boolean
  context?: string
  title_de?: string
  vorspann_de?: string
  context_lines?: boolean
  glossary?: Array<{ term: string; explanation_de: string }>
  /**
   * Nguồn của bài đọc (Xưởng đề, V371): `quelle` là dòng ghi nguồn bắt buộc theo giấy phép (CC BY:
   * tác giả + giấy phép + "bearbeitet"; báo: "Daten: …"), hiện nhỏ dưới bài. Đề viết tay không khai.
   */
  source?: { quelle?: string | null }
  stimulus?: { type?: string; from?: string; subject?: string; body: string }
  writing_points?: string[]
  shuffle_points?: boolean
  prompt?: string
  items?: PracticeItem[]
  /** Hören: bài nghe cấp Teil (Teil 2), số lần phát, nghi thức telc (Ansage, giây đọc câu hỏi, câu khung). */
  audio_script?: AudioScript
  max_plays?: number
  ansage_de?: string
  reading_seconds?: number
  framing_de?: string
}

export const NONE_OF_THEM = 'x'

export function parseStructure(json: string | null | undefined): { sections?: Array<{ name?: string; teile?: PracticeTeilData[] }> } {
  if (!json) return {}
  try {
    const parsed = JSON.parse(json)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** Teil theo khoá `TÊN_PHẦN-số` (giống backend). */
export function findTeil(json: string | null | undefined, key: string): PracticeTeilData | null {
  const dash = key.lastIndexOf('-')
  if (dash < 0) return null
  const section = key.slice(0, dash)
  const no = Number(key.slice(dash + 1))
  const sec = parseStructure(json).sections?.find((s) => s.name === section)
  return sec?.teile?.find((t) => (t.teil ?? 1) === no) ?? null
}

export function kindOf(teil: PracticeTeilData | null, key: string): PracticeKind {
  if (key.startsWith('SCHREIBEN')) return 'writing'
  // Hören telc: mọi câu là richtig/falsch, đề không khai `type` ⇒ dựng như trắc nghiệm từng câu.
  if (key.startsWith('HOEREN')) return teil ? 'mc' : 'unknown'
  switch (teil?.type) {
    case 'MATCH_HEADLINE':
    case 'MATCH_AD_X':
      return 'match'
    case 'MULTIPLE_CHOICE':
      return 'mc'
    case 'GAP_MC':
      return 'gap-mc'
    case 'GAP_WORDBANK':
      return 'gap-bank'
    default:
      return 'unknown'
  }
}

/** Kho dùng chung cả Teil (tiêu đề, rao vặt, hộp từ) theo thứ tự chữ cái; rỗng với trắc nghiệm từng câu. */
export function sharedPool(teil: PracticeTeilData): { key: string; label: string }[] {
  const source = teil.headlines ?? teil.ads ?? teil.word_bank
  if (!source) return []
  return Object.entries(source)
    .map(([key, label]) => ({ key, label: String(label) }))
    .sort((a, b) => a.key.localeCompare(b.key, 'de'))
}

/** Lựa chọn của một câu: kho dùng chung, hoặc `options` riêng của câu. */
export function optionsFor(teil: PracticeTeilData, item: PracticeItem): { key: string; label: string }[] {
  if (item.options) return Object.entries(item.options).map(([key, label]) => ({ key, label: String(label) }))
  return sharedPool(teil)
}

/** Câu đang giữ một lựa chọn của kho (mỗi lựa chọn dùng một lần). `x` không thuộc về câu nào. */
export function ownerOf(answers: Record<string, string>, key: string, items: PracticeItem[]): string | undefined {
  if (key === NONE_OF_THEM) return undefined
  return items.find((it) => answers[it.id] === key)?.id
}

/** Nhãn ngắn của câu: số ô trống, số bài ("Text 3" → 3) hoặc số cuối của id. */
export function itemLabel(item: PracticeItem): string {
  if (typeof item.gap === 'number') return String(item.gap)
  const fromQuestion = /^Text\s*(\d+)/i.exec(item.question ?? '')
  if (fromQuestion) return fromQuestion[1]
  const tail = /(\d+)\s*$/.exec(item.id)
  return tail ? tail[1] : item.id
}

/** Câu chưa trả lời đầu tiên kể từ sau `afterId` (vòng lại từ đầu), hoặc `null` khi đã đủ. */
export function nextUnanswered(items: PracticeItem[], answers: Record<string, string>, afterId?: string | null): string | null {
  const start = afterId ? items.findIndex((it) => it.id === afterId) + 1 : 0
  for (let i = 0; i < items.length; i++) {
    const it = items[(start + i) % items.length]
    if (!answers[it.id]) return it.id
  }
  return null
}

/**
 * Bốn Leitpunkte theo thứ tự IN cho người học (đã xáo như đề thật), đánh nhãn P1–P4. `logical` là số
 * thứ tự trong đề gốc — AI chấm theo số này, giao diện phải đổi sang P-nhãn người học đã thấy.
 */
export function displayedPoints(points: string[] | undefined, shuffle: boolean | undefined) {
  const list = points ?? []
  return orderedWritingPoints(list, shuffle).map((text, i) => ({
    label: `P${i + 1}`,
    text,
    logical: list.indexOf(text) + 1,
  }))
}

export function labelForLogical(points: ReturnType<typeof displayedPoints>, logical: number | null | undefined): string | null {
  if (!logical) return null
  return points.find((p) => p.logical === logical)?.label ?? null
}

/**
 * Mô hình đánh số Leitpunkte theo thứ tự trong đề, còn người học thấy nhãn P1–P4 đã XÁO. Chữ tự do
 * („thiếu Leitpunkt 2", „Leitpunkte 2 (…), 3 và 4") phải đổi sang nhãn đang hiện, không thì số trong
 * câu chỉ sang điểm khác với nhãn ngay bên cạnh (gặp 07/11/2026).
 */
export function relabelLeitpunkte(text: string | null | undefined, points: ReturnType<typeof displayedPoints>): string {
  if (!text) return text ?? ''
  const map = (d: string) => labelForLogical(points, Number(d)) ?? d
  return text.replace(
    /(Leitpunkte?|Punkte?|điểm(?: yêu cầu)?)\s+((?:[1-4](?![\d,.]\d)(?![\d])(?:\s*\([^)]*\))?(?:\s*(?:,|và|und|and|&)\s*)?)+)/gi,
    (_m, word: string, list: string) =>
      `${word} ${list.replace(/\([^)]*\)|(^|[^\d])([1-4])(?!\d)/g, (x: string, pre?: string, d?: string) => (d ? (pre ?? '') + map(d) : x))}`,
  )
}

export type EssaySegment =
  | { kind: 'text'; value: string }
  | { kind: 'mark'; value: string; note: number }
  | { kind: 'insert'; note: number }

/**
 * Cắt bài viết thành các mảnh để tô ghi chú của AI: đoạn trích → `mark`, chỗ thiếu ý → `insert`
 * ngay sau đoạn `insertAfter`. Chỗ thiếu một Leitpunkt mà không định vị được (mô hình chép sai
 * `insertAfter`) thì đặt ở cuối bài — thiếu ý vẫn phải thấy được trong bài. Ghi chú khác không định
 * vị được thì bỏ qua ở đây (vẫn hiện trong danh sách ghi chú). Hai trích dẫn chồng nhau: giữ cái đến trước.
 */
export function essaySegments(text: string, notes: WritingAnnotation[]): EssaySegment[] {
  type Anchor = { start: number; end: number; note: number; insert: boolean }
  const anchors: Anchor[] = []
  notes.forEach((n, i) => {
    if (n.quote) {
      const at = text.indexOf(n.quote)
      if (at >= 0) anchors.push({ start: at, end: at + n.quote.length, note: i, insert: false })
      return
    }
    const at = n.insertAfter ? text.indexOf(n.insertAfter) : -1
    if (at >= 0) {
      const end = at + n.insertAfter!.length
      anchors.push({ start: end, end, note: i, insert: true })
    } else if (n.leitpunkt) {
      anchors.push({ start: text.length, end: text.length, note: i, insert: true })
    }
  })
  anchors.sort((a, b) => a.start - b.start || Number(b.insert) - Number(a.insert))

  const out: EssaySegment[] = []
  let cursor = 0
  for (const a of anchors) {
    if (a.start < cursor) continue
    if (a.start > cursor) out.push({ kind: 'text', value: text.slice(cursor, a.start) })
    if (a.insert) out.push({ kind: 'insert', note: a.note })
    else out.push({ kind: 'mark', value: text.slice(a.start, a.end), note: a.note })
    cursor = a.end
  }
  if (cursor < text.length) out.push({ kind: 'text', value: text.slice(cursor) })
  return out
}

export function wordCount(text: string): number {
  return (text.trim().match(/\S+/g) ?? []).length
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Hai lựa chọn của câu Hören đúng/sai — khoá giữ đúng giá trị server chấm ("richtig"/"falsch"). */
export const TRUE_FALSE_OPTIONS: Record<string, string> = { richtig: 'Richtig', falsch: 'Falsch' }

/**
 * Teil Hören dựng bằng trắc nghiệm từng câu: câu nào không khai `options` thì gắn richtig/falsch.
 * Không đổi Teil có sẵn lựa chọn (Hören Goethe a/b/c).
 */
export function withTrueFalse(teil: PracticeTeilData): PracticeTeilData {
  if (!teil.items?.some((it) => !it.options)) return teil
  return { ...teil, items: teil.items.map((it) => (it.options ? it : { ...it, options: TRUE_FALSE_OPTIONS })) }
}
