/**
 * Các ngưỡng đỗ độc lập của đề nhiều cổng (telc: viết 135/225, nói 45/75).
 *
 * 🔑 **Ba trạng thái, không phải hai.** Một người đã đỗ phần viết nhưng chưa thi nói thì **chưa
 * đỗ** — nhưng cũng **không trượt**. Màn kết quả trước đây chỉ có `passed ? "Đỗ" : "Trượt"`, nên
 * người mới thi nửa kỳ thi sẽ đọc thấy chữ "Trượt" ngay dưới một bài viết gần như tuyệt đối.
 */

export interface ExamGate {
  id: string
  raw: number
  max: number
  min: number
  status: 'PASSED' | 'FAILED' | 'PENDING' | string
  sourceId?: number | null
  achievedAt?: string | null
}

export type GateVerdict = 'PASSED' | 'FAILED' | 'INCOMPLETE'

/**
 * Kết luận chung. TRƯỢT chỉ khi có cổng thật sự TRƯỢT; còn cổng nào CHỜ thì là CHƯA ĐỦ KẾT LUẬN.
 * Đề không có cổng nào (mọi đề Goethe) trả `null` để nơi gọi dùng lại đường cũ.
 */
export function gateVerdict(gates: ExamGate[] | undefined): GateVerdict | null {
  if (!gates || gates.length === 0) return null
  if (gates.some((g) => g.status === 'FAILED')) return 'FAILED'
  if (gates.every((g) => g.status === 'PASSED')) return 'PASSED'
  return 'INCOMPLETE'
}

/** Các cổng còn thiếu dữ liệu — dùng để nói thẳng học viên còn phải thi phần nào. */
export function pendingGates(gates: ExamGate[] | undefined): ExamGate[] {
  return (gates ?? []).filter((g) => g.status === 'PENDING')
}
