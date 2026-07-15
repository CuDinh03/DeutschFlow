import { Suspense } from 'react'
import WeeklySpeakingClient from './client-page'

/**
 * /v2/student/weekly-speaking — bài nói theo tuần (admin ra đề → học viên nộp bài).
 *
 * Suspense là BẮT BUỘC: client đọc `useSearchParams()` (?cefBand, hợp đồng cũ của backend
 * TodayPlan.recommendedWeeklySpeaking) — thiếu Suspense thì `next build` gãy ở bước prerender.
 */
export default function V2StudentWeeklySpeakingPage() {
  return (
    <Suspense>
      <WeeklySpeakingClient />
    </Suspense>
  )
}
