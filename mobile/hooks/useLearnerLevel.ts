import { useQuery } from '@tanstack/react-query'
import { LEARNING_PROFILE_QUERY_KEY, learningProfileApi } from '@/lib/learningProfileApi'

/**
 * Trình độ hiện tại / mục tiêu của người học cho các màn cần chọn sẵn band (Nói, Nói tuần, Thi thử,
 * Thi nói). `settled` = đã có câu trả lời (kể cả lỗi/404 chưa onboarding) — màn nên chờ `settled`
 * rồi mới chốt band mặc định, tránh nháy A1 → A2. Lỗi KHÔNG chặn màn: `currentLevel` null ⇒
 * `practiceBand(null)` = A1, band an toàn nhất.
 */
export function useLearnerLevel(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true
  const q = useQuery({
    queryKey: LEARNING_PROFILE_QUERY_KEY,
    queryFn: () => learningProfileApi.me(),
    enabled,
    staleTime: 5 * 60_000,
    retry: 1,
  })
  return {
    currentLevel: q.data?.currentLevel ?? null,
    targetLevel: q.data?.targetLevel ?? null,
    settled: !enabled || q.isSuccess || q.isError,
  }
}
