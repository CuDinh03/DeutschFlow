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

/** Một phần của bài chẩn đoán: làm như luyện Teil nhưng không làm lại, xong về màn bài chẩn đoán. */
export const diagnosticTeilRoute = (examId: number, key: string): ExamRoute => ({
  pathname: '/(student)/exam-teil',
  params: { examId: String(examId), teil: key, mode: 'diag' },
})

/** Thi thử trọn đề như thi thật (màn giới thiệu rồi màn làm bài). */
export const fullExamRoute = (examId: number): ExamRoute => ({
  pathname: '/(student)/exam-full',
  params: { examId: String(examId) },
})

export const diagnosticRoute: ExamRoute = { pathname: '/(student)/exam-diagnostic' }

/** Đổi ngày thi, số phút mỗi ngày, xem lịch theo tuần. */
export const examPlanRoute: ExamRoute = { pathname: '/(student)/exam-plan' }

export const roadmapRoute: ExamRoute = { pathname: '/(student)/learn' }

/**
 * Sảnh thi nói telc của cấp này (owner chốt 18/11: app chỉ luyện telc). Sảnh có nút thi thử trọn bài
 * và luyện từng Teil; không tự mở phòng từ đây vì mỗi lượt dùng ngân sách chấm AI.
 */
export function oralRoute(plan: Pick<ExamPlan, 'level'> | null | undefined): ExamRoute {
  return { pathname: '/(student)/speaking-exam', params: { provider: 'TELC', level: plan?.level ?? 'B1' } }
}

/** Ép kiểu về `Href` của expo-router: đường dẫn dựng động nên typed routes không tự suy ra. */
export const asHref = (r: ExamRoute): Href => r as unknown as Href
