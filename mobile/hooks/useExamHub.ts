// Dữ liệu chung của tab Luyện thi và thẻ "Lịch ôn hôm nay" (giao diện v3.4, Đợt 2, 19/11/2026).
// Tải giống trang /v2/student/exam của web: quyền luyện đề, gói đề telc, lượt thi thử, lịch ôn, lần thi
// nói, bài chẩn đoán; rồi tổng quan từng đề và điểm Teil của lượt thi thử. Màn Hôm nay và tab Luyện thi
// dùng chung một khoá truy vấn nên không tải hai lần.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { getMockPack, getMockPacks, type PackExam } from '@/lib/mockPackApi'
import { getMockTeilScores, getPracticeAccess, getPracticeOverview, type MockTeilScore, type PracticeOverview } from '@/lib/telcPracticeApi'
import { examPlanApi, localIsoDate, teilKeyOf, todaySession, currentWeekOf, type ExamPlan } from '@/lib/examPlanApi'
import { examSpeakingApi, type ExamResultView } from '@/lib/examSpeakingApi'
import { examDiagnosticApi, type DiagnosticStatus } from '@/lib/examDiagnosticApi'
import type { ExamAttempt } from '@/lib/examApi'
import { latestOral, skillsFrom, suggestionsFor, todayCard } from '@/lib/examHub'

export const EXAM_HUB_QUERY_KEY = ['exam-hub'] as const

export interface ExamRow {
  exam: PackExam
  packTitle: string
}

export interface ExamHubData {
  access: boolean
  rows: ExamRow[]
  locked: { id: number; title: string }[]
  attempts: ExamAttempt[]
  overviews: PracticeOverview[]
  mockTeile: MockTeilScore[]
  plan: ExamPlan | null
  oral: ExamResultView | null
  diagnostic: DiagnosticStatus | null
}

async function loadExamHub(): Promise<ExamHubData> {
  const [access, packs, attempts, plan, orals, diagnostic] = await Promise.all([
    getPracticeAccess(),
    getMockPacks(),
    // `includePartial`: lượt dừng giữa chừng cũng có điểm Teil (như web).
    api
      .get<ExamAttempt[]>('/mock-exams/attempts/me', { params: { includePartial: true } })
      .then((r) => r.data ?? [])
      .catch(() => [] as ExamAttempt[]),
    examPlanApi.get().catch(() => null),
    examSpeakingApi.listResults().catch(() => [] as ExamResultView[]),
    examDiagnosticApi
      .get()
      .then((v) => v.status)
      .catch(() => null),
  ])
  // Owner chốt 18/11: app chỉ luyện telc.
  const telc = packs.filter((x) => x.examFormat?.toUpperCase() === 'TELC')
  const locked = telc.filter((x) => x.locked).map((x) => ({ id: x.id, title: x.title }))
  const details = await Promise.all(telc.filter((x) => !x.locked).map((x) => getMockPack(x.id).catch(() => null)))
  const rows: ExamRow[] = details.flatMap((d) => (d ? d.exams.map((exam) => ({ exam, packTitle: d.title })) : []))
  let overviews: PracticeOverview[] = []
  let mockTeile: MockTeilScore[] = []
  if (access) {
    const ready = rows.filter((r) => !r.exam.comingSoon)
    const [ovs, scores] = await Promise.all([
      Promise.all(ready.map((r) => getPracticeOverview(r.exam.id).catch(() => null))),
      getMockTeilScores(),
    ])
    overviews = ovs.filter((o): o is PracticeOverview => !!o)
    mockTeile = scores
  }
  // App chỉ luyện telc (owner chốt 18/11): lịch ôn của kỳ thi khác (tạo trên web) không hiện ở đây,
  // kẻo gắn nhãn telc và mở nhầm đề telc trùng khoá Teil.
  const telcPlan = plan && plan.provider && plan.provider.toUpperCase() !== 'TELC' ? null : plan
  return {
    access,
    rows,
    locked,
    attempts,
    overviews,
    mockTeile,
    plan: telcPlan,
    oral: latestOral(orals, 'TELC', telcPlan?.level ?? 'B1'),
    diagnostic,
  }
}

export function useExamHub() {
  const query = useQuery({ queryKey: EXAM_HUB_QUERY_KEY, queryFn: loadExamHub, staleTime: 60_000 })
  const data = query.data
  const derived = useMemo(() => {
    if (!data) return null
    const skills = skillsFrom(data.overviews, data.oral, data.mockTeile)
    const today = localIsoDate()
    const day = todaySession(data.plan, today)
    const card = todayCard(day, data.plan, data.overviews, skills)
    return { skills, today, day, card, week: currentWeekOf(data.plan) }
  }, [data])
  return { ...query, derived }
}

/**
 * Người mới (chưa chẩn đoán, chưa có lịch): một việc duy nhất là bài chẩn đoán — không thẻ Hôm nay,
 * không gợi ý (như web, nghiệm thu prod 07/11/2026).
 */
export function isNewcomer(data: Pick<ExamHubData, 'diagnostic' | 'plan'>): boolean {
  return data.diagnostic === 'NONE' && data.plan?.status !== 'ACTIVE'
}

export function hubSuggestions(data: ExamHubData, derived: NonNullable<ReturnType<typeof useExamHub>['derived']>) {
  if (isNewcomer(data)) return []
  const card = derived.card
  const todayKey = card?.kind === 'TEIL' ? `${card.section}-${card.teil}` : teilKeyOf(derived.day)
  return suggestionsFor(data.overviews, derived.skills, data.plan, todayKey, !!data.oral, derived.today)
}
