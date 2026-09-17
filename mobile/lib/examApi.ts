// Mock-exam shapes, mapping + attempt/review/recommend client.
// Backend GET /api/mock-exams?cefrLevel=X returns raw snake_case rows.

import api from './api'
import { isWritingStimulus, orderedWritingPoints, type WritingStimulus } from '@/lib/writingTask'

export interface ExamVariant {
  id: number
  title: string
  cefrLevel: string
  totalQuestions: number
  timeLimitMinutes: number
  isRecommended?: boolean
}

export interface RawMockExam {
  id: number
  cefr_level: string
  title: string
  time_limit_minutes: number
  total_questions?: number
}

export function mapExam(e: RawMockExam): ExamVariant {
  return {
    id: e.id,
    title: e.title,
    cefrLevel: e.cefr_level,
    totalQuestions: e.total_questions ?? 0,
    timeLimitMinutes: e.time_limit_minutes,
  }
}

// ── Objective-reading attempt parsing ───────────────────────────────────────
// The full Goethe structure mixes reading, listening (audio), writing and
// speaking. The app supports the auto-scored objective LESEN items only —
// true/false and single-choice MCQ — and surfaces the rest as web-only.

/** Một lượt nói của bài nghe. `kind: 'LEAD_IN'` = câu dẫn tình huống (giọng người dẫn), hiện nhãn riêng. */
export interface AudioTurn {
  speaker?: string
  name?: string
  text: string
  kind?: 'LEAD_IN'
}

/** Giọng đọc Ansage, câu khung và câu dẫn: luôn là người dẫn (giọng giám khảo). */
export const NARRATOR_ROLE = 'PRUEFER'

export interface ExamObjItem {
  id: string
  question: string
  passage?: string
  options?: string[] // present = MCQ; absent = true/false (richtig/falsch)
  /** Khoá A/B/C khi options gốc là object — giá trị NỘP (backend so `equalsIgnoreCase(correct)` với chữ cái). */
  optionKeys?: string[]
  /** Số ô trống của câu, với hai dạng điền khuyết của telc (`___31___`). */
  gap?: number
  /** Bài nghe riêng của câu (HV Teil 1/3 telc): câu dẫn rồi bài. Vắng = câu không có audio riêng. */
  audio?: AudioTurn[]
}

/** Bốn dạng bài riêng của telc — kho lựa chọn nằm ở cấp Teil, không suy được từ từng câu. */
export const TELC_TEIL_TYPES = ['MATCH_HEADLINE', 'MATCH_AD_X', 'GAP_MC', 'GAP_WORDBANK'] as const
export type TelcTeilType = (typeof TELC_TEIL_TYPES)[number]

/** Đáp án "không mẩu rao vặt nào hợp" của Leseverstehen Teil 3 — dùng lại được. */
export const NONE_OF_THEM = 'x'

export interface ExamObjGroup {
  title: string
  /** Hướng dẫn của Teil (instruction_vi, fallback instruction_de). */
  instruction?: string
  /** Bài đọc chung của Teil (teil.text hoặc teil.context trong seed) — hiện MỘT lần đầu nhóm. */
  passage?: string
  /**
   * Bài đọc dài kiểu đề thật (LV Teil 2 telc, 17/09/2026): tiêu đề, Vorspann in đậm, thân bài
   * đánh số dòng mỗi 5 dòng theo dòng tác giả ngắt, chú thích từ khó. Vắng = dựng `passage` như cũ.
   */
  passageTitle?: string
  vorspann?: string
  passageLines?: boolean
  glossary?: { term: string; explanation: string }[]
  /** Beispiele in trước các câu (LV Teil 3: một ghép được, một `x`); không chiếm lựa chọn. */
  examples?: { label?: string; situation: string; answer: string }[]
  /** Mẩu tin mà bức thư SB Teil 2 trả lời — in ngay trên thư. */
  stimulusAd?: string
  items: ExamObjItem[]
  /** Dạng bài telc; vắng mặt = đề Goethe, dựng như cũ. */
  telcType?: TelcTeilType
  /** Kho lựa chọn dùng chung cả Teil (tiêu đề `a–j`, mẩu `a–l`, hộp từ `a–o`). */
  pool?: { key: string; label: string }[]
  /** Văn bản có ô trống đánh số. */
  gappedText?: string
  /** Cho thêm đáp án `x`. */
  allowNone?: boolean
  /** Mỗi lựa chọn chỉ dùng một lần (mặc định bật cho dạng telc). */
  singleUse?: boolean
  /** Số lần được nghe (phần Nghe). Bỏ trống = không giới hạn. */
  maxPlays?: number
  /** Kịch bản nghe: chuỗi (một giọng) hoặc mảng lượt nói (hai giọng). */
  audio?: string | AudioTurn[]
  /**
   * Nghi thức bài nghe telc (17/09/2026): Ansage nguyên văn đọc trước Teil, giây đọc câu hỏi
   * trước khi phát (30 / 60 / 0), câu khung của Teil 1. Vắng `ansage` = không có cổng (đề Goethe).
   */
  ansage?: string
  readingSeconds?: number
  framing?: string
}

/**
 * Các lượt phát của MỘT câu nghe: câu dẫn (nếu có) rồi bài. `null` khi câu không có bài riêng.
 * Bài là chuỗi thì thành một lượt với giọng `speaker` của câu — Teil 1 telc ra năm giọng xen kẽ
 * thay vì một giọng máy đọc cả năm người.
 */
export function itemAudioTurns(it: Record<string, unknown>): AudioTurn[] | null {
  const script = it.audio_script
  let body: AudioTurn[]
  if (Array.isArray(script) && script.length > 0) {
    body = (script as AudioTurn[]).filter((turn) => typeof turn?.text === 'string' && turn.text.trim())
  } else if (typeof script === 'string' && script.trim()) {
    body = [{
      speaker: typeof it.speaker === 'string' ? it.speaker : undefined,
      name: typeof it.person === 'string' ? it.person : undefined,
      text: script,
    }]
  } else {
    return null
  }
  const leadIn = typeof it.lead_in_de === 'string' ? it.lead_in_de.trim() : ''
  return leadIn ? [{ speaker: NARRATOR_ROLE, text: leadIn, kind: 'LEAD_IN' }, ...body] : body
}

/** Một nhiệm vụ viết bài (phần Viết). Khoá nộp là `email_<teil>` — hợp đồng với server. */
export interface ExamWritingTask {
  teil: number
  instruction?: string
  prompt?: string
  /**
   * Văn bản mà bài viết trả lời (đề telc 17/09/2026: E-Mail của bạn in nguyên văn). Có nó thì
   * `prompt` một dòng không in nữa. Đề Goethe không khai ⇒ undefined, dựng như cũ.
   */
  stimulus?: WritingStimulus
  /** Leitpunkte đã xáo thứ tự khi đề khai `shuffle_points` (seed lưu thứ tự hợp lý cho AI). */
  points?: string[]
  answerKey: string
}

export interface ExamSectionView {
  name: string
  label: string
  maxPoints?: number
  groups: ExamObjGroup[]
  writing: ExamWritingTask[]
}

/** Khối thời gian của đề telc (LV+SB 90′ · nghỉ 20′ · HV 30′ · SA 30′). */
export interface ExamBlock {
  id: string
  minutes: number
  sections?: string[]
}

export interface ParsedExam {
  /** Các phần dựng được, theo thứ tự trong đề. */
  sections: ExamSectionView[]
  /** Mọi nhóm câu khách quan gộp lại — giữ cho các màn/đếm cũ khỏi phải đổi. */
  groups: ExamObjGroup[]
  skippedSections: string[]
  blocks?: ExamBlock[]
}

/** Tên phần thi trong đề → tên người đọc được. Mã phần không được lộ ra giao diện. */
const SECTION_LABEL_VI: Record<string, string> = {
  LESEN: 'Đọc',
  // Phần riêng của telc. Thiếu dòng này là mã máy `SPRACHBAUSTEINE` lọt thẳng ra màn hình.
  SPRACHBAUSTEINE: 'Ngữ pháp – từ vựng',
  HOEREN: 'Nghe',
  SCHREIBEN: 'Viết',
  SPRECHEN: 'Nói',
}

/**
 * Nhãn cho những phần app không dựng được: "Nghe và Viết". Tên lạ giữ nguyên thay vì rơi ra chuỗi
 * rỗng — thà hiện một mã còn hơn nói với học viên là không thiếu gì.
 */
export function skippedSectionsLabel(names: string[]): string {
  const labels = names.map((n) => SECTION_LABEL_VI[n] ?? n)
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]
  return `${labels.slice(0, -1).join(', ')} và ${labels[labels.length - 1]}`
}

/**
 * Thân POST /mock-exams/attempts/{id}/finish.
 *
 * App chỉ dựng được phần Đọc (xem `parseLesenItems`), nên phải NÓI cho server biết những phần học
 * viên không có cơ hội làm: server loại chúng khỏi mẫu số thay vì chấm 0 — trước bản này một bài
 * làm đúng hết phần Đọc vẫn ra ~33/100 vì hai phần kia bị tính 0 điểm vào tổng.
 *
 * Không có phần nào bị bỏ thì KHÔNG thêm khoá: giữ thân cũ y nguyên cho các đề chỉ có phần Đọc.
 */
export function finishPayload(
  answers: Record<string, string>,
  parsed: ParsedExam | null,
): { answers: Record<string, string>; skippedSections?: string[] } {
  const skipped = parsed?.skippedSections ?? []
  return skipped.length > 0 ? { answers, skippedSections: skipped } : { answers }
}

// ── Attempts, review & recommendation ───────────────────────────────────────

export interface ExamAttempt {
  id: number
  exam_id: number
  exam_title: string
  started_at: string
  finished_at: string | null
  total_score: number | null
  passed: boolean | null
  status: string // IN_PROGRESS | COMPLETED
}

/**
 * Kết quả một attempt — GET /mock-exams/attempts/{id}/result. Backend trả
 * SNAKE_CASE qua @JsonProperty (ExamResultDto.java): khoá điểm là `total_score`.
 * Màn kết quả từng đọc `totalScore` (không tồn tại) nên luôn hiện 0 điểm
 * (soát 02/09, F-10a) — helper dưới đây + test khoá đúng tên khoá.
 */
/** Một ngưỡng đỗ độc lập của đề nhiều cổng (telc: viết 135/225, nói 45/75). */
export interface ExamGate {
  id: string
  raw: number
  max: number
  min: number
  status: string
  sourceId?: number | null
  achievedAt?: string | null
}

export interface AttemptResultDto {
  total_score?: number | null
  finished_at?: string | null
  status?: string
  passed?: boolean | null
  /** Vắng mặt với mọi đề Goethe (backend đánh NON_EMPTY). */
  gates?: ExamGate[]
}

export type GateVerdict = 'PASSED' | 'FAILED' | 'INCOMPLETE'

/**
 * Kết luận chung khi đề có nhiều ngưỡng. BA trạng thái, không phải hai: một người đỗ phần viết
 * nhưng chưa thi nói thì **chưa đỗ** — và cũng **không trượt**. Trả `null` với đề không có cổng
 * nào (mọi đề Goethe) để nơi gọi dùng đường cũ.
 *
 * Bản sinh đôi ở `frontend/src/components/exam/telc/examGates.ts` — hai bên phải cùng một luật.
 */
export function gateVerdict(gates: ExamGate[] | undefined): GateVerdict | null {
  if (!gates || gates.length === 0) return null
  if (gates.some((g) => g.status === 'FAILED')) return 'FAILED'
  if (gates.every((g) => g.status === 'PASSED')) return 'PASSED'
  return 'INCOMPLETE'
}

/** Tên phần của một cổng, người đọc được — mã máy không được lộ ra giao diện. */
export function gateLabel(id: string): string {
  return id === 'written' ? 'Phần viết' : id === 'oral' ? 'Phần nói' : 'Phần khác'
}

export const attemptTotalScore = (r: AttemptResultDto | null | undefined): number =>
  r?.total_score ?? 0

export interface ReviewItem {
  id: string
  question: string
  user_answer: string | null
  correct_answer: string | null
  is_correct: boolean
  explanation?: string
}

export interface ReviewSection {
  sectionName: string
  items: ReviewItem[]
}

export interface AttemptReview {
  attemptId: number
  totalScore: number
  sections: ReviewSection[]
}

export const examApi = {
  listAttempts: () => api.get<ExamAttempt[]>('/mock-exams/attempts/me').then((r) => r.data),
  getReview: (attemptId: number | string) =>
    api.get<AttemptReview>(`/mock-exams/attempts/${attemptId}/review`).then((r) => r.data),
  recommend: (cefrLevel: string) =>
    api
      .get<{ recommendedExamId: number }>('/mock-exams/recommend', { params: { cefrLevel } })
      .then((r) => r.data.recommendedExamId),
}

const TF = new Set(['richtig', 'falsch'])

function asArray(teile: unknown): Record<string, unknown>[] {
  if (Array.isArray(teile)) return teile as Record<string, unknown>[]
  if (teile && typeof teile === 'object') return Object.values(teile as object) as Record<string, unknown>[]
  return []
}

const MATCHING_FALLBACK_KEYS = ['A', 'B', 'C', 'D', 'E']

/**
 * Teil ghép (MATCH_PERSON / type=MATCHING): seed để các tin ở `teil.context` dạng
 * "A=… . B=… . C=… ." — tách thành cặp chữ cái → nội dung để render như trắc nghiệm.
 * Trả [] khi không phải định dạng này (hoặc < 2 mục).
 */
export function parseMatchingContext(context: unknown): { key: string; text: string }[] {
  if (typeof context !== 'string') return []
  const re = /(?:^|\s)([A-H])=/g
  const marks: { key: string; start: number; end: number }[] = []
  for (let m = re.exec(context); m; m = re.exec(context)) {
    marks.push({ key: m[1], start: m.index, end: m.index + m[0].length })
  }
  if (marks.length < 2) return []
  return marks.map((mark, i) => {
    const raw = context.slice(mark.end, i + 1 < marks.length ? marks[i + 1].start : undefined).trim()
    return { key: mark.key, text: raw.replace(/\.$/, '').trim() }
  })
}

/** Lựa chọn hiển thị + giá trị nộp của một câu. */
export function itemChoices(item: ExamObjItem): { value: string; label: string }[] {
  if (item.options && item.optionKeys && item.optionKeys.length === item.options.length) {
    return item.options.map((label, i) => {
      const key = item.optionKeys![i]
      return { value: key, label: label === key ? key : `${key}. ${label}` }
    })
  }
  if (item.options) return item.options.map((o) => ({ value: o, label: o }))
  return [
    { value: 'richtig', label: 'Richtig' },
    { value: 'falsch', label: 'Falsch' },
  ]
}

/**
 * Bóc `sections_json` thành những gì màn làm bài dựng được.
 *
 * <p>Dữ liệu tới client đã qua `ExamQuestionSanitizer` (backend, từ 06/2026): `correct` bị cắt,
 * thay bằng `type` (MULTIPLE_CHOICE / RICHTIG_FALSCH / MATCHING / UNKNOWN); `options` trong seed là
 * OBJECT {A: …, B: …}. Parser cũ chỉ nhận options mảng hoặc `correct` richtig/falsch nên bóc được
 * 0 câu → mọi đề hiện "Chưa hỗ trợ trên app" (AC-MOBFIX-03, 06/09/2026).
 *
 * <p><b>Từ 15/09/2026 bóc CẢ BỐN phần viết</b>, không chỉ `LESEN`. Trước đó mọi phần khác rơi vào
 * `skippedSections`, nên trên điện thoại một đề telc chỉ làm được 75 trong 225 điểm — không tài nào
 * chạm ngưỡng đỗ 135. Và riêng dạng ghép nối của telc thì còn sai lặng lẽ: kho lựa chọn nằm ở cấp
 * Teil (`headlines`/`ads`/`word_bank`) nên parser cũ không thấy, rơi xuống 5 nút chữ cái A–E mặc
 * định — sai cả số lượng, sai cả chữ, và không hiện một dòng tiêu đề nào.
 */
export function parseExamSections(sectionsJson: string): ParsedExam {
  const sections: ExamSectionView[] = []
  const skipped = new Set<string>()
  let blocks: ExamBlock[] | undefined
  try {
    const root = JSON.parse(sectionsJson) as {
      sections?: Record<string, unknown>[]
      blocks?: Record<string, unknown>[]
    }
    if (Array.isArray(root.blocks)) {
      blocks = root.blocks
        .filter((b) => typeof b.minutes === 'number')
        .map((b) => ({
          id: String(b.id ?? ''),
          minutes: Number(b.minutes),
          sections: Array.isArray(b.sections) ? b.sections.map(String) : undefined,
        }))
    }

    for (const section of root.sections ?? []) {
      const name = String(section.name ?? '')
      if (!name) continue
      if (!RENDERABLE_SECTIONS.has(name)) {
        skipped.add(name)
        continue
      }

      const groups: ExamObjGroup[] = []
      const writing: ExamWritingTask[] = []
      for (const teil of asArray(section.teile)) {
        if (name === 'SCHREIBEN') {
          const task = parseWritingTeil(teil)
          if (task) writing.push(task)
          continue
        }
        const group = parseObjectiveTeil(teil)
        if (group) groups.push(group)
      }

      if (groups.length === 0 && writing.length === 0) {
        // Phần có mặt trong đề nhưng app không dựng được câu nào — phải khai để server loại khỏi
        // mẫu số, bằng không học viên bị chấm 0 cho phần họ không có cơ hội làm.
        skipped.add(name)
        continue
      }
      sections.push({
        name,
        label: SECTION_LABEL_VI[name] ?? name,
        maxPoints: typeof section.max_points === 'number' ? section.max_points : undefined,
        groups,
        writing,
      })
    }
  } catch {
    // JSON hỏng → bài rỗng; màn hình hiện trạng thái lỗi.
  }
  return {
    sections,
    groups: sections.flatMap((sec) => sec.groups),
    skippedSections: [...skipped],
    blocks,
  }
}

/** Các phần app dựng được. `SPRECHEN` vẫn nằm ngoài: cần thu âm, thuộc module luyện thi nói. */
const RENDERABLE_SECTIONS = new Set(['LESEN', 'SPRACHBAUSTEINE', 'HOEREN', 'SCHREIBEN'])

/** Tương thích ngược — tên cũ, trả về cùng một thứ. */
export const parseLesenItems = parseExamSections

function telcTypeOf(teil: Record<string, unknown>): TelcTeilType | null {
  const raw = String(teil.type ?? '')
  return (TELC_TEIL_TYPES as readonly string[]).includes(raw) ? (raw as TelcTeilType) : null
}

/** Kho lựa chọn dùng chung cả Teil, xếp theo thứ tự chữ cái để đối chiếu được với đề giấy. */
function teilPool(teil: Record<string, unknown>): { key: string; label: string }[] | undefined {
  const source = (teil.headlines ?? teil.ads ?? teil.word_bank) as Record<string, unknown> | undefined
  if (!source || typeof source !== 'object') return undefined
  const entries = Object.entries(source)
  if (entries.length === 0) return undefined
  return entries
    .map(([key, label]) => ({ key, label: String(label) }))
    .sort((a, b) => a.key.localeCompare(b.key, 'de'))
}

/** Số ô trống: ưu tiên khoá `gap`, thiếu thì lấy cụm số cuối của `id` (`SB2-31` ⇒ 31). */
function gapNumber(it: Record<string, unknown>): number | undefined {
  if (typeof it.gap === 'number') return it.gap
  const tail = /(\d+)\s*$/.exec(String(it.id ?? ''))
  return tail ? Number(tail[1]) : undefined
}

function parseWritingTeil(teil: Record<string, unknown>): ExamWritingTask | null {
  const teilNo = typeof teil.teil === 'number' ? teil.teil : null
  if (teilNo == null) return null
  // Teil điền form chưa dựng trên app — khoá nộp khác (`form_<i>`) và bố cục khác hẳn.
  if (Array.isArray(teil.form_fields) && teil.form_fields.length > 0) return null
  const prompt = typeof teil.prompt === 'string' ? teil.prompt
    : typeof teil.input_email === 'string' ? teil.input_email : undefined
  const stimulus = isWritingStimulus(teil.stimulus)
    ? {
        type: typeof teil.stimulus.type === 'string' ? teil.stimulus.type : undefined,
        from: typeof teil.stimulus.from === 'string' ? teil.stimulus.from : undefined,
        subject: typeof teil.stimulus.subject === 'string' ? teil.stimulus.subject : undefined,
        body: teil.stimulus.body,
      }
    : undefined
  const rawPoints = Array.isArray(teil.writing_points) ? teil.writing_points.map(String) : undefined
  return {
    teil: teilNo,
    instruction: typeof teil.instruction_vi === 'string' ? teil.instruction_vi
      : typeof teil.instruction_de === 'string' ? teil.instruction_de : undefined,
    prompt,
    stimulus,
    points: rawPoints ? orderedWritingPoints(rawPoints, teil.shuffle_points === true) : undefined,
    answerKey: `email_${teilNo}`,
  }
}

function parseObjectiveTeil(teil: Record<string, unknown>): ExamObjGroup | null {
  const telcType = telcTypeOf(teil)
  const pool = teilPool(teil)
  const teilPassage =
    typeof teil.text === 'string' ? teil.text : typeof teil.context === 'string' ? teil.context : undefined
  const instruction =
    typeof teil.instruction_vi === 'string' ? teil.instruction_vi
      : typeof teil.instruction_de === 'string' ? teil.instruction_de : undefined
  const title =
    typeof teil.title === 'string' ? teil.title : teil.teil != null ? `Teil ${String(teil.teil)}` : 'Bài tập'
  const rawItems = Array.isArray(teil.items) ? (teil.items as Record<string, unknown>[]) : []
  const matchingPairs = parseMatchingContext(teil.context)
  let usedMatchingContext = false
  const items: ExamObjItem[] = []

  for (const it of rawItems) {
    const id = it.id != null ? String(it.id) : null
    if (!id) continue
    let options: string[] | undefined
    let optionKeys: string[] | undefined
    if (Array.isArray(it.options)) {
      options = it.options.map(String)
    } else if (it.options && typeof it.options === 'object') {
      const entries = Object.entries(it.options as Record<string, unknown>)
      if (entries.length > 0) {
        optionKeys = entries.map(([k]) => k)
        options = entries.map(([, v]) => String(v))
      }
    }

    // Dạng telc: kho lựa chọn của CẢ TEIL, không suy từ từng câu.
    if (telcType && !options && pool) {
      optionKeys = pool.map((o) => o.key)
      options = pool.map((o) => o.label)
    }

    const question = (it.question ?? it.prompt ?? it.person) as string | undefined
    // Câu của hai dạng điền khuyết thường không có đề bài riêng — số ô trống chính là nhãn.
    const gap = gapNumber(it)
    const label = question ?? (gap != null ? `Ô trống ${gap}` : undefined)
    if (!label) continue

    const derived = String(it.type ?? '')
    const correct = typeof it.correct === 'string' ? it.correct.toLowerCase() : ''
    const isTrueFalse = derived === 'RICHTIG_FALSCH' || TF.has(correct)
    const isMatching =
      !telcType && !options && !isTrueFalse &&
      (derived === 'MATCHING' || typeof it.person === 'string' || /^[a-h]$/.test(correct))
    if (isMatching) {
      if (matchingPairs.length >= 2) {
        optionKeys = matchingPairs.map((pr) => pr.key)
        options = matchingPairs.map((pr) => pr.text)
        usedMatchingContext = true
      } else {
        optionKeys = [...MATCHING_FALLBACK_KEYS]
        options = [...MATCHING_FALLBACK_KEYS]
      }
    }
    if (!options && !isTrueFalse) continue // viết / tự luận: chưa hỗ trợ trên app
    const passage = typeof it.text === 'string' ? it.text : undefined
    const audio = itemAudioTurns(it) ?? undefined
    items.push({ id, question: label, passage, options, optionKeys, gap, audio })
  }

  if (items.length === 0) return null
  const audio = teil.audio_script
  const glossaryRaw = Array.isArray(teil.glossary) ? (teil.glossary as Record<string, unknown>[]) : []
  const glossary = glossaryRaw
    .filter((g) => typeof g?.term === 'string' && typeof g?.explanation_de === 'string')
    .map((g) => ({ term: String(g.term), explanation: String(g.explanation_de) }))
  const examplesRaw = Array.isArray(teil.examples) ? (teil.examples as Record<string, unknown>[]) : []
  const examples = examplesRaw
    .filter((e) => typeof e?.situation === 'string' && typeof e?.answer === 'string')
    .map((e) => ({ label: typeof e.label === 'string' ? e.label : undefined, situation: String(e.situation), answer: String(e.answer) }))
  return {
    title,
    instruction,
    // Teil ghép: context đã thành lựa chọn — không lặp lại thành bài đọc.
    passage: usedMatchingContext ? undefined : teilPassage,
    passageTitle: typeof teil.title_de === 'string' ? teil.title_de : undefined,
    vorspann: typeof teil.vorspann_de === 'string' && teil.vorspann_de.trim() ? teil.vorspann_de : undefined,
    passageLines: teil.context_lines === true,
    glossary: glossary.length > 0 ? glossary : undefined,
    examples: examples.length > 0 ? examples : undefined,
    stimulusAd: typeof teil.stimulus_ad === 'string' && teil.stimulus_ad.trim() ? teil.stimulus_ad : undefined,
    items,
    telcType: telcType ?? undefined,
    pool,
    gappedText: typeof teil.gapped_text === 'string' ? teil.gapped_text : undefined,
    allowNone: teil.allow_none === true || telcType === 'MATCH_AD_X',
    singleUse: telcType != null && teil.single_use !== false,
    maxPlays: typeof teil.max_plays === 'number' ? teil.max_plays : undefined,
    audio: typeof audio === 'string' || Array.isArray(audio)
      ? (audio as ExamObjGroup['audio'])
      : undefined,
    ansage: typeof teil.ansage_de === 'string' && teil.ansage_de.trim() ? teil.ansage_de.trim() : undefined,
    readingSeconds:
      typeof teil.reading_seconds === 'number' && Number.isFinite(teil.reading_seconds) && teil.reading_seconds > 0
        ? Math.round(teil.reading_seconds) : 0,
    framing: typeof teil.framing_de === 'string' && teil.framing_de.trim() ? teil.framing_de.trim() : undefined,
  }
}
