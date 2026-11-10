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
/**
 * a/b/c: Lesen T2, Sprachbausteine T1 · a–j: tiêu đề Lesen T1 · a–l + x: rao vặt Lesen T3 ·
 * a–o: hộp từ Sprachbausteine T2.
 */
export type OptionKey =
  | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'x'

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
  // ── Đợt 3: các Teil soạn theo tình huống. Vắng/null với Lesen T1–T2. ──
  /** Lesen T3: 12 mẩu rao vặt a–l. */
  ads?: Partial<Record<OptionKey, string>> | null
  /** Lesen T3: "01" ghép được một mẩu, "02" là x. */
  examples?: { label: string; situation: string; answer: string }[] | null
  /** Sprachbausteine T2: mẩu tin mà bức thư trả lời. (Thư nguyên vẹn của SB1/SB2 nằm ở `context`.) */
  stimulusAd?: string | null
  /** Sprachbausteine T2: hộp 15 từ a–o (10 đúng + 5 nhiễu), máy dựng khi sinh câu. */
  wordBank?: Partial<Record<OptionKey, string>> | null
  /** Schreiben: E-Mail của bạn (du). */
  stimulus?: { type: string; from: string; subject: string; body: string } | null
  /** Schreiben: đúng 4 Leitpunkte. */
  writingPoints?: string[] | null
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
  /** 3 khoá a/b/c (Teil 2) hoặc 2 khoá trong a–j (Teil 1). */
  options: Partial<Record<OptionKey, string>>
  /** Chữ đáp án; Lesen A2 T2 'richtig' | 'falsch'; ô form A2 là chữ tự do (đáp án chuẩn). */
  correct: OptionKey | 'richtig' | 'falsch' | (string & {})
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
  /**
   * Sprachbausteine: `target` (từ gốc trong thư), `before` (cụm ngay trước để định vị), `gap` (số ô 21–30 / 31–40),
   * `phenomenon` (hiện tượng ngữ pháp). Lesen T3: `question` là tình huống, `correct` là chữ a–l hoặc `x`.
   */
  meta?: Record<string, string> | null
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
  /** Tình huống admin nhập cho Teil soạn theo tình huống (đợt 3). */
  situation: string | null
  /** true = Lesen T1/T2 (bước Nguồn báo); false = soạn theo tình huống (bước "Tình huống", không có nguồn). */
  needsSources: boolean
  /** Cảnh báo chống trùng không chặn (vd. nguồn đã dùng ở Teil khác), tiếng Việt. */
  warnings: string[]
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
  situation?: string | null
}

export interface PatchDraftBody {
  theme?: string | null
  mode?: 'EXAM' | 'PRACTICE'
  difficultyPlan?: DifficultyPlan
  text?: StudioText
  items?: StudioItem[]
  reviewChecklist?: Partial<Record<ChecklistKey, boolean>>
  situation?: string | null
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

// ── Ghép bộ đề từ kho (đợt 2) ─────────────────────────────────────────────────────────────
// Đề nền = đề viết tay đang chạy; thay một số Teil bằng Teil đã duyệt trong kho ⇒ mock_exams mới
// origin STUDIO, reviewed = false ("Sắp có") tới khi bấm Phát hành. Phát hành ⇒ học viên làm được.

export interface AssemblySlot { section: string; teil: number; type: string | null }

export interface AssemblyBase {
  id: number
  title: string
  reviewed: boolean
  /** Mọi Teil của đề nền (để biết ô nào thay được). */
  slots: AssemblySlot[]
}

export interface AssemblyBlockOption {
  id: number
  titleDe: string | null
  theme: string | null
  difficultyCounts: DifficultyPlan
  /** Số bộ đề đã dùng Teil này — ít dùng xếp trước. */
  exposureCount: number
  /** Bộ đề ghép ĐANG CHẠY đã chứa Teil này (chống trùng giữa các bộ đề). */
  usedIn: { id: number; title: string }[]
}

export interface AssemblySlotBlocks {
  section: string
  teil: number
  type: string
  blocks: AssemblyBlockOption[]
}

export interface AssembledExam {
  id: number
  title: string
  cefrLevel: string
  examFormat: string
  /** false = "Sắp có" (chưa phát hành). */
  reviewed: boolean
  /** false = đã gỡ khỏi danh sách học viên. */
  active: boolean
  baseExamId: number | null
  teile: { section: string; teil: number; blockId: number }[]
  createdAt: string | null
}

export interface AssembleBody {
  baseExamId: number
  title: string
  replacements: { section: string; teil: number; blockId: number }[]
  /**
   * Mặc định false: một Teil kho chỉ nằm trong MỘT bộ đề đang chạy (backend trả 409 nếu dùng lại). Bật khi cố ý.
   * Ghép lại y hệt một bộ đã có (cùng nền, cùng Teil) luôn bị 409.
   */
  allowReuse?: boolean
}

export async function listAssemblyBases(examFormat = 'TELC', cefrLevel = 'B1'): Promise<AssemblyBase[]> {
  return (await api.get<AssemblyBase[]>(`${BASE}/assembly/bases`, { params: { examFormat, cefrLevel } })).data
}
export async function listAssemblySlots(examFormat = 'TELC', cefrLevel = 'B1'): Promise<AssemblySlotBlocks[]> {
  return (await api.get<AssemblySlotBlocks[]>(`${BASE}/assembly/slots`, { params: { examFormat, cefrLevel } })).data
}
export async function listAssembledExams(): Promise<AssembledExam[]> {
  return (await api.get<AssembledExam[]>(`${BASE}/assemblies`)).data
}
export async function assembleExam(body: AssembleBody): Promise<AssembledExam> {
  return (await api.post<AssembledExam>(`${BASE}/assemblies`, body)).data
}
export async function publishAssembledExam(examId: number): Promise<AssembledExam> {
  return (await api.post<AssembledExam>(`${BASE}/assemblies/${examId}/publish`, {})).data
}
export async function retireAssembledExam(examId: number): Promise<AssembledExam> {
  return (await api.post<AssembledExam>(`${BASE}/assemblies/${examId}/retire`, {})).data
}

// ── Ghép từ khung (đợt 4) ─────────────────────────────────────────────────────────────────
// Cấp chưa có đề viết tay làm nền (telc A2 / Start Deutsch 2): MỌI ô Teil của khung phải chọn từ kho.

export interface BlueprintSlot { section: string; teil: number; type: string }
export interface Blueprint {
  examFormat: string
  cefrLevel: string
  title: string
  descriptionVi: string
  timeLimitMinutes: number
  totalPoints: number
  passPoints: number
  sections: { name: string; labelVi: string; timeMinutes: number; maxPoints: number; slots: BlueprintSlot[] }[]
}
export interface BlueprintAssembleBody {
  examFormat: string
  cefrLevel: string
  title: string
  /** Đủ mọi ô của khung (backend trả 400 kèm danh sách ô còn thiếu). */
  replacements: { section: string; teil: number; blockId: number }[]
  allowReuse?: boolean
}

export async function listBlueprints(): Promise<Blueprint[]> {
  return (await api.get<Blueprint[]>(`${BASE}/assembly/blueprints`)).data
}
export async function assembleFromBlueprint(body: BlueprintAssembleBody): Promise<AssembledExam> {
  return (await api.post<AssembledExam>(`${BASE}/assemblies/blueprint`, body)).data
}
