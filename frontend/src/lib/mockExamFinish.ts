/**
 * 409 `ATTEMPT_NOT_IN_PROGRESS` của `POST /mock-exams/attempts/{id}/finish` (PR 704): lượt thi đã
 * được nộp và chấm — bấm nộp hai lần, nộp ở tab khác, hoặc tự nộp khi hết giờ chạy trước. Đó KHÔNG
 * phải lỗi để học viên nộp lại: kết quả đã có, client đọc `/result` và hiện luôn.
 */
export function isAttemptAlreadyFinished(err: unknown): boolean {
  const res = (err as { response?: { status?: number; data?: { error?: string } } } | null)?.response
  return res?.status === 409 && res.data?.error === 'ATTEMPT_NOT_IN_PROGRESS'
}
