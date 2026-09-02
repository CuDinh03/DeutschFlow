// Helpers THUẦN cho các màn Luyện thi Nói — tách khỏi screen để test được
// (quyết định hiển thị trạng thái/đồng hồ/điểm không được phép sống vô danh
// trong JSX — bài học F-1 onboarding: logic trong màn không test là logic gãy êm).

import type { BlueprintSummary, ExamSessionState } from './examSpeakingApi'

/** Thứ tự trình độ để sort chip level trên hub. */
const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/** Danh sách level duy nhất có blueprint, xếp A1→C2. */
export function levelsFromBlueprints(list: readonly Pick<BlueprintSummary, 'level'>[]): string[] {
  const seen = new Set<string>()
  for (const b of list) seen.add(b.level.toUpperCase())
  return [...seen].sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b))
}

/**
 * Giây còn lại của một deadline SERVER, neo theo đồng hồ server:
 * offset = serverNow(lúc nhận snapshot) − clientNow(lúc nhận) — về sau chỉ cần
 * clientNow hiện tại. Đồng hồ máy người dùng lệch bao nhiêu cũng không sai giờ thi.
 */
export function remainingSec(
  deadlineAt: string | null,
  serverNowAtFetch: string,
  clientNowAtFetchMs: number,
  clientNowMs: number,
): number | null {
  if (!deadlineAt) return null
  const deadline = new Date(deadlineAt).getTime()
  const serverAtFetch = new Date(serverNowAtFetch).getTime()
  if (!Number.isFinite(deadline) || !Number.isFinite(serverAtFetch)) return null
  const serverNowEst = serverAtFetch + (clientNowMs - clientNowAtFetchMs)
  return Math.max(0, Math.ceil((deadline - serverNowEst) / 1000))
}

/** mm:ss cho đồng hồ thi. */
export function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Nhãn tiếng Việt cho trạng thái phiên — dùng ở pill/heading, không rẽ nhánh logic. */
export function stateLabel(state: ExamSessionState): string {
  switch (state) {
    case 'PREP': return 'Chuẩn bị'
    case 'IN_PART': return 'Đang thi'
    case 'BETWEEN': return 'Giữa hai phần'
    case 'DONE': return 'Đã nói xong'
    case 'GRADING': return 'Đang chấm'
    case 'RESULTS': return 'Có kết quả'
    case 'GRADING_FAILED': return 'Chấm lỗi'
    case 'ABORTED': return 'Đã huỷ'
    default: return state
  }
}

/** Phần trăm 0..1 an toàn cho thanh điểm tiêu chí. */
export function criterionRatio(points: number, max: number): number {
  if (!Number.isFinite(points) || !Number.isFinite(max) || max <= 0) return 0
  return Math.min(1, Math.max(0, points / max))
}

/**
 * Tông màu semantic cho một tỉ lệ điểm — ngưỡng theo design canvas 02/09:
 * ≥0.85 xanh (tốt), ≥0.72 vàng đậm (ổn), còn lại cam (cần kéo).
 */
export function ratioTone(ratio: number): 'success' | 'gold' | 'orange' {
  if (ratio >= 0.85) return 'success'
  if (ratio >= 0.72) return 'gold'
  return 'orange'
}

/**
 * Rút phần hiển thị được từ một `stimulus` (map tự do theo archetype backend —
 * web StimulusCard render ~10 kiểu; mobile MVP hiển thị các khoá phổ biến và
 * degrade êm với kiểu lạ: headline + gạch đầu dòng nếu có).
 */
export interface StimulusDisplay {
  headline: string | null
  bullets: string[]
}

export function stimulusDisplay(stimulus: Record<string, unknown> | null | undefined): StimulusDisplay {
  if (!stimulus) return { headline: null, bullets: [] }
  const s = stimulus as Record<string, unknown>
  const first = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = s[k]
      if (typeof v === 'string' && v.trim()) return v
      if (typeof v === 'number') return String(v)
    }
    return null
  }
  const headline = first('thema', 'prompt', 'keyword', 'wort', 'questionWord', 'situation', 'spell', 'number', 'title')
  const bullets: string[] = []
  for (const k of ['keywords', 'hints', 'points', 'bullets']) {
    const v = s[k]
    if (Array.isArray(v)) for (const item of v) if (typeof item === 'string') bullets.push(item)
  }
  return { headline, bullets }
}

/** Giọng TTS theo vai trong phòng thi — đồng bộ web examTts.ts. */
export const EXAM_VOICE_BY_ROLE: Record<string, string> = {
  PRUEFER: 'ANNA',
  PARTNER: 'THOMAS',
}
