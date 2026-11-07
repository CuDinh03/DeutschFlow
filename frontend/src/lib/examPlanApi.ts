import api from '@/lib/api'

/**
 * Lộ trình đếm ngược tới ngày thi (LT3) — khớp `ExamPlanDto` của backend. Đợt (d) làm mới Luyện thi
 * (07/11/2026): tuần hiện tại có thêm `days` (mỗi ngày một buổi), học viên đổi chỗ được buổi chưa làm.
 */
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

export type ExamPlanDayKind = 'TEIL' | 'FULL_EXAM' | 'ORAL_MOCK' | 'ORAL_DRILL' | 'ROADMAP' | 'REST' | 'EXAM_DAY'
export type ExamPlanDayStatus = 'DONE' | 'MISSED' | 'TODAY' | 'UPCOMING' | 'REST'

export interface ExamPlanDay {
  /** yyyy-mm-dd, theo ngày Việt Nam như hạn mức. */
  date: string
  kind: ExamPlanDayKind
  /** `LESEN`… với buổi TEIL, `SPRECHEN` với buổi Nói. */
  section?: string
  teil?: number
  minutes: number
  status: ExamPlanDayStatus
  /** Đổi chỗ được: chưa làm, chưa qua, không phải ngày thi. */
  movable: boolean
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
  /** Chỉ tuần hiện tại. */
  days?: ExamPlanDay[]
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
  get: () => api.get<ExamPlan>('/exam-plan').then((r) => r.data),
  updateTargetDate: (targetDate: string) => api.put<ExamPlan>('/exam-plan/target-date', { targetDate }).then((r) => r.data),
  swapDays: (weekNo: number, from: string, to: string) =>
    api.put<ExamPlan>('/exam-plan/days/swap', { weekNo, from, to }).then((r) => r.data),
}

export function currentWeekOf(plan: ExamPlan | null | undefined): ExamPlanWeek | undefined {
  return plan?.weeks.find((w) => w.weekNo === plan.currentWeek)
}

/** Ngày hôm nay của máy dạng yyyy-mm-dd (lịch sinh theo giờ Việt Nam; học viên ở VN nên trùng). */
export function localIsoDate(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Buổi của hôm nay trong tuần hiện tại. */
export function todaySession(plan: ExamPlan | null | undefined, today = localIsoDate()): ExamPlanDay | undefined {
  return currentWeekOf(plan)?.days?.find((d) => d.date === today)
}

/** Khoá Teil luyện đề (`LESEN-2`) của buổi TEIL; `null` với buổi khác. */
export function teilKeyOf(day: Pick<ExamPlanDay, 'kind' | 'section' | 'teil'> | undefined): string | null {
  return day?.kind === 'TEIL' && day.section && day.teil ? `${day.section}-${day.teil}` : null
}

/** Đổi chỗ hai ngày ngay trên bản đang hiện (lạc quan), trước khi máy chủ trả lịch mới. */
export function swapLocally(plan: ExamPlan, from: string, to: string): ExamPlan {
  const week = currentWeekOf(plan)
  if (!week?.days) return plan
  const days = week.days.map((d) => ({ ...d }))
  const i = days.findIndex((d) => d.date === from)
  const j = days.findIndex((d) => d.date === to)
  if (i < 0 || j < 0) return plan
  const pick = ({ kind, section, teil, minutes, examId, examTitle }: ExamPlanDay) => ({ kind, section, teil, minutes, examId, examTitle })
  const a = pick(days[i])
  const b = pick(days[j])
  Object.assign(days[i], b)
  Object.assign(days[j], a)
  for (const d of [days[i], days[j]]) {
    d.status = d.kind === 'REST' ? 'REST' : d.date === localIsoDate() ? 'TODAY' : 'UPCOMING'
  }
  return { ...plan, weeks: plan.weeks.map((w) => (w.weekNo === week.weekNo ? { ...w, days } : w)) }
}
