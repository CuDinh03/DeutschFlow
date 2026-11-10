/**
 * Phép thuần của thi thử trọn đề trong giao diện luyện đề mới (06/11/2026). Không gọi API.
 */
import { formProgress, parseStructure, wordCount, type PracticeTeilData } from './practiceModel'

/** Phần thi chạy trong giao diện mới, theo thứ tự đề telc. Sprechen thi ở phòng thi nói AI riêng. */
export const FULL_SECTIONS = ['LESEN', 'SPRACHBAUSTEINE', 'HOEREN', 'SCHREIBEN'] as const

export interface FullTeil {
  /** `TÊN_PHẦN-số`, giống khoá của chế độ luyện và của `/analysis`. */
  key: string
  section: string
  /** Vị trí của phần trong `sections` của đề — server lưu nháp theo chỉ số này (tương thích mobile). */
  sectionIndex: number
  no: number
  data: PracticeTeilData
}

export function fullTeile(sectionsJson: string | null | undefined): FullTeil[] {
  const out: FullTeil[] = []
  const sections = parseStructure(sectionsJson).sections ?? []
  sections.forEach((sec, sectionIndex) => {
    const name = sec.name ?? ''
    if (!(FULL_SECTIONS as readonly string[]).includes(name)) return
    for (const teil of sec.teile ?? []) {
      const no = teil.teil ?? 1
      out.push({ key: `${name}-${no}`, section: name, sectionIndex, no, data: teil })
    }
  })
  return out
}

/** Khoá bài Viết server đọc (`ExamScoringService.writingAnswer`). */
export function writingKey(no: number): string {
  return `email_${no}`
}

/** Số câu đã làm / tổng số câu của một Teil. Bài Viết: 1 khi đã có chữ. */
export function teilProgress(teil: FullTeil, answers: Record<string, string>): { done: number; total: number } {
  // telc A2 Schreiben Teil 1: form nhiều ô, mỗi ô một câu.
  if (teil.section === 'SCHREIBEN' && teil.data.type === 'FILL_FORM') return formProgress(teil.data, answers)
  if (teil.section === 'SCHREIBEN') {
    return { done: wordCount(answers[writingKey(teil.no)] ?? '') > 0 ? 1 : 0, total: 1 }
  }
  const items = teil.data.items ?? []
  return { done: items.filter((it) => !!answers[it.id]).length, total: items.length }
}

export function unansweredCount(teile: FullTeil[], answers: Record<string, string>): number {
  return teile.reduce((sum, t) => {
    const p = teilProgress(t, answers)
    return sum + (p.total - p.done)
  }, 0)
}

/** Teil đầu tiên của phần đã lưu trong nháp — chỗ làm tiếp khi mở lại. */
export function resumeIndex(teile: FullTeil[], sectionIndex: number): number {
  const at = teile.findIndex((t) => t.sectionIndex === sectionIndex)
  return at >= 0 ? at : 0
}
