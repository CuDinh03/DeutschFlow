/**
 * Chiến thuật từng Teil (LT2, 22/10/2026) — `GET /api/exam-strategies?provider&level&lang`.
 * Nội dung chưa duyệt: học viên nhận `COMING_SOON` (không nội dung), admin/giáo viên nhận `DRAFT`.
 */
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
  status: 'REVIEWED' | 'DRAFT' | 'COMING_SOON' | string
  content?: StrategyContent
}

/** Một lần tải cho mỗi đề × ngôn ngữ trong suốt phiên trang — mọi Teil dùng chung. */
const cache = new Map<string, Promise<TeilStrategyDto[]>>()

export function fetchExamStrategies(provider: string, level: string, lang: string): Promise<TeilStrategyDto[]> {
  const key = `${provider}:${level}:${lang}`.toUpperCase()
  let hit = cache.get(key)
  if (!hit) {
    // Bọc trong Promise: chiến thuật là phần phụ — mọi lỗi (kể cả api trả về thứ không phải promise)
    // chỉ được làm khối này trống, không được làm hỏng đề đang thi.
    hit = Promise.resolve()
      .then(() => api.get<TeilStrategyDto[]>('/exam-strategies', { params: { provider, level, lang } }))
      .then((r) => (Array.isArray(r?.data) ? r.data : []))
      .catch(() => {
        cache.delete(key) // lỗi mạng không được khoá cứng "không có chiến thuật" cho cả phiên
        return []
      })
    cache.set(key, hit)
  }
  return hit
}

export function findStrategy(list: TeilStrategyDto[], section: string, teil: number): TeilStrategyDto | null {
  return list.find((s) => s.section === section && s.teil === teil) ?? null
}

/** Chỉ dùng trong test. */
export function clearStrategyCache() {
  cache.clear()
}
