/**
 * Ngân sách lượt nghe của một Teil (đề telc: HV Teil 1 nghe MỘT lần, Teil 2–3 hai lần).
 *
 * Tách riêng khỏi giao diện để kiểm được bằng test, và để web/app cùng một luật:
 * bản sinh đôi ở `frontend/src/components/exam/audioScript.ts`.
 */

/** `null` = không giới hạn (mọi đề Goethe, và màn xem lại sau khi nộp). */
export function playsLeft(max: number | undefined, used: number): number | null {
  if (typeof max !== 'number' || !Number.isFinite(max) || max <= 0) return null
  return Math.max(0, max - used)
}

export function canPlayAgain(max: number | undefined, used: number): boolean {
  const left = playsLeft(max, used)
  return left === null || left > 0
}
