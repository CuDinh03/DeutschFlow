/**
 * Hàm thuần cho màn Hôm nay (đợt (d) làm mới Luyện thi, 07/11/2026): bốn kỹ năng tính từ lượt luyện
 * từng Teil và lần thi nói gần nhất, chọn đề để mở một Teil, và nội dung thẻ Hôm nay.
 */
import { oralEntryHref } from '@/lib/exam/oralRoutes'
import type { PracticeOverview } from '@/lib/telcPracticeApi'
import type { ExamResultView } from '@/types/exam-speaking'
import { teilKeyOf, type ExamPlan, type ExamPlanDay } from '@/lib/examPlanApi'

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

export function statusOf(pct: number | null): SkillStatus {
  if (pct == null) return 'none'
  if (pct >= PASS_PCT) return 'ok'
  if (pct >= PASS_PCT - 10) return 'near'
  return 'below'
}

interface Latest {
  score: number
  max: number
  at: string
}

/** Lần kiểm tra gần nhất của mỗi Teil, gộp qua mọi đề. */
function latestByKey(overviews: PracticeOverview[]): Map<string, Latest> {
  const out = new Map<string, Latest>()
  for (const o of overviews) {
    for (const x of o.teile) {
      const p = x.progress
      if (!p?.checked || p.score == null) continue
      const max = p.max ?? x.maxPoints
      if (!(max > 0)) continue
      const at = p.updatedAt ?? ''
      const prev = out.get(x.key)
      if (!prev || at > prev.at) out.set(x.key, { score: p.score, max, at })
    }
  }
  return out
}

function teilOrder(overviews: PracticeOverview[], sections: string[]): { key: string; section: string; teil: number }[] {
  const seen = new Map<string, { key: string; section: string; teil: number }>()
  for (const o of overviews) for (const x of o.teile) if (sections.includes(x.section) && !seen.has(x.key)) seen.set(x.key, x)
  return Array.from(seen.values()).sort((a, b) => sections.indexOf(a.section) - sections.indexOf(b.section) || a.teil - b.teil)
}

function weakestOf(teile: TeilScore[]): TeilScore | null {
  const scored = teile.filter((x) => x.pct != null)
  const fresh = teile.find((x) => x.pct == null)
  if (scored.length === 0) return fresh ?? null
  const low = scored.reduce((a, b) => ((b.pct as number) < (a.pct as number) ? b : a))
  // Teil chưa luyện được ưu tiên hơn Teil đã đạt ngưỡng.
  return (low.pct as number) >= PASS_PCT && fresh ? fresh : low
}

export function skillsFrom(overviews: PracticeOverview[], oral: ExamResultView | null): Skill[] {
  const latest = latestByKey(overviews)
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
  const oralTeile = parts.map((p): TeilScore => ({
    key: `SPRECHEN-${p.teilNo}`,
    section: 'SPRECHEN',
    teil: p.teilNo,
    pct: p.max > 0 ? Math.round((p.points / p.max) * 100) : null,
  }))
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

export function teilHref(examId: number, key: string): string {
  return `/v2/student/mock-exam/practice/teil?examId=${examId}&teil=${key}`
}

/**
 * Phòng thi nói của kỳ thi này (khu Luyện thi, `/v2/student/mock-exam/oral`): mặc định thi thử phần
 * nói; `teil` ⇒ luyện riêng Teil đó. Hệ/cấp theo lịch ôn, thiếu thì telc B1.
 */
export function oralHref(plan: Pick<ExamPlan, 'provider' | 'level'> | null | undefined, teil?: number | null): string {
  const provider = plan?.provider === 'GOETHE' ? 'GOETHE' : 'TELC'
  return oralEntryHref({ provider, level: plan?.level ?? 'B1', mode: teil ? 'DRILL' : 'MOCK', teil })
}

export type TodayCardModel =
  | { kind: 'TEIL'; section: string; teil: number; minutes: number; href: string | null; pct: number | null; done: boolean; fromPlan: boolean }
  | { kind: 'FULL_EXAM'; minutes: number; href: string | null; examTitle?: string; done: boolean }
  | { kind: 'ORAL_MOCK' | 'ORAL_DRILL'; teil?: number; minutes: number; href: string; done: boolean }
  | { kind: 'ROADMAP'; minutes: number; href: string; done: boolean }
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
        const examId = pickExamFor(key, overviews)
        const pct = skills.flatMap((s) => s.teile).find((x) => x.key === key)?.pct ?? null
        return { kind: 'TEIL', section: day.section as string, teil: day.teil as number, minutes: day.minutes, href: examId ? teilHref(examId, key) : null, pct, done, fromPlan: true }
      }
      case 'FULL_EXAM':
        return { kind: 'FULL_EXAM', minutes: day.minutes, href: day.examId ? `/v2/student/mock-exam/full?examId=${day.examId}` : null, examTitle: day.examTitle, done }
      case 'ORAL_MOCK':
      case 'ORAL_DRILL':
        return { kind: day.kind, teil: day.teil, minutes: day.minutes, href: oralHref(plan, day.kind === 'ORAL_DRILL' ? day.teil : null), done }
      case 'ROADMAP':
        return { kind: 'ROADMAP', minutes: day.minutes, href: '/v2/student/roadmap', done }
      case 'REST':
        return { kind: 'REST' }
      case 'EXAM_DAY':
        return { kind: 'EXAM_DAY' }
    }
  }
  const candidates = skills
    .filter((s) => s.id !== 'SPRECHEN' && s.weakest)
    .sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1))
  const weak = candidates[0]?.weakest
  if (!weak) return null
  const examId = pickExamFor(weak.key, overviews)
  const meta = overviews.flatMap((o) => o.teile).find((x) => x.key === weak.key)
  return { kind: 'TEIL', section: weak.section, teil: weak.teil, minutes: meta?.suggestMinutes ?? 15, href: examId ? teilHref(examId, weak.key) : null, pct: weak.pct, done: false, fromPlan: false }
}

export type Suggestion =
  | { kind: 'review'; key: string; section: string; teil: number; wrong: number; href: string }
  | { kind: 'weak'; key: string; section: string; teil: number; minutes: number; href: string }
  | { kind: 'mock'; date: string; href: string }
  | { kind: 'oral'; href: string }

/**
 * Nút gợi ý dưới thẻ Hôm nay (đợt (e)), tối đa 3, theo dữ liệu thật: ôn lại câu sai của Teil vừa
 * kiểm tra gần nhất, Teil yếu kế tiếp, lần thi thử sắp tới trong tuần (chưa có thì lần thi nói đầu
 * tiên). Bỏ Teil đang ở thẻ Hôm nay để không lặp.
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
  if (review) out.push({ kind: 'review', key: review.key, section: review.section, teil: review.teil, wrong: review.wrong, href: teilHref(review.examId, review.key) })

  const weak = skills
    .filter((s) => s.id !== 'SPRECHEN')
    .flatMap((s) => s.teile)
    .filter((x) => x.key !== todayKey && x.key !== review?.key && (x.pct == null || x.pct < PASS_PCT))
    .sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1))[0]
  if (weak) {
    const examId = pickExamFor(weak.key, overviews)
    const minutes = overviews.flatMap((o) => o.teile).find((x) => x.key === weak.key)?.suggestMinutes ?? 15
    if (examId) out.push({ kind: 'weak', key: weak.key, section: weak.section, teil: weak.teil, minutes, href: teilHref(examId, weak.key) })
  }

  const days = plan?.weeks.find((w) => w.weekNo === plan.currentWeek)?.days ?? []
  const mock = days.find((d) => d.kind === 'FULL_EXAM' && d.date > today && d.status === 'UPCOMING' && d.examId)
  if (mock) out.push({ kind: 'mock', date: mock.date, href: `/v2/student/mock-exam/full?examId=${mock.examId}` })
  else if (!oralTaken) out.push({ kind: 'oral', href: oralHref(plan) })

  return out.slice(0, 3)
}
