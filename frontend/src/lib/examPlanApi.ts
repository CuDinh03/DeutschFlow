import api from '@/lib/api'

/** Lộ trình đếm ngược tới ngày thi (LT3) — khớp `ExamPlanDto` của backend. */
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

export const examPlanApi = {
  get: () => api.get<ExamPlan>('/exam-plan'),
  updateTargetDate: (targetDate: string) => api.put<ExamPlan>('/exam-plan/target-date', { targetDate }),
}

export function currentWeekOf(plan: ExamPlan): ExamPlanWeek | undefined {
  return plan.weeks.find((w) => w.weekNo === plan.currentWeek)
}

/** Trang mở việc này. `null`: chưa có gì để mở (việc "Sắp có", tuần đã qua không còn đề). */
export function taskHref(task: ExamPlanTask, plan: Pick<ExamPlan, 'provider' | 'level'>): string | null {
  const provider = encodeURIComponent(plan.provider ?? '')
  const level = encodeURIComponent(plan.level ?? '')
  if (task.locked) return '/v2/student/mock-exam'
  switch (task.type) {
    case 'DIAGNOSTIC_EXAM':
    case 'FULL_EXAM':
      return task.examId == null ? null : `/v2/student/mock-exam/run?examId=${task.examId}&level=${level}`
    case 'ORAL_MOCK':
    case 'ORAL_DRILL':
      return `/v2/student/speaking/exam?provider=${provider}&level=${level}`
    case 'ROADMAP_NODES':
      return '/v2/student/roadmap'
    case 'WEAKNESS_REVIEW':
      return '/v2/student/speaking/exam/weakness'
  }
}
