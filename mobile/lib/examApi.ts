// Mock-exam shapes, mapping + attempt/review/recommend client.
// Backend GET /api/mock-exams?cefrLevel=X returns raw snake_case rows.

import api from './api'

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

export interface ExamObjItem {
  id: string
  question: string
  passage?: string
  options?: string[] // present = MCQ; absent = true/false (richtig/falsch)
  /** Khoá A/B/C khi options gốc là object — giá trị NỘP (backend so `equalsIgnoreCase(correct)` với chữ cái). */
  optionKeys?: string[]
}

export interface ExamObjGroup {
  title: string
  /** Hướng dẫn của Teil (instruction_vi, fallback instruction_de). */
  instruction?: string
  /** Bài đọc chung của Teil (teil.text hoặc teil.context trong seed) — hiện MỘT lần đầu nhóm. */
  passage?: string
  items: ExamObjItem[]
}

export interface ParsedExam {
  groups: ExamObjGroup[]
  skippedSections: string[]
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
export interface AttemptResultDto {
  total_score?: number | null
  finished_at?: string | null
  status?: string
  passed?: boolean | null
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
 * Parse a mock-exam `sections_json` string into the renderable objective items.
 *
 * Dữ liệu tới client đã qua `ExamQuestionSanitizer` (backend, từ 06/2026): `correct` bị strip,
 * thay bằng `type` (MULTIPLE_CHOICE / RICHTIG_FALSCH / MATCHING / UNKNOWN); `options` trong seed
 * là OBJECT {A: …, B: …}. Parser cũ chỉ nhận options mảng hoặc `correct` richtig/falsch nên bóc
 * được 0 câu → mọi đề hiện "Chưa hỗ trợ trên app" (AC-MOBFIX-03, 06/09/2026).
 */
export function parseLesenItems(sectionsJson: string): ParsedExam {
  const groups: ExamObjGroup[] = []
  const skipped = new Set<string>()
  try {
    const root = JSON.parse(sectionsJson) as { sections?: Record<string, unknown>[] }
    for (const section of root.sections ?? []) {
      const name = String(section.name ?? '')
      if (name !== 'LESEN') {
        if (name) skipped.add(name)
        continue
      }
      for (const teil of asArray(section.teile)) {
        const type = String(teil.type ?? '')
        if (type.includes('AUDIO')) continue
        const teilPassage =
          typeof teil.text === 'string' ? teil.text : typeof teil.context === 'string' ? teil.context : undefined
        const instruction =
          typeof teil.instruction_vi === 'string' ? teil.instruction_vi : typeof teil.instruction_de === 'string' ? teil.instruction_de : undefined
        const title =
          typeof teil.title === 'string' ? teil.title : teil.teil != null ? `Teil ${String(teil.teil)}` : 'Đọc hiểu'
        const rawItems = Array.isArray(teil.items) ? (teil.items as Record<string, unknown>[]) : []
        const matchingPairs = parseMatchingContext(teil.context)
        let usedMatchingContext = false
        const items: ExamObjItem[] = []
        for (const it of rawItems) {
          const id = it.id != null ? String(it.id) : null
          if (!id) continue
          const question = (it.question ?? it.prompt ?? it.person) as string | undefined
          if (!question) continue
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
          const derived = String(it.type ?? '')
          const correct = typeof it.correct === 'string' ? it.correct.toLowerCase() : ''
          const isTrueFalse = derived === 'RICHTIG_FALSCH' || TF.has(correct)
          const isMatching = !options && !isTrueFalse && (derived === 'MATCHING' || typeof it.person === 'string' || /^[a-h]$/.test(correct))
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
          items.push({ id, question, passage, options, optionKeys })
        }
        if (items.length > 0) {
          // Teil ghép: context đã thành lựa chọn — không lặp lại thành bài đọc.
          groups.push({ title, instruction, passage: usedMatchingContext ? undefined : teilPassage, items })
        }
      }
    }
  } catch {
    // Malformed JSON → empty attempt; the screen shows an error state.
  }
  return { groups, skippedSections: [...skipped] }
}
