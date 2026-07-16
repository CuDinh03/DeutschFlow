'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Dumbbell } from 'lucide-react'
import api from '@/lib/api'
import { useNodeSessionStore } from '@/stores/useNodeSessionStore'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'
import { useTracking } from '@/hooks/useTracking'
import GrammarView from '@/components/learn/GrammarView'
import ReadingView from '@/components/learn/ReadingView'
import ListeningView from '@/components/learn/ListeningView'
import SpeakingView from '@/components/learn/SpeakingView'
import WritingView from '@/components/learn/WritingView'
import SessionRecap from '@/components/learn/SessionRecap'
import PhonemeCoach from '@/components/learn/PhonemeCoach'
import { GaCap, GaCard, GaPageHdr, LoadingState } from '@/components/ui-v2'

/**
 * /v2/student/learn/[nodeId] — 5 view học của một node (vỏ Galerie).
 *
 * Port của /student/learn/node/[nodeId]. GIỮ NGUYÊN:
 *   · store `useNodeSessionStore` (GET /skill-tree/node/{nodeId}/session) — import lại, không copy;
 *   · các view `@/components/learn/*` (Grammar/Reading/Listening/Speaking/Writing/PhonemeCoach)
 *     — dùng nguyên, nên phần thân bài vẫn giữ style riêng của chúng; chỉ VỎ trang đổi sang Galerie;
 *   · luật vượt node: Nghe/Đọc 100%, Nói/Viết/Phát âm ≥ 80, Ngữ pháp chỉ cần xem xong;
 *   · PostHog: usePageTimeTracker('learn_node') + trackFeatureAction('lesson', started|completed).
 *
 * Đổi so với v1: nút quay lại trỏ /v2/student/roadmap (v1 trỏ /roadmap/tree — cây v1 sắp xoá), và
 * thêm cửa sang runner luyện 4 kỹ năng `/v2/student/practice/{nodeId}` (backend đã sống, nhưng
 * trong v1 KHÔNG trang nào link tới practice-node — nó là trang mồ côi chỉ vào được bằng URL tay).
 */

type ViewKey = 'grammar' | 'reading' | 'listening' | 'speaking' | 'writing' | 'phoneme'

const VIEW_TABS: { key: ViewKey; tKey: string; emoji: string }[] = [
  { key: 'grammar', tKey: 'grammar', emoji: '📖' },
  { key: 'reading', tKey: 'reading', emoji: '📚' },
  { key: 'listening', tKey: 'listening', emoji: '🎧' },
  { key: 'speaking', tKey: 'speaking', emoji: '🎤' },
  { key: 'writing', tKey: 'writing', emoji: '✍️' },
  { key: 'phoneme', tKey: 'phoneme', emoji: '🗣️' },
]

interface RoadmapState {
  nodeId: number
  title: string
  index: number
  total: number
  percent: number
  nextNodeId: number | null
  nextNodeTitle: string | null
}

/** Đúng shape của `RoadmapNodeDto` (`GET /roadmap/me`): `title` = tiếng Đức, `subtitle` = tiếng Việt. */
interface RoadmapDtoNode {
  id: number
  title?: string
  subtitle?: string
}

export default function V2StudentLearnNodePage() {
  usePageTimeTracker('learn_node')
  const params = useParams()
  const router = useRouter()
  const nodeId = Number(params?.nodeId)

  // `learn` là namespace gốc (messages/{vi,en,de}.json) — các view con cũng dùng chính nó, nên
  // dùng lại thay vì nhân bản chuỗi sang v2.
  const tLearn = useTranslations('learn')
  const t = useTranslations('v2.student.learnNode')

  const { me, loading: meLoading, targetLevel, streakDays } = useStudentPracticeSession()
  const { trackFeatureAction } = useTracking()
  const {
    session,
    loading,
    error,
    activeView,
    setActiveView,
    fetchSession,
    reset,
    tabCompletion,
    tabScores,
    markTabCompleted,
    resetTabCompletion,
  } = useNodeSessionStore()

  const [showRecap, setShowRecap] = useState(false)
  const [phonemeSuccess, setPhonemeSuccess] = useState<Set<number>>(new Set())
  const [roadmapState, setRoadmapState] = useState<RoadmapState | null>(null)

  /** Ngưỡng vượt node — giữ nguyên v1. */
  const getRequiredTabs = (): { tab: ViewKey; threshold: number }[] => {
    const c = session?.content
    if (!c) return []
    const tabs: { tab: ViewKey; threshold: number }[] = []
    if (c.theory_cards?.length > 0 || c.vocabulary?.length > 0) tabs.push({ tab: 'grammar', threshold: 0 })
    if (c.reading_passage) tabs.push({ tab: 'reading', threshold: 100 })
    if (c.audio_content) tabs.push({ tab: 'listening', threshold: 100 })
    if (c.writing_prompt) tabs.push({ tab: 'writing', threshold: 80 })
    if (c.phrases?.length > 0 || c.examples?.length > 0) tabs.push({ tab: 'speaking', threshold: 80 })
    if (c.vocabulary?.length > 0) tabs.push({ tab: 'phoneme', threshold: 80 })
    return tabs
  }

  // Auto-hoàn thành khi đủ điều kiện (score-based) — giữ nguyên v1.
  useEffect(() => {
    if (!session?.content || showRecap) return
    const required = getRequiredTabs()
    if (required.length === 0) return

    const allAttempted = required.every(({ tab }) => tabCompletion[tab])
    const allPassed = required.every(({ tab, threshold }) =>
      threshold === 0 ? tabCompletion[tab] : tabScores[tab] >= threshold,
    )

    if (allAttempted && allPassed) {
      setShowRecap(true)
      trackFeatureAction('lesson', 'completed', {
        node_id: nodeId,
        node_title: session?.titleVi,
        cefr: targetLevel,
        tab_scores: tabScores,
        roadmap_percent: roadmapState?.percent,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tabCompletion, tabScores, showRecap])

  // Vị trí node trong lộ trình (GET /roadmap/me) — dùng cho thanh tiến độ + "bài kế tiếp".
  useEffect(() => {
    if (!nodeId) return
    let cancelled = false

    const loadRoadmapState = async () => {
      try {
        const { data } = await api.get('/roadmap/me')
        if (cancelled || !Array.isArray(data)) return
        const idx = data.findIndex((node: { id: number }) => node.id === nodeId)
        if (idx < 0) return
        // RoadmapNodeDto = { title (title_de), subtitle (title_vi), … } — KHÔNG có `titleVi`.
        // Bản v1 đọc `titleVi` nên nhánh tiếng Việt không bao giờ trúng và luôn rơi về tiêu đề Đức.
        const current = data[idx] as RoadmapDtoNode
        const next = data[idx + 1] as RoadmapDtoNode | undefined
        setRoadmapState({
          nodeId: current.id,
          title: current.subtitle || current.title || `Node ${current.id}`,
          index: idx + 1,
          total: data.length,
          percent: data.length > 0 ? Math.round(((idx + 1) / data.length) * 100) : 0,
          nextNodeId: next?.id ?? null,
          nextNodeTitle: next ? next.subtitle || next.title || null : null,
        })
      } catch {
        if (!cancelled) setRoadmapState(null)
      }
    }

    void loadRoadmapState()
    return () => {
      cancelled = true
    }
  }, [nodeId])

  useEffect(() => {
    if (!me || !nodeId) return
    reset()
    void fetchSession(nodeId)
    trackFeatureAction('lesson', 'started', { node_id: nodeId, cefr: targetLevel })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, nodeId])

  if (meLoading || !me) return <LoadingState label={tLearn('loading')} />

  const required = getRequiredTabs()
  const allAttempted = required.length > 0 && required.every(({ tab }) => tabCompletion[tab])
  const allPassed = required.every(({ tab, threshold }) =>
    threshold === 0 ? tabCompletion[tab] : tabScores[tab] >= threshold,
  )
  const showRetryBanner = allAttempted && !allPassed && !showRecap

  const vocab = session?.content?.vocabulary ?? []

  const handlePhonemeSuccess = (idx: number, score: number) => {
    if (score < 80) return
    setPhonemeSuccess((prev) => {
      const next = new Set(prev).add(idx)
      const totalWords = Math.min(vocab.length, 5)
      if (next.size >= totalWords * 0.8) markTabCompleted('phoneme', score)
      return next
    })
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={session?.titleVi ?? tLearn('lesson')}
        subtitle={session?.moduleTitleVi ?? tLearn('loadingNode')}
      />
      <div className="flex-1 px-10 py-6">
        <div className="mx-auto max-w-3xl space-y-[22px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.push('/v2/student/roadmap')}
              className="ga-ui inline-flex items-center gap-1.5 text-[13px] font-semibold text-ga-muted transition-colors hover:text-ga-ink"
            >
              <ArrowLeft size={15} aria-hidden /> {tLearn('backToRoadmap')}
            </button>

            {/* Cửa sang runner luyện 4 kỹ năng của chính node này. */}
            <button
              type="button"
              onClick={() => router.push(`/v2/student/practice/${nodeId}`)}
              className="ga-ui inline-flex items-center gap-1.5 rounded-ga border border-ga-line bg-ga-card px-3.5 py-2 text-[12.5px] font-semibold text-ga-ink transition-colors hover:bg-ga-surface"
            >
              <Dumbbell size={14} aria-hidden /> {t('toPractice')}
            </button>
          </div>

          {/* Đầu bài + vị trí trong lộ trình */}
          {session && (
            <GaCard className="p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-ga bg-ga-surface text-[24px]">
                  {session.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-ga-display text-[20px] font-medium leading-tight text-ga-ink">
                    {session.titleVi}
                  </p>
                  <p className="ga-ui mt-0.5 text-[13px] italic text-ga-muted">{session.titleDe}</p>
                  <div className="ga-ui mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded-ga-pill bg-ga-accent-soft px-2 py-0.5 font-bold text-ga-accent">
                      {session.cefrLevel}
                    </span>
                    {session.moduleNumber !== null && (
                      <span className="text-ga-subtle">
                        Module {session.moduleNumber} · {session.moduleTitleVi}
                      </span>
                    )}
                    <span className="text-ga-subtle">+{session.xpReward} XP</span>
                  </div>
                </div>
              </div>

              {roadmapState && (
                <div className="mt-4 border-t border-ga-line pt-4">
                  {/* `roadmapContext`/`completedInRoadmap` KHÔNG có trong namespace `learn` — trang v1
                      gọi hai khoá này nên next-intl in ra chính tên khoá. Ở đây khai báo trong
                      v2.student.learnNode (đủ 3 locale) thay vì bê nguyên lỗi sang. */}
                  <div className="ga-ui flex items-center justify-between gap-2 text-[12px]">
                    <GaCap>{t('roadmapContext')}</GaCap>
                    <span className="truncate text-ga-muted">{roadmapState.title}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="h-2 flex-1 overflow-hidden rounded-ga-pill bg-ga-border">
                      <span
                        className="block h-full rounded-ga-pill bg-ga-yellow"
                        style={{ width: `${roadmapState.percent}%` }}
                      />
                    </span>
                    <span className="ga-ui whitespace-nowrap text-[11.5px] font-semibold text-ga-ink">
                      {roadmapState.index}/{roadmapState.total}
                    </span>
                  </div>
                  <p className="ga-ui mt-1 text-[11.5px] text-ga-subtle">
                    {roadmapState.percent}% {t('completedInRoadmap')}
                  </p>
                </div>
              )}
            </GaCard>
          )}

          {loading && <LoadingState label={tLearn('loadingLesson')} />}

          {/* Bài chưa sinh xong (AI đang tạo) */}
          {error && !loading && (
            <GaCard className="px-6 py-14 text-center">
              <p className="font-ga-display text-[20px] font-medium text-ga-ink">{tLearn('aiCreating')}</p>
              <p className="ga-ui mt-2 text-[13.5px] text-ga-muted">{tLearn('comeBackLater')}</p>
              <button
                type="button"
                onClick={() => router.push('/v2/student/roadmap')}
                className="ga-ui mt-5 inline-flex items-center gap-2 rounded-ga bg-ga-accent px-5 py-2.5 text-[13.5px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90"
              >
                <ArrowLeft size={15} aria-hidden /> {tLearn('backToRoadmap')}
              </button>
            </GaCard>
          )}

          {/* Node A2/B1 chưa có nội dung */}
          {session && !session.hasContent && !loading && !error && (
            <GaCard className="px-6 py-12 text-center">
              <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-ga-surface text-[32px]">
                {session.emoji || '📖'}
              </span>
              <span className="ga-ui mb-2 inline-block rounded-ga-pill bg-ga-accent-soft px-2 py-0.5 text-[11px] font-bold text-ga-accent">
                {session.cefrLevel}
              </span>
              <p className="font-ga-display text-[20px] font-medium text-ga-ink">{session.titleVi}</p>
              <p className="ga-ui mt-1 text-[13.5px] italic text-ga-muted">{session.titleDe}</p>
              {session.descriptionVi && (
                <p className="ga-ui mx-auto mt-2 max-w-sm text-[13px] text-ga-subtle">
                  {session.descriptionVi}
                </p>
              )}
              <div className="mx-auto mt-5 max-w-sm rounded-ga border border-ga-line bg-ga-yellow-soft px-5 py-4">
                <p className="ga-ui text-[13.5px] font-semibold text-ga-ink">{t('contentPendingTitle')}</p>
                <p className="ga-ui mt-1 text-[12.5px] text-ga-muted">
                  {t('contentPendingDesc', { level: session.cefrLevel })}
                </p>
              </div>
            </GaCard>
          )}

          {/* 6 view học */}
          {session?.hasContent && session.content && (
            <>
              <div className="flex gap-1 overflow-x-auto rounded-ga bg-ga-surface p-1">
                {VIEW_TABS.map((tab) => {
                  const isDone = tabCompletion[tab.key]
                  const isActive = activeView === tab.key
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveView(tab.key)}
                      aria-pressed={isActive}
                      className={`ga-ui flex items-center gap-1.5 whitespace-nowrap rounded-ga px-3 py-2 text-[12.5px] font-semibold transition-colors ${
                        isActive
                          ? 'bg-ga-ink text-ga-bg'
                          : isDone
                            ? 'bg-ga-green-soft text-ga-green'
                            : 'text-ga-muted hover:bg-ga-card hover:text-ga-ink'
                      }`}
                    >
                      <span aria-hidden>{isDone ? '✅' : tab.emoji}</span>
                      <span className="hidden sm:inline">{tLearn(tab.tKey as never)}</span>
                    </button>
                  )
                })}
              </div>

              {showRetryBanner && (
                <div className="flex items-center justify-between gap-3 rounded-ga border border-ga-line bg-ga-yellow-soft p-4">
                  <div>
                    <p className="ga-ui text-[13.5px] font-semibold text-ga-ink">{t('retryTitle')}</p>
                    <p className="ga-ui mt-0.5 text-[12.5px] text-ga-muted">{t('retryDesc')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      resetTabCompletion()
                      setPhonemeSuccess(new Set())
                    }}
                    className="ga-ui shrink-0 rounded-ga bg-ga-accent px-4 py-2 text-[12.5px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90"
                  >
                    {t('retryCta')}
                  </button>
                </div>
              )}

              <div>
                {activeView === 'grammar' && (
                  <GrammarView content={session.content} isLocked={tabCompletion.grammar} />
                )}
                {activeView === 'reading' && (
                  <ReadingView content={session.content} isLocked={tabCompletion.reading} />
                )}
                {activeView === 'listening' && (
                  <ListeningView content={session.content} isLocked={tabCompletion.listening} />
                )}
                {activeView === 'speaking' && (
                  <SpeakingView content={session.content} isLocked={tabCompletion.speaking} />
                )}
                {activeView === 'writing' && (
                  <WritingView content={session.content} isLocked={tabCompletion.writing} />
                )}
                {activeView === 'phoneme' && (
                  <div className="space-y-4">
                    <p className="ga-ui text-center text-[12.5px] text-ga-muted">
                      {tLearn('practicePronunciation')}
                    </p>
                    <PhonemeCoach
                      target={vocab[0]?.german ?? session.titleDe ?? 'Guten Tag'}
                      meaningVi={vocab[0]?.meaning ?? ''}
                      onSuccess={(score) => handlePhonemeSuccess(0, score)}
                    />
                    {vocab.length > 1 && (
                      <div className="space-y-3">
                        <GaCap>{tLearn('otherWords')}</GaCap>
                        {vocab.slice(1, 5).map((v, i) => (
                          <PhonemeCoach
                            key={v.id ?? i + 1}
                            target={v.german}
                            meaningVi={v.meaning}
                            onSuccess={(score) => handlePhonemeSuccess(i + 1, score)}
                          />
                        ))}
                      </div>
                    )}
                    {tabCompletion.phoneme && (
                      <div className="rounded-ga border border-ga-line bg-ga-green-soft p-4 text-center">
                        <p className="ga-ui text-[13.5px] font-semibold text-ga-green">
                          {tLearn('phonemeSuccess')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!showRecap && (
                <p className="ga-ui text-center text-[12.5px] text-ga-subtle">{tLearn('completionHint')}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Recap khi vượt node */}
      {showRecap && session && (
        <SessionRecap
          xpEarned={session.xpReward ?? 150}
          vocabCount={session.content?.vocabulary?.length ?? 0}
          streakDays={streakDays}
          nextNodeTitle={roadmapState?.nextNodeTitle ?? undefined}
          onBack={() => {
            setShowRecap(false)
            router.push('/v2/student/roadmap')
          }}
          onNext={() => {
            setShowRecap(false)
            if (roadmapState?.nextNodeId) router.push(`/v2/student/learn/${roadmapState.nextNodeId}`)
            else router.push('/v2/student/roadmap')
          }}
        />
      )}
    </div>
  )
}
