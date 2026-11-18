// Nháp của lượt thi thử đang dở (Đợt 4, 19/11/2026). `/mock-exams/{id}/start` trả lượt đang chạy kèm
// nháp đã lưu (có thể làm trên web). Màn giới thiệu nhận nháp và chuyển cho màn làm bài để mở ra
// đúng các câu đã trả lời — nộp bài trống sẽ chấm đè mất bài trên web.

const pending = new Map<number, Record<string, string>>()

/** `answers_json` của nháp → bản đồ câu trả lời (chỉ giữ giá trị chuỗi). Bản sinh đôi của web. */
export function parseDraftAnswers(answersJson: string | null | undefined): Record<string, string> {
  if (!answersJson) return {}
  try {
    const parsed: unknown = JSON.parse(answersJson)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string') out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

export function rememberAttemptDraft(attemptId: number, answers: Record<string, string>): void {
  if (Object.keys(answers).length > 0) pending.set(attemptId, answers)
}

/** Lấy một lần (lần mở sau của cùng lượt không nạp lại bản cũ). */
export function takeAttemptDraft(attemptId: number): Record<string, string> {
  const answers = pending.get(attemptId) ?? {}
  pending.delete(attemptId)
  return answers
}
