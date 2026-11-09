import api from '@/lib/api'

// ─────────────────────────────────────────────────────────────────────────────
// Xưởng đề (admin) — tạo một Teil đề thi từ nguồn báo Đức, AI viết bài và ra câu hỏi theo
// ma trận độ khó 4 bậc. Thiết kế: plans/2026-11-09-thiet-ke-co-che-tao-de.md (LOCAL).
// Đợt 1 chỉ nhận telc · B1 · LESEN · Teil 2 (bài báo + 5 câu a/b/c).
// Mọi thao tác AI chạy nền: endpoint trả Draft ngay với busyOp != null, client hỏi lại
// GET /drafts/{id} mỗi ~2 s cho tới khi busyOp = null (lastError khác null nếu job hỏng).
// ─────────────────────────────────────────────────────────────────────────────

export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT'
export type DifficultyPlan = Record<DifficultyLevel, number>
export type DraftStep = 'FRAME' | 'SOURCE' | 'TEXT' | 'ITEMS' | 'REVIEW' | 'APPROVED'
export type DraftStatus = 'DRAFT' | 'APPROVED' | 'DISCARDED'
export type BusyOp = 'FACTS' | 'TEXT' | 'ITEMS' | 'ITEM' | 'VERIFY'
export type Light = 'GREEN' | 'YELLOW' | 'RED'
export type OptionKey = 'a' | 'b' | 'c'

export interface StudioFact {
  id: string
  /** Dữ kiện viết lại bằng lời mới (tiếng Đức), không phải câu gốc. */
  text: string
  figure: string | null
  year: string | null
  paragraph: number | null
  /** Có nguồn thứ hai trong cùng bản nháp xác nhận. */
  corroborated: boolean
  selected: boolean
}

export interface StudioSource {
  id: number
  url: string | null
  publisher: string | null
  title: string | null
  author: string | null
  publishedAt: string | null
  licenseText: string | null
  /** ADAPT = được chuyển thể (CC BY); FACTS_ONLY = chỉ dữ kiện. */
  usageMode: 'ADAPT' | 'FACTS_ONLY'
  usageModeConfirmed: boolean
  neutrality: 'OK' | 'FLAGGED'
  neutralityReason: string | null
  facts: StudioFact[]
}

export interface StudioText {
  titleDe: string
  vorspannDe: string
  /** Bài đọc, đoạn cách nhau bằng dòng trống; từ có chú thích đánh dấu `*`. */
  context: string
  glossary: { term: string; explanationDe: string }[]
}

export interface TextMetrics {
  wordCount: number
  wordRange: [number, number]
  aboveLevelWords: string[]
  aboveLevelRatio: number
  maxAboveLevelRatio: number
  /** Đoạn dài nhất (số từ liên tiếp) trùng với bài gốc; ≥ overlapLimit là chặn. */
  overlapMaxRun: number
  overlapLimit: number
  /** Các đoạn trong BÀI MỚI bị trùng (để tô đỏ). */
  overlapSnippets: string[]
  /** id dữ kiện đã tích mà bài chưa dùng tới. */
  unusedFactIds: string[]
}

export interface DifficultyMeasured {
  /** Mỗi yếu tố 0–2: diễn đạt đáp án, vị trí bằng chứng, phương án nhiễu, ngôn ngữ câu hỏi. */
  scores: { phrasing: number; evidence: number; distractors: number; language: number }
  total: number
  level: DifficultyLevel
  /** Gợi ý khi bậc đo được khác bậc giao. */
  hint: string | null
}

export interface StudioItem {
  /** Ví dụ "LV2-6". */
  id: string
  question: string
  options: Record<OptionKey, string>
  correct: OptionKey
  explanationVi: string
  /** Câu bằng chứng trích từ BÀI MỚI. */
  evidence: string
  /** Luật bẫy (phụ lục D) dùng cho từng phương án nhiễu. */
  traps: { option: OptionKey; rule: string }[]
  difficultyTarget: DifficultyLevel
  difficultyMeasured: DifficultyMeasured | null
  locked: boolean
  light: Light | null
  /** Lý do đèn vàng/đỏ, tiếng Việt. */
  flags: string[]
}

export interface StudioCheck {
  key: string
  label: string
  light: Light
  detail: string | null
}

export type ChecklistKey =
  | 'LEVEL' | 'FORMAT' | 'SINGLE_ANSWER' | 'NEUTRAL' | 'FACTS_MATCH' | 'NO_COPY' | 'QUELLE' | 'EXPLANATION'

export interface StudioDraft {
  id: number
  examFormat: 'TELC'
  cefrLevel: string
  section: string
  teil: number
  teilType: string
  theme: string | null
  mode: 'EXAM' | 'PRACTICE'
  /** Số câu cố định của Teil (Lesen T2 = 5). */
  itemCount: number
  difficultyPlan: DifficultyPlan
  step: DraftStep
  status: DraftStatus
  busyOp: BusyOp | null
  lastError: string | null
  sources: StudioSource[]
  text: StudioText | null
  textMetrics: TextMetrics | null
  items: StudioItem[]
  checks: StudioCheck[]
  /** Máy gợi ý (true/false/null = không tự kiểm được); owner vẫn phải tích tay từng mục. */
  checklistSuggestions: Partial<Record<ChecklistKey, boolean | null>>
  reviewChecklist: Partial<Record<ChecklistKey, boolean>>
  /** Dòng "Quelle" sẽ hiện dưới bài đọc. */
  quelle: string | null
  blockId: number | null
  createdAt: string
  updatedAt: string
}

export interface StudioDraftSummary {
  id: number
  cefrLevel: string
  section: string
  teil: number
  theme: string | null
  titleDe: string | null
  step: DraftStep
  status: DraftStatus
  busyOp: BusyOp | null
  updatedAt: string
}

export interface StudioBlockSummary {
  id: number
  examFormat: string
  cefrLevel: string
  section: string
  teil: number
  theme: string | null
  titleDe: string | null
  difficultyCounts: DifficultyPlan
  reviewedBy: string | null
  reviewedAt: string
}

export interface CreateDraftBody {
  examFormat: 'TELC'
  cefrLevel: string
  section: string
  teil: number
  theme?: string | null
  mode: 'EXAM' | 'PRACTICE'
  difficultyPlan: DifficultyPlan
}

export interface PatchDraftBody {
  theme?: string | null
  mode?: 'EXAM' | 'PRACTICE'
  difficultyPlan?: DifficultyPlan
  text?: StudioText
  items?: StudioItem[]
  reviewChecklist?: Partial<Record<ChecklistKey, boolean>>
}

/** Một trong hai: url (máy tự tải) hoặc pastedText (dán tay khi có paywall). Văn bản dán KHÔNG được lưu. */
export interface AddSourceBody {
  url?: string
  pastedText?: string
  title?: string
  publisher?: string
}

const BASE = '/admin/exam-studio'

export async function listDrafts(status?: DraftStatus): Promise<StudioDraftSummary[]> {
  const res = await api.get<StudioDraftSummary[]>(`${BASE}/drafts`, { params: status ? { status } : {} })
  return res.data
}
export async function createDraft(body: CreateDraftBody): Promise<StudioDraft> {
  return (await api.post<StudioDraft>(`${BASE}/drafts`, body)).data
}
export async function getDraft(id: number): Promise<StudioDraft> {
  return (await api.get<StudioDraft>(`${BASE}/drafts/${id}`)).data
}
export async function patchDraft(id: number, body: PatchDraftBody): Promise<StudioDraft> {
  return (await api.patch<StudioDraft>(`${BASE}/drafts/${id}`, body)).data
}
export async function discardDraft(id: number): Promise<void> {
  await api.delete(`${BASE}/drafts/${id}`)
}
export async function addSource(id: number, body: AddSourceBody): Promise<StudioDraft> {
  return (await api.post<StudioDraft>(`${BASE}/drafts/${id}/sources`, body)).data
}
export async function patchSource(
  id: number, sourceId: number,
  body: { usageMode?: 'ADAPT' | 'FACTS_ONLY'; selectedFactIds?: string[] },
): Promise<StudioDraft> {
  return (await api.patch<StudioDraft>(`${BASE}/drafts/${id}/sources/${sourceId}`, body)).data
}
export async function removeSource(id: number, sourceId: number): Promise<StudioDraft> {
  return (await api.delete<StudioDraft>(`${BASE}/drafts/${id}/sources/${sourceId}`)).data
}
/** Viết cả bài (bỏ trống body) hoặc viết lại một đoạn đã bôi đen. */
export async function writeText(
  id: number,
  body: { selection?: string; mode?: 'REWRITE' | 'SIMPLIFY'; note?: string } = {},
): Promise<StudioDraft> {
  return (await api.post<StudioDraft>(`${BASE}/drafts/${id}/text`, body)).data
}
/** Sinh mọi câu chưa khoá theo difficultyPlan. */
export async function generateItems(id: number): Promise<StudioDraft> {
  return (await api.post<StudioDraft>(`${BASE}/drafts/${id}/items`, {})).data
}
export async function regenerateItem(id: number, itemId: string, difficulty?: DifficultyLevel): Promise<StudioDraft> {
  return (await api.post<StudioDraft>(`${BASE}/drafts/${id}/items/${encodeURIComponent(itemId)}/regenerate`,
    difficulty ? { difficulty } : {})).data
}
export async function verifyDraft(id: number): Promise<StudioDraft> {
  return (await api.post<StudioDraft>(`${BASE}/drafts/${id}/verify`, {})).data
}
/** Owner duyệt: mọi mục checklist phải true, không còn đèn đỏ. Trả draft (status APPROVED, blockId). */
export async function approveDraft(
  id: number, checklist: Record<ChecklistKey, boolean>,
): Promise<StudioDraft> {
  return (await api.post<StudioDraft>(`${BASE}/drafts/${id}/approve`, { checklist })).data
}
export async function listBlocks(filter: { cefrLevel?: string; section?: string; teil?: number } = {}): Promise<StudioBlockSummary[]> {
  return (await api.get<StudioBlockSummary[]>(`${BASE}/blocks`, { params: filter })).data
}
export async function getBlock(id: number): Promise<StudioBlockSummary & { content: Record<string, unknown> }> {
  return (await api.get<StudioBlockSummary & { content: Record<string, unknown> }>(`${BASE}/blocks/${id}`)).data
}

/** Mẫu nhanh cho Teil 5 câu (owner chốt 4 bậc 09/11). */
export const DIFFICULTY_PRESETS: { key: string; label: string; plan: DifficultyPlan }[] = [
  { key: 'real', label: 'Giống đề thật', plan: { EASY: 2, MEDIUM: 2, HARD: 1, EXPERT: 0 } },
  { key: 'base', label: 'Luyện nền', plan: { EASY: 3, MEDIUM: 2, HARD: 0, EXPERT: 0 } },
  { key: 'sprint', label: 'Nước rút', plan: { EASY: 1, MEDIUM: 1, HARD: 2, EXPERT: 1 } },
  { key: 'challenge', label: 'Thử thách', plan: { EASY: 0, MEDIUM: 1, HARD: 2, EXPERT: 2 } },
]

export const DIFFICULTY_LABEL: Record<DifficultyLevel, string> = {
  EASY: 'Dễ', MEDIUM: 'Vừa', HARD: 'Khó', EXPERT: 'Siêu khó',
}
