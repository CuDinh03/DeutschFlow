// Lộ trình đếm ngược tới ngày thi (LT3) — khớp `ExamPlanDto` của backend; bản sinh đôi của
// `frontend/src/lib/examPlanApi.ts`, kèm chữ tiếng Việt vì mobile chưa có catalog dịch.

import api from './api'
import type { Href } from 'expo-router'
import { budgetPartLabel } from './examApi'
import { PAYWALL_ENABLED } from './paywall'

export type ExamPlanStatus = 'ACTIVE' | 'NEEDS_DATE' | 'EXAM_PASSED' | 'UNAVAILABLE'
export type ExamPlanPhase = 'ROADMAP' | 'FOUNDATION' | 'TEIL' | 'FULL'
export type ExamPlanTaskType =
  | 'DIAGNOSTIC_EXAM'
  | 'FULL_EXAM'
  | 'ORAL_MOCK'
  | 'ORAL_DRILL'
  | 'ROADMAP_NODES'
  | 'WEAKNESS_REVIEW'

export interface ExamPlanTask {
  type: ExamPlanTaskType
  teil?: number
  target: number
  doneCount: number
  done: boolean
  /** `false`: việc gợi ý hoặc "Sắp có", không vào tiến độ tuần. */
  counted: boolean
  locked: boolean
  comingSoon: boolean
  examId?: number
  examTitle?: string
}

export interface ExamPlanFocus {
  section: string
  teil: number
}

export interface ExamPlanWeek {
  weekNo: number
  startDate: string
  endDate: string
  phase: ExamPlanPhase
  focus: ExamPlanFocus[]
  tasks: ExamPlanTask[]
  doneTasks: number
  totalTasks: number
}

export interface ExamPlan {
  status: ExamPlanStatus
  provider?: string
  level?: string
  targetDate?: string
  daysLeft?: number
  totalWeeks?: number
  currentWeek?: number
  weeklyMinutes?: number
  warnings: string[]
  weeks: ExamPlanWeek[]
}

export const EXAM_PLAN_QUERY_KEY = ['exam-plan'] as const

export const examPlanApi = {
  get: () => api.get<ExamPlan>('/exam-plan').then((r) => r.data),
  updateTargetDate: (targetDate: string) =>
    api.put<ExamPlan>('/exam-plan/target-date', { targetDate }).then((r) => r.data),
}

export function currentWeekOf(plan: ExamPlan): ExamPlanWeek | undefined {
  return plan.weeks.find((w) => w.weekNo === plan.currentWeek)
}

export const PHASE_LABEL: Record<ExamPlanPhase, string> = {
  ROADMAP: 'Theo lộ trình',
  FOUNDATION: 'Nền',
  TEIL: 'Luyện từng Teil',
  FULL: 'Đề full',
}

export const PHASE_HINT: Record<ExamPlanPhase, string> = {
  ROADMAP: 'Ngày thi còn xa, nên tuần này học theo lộ trình thường. Kế hoạch thi bắt đầu ở 18 tuần cuối.',
  FOUNDATION: 'Củng cố ngữ pháp trên lộ trình và làm quen từng dạng bài.',
  TEIL: 'Tập trung vào Teil nặng điểm và đang yếu.',
  FULL: 'Mỗi tuần một đề full bấm giờ và một phiên thi Nói, rồi xem lại theo ngân sách điểm.',
}

export function taskLabel(task: ExamPlanTask): string {
  switch (task.type) {
    case 'DIAGNOSTIC_EXAM':
      return 'Làm đề chẩn đoán'
    case 'FULL_EXAM':
      return 'Làm một đề full bấm giờ'
    case 'ORAL_MOCK':
      return 'Thi thử Nói trọn bài'
    case 'ORAL_DRILL':
      return `Luyện Nói Teil ${task.teil ?? ''}`.trim()
    case 'ROADMAP_NODES':
      return `Hoàn thành ${task.target} bài trên lộ trình`
    case 'WEAKNESS_REVIEW':
      return 'Ôn yếu điểm và Redemittel'
  }
}

export function taskMeta(task: ExamPlanTask): string {
  if (task.comingSoon) return 'Đề full tiếp theo sắp có, tuần này tập trung vào phiên thi Nói và Teil yếu.'
  if (!task.counted) return 'Gợi ý, không tính vào tiến độ'
  if (task.examTitle) return task.examTitle
  return `${Math.min(task.doneCount, task.target)}/${task.target}`
}

export const focusLabel = (focus: ExamPlanFocus): string => `${budgetPartLabel(focus.section)} · Teil ${focus.teil}`

export function warningText(code: string, weeklyMinutes: number | undefined): string | null {
  if (code === 'LOW_WEEKLY_TIME') {
    return `Tuần đề full cần khoảng 3 giờ, còn nhịp hiện tại là ${weeklyMinutes ?? 0} phút mỗi tuần. Hãy dành thêm thời gian cho các tuần đó.`
  }
  if (code === 'LEVEL_GAP') {
    return 'Khoảng cách từ trình độ hiện tại tới mục tiêu khá lớn so với thời gian còn lại. Hãy cân nhắc thêm giờ học hoặc dời ngày thi.'
  }
  return null
}

/** Màn mở việc này. `null`: chưa có gì để mở, hoặc bản phát hành này không có lối nâng cấp trong app. */
export function taskRoute(task: ExamPlanTask, plan: Pick<ExamPlan, 'provider' | 'level'>): Href | null {
  if (task.comingSoon) return null
  if (task.locked) return PAYWALL_ENABLED ? '/(student)/upgrade' : null
  switch (task.type) {
    case 'DIAGNOSTIC_EXAM':
    case 'FULL_EXAM':
      return task.examId == null ? null : { pathname: '/(student)/exam', params: { level: plan.level ?? '' } }
    case 'ORAL_MOCK':
    case 'ORAL_DRILL':
      return { pathname: '/(student)/speaking-exam', params: { provider: plan.provider ?? '', level: plan.level ?? '' } }
    case 'ROADMAP_NODES':
      return '/(student)/lernweg'
    case 'WEAKNESS_REVIEW':
      return '/(student)/speaking-exam-weakness'
  }
}

/** `yyyy-mm-dd` → `dd/mm/yyyy`. */
export function displayDate(iso: string | undefined): string {
  const parts = (iso ?? '').split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : ''
}

/**
 * Ô nhập ngày thi bằng tay: bộ chọn lịch cần thư viện native, sẽ làm đổi fingerprint và không đi
 * được qua OTA. Backend vẫn kiểm lại ngày có nằm trong khoảng hợp lý không.
 */
export function parseExamDate(text: string): { iso: string } | { error: string } {
  const match = text.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (!match) return { error: 'Hãy nhập ngày theo dạng ngày/tháng/năm, ví dụ 15/03/2027.' }
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(year, month - 1, day)
  // Date tự tràn 31/02 sang tháng sau, nên phải so lại từng phần.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return { error: 'Ngày này không có trong lịch.' }
  }
  return { iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` }
}
