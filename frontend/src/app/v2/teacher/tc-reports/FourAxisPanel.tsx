'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import api, { apiMessage } from '@/lib/api'
import { GaCap } from '@/components/ui-v2'

// Báo cáo 4 trục (PR-10, spec §7): nội dung / nhịp độ / tham gia / mục tiêu — tổng hợp đọc-only.

interface FourAxis {
  content: { taughtItems: number; partialItems: number; totalItems: number; completedLessons: number; totalLessons: number }
  pacing: { projectedEndDate: string | null; remainingMinutes: number; availableMinutes: number; shortfallMinutes: number; suggestedExtraSessions: number; milestonesAtRisk: number }
  participation: { presentCount: number; lateCount: number; absentCount: number; needsMakeupOpen: number; completedSessions: number; totalPastSessions: number }
  objectives: { achieved: number; needsPractice: number; notAssessedCells: number; totalObjectives: number; studentsNeedingSupport: string[] }
}

export function FourAxisPanel({ classId }: { classId: number }) {
  const t = useTranslations('v2.teacher.fourAxis')
  const [data, setData] = useState<FourAxis | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setData(null)
    api.get<FourAxis>(`/v2/teacher/classes/${classId}/four-axis-report`)
      .then((res) => { if (active) { setData(res.data); setError('') } })
      .catch((e: unknown) => { if (active) setError(apiMessage(e)) })
    return () => { active = false }
  }, [classId])

  if (error) return <p className="m-0 border border-ga-line bg-ga-card px-4 py-4 text-[13px] text-ga-muted">{error}</p>
  if (!data) return <div className="ga-shimmer h-[140px] border border-ga-line" aria-hidden />

  const axes: { cap: string; main: string; sub: string; warn?: boolean }[] = [
    {
      cap: t('contentCap'),
      main: t('contentMain', { taught: data.content.taughtItems, total: data.content.totalItems }),
      sub: t('contentSub', { partial: data.content.partialItems, lessons: data.content.completedLessons, totalLessons: data.content.totalLessons }),
    },
    {
      cap: t('pacingCap'),
      main: data.pacing.projectedEndDate
        ? t('pacingMain', { date: format(new Date(data.pacing.projectedEndDate), 'dd/MM/yyyy') })
        : t('pacingShortfall', { minutes: data.pacing.shortfallMinutes, sessions: data.pacing.suggestedExtraSessions }),
      sub: t('pacingSub', { remaining: data.pacing.remainingMinutes, available: data.pacing.availableMinutes, risk: data.pacing.milestonesAtRisk }),
      warn: !data.pacing.projectedEndDate || data.pacing.milestonesAtRisk > 0,
    },
    {
      cap: t('participationCap'),
      main: t('participationMain', { present: data.participation.presentCount, late: data.participation.lateCount, absent: data.participation.absentCount }),
      sub: t('participationSub', { makeup: data.participation.needsMakeupOpen, done: data.participation.completedSessions, total: data.participation.totalPastSessions }),
      warn: data.participation.needsMakeupOpen > 0,
    },
    {
      cap: t('objectivesCap'),
      main: t('objectivesMain', { achieved: data.objectives.achieved, needs: data.objectives.needsPractice }),
      sub: data.objectives.studentsNeedingSupport.length > 0
        ? t('objectivesSupport', { names: data.objectives.studentsNeedingSupport.join(', ') })
        : t('objectivesSub', { notAssessed: data.objectives.notAssessedCells }),
      warn: data.objectives.needsPractice > 0,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {axes.map((a) => (
        <div key={a.cap} className="border bg-ga-card px-3.5 py-3" style={{ borderColor: a.warn ? 'var(--ga-gold)' : 'var(--ga-line)' }}>
          <GaCap className="mb-1.5 block">{a.cap}</GaCap>
          <div className="text-[14px] font-semibold leading-snug text-ga-ink">{a.main}</div>
          <p className="ga-ui m-0 mt-1 text-[12px] leading-[1.5] text-ga-muted">{a.sub}</p>
        </div>
      ))}
    </div>
  )
}
