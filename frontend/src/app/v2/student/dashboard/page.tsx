'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import api from '@/lib/api'
import { todayApi, type TodayPlan } from '@/lib/todayApi'
import { phaseApi, type PhaseStateResponse } from '@/lib/phaseApi'
import { xpApi, type XpSummaryDto } from '@/lib/xpApi'
import { useUserStore } from '@/stores/useUserStore'
import type { RoadmapNode } from '@/lib/roadmap-tree/types'
import { pickContinueNode } from '@/lib/learning/currentNode'
import { GaPageHdr, LoadingState, ErrorBanner } from '@/components/ui-v2'
import { ContinueLearning } from '@/components/learning/ContinueLearning'
import { TodayList, type TodayTask } from '@/components/learning/TodayList'
import { HabitStrip } from '@/components/learning/HabitStrip'
import { JourneyPreview } from '@/components/learning/JourneyPreview'

/**
 * Heute (Student Dashboard) — S-02.
 *
 * Hierarchy đã đảo so với bản cũ (UX-01/UI-04): trước đây màn mở bằng 4 ô thống kê rồi ba thẻ
 * hành động ngang hàng, nên người học phải tự chọn engine trước khi học được. Nay:
 *
 *   Greeting  →  ContinueLearning (CTA filled duy nhất)  →  Heute (việc hôm nay)
 *             →  Streak/XP (một hàng nhỏ)  →  Lernweg preview  →  gợi ý phụ
 *
 * Guardrail dữ liệu (P4-D2): mọi con số đều có nguồn thật —
 *   `/roadmap/me` (node lộ trình) · `/today/me` (việc hôm nay, streak) · `/xp/me` (thưởng).
 * Stat strip 4 ô cũ bị giải thể: "độ chính xác"/"từ đã thuộc" là chỉ số tiến bộ, thuộc về
 * Fortschritt (S-10) — vẫn tới được qua `/v2/student/stats` trong local nav của Fortschritt.
 * Khối `phase` cũ cũng chuyển sang Fortschritt; không nhân bản ở đây.
 *
 * Từng khối tự chịu lỗi riêng (`Promise.allSettled`): một API hỏng không làm sập cả màn.
 */
export default function V2StudentDashboardPage() {
  const t = useTranslations('v2.student.dashboard')
  const displayName = useUserStore((s) => s.user?.displayName)

  const [nodes, setNodes] = useState<RoadmapNode[] | null>(null)
  const [today, setToday] = useState<TodayPlan | null>(null)
  const [phase, setPhase] = useState<PhaseStateResponse | null>(null)
  const [xp, setXp] = useState<XpSummaryDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.allSettled([
      api.get<RoadmapNode[]>('/roadmap/me'),
      todayApi.getMe(),
      phaseApi.getCurrent(),
      xpApi.getMyXp(),
    ])
      .then(([r, t2, p, x]) => {
        if (r.status === 'fulfilled') setNodes(Array.isArray(r.value.data) ? r.value.data : [])
        if (t2.status === 'fulfilled') setToday(t2.value.data)
        if (p.status === 'fulfilled') setPhase(p.value.data)
        if (x.status === 'fulfilled') setXp(x.value)
        // Chỉ báo lỗi toàn màn khi KHÔNG khối nào tải được — lỗi lẻ đã tự xử ở từng khối.
        if ([r, t2, p, x].every((s) => s.status === 'rejected')) setError(t('loadError'))
      })
      .finally(() => setLoading(false))
  }, [t])
  useEffect(load, [load])

  const isFirstSession = phase?.sessionsCompleted === 0
  const continueNode = nodes ? pickContinueNode(nodes) : undefined

  // Việc hôm nay — chỉ dựng từ dữ liệu CÓ THẬT của `/today/me`.
  const tasks: TodayTask[] = []
  const dueCount = today?.dueRepairTasks?.length ?? 0
  if (dueCount > 0) {
    tasks.push({
      id: 'srs',
      icon: 'srs',
      label: t('today.srs'),
      meta: t('today.srsMeta', { count: dueCount }),
      href: '/v2/student/review',
    })
  }
  if (today?.recommendedSpeaking) {
    tasks.push({
      id: 'speaking',
      icon: 'speaking',
      label: t('today.speaking'),
      meta: today.recommendedSpeaking.topic ?? undefined,
      href: today.recommendedSpeaking.href || '/v2/student/speaking',
    })
  }
  if (today?.recommendedWeeklySpeaking) {
    tasks.push({
      id: 'weekly',
      icon: 'weekly',
      label: t('today.weekly'),
      meta: today.recommendedWeeklySpeaking.topic ?? undefined,
      href: today.recommendedWeeklySpeaking.href || '/v2/student/weekly-speaking',
    })
  }
  if (today?.progress?.topWeakErrorCode) {
    tasks.push({
      id: 'repair',
      icon: 'repair',
      label: t('today.repair'),
      meta: today.progress.topWeakErrorCode,
      href: '/v2/student/errors',
    })
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={displayName ? t('greeting', { name: displayName }) : t('titleFallback')}
        subtitle={t('subtitle')}
      />

      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-12">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        )}

        {loading ? (
          // Skeleton giữ ĐÚNG thứ bậc thật: khối Continue trước, rồi danh sách việc.
          <div className="space-y-8">
            <div className="ga-shimmer h-[232px] border border-ga-line" aria-hidden />
            <LoadingState variant="skeleton" rows={3} label={t('loading')} />
          </div>
        ) : (
          <div className="space-y-8">
            <ContinueLearning node={continueNode} isFirstSession={isFirstSession} />

            <TodayList tasks={tasks} />

            <HabitStrip
              streakDays={today?.progress?.streakDays}
              xp={
                xp
                  ? { level: xp.level, progressInLevel: xp.progressInLevel, xpNeededForNext: xp.xpNeededForNext }
                  : undefined
              }
            />

            {nodes && nodes.length > 0 && <JourneyPreview nodes={nodes} />}
          </div>
        )}
      </div>
    </div>
  )
}
