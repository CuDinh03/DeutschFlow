'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Check, ExternalLink, Trophy, X } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import {
  practiceApi,
  type PracticeAnswers,
  type PracticeGradeResult,
  type PracticeQuestionResult,
  type PracticeQuiz,
} from '@/lib/practiceApi'
import { useTracking } from '@/hooks/useTracking'
import {
  EmptyState,
  ErrorBanner,
  GaBtn,
  GaCap,
  GaCard,
  GaChoiceGroup,
  GaGlyph,
  GaPageHdr,
  LoadingState,
  TkBadge,
} from '@/components/ui-v2'

/**
 * /v2/student/exercises/[id] — làm một bài tập bổ trợ.
 *
 * A3 (09/11/2026): đề lấy từ GET /practice/catalog/{id} — KHÔNG kèm đáp án. Nộp bài bằng
 * POST /practice/catalog/{id}/grade { answers }: server chấm trên đáp án lưu trong DB, ghi lượt làm
 * + XP (PracticeService), rồi mới trả đúng/sai, đáp án đúng và giải thích từng câu. Trước A3 trang
 * này nhận `contentJson` có sẵn `correctAnswer` (mở DevTools là thấy) và tự chấm ở trình duyệt.
 *
 * ⚠️ v1 KHÔNG có màn này: `/student/practice` POST thẳng `scorePercent: 100` từ thẻ danh sách,
 * không hiện lấy một câu hỏi. Port nguyên si sẽ bê theo lỗ hổng phát XP miễn phí.
 *
 * Bài không có câu chấm được (tài nguyên ngoài: chỉ có source_url, không có đề trong DB) thì giữ
 * hành vi v1: mở nguồn + tự xác nhận hoàn thành (gửi `scorePercent: 100`, server kẹp 0..100).
 */

export default function V2StudentExerciseRunnerPage() {
  const t = useTranslations('v2.student.exercises')
  const router = useRouter()
  const params = useParams()
  const { trackFeatureAction } = useTracking()

  const exerciseId = Number(params?.id)

  const [exercise, setExercise] = useState<PracticeQuiz | null>(null)
  const [answers, setAnswers] = useState<PracticeAnswers>({})
  const [grade, setGrade] = useState<PracticeGradeResult | null>(null)
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
      setExercise(await practiceApi.quiz(exerciseId))
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [exerciseId, t])

  useEffect(() => {
    void load()
  }, [load])

  const questions = useMemo(() => exercise?.questions ?? [], [exercise])
  /** Câu server chấm được (có đáp án trong DB) — chỉ biết là CÓ, không biết đáp án là gì. */
  const gradable = useMemo(() => questions.filter((q) => q.gradable), [questions])
  /** Kết quả từng câu — chỉ có SAU khi nộp. */
  const resultById = useMemo(() => {
    const map: Record<string, PracticeQuestionResult> = {}
    for (const r of grade?.questions ?? []) map[r.id] = r
    return map
  }, [grade])
  const canGrade = gradable.length > 0
  const allAnswered = gradable.every((q) => (answers[q.id] ?? '').trim().length > 0)

  const handleSubmit = async () => {
    if (!exercise || submitting) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      // Bài chấm được → server tự chấm từ `answers`. Bài "tài nguyên ngoài" → tự xác nhận (v1: 100%).
      const result = await practiceApi.grade(exercise.id, {
        answers,
        ...(canGrade ? {} : { scorePercent: 100 }),
      })
      setGrade(result)
      trackFeatureAction('practice_exercise', 'completed', { exerciseId: exercise.id })
    } catch (e) {
      setSubmitError(apiMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const heading = exercise?.examName || exercise?.title || t('title')

  if (loading) {
    return (
      <div className="flex min-h-full flex-col">
        <GaPageHdr accent title={t('title')} />
        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
          <LoadingState label={t('loading')} />
        </div>
      </div>
    )
  }

  if (error || !exercise) {
    return (
      <div className="flex min-h-full flex-col">
        <GaPageHdr accent title={t('title')} />
        <div className="flex-1 space-y-5 px-4 py-6 sm:px-6 lg:px-10">
          <ErrorBanner message={error ?? t('notFound')} onRetry={() => void load()} />
          <GaBtn variant="ghost" onClick={() => router.push('/v2/student/exercises')}>
            <ArrowLeft size={15} aria-hidden />
            {t('backToLibrary')}
          </GaBtn>
        </div>
      </div>
    )
  }

  // XP: lấy đúng con số server trao (luật riêng cho bài nguồn ngoài, giới hạn theo ngày…). Chỉ khi
  // backend không báo (`xpEarned` thiếu) mới ước lượng như cũ: điểm% × xpReward.
  const earnedXp = !grade
    ? 0
    : typeof grade.xpEarned === 'number'
      ? grade.xpEarned
      : Math.round((grade.scorePercent / 100) * exercise.xpReward)

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        eyebrow={`${exercise.cefrLevel} · ${exercise.skillType}`}
        title={heading}
        subtitle={exercise.instructions ?? undefined}
        right={
          <GaBtn variant="ghost" onClick={() => router.push('/v2/student/exercises')}>
            <ArrowLeft size={15} aria-hidden />
            {t('backToLibrary')}
          </GaBtn>
        }
      />

      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl space-y-5">
          {/* Kết quả sau khi nộp */}
          {grade && (
            <GaCard className="flex flex-col items-center gap-3 px-4 py-8 text-center lg:px-6 lg:py-10">
              <GaGlyph icon={Trophy} size="lg" tone="yellow" />
              <p className="font-ga-display text-[24px] font-medium text-ga-ink">
                {canGrade
                  ? t('resultTitle', { correct: grade.correctCount, total: grade.total })
                  : t('resultMarkedDone')}
              </p>
              <p className="ga-ui text-[13px] text-ga-muted">
                {t('resultXp', { score: grade.scorePercent, xp: earnedXp })}
              </p>
              <GaBtn onClick={() => router.push('/v2/student/exercises')}>{t('backToLibrary')}</GaBtn>
            </GaCard>
          )}

          {/* Bài đọc (nếu có) */}
          {exercise.readingText && (
            <GaCard className="p-5 lg:p-7">
              <GaCap className="mb-3 block">{t('readingCap')}</GaCap>
              <p className="ga-ui whitespace-pre-line break-words text-[15px] leading-relaxed text-ga-ink">
                {exercise.readingText}
              </p>
            </GaCard>
          )}

          {/* Đề bài — chỉ khi API trả câu hỏi */}
          {questions.length > 0 ? (
            <div className="space-y-4">
              {questions.map((q, idx) => {
                const picked = answers[q.id] ?? ''
                const result = resultById[q.id]
                const verdict = grade && q.gradable ? (result?.correct ?? undefined) : undefined

                return (
                  <GaCard key={q.id} className="space-y-4 p-4 lg:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <p id={`exercise-q-${idx}`} className="ga-ui min-w-0 break-words text-[15px] font-semibold text-ga-ink">
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
                      <GaChoiceGroup
                        aria-labelledby={`exercise-q-${idx}`}
                        layout="wrap"
                        letters={false}
                        options={q.options.map((opt) => ({ value: opt, label: opt }))}
                        value={picked || null}
                        onChange={(opt) => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                        locked={!!grade}
                        // Đáp án đúng chỉ có SAU khi server chấm (A3) — trước đó chỉ hiện "Đã chọn".
                        correctValue={grade && q.gradable ? (result?.correctAnswer ?? null) : null}
                        verdict={verdict ?? null}
                      />
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

                    {grade && result?.explanation && (
                      <p className="ga-ui rounded-ga bg-ga-surface px-4 py-3 text-[12.5px] text-ga-muted">
                        {result.explanation}
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
                    className="ga-ui inline-flex min-h-10 items-center gap-1.5 rounded-ga border border-ga-line bg-ga-card px-4 py-2.5 text-[13px] font-semibold text-ga-ink transition-colors hover:bg-ga-surface lg:min-h-0"
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
            <div className="flex flex-wrap items-center justify-between gap-4">
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
