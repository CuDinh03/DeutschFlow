'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArrowLeft, BookOpen, Check, ChevronRight, Clock, Play, Trophy, X, AlertCircle } from 'lucide-react'
import api from '@/lib/api'
import { useTracking } from '@/hooks/useTracking'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { DetailedScoreBreakdown } from '@/components/exam/DetailedScoreBreakdown'
import { ExamFeedback } from '@/components/exam/ExamFeedback'
import { WeakAreasRecommendation } from '@/components/exam/WeakAreasRecommendation'
import { GaCap, GaCard, GaPageHdr, LoadingState, TkBadge, TkSeg } from '@/components/ui-v2'
import { ExamRecoveryPanel, ExamTaking, SECTION_COLOR, type ActiveExamData } from './ExamTaking'

/**
 * /v2/student/mock-exam/run — the Goethe mock-exam RUNNER (Galerie shell).
 *
 * Port of the legacy /student/mock-exam page: same endpoints (/mock-exams · /start · /finish ·
 * /result · /review · /attempts/me · /recommend), same answer map, same timer/auto-submit rules.
 * Only the shell changed.
 *
 * Deep-link contract (both optional — with neither, the page behaves exactly like the legacy one):
 *   ?examId=<id>  → start that exam right away (POST /start is idempotent while an attempt is
 *                   IN_PROGRESS, so a reload resumes instead of spawning a second attempt).
 *   ?level=<CEFR> → preselect the level filter (the catalog knows the pack's level).
 *
 * PRO gating lives in the pack catalog (/v2/student/mock-exam marks locked packs) and on the
 * server — the legacy upsell banner is not re-rendered here.
 */

interface MockExam {
  id: number
  cefr_level: string
  exam_format: string
  title: string
  total_points: number
  pass_points: number
  time_limit_minutes: number
}

interface MockAttempt {
  id: number
  exam_id: number
  exam_title?: string
  started_at: string
  finished_at?: string
  total_score?: number
  passed?: boolean
  status: string
  detailed_scores_json?: string
  weak_areas?: string
  sections_json?: string
}

interface SectionScore {
  total?: number
  max?: number
  percentage?: number
  status?: string
  total_provisional?: number
  total_max?: number
}

interface ReviewItem {
  id: string
  prompt: string
  userAnswer: string | null
  correctAnswer: string
  isCorrect: boolean
  explanation?: string
}

interface ReviewSection {
  sectionName: string
  items: ReviewItem[]
}

interface ReviewData {
  attemptId: number
  totalScore: number
  sections: ReviewSection[]
}

const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const

/** Tolerates both a JSON string and an already-parsed object (the API has shipped both). */
function parseSections(raw: unknown): ActiveExamData | null {
  if (!raw) return null
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed?.sections ? (parsed as ActiveExamData) : null
  } catch {
    return null
  }
}

function MockExamRunner() {
  const t = useTranslations('v2.student.mockExamRun')
  const searchParams = useSearchParams()
  const deepLinkExamId = Number(searchParams.get('examId')) || null
  // `|| null` (không phải `??`): catalog phát `?level=` RỖNG khi pack thiếu cefrLevel — `??` sẽ
  // giữ nguyên chuỗi '' và khiến selectedLevel = '' → gọi /mock-exams?cefrLevel= (rỗng) trong khi
  // TkSeg vẫn hiển thị 'A1'. Chuỗi rỗng phải được coi là "không có deep-link level".
  const deepLinkLevel = searchParams.get('level')?.toUpperCase() || null

  const { trackFeatureAction, posthog } = useTracking()
  const { me, loading: meLoading, targetLevel } = useStudentPracticeSession()

  const [exams, setExams] = useState<MockExam[]>([])
  const [attempts, setAttempts] = useState<MockAttempt[]>([])
  const [recommendedExamId, setRecommendedExamId] = useState<number | null>(null)
  const [selectedLevel, setSelectedLevel] = useState<string>(deepLinkLevel ?? 'A1')
  const [loading, setLoading] = useState(true)

  const [view, setView] = useState<'list' | 'taking' | 'result' | 'review'>('list')
  const [selectedAttempt, setSelectedAttempt] = useState<MockAttempt | null>(null)
  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)

  const [activeExamData, setActiveExamData] = useState<ActiveExamData | null>(null)
  const [activeAttemptId, setActiveAttemptId] = useState<number | null>(null)
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const submittedByTimerRef = useRef(false)
  const autoStartedRef = useRef(false)

  // Sync the level filter with the user's target level once it loads — unless the deep link
  // already pinned one (the catalog knows which level the user picked).
  useEffect(() => {
    if (!deepLinkLevel && targetLevel && !meLoading) setSelectedLevel(targetLevel)
  }, [deepLinkLevel, targetLevel, meLoading])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [examRes, attRes, recRes] = await Promise.allSettled([
        api.get<MockExam[]>(`/mock-exams?cefrLevel=${selectedLevel}`),
        api.get<MockAttempt[]>('/mock-exams/attempts/me'),
        api.get<{ recommendedExamId: number }>(`/mock-exams/recommend?cefrLevel=${selectedLevel}`),
      ])
      if (examRes.status === 'fulfilled') setExams(examRes.value.data ?? [])
      if (attRes.status === 'fulfilled') setAttempts(attRes.value.data ?? [])
      if (recRes.status === 'fulfilled') {
        const recId = recRes.value.data?.recommendedExamId
        setRecommendedExamId(recId && recId > 0 ? recId : null)
      }
    } finally {
      setLoading(false)
    }
  }, [selectedLevel])

  useEffect(() => {
    if (me) void load()
  }, [me, load])

  const submitExam = useCallback(
    async (autoSubmit = false) => {
      if (!activeAttemptId) return
      if (!autoSubmit && !confirm(t('confirmSubmit'))) return

      setSubmitting(true)
      try {
        await api.post(`/mock-exams/attempts/${activeAttemptId}/finish`, { answers })
        const finished = await api.get<MockAttempt>(`/mock-exams/attempts/${activeAttemptId}/result`)
        setSelectedAttempt(finished.data)
        setView('result')
        await load()
        trackFeatureAction('mock_exam', 'completed', {
          examId: activeAttemptId,
          totalScore: finished.data?.total_score,
        })
      } catch {
        toast.error(t('submitError'))
      } finally {
        setSubmitting(false)
      }
    },
    [activeAttemptId, answers, load, t, trackFeatureAction],
  )

  // Interval: one timer per 'taking' session; never re-registers on every tick
  useEffect(() => {
    if (view !== 'taking') return
    const timerId = setInterval(() => setTimeLeft((prev) => Math.max(0, prev - 1)), 1000)
    return () => clearInterval(timerId)
  }, [view])

  // Expiry: submit once when time runs out — side-effects must not live inside state updaters
  useEffect(() => {
    if (view === 'taking' && timeLeft === 0 && !submittedByTimerRef.current) {
      submittedByTimerRef.current = true
      void submitExam(true)
    }
  }, [view, timeLeft, submitExam])

  useEffect(() => {
    return () => {
      if (view === 'taking') trackFeatureAction('mock_exam', 'quit', { examId: activeAttemptId })
    }
  }, [view, activeAttemptId, trackFeatureAction])

  /**
   * Starts (or resumes) an exam. `fallbackMinutes` comes from the exam row when we have it;
   * the /start response carries `time_limit_minutes` for the deep-link path where we don't.
   */
  const startExam = useCallback(
    async (examId: number, fallbackMinutes?: number, title?: string) => {
      try {
        setLoading(true)
        const res = await api.post(`/mock-exams/${examId}/start`)
        const attempt = res.data

        let sections = parseSections(attempt?.sections_json)
        if (!sections) {
          // Fallback: fetch the questions explicitly when /start didn't carry sections_json
          const qRes = await api.get(`/mock-exams/${examId}/questions`)
          sections = parseSections(qRes.data?.sections_json)
        }
        if (!sections) {
          toast.error(t('noContent'))
          return
        }

        const minutes = fallbackMinutes ?? (typeof attempt?.time_limit_minutes === 'number' ? attempt.time_limit_minutes : 60)
        submittedByTimerRef.current = false
        setActiveAttemptId(attempt.id)
        setActiveExamData(sections)
        setCurrentSectionIdx(0)
        setTimeLeft(minutes * 60)
        setAnswers({})
        setView('taking')
        trackFeatureAction('mock_exam', 'started', { examId, title })
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        toast.error(msg ?? t('startError'))
      } finally {
        setLoading(false)
      }
    },
    [t, trackFeatureAction],
  )

  // Deep link from the pack catalog: enter the exam directly. Guarded by a ref so React's
  // dev double-mount (and any re-render) can't fire a second /start.
  useEffect(() => {
    if (!me || !deepLinkExamId || autoStartedRef.current) return
    autoStartedRef.current = true
    void startExam(deepLinkExamId)
  }, [me, deepLinkExamId, startExam])

  const resumeExam = (att: MockAttempt) => {
    const exam = exams.find((e) => e.id === att.exam_id)
    void startExam(att.exam_id, exam?.time_limit_minutes, exam?.title)
  }

  const viewReview = async (attemptId: number) => {
    setReviewLoading(true)
    try {
      const res = await api.get<ReviewData>(`/mock-exams/attempts/${attemptId}/review`)
      setReviewData(res.data)
      setView('review')
    } catch {
      toast.error(t('reviewError'))
    } finally {
      setReviewLoading(false)
    }
  }

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers])
  const totalQuestions = useMemo(() => {
    if (!activeExamData?.sections) return 0
    return activeExamData.sections.reduce(
      (sum, s) => sum + (s.teile?.reduce((n, teil) => n + (teil.items?.length ?? 0), 0) ?? 0),
      0,
    )
  }, [activeExamData])

  if (meLoading || !me) return <LoadingState label={t('loading')} />

  // Taking = immersive full-screen overlay (covers the Galerie shell), like the legacy runner.
  if (view === 'taking') {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden bg-ga-bg">
        <ErrorBoundary
          onError={(error, info) => {
            // Self-diagnosing: surface the real error + exam context to PostHog so a
            // recurrence is actionable (the route-level boundary only exposes a digest).
            posthog?.capture('mock_exam_render_error', {
              feature: 'mock_exam',
              surface: 'v2',
              attempt_id: activeAttemptId,
              section_index: currentSectionIdx,
              answered_count: answeredCount,
              message: error.message,
              stack: error.stack,
              component_stack: info.componentStack,
            })
          }}
          fallback={(reset) => (
            <ExamRecoveryPanel
              title={t('recoveryRenderTitle')}
              message={t('recoveryRenderDesc')}
              onRetry={reset}
              onSubmit={() => submitExam(true)}
              onExit={() => setView('list')}
              submitting={submitting}
            />
          )}
        >
          <ExamTaking
            data={activeExamData}
            currentSectionIdx={currentSectionIdx}
            onSectionChange={setCurrentSectionIdx}
            answers={answers}
            onAnswerChange={handleAnswerChange}
            timeLeft={timeLeft}
            submitting={submitting}
            onSubmit={submitExam}
            onExit={() => setView('list')}
            answeredCount={answeredCount}
            totalQuestions={totalQuestions}
          />
        </ErrorBoundary>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <div className="flex-1 px-10 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {view === 'review' && reviewData ? (
            <>
              <button
                type="button"
                onClick={() => setView('result')}
                className="ga-ui inline-flex items-center gap-2 text-[13px] font-semibold text-ga-muted hover:text-ga-ink"
              >
                <ArrowLeft size={16} aria-hidden /> {t('backToResult')}
              </button>

              <GaCard className="px-6 py-5">
                <h2 className="font-ga-display text-[22px] font-medium text-ga-ink">{t('reviewTitle')}</h2>
                <p className="ga-ui mt-1 text-[13px] text-ga-muted">{t('reviewTotal', { score: reviewData.totalScore })}</p>
              </GaCard>

              {reviewData.sections.map((section) => (
                <div key={section.sectionName} className="space-y-3">
                  <GaCap className="block" style={{ color: SECTION_COLOR[section.sectionName.toUpperCase()] }}>
                    {section.sectionName}
                  </GaCap>

                  {section.items.map((item, qIdx) => (
                    <div
                      key={item.id}
                      className="space-y-3 rounded-ga border bg-ga-card p-5"
                      style={{ borderColor: item.isCorrect ? 'var(--ga-green)' : 'var(--ga-red)' }}
                    >
                      <p className="ga-ui text-[14px] font-semibold text-ga-ink">
                        {qIdx + 1}. {item.prompt}
                      </p>

                      <div className="flex items-center gap-2">
                        {item.userAnswer === null ? (
                          <TkBadge tone="neutral">{t('notAnswered')}</TkBadge>
                        ) : item.isCorrect ? (
                          <TkBadge tone="green">
                            <Check size={12} strokeWidth={3} aria-hidden /> {item.userAnswer}
                          </TkBadge>
                        ) : (
                          <TkBadge tone="red">
                            <X size={12} strokeWidth={3} aria-hidden /> {item.userAnswer}
                          </TkBadge>
                        )}
                        <span className="ga-ui text-[12px] text-ga-subtle">{t('yourAnswer')}</span>
                      </div>

                      {!item.isCorrect && (
                        <div className="flex items-center gap-2">
                          <TkBadge tone="green">
                            <Check size={12} strokeWidth={3} aria-hidden /> {item.correctAnswer}
                          </TkBadge>
                          <span className="ga-ui text-[12px] text-ga-subtle">{t('correctAnswer')}</span>
                        </div>
                      )}

                      {item.explanation && (
                        <p className="ga-ui border-t border-ga-border pt-2 text-[12.5px] italic text-ga-muted">
                          {item.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </>
          ) : view === 'result' && selectedAttempt ? (
            <>
              <button
                type="button"
                onClick={() => setView('list')}
                className="ga-ui inline-flex items-center gap-2 text-[13px] font-semibold text-ga-muted hover:text-ga-ink"
              >
                <ArrowLeft size={16} aria-hidden /> {t('back')}
              </button>

              <div
                className="rounded-ga p-6 text-white"
                style={{ background: selectedAttempt.passed ? 'var(--ga-green)' : 'var(--ga-ink)' }}
              >
                <div className="flex items-center gap-3">
                  {selectedAttempt.passed ? <Trophy size={28} aria-hidden /> : <AlertCircle size={28} aria-hidden />}
                  <div>
                    <p className="font-ga-display text-[22px] font-medium">
                      {selectedAttempt.passed ? t('resultPassed') : t('resultFailed')}
                    </p>
                    <p className="ga-ui text-[13px] opacity-80">
                      {t('provisional', { score: selectedAttempt.total_score ?? '—' })}
                    </p>
                  </div>
                </div>
                <p className="ga-ui mt-3 text-[12px] opacity-70">{t('provisionalNote')}</p>
              </div>

              {(() => {
                let detailedScores: Record<string, SectionScore> = {}
                if (selectedAttempt.detailed_scores_json) {
                  try {
                    detailedScores = JSON.parse(selectedAttempt.detailed_scores_json)
                  } catch {}
                }
                if (Object.keys(detailedScores).length === 0) return null
                return (
                  <>
                    <DetailedScoreBreakdown
                      detailedScores={detailedScores}
                      totalScore={selectedAttempt.total_score ?? 0}
                      passed={selectedAttempt.passed ?? false}
                    />
                    <ExamFeedback detailedScores={detailedScores as Record<string, unknown>} />
                  </>
                )
              })()}

              {(() => {
                let weakAreas: string[] = []
                if (selectedAttempt.weak_areas) {
                  try {
                    weakAreas = JSON.parse(selectedAttempt.weak_areas)
                  } catch {}
                }
                return <WeakAreasRecommendation weakAreas={weakAreas} />
              })()}

              <button
                type="button"
                onClick={() => viewReview(selectedAttempt.id)}
                disabled={reviewLoading}
                className="ga-ui flex w-full items-center justify-center gap-2 rounded-ga border border-ga-line bg-ga-card py-3 text-[13.5px] font-semibold text-ga-accent transition-colors hover:bg-ga-surface disabled:opacity-60"
              >
                <BookOpen size={16} aria-hidden /> {t('viewAnswers')}
              </button>
            </>
          ) : (
            <>
              {/* Available exams */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <GaCap>{t('availableCap')}</GaCap>
                  <TkSeg
                    aria-label={t('availableCap')}
                    options={LEVELS.map((l) => ({ value: l, label: l }))}
                    value={LEVELS.includes(selectedLevel as (typeof LEVELS)[number]) ? (selectedLevel as (typeof LEVELS)[number]) : 'A1'}
                    onValueChange={(v) => setSelectedLevel(v)}
                  />
                </div>

                {loading ? (
                  <LoadingState label={t('loading')} />
                ) : exams.length === 0 ? (
                  <div className="rounded-ga border border-ga-line bg-ga-card py-14 text-center">
                    <p className="font-ga-display text-[20px] font-medium text-ga-ink">{t('emptyTitle')}</p>
                    <p className="ga-ui mt-2 text-[13px] text-ga-muted">{t('emptyDesc', { level: selectedLevel })}</p>
                  </div>
                ) : (
                  exams.map((exam) => {
                    const isRecommended = exam.id === recommendedExamId
                    return (
                      <GaCard
                        key={exam.id}
                        className="flex items-start justify-between gap-4 p-5"
                        style={isRecommended ? { borderColor: 'var(--ga-accent)' } : undefined}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[15px] font-semibold text-ga-ink">{exam.title}</p>
                            {isRecommended && <TkBadge tone="yellow">{t('recommended')}</TkBadge>}
                          </div>
                          <p className="ga-ui mt-1 flex flex-wrap items-center gap-3 text-[12.5px] text-ga-muted">
                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} aria-hidden /> {t('minutes', { minutes: exam.time_limit_minutes })}
                            </span>
                            <span>{t('passPoints', { pass: exam.pass_points, total: exam.total_points })}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => startExam(exam.id, exam.time_limit_minutes, exam.title)}
                          className="ga-ui inline-flex shrink-0 items-center gap-2 rounded-ga bg-ga-accent px-5 py-2.5 text-[13px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90"
                        >
                          <Play size={15} aria-hidden /> {t('start')}
                        </button>
                      </GaCard>
                    )
                  })
                )}
              </div>

              {/* Attempt history */}
              {attempts.length > 0 && (
                <div className="space-y-3">
                  <GaCap className="block">{t('historyCap')}</GaCap>
                  <div className="border border-ga-line bg-ga-card">
                    {attempts.map((att, i) => (
                      <div
                        key={att.id}
                        className={`flex items-center justify-between gap-4 px-5 py-4 ${i ? 'border-t border-ga-border' : ''}`}
                      >
                        <div className="min-w-0">
                          <p className="ga-ui text-[14px] font-semibold text-ga-ink">
                            {att.passed ? t('passed') : att.status === 'COMPLETED' ? t('failed') : t('inProgress')}
                          </p>
                          <p className="ga-ui mt-0.5 text-[12px] text-ga-subtle">
                            {new Date(att.started_at).toLocaleString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-4">
                          <p className="font-ga-display text-[18px] font-medium text-ga-ink">
                            {att.total_score ?? '—'}{' '}
                            <span className="ga-ui text-[12px] text-ga-subtle">{t('points')}</span>
                          </p>
                          {att.status === 'COMPLETED' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAttempt(att)
                                setView('result')
                              }}
                              className="ga-ui inline-flex items-center gap-1 rounded-ga border border-ga-line px-3 py-1.5 text-[12px] font-semibold text-ga-accent transition-colors hover:bg-ga-surface"
                            >
                              {t('detail')} <ChevronRight size={12} strokeWidth={3} aria-hidden />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => resumeExam(att)}
                              className="ga-ui inline-flex items-center gap-1 rounded-ga border border-ga-line px-3 py-1.5 text-[12px] font-semibold transition-colors hover:bg-ga-surface"
                              style={{ color: 'var(--ga-green)' }}
                            >
                              {t('resume')} <Play size={12} aria-hidden />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// useSearchParams() forces this subtree into client-side bailout — without <Suspense> the
// production build fails at the prerender step.
export default function V2StudentMockExamRunPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <MockExamRunner />
    </Suspense>
  )
}
