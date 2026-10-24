/**
 * "Ngân sách điểm" của đề nhiều cổng (LT1, 22/10/2026) — khối `budget` của
 * `GET /mock-exams/attempts/{id}/result`. Backend tính sẵn; ở đây chỉ có kiểu + vài hàm thuần cho
 * phần hiển thị. Đề Goethe không có khối này.
 */

export interface TeilLoss {
  section: 'LESEN' | 'SPRACHBAUSTEINE' | 'HOEREN' | 'SCHREIBEN' | 'SPRECHEN' | string
  /** Vắng mặt khi cả phần là một dòng (Viết, Nói). */
  teil?: number
  max: number
  earned?: number
  lost?: number
  pointPerItem?: number
  items?: number
  correct?: number
  pending: boolean
}

export interface SectionShare {
  section: string
  max: number
  maxLoss: number
}

export interface GradeTarget {
  grade: 'SEHR_GUT' | 'GUT' | 'BEFRIEDIGEND' | 'AUSREICHEND' | string
  minPoints: number
  maxLoss: number
  /** maxLoss − lost; âm = đã vượt ngân sách. */
  remaining: number
  example: SectionShare[]
}

export interface ExamBudget {
  totalMax: number
  earned: number
  lost: number
  pending: boolean
  /** Teil mất nhiều điểm nhất đứng đầu; phần chưa chấm ở cuối. */
  losses: TeilLoss[]
  /** Cao → thấp; rỗng khi đề chưa có bảng xếp loại. */
  targets: GradeTarget[]
}

/**
 * Mục tiêu chọn sẵn: mức cao nhất bài này còn trong ngân sách (cho người học thấy mình đang đứng ở
 * đâu); vượt hết thì mức thấp nhất (đậu) — mục tiêu trước mắt.
 */
export function defaultTarget(targets: GradeTarget[]): string | null {
  if (targets.length === 0) return null
  return (targets.find((t) => t.remaining >= 0) ?? targets[targets.length - 1]).grade
}

/** Khoảng cách tới ngưỡng của một cổng đã có điểm: dương = dư, âm = thiếu. */
export function gateMargin(gate: { raw: number; min: number; status: string }): number | null {
  if (gate.status === 'PENDING') return null
  return gate.raw - gate.min
}
