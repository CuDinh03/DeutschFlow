'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, CheckCircle2, ChevronRight, XCircle } from 'lucide-react'
import api from '@/lib/api'
import { useTracking } from '@/hooks/useTracking'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { GaCap, GaCard, GaPageHdr, LoadingState, TkSeg } from '@/components/ui-v2'

/**
 * /v2/student/grammar/practice — the grammar-syllabus RUNNER (Galerie shell).
 *
 * Port of the legacy /student/grammar page: same endpoints (GET /grammar/syllabus/topics ·
 * /topics/{id}/exercises?limit=10 · POST /grammar/syllabus/exercises/{id}/submit), same
 * "recommend the 6 weakest topics (mastery < 80%)" rule, same one-question-at-a-time loop.
 *
 * Deep-link contract: the legacy page took NO params (topic is picked in-page), so this route
 * works param-free too. `?cefr=<A1|A2|B1|B2>` is the one addition — it only preselects the level
 * tab (the catalog at /v2/student/grammar knows the topic's level).
 */

interface GrammarTopic {
  id: number
  cefr_level: string
  topic_code: string
  title_de: string
  title_vi: string
  description_vi: string
  exercises_done: number
  exercises_correct: number
  mastery_percent: number
  total_exercises: number
}

interface Exercise {
  id: number
  exercise_type: 'FILL_BLANK' | 'MULTIPLE_CHOICE' | 'TRANSLATE'
  difficulty: number
  question_json: string
}

interface ParsedQuestion {
  prompt: string
  options?: string[]
  correct_answer: string
  explanation_vi: string
  explanation_de?: string
}

interface SubmitResult {
  correct: boolean
  correctAnswer: string
  explanation: string
}

const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const
type Level = (typeof LEVELS)[number]

/** Mastery colour ramp — same thresholds as the legacy MasteryBar (80 / 50). */
function masteryColor(percent: number) {
  if (percent >= 80) return 'var(--ga-green)'
  if (percent >= 50) return 'var(--ga-orange)'
  return 'var(--ga-accent)'
}

function GrammarPractice() {
  const t = useTranslations('v2.student.grammarPractice')
  const searchParams = useSearchParams()
  const deepLinkCefr = searchParams.get('cefr')?.toUpperCase() ?? null

  const { me, loading: meLoading } = useStudentPracticeSession()
  const { trackFeatureAction } = useTracking()

  const [cefr, setCefr] = useState<Level>(
    LEVELS.includes(deepLinkCefr as Level) ? (deepLinkCefr as Level) : 'A1',
  )
  const [topics, setTopics] = useState<GrammarTopic[]>([])
  const [loading, setLoading] = useState(true)

  const [activeTopic, setActiveTopic] = useState<GrammarTopic | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [exLoading, setExLoading] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sessionScore, setSessionScore] = useState({ correct: 0, total: 0 })

  const fetchTopics = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<GrammarTopic[]>(`/grammar/syllabus/topics?cefrLevel=${cefr}`)
      setTopics(data ?? [])
    } catch {
      setTopics([])
    } finally {
      setLoading(false)
    }
  }, [cefr])

  useEffect(() => {
    if (me) void fetchTopics()
  }, [me, fetchTopics])

  // Only the weakest topics are offered — the legacy page deliberately caps the list at 6 to
  // avoid overload.
  const recommendedTopics = useMemo(
    () =>
      topics
        .filter((topic) => topic.mastery_percent < 80)
        .sort((a, b) => a.mastery_percent - b.mastery_percent)
        .slice(0, 6),
    [topics],
  )

  const resetTopic = useCallback(() => {
    setActiveTopic(null)
    setExercises([])
    setCurrentIdx(0)
    setAnswer('')
    setResult(null)
    setSessionScore({ correct: 0, total: 0 })
  }, [])

  const openTopic = async (topic: GrammarTopic) => {
    setActiveTopic(topic)
    setCurrentIdx(0)
    setAnswer('')
    setResult(null)
    setSessionScore({ correct: 0, total: 0 })
    setExLoading(true)
    trackFeatureAction('grammar', 'started', { topicId: topic.id, title: topic.title_de })
    try {
      const { data } = await api.get<Exercise[]>(`/grammar/syllabus/topics/${topic.id}/exercises?limit=10`)
      setExercises(data ?? [])
    } catch {
      setExercises([])
    } finally {
      setExLoading(false)
    }
  }

  const submit = async () => {
    if (!answer.trim() || !exercises[currentIdx]) return
    setSubmitting(true)
    try {
      const { data } = await api.post<SubmitResult>(
        `/grammar/syllabus/exercises/${exercises[currentIdx].id}/submit`,
        { answer },
      )
      setResult(data)
      setSessionScore((s) => ({ correct: s.correct + (data.correct ? 1 : 0), total: s.total + 1 }))
    } finally {
      setSubmitting(false)
    }
  }

  const next = () => {
    if (currentIdx < exercises.length - 1) {
      setCurrentIdx((i) => i + 1)
      setAnswer('')
      setResult(null)
      return
    }
    if (activeTopic) {
      trackFeatureAction('grammar', 'completed', {
        topicId: activeTopic.id,
        score: sessionScore.correct,
        total: sessionScore.total,
      })
    }
    resetTopic()
    void fetchTopics()
  }

  if (meLoading || !me) return <LoadingState label={t('loading')} />

  const currentEx = exercises[currentIdx]
  const prompt: ParsedQuestion | null = currentEx
    ? (() => {
        try {
          return JSON.parse(currentEx.question_json)
        } catch {
          return null
        }
      })()
    : null
  const progress = exercises.length > 0 ? (currentIdx / exercises.length) * 100 : 0

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <div className="flex-1 px-10 py-6">
        <div className="mx-auto max-w-2xl space-y-[22px]">
          {!activeTopic ? (
            <>
              <div className="flex items-center justify-between">
                <GaCap>{t('topicsCap')}</GaCap>
                <TkSeg
                  aria-label={t('levelLabel')}
                  options={LEVELS.map((l) => ({ value: l, label: l }))}
                  value={cefr}
                  onValueChange={setCefr}
                />
              </div>

              {loading ? (
                <LoadingState label={t('loadingTopics')} />
              ) : recommendedTopics.length === 0 ? (
                <div className="rounded-ga border border-ga-line bg-ga-card py-14 text-center">
                  <p className="font-ga-display text-[20px] font-medium text-ga-ink">{t('emptyTitle', { level: cefr })}</p>
                  <p className="ga-ui mt-2 text-[13px] text-ga-muted">{t('emptyDesc')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendedTopics.map((topic) => (
                    <GaCard key={topic.id} hover className="overflow-hidden">
                      <button
                        type="button"
                        onClick={() => openTopic(topic)}
                        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-ga-surface"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold text-ga-ink">{topic.title_de}</p>
                          <p className="ga-ui mt-0.5 truncate text-[13px] text-ga-muted">{topic.title_vi}</p>
                          <div className="mt-2 flex items-center gap-3">
                            <span className="h-1.5 w-40 overflow-hidden rounded-ga-pill bg-ga-border">
                              <span
                                className="block h-full rounded-ga-pill"
                                style={{
                                  width: `${topic.mastery_percent}%`,
                                  background: masteryColor(topic.mastery_percent),
                                }}
                              />
                            </span>
                            <span className="ga-ui text-[12px] text-ga-subtle">
                              {t('mastery', { percent: topic.mastery_percent })}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={18} className="shrink-0 text-ga-subtle" aria-hidden />
                      </button>
                    </GaCard>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Exercise runner */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    trackFeatureAction('grammar', 'quit', { topicId: activeTopic.id, progress: currentIdx })
                    resetTopic()
                  }}
                  className="grid h-9 w-9 place-items-center rounded-ga border border-ga-line bg-ga-card text-ga-muted transition-colors hover:bg-ga-surface"
                  aria-label={t('back')}
                >
                  <ArrowLeft size={16} aria-hidden />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ga-ink">{activeTopic.title_de}</p>
                  <p className="ga-ui truncate text-[12.5px] text-ga-muted">{activeTopic.title_vi}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="ga-ui text-[14px] font-semibold text-ga-ink">
                    {currentIdx + 1}/{exercises.length}
                  </p>
                  <p className="ga-ui text-[12px] text-ga-subtle">
                    {t('scoreLine', { correct: sessionScore.correct, total: sessionScore.total })}
                  </p>
                </div>
              </div>

              {exLoading ? (
                <LoadingState label={t('loadingExercises')} />
              ) : !prompt ? (
                <div className="rounded-ga border border-ga-line bg-ga-card py-14 text-center">
                  <p className="font-ga-display text-[20px] font-medium text-ga-ink">{t('noExercises')}</p>
                </div>
              ) : (
                <>
                  <div className="h-1.5 overflow-hidden rounded-ga-pill bg-ga-border">
                    <div className="h-full rounded-ga-pill bg-ga-accent transition-[width]" style={{ width: `${progress}%` }} />
                  </div>

                  <GaCard className="p-6">
                    <GaCap className="mb-3 block">{prompt.options ? t('typeChoice') : t('typeOpen')}</GaCap>
                    <p className="font-ga-display text-[22px] font-medium leading-snug text-ga-ink">{prompt.prompt}</p>

                    {prompt.options?.length ? (
                      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {prompt.options.map((option) => {
                          const isSelected = answer === option
                          const isCorrect = result && option === result.correctAnswer
                          const isWrong = result && isSelected && !result.correct
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => !result && setAnswer(option)}
                              disabled={!!result}
                              className="ga-ui rounded-ga border-2 px-4 py-3 text-left text-[14px] font-medium transition-colors"
                              style={{
                                borderColor: isCorrect
                                  ? 'var(--ga-green)'
                                  : isWrong
                                    ? 'var(--ga-red)'
                                    : isSelected
                                      ? 'var(--ga-accent)'
                                      : 'var(--ga-line)',
                                color: isCorrect
                                  ? 'var(--ga-green)'
                                  : isWrong
                                    ? 'var(--ga-red)'
                                    : isSelected
                                      ? 'var(--ga-accent)'
                                      : 'var(--ga-ink)',
                              }}
                            >
                              {option}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <input
                        value={answer}
                        onChange={(e) => !result && setAnswer(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !result && submit()}
                        placeholder={t('answerPlaceholder')}
                        disabled={!!result}
                        className="ga-ui mt-5 w-full rounded-ga border-2 border-ga-line bg-ga-card px-4 py-3 text-[14px] text-ga-ink outline-none focus:border-ga-accent disabled:opacity-70"
                      />
                    )}

                    {!result && (
                      <button
                        type="button"
                        onClick={submit}
                        disabled={!answer.trim() || submitting}
                        className="ga-ui mt-4 w-full rounded-ga bg-ga-accent py-3 text-[13.5px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {submitting ? t('checking') : t('check')}
                      </button>
                    )}
                  </GaCard>

                  {result && (
                    <div
                      className="rounded-ga border-2 p-5"
                      style={{
                        borderColor: result.correct ? 'var(--ga-green)' : 'var(--ga-red)',
                        background: result.correct ? 'var(--ga-green-soft)' : 'var(--ga-red-soft)',
                      }}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        {result.correct ? (
                          <CheckCircle2 size={20} style={{ color: 'var(--ga-green)' }} aria-hidden />
                        ) : (
                          <XCircle size={20} style={{ color: 'var(--ga-red)' }} aria-hidden />
                        )}
                        <p
                          className="ga-ui text-[14px] font-semibold"
                          style={{ color: result.correct ? 'var(--ga-green)' : 'var(--ga-red)' }}
                        >
                          {result.correct ? t('correct') : t('incorrect')}
                        </p>
                      </div>
                      {!result.correct && (
                        <p className="ga-ui mb-2 text-[14px] font-semibold text-ga-ink">
                          {t('answerIs')}{' '}
                          <span style={{ color: 'var(--ga-green)' }}>{result.correctAnswer}</span>
                        </p>
                      )}
                      {result.explanation && (
                        <p className="ga-ui text-[13.5px] text-ga-muted">{String(result.explanation)}</p>
                      )}
                      <button
                        type="button"
                        onClick={next}
                        className="ga-ui mt-4 flex w-full items-center justify-center gap-2 rounded-ga py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ background: result.correct ? 'var(--ga-green)' : 'var(--ga-accent)' }}
                      >
                        {t('next')} <ChevronRight size={16} aria-hidden />
                      </button>
                    </div>
                  )}
                </>
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
export default function V2StudentGrammarPracticePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <GrammarPractice />
    </Suspense>
  )
}
