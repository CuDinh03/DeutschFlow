import type {
  AssembledExam,
  AssemblyBase,
  AssemblySlotBlocks,
  ChecklistKey,
  DifficultyLevel,
  DifficultyPlan,
  DraftStep,
  StudioDraft,
  StudioItem,
  StudioSource,
} from '@/lib/adminExamStudioApi'

// ─────────────────────────────────────────────────────────────────────────────
// Xưởng đề — logic thuần (không React) dùng chung cho trang danh sách, trình hướng dẫn và test.
// ─────────────────────────────────────────────────────────────────────────────

export const DIFFICULTY_ORDER: DifficultyLevel[] = ['EASY', 'MEDIUM', 'HARD', 'EXPERT']

/** 10 chủ đề trung lập Đợt 1 (tên tiếng Đức giữ nguyên như Themenfeld). */
export const STUDIO_THEMES = [
  'Arbeit', 'Wohnen', 'Gesundheit', 'Bildung', 'Verkehr',
  'Reisen', 'Einkaufen', 'Technik im Alltag', 'Sport', 'Essen und Trinken',
] as const

/** Đợt 1 chỉ có telc · B1 · LESEN · Teil 2 (5 câu a/b/c). */
export const STUDIO_TEIL_ITEM_COUNT = 5

export const CHECKLIST_KEYS: ChecklistKey[] = [
  'LEVEL', 'FORMAT', 'SINGLE_ANSWER', 'NEUTRAL', 'FACTS_MATCH', 'NO_COPY', 'QUELLE', 'EXPLANATION',
]

/** Năm bước hiện trên thanh bước (APPROVED không phải một bước riêng — nó là REVIEW đã xong). */
export const WIZARD_STEPS: Exclude<DraftStep, 'APPROVED'>[] = ['FRAME', 'SOURCE', 'TEXT', 'ITEMS', 'REVIEW']

export function stepIndex(step: DraftStep): number {
  return step === 'APPROVED' ? WIZARD_STEPS.length - 1 : WIZARD_STEPS.indexOf(step)
}

export function planTotal(plan: DifficultyPlan): number {
  return DIFFICULTY_ORDER.reduce((s, k) => s + (plan[k] ?? 0), 0)
}

export interface MatrixCheck {
  total: number
  /** Chế độ "Đề thi thử": tổng phải bằng số câu của Teil. */
  sumError: boolean
  /** Không có câu nào — chế độ nào cũng không sinh được. */
  empty: boolean
  /** Chế độ "Đề thi thử" có > 1 câu Siêu khó: khó hơn đề thật (chỉ cảnh báo, không chặn). */
  expertWarning: boolean
  valid: boolean
}

export function checkMatrix(plan: DifficultyPlan, mode: 'EXAM' | 'PRACTICE', itemCount: number): MatrixCheck {
  const total = planTotal(plan)
  const empty = total <= 0
  const sumError = mode === 'EXAM' && total !== itemCount
  const expertWarning = mode === 'EXAM' && (plan.EXPERT ?? 0) > 1
  return { total, sumError, empty, expertWarning, valid: !empty && !sumError }
}

/** Đổi một ô của ma trận, kẹp trong [0, max]. */
export function setPlanLevel(plan: DifficultyPlan, level: DifficultyLevel, value: number, max = 20): DifficultyPlan {
  const n = Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : 0
  return { ...plan, [level]: n }
}

export function samePlan(a: DifficultyPlan, b: DifficultyPlan): boolean {
  return DIFFICULTY_ORDER.every((k) => (a[k] ?? 0) === (b[k] ?? 0))
}

/** Đếm câu theo bậc giao (target) hoặc bậc đo lại (measured; câu chưa đo bị bỏ qua). */
export function countByLevel(items: StudioItem[], by: 'target' | 'measured'): DifficultyPlan {
  const out: DifficultyPlan = { EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: 0 }
  for (const it of items) {
    const lv = by === 'target' ? it.difficultyTarget : it.difficultyMeasured?.level
    if (lv) out[lv] += 1
  }
  return out
}

export function selectedFactIds(source: StudioSource): string[] {
  return source.facts.filter((f) => f.selected).map((f) => f.id)
}

export function selectedFactCount(sources: StudioSource[]): number {
  return sources.reduce((s, src) => s + selectedFactIds(src).length, 0)
}

/** Nguồn đang được dùng (có ≥ 1 dữ kiện tích) mà bị cờ trung lập → chặn sang bước sau. */
export function flaggedSelectedSources(sources: StudioSource[]): StudioSource[] {
  return sources.filter((s) => s.neutrality === 'FLAGGED' && s.facts.some((f) => f.selected))
}

export function sourceStepReady(sources: StudioSource[]): boolean {
  return selectedFactCount(sources) > 0 && flaggedSelectedSources(sources).length === 0
}

/**
 * Bước xa nhất được mở trên thanh bước: mọi bước ≤ bước backend đã ghi, cộng các bước mà điều kiện
 * của bước trước đã thoả trên dữ liệu hiện có (backend không có endpoint "sang bước").
 */
export function maxReachableStep(draft: StudioDraft): number {
  const saved = stepIndex(draft.step)
  let gated = 0
  if (checkMatrix(draft.difficultyPlan, draft.mode, draft.itemCount).valid) {
    gated = 1
    if (sourceStepReady(draft.sources)) {
      gated = 2
      if (draft.text) {
        gated = 3
        if (draft.items.length > 0) gated = 4
      }
    }
  }
  return Math.max(saved, gated)
}

export type ApproveBlocker = 'CHECKLIST' | 'RED_ITEM' | 'RED_CHECK' | 'BUSY' | 'NO_ITEMS' | 'NOT_DRAFT'

/** Điều kiện bật nút "Duyệt và đưa vào kho". Trả danh sách lý do còn chặn (rỗng = duyệt được). */
export function approveBlockers(
  draft: Pick<StudioDraft, 'items' | 'checks' | 'busyOp' | 'status'>,
  checklist: Partial<Record<ChecklistKey, boolean>>,
): ApproveBlocker[] {
  const out: ApproveBlocker[] = []
  if (draft.status !== 'DRAFT') out.push('NOT_DRAFT')
  if (draft.busyOp != null) out.push('BUSY')
  if (draft.items.length === 0) out.push('NO_ITEMS')
  if (!CHECKLIST_KEYS.every((k) => checklist[k] === true)) out.push('CHECKLIST')
  if (draft.items.some((i) => i.light === 'RED')) out.push('RED_ITEM')
  if (draft.checks.some((c) => c.light === 'RED')) out.push('RED_CHECK')
  return out
}

/** Tách đoạn: các đoạn cách nhau bằng dòng trống. */
export function splitParagraphs(context: string): string[] {
  return context.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
}

/**
 * Cắt một chuỗi thành các mẩu, đánh dấu mẩu trùng một trong `snippets` (khớp nguyên văn).
 * Dùng để tô đỏ đoạn chép từ nguồn trong bản xem trước.
 */
export function markSnippets(text: string, snippets: string[]): { text: string; hit: boolean }[] {
  const needles = snippets.map((s) => s.trim()).filter((s) => s.length > 0)
  if (needles.length === 0) return [{ text, hit: false }]
  const escaped = needles
    .sort((a, b) => b.length - a.length)
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'g')
  const out: { text: string; hit: boolean }[] = []
  let last = 0
  for (const m of Array.from(text.matchAll(re))) {
    const i = m.index ?? 0
    if (i > last) out.push({ text: text.slice(last, i), hit: false })
    out.push({ text: m[0], hit: true })
    last = i + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false })
  return out
}

// ── Ghép bộ đề từ kho (đợt 2) ────────────────────────────────────────────────

export function slotKey(section: string, teil: number): string {
  return `${section.toUpperCase()}#${teil}`
}

export interface AssemblyRow {
  slot: AssemblySlotBlocks
  /** Loại Teil của ô tương ứng trong đề nền (null = đề nền không ghi loại). */
  baseType: string | null
  /** TYPE_MISMATCH: đề nền có ô cùng phần + Teil nhưng khác dạng → không thay được. */
  status: 'OK' | 'TYPE_MISMATCH'
}

/**
 * Ô thay được: kho có ≥ 1 Teil VÀ đề nền có cùng ô (section + teil). Khác `type` thì giữ hàng nhưng
 * khoá. Đề nền không ghi `type` (null) thì coi như hợp — backend vẫn là chốt chặn cuối.
 */
export function assemblyRows(base: AssemblyBase | null, slots: AssemblySlotBlocks[]): AssemblyRow[] {
  if (!base) return []
  const baseSlots = new Map(base.slots.map((s) => [slotKey(s.section, s.teil), s]))
  const rows: AssemblyRow[] = []
  for (const slot of slots) {
    if (slot.blocks.length === 0) continue
    const b = baseSlots.get(slotKey(slot.section, slot.teil))
    if (!b) continue
    const mismatch = b.type != null && slot.type != null && b.type.toUpperCase() !== slot.type.toUpperCase()
    rows.push({ slot, baseType: b.type, status: mismatch ? 'TYPE_MISMATCH' : 'OK' })
  }
  return rows.sort((x, y) => x.slot.section.localeCompare(y.slot.section) || x.slot.teil - y.slot.teil)
}

/** Lựa chọn của form (khoá = slotKey, giá trị = blockId hoặc null = giữ Teil đề nền) → danh sách thay. */
export function assemblyReplacements(
  rows: AssemblyRow[],
  choices: Record<string, number | null | undefined>,
): { section: string; teil: number; blockId: number }[] {
  const out: { section: string; teil: number; blockId: number }[] = []
  for (const r of rows) {
    if (r.status !== 'OK') continue
    const id = choices[slotKey(r.slot.section, r.slot.teil)]
    if (id != null && r.slot.blocks.some((b) => b.id === id)) {
      out.push({ section: r.slot.section, teil: r.slot.teil, blockId: id })
    }
  }
  return out
}

export type AssemblyFormError = 'NO_BASE' | 'NO_TITLE' | 'NO_REPLACEMENT'

export function assemblyFormErrors(form: {
  baseExamId: number | null
  title: string
  replacements: unknown[]
}): AssemblyFormError[] {
  const out: AssemblyFormError[] = []
  if (form.baseExamId == null) out.push('NO_BASE')
  if (!form.title.trim()) out.push('NO_TITLE')
  if (form.replacements.length === 0) out.push('NO_REPLACEMENT')
  return out
}

export type AssembledStatus = 'UPCOMING' | 'PUBLISHED' | 'RETIRED'

export function assembledStatus(e: Pick<AssembledExam, 'reviewed' | 'active'>): AssembledStatus {
  if (!e.active) return 'RETIRED'
  return e.reviewed ? 'PUBLISHED' : 'UPCOMING'
}

/** Số thứ tự gợi ý cho tên "… Bộ đề ghép N": lớn hơn mọi số đã dùng ở cuối tên, tối thiểu = số bộ + 1. */
export function nextAssemblyNumber(existing: Pick<AssembledExam, 'title'>[]): number {
  let max = existing.length
  for (const e of existing) {
    const m = /(\d+)\s*$/.exec(e.title ?? '')
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max + 1
}

// ── Lesen Teil 1 — MATCH_HEADLINE (5 văn bản ngắn + 10 tiêu đề a–j) ──────────

export const MATCH_HEADLINE = 'MATCH_HEADLINE'
/** Số từ cho MỖI văn bản ngắn của Lesen T1. */
export const MATCH_TEXT_WORD_RANGE: [number, number] = [55, 110]
export const HEADLINE_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const

export function isMatchHeadline(teilType: string | null | undefined): boolean {
  return (teilType ?? '').toUpperCase() === MATCH_HEADLINE
}

/**
 * Đếm từ: token cách nhau bằng khoảng trắng, có ít nhất một chữ hoặc số. Dải Latin thay `\p{L}` vì
 * tsconfig không đặt target (ES5) nên cờ `u` bị TS1501 chặn — xem orgCsv.ts.
 */
const WORDISH_RE = /[0-9A-Za-zÀ-ɏḀ-ỿ]/
export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => WORDISH_RE.test(w)).length
}

export function matchTextInRange(text: string): boolean {
  const n = countWords(text)
  return n >= MATCH_TEXT_WORD_RANGE[0] && n <= MATCH_TEXT_WORD_RANGE[1]
}

/** Tách `context` thành các văn bản (cách nhau bằng dòng trống); thiếu thì đệm chuỗi rỗng tới `count`. */
export function splitMatchTexts(context: string | null | undefined, count: number): string[] {
  const parts = splitParagraphs(context ?? '')
  while (parts.length < count) parts.push('')
  return parts
}

/**
 * Ghép lại bằng `\n\n`. Dòng trống bên trong một ô bị gộp thành xuống dòng đơn — nếu không, văn bản đó
 * sẽ bị tách đôi ở lần đọc sau và lệch số với câu LV1-i.
 */
export function joinMatchTexts(texts: string[]): string {
  return texts.map((x) => x.trim().replace(/\n\s*\n/g, '\n')).join('\n\n')
}

/** Vị trí văn bản ứng với câu: `LV1-3` → 2; không đọc được thì dùng thứ tự trong mảng. */
export function matchTextIndex(itemId: string, fallback: number): number {
  const m = /-(\d+)$/.exec(itemId)
  return m ? Number(m[1]) - 1 : fallback
}

/** Các khoá phương án của một câu, xếp theo chữ cái (T2: a,b,c; T1: 2 chữ trong a–j). */
export function optionKeys(options: Record<string, string> | null | undefined): string[] {
  return Object.keys(options ?? {}).sort()
}

export interface HeadlineRow {
  letter: string
  text: string
  itemId: string
  itemIndex: number
  correct: boolean
}

/** Bảng 10 tiêu đề a–j gộp từ phương án của 5 câu, xếp theo chữ cái. */
export function headlineTable(
  items: { id: string; options: Record<string, string>; correct?: string | null }[],
): HeadlineRow[] {
  const rows: HeadlineRow[] = []
  items.forEach((it, i) => {
    for (const k of optionKeys(it.options)) {
      rows.push({ letter: k, text: it.options[k] ?? '', itemId: it.id, itemIndex: i, correct: it.correct === k })
    }
  })
  return rows.sort((a, b) => a.letter.localeCompare(b.letter) || a.itemIndex - b.itemIndex)
}

export interface HeadlineIssues {
  /** Chữ xuất hiện ở > 1 chỗ. */
  duplicateLetters: string[]
  /** Nội dung tiêu đề trùng nhau (so sau khi bỏ hoa thường, khoảng trắng, dấu câu cuối). */
  duplicateTexts: string[]
  /** Chữ trong a–j chưa có. */
  missingLetters: string[]
  /** Chữ ngoài a–j. */
  invalidLetters: string[]
  /** id câu không có đúng 2 phương án, hoặc đáp án không nằm trong 2 phương án đó. */
  badItems: string[]
}

export const normalizeHeadline = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/[.!?…\s]+$/, '').trim()

export function headlineIssues(
  items: { id: string; options: Record<string, string>; correct?: string | null }[],
): HeadlineIssues {
  const rows = headlineTable(items)
  const letterCount = new Map<string, number>()
  const textCount = new Map<string, { n: number; text: string }>()
  for (const r of rows) {
    letterCount.set(r.letter, (letterCount.get(r.letter) ?? 0) + 1)
    const key = normalizeHeadline(r.text)
    if (!key) continue
    const cur = textCount.get(key)
    textCount.set(key, { n: (cur?.n ?? 0) + 1, text: cur?.text ?? r.text.trim() })
  }
  const valid = new Set<string>(HEADLINE_LETTERS)
  return {
    duplicateLetters: Array.from(letterCount).filter(([, n]) => n > 1).map(([k]) => k),
    duplicateTexts: Array.from(textCount.values()).filter((v) => v.n > 1).map((v) => v.text),
    missingLetters: HEADLINE_LETTERS.filter((k) => !letterCount.has(k)),
    invalidLetters: Array.from(letterCount.keys()).filter((k) => !valid.has(k)),
    badItems: items
      .filter((it) => optionKeys(it.options).length !== 2 || !it.correct || !(it.correct in (it.options ?? {})))
      .map((it) => it.id),
  }
}

export function hasHeadlineIssues(i: HeadlineIssues): boolean {
  return i.duplicateLetters.length + i.duplicateTexts.length + i.missingLetters.length
    + i.invalidLetters.length + i.badItems.length > 0
}
