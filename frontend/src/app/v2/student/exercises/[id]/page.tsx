'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Check, ExternalLink, Trophy, X } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import {
  gradableQuestions,
  gradePractice,
  parsePracticeContent,
  practiceApi,
  type PracticeAnswers,
  type PracticeContent,
  type PracticeExercise,
  type PracticeGrade,
} from '@/lib/practiceApi'
import { useTracking } from '@/hooks/useTracking'
import {
  EmptyState,
  ErrorBanner,
  GaBtn,
  GaCap,
  GaCard,
  GaPageHdr,
  LoadingState,
  TkBadge,
} from '@/components/ui-v2'

/**
 * /v2/student/exercises/[id] — làm một bài tập bổ trợ.
 *
 * GET /practice/exercises/{id} → parse `contentJson` → render đề → CHẤM THẬT trên `correctAnswer`
 * do API trả về → POST /practice/submit { practiceId, scorePercent, answerDataJson }.
 * Backend nhân XP theo tỉ lệ điểm (PracticeService: earnedXp = score/100 * xpReward), nên chấm
 * thật là điều kiện để XP có ý nghĩa.
 *
 * ⚠️ v1 KHÔNG có màn này: `/student/practice` POST thẳng `scorePercent: 100` từ thẻ danh sách,
 * không hiện lấy một câu hỏi. Đây là chỗ sửa bug, không phải "cải tiến ngoài phạm vi" — port
 * nguyên si sẽ bê theo lỗ hổng phát XP miễn phí.
 *
 * Bài KHÔNG có `correctAnswer` (tài nguyên ngoài: chỉ có source_url, không có đề trong DB) thì
 * KHÔNG chấm được — giữ nguyên hành vi v1: mở nguồn + tự xác nhận hoàn thành (100%). Không bịa
 * đáp án cho dữ liệu API không trả.
 */

export default function V2StudentExerciseRunnerPage() {
  const t = useTranslations('v2.student.exercises')
  const router = useRouter()
  const params = useParams()
  const { trackFeatureAction } = useTracking()

  const exerciseId = Number(params?.id)

  const [exercise, setExercise] = useState<PracticeExercise | null>(null)
  const [content, setContent] = useState<PracticeContent | null>(null)
  const [answers, setAnswers] = useState<PracticeAnswers>({})
  const [grade, setGrade] = useState<PracticeGrade | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!Number.isFinite(exerciseId)) {
      setError(t('notFound'))
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const ex = await practiceApi.get(exerciseId)
      setExercise(ex)
      setContent(parsePracticeContent(ex.contentJson))
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [exerciseId, t])

  useEffect(() => {
    void load()
  }, [load])

  const questions = useMemo(() => content?.questions ?? [], [content])
  /** Chỉ chấm được câu API có trả đáp án đúng. */
  const gradable = useMemo(() => gradableQuestions(questions), [questions])
  const canGrade = gradable.length > 0
  const allAnswered = gradable.every((q) => (answers[q.id] ?? '').trim().length > 0)

  const handleSubmit = async () => {
    if (!exercise || submitting) return
    setSubmitting(true)
    setSubmitError(null)

    // Bài chấm được → điểm thật. Bài "tài nguyên ngoài" (không có đáp án) → giữ hành vi v1 (100%).
    const result = canGrade ? gradePractice(questions, answers) : null
    const scorePercent = result ? result.scorePercent : 100

    try {
      await practiceApi.submit({
        practiceId: exercise.id,
        scorePercent,
        answerDataJson: JSON.stringify({
          answers,
          correct: result?.correct ?? null,
          total: result?.total ?? null,
          scorePercent,
          graded: canGrade,
        }),
      })
      setGrade(result ?? { correct: 0, total: 0, scorePercent, perQuestion: {} })
      trackFeatureAction('practice_exercise', 'completed', { exerciseId: exercise.id })
    } catch (e) {
      setSubmitError(apiMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const heading = exercise?.examName || content?.title || t('title')

  if (loading) {
    return (
      <div className="flex min-h-full flex-col">
        <GaPageHdr accent title={t('title')} />
        <div className="flex-1 px-10 py-6">
          <LoadingState label={t('loading')} />
        </div>
      </div>
    )
  }

  if (error || !exercise) {
    return (
      <div className="flex min-h-full flex-col">
        <GaPageHdr accent title={t('title')} />
        <div className="flex-1 space-y-5 px-10 py-6">
          <ErrorBanner message={error ?? t('notFound')} onRetry={() => void load()} />
          <GaBtn variant="ghost" onClick={() => router.push('/v2/student/exercises')}>
            <ArrowLeft size={15} aria-hidden />
            {t('backToLibrary')}
          </GaBtn>
        </div>
      </div>
    )
  }

  const earnedXp = grade ? Math.round((grade.scorePercent / 100) * exercise.xpReward) : 0

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        eyebrow={`${exercise.cefrLevel} · ${exercise.skillType}`}
        title={heading}
        subtitle={content?.instructions}
        right={
          <GaBtn variant="ghost" onClick={() => router.push('/v2/student/exercises')}>
            <ArrowLeft size={15} aria-hidden />
            {t('backToLibrary')}
          </GaBtn>
        }
      />

      <div className="flex-1 px-10 py-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {/* Kết quả sau khi nộp */}
          {grade && (
            <GaCard className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-ga-pill bg-ga-yellow-soft text-ga-gold">
                <Trophy size={28} aria-hidden />
              </span>
              <p className="font-ga-display text-[24px] font-medium text-ga-ink">
                {canGrade
                  ? t('resultTitle', { correct: grade.correct, total: grade.total })
                  : t('resultMarkedDone')}
              </p>
              <p className="ga-ui text-[13px] text-ga-muted">
                {t('resultXp', { score: grade.scorePercent, xp: earnedXp })}
              </p>
              <GaBtn onClick={() => router.push('/v2/student/exercises')}>{t('backToLibrary')}</GaBtn>
            </GaCard>
          )}

          {/* Bài đọc (nếu có) */}
          {content?.readingText && (
            <GaCard className="p-7">
              <GaCap className="mb-3 block">{t('readingCap')}</GaCap>
              <p className="ga-ui whitespace-pre-line text-[15px] leading-relaxed text-ga-ink">
                {content.readingText}
              </p>
            </GaCard>
          )}

          {/* Đề bài — chỉ khi API trả câu hỏi */}
          {questions.length > 0 ? (
            <div className="space-y-4">
              {questions.map((q, idx) => {
                const picked = answers[q.id] ?? ''
                const isGradable = !!q.correctAnswer
                const verdict = grade && isGradable ? grade.perQuestion[q.id] : undefined

                return (
                  <GaCard key={q.id} className="space-y-4 p-6">
                    <div className="flex items-start justify-between gap-3">
                      <p className="ga-ui text-[15px] font-semibold text-ga-ink">
                        {idx + 1}. {q.question}
                      </p>
                      {verdict !== undefined && (
                        <TkBadge tone={verdict ? 'green' : 'red'}>
                          {verdict ? <Check size={13} aria-hidden /> : <X size={13} aria-hidden />}
                          {verdict ? t('correct') : t('wrong')}
                        </TkBadge>
                      )}
                    </div>

                    {q.options && q.options.length > 0 ? (
                      <div className="flex flex-wrap gap-2.5">
                        {q.options.map((opt) => {
                          const active = picked === opt
                          const isAnswer = grade && isGradable && q.correctAnswer === opt
                          return (
                            <button
                              key={opt}
                              type="button"
                              disabled={!!grade}
                              onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                              className={`ga-ui rounded-ga border px-4 py-2.5 text-[13.5px] font-semibold transition-colors disabled:cursor-default ${
                                isAnswer
                                  ? 'border-ga-green bg-ga-green-soft text-ga-green'
                                  : active
                                    ? 'border-ga-ink bg-ga-ink text-ga-bg'
                                    : 'border-ga-line bg-ga-card text-ga-ink hover:bg-ga-surface'
                              }`}
                            >
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={picked}
                        disabled={!!grade}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder={t('answerPlaceholder')}
                        aria-label={q.question}
                        className="ga-ui w-full rounded-ga border border-ga-line bg-ga-card px-4 py-2.5 text-[14px] text-ga-ink outline-none focus-visible:ring-2 focus-visible:ring-ga-accent"
                      />
                    )}

                    {grade && q.explanation && (
                      <p className="ga-ui rounded-ga bg-ga-surface px-4 py-3 text-[12.5px] text-ga-muted">
                        {q.explanation}
                      </p>
                    )}
                  </GaCard>
                )
              })}
            </div>
          ) : (
            /* Không có đề trong DB → tài nguyên ngoài, không chấm được (hành vi v1). */
            <EmptyState
              icon="link"
              title={t('externalTitle')}
              description={t('externalDesc')}
              action={
                exercise.sourceUrl ? (
                  <a
                    href={exercise.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ga-ui inline-flex items-center gap-1.5 rounded-ga border border-ga-line bg-ga-card px-4 py-2.5 text-[13px] font-semibold text-ga-ink transition-colors hover:bg-ga-surface"
                  >
                    <ExternalLink size={14} aria-hidden />
                    {t('openSource')}
                  </a>
                ) : undefined
              }
            />
          )}

          {submitError && <ErrorBanner message={submitError} onRetry={() => void handleSubmit()} />}

          {!grade && (
            <div className="flex items-center justify-between gap-4">
              <GaCap className="text-ga-gold">
                {canGrade ? t('gradedHint', { count: gradable.length }) : t('ungradedHint')}
              </GaCap>
              <GaBtn
                size="lg"
                variant={!canGrade || allAnswered ? 'ink' : 'ghost'}
                disabled={submitting || (canGrade && !allAnswered)}
                onClick={() => void handleSubmit()}
              >
                {submitting ? t('submitting') : canGrade ? t('submit') : t('markDone')}
              </GaBtn>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
