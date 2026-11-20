// Biểu đồ điểm các lượt thi thử của một đề (màn Đề, mẫu iOS `set`, Đợt 4c, 19/11/2026): phần viết của
// tối đa 6 lượt nộp đủ gần nhất, xếp cũ → mới, vạch đỗ 60%. Lượt dừng giữa chừng không vào biểu đồ (điểm
// thiếu phần, so với lượt đủ là lệch).

import type { ExamAttempt } from './examApi'

export const CHART_PASS_PCT = 60
export const CHART_MAX_BARS = 6

export interface ScoreBar {
  id: number
  pct: number
  /** dd/MM */
  label: string
  passed: boolean
  /** Lượt mới nhất (cột cuối). */
  latest: boolean
}

function ddMm(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-')
  return d && m ? `${d}/${m}` : ''
}

export function scoreBars(attempts: readonly ExamAttempt[], examId: number, max: number, limit = CHART_MAX_BARS): ScoreBar[] {
  if (!(max > 0)) return []
  const done = attempts
    .filter((a) => a.exam_id === examId && a.status === 'COMPLETED' && a.total_score != null)
    .sort((a, b) => (a.finished_at ?? a.started_at).localeCompare(b.finished_at ?? b.started_at))
    .slice(-limit)
  return done.map((a, i) => {
    const pct = Math.max(0, Math.min(100, Math.round(((a.total_score as number) / max) * 100)))
    return { id: a.id, pct, label: ddMm(a.finished_at ?? a.started_at), passed: pct >= CHART_PASS_PCT, latest: i === done.length - 1 }
  })
}
