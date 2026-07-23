'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, BookOpen, Check, Mic, RefreshCw, Sparkles, Trophy, Volume2, X } from 'lucide-react'
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
 * /v2/student/practice/[nodeId]/[skill] — RUNNER luyện kỹ năng CÓ CHẤM ĐIỂM (vỏ Galerie).
 *
 * Port của /student/practice-session/[nodeId]/[skill]. GIỮ NGUYÊN contract param
 * (`nodeId` số + `skill` chữ thường: hoeren|sprechen|lesen|schreiben) và mọi endpoint:
 *   · POST /skill-tree/{nodeId}/practice/{SKILL}/start   — lấy/tạo session
 *   · GET  /skill-tree/practice/{sessionId}              — đề bài
 *   · POST /skill-tree/practice/{sessionId}/submit       — nộp bài (ghi điểm + XP)
 *   · POST /skill-tree/{nodeId}/practice/{SKILL}/next    — sinh thế hệ mới
 *
 * Chấm điểm giữ y hệt v1: chấm phía client (so `correct_index` / `correct_answer` + `accept_also`,
 * bài nói coi như đúng khi học viên tự xác nhận đã đọc), rồi POST `score_percent` + `answers`.
 *
 * Sửa đúng một khiếm khuyết của v1 (KHÔNG phải thêm tính năng): `start` (lần sinh đầu) và `next`
 * (LUÔN LUÔN) trả 202 + {jobId} sau khi backend đẩy sinh-bài ra chạy nền (S-5). v1 chỉ đọc
 * `sessions`/`sessionId` nên hai luồng đó chết lặng — nút "Làm thêm bài mới" của v1 không bao giờ
 * chạy. Ở đây poll job qua `waitForAsyncJob` rồi mới lấy đề.
 */

const SKILLS: Skill[] = ['hoeren', 'sprechen', 'lesen', 'schreiben']
const isSkill = (v: string): v is Skill => (SKILLS as string[]).includes(v)

const SKILL_LABELS_DE: Record<Skill, string> = {
  hoeren: 'Hören',
  sprechen: 'Sprechen',
  lesen: 'Lesen',
  schreiben: 'Schreiben',
}

/** Các dạng bài "nói" — không chấm tự động, học viên tự xác nhận đã đọc (giữ nguyên v1). */
const SPEAKING_TYPES = ['SPEAKING_REPEAT', 'SPEAKING_RESPONSE', 'ROLE_PLAY', 'SPEAKING_DESCRIBE']

interface Exercise {
  type: string
  instruction_vi: string
  audio_transcript?: string
  question_vi?: string
  sentence_with_blank?: string
  sentence_de?: string
  sentence_vi?: string
  question_de?: string
  expected_answer?: string
  grading_keywords?: string[]
  focus_sounds?: string[]
  scenario_vi?: string
  partner_line_de?: string
  expected_response?: string
  situation_vi?: string
  expected_phrases?: string[]
  statement_de?: string
  words?: string[]
  correct_order?: string[]
  translation_vi?: string
  hint_vi?: string
  grammar_rule_vi?: string
  prompt_vi?: string
  prompt_de?: string
  min_words?: number
  example_answer?: string
  options?: string[]
  correct_index?: number
  correct_answer?: string | boolean
  accept_also?: string[]
  explanation_vi?: string
  pairs?: { de: string; vi: string }[]
}

type ExercisePayload =
  | Exercise[]
  | { reading_passage?: { text_type?: string; text_de?: string }; exercises?: Exercise[] }

interface SessionDetail {
  sessionId: number
  skillType: string
  generation: number
  status: string
  scorePercent: number
  exercises: ExercisePayload
  sourceNodeTitle: string
  sourceNodeTitleVi: string
}

interface SubmitResult {
  scorePercent: number
  xpEarned: number
  status: string
  totalSeenCount?: number
}

type AnswerValue = number | string

/** Đọc câu tiếng Đức bằng TTS trình duyệt (giữ nguyên v1 — không thêm dependency). */
function speakDe(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'de-DE'
  utterance.rate = 0.85
  window.speechSynthesis.speak(utterance)
}

function ExerciseCard({
  exercise,
  index,
  accent,
  onAnswer,
  answered,
  isCorrect,
}: {
  exercise: Exercise
  index: number
  accent: string
  onAnswer: (answer: AnswerValue) => void
  answered: boolean
  isCorrect: boolean | null
}) {
  const t = useTranslations('v2.student.practiceRunner')
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [textInput, setTextInput] = useState('')

  const isSpeaking = SPEAKING_TYPES.includes(exercise.type)
  const isReadingType = ['READ_AND_CHOOSE', 'READ_TRUE_FALSE', 'READ_AND_FILL'].includes(exercise.type)
  // Ô nhập chữ: chỉ khi không có options và đáp án là chuỗi (chính tả/dịch/điền) — giữ nguyên v1.
  const hasTextInput =
    !exercise.options && typeof exercise.correct_answer === 'string' && !isSpeaking

  const borderColor = !answered
    ? 'var(--ga-line)'
    : isCorrect
      ? 'var(--ga-green)'
      : 'var(--ga-red)'

  return (
    <GaCard className="p-4 lg:p-5" style={{ borderColor }}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="ga-ui grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ga-surface text-[11px] font-bold text-ga-muted">
          {index + 1}
        </span>
        <span className="ga-ui min-w-0 break-words rounded-ga-pill bg-ga-surface px-2 py-0.5 text-[10px] font-semibold uppercase text-ga-subtle">
          {exercise.type.replace(/_/g, ' ')}
        </span>
      </div>

      <p className="ga-ui mb-3 break-words text-[14px] font-semibold text-ga-ink">{exercise.instruction_vi}</p>

      {/* Nghe: phát transcript bằng TTS */}
      {exercise.audio_transcript && (
        <button
          type="button"
          onClick={() => speakDe(exercise.audio_transcript!)}
          className="ga-ui mb-4 inline-flex min-h-10 items-center gap-2 rounded-ga border px-4 py-2.5 text-[13px] font-semibold transition-opacity hover:opacity-80 lg:min-h-0"
          style={{ borderColor: accent, color: accent }}
        >
          <Volume2 size={15} aria-hidden /> {t('listen')}
        </button>
      )}

      {/* Đọc: câu trích dẫn */}
      {isReadingType && exercise.statement_de && (
        <div className="mb-4 rounded-ga border border-ga-line bg-ga-surface px-4 py-3">
          <p className="ga-ui break-words text-[13.5px] italic leading-relaxed text-ga-ink">
            &laquo;{exercise.statement_de}&raquo;
          </p>
        </div>
      )}

      {exercise.sentence_with_blank && (
        <div className="mb-4 rounded-ga border border-ga-line bg-ga-surface px-4 py-3">
          <p className="ga-ui break-words text-[14px] font-medium text-ga-ink">{exercise.sentence_with_blank}</p>
        </div>
      )}

      {/* Nói: câu mẫu + nghe mẫu */}
      {exercise.sentence_de && (exercise.type === 'SPEAKING_REPEAT' || exercise.type === 'SPEAKING_RESPONSE') && (
        <div className="mb-4 rounded-ga border border-ga-line bg-ga-surface px-4 py-3">
          <p className="break-words font-ga-display text-[17px] font-medium text-ga-ink">{exercise.sentence_de}</p>
          {exercise.sentence_vi && (
            <p className="ga-ui mt-1 text-[12.5px] text-ga-muted">{exercise.sentence_vi}</p>
          )}
          <button
            type="button"
            onClick={() => speakDe(exercise.sentence_de!)}
            className="ga-ui mt-2 inline-flex items-center gap-1 text-[12px] font-semibold"
            style={{ color: accent }}
          >
            <Volume2 size={12} aria-hidden /> {t('listenSample')}
          </button>
        </div>
      )}

      {exercise.question_vi && !exercise.audio_transcript && (
        <p className="ga-ui mb-3 text-[13.5px] text-ga-muted">{exercise.question_vi}</p>
      )}
      {exercise.question_de && (
        <p className="ga-ui mb-3 text-[14px] font-medium text-ga-ink">{exercise.question_de}</p>
      )}

      {/* Viết: sắp xếp từ */}
      {exercise.type === 'REORDER_WORDS' && exercise.words && (
        <div className="mb-4 flex flex-wrap gap-2">
          {exercise.words.map((word, i) => (
            <span
              key={`${word}-${i}`}
              className="ga-ui rounded-ga border border-ga-line bg-ga-surface px-3 py-1.5 text-[13px] font-medium text-ga-ink"
            >
              {word}
            </span>
          ))}
        </div>
      )}

      {/* Trắc nghiệm */}
      {exercise.options && exercise.options.length > 0 && (
        <div className="mb-3 space-y-2">
          {exercise.options.map((opt, idx) => {
            const isSelected = selectedOption === idx
            const isAnswer = exercise.correct_index === idx
            const showCorrect = answered && isAnswer
            const showWrong = answered && isSelected && !isAnswer

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (answered) return
                  setSelectedOption(idx)
                  onAnswer(idx)
                }}
                disabled={answered}
                className="ga-ui flex w-full items-center gap-2.5 break-words rounded-ga border-2 px-4 py-3 text-left text-[14px] font-medium transition-colors disabled:cursor-default"
                style={{
                  borderColor: showCorrect
                    ? 'var(--ga-green)'
                    : showWrong
                      ? 'var(--ga-red)'
                      : isSelected
                        ? 'var(--ga-accent)'
                        : 'var(--ga-line)',
                  background: showCorrect
                    ? 'var(--ga-green-soft)'
                    : showWrong
                      ? 'var(--ga-red-soft)'
                      : 'var(--ga-card)',
                  color: showCorrect ? 'var(--ga-green)' : showWrong ? 'var(--ga-red)' : 'var(--ga-ink)',
                }}
              >
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold"
                  style={{ borderColor: 'currentColor' }}
                >
                  {showCorrect ? (
                    <Check size={12} aria-hidden />
                  ) : showWrong ? (
                    <X size={12} aria-hidden />
                  ) : (
                    String.fromCharCode(65 + idx)
                  )}
                </span>
                <span className="min-w-0 break-words">{opt}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Nhập chữ (chính tả / dịch / điền) */}
      {hasTextInput && (
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !answered && textInput.trim()) onAnswer(textInput.trim())
            }}
            disabled={answered}
            placeholder={t('answerPlaceholder')}
            className="ga-ui min-w-0 flex-1 rounded-ga border-2 border-ga-line bg-ga-card px-4 py-3 text-[14px] text-ga-ink outline-none focus:border-ga-accent disabled:opacity-70"
          />
          {!answered && (
            <button
              type="button"
              onClick={() => textInput.trim() && onAnswer(textInput.trim())}
              className="ga-ui grid w-12 shrink-0 place-items-center rounded-ga bg-ga-accent text-ga-accent-ink transition-opacity hover:opacity-90"
              aria-label={t('check')}
            >
              <Check size={16} aria-hidden />
            </button>
          )}
        </div>
      )}

      {/* Bài nói — tự xác nhận (v1: luôn tính đúng) */}
      {isSpeaking && !answered && (
        <button
          type="button"
          onClick={() => onAnswer('spoken')}
          className="ga-ui flex w-full items-center justify-center gap-2 rounded-ga border-2 py-3 text-[13.5px] font-semibold transition-opacity hover:opacity-80"
          style={{ borderColor: accent, color: accent }}
        >
          <Mic size={15} aria-hidden /> {t('spokenDone')}
        </button>
      )}

      {/* Giải thích sau khi trả lời */}
      {answered && exercise.explanation_vi && (
        <div
          className="mt-3 rounded-ga border px-4 py-3"
          style={{
            borderColor: isCorrect ? 'var(--ga-green)' : 'var(--ga-orange)',
            background: isCorrect ? 'var(--ga-green-soft)' : 'var(--ga-yellow-soft)',
          }}
        >
          <p
            className="ga-ui mb-1 text-[12px] font-semibold"
            style={{ color: isCorrect ? 'var(--ga-green)' : 'var(--ga-orange)' }}
          >
            {isCorrect ? t('correct') : t('incorrect')}
          </p>
          <p className="ga-ui break-words text-[13.5px] text-ga-muted">{exercise.explanation_vi}</p>
          {!isCorrect && typeof exercise.correct_answer === 'string' && (
            <p className="ga-ui mt-1 break-words text-[13.5px] font-semibold text-ga-ink">
              {t('answerIs')} {exercise.correct_answer}
            </p>
          )}
          {exercise.grammar_rule_vi && (
            <p className="ga-ui mt-1 text-[12.5px] font-medium text-ga-accent">{exercise.grammar_rule_vi}</p>
          )}
        </div>
      )}
    </GaCard>
  )
}

export default function V2StudentPracticeRunnerPage() {
  usePageTimeTracker('practice_session')
  const t = useTranslations('v2.student.practiceRunner')
  const params = useParams()
  const router = useRouter()

  const nodeId = Number(params?.nodeId)
  const skillParam = String(params?.skill ?? '').toLowerCase()
  const skill: Skill = isSkill(skillParam) ? skillParam : 'lesen'
  const skillUpper = skill.toUpperCase()

  const { me, loading: meLoading } = useStudentPracticeSession()

  const [session, setSession] = useState<SessionDetail | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Map<number, { answer: AnswerValue; correct: boolean }>>(new Map())
  const [submitted, setSubmitted] = useState(false)
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
  const [generatingNext, setGeneratingNext] = useState(false)

  const accent = SKILL_COLORS[skill]

  const applyDetail = useCallback((detail: SessionDetail) => {
    setSession(detail)
    const payload = detail.exercises
    if (Array.isArray(payload)) setExercises(payload)
    else if (Array.isArray(payload?.exercises)) setExercises(payload.exercises)
    else setExercises([])
  }, [])

  const loadDetail = useCallback(
    async (sessionId: number) => {
      const { data } = await api.get<SessionDetail>(`/skill-tree/practice/${sessionId}`)
      applyDetail(data)
    },
    [applyDetail],
  )

  /**
   * Sinh một thế hệ mới cho kỹ năng này qua `POST …/{SKILL}/next` rồi trả sessionId.
   *
   * `next` LUÔN trả 202 + jobId → bắt buộc poll. Backend lấy `MAX(generation)` của ĐÚNG kỹ năng
   * này (COALESCE 0) rồi +1, nên khi kỹ năng chưa có session nào nó sinh thẳng Gen-1 — đây cũng là
   * đường thoát duy nhất cho ngõ cụt mô tả ở `fetchSession` (b).
   */
  const generateSkillSession = useCallback(async (): Promise<number | null> => {
    const { data } = await api.post<unknown>(`/skill-tree/${nodeId}/practice/${skillUpper}/next`)
    const result = isAsyncJobAccepted(data)
      ? await waitForAsyncJob<{ sessionId?: number }>(data.jobId)
      : (data as { sessionId?: number })
    return result?.sessionId ?? null
  }, [nodeId, skillUpper])

  const fetchSession = useCallback(async () => {
    if (!nodeId || !skill) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.post<
        { sessions?: Array<{ id: number; skill_type: string }>; sessionId?: number } | unknown
      >(`/skill-tree/${nodeId}/practice/${skillUpper}/start`)

      // (a) 202 → bài đang sinh nền: chờ job rồi lấy sessionId từ kết quả.
      if (isAsyncJobAccepted(data)) {
        const result = await waitForAsyncJob<{ sessionId?: number }>(data.jobId)
        if (result?.sessionId) {
          await loadDetail(result.sessionId)
          return
        }
        setError(t('generateError'))
        return
      }

      // (b) Cache hit → backend trả nguyên overview 4 session.
      const body = data as { sessions?: Array<{ id: number; skill_type: string }>; sessionId?: number }
      if (body?.sessions) {
        const found = body.sessions.find((s) => s.skill_type === skillUpper)
        if (found) {
          await loadDetail(found.id)
          return
        }
        // NGÕ CỤT của backend: cache-hit của `start` xét theo NODE, không theo KỸ NĂNG
        // (PracticeNodeController: `hasPracticeSessions(userId, nodeId)`). Vừa sinh xong 1 kỹ năng
        // là 3 kỹ năng còn lại nhận 200 + overview KHÔNG chứa chúng → `start` sẽ không bao giờ sinh
        // bài cho chúng nữa. v1 chết lặng ở đây (màn hình trắng). Thoát bằng `next` — Gen-1.
        const sessionId = await generateSkillSession()
        if (sessionId) {
          await loadDetail(sessionId)
          return
        }
        setError(t('generateError'))
        return
      }

      // (c) Trả thẳng sessionId (đường đồng bộ).
      if (body?.sessionId) {
        await loadDetail(body.sessionId)
        return
      }

      setError(t('noSession'))
    } catch {
      setError(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [nodeId, skill, skillUpper, loadDetail, generateSkillSession, t])

  useEffect(() => {
    if (me && nodeId && skill) void fetchSession()
  }, [me, nodeId, skill, fetchSession])

  /** Chấm phía client — giữ NGUYÊN luật của v1. */
  const handleAnswer = (index: number, answer: AnswerValue) => {
    const exercise = exercises[index]
    if (!exercise) return

    let correct = false
    if (exercise.correct_index !== undefined && typeof answer === 'number') {
      correct = answer === exercise.correct_index
    } else if (exercise.correct_answer !== undefined && typeof answer === 'string') {
      const given = answer.toLowerCase().trim()
      correct = String(exercise.correct_answer).toLowerCase().trim() === given
      if (!correct && exercise.accept_also) {
        correct = exercise.accept_also.some((alt) => alt.toLowerCase().trim() === given)
      }
    }
    if (answer === 'spoken') correct = true

    setAnswers((prev) => new Map(prev).set(index, { answer, correct }))
  }

  const correctCount = useMemo(
    () => Array.from(answers.values()).filter((a) => a.correct).length,
    [answers],
  )
  const allAnswered = exercises.length > 0 && answers.size === exercises.length

  const handleSubmit = async () => {
    if (!session || submitted) return
    setSubmitted(true)

    const scorePercent =
      exercises.length > 0 ? Math.round((correctCount / exercises.length) * 100) : 0

    try {
      const { data } = await api.post<SubmitResult>(
        `/skill-tree/practice/${session.sessionId}/submit`,
        { score_percent: scorePercent, answers: Object.fromEntries(answers) },
      )
      setSubmitResult(data)
    } catch {
      // v1 vẫn hiện kết quả cục bộ khi submit hỏng — giữ nguyên để học viên không mất công làm bài.
      setSubmitResult({ scorePercent, xpEarned: 0, status: 'COMPLETED' })
    }
  }

  const handleGenerateNext = async () => {
    if (!nodeId) return
    setGeneratingNext(true)
    setError(null)
    try {
      // `next` LUÔN trả 202 + jobId → bắt buộc phải poll (v1 thiếu bước này nên nút không chạy).
      const sessionId = await generateSkillSession()
      if (sessionId) {
        await loadDetail(sessionId)
        setAnswers(new Map())
        setSubmitted(false)
        setSubmitResult(null)
      } else {
        setError(t('generateError'))
      }
    } catch {
      setError(t('generateError'))
    } finally {
      setGeneratingNext(false)
    }
  }

  if (meLoading || !me) return <LoadingState label={t('loading')} />

  const readingPassage =
    session && !Array.isArray(session.exercises) ? session.exercises.reading_passage : undefined

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        accentColor={accent}
        title={`${SKILL_LABELS[skill]} · ${SKILL_LABELS_DE[skill]}`}
        subtitle={
          session
            ? t('headerSubtitle', { node: session.sourceNodeTitleVi, gen: session.generation })
            : t('subtitle')
        }
      />
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-2xl space-y-[22px]">
          <button
            type="button"
            onClick={() => router.push(`/v2/student/practice/${nodeId}`)}
            className="ga-ui inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-ga-muted transition-colors hover:text-ga-ink lg:min-h-0"
          >
            <ArrowLeft size={15} aria-hidden /> {t('backToSkills')}
          </button>

          {error && <ErrorBanner message={error} onRetry={() => void fetchSession()} />}

          {/* Đầu bài + điểm hiện tại */}
          {session && (
            <GaCard className="flex items-center gap-3 p-4 lg:gap-4 lg:p-5">
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full"
                style={{ background: accent }}
              >
                <TreeIcon paths={SKILL_ICONS[skill]} size={22} color="#FFFFFF" strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-[15px] font-semibold text-ga-ink">
                  {SKILL_LABELS[skill]} · {SKILL_LABELS_DE[skill]}
                </p>
                <p className="ga-ui truncate text-[12.5px] text-ga-muted">
                  {t('metaLine', {
                    node: session.sourceNodeTitleVi,
                    gen: session.generation,
                    count: exercises.length,
                  })}
                </p>
              </div>
              <div className="shrink-0 text-center">
                <p className="whitespace-nowrap font-ga-display text-[18px] font-medium lg:text-[22px]" style={{ color: accent }}>
                  {correctCount}/{exercises.length}
                </p>
                <p className="ga-ui text-[11px] text-ga-subtle">{t('correctLabel')}</p>
              </div>
            </GaCard>
          )}

          {loading && <LoadingState label={t('generatingExercises')} />}

          {/* Bài đọc (LESEN) */}
          {readingPassage && (
            <GaCard className="p-4 lg:p-5" style={{ borderColor: accent }}>
              <div className="mb-3 flex items-center gap-2">
                <BookOpen size={15} className="shrink-0" style={{ color: accent }} aria-hidden />
                <GaCap>{readingPassage.text_type || 'Lesetext'}</GaCap>
              </div>
              <p className="ga-ui whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ga-ink">
                {readingPassage.text_de}
              </p>
            </GaCard>
          )}

          {/* Đề bài */}
          {!loading && exercises.length > 0 && (
            <div className="space-y-4">
              {exercises.map((exercise, idx) => (
                <ExerciseCard
                  key={idx}
                  exercise={exercise}
                  index={idx}
                  accent={accent}
                  onAnswer={(answer) => handleAnswer(idx, answer)}
                  answered={answers.has(idx)}
                  isCorrect={answers.get(idx)?.correct ?? null}
                />
              ))}
            </div>
          )}

          {/* Nộp bài */}
          {allAnswered && !submitted && (
            <div className="sticky bottom-4">
              <button
                type="button"
                onClick={() => void handleSubmit()}
                className="ga-ui flex w-full items-center justify-center gap-2 rounded-ga bg-ga-accent py-3.5 text-[14px] font-semibold text-ga-accent-ink shadow-lg transition-opacity hover:opacity-90"
              >
                <Check size={17} aria-hidden />
                {t('submit', { correct: correctCount, total: exercises.length })}
              </button>
            </div>
          )}

          {/* Kết quả */}
          {submitResult && (
            <GaCard
              className="p-4 text-center lg:p-6"
              style={{
                borderColor: submitResult.scorePercent >= 60 ? 'var(--ga-green)' : 'var(--ga-orange)',
                background:
                  submitResult.scorePercent >= 60 ? 'var(--ga-green-soft)' : 'var(--ga-yellow-soft)',
              }}
            >
              <Trophy
                size={36}
                className="mx-auto mb-3"
                style={{ color: submitResult.scorePercent >= 60 ? 'var(--ga-green)' : 'var(--ga-orange)' }}
                aria-hidden
              />
              <p className="font-ga-display text-[24px] font-medium text-ga-ink lg:text-[30px]">
                {submitResult.scorePercent}%
              </p>
              <p className="ga-ui mt-1 text-[13.5px] text-ga-muted">
                {t('resultLine', { correct: correctCount, total: exercises.length })}
              </p>
              {submitResult.xpEarned > 0 && (
                <p className="ga-ui mt-1 text-[13.5px] font-semibold text-ga-green">
                  +{submitResult.xpEarned} XP
                </p>
              )}

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleGenerateNext()}
                  disabled={generatingNext}
                  className="ga-ui inline-flex min-h-10 items-center gap-2 rounded-ga px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 lg:min-h-0"
                  style={{ background: accent }}
                >
                  {generatingNext ? (
                    <RefreshCw size={14} className="animate-spin" aria-hidden />
                  ) : (
                    <Sparkles size={14} aria-hidden />
                  )}
                  {generatingNext ? t('generating') : t('generateNext')}
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/v2/student/practice/${nodeId}`)}
                  className="ga-ui inline-flex min-h-10 items-center gap-2 rounded-ga border-2 border-ga-line bg-ga-card px-5 py-2.5 text-[13.5px] font-semibold text-ga-muted transition-colors hover:bg-ga-surface lg:min-h-0"
                >
                  <ArrowLeft size={14} aria-hidden /> {t('otherSkill')}
                </button>
              </div>

              {(submitResult.totalSeenCount ?? 0) > 0 && (
                <p className="ga-ui mt-4 text-[12px] text-ga-subtle">
                  {t('totalSeen', { count: submitResult.totalSeenCount! })}
                </p>
              )}
            </GaCard>
          )}
        </div>
      </div>
    </div>
  )
}
