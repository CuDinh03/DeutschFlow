'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Check, ChevronRight, Sparkles, Trophy } from 'lucide-react'
import api from '@/lib/api'
import { isAsyncJobAccepted, waitForAsyncJob } from '@/lib/asyncJob'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { SKILL_COLORS, SKILL_LABELS } from '@/lib/learning-tree/render/palette'
import { SKILL_ICONS } from '@/lib/learning-tree/render/icons'
import { TreeIcon } from '@/components/learning-tree/TreeIcon'
import { GaCap, GaCard, GaPageHdr, ErrorBanner, LoadingState } from '@/components/ui-v2'
import type { Skill } from '@/lib/learning-tree/core'

/**
 * /v2/student/practice/[nodeId] — chọn 1 trong 4 kỹ năng để luyện (vỏ Galerie).
 *
 * Port của /student/practice-node/[nodeId]: GIỮ NGUYÊN endpoint và contract param `nodeId`
 * (số — id node của `GET /roadmap/me`, KHÁC id chuỗi của cây `/roadmap/tree`).
 *   · GET  /skill-tree/{nodeId}/practice                  — 4 session hiện có
 *   · POST /skill-tree/{nodeId}/practice/{SKILL}/start     — tạo session cho 1 kỹ năng
 *   · POST /skill-tree/{nodeId}/practice/trigger-all       — sinh cả 4
 *
 * Khác v1 ở đúng một chỗ (bắt buộc, không phải "cải tiến"): `start` nay trả 202 + {jobId} khi
 * chưa có bài trong cache (S-5 — sinh bài chạy nền). Bản v1 chỉ đọc `sessions`/`sessionId` nên
 * đứng im ở lần sinh đầu. Ở đây ta poll job qua `waitForAsyncJob` rồi mới điều hướng.
 *
 * Màu/nhãn kỹ năng lấy từ palette cây học tập (`SKILL_COLORS`/`SKILL_LABELS`) để bề mặt luyện tập
 * và cây/legend ở /v2/student/roadmap dùng chung một bộ mã màu.
 */

const SKILLS: Skill[] = ['hoeren', 'sprechen', 'lesen', 'schreiben']

/** Nhãn tiếng Đức đi kèm (v1 hiển thị song ngữ Việt · Đức). */
const SKILL_LABELS_DE: Record<Skill, string> = {
  hoeren: 'Hören',
  sprechen: 'Sprechen',
  lesen: 'Lesen',
  schreiben: 'Schreiben',
}

interface PracticeSession {
  id: number
  skill_type: string
  generation: number
  status: string
  score_percent: number | null
  xp_earned: number
  exercise_count: number
  totalSeenCount: number
  created_at: string
}

interface PracticeOverview {
  nodeTitle: string
  nodeTitleVi: string
  emoji: string
  cefrLevel: string
  sessions: PracticeSession[]
}

export default function V2StudentPracticeNodePage() {
  usePageTimeTracker('practice_node')
  const t = useTranslations('v2.student.practiceNode')
  const params = useParams()
  const router = useRouter()
  const nodeId = Number(params?.nodeId)

  const { me, loading: meLoading } = useStudentPracticeSession()

  const [overview, setOverview] = useState<PracticeOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchOverview = useCallback(async () => {
    if (!nodeId) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<PracticeOverview>(`/skill-tree/${nodeId}/practice`)
      setOverview(data)
    } catch (err: unknown) {
      // 404 = chưa sinh bài lần nào → không phải lỗi, hiện ô "sinh bài".
      if ((err as { response?: { status?: number } })?.response?.status === 404) {
        setOverview(null)
      } else {
        setError(t('loadError'))
      }
    } finally {
      setLoading(false)
    }
  }, [nodeId, t])

  useEffect(() => {
    if (me && nodeId) void fetchOverview()
  }, [me, nodeId, fetchOverview])

  const sessionFor = (skill: Skill): PracticeSession | undefined =>
    overview?.sessions.find((s) => s.skill_type === skill.toUpperCase())

  const handleStartSkill = async (skill: Skill) => {
    const existing = sessionFor(skill)
    if (existing && existing.status === 'ACTIVE') {
      router.push(`/v2/student/practice/${nodeId}/${skill}`)
      return
    }

    setGenerating(skill)
    setError(null)
    try {
      const { data } = await api.post<unknown>(
        `/skill-tree/${nodeId}/practice/${skill.toUpperCase()}/start`,
      )
      // 202 → bài đang được sinh nền; chờ job xong rồi mới vào runner.
      if (isAsyncJobAccepted(data)) await waitForAsyncJob(data.jobId)
      await fetchOverview()
      router.push(`/v2/student/practice/${nodeId}/${skill}`)
    } catch {
      setError(t('startError'))
    } finally {
      setGenerating(null)
    }
  }

  const handleTriggerAll = async () => {
    setGenerating('ALL')
    setError(null)
    try {
      await api.post(`/skill-tree/${nodeId}/practice/trigger-all`)
      // trigger-all là fire-and-forget (202, không jobId) — v1 chờ 3s rồi refetch. Giữ nguyên.
      setTimeout(() => void fetchOverview(), 3000)
    } catch {
      setError(t('triggerAllError'))
    } finally {
      setTimeout(() => setGenerating(null), 3000)
    }
  }

  if (meLoading || !me) return <LoadingState label={t('loading')} />

  const totalXp = overview?.sessions.reduce((sum, s) => sum + (s.xp_earned ?? 0), 0) ?? 0
  const totalSeen = overview?.sessions.reduce((sum, s) => sum + (s.totalSeenCount ?? 0), 0) ?? 0

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={overview ? `${overview.emoji} ${overview.nodeTitleVi}` : t('subtitle')}
      />
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl space-y-[22px]">
          <button
            type="button"
            onClick={() => router.push('/v2/student/roadmap')}
            className="ga-ui inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-ga-muted transition-colors hover:text-ga-ink lg:min-h-0"
          >
            <ArrowLeft size={15} aria-hidden /> {t('backToRoadmap')}
          </button>

          {error && <ErrorBanner message={error} onRetry={() => void fetchOverview()} />}

          {/* Node header */}
          {overview && (
            <GaCard className="p-4 lg:p-6">
              <div className="flex items-start gap-4">
                <span className="shrink-0 text-[34px] leading-none">{overview.emoji}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-ga-display text-[20px] font-medium leading-tight text-ga-ink break-words lg:text-[22px]">
                    {overview.nodeTitleVi}
                  </h2>
                  <p className="ga-ui mt-0.5 text-[13.5px] italic text-ga-muted break-words">{overview.nodeTitle}</p>
                  <span className="ga-ui mt-2 inline-block rounded-ga-pill bg-ga-accent-soft px-2.5 py-0.5 text-[11px] font-bold text-ga-accent">
                    {overview.cefrLevel}
                  </span>
                </div>
              </div>
              <p className="ga-ui mt-4 border-t border-ga-line pt-4 text-[13.5px] leading-relaxed text-ga-muted">
                {t('blurb')}
              </p>
            </GaCard>
          )}

          {loading ? (
            <LoadingState label={t('loadingSessions')} />
          ) : (
            <>
              {/* Chưa có session nào → mời sinh cả 4 */}
              {!overview?.sessions?.length && (
                <div className="rounded-ga border-2 border-dashed border-ga-border bg-ga-surface px-4 py-8 text-center sm:px-6 lg:py-10">
                  <Sparkles size={34} className="mx-auto mb-3 text-ga-yellow" aria-hidden />
                  <p className="font-ga-display text-[20px] font-medium text-ga-ink">{t('emptyTitle')}</p>
                  <p className="ga-ui mx-auto mt-2 max-w-sm text-[13.5px] text-ga-muted">{t('emptyDesc')}</p>
                  <button
                    type="button"
                    onClick={() => void handleTriggerAll()}
                    disabled={generating === 'ALL'}
                    className="ga-ui mt-5 inline-flex min-h-10 items-center gap-2 rounded-ga bg-ga-accent px-5 py-2.5 text-[13.5px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50 lg:min-h-0"
                  >
                    <Sparkles size={15} aria-hidden />
                    {generating === 'ALL' ? t('generating') : t('generateAll')}
                  </button>
                </div>
              )}

              {/* 4 thẻ kỹ năng */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {SKILLS.map((skill) => {
                  const session = sessionFor(skill)
                  const color = SKILL_COLORS[skill]
                  const isCompleted = session?.status === 'COMPLETED'
                  const isGenerating = generating === skill
                  const seen = session?.totalSeenCount ?? 0

                  return (
                    <GaCard key={skill} hover className="overflow-hidden">
                      <button
                        type="button"
                        onClick={() => !isGenerating && void handleStartSkill(skill)}
                        disabled={isGenerating}
                        className="w-full p-4 text-left transition-colors hover:bg-ga-surface disabled:cursor-wait lg:p-5"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
                            style={{ background: color }}
                          >
                            {isCompleted ? (
                              <Check size={20} strokeWidth={3} color="#FFFFFF" aria-hidden />
                            ) : (
                              <TreeIcon paths={SKILL_ICONS[skill]} size={20} color="#FFFFFF" strokeWidth={2.4} />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-semibold text-ga-ink">
                              {SKILL_LABELS[skill]}
                            </span>
                            <span className="ga-ui block text-[12.5px] italic text-ga-muted">
                              {SKILL_LABELS_DE[skill]}
                            </span>
                          </span>
                          <ChevronRight size={16} className="shrink-0 text-ga-subtle" aria-hidden />
                        </div>

                        <div className="ga-ui mt-3 flex flex-wrap items-center gap-3 text-[12px]">
                          {isGenerating ? (
                            <span className="animate-pulse text-ga-muted">{t('generatingOne')}</span>
                          ) : session ? (
                            <>
                              <span className="inline-flex items-center gap-1 font-semibold" style={{ color }}>
                                <Trophy size={12} aria-hidden />
                                {session.score_percent ?? '—'}%
                              </span>
                              <span className="text-ga-subtle">{t('generation', { n: session.generation })}</span>
                              <span className="text-ga-subtle">{t('seenCount', { count: seen })}</span>
                            </>
                          ) : (
                            <span className="text-ga-subtle">{t('notStarted')}</span>
                          )}
                        </div>

                        {isCompleted && session && (
                          <span className="ga-ui mt-2 inline-flex items-center gap-1 rounded-ga-pill bg-ga-green-soft px-2 py-1 text-[11px] font-bold text-ga-green">
                            <Check size={10} aria-hidden /> +{session.xp_earned} XP
                          </span>
                        )}
                      </button>

                      {session && (
                        <span className="block h-1.5 w-full bg-ga-border">
                          <span
                            className="block h-full transition-[width] duration-500"
                            style={{
                              width: `${session.score_percent ?? 0}%`,
                              background: isCompleted ? 'var(--ga-green)' : color,
                            }}
                          />
                        </span>
                      )}
                    </GaCard>
                  )
                })}
              </div>

              {/* Tổng kết */}
              {overview && overview.sessions.length > 0 && (
                <GaCard className="p-4 text-center lg:p-5">
                  <GaCap className="mb-2 block">{t('summaryCap')}</GaCap>
                  <p className="ga-ui text-[13.5px] text-ga-muted">
                    {t('summaryXp')} <span className="font-semibold text-ga-ink">{totalXp} XP</span>
                    {' · '}
                    {t('summarySeen')} <span className="font-semibold text-ga-ink">{totalSeen}</span>
                  </p>
                </GaCard>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
