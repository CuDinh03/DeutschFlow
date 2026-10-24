// LT2 (22/10/2026): chiến thuật từng Teil — GET /exam-strategies?provider&level&lang.
// Bản sinh đôi kiểu ở `frontend/src/components/exam/strategy/examStrategy.ts`. Nội dung chưa duyệt:
// học viên nhận COMING_SOON (không nội dung), admin/giáo viên nhận DRAFT.
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface StrategyContent {
  title: string
  format: string
  steps: string[]
  traps: string[]
  fixes: { cause: string; fix: string }[]
}

export interface TeilStrategyDto {
  section: string
  teil: number
  points: number
  status: string
  content?: StrategyContent
}

export const fetchExamStrategies = (provider: string, level: string): Promise<TeilStrategyDto[]> =>
  api
    .get<TeilStrategyDto[]>('/exam-strategies', { params: { provider, level, lang: 'vi' } })
    .then((r) => (Array.isArray(r.data) ? r.data : []))

/** Chiến thuật một Teil; `null` khi chưa biết đề, đề chưa có bộ chiến thuật, hoặc tải lỗi. */
export function useTeilStrategy(
  provider: string | undefined,
  level: string | undefined,
  section: string,
  teil: number | undefined,
): TeilStrategyDto | null {
  const { data } = useQuery({
    queryKey: ['exam-strategies', provider, level],
    queryFn: () => fetchExamStrategies(provider!, level!),
    enabled: !!provider && !!level,
    staleTime: Infinity,
  })
  if (!data || teil == null) return null
  return data.find((s) => s.section === section && s.teil === teil) ?? null
}
