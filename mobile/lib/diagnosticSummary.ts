// Số liệu màn kết quả bài chẩn đoán (mẫu iOS `diagres`, Đợt 4c, 19/11/2026) — chỉ tính từ dữ liệu có sẵn:
// phần trăm từng kỹ năng của `/exam-diagnostic` và lịch ôn `/exam-plan` (như web `DiagnosticResult`).

import type { ExamPlan } from './examPlanApi'

export const DIAG_PASS_PCT = 60

export interface SkillStats {
  /** Trung bình các kỹ năng đã có điểm, làm tròn. `null` nếu chưa có kỹ năng nào. */
  average: number | null
  /** Số kỹ năng đạt mức đỗ 60%. */
  passed: number
  /** Số kỹ năng có điểm. */
  scored: number
}

export function skillStats(skills: Partial<Record<string, number>>): SkillStats {
  const values = Object.values(skills).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (values.length === 0) return { average: null, passed: 0, scored: 0 }
  const average = Math.round(values.reduce((s, v) => s + v, 0) / values.length)
  return { average, passed: values.filter((v) => v >= DIAG_PASS_PCT).length, scored: values.length }
}

export interface PlanSummary {
  weeks: number
  /** Phút mỗi ngày (phút mỗi tuần / 7, như web). `null` nếu lịch không ghi. */
  daily: number | null
  /** Số lần thi thử trọn đề trong lịch (kể cả bài chẩn đoán). */
  mocks: number
}

/** Lịch ôn đang chạy có số tuần ⇒ tóm tắt; không thì `null` (màn hiện câu chung chung). */
export function planSummary(plan: ExamPlan | null | undefined): PlanSummary | null {
  if (!plan || plan.status !== 'ACTIVE' || !plan.totalWeeks) return null
  const mocks = plan.weeks.flatMap((w) => w.tasks).filter((t) => t.type === 'FULL_EXAM' || t.type === 'DIAGNOSTIC_EXAM').length
  const daily = plan.weeklyMinutes ? Math.round(plan.weeklyMinutes / 7) : null
  return { weeks: plan.totalWeeks, daily, mocks }
}

/** "10 tuần · 30 phút mỗi ngày · 3 lần thi thử" — phần thiếu thì bỏ. */
export function planLine(s: PlanSummary): string {
  const parts = [`${s.weeks} tuần`]
  if (s.daily != null) parts.push(`${s.daily} phút mỗi ngày`)
  if (s.mocks > 0) parts.push(`${s.mocks} lần thi thử`)
  return parts.join(' · ')
}
