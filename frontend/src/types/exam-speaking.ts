/**
 * Mảng Luyện thi Nói — hợp đồng với backend `com.deutschflow.examspeaking` (Đợt 0, PR #377).
 * Mọi đồng hồ/trạng thái là của server; client chỉ render theo snapshot.
 */
export type ExamProvider = 'GOETHE' | 'TELC'
export type ExamMode = 'DRILL' | 'MOCK'
export type ExamSessionState = 'PREP' | 'IN_PART' | 'BETWEEN' | 'DONE' | 'GRADING' | 'RESULTS' | 'GRADING_FAILED' | 'ABORTED'
export type CandidateAction = 'ASK' | 'ANSWER' | 'SPEAK' | 'REACT'

export interface BlueprintPartSummary {
  teilNo: number
  archetype: string
  title: string
  durationSec: number
  flow: string
  hasPartner: boolean
}

export interface BlueprintSummary {
  id: number
  provider: ExamProvider
  level: string
  version: number
  title: string
  prepSec: number
  parts: BlueprintPartSummary[]
  rubricScale: 'A_E' | 'A_D' | 'VHN'
  maxTotal: number
  speakingOnlyMin: number
}

export interface ExamDirective {
  teilNo: number
  title: string
  archetype: string
  stepIndex: number
  stepCount: number
  candidateAction: CandidateAction
  hintVi: string
  /** Khoá i18n ổn định của gợi ý — FE dịch theo locale; null với phiên cũ. */
  hintKey?: string | null
  stimulus: Record<string, unknown> | null
  prueferText: string | null
  prueferVoice: string | null
  lastAiRole: string | null
  lastAiText: string | null
}

export interface DrillTurnEval {
  score?: number
  feedbackVi?: string
  corrections?: { code: string; original: string; correction: string }[]
  redemittel?: string[]
  error?: string
}

/** Tài liệu chuẩn bị một Teil (chỉ phần thí sinh được xem; choiceRequired → chọn 1 trong N). */
export interface PrepMaterial {
  teilNo: number
  title: string
  archetype: string
  choiceRequired: boolean
  chosenIndex: number | null
  stimuli: Record<string, unknown>[]
}

export interface ExamSessionView {
  id: number
  provider: ExamProvider
  level: string
  mode: ExamMode
  state: ExamSessionState
  currentPart: number
  currentStep: number
  totalParts: number
  serverNow: string
  prepDeadlineAt: string | null
  prepSec: number | null
  prepMaterials: PrepMaterial[] | null
  partDeadlineAt: string | null
  directive: ExamDirective | null
  lastTurnEval: DrillTurnEval | null
  notesText: string | null
  gradingJobId: number | null
  resultAvailable: boolean
  /** true = phiên đang được ghi âm để hiệu chuẩn chấm điểm (đã có đồng ý) — UI phải nói rõ. */
  retainAudio?: boolean
}

export interface AiTurn {
  role: string
  text: string
}

export interface TurnResponse {
  transcript: string
  aiRole: string | null
  aiText: string | null
  aiVoice: string | null
  /** Mọi lượt AI sau lượt thí sinh (B1 T3: partner trả lời + giám khảo hỏi = 2). */
  aiTurns: AiTurn[] | null
  turnEval: DrillTurnEval | null
  session: ExamSessionView
}

/**
 * N1c-3: thông điệp structured backend sinh — `code` = khoá i18n dưới
 * `v2.student.examSpeaking.result.msg.*`, `params` chèn vào bản dịch.
 * Phiếu cũ (trước N1c-3) không có — FE fallback về chuỗi tiếng Việt đã lưu.
 */
export interface SheetMsg {
  code: string
  params: Record<string, string | number>
}

export interface CriterionResult {
  code: string
  label: string
  band: string | null
  points: number
  max: number
  scored: boolean
  confidence: string
  /** Trích dẫn tự do của LLM (tiếng Đức) — hiển thị nguyên văn. */
  evidence: string[]
  /** Dòng đo lường/lý do do code sinh — FE dịch theo locale (phiếu cũ: thiếu). */
  evidenceMsgs?: SheetMsg[]
}

export interface PartResult {
  teilNo: number
  criteria: CriterionResult[]
  points: number
  max: number
  zeroed: boolean
  /** N1c-2: 2 câu nhận xét của giám khảo cho Teil (null với phiếu cũ). */
  comment?: string | null
}

export interface ScoreSheet {
  rubricRef: { provider: ExamProvider; level: string; version: number }
  parts: PartResult[]
  global: CriterionResult[]
  total: number
  totalLow: number
  totalHigh: number
  maxPoints: number
  officialMax: number
  passed: boolean | null
  passRule: string
  /** N1c-3: bản structured của passRule (phiếu cũ: thiếu → hiện passRule VI). */
  passRuleMsg?: SheetMsg | null
  errors: { code: string; original: string; correction: string; severity: string; teilNo: number }[]
  notes: string[]
  /** N1c-3: bản structured của notes (phiếu cũ: thiếu → hiện notes VI). */
  noteMsgs?: SheetMsg[]
  passes: number
}

export interface ExamResultView {
  sessionId: number
  provider: ExamProvider
  level: string
  rubricVersion: number
  total: number | null
  totalLow: number | null
  totalHigh: number | null
  max: number | null
  passed: boolean | null
  scoreSheet: ScoreSheet
  createdAt: string
}

/** Một dòng transcript trong phòng thi (client giữ để render; server mới là nguồn sự thật). */
export interface RoomLine {
  id: string
  role: 'CANDIDATE' | 'PRUEFER' | 'PARTNER'
  text: string
  teilNo: number
  eval?: DrillTurnEval | null
  latencyMs?: number
}

// ── Đợt 5a: Ôn yếu điểm ───────────────────────────────────────────────────────

/** Một dạng bài mà mã lỗi từng xuất hiện (facet lọc). */
export interface WeaknessContext {
  provider: ExamProvider
  level: string
  teilNo: number
  archetype: string
  count: number
  lastSeenAt: string
}

export interface WeakPointView {
  errorCode: string
  ruleVi: string | null
  /** Số lần gặp TRONG phòng luyện thi (số chính trên UI). */
  examCount: number
  /** Số lần gặp trên mọi tính năng luyện nói (ngữ cảnh phụ). */
  totalCount: number
  openCount: number
  lastSeverity: string | null
  lastSeenAt: string
  exampleOriginal: string | null
  exampleCorrection: string | null
  contexts: WeaknessContext[]
}

export interface RedemittelPackView {
  archetype: string
  phrases: string[]
}

export interface WeaknessView {
  weakPoints: WeakPointView[]
  packs: RedemittelPackView[]
}
