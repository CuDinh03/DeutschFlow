import type {
  AssembledExam,
  AssemblyBlockOption,
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
  // Teil không có câu (Schreiben): không có ma trận độ khó — luôn hợp lệ.
  if (itemCount <= 0) return { total, sumError: false, empty: false, expertWarning: false, valid: true }
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
  // Teil soạn theo tình huống (needsSources = false): bước 2 luôn qua được — để trống thì AI tự chọn.
  const sourcesOk = draft.needsSources === false || sourceStepReady(draft.sources)
  if (checkMatrix(draft.difficultyPlan, draft.mode, draft.itemCount).valid) {
    gated = 1
    if (sourcesOk) {
      gated = 2
      if (draft.text) {
        // Schreiben (itemCount = 0) không có bước Câu hỏi: Bài → Kiểm & duyệt.
        gated = draft.itemCount === 0 ? 4 : 3
        if (draft.items.length > 0) gated = 4
      }
    }
  }
  return Math.max(saved, gated)
}

export type ApproveBlocker = 'CHECKLIST' | 'RED_ITEM' | 'RED_CHECK' | 'BUSY' | 'NO_ITEMS' | 'NOT_DRAFT'

/** Điều kiện bật nút "Duyệt và đưa vào kho". Trả danh sách lý do còn chặn (rỗng = duyệt được). */
export function approveBlockers(
  draft: Pick<StudioDraft, 'items' | 'checks' | 'busyOp' | 'status'> & Partial<Pick<StudioDraft, 'itemCount'>>,
  checklist: Partial<Record<ChecklistKey, boolean>>,
): ApproveBlocker[] {
  const out: ApproveBlocker[] = []
  if (draft.status !== 'DRAFT') out.push('NOT_DRAFT')
  if (draft.busyOp != null) out.push('BUSY')
  // Schreiben (itemCount = 0) không có câu hỏi.
  if (draft.items.length === 0 && (draft.itemCount ?? 1) > 0) out.push('NO_ITEMS')
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
  allowReuse = false,
): { section: string; teil: number; blockId: number }[] {
  const out: { section: string; teil: number; blockId: number }[] = []
  for (const r of rows) {
    if (r.status !== 'OK') continue
    const id = choices[slotKey(r.slot.section, r.slot.teil)]
    if (id != null && r.slot.blocks.some((b) => b.id === id && blockSelectable(b, allowReuse))) {
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

/**
 * Chống trùng giữa các bộ đề: Teil kho đã nằm trong một bộ đề đang chạy (`usedIn` không rỗng) mặc định không
 * chọn được; admin tích "Cho dùng lại" (cố ý) thì chọn được và gửi `allowReuse: true`.
 */
export function blockSelectable(block: Pick<AssemblyBlockOption, 'usedIn'>, allowReuse: boolean): boolean {
  return allowReuse || (block.usedIn ?? []).length === 0
}

/** Bỏ các lựa chọn không còn hợp lệ khi tắt "Cho dùng lại" (giữ Teil chưa dùng ở bộ nào). */
export function pruneChoices(
  rows: AssemblyRow[],
  choices: Record<string, number | null | undefined>,
  allowReuse: boolean,
): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  for (const r of rows) {
    const key = slotKey(r.slot.section, r.slot.teil)
    const id = choices[key]
    const b = id == null ? null : r.slot.blocks.find((x) => x.id === id)
    out[key] = b && blockSelectable(b, allowReuse) ? b.id : null
  }
  return out
}

// ── Đợt 3: dạng Teil soạn theo tình huống ────────────────────────────────────

export type TeilKind =
  | 'ARTICLE' | 'MATCH_HEADLINE' | 'MATCH_AD_X' | 'GAP_MC' | 'GAP_WORDBANK' | 'WRITE_EMAIL'
  // Đợt 4 — telc A2: bảng thông tin a/b/c, richtig/falsch, form 5 ô, tin nhắn ngắn.
  | 'MC_INFO' | 'TRUE_FALSE' | 'FILL_FORM' | 'WRITE_NOTE'
const KINDS: TeilKind[] = [
  'MATCH_HEADLINE', 'MATCH_AD_X', 'GAP_MC', 'GAP_WORDBANK', 'WRITE_EMAIL', 'MC_INFO', 'TRUE_FALSE', 'FILL_FORM', 'WRITE_NOTE',
]

/** Dạng hiển thị theo `teilType`; lạ hoặc MULTIPLE_CHOICE (Lesen T2) → ARTICLE. */
export function teilKind(teilType: string | null | undefined): TeilKind {
  const u = (teilType ?? '').toUpperCase() as TeilKind
  return KINDS.includes(u) ? u : 'ARTICLE'
}

export function isGapKind(kind: TeilKind): boolean {
  return kind === 'GAP_MC' || kind === 'GAP_WORDBANK'
}

/** Teil viết tự do (không có câu hỏi, không ma trận): Schreiben B1 E-Mail, A2 tin nhắn ngắn. */
export function isWritingKind(kind: TeilKind): boolean {
  return kind === 'WRITE_EMAIL' || kind === 'WRITE_NOTE'
}

/** Số câu đầu tiên theo đề thật của từng dạng (Lesen B1 T2: 6–10; A2 T2: 6–10; rao vặt 11–; SB 21– / 31–). */
export function firstItemNumber(kind: TeilKind, teil: number): number {
  switch (kind) {
    case 'ARTICLE': return teil === 2 ? 6 : 1
    case 'TRUE_FALSE': return 6
    case 'MATCH_AD_X': return 11
    case 'GAP_MC': return 21
    case 'GAP_WORDBANK': return 31
    default: return 1
  }
}

export interface TeilCatalogEntry {
  cefrLevel: 'B1' | 'A2'
  section: string
  teil: number
  teilType: string
  itemCount: number
  needsSources: boolean
}

/** Teil telc B1 Xưởng đề đã nhận (khớp backend TeilSpec). Ngoài danh sách = "Đợt sau". */
export const STUDIO_TEIL_CATALOG: TeilCatalogEntry[] = [
  { cefrLevel: 'B1', section: 'LESEN', teil: 1, teilType: 'MATCH_HEADLINE', itemCount: 5, needsSources: true },
  { cefrLevel: 'B1', section: 'LESEN', teil: 2, teilType: 'MULTIPLE_CHOICE', itemCount: 5, needsSources: true },
  { cefrLevel: 'B1', section: 'LESEN', teil: 3, teilType: 'MATCH_AD_X', itemCount: 10, needsSources: false },
  { cefrLevel: 'B1', section: 'SPRACHBAUSTEINE', teil: 1, teilType: 'GAP_MC', itemCount: 10, needsSources: false },
  { cefrLevel: 'B1', section: 'SPRACHBAUSTEINE', teil: 2, teilType: 'GAP_WORDBANK', itemCount: 10, needsSources: false },
  { cefrLevel: 'B1', section: 'SCHREIBEN', teil: 1, teilType: 'WRITE_EMAIL', itemCount: 0, needsSources: false },
  // Đợt 4 — telc Deutsch A2 / Start Deutsch 2 (Übungstest 1 chính thức). Hören làm cùng đợt audio.
  { cefrLevel: 'A2', section: 'LESEN', teil: 1, teilType: 'MC_INFO', itemCount: 5, needsSources: false },
  { cefrLevel: 'A2', section: 'LESEN', teil: 2, teilType: 'TRUE_FALSE', itemCount: 5, needsSources: false },
  { cefrLevel: 'A2', section: 'LESEN', teil: 3, teilType: 'MATCH_AD_X', itemCount: 5, needsSources: false },
  { cefrLevel: 'A2', section: 'SCHREIBEN', teil: 1, teilType: 'FILL_FORM', itemCount: 5, needsSources: false },
  { cefrLevel: 'A2', section: 'SCHREIBEN', teil: 2, teilType: 'WRITE_NOTE', itemCount: 0, needsSources: false },
]

export const STUDIO_LEVELS = ['B1', 'A2'] as const

/** Số Teil của từng phần thi theo cấp (telc); Teil không có trong danh mục là "Đợt sau". */
export const LEVEL_SECTION_TEILS: Record<string, Record<string, number[]>> = {
  B1: { LESEN: [1, 2, 3], SPRACHBAUSTEINE: [1, 2], HOEREN: [1, 2, 3], SCHREIBEN: [1] },
  A2: { LESEN: [1, 2, 3], HOEREN: [1, 2, 3], SCHREIBEN: [1, 2] },
}

export function catalogEntry(section: string, teil: number, cefrLevel = 'B1'): TeilCatalogEntry | null {
  return STUDIO_TEIL_CATALOG.find((e) => e.cefrLevel === cefrLevel && e.section === section && e.teil === teil) ?? null
}

/**
 * Mẫu nhanh viết cho Teil 5 câu → đổi sang số câu khác theo tỉ lệ; phần dư dồn vào "Vừa" để tổng đúng.
 * 10 câu: Giống đề thật 2-2-1-0 → 4-4-2-0.
 */
export function scalePlan(plan: DifficultyPlan, itemCount: number, base = 5): DifficultyPlan {
  if (itemCount <= 0) return { EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: 0 }
  if (itemCount === base) return { ...plan }
  const out: DifficultyPlan = { EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: 0 }
  for (const k of DIFFICULTY_ORDER) out[k] = Math.floor(((plan[k] ?? 0) * itemCount) / base)
  out.MEDIUM += itemCount - planTotal(out)
  return out
}

/** Số từ cho mỗi mẩu rao vặt Lesen T3 (B1; A2 xem `adWordRange`) và thân E-Mail Schreiben. */
export const AD_WORD_RANGE: [number, number] = [15, 45]
export const AD_WORD_RANGE_A2: [number, number] = [10, 35]
/** telc A2 Schreiben Teil 2: tình huống ngắn (backend TeilSpec 20–70 từ); bài viết của học viên ~40 từ. */
export const NOTE_WORD_RANGE: [number, number] = [20, 70]
/** Số từ của bài theo dạng A2 (bảng thông tin, bài richtig/falsch, đoạn văn của form) — khớp TeilSpec. */
export const A2_TEXT_WORD_RANGE: Partial<Record<TeilKind, [number, number]>> = {
  MC_INFO: [40, 140], TRUE_FALSE: [100, 190], FILL_FORM: [60, 140],
}

export function adWordRange(cefrLevel: string | null | undefined): [number, number] {
  return cefrLevel === 'A2' ? AD_WORD_RANGE_A2 : AD_WORD_RANGE
}
export const EMAIL_WORD_RANGE: [number, number] = [70, 130]
export const AD_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'] as const

/** Chữ các mẩu rao vặt theo cấp: B1 a–l (12), A2 a–h (8). */
export function adLettersFor(cefrLevel: string | null | undefined): string[] {
  return AD_LETTERS.slice(0, cefrLevel === 'A2' ? 8 : 12)
}

/** Số câu x (không mẩu nào hợp) theo cấp: B1 2, A2 1. */
export function adXExpected(cefrLevel: string | null | undefined): number {
  return cefrLevel === 'A2' ? 1 : 2
}
export const BANK_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o'] as const
export const WRITING_POINT_COUNT = 4

export function inWordRange(text: string, [lo, hi]: [number, number]): boolean {
  const n = countWords(text)
  return n >= lo && n <= hi
}

/** Số câu theo đề thật từ id: `LV3-13` → 13, `SB1-21` → 21; không đọc được thì `fallback`. */
export function itemNumber(itemId: string, fallback: number): number {
  const m = /(\d+)$/.exec(itemId)
  return m ? Number(m[1]) : fallback
}

// ── Lesen T3: vai trò 12 mẩu rao vặt ──

export interface AdRoleRow {
  letter: string
  text: string
  /** Số câu (11–20) nhận mẩu này làm đáp án. */
  answerFor: number[]
  /** Nhãn ví dụ ("01") dùng mẩu này. */
  exampleFor: string[]
  /** Số câu dùng mẩu này làm nhiễu. */
  distractorFor: number[]
  role: 'ANSWER' | 'EXAMPLE' | 'SPARE'
}

type AdItem = { id: string; options?: Partial<Record<string, string>> | null; correct?: string | null }

export function adRoles(
  ads: Partial<Record<string, string>> | null | undefined,
  items: AdItem[],
  examples: { label: string; answer: string }[] | null | undefined,
  letters: readonly string[] = AD_LETTERS,
): AdRoleRow[] {
  return letters.map((letter) => {
    const answerFor: number[] = []
    const distractorFor: number[] = []
    items.forEach((it, i) => {
      const n = itemNumber(it.id, i + 1)
      if (it.correct === letter) answerFor.push(n)
      else if (it.options && letter in it.options) distractorFor.push(n)
    })
    const exampleFor = (examples ?? []).filter((e) => e.answer === letter).map((e) => e.label)
    const role: AdRoleRow['role'] = answerFor.length > 0 ? 'ANSWER' : exampleFor.length > 0 ? 'EXAMPLE' : 'SPARE'
    return { letter, text: ads?.[letter] ?? '', answerFor, exampleFor, distractorFor, role }
  })
}

export interface AdIssues {
  /** Số câu đáp án x (đề thật: đúng 2). */
  xCount: number
  /** Mẩu làm đáp án cho > 1 câu. */
  duplicateAnswers: string[]
}

export const AD_X_EXPECTED = 2

export function adIssues(items: AdItem[]): AdIssues {
  const count = new Map<string, number>()
  let xCount = 0
  for (const it of items) {
    if (!it.correct) continue
    if (it.correct === 'x') { xCount++; continue }
    count.set(it.correct, (count.get(it.correct) ?? 0) + 1)
  }
  return { xCount, duplicateAnswers: Array.from(count).filter(([, n]) => n > 1).map(([k]) => k).sort() }
}

// ── Sprachbausteine: thư có ô ──

export type GapSegment =
  | { kind: 'text'; text: string }
  | { kind: 'gap'; gap: string; itemId: string | null; target: string | null }

/** Chữ/số (Latin + dấu) — biên từ khi định vị ô; xem countWords về lý do không dùng \p{L}. */
const WORD_CHAR = /[0-9A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/
/** Khoảng cách cho phép giữa các từ của `before` và trước `target` (như backend: khoảng trắng + dấu câu). */
const GAP_SEP = '[\\s!-\\/:-@\\[-`{-~\u201E\u201C\u201D\u00BB\u00AB\u2013]*'

function isWordBoundaryAt(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1] : ''
  const after = end < text.length ? text[end] : ''
  return !(before && WORD_CHAR.test(before)) && !(after && WORD_CHAR.test(after))
}

/**
 * Vị trí của `target` ngay sau cụm `before` — bản TS của SituationalTeile.locate (backend). Cụm khớp > 1 chỗ
 * là mơ hồ → -1. Không có cụm (hoặc cụm không khớp) thì dùng lần xuất hiện DUY NHẤT của `target` như một từ.
 */
export function locateGap(text: string, before: string | null | undefined, target: string | null | undefined): number {
  if (!text || !target || !target.trim()) return -1
  const b = (before ?? '').trim()
  if (b) {
    const parts = b.split(/\s+/).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const re = new RegExp(parts.join(GAP_SEP) + GAP_SEP, 'g')
    const hits: number[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) != null) {
      const end = m.index + m[0].length
      if (text.startsWith(target, end) && isWordBoundaryAt(text, end, end + target.length)) hits.push(end)
      if (m[0].length === 0) re.lastIndex++
    }
    if (hits.length === 1) return hits[0]
    if (hits.length > 1) return -1
  }
  const found: number[] = []
  let i = text.indexOf(target)
  while (i >= 0) {
    if (isWordBoundaryAt(text, i, i + target.length)) found.push(i)
    i = text.indexOf(target, i + 1)
  }
  return found.length === 1 ? found[0] : -1
}

type GapItem = { id: string; meta?: Record<string, string> | null }

/**
 * Dựng thư có ô từ bức thư nguyên vẹn + `meta` của các câu (target/before/gap). Câu không định vị được
 * (sửa thư sau khi đã có câu) nằm trong `missing` — tự kiểm sẽ báo đỏ GAPS.
 */
export function buildGappedText(letter: string, items: GapItem[]): { segments: GapSegment[]; missing: string[] } {
  const found: { pos: number; len: number; gap: string; itemId: string; target: string }[] = []
  const missing: string[] = []
  items.forEach((it, i) => {
    const target = it.meta?.target ?? ''
    const pos = locateGap(letter, it.meta?.before, target)
    if (pos < 0) { missing.push(it.id); return }
    found.push({ pos, len: target.length, gap: it.meta?.gap ?? String(itemNumber(it.id, i + 1)), itemId: it.id, target })
  })
  found.sort((a, b) => a.pos - b.pos)
  const segments: GapSegment[] = []
  let cursor = 0
  for (const f of found) {
    if (f.pos < cursor) { missing.push(f.itemId); continue } // chồng lên ô trước
    if (f.pos > cursor) segments.push({ kind: 'text', text: letter.slice(cursor, f.pos) })
    segments.push({ kind: 'gap', gap: f.gap, itemId: f.itemId, target: f.target })
    cursor = f.pos + f.len
  }
  if (cursor < letter.length) segments.push({ kind: 'text', text: letter.slice(cursor) })
  return { segments, missing }
}

/** Đọc `gapped_text` của content kho (`___21___`) thành các mẩu. `itemIdByGap` gắn ô với câu nếu biết. */
export function parseGappedText(gapped: string, itemIdByGap: Record<string, string> = {}): GapSegment[] {
  const out: GapSegment[] = []
  const re = /___(\d+)___/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(gapped)) != null) {
    if (m.index > last) out.push({ kind: 'text', text: gapped.slice(last, m.index) })
    out.push({ kind: 'gap', gap: m[1], itemId: itemIdByGap[m[1]] ?? null, target: null })
    last = m.index + m[0].length
  }
  if (last < gapped.length) out.push({ kind: 'text', text: gapped.slice(last) })
  return out
}

// ── Sprachbausteine T2: hộp 15 từ ──

export interface WordBankRow {
  letter: string
  word: string
  /** Số ô (31–40) có từ này là đáp án. */
  answerFor: string[]
}

export function wordBankRows(
  wordBank: Partial<Record<string, string>> | null | undefined,
  items: { id: string; correct?: string | null; meta?: Record<string, string> | null }[],
): WordBankRow[] {
  return BANK_LETTERS.filter((k) => wordBank?.[k] != null || items.some((it) => it.correct === k)).map((letter) => ({
    letter,
    word: wordBank?.[letter] ?? '',
    answerFor: items
      .map((it, i) => (it.correct === letter ? (it.meta?.gap ?? String(itemNumber(it.id, i + 1))) : null))
      .filter((x): x is string => x != null),
  }))
}

/** Lỗi hộp từ: chữ làm đáp án hai lần, hoặc số từ trong hộp khác 15. */
export function wordBankIssues(rows: WordBankRow[]): { duplicateAnswers: string[]; size: number } {
  return {
    duplicateAnswers: rows.filter((r) => r.answerFor.length > 1).map((r) => r.letter),
    size: rows.filter((r) => r.word.trim()).length,
  }
}

// ── Chống trùng ──

/** "Giống 87% Teil kho #123 — …" → 123. Không có thì null. */
export function blockIdFromDetail(detail: string | null | undefined): number | null {
  if (!detail) return null
  const m = /Teil kho\s*#\s*(\d+)/i.exec(detail) ?? /#(\d+)/.exec(detail)
  return m ? Number(m[1]) : null
}

// ── Đợt 4: telc A2 ──

/** Lesen A2 Teil 2: đếm richtig/falsch. Đề thật có 2–3 mỗi loại; lệch thì cảnh báo vàng. */
export function trueFalseBalance(items: { correct?: string | null }[]): { richtig: number; falsch: number; balanced: boolean } {
  const richtig = items.filter((i) => i.correct === 'richtig').length
  const falsch = items.filter((i) => i.correct === 'falsch').length
  const ok = (n: number) => n >= 2 && n <= 3
  return { richtig, falsch, balanced: items.length === 0 || (ok(richtig) && ok(falsch)) }
}

/** `meta.accept` ("Mo|Montag") ⇄ danh sách cách viết chấp nhận. */
export function splitAccept(raw: string | null | undefined): string[] {
  return (raw ?? '').split('|').map((x) => x.trim()).filter(Boolean)
}
export function joinAccept(list: string[]): string {
  return list.map((x) => x.trim()).filter(Boolean).join('|')
}

/** Ô có chữ số chấm tuyệt đối (luật telc A1/A2): cảnh báo admin khi đáp án có số. */
export function hasDigits(answer: string | null | undefined): boolean {
  return /\d/.test(answer ?? '')
}

// ── Ghép từ khung (cấp chưa có đề nền) ──

export interface BlueprintRow {
  section: string
  teil: number
  type: string
  blocks: AssemblyBlockOption[]
}

/** Mỗi ô Teil của khung kèm Teil kho cùng ô (so section + teil, không phân biệt hoa thường). */
export function blueprintRows(
  bp: { sections: { slots: { section: string; teil: number; type: string }[] }[] } | null | undefined,
  slots: AssemblySlotBlocks[],
): BlueprintRow[] {
  if (!bp) return []
  const bank = new Map(slots.map((s) => [slotKey(s.section, s.teil), s.blocks]))
  return bp.sections.flatMap((sec) => sec.slots.map((sl) => ({
    section: sl.section, teil: sl.teil, type: sl.type, blocks: bank.get(slotKey(sl.section, sl.teil)) ?? [],
  })))
}

/**
 * Khung bắt buộc đủ MỌI ô. Trả danh sách thay (đủ ô) và các ô còn thiếu — lựa chọn đã nằm trong bộ khác mà chưa
 * bật "Cho dùng lại" tính là thiếu.
 */
export function blueprintSelection(
  rows: BlueprintRow[],
  choices: Record<string, number | null | undefined>,
  allowReuse: boolean,
): { replacements: { section: string; teil: number; blockId: number }[]; missing: string[] } {
  const replacements: { section: string; teil: number; blockId: number }[] = []
  const missing: string[] = []
  for (const r of rows) {
    const key = slotKey(r.section, r.teil)
    const id = choices[key]
    const b = id == null ? null : r.blocks.find((x) => x.id === id)
    if (b && blockSelectable(b, allowReuse)) replacements.push({ section: r.section, teil: r.teil, blockId: b.id })
    else missing.push(key)
  }
  return { replacements, missing }
}
