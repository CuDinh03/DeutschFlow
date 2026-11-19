// Mô hình thuần của màn "Phỏng vấn theo nghề" trong tab Luyện nói (giao diện v3.4, Đợt 5, 19/11/2026).
// Owner chốt 18/11: chip chỉ hiện nghề đã có người phỏng vấn (bộ câu hỏi viết tay, `questionSet` CURATED,
// web lọc cùng trường ở `OccupationIndexFilter`); ô tìm vẫn gõ được mọi nghề vì backend tạo phiên cho
// mã nghề nào cũng được; phiếu phỏng vấn thang /10.

import type { AiSpeakingSession } from '@/lib/speakingApi'
import type { OccupationInterviewInfo, OccupationSummary } from '@/lib/occupations'

export function curatedOccupations(list: readonly OccupationSummary[]): OccupationSummary[] {
  return list.filter((o) => o.questionSet === 'CURATED')
}

/** Nghề mở sẵn: nghề trong hồ sơ nếu có trong danh mục, không thì nghề viết tay đầu tiên. */
export function defaultOccupationCode(
  all: readonly OccupationSummary[],
  profileCode: string | null | undefined,
): string | null {
  if (profileCode && all.some((o) => o.code === profileCode)) return profileCode
  return curatedOccupations(all)[0]?.code ?? null
}

/** Chip nghề: các nghề viết tay; nghề đang chọn (từ hồ sơ hoặc ô tìm) mà không nằm trong đó thì đứng đầu. */
export function occupationChips(
  all: readonly OccupationSummary[],
  selectedCode: string | null,
): OccupationSummary[] {
  const curated = curatedOccupations(all)
  if (!selectedCode || curated.some((o) => o.code === selectedCode)) return curated
  const picked = all.find((o) => o.code === selectedCode)
  return picked ? [picked, ...curated] : curated
}

export interface TypicalQuestion {
  de: string
  vi: string | null
}

/** Câu hỏi tiêu biểu: câu riêng của nghề (đã duyệt trước) rồi tới câu chuyên môn trong bộ của nhân vật. */
export function typicalQuestion(info: Pick<OccupationInterviewInfo, 'sampleQuestions' | 'occupationQuestions'> | null | undefined): TypicalQuestion | null {
  if (!info) return null
  const layer = (info.occupationQuestions ?? []).find((q) => q.questionDe?.trim())
  if (layer) return { de: layer.questionDe.trim(), vi: layer.questionVi ?? null }
  const bank = info.sampleQuestions ?? []
  // Pha của `InterviewPhase`: INTRO, ICE_BREAKER, HARD_SKILLS, STAR_SOFT, CLOSING — câu chuyên môn tiêu biểu nhất.
  const pick =
    bank.find((q) => q.questionDe?.trim() && q.phase === 'HARD_SKILLS') ??
    bank.find((q) => q.questionDe?.trim() && !/INTRO|ICE|CLOS/i.test(q.phase ?? '')) ??
    bank.find((q) => q.questionDe?.trim())
  return pick ? { de: pick.questionDe.trim(), vi: pick.questionVi ?? null } : null
}

/** Điểm tổng /10 trong `interviewReportJson` của phiên; JSON hỏng hoặc chưa chấm ⇒ null. */
export function reportScore(json: string | null | undefined): number | null {
  if (!json) return null
  try {
    const v = (JSON.parse(json) as { overallScore?: unknown }).overallScore
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

/** 7.5 → "7,5"; 7 → "7" (thang /10, một chữ số thập phân như phiếu cuối buổi). */
export function formatScore10(score: number): string {
  const rounded = Math.round(score * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',')
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** "Hôm nay", "Hôm qua" hoặc "15/11" theo giờ máy. */
export function dayLabel(iso: string | null | undefined, now: Date): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000)
  if (diff === 0) return 'Hôm nay'
  if (diff === 1) return 'Hôm qua'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface RecentInterview {
  id: number
  title: string
  persona: string | null
  when: string | null
  score: number | null
}

/** Buổi phỏng vấn gần đây (mới trước), tối đa `limit`; chỉ phiên đã kết thúc hoặc đã có phiếu. */
export function recentInterviews(sessions: readonly AiSpeakingSession[], now: Date, limit = 3): RecentInterview[] {
  return sessions
    .filter((s) => s.sessionMode === 'INTERVIEW' && (s.endedAt || s.interviewReportJson))
    .slice(0, limit)
    .map((s) => ({
      id: s.id,
      title: s.interviewPosition?.trim() || s.topic?.trim() || 'Phỏng vấn',
      persona: s.persona,
      when: dayLabel(s.endedAt ?? s.startedAt, now),
      score: reportScore(s.interviewReportJson),
    }))
}
