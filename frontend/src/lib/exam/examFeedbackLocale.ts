/**
 * Chọn nhận xét AI của bài viết theo ngôn ngữ giao diện.
 *
 * `AiExamEvaluatorService` (backend) sinh SONG SONG hai bản cho mỗi bài email:
 * `feedback_vi` và `feedback_de`. Web trước đây luôn đọc `feedback_vi`, nên học
 * viên xem giao diện tiếng Đức vẫn nhận đoạn nhận xét tiếng Việt dù bản tiếng
 * Đức đã có sẵn trong cùng payload.
 *
 * Luật chọn (chỉ có hai bản trong dữ liệu, không bịa thêm ngôn ngữ):
 *  · `de` → bản tiếng Đức; rỗng hoặc thiếu thì rơi về bản tiếng Việt.
 *  · `vi` và mọi locale khác (`en`) → bản tiếng Việt; rỗng thì rơi về bản tiếng Đức.
 *
 * Giao diện tiếng Anh giữ nguyên hành vi cũ (bản tiếng Việt) vì backend không
 * sinh bản tiếng Anh — đổi sang tiếng Đức ở đó sẽ là hồi quy với người học Việt
 * đang để giao diện tiếng Anh.
 */
export interface LocalizedExamFeedback {
  feedback_vi?: string | null
  feedback_de?: string | null
}

function nonEmpty(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? value ?? undefined : undefined
}

export function pickExamFeedback(
  evaluation: LocalizedExamFeedback | null | undefined,
  locale: string,
): string | undefined {
  if (!evaluation) return undefined
  const vi = nonEmpty(evaluation.feedback_vi)
  const de = nonEmpty(evaluation.feedback_de)
  return locale === 'de' ? de ?? vi : vi ?? de
}
