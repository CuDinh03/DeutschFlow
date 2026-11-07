/**
 * Đường dẫn phòng thi nói — nằm trong khu Luyện thi (owner chốt 07/11/2026, Đợt 2 phòng thi nói).
 * Route cũ `/v2/student/speaking/exam/**` đã xoá hẳn, không chuyển hướng.
 *
 *   /v2/student/mock-exam/oral            lối vào: Kiểm tra micro (thi thử) rồi tạo phiên
 *   /v2/student/mock-exam/oral/[id]       phòng thi: Chuẩn bị → Đang thi → Đang chấm → Kết quả
 *   /v2/student/mock-exam/oral/other      Kỳ thi khác: chọn hệ × cấp, không đổi lịch ôn
 *   /v2/student/mock-exam/oral/weakness   Ôn yếu điểm
 */
import type { ExamMode, ExamProvider } from '@/types/exam-speaking'

export const ORAL_BASE = '/v2/student/mock-exam/oral'
export const ORAL_OTHER = `${ORAL_BASE}/other`
export const ORAL_WEAKNESS = `${ORAL_BASE}/weakness`
/** Nơi về mặc định sau phòng thi: màn Hôm nay của Luyện thi. */
export const ORAL_DEFAULT_RETURN = '/v2/student/exam'

/** Cấp đã có ngân hàng đề nói (C1 chưa có blueprint). */
export const ORAL_OPEN_LEVELS: readonly string[] = ['A1', 'A2', 'B1', 'B2']

export type PrepMode = 'SHORT' | 'FULL'

export interface OralEntry {
  provider?: ExamProvider | null
  level?: string | null
  mode?: ExamMode
  teil?: number | null
  prepMode?: PrepMode | null
  /** Nơi về khi thoát / thi xong. */
  ret?: string | null
}

/**
 * Chỉ nhận đường dẫn nội bộ của khu học viên — chặn `//evil.com`, `https://…`, `javascript:`
 * khi `?return=` bị sửa tay.
 */
export function safeReturn(raw: string | null | undefined): string {
  if (!raw) return ORAL_DEFAULT_RETURN
  if (!raw.startsWith('/v2/student/') || raw.startsWith('//') || raw.includes('\\')) return ORAL_DEFAULT_RETURN
  return raw
}

export function oralEntryHref({ provider, level, mode = 'MOCK', teil, prepMode, ret }: OralEntry = {}): string {
  const p = new URLSearchParams({ provider: provider ?? 'TELC', level: level ?? 'B1', mode })
  if (mode === 'DRILL' && teil) p.set('teil', String(teil))
  if (prepMode) p.set('prepMode', prepMode)
  if (ret) p.set('return', safeReturn(ret))
  return `${ORAL_BASE}?${p.toString()}`
}

export function oralSessionHref(id: number, ret?: string | null): string {
  return ret ? `${ORAL_BASE}/${id}?return=${encodeURIComponent(safeReturn(ret))}` : `${ORAL_BASE}/${id}`
}

/** Đọc tham số lối vào; giá trị lạ rơi về mặc định telc B1 thi thử. */
export interface ParsedOralEntry {
  provider: ExamProvider
  level: string
  mode: ExamMode
  teil: number | null
  prepMode: PrepMode | null
  ret: string
}

export function parseOralEntry(params: URLSearchParams): ParsedOralEntry {
  const provider: ExamProvider = params.get('provider') === 'GOETHE' ? 'GOETHE' : 'TELC'
  const rawLevel = params.get('level') ?? 'B1'
  const level = ORAL_OPEN_LEVELS.includes(rawLevel) ? rawLevel : 'B1'
  const mode: ExamMode = params.get('mode') === 'DRILL' ? 'DRILL' : 'MOCK'
  const teilNum = Number(params.get('teil'))
  const teil = mode === 'DRILL' && Number.isInteger(teilNum) && teilNum > 0 ? teilNum : null
  const pm = params.get('prepMode')
  const prepMode: PrepMode | null = pm === 'SHORT' || pm === 'FULL' ? pm : null
  return { provider, level, mode, teil, prepMode, ret: safeReturn(params.get('return')) }
}
