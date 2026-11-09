import type {
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
