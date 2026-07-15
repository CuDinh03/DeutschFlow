'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import { CEFR_LEVELS, practiceApi, type PracticeExercise } from '@/lib/practiceApi'
import { useTracking } from '@/hooks/useTracking'
import {
  EmptyState,
  ErrorBanner,
  GaCap,
  GaCard,
  GaPageHdr,
  LoadingState,
  TkBadge,
  TkSeg,
} from '@/components/ui-v2'

/**
 * /v2/student/exercises — Thư viện bài tập bổ trợ & đề thi mẫu (vỏ Galerie).
 *
 * Port của /student/practice: GIỮ NGUYÊN endpoint GET /practice/exercises (lọc theo `cefrLevel`)
 * và giữ nguyên event PostHog `practice_library` (started/quit).
 *
 * ⚠️ KHÁC v1 một điểm CÓ CHỦ Ý: v1 cho bấm "Làm bài ngay" ngay trên thẻ và POST thẳng
 * `scorePercent: 100` — không hề hiện đề, ai bấm cũng 100% + trọn XP (xem lib/practiceApi.ts).
 * Ở đây thẻ chỉ ĐIỀU HƯỚNG sang runner /v2/student/exercises/[id]; điểm do runner chấm thật.
 *
 * KHÁC /v2/student/practice/[nodeId]/[skill]: trang kia là runner của NODE lộ trình (curriculum),
 * ghi mastery. Đây là thư viện bài tập RỜI, chỉ cộng XP, không đụng lộ trình chính.
 */

const ALL = 'ALL' as const
type LevelFilter = typeof ALL | (typeof CEFR_LEVELS)[number]

export default function V2StudentExercisesPage() {
  const t = useTranslations('v2.student.exercises')
  const { trackFeatureAction } = useTracking()

  const [exercises, setExercises] = useState<PracticeExercise[]>([])
  const [level, setLevel] = useState<LevelFilter>(ALL)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    trackFeatureAction('practice_library', 'started')
    return () => trackFeatureAction('practice_library', 'quit')
  }, [trackFeatureAction])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const page = await practiceApi.list(level === ALL ? {} : { cefrLevel: level })
      setExercises(page.content ?? [])
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [level])

  useEffect(() => {
    void load()
  }, [load])

  const levelOptions = [
    { value: ALL as LevelFilter, label: t('allLevels') },
    ...CEFR_LEVELS.map((l) => ({ value: l as LevelFilter, label: l })),
  ]

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 space-y-5 px-10 py-6">
        <TkSeg
          options={levelOptions}
          value={level}
          onValueChange={setLevel}
          aria-label={t('filterLabel')}
        />

        {error && <ErrorBanner message={error} onRetry={() => void load()} />}

        {loading ? (
          <LoadingState label={t('loading')} />
        ) : exercises.length === 0 ? (
          <EmptyState icon="assignment" title={t('emptyTitle')} description={t('emptyDesc')} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {exercises.map((ex) => (
              <GaCard key={ex.id} className="flex flex-col gap-4 p-6">
                <div className="flex items-start justify-between gap-3">
                  <TkBadge tone={ex.exerciseType === 'EXAM' ? 'red' : 'blue'}>
                    {ex.exerciseType === 'EXAM' ? t('typeExam') : t('typeNormal')}
                  </TkBadge>
                  <TkBadge tone="neutral">{ex.cefrLevel}</TkBadge>
                </div>

                <div className="space-y-1">
                  <h2 className="font-ga-display text-[19px] leading-snug text-ga-ink">
                    {ex.examName || t('skillPractice', { skill: ex.skillType })}
                  </h2>
                  <p className="ga-ui text-[12.5px] text-ga-muted">
                    {t('skill')}: <span className="font-semibold text-ga-ink">{ex.skillType}</span>
                  </p>
                  {ex.sourceName && (
                    <p className="ga-ui text-[12.5px] text-ga-muted">
                      {t('source')}: {ex.sourceName}
                    </p>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 pt-1">
                  <GaCap className="text-ga-gold">+{ex.xpReward} XP</GaCap>

                  <div className="flex items-center gap-3">
                    {ex.sourceUrl && (
                      <a
                        href={ex.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('openSource')}
                        className="ga-ui inline-flex items-center gap-1 text-[12.5px] font-semibold text-ga-muted transition-colors hover:text-ga-ink"
                      >
                        <ExternalLink size={13} aria-hidden />
                      </a>
                    )}
                    <Link
                      href={`/v2/student/exercises/${ex.id}`}
                      className="ga-ui inline-flex items-center gap-1.5 rounded-ga bg-ga-ink px-4 py-2 text-[13px] font-semibold text-ga-bg transition-opacity hover:opacity-90"
                    >
                      {t('start')}
                      <ArrowRight size={14} aria-hidden />
                    </Link>
                  </div>
                </div>
              </GaCard>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
