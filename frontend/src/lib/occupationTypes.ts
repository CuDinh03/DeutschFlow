/**
 * Kiểu dữ liệu danh mục nghề công khai (`GET /api/public/occupations`, `/{code}`) — đợt 2a–2d A+B+E.
 * Module thuần (không import axios hay Next) để dùng được ở trang server lẫn component client.
 */

export type Workplace = 'gastro' | 'pflege' | 'bau' | 'industrie' | 'logistik' | 'handel' | 'buero' | 'bildung'

export const WORKPLACES: readonly Workplace[] = [
  'gastro', 'pflege', 'bau', 'industrie', 'logistik', 'handel', 'buero', 'bildung',
]

export interface OccupationSummary {
  code: string
  nameDe: string
  nameEn: string
  nameVi: string
  workplace: Workplace
  aliases: string[]
  /** CURATED = có bộ câu hỏi viết tay của nhân vật; GENERAL = bộ chung (+ lớp nghề nếu đã sinh). */
  questionSet: 'CURATED' | 'GENERAL'
}

/**
 * Câu tiếng Đức kèm bản dịch (K4). Bản dịch tuỳ chọn: câu lớp nghề sinh trước V339 chưa dịch bù, và
 * backend cũ chưa trả hai trường này.
 */
export interface QuestionText {
  questionDe: string
  questionVi?: string | null
  questionEn?: string | null
}

/** Bản dịch hiện dưới câu tiếng Đức theo ngôn ngữ trang: vi → Việt, en → Anh, de → không có. */
export function questionTranslation(q: QuestionText, locale: string): string | null {
  if (locale === 'de') return null
  const text = locale === 'en' ? q.questionEn : q.questionVi
  return text?.trim() ? text : null
}

/** BANK = câu thuộc bộ câu hỏi của nhân vật; APPROVED / AI_GENERATED = câu lớp nghề. */
export type QuestionSource = 'BANK' | 'APPROVED' | 'AI_GENERATED'
export type ContentStatus = 'APPROVED' | 'AI_GENERATED'

export interface OccupationDetail {
  occupation: OccupationSummary
  /** Mã SpeakingPersona — nhân vật sẽ phỏng vấn nghề này. */
  personaCode: string
  interviewPosition: string
  sampleQuestions: ({ phase: string; source: QuestionSource } & QuestionText)[]
  /** Có bộ viết tay hoặc ≥3 câu lớp nghề đã duyệt — chỉ khi đó trang nghề được lập chỉ mục. */
  reviewed: boolean
  occupationQuestions: ({ difficulty: string; status: ContentStatus } & QuestionText)[]
  terms: { termDe: string; meaningEn: string; meaningVi: string; exampleDe: string | null; status: ContentStatus }[]
}

/** Nhãn chất lượng của một câu: bộ viết tay và câu đã duyệt là "Đã duyệt"; bộ chung là "Bộ chung". */
export function questionLabel(source: QuestionSource, questionSet: OccupationSummary['questionSet']):
  'approved' | 'aiGenerated' | 'general' {
  if (source === 'AI_GENERATED') return 'aiGenerated'
  if (source === 'APPROVED') return 'approved'
  return questionSet === 'CURATED' ? 'approved' : 'general'
}

/** Tên nghề theo ngôn ngữ trang (tiếng Đức hiện tên tiếng Đức). */
export function occupationName(o: Pick<OccupationSummary, 'nameDe' | 'nameEn' | 'nameVi'>, locale: string): string {
  if (locale === 'en') return o.nameEn
  if (locale === 'de') return o.nameDe
  return o.nameVi
}

/** Mã nghề hợp lệ trên URL (khớp cột `occupation.code`). */
export function isOccupationCode(v: string): boolean {
  return /^[a-z0-9_]{1,64}$/.test(v)
}

/** So khớp không phân biệt hoa thường, dấu tiếng Việt và umlaut tiếng Đức. */
export function foldText(s: string): string {
  // Khối dấu kết hợp U+0300–U+036F sau NFD; "đ" không tách dấu nên thay tay.
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
}

/** Tìm nghề theo tên Đức/Việt/Anh và tên gọi khác; giữ thứ tự danh mục (nghề phổ biến trước). */
export function searchOccupations(list: OccupationSummary[], query: string, limit: number): OccupationSummary[] {
  const q = foldText(query.trim())
  if (!q) return []
  return list
    .filter((o) => [o.nameDe, o.nameVi, o.nameEn, ...o.aliases].some((f) => foldText(f).includes(q)))
    .slice(0, limit)
}
