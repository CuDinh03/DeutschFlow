// Hàm thuần cho tab Luyện thi và thẻ "Lịch ôn hôm nay" (giao diện v3.4, Đợt 2, 19/11/2026).
// Bản sinh đôi của `frontend/src/components/exam/today/todayModel.ts`: bốn kỹ năng tính từ lượt luyện
// từng Teil, điểm Teil của lượt thi thử và lần thi nói gần nhất; chọn đề để mở một Teil; thẻ Hôm nay;
// gợi ý nhanh. Khác web ở chỗ trả về đường dẫn của app (`ExamRoute`), không phải URL web.

import type { MockTeilScore, PracticeOverview } from './telcPracticeApi'
import type { ExamResultView } from './examSpeakingApi'
import { teilKeyOf, type ExamPlan, type ExamPlanDay } from './examPlanApi'
import { fullExamRoute, oralRoute, roadmapRoute, teilRoute, type ExamRoute } from './examRoutes'

export const PASS_PCT = 60
export type SkillId = 'LESEN' | 'HOEREN' | 'SCHREIBEN' | 'SPRECHEN'
export type SkillStatus = 'ok' | 'near' | 'below' | 'none'

/** Lesen gồm cả Sprachbausteine: cùng một phiếu thi, cùng một khối giờ. */
const SKILL_SECTIONS: Record<Exclude<SkillId, 'SPRECHEN'>, string[]> = {
  LESEN: ['LESEN', 'SPRACHBAUSTEINE'],
  HOEREN: ['HOEREN'],
  SCHREIBEN: ['SCHREIBEN'],
}

export interface TeilScore {
  key: string
  section: string
  teil: number
  /** null = chưa luyện Teil này. */
  pct: number | null
}

export interface Skill {
  id: SkillId
  pct: number | null
  status: SkillStatus
  teile: TeilScore[]
  /** Teil nên luyện tiếp: thấp điểm nhất, chưa luyện thì Teil đầu tiên chưa luyện. */
  weakest: TeilScore | null
}

/** Owner chốt 18/11: dưới 50% đỏ "Chưa đạt", 50–59% cam "Sát ngưỡng", từ 60% "Đạt". */
export function statusOf(pct: number | null): SkillStatus {
  if (pct == null) return 'none'
  if (pct >= PASS_PCT) return 'ok'
  if (pct >= PASS_PCT - 10) return 'near'
  return 'below'
}

export const STATUS_LABEL: Record<SkillStatus, string> = {
  ok: 'Đạt',
  near: 'Sát ngưỡng',
  below: 'Chưa đạt',
  none: 'Chưa luyện',
}

/** Tên ngắn của phần thi (giữ tiếng Đức như đề thật). */
export const SECTION_SHORT: Record<string, string> = {
  LESEN: 'Lesen',
  SPRACHBAUSTEINE: 'Sprachbausteine',
  HOEREN: 'Hören',
  SCHREIBEN: 'Schreiben',
  SPRECHEN: 'Sprechen',
}

export const sectionShort = (section: string): string => SECTION_SHORT[section] ?? section

interface Latest {
  score: number
  max: number
  /** Mốc thời gian (ms). So bằng số, không so chuỗi: ngày luyện và mốc thi thử có thể khác dạng ISO. */
  at: number
}

const msOf = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isNaN(t) ? 0 : t
}

/**
 * Lần chấm gần nhất của mỗi Teil, gộp qua mọi đề: lượt luyện từng Teil và điểm Teil của lượt thi thử
 * đã nộp hoặc dừng giữa chừng. Điểm thi thử chỉ tính cho đề đang có trong `overviews` (đề telc) —
 * khoá Teil như `LESEN-1` trùng giữa telc và Goethe.
 */
function latestByKey(overviews: PracticeOverview[], mock: MockTeilScore[] = []): Map<string, Latest> {
  const out = new Map<string, Latest>()
  const put = (key: string, score: number, max: number, at: number) => {
    const prev = out.get(key)
    if (!prev || at > prev.at) out.set(key, { score, max, at })
  }
  for (const o of overviews) {
    for (const x of o.teile) {
      const p = x.progress
      if (!p?.checked || p.score == null) continue
      const max = p.max ?? x.maxPoints
      if (!(max > 0)) continue
      // Mốc CHẤM, không phải mốc lưu: lưu nháp Viết sau khi chấm đổi `updatedAt` mà vẫn giữ điểm cũ.
      put(x.key, p.score, max, msOf(p.checkedAt ?? p.updatedAt))
    }
  }
  const exams = new Set(overviews.map((o) => o.examId))
  for (const m of mock) {
    if (!exams.has(m.examId) || !(m.max > 0)) continue
    put(m.key, m.score, m.max, msOf(m.at))
  }
  return out
}

function teilOrder(overviews: PracticeOverview[], sections: string[]): { key: string; section: string; teil: number }[] {
  const seen = new Map<string, { key: string; section: string; teil: number }>()
  for (const o of overviews) {
    for (const x of o.teile) {
      if (sections.includes(x.section) && !seen.has(x.key)) seen.set(x.key, { key: x.key, section: x.section, teil: x.teil })
    }
  }
  return Array.from(seen.values()).sort(
    (a, b) => sections.indexOf(a.section) - sections.indexOf(b.section) || a.teil - b.teil,
  )
}

function weakestOf(teile: TeilScore[]): TeilScore | null {
  const scored = teile.filter((x) => x.pct != null)
  const fresh = teile.find((x) => x.pct == null)
  if (scored.length === 0) return fresh ?? null
  const low = scored.reduce((a, b) => ((b.pct as number) < (a.pct as number) ? b : a))
  // Teil chưa luyện được ưu tiên hơn Teil đã đạt ngưỡng.
  return (low.pct as number) >= PASS_PCT && fresh ? fresh : low
}

export function skillsFrom(
  overviews: PracticeOverview[],
  oral: ExamResultView | null,
  mock: MockTeilScore[] = [],
): Skill[] {
  const latest = latestByKey(overviews, mock)
  const written = (Object.keys(SKILL_SECTIONS) as Exclude<SkillId, 'SPRECHEN'>[]).map((id): Skill => {
    const teile = teilOrder(overviews, SKILL_SECTIONS[id]).map((x): TeilScore => {
      const l = latest.get(x.key)
      return { ...x, pct: l ? Math.round((l.score / l.max) * 100) : null }
    })
    let score = 0
    let max = 0
    for (const x of teile) {
      const l = latest.get(x.key)
      if (l) {
        score += l.score
        max += l.max
      }
    }
    const pct = max > 0 ? Math.round((score / max) * 100) : null
    return { id, pct, status: statusOf(pct), teile, weakest: weakestOf(teile) }
  })
  const parts = oral?.scoreSheet?.parts ?? []
  const oralTeile = parts.map(
    (p): TeilScore => ({
      key: `SPRECHEN-${p.teilNo}`,
      section: 'SPRECHEN',
      teil: p.teilNo,
      pct: p.max > 0 ? Math.round((p.points / p.max) * 100) : null,
    }),
  )
  const oralPct = oral && oral.total != null && oral.max ? Math.round((oral.total / oral.max) * 100) : null
  return [...written, { id: 'SPRECHEN', pct: oralPct, status: statusOf(oralPct), teile: oralTeile, weakest: weakestOf(oralTeile) }]
}

/** Lần thi nói có điểm gần nhất của kỳ thi này. */
export function latestOral(results: ExamResultView[], provider = 'TELC', level = 'B1'): ExamResultView | null {
  return (
    results
      .filter((r) => r.provider === provider && r.level === level && r.total != null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  )
}

/**
 * Đề để mở một Teil: đề đang làm dở Teil đó, rồi đề chưa luyện Teil đó, rồi đề luyện Teil đó điểm
 * thấp nhất. `null` khi không đề nào có Teil này.
 */
export function pickExamFor(key: string, overviews: PracticeOverview[]): number | null {
  const withTeil = overviews.filter((o) => o.teile.some((x) => x.key === key))
  if (withTeil.length === 0) return null
  const prog = (o: PracticeOverview) => o.teile.find((x) => x.key === key)?.progress ?? null
  const doing = withTeil.find((o) => {
    const p = prog(o)
    return p && !p.checked
  })
  if (doing) return doing.examId
  const fresh = withTeil.find((o) => !prog(o))
  if (fresh) return fresh.examId
  const pctOf = (o: PracticeOverview) => {
    const p = prog(o)
    const max = p?.max ?? 0
    return max > 0 ? (p?.score ?? 0) / max : 1
  }
  return withTeil.reduce((a, b) => (pctOf(b) < pctOf(a) ? b : a)).examId
}

/** Đường mở một Teil (chọn đề theo `pickExamFor`); `null` khi chưa đề nào có Teil này. */
export function teilRouteFor(key: string, overviews: PracticeOverview[]): ExamRoute | null {
  const id = pickExamFor(key, overviews)
  return id ? teilRoute(id, key) : null
}

export type TodayCardModel =
  | { kind: 'TEIL'; section: string; teil: number; minutes: number; route: ExamRoute | null; pct: number | null; done: boolean; fromPlan: boolean }
  | { kind: 'FULL_EXAM'; minutes: number; route: ExamRoute | null; examTitle?: string; done: boolean }
  | { kind: 'ORAL_MOCK' | 'ORAL_DRILL'; teil?: number; minutes: number; route: ExamRoute; done: boolean }
  | { kind: 'ROADMAP'; minutes: number; route: ExamRoute; done: boolean }
  | { kind: 'REST' }
  | { kind: 'EXAM_DAY' }

/**
 * Thẻ Hôm nay: buổi của hôm nay trong lịch tuần; không có lịch (chưa có ngày thi, kỳ thi khác) thì
 * Teil yếu nhất trong ba kỹ năng viết.
 */
export function todayCard(
  day: ExamPlanDay | undefined,
  plan: ExamPlan | null,
  overviews: PracticeOverview[],
  skills: Skill[],
): TodayCardModel | null {
  const done = day?.status === 'DONE'
  if (day) {
    switch (day.kind) {
      case 'TEIL': {
        const key = teilKeyOf(day) as string
        const pct = skills.flatMap((s) => s.teile).find((x) => x.key === key)?.pct ?? null
        return { kind: 'TEIL', section: day.section as string, teil: day.teil as number, minutes: day.minutes, route: teilRouteFor(key, overviews), pct, done, fromPlan: true }
      }
      case 'FULL_EXAM':
        return { kind: 'FULL_EXAM', minutes: day.minutes, route: day.examId ? fullExamRoute(day.examId) : null, examTitle: day.examTitle, done }
      case 'ORAL_MOCK':
      case 'ORAL_DRILL':
        return { kind: day.kind, teil: day.teil, minutes: day.minutes, route: oralRoute(plan), done }
      case 'ROADMAP':
        return { kind: 'ROADMAP', minutes: day.minutes, route: roadmapRoute, done }
      case 'REST':
        return { kind: 'REST' }
      case 'EXAM_DAY':
        return { kind: 'EXAM_DAY' }
    }
  }
  const candidates = skills.filter((s) => s.id !== 'SPRECHEN' && s.weakest).sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1))
  const weak = candidates[0]?.weakest
  if (!weak) return null
  const meta = overviews.flatMap((o) => o.teile).find((x) => x.key === weak.key)
  return { kind: 'TEIL', section: weak.section, teil: weak.teil, minutes: meta?.suggestMinutes ?? 15, route: teilRouteFor(weak.key, overviews), pct: weak.pct, done: false, fromPlan: false }
}

export type Suggestion =
  | { kind: 'review'; key: string; section: string; teil: number; wrong: number; route: ExamRoute }
  | { kind: 'weak'; key: string; section: string; teil: number; minutes: number; route: ExamRoute }
  | { kind: 'mock'; date: string; route: ExamRoute }
  | { kind: 'oral'; route: ExamRoute }

/**
 * Gợi ý nhanh dưới thẻ Hôm nay, tối đa 3, theo dữ liệu thật: ôn lại câu sai của Teil vừa kiểm tra gần
 * nhất, Teil yếu kế tiếp, lần thi thử sắp tới trong tuần (chưa có thì lần thi nói đầu tiên). Bỏ Teil
 * đang ở thẻ Hôm nay để không lặp.
 */
export function suggestionsFor(
  overviews: PracticeOverview[],
  skills: Skill[],
  plan: ExamPlan | null,
  todayKey: string | null,
  oralTaken: boolean,
  today: string,
): Suggestion[] {
  const out: Suggestion[] = []

  let review: { key: string; section: string; teil: number; wrong: number; examId: number; at: string } | null = null
  for (const o of overviews) {
    for (const x of o.teile) {
      const p = x.progress
      const r = p?.result as { correctCount?: number; total?: number } | null | undefined
      if (!p?.checked || x.section === 'SCHREIBEN' || x.key === todayKey || typeof r?.total !== 'number') continue
      const wrong = r.total - (r.correctCount ?? 0)
      const at = p.updatedAt ?? ''
      if (wrong > 0 && (!review || at > review.at)) review = { key: x.key, section: x.section, teil: x.teil, wrong, examId: o.examId, at }
    }
  }
  if (review) out.push({ kind: 'review', key: review.key, section: review.section, teil: review.teil, wrong: review.wrong, route: teilRoute(review.examId, review.key) })

  const weak = skills
    .filter((s) => s.id !== 'SPRECHEN')
    .flatMap((s) => s.teile)
    .filter((x) => x.key !== todayKey && x.key !== review?.key && (x.pct == null || x.pct < PASS_PCT))
    .sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1))[0]
  if (weak) {
    const route = teilRouteFor(weak.key, overviews)
    const minutes = overviews.flatMap((o) => o.teile).find((x) => x.key === weak.key)?.suggestMinutes ?? 15
    if (route) out.push({ kind: 'weak', key: weak.key, section: weak.section, teil: weak.teil, minutes, route })
  }

  const days = plan?.weeks.find((w) => w.weekNo === plan.currentWeek)?.days ?? []
  const mock = days.find((d) => d.kind === 'FULL_EXAM' && d.date > today && d.status === 'UPCOMING' && d.examId)
  if (mock?.examId) out.push({ kind: 'mock', date: mock.date, route: fullExamRoute(mock.examId) })
  else if (!oralTaken) out.push({ kind: 'oral', route: oralRoute(plan) })

  return out.slice(0, 3)
}

/** Số Teil đã kiểm tra trên một đề (thanh 9 đoạn ở thẻ đề). */
export function checkedCount(overview: PracticeOverview | undefined): number {
  return overview ? overview.teile.filter((x) => x.progress?.checked).length : 0
}

/** Nhãn ngắn của một buổi trong lịch tuần: "Lesen T2", "Sprechen T1", "Thi thử", "Nghỉ"… */
export function dayLabel(d: Pick<ExamPlanDay, 'kind' | 'section' | 'teil'>): string {
  switch (d.kind) {
    case 'TEIL':
      return `${sectionShort(d.section ?? '')} T${d.teil ?? ''}`.trim()
    case 'ORAL_DRILL':
      return `Sprechen T${d.teil ?? 1}`
    case 'ORAL_MOCK':
      return 'Thi nói'
    case 'FULL_EXAM':
      return 'Thi thử'
    case 'ROADMAP':
      return 'Lộ trình'
    case 'REST':
      return 'Nghỉ'
    case 'EXAM_DAY':
      return 'Ngày thi'
    default:
      return 'Buổi ôn'
  }
}

export interface TodayCardText {
  /** Dòng nhỏ trên tiêu đề: "Hôm nay · 15 phút", "Hôm nay · đã xong". */
  eyebrow: string
  /** Tiêu đề: "Lesen · Teil 2", "Thi thử phần viết"… (tên Teil giữ tiếng Đức). */
  title: string
  /** Vì sao là việc này. Câu chữ như web (`v2.student.examHub`). */
  reason: string
  /** Nút chính; `null` khi không có gì để mở (ngày nghỉ, ngày thi, chưa có đề). */
  action: string | null
  /** Tiêu đề là tiếng Đức (đọc bằng giọng Đức). */
  german: boolean
}

export function todayCardText(card: TodayCardModel): TodayCardText {
  const done = 'done' in card && card.done
  const minutes = 'minutes' in card ? card.minutes : null
  const eyebrow = done ? 'Hôm nay · đã xong' : minutes ? `Hôm nay · ${minutes} phút` : 'Hôm nay'
  const action = 'route' in card && card.route ? (done ? 'Luyện thêm' : 'Bắt đầu buổi ôn hôm nay') : null
  switch (card.kind) {
    case 'TEIL': {
      const reason =
        card.pct != null
          ? card.fromPlan
            ? `Lần gần nhất đạt ${card.pct}%.`
            : `Teil thấp điểm nhất của bạn: ${card.pct}%.`
          : card.fromPlan
            ? 'Chưa luyện Teil này lần nào.'
            : 'Bắt đầu từ một Teil chưa luyện.'
      return { eyebrow, title: `${sectionShort(card.section)} · Teil ${card.teil}`, reason, action, german: true }
    }
    case 'FULL_EXAM':
      return {
        eyebrow,
        title: 'Thi thử trọn đề',
        reason: card.examTitle ? `${card.examTitle} · làm trọn đề như thi thật.` : 'Chưa còn đề mới để thi thử. Đề tiếp theo sắp có.',
        action,
        german: false,
      }
    case 'ORAL_MOCK':
      return { eyebrow, title: 'Thi thử phần nói', reason: 'Thi với giám khảo AI, khoảng 15 phút.', action, german: false }
    case 'ORAL_DRILL':
      return { eyebrow, title: `Sprechen · Teil ${card.teil ?? 1}`, reason: `Vào phòng thi nói, chọn luyện Teil ${card.teil ?? 1} với giám khảo AI.`, action, german: true }
    case 'ROADMAP':
      return { eyebrow, title: 'Bài trong lộ trình', reason: 'Một bài trong lộ trình học để giữ nền ngữ pháp và từ vựng.', action, german: false }
    case 'REST':
      return { eyebrow, title: 'Hôm nay nghỉ', reason: 'Muốn luyện thêm thì chọn một kỹ năng ở tab Luyện thi.', action: null, german: false }
    case 'EXAM_DAY':
      return { eyebrow, title: 'Hôm nay thi', reason: 'Chúc bạn thi tốt. Nhớ mang giấy tờ tuỳ thân.', action: null, german: false }
  }
}
