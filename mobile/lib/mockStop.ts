// Dừng thi thử giữa chừng (Đợt 4e, 20/11/2026) — bản sinh đôi của web (`mock-exam/full/page.tsx` +
// `mockAttemptApi.stopAttempt` + `partialInfo`). Server (`POST /mock-exams/attempts/{id}/stop`, 07/11/2026):
// chấm theo Teil những Teil đã chạm, Viết dở không chấm, lượt thành `PARTIAL` (không đỗ/trượt), đồng hồ
// dừng. Chưa chạm câu nào ⇒ `CANCELLED` (huỷ, không vào lịch sử). Hàm thuần — jest chạy node.

import { formatPoints } from './examApi'
import { teilNameOfKey } from './mockResult'

export type StopTeilStatus = 'SCORED' | 'NOT_ATTEMPTED' | 'WRITTEN_NOT_GRADED' | string

export interface StopTeil {
  key: string
  status: StopTeilStatus
  score: number | null
  max: number | null
  answered: number
  total: number
}

export interface StopResult {
  attemptId: number
  status: 'PARTIAL' | 'CANCELLED' | 'COMPLETED' | string
  alreadyClosed: boolean
  teileDone: number | null
  teileCounted: number | null
  teileTotal: number | null
  teile: StopTeil[]
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Thân 200 của `/stop` → kết quả. Trường lạ/thiếu thì bỏ qua, không ném. */
export function parseStopResult(data: unknown): StopResult {
  const b = (data ?? {}) as Record<string, unknown>
  const teile = Array.isArray(b.teile)
    ? (b.teile as Record<string, unknown>[]).map((t) => ({
        key: typeof t.key === 'string' ? t.key : '',
        status: typeof t.status === 'string' ? t.status : 'NOT_ATTEMPTED',
        score: num(t.score),
        max: num(t.max),
        answered: num(t.answered) ?? 0,
        total: num(t.total) ?? 0,
      }))
    : []
  return {
    attemptId: num(b.attempt_id) ?? 0,
    status: typeof b.status === 'string' ? b.status : '',
    alreadyClosed: b.already_closed === true,
    teileDone: num(b.teile_done),
    teileCounted: num(b.teile_counted),
    teileTotal: num(b.teile_total),
    teile,
  }
}

/**
 * Lượt đã "Dừng giữa chừng" (dừng trên web, hoặc server tự chốt khi hết giờ lúc vắng mặt) đọc lại qua
 * `GET …/result`: `total_score` null, điểm từng Teil nằm trong `detailed_scores_json`
 * (`{partial: {…}, teile: {KEY: {status, score, max, answered, total}}}`, `MockExamPartialScoring`).
 * `null` khi chuỗi không phải dạng này.
 */
export function stopResultFromDetailed(attemptId: number, detailedJson: string | null | undefined): StopResult | null {
  if (!detailedJson) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(detailedJson)
  } catch {
    return null
  }
  const o = (parsed ?? {}) as { partial?: Record<string, unknown>; teile?: Record<string, Record<string, unknown>> }
  if (!o.partial || typeof o.partial !== 'object') return null
  const teile = Object.entries(o.teile ?? {}).map(([key, v]) => ({ key, ...(v ?? {}) }))
  return parseStopResult({
    attempt_id: attemptId,
    status: 'PARTIAL',
    already_closed: true,
    teile_done: o.partial.teile_done,
    teile_counted: o.partial.teile_counted,
    teile_total: o.partial.teile_total,
    teile,
  })
}

/** Một Teil của lượt đang thi, theo cách app đếm (câu đã chọn / tổng câu; Viết: đã viết hay chưa). */
export interface RunTeil {
  key: string
  writing: boolean
  answered: number
  total: number
}

export interface StopPreview {
  /** Teil trắc nghiệm đã chạm: được chấm. */
  counted: string[]
  /** Bài viết đã viết nhưng dừng thì không chấm. */
  writingUngraded: string[]
  /** Teil chưa chạm câu nào. */
  untouched: string[]
}

/** Trước khi dừng: Teil nào sẽ tính, Teil nào không — như hộp xác nhận của web. */
export function stopPreview(teile: readonly RunTeil[]): StopPreview {
  const out: StopPreview = { counted: [], writingUngraded: [], untouched: [] }
  for (const t of teile) {
    const name = teilNameOfKey(t.key)
    if (t.answered <= 0) out.untouched.push(name)
    else if (t.writing) out.writingUngraded.push(name)
    else out.counted.push(name)
  }
  return out
}

/** Câu trong hộp xác nhận dừng. */
export function stopPreviewMessage(p: StopPreview): string {
  const lines = [
    p.counted.length > 0 ? `Được chấm: ${p.counted.join(', ')}.` : 'Chưa Teil trắc nghiệm nào có câu trả lời.',
    p.writingUngraded.length > 0 ? `Bài viết dở không được chấm: ${p.writingUngraded.join(', ')}.` : null,
    p.untouched.length > 0 ? `Không tính: ${p.untouched.join(', ')}.` : null,
    'Lượt này ghi "Dừng giữa chừng", không tính đỗ hay trượt, và không làm tiếp được.',
  ]
  return lines.filter((x): x is string => !!x).join('\n')
}

/** Đã trả lời ít nhất một câu (Viết tính là câu) — chưa chạm thì dừng = huỷ lượt, không cần hỏi. */
export function touchedAny(answers: Record<string, string>): boolean {
  return Object.values(answers).some((v) => !!v && v.trim() !== '')
}

export interface StoppedRow {
  key: string
  name: string
  /** "12/15 điểm", "Viết dở, không chấm", "Chưa làm". */
  value: string
  counted: boolean
}

/** Hàng của màn "Đã dừng giữa chừng": Teil được chấm trước, theo thứ tự đề. */
export function stoppedRows(r: StopResult): StoppedRow[] {
  const rows = r.teile.map((t): StoppedRow => {
    const name = teilNameOfKey(t.key)
    if (t.status === 'SCORED') {
      const pts = t.score != null && t.max != null ? `${formatPoints(t.score)}/${formatPoints(t.max)} điểm` : `${t.answered}/${t.total} câu đã làm`
      return { key: t.key, name, value: pts, counted: true }
    }
    if (t.status === 'WRITTEN_NOT_GRADED') return { key: t.key, name, value: 'Viết dở, không chấm', counted: false }
    return { key: t.key, name, value: 'Chưa làm', counted: false }
  })
  return [...rows.filter((x) => x.counted), ...rows.filter((x) => !x.counted)]
}

/** Dòng tóm tắt: "Tính 3/9 Teil". */
export function stoppedSummary(r: StopResult): string {
  const counted = r.teileCounted ?? r.teile.filter((t) => t.status === 'SCORED').length
  const total = r.teileTotal ?? r.teile.length
  return total > 0 ? `Tính ${counted}/${total} Teil` : 'Đã dừng'
}
