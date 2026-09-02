// Nhịp học "Heute" — gương backend TodayController (/api/today/me, TodayPlanDto)
// + ErrorSkillsController (/api/error-skills). LƯU Ý hợp đồng: TodayPlanDto KHÔNG
// có field `progress` (type web todayApi.ts khai thừa — đừng chép theo web ở đây);
// streak lấy từ /student/dashboard sẵn có của màn Trang chủ.

import api from './api'
import { getErrorTitle } from './errorTaxonomy'

export interface DueRepairTask {
  id: number
  errorCode: string
  taskType: string
  dueAt: string
  intervalDays: number
}

export interface TodayRecommended {
  /** Đường dẫn WEB backend gợi ý (vd /v2/student/speaking?...) — mobile map qua todayHrefToRoute. */
  href: string | null
  topic: string | null
  cefrLevel: string | null
  focusOrStructures: string[] | null
}

export interface TodayPlan {
  dueRepairTasks: DueRepairTask[] | null
  recommendedSpeaking: TodayRecommended | null
  recommendedWeeklySpeaking: TodayRecommended | null
  recommendedVocabPractice: TodayRecommended | null
}

/** Một lỗi hay mắc đã gom (ErrorSkillDto backend — đồng bộ web drillApi). */
export interface ErrorSkill {
  errorCode: string
  count: number
  lastSeenAt: string
  priorityScore: number
  sampleWrong: string | null
  sampleCorrected: string | null
  ruleViShort: string | null
}

export const todayApi = {
  me: () => api.get<TodayPlan>('/today/me').then((r) => r.data),
}

export const errorSkillsApi = {
  mine: (days = 30) =>
    api.get<ErrorSkill[]>('/error-skills/me', { params: { days } }).then((r) => r.data ?? []),
  resolved: () => api.get<ErrorSkill[]>('/error-skills/me/resolved').then((r) => r.data ?? []),
  /** Đánh dấu đã sửa xong một mã lỗi SAU khi drill pass (semantics backend). */
  repairAttempt: (errorCode: string) =>
    api.post<void>(`/error-skills/me/${encodeURIComponent(errorCode)}/repair-attempt`),
}

/**
 * Nhãn chip cho thẻ "Sửa lỗi đến hạn" trên Trang chủ: ưu tiên ruleViShort từ
 * backend, thiếu thì rơi về bảng nhãn tiếng Việt local (errorTaxonomy) — KHÔNG
 * bao giờ hiện mã thô kiểu "WORD_ORDER.V2_MAIN_CLAUSE" cho người học. Nhiều
 * task trùng một mã/nhãn chỉ ra MỘT chip (trước đây 3 task cùng mã = 3 chip
 * giống hệt nhau).
 */
export function dueRepairChipLabels(
  dueTasks: readonly Pick<DueRepairTask, 'errorCode'>[],
  skills: readonly Pick<ErrorSkill, 'errorCode' | 'ruleViShort'>[],
  limit = 3,
): string[] {
  const ruleByCode = new Map(skills.map((s) => [s.errorCode, s.ruleViShort]))
  const out: string[] = []
  for (const t of dueTasks) {
    const short = ruleByCode.get(t.errorCode)
    const label = short?.trim() ? short : getErrorTitle(t.errorCode)
    if (!out.includes(label)) out.push(label)
    if (out.length >= limit) break
  }
  return out
}

/**
 * `href` của TodayRecommended là đường WEB — map về route mobile tương đương.
 * Không nhận URL tuyệt đối/route lạ: fallback về tab Speaking (an toàn, không 404).
 */
export function todayHrefToRoute(href: string | null | undefined):
  | '/(student)/speaking'
  | '/(student)/weekly-speaking'
  | '/(student)/vocabulary' {
  const h = (href ?? '').toLowerCase()
  if (h.includes('weekly')) return '/(student)/weekly-speaking'
  if (h.includes('vocab')) return '/(student)/vocabulary'
  return '/(student)/speaking'
}

/**
 * Drill "gõ lại câu đúng" (gương ErrorRepairDrill web): so khớp KHOAN DUNG —
 * bỏ hoa/thường, dấu câu rìa từ, khoảng trắng thừa; giữ nguyên umlaut/ß (đó
 * chính là thứ đang luyện, không được xuê xoa).
 */
export function normalizeDrillAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:'"„“”‚’()\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function drillPass(attempt: string, target: string): boolean {
  const a = normalizeDrillAnswer(attempt)
  const t = normalizeDrillAnswer(target)
  return a.length > 0 && t.length > 0 && a === t
}
