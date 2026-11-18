// Đường dẫn các màn Luyện thi telc trên app (giao diện v3.4, Đợt 2 + 4, 19/11/2026).
// Một chỗ duy nhất dựng đường dẫn để màn Hôm nay, tab Luyện thi và lịch ôn cùng dẫn về một nơi.
// Màn Đề, Teil, thi thử trọn đề, bài chẩn đoán thuộc Đợt 4; hai đợt phát hành cùng một bản OTA.

import type { Href } from 'expo-router'
import type { ExamPlan } from './examPlanApi'

export interface ExamRoute {
  pathname: string
  params?: Record<string, string>
}

/** Màn một đề: danh sách Teil của đề, tiến độ từng Teil. */
export const examSetRoute = (examId: number): ExamRoute => ({
  pathname: '/(student)/exam-set',
  params: { examId: String(examId) },
})

/** Luyện một Teil của một đề (không ép giờ, kiểm tra có phân tích từng câu). */
export const teilRoute = (examId: number, key: string): ExamRoute => ({
  pathname: '/(student)/exam-teil',
  params: { examId: String(examId), teil: key },
})

/** Thi thử trọn đề, bấm giờ như thi thật. */
export const fullExamRoute = (examId: number): ExamRoute => ({
  pathname: '/(student)/exam-full',
  params: { examId: String(examId) },
})

export const diagnosticRoute: ExamRoute = { pathname: '/(student)/exam-diagnostic' }

/** Đổi ngày thi, số phút mỗi ngày, xem lịch theo tuần. */
export const examPlanRoute: ExamRoute = { pathname: '/(student)/exam-plan' }

export const roadmapRoute: ExamRoute = { pathname: '/(student)/learn' }

/**
 * Phòng thi nói của kỳ thi này: mặc định thi thử phần nói; `teil` ⇒ luyện riêng Teil đó.
 * Cấp theo lịch ôn, thiếu thì B1. Owner chốt 18/11: app chỉ luyện telc.
 */
export function oralRoute(plan: Pick<ExamPlan, 'level'> | null | undefined, teil?: number | null): ExamRoute {
  const params: Record<string, string> = { provider: 'TELC', level: plan?.level ?? 'B1', mode: teil ? 'DRILL' : 'MOCK' }
  if (teil) params.teil = String(teil)
  return { pathname: '/(student)/speaking-exam', params }
}

/** Ép kiểu về `Href` của expo-router: đường dẫn dựng động nên typed routes không tự suy ra. */
export const asHref = (r: ExamRoute): Href => r as unknown as Href
