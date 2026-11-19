// `GET /api/student/stats` (StudentStatsResponse): tab Tiến bộ và dải số trên màn Tôi dùng chung
// một khoá React Query để chỉ gọi một lần và luôn khớp số với nhau.
import api from '@/lib/api'

export interface StudentStats {
  streakDays: number
  totalXp: number
  xpLevel: number
  wordsLearned: number
  speakingMinutes: number
  grammarAccuracy: number
  /** Bảy phần tử: phút học mỗi ngày Thứ Hai → Chủ nhật của tuần hiện tại. */
  weeklyProgress: number[]
}

export const STUDENT_STATS_QUERY_KEY = ['stats'] as const

export function fetchStudentStats(): Promise<StudentStats> {
  return api.get<StudentStats>('/student/stats').then((r) => r.data)
}
