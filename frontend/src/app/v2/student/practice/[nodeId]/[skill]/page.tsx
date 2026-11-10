'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  ArrowLeft,
  BookOpen,
  Check,
  CircleCheck,
  CircleX,
  Headphones,
  Lightbulb,
  Mic,
  PenLine,
  RefreshCw,
  Sparkles,
  TreeDeciduous,
  Trophy,
  Volume2,
  type LucideIcon,
} from 'lucide-react'
import api from '@/lib/api'
import { isAsyncJobAccepted, waitForAsyncJob } from '@/lib/asyncJob'
import { pickExplanation, type ExplanationFields } from '@/lib/practice/explanation'
import { classifyPracticeError, type PracticeErrorInfo } from '@/lib/practice/practiceError'
import { MASTERY_PERCENT } from '@/lib/roadmap-tree/practiceStats'
import { LeafProgress } from '@/components/practice/LeafProgress'
import { SeedlingWait } from '@/components/practice/SeedlingWait'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { SKILL_COLORS, SKILL_ICON, SKILL_LABELS } from '@/lib/skills'
import { GaCap, GaCard, GaChoiceGroup, GaGlyph, ErrorBanner, LoadingState } from '@/components/ui-v2'
import { LessonShell } from '@/components/learn/LessonShell'
import {
  clearLessonDraft,
  practiceScope,
  pruneStaleLessonDrafts,
  readLessonDraft,
  writeLessonDraft,
} from '@/lib/lesson/lessonDraft'
import type { Skill } from '@/lib/skills'
import { useFmt } from '@/lib/i18n/useFmt'

/**
 * /v2/student/practice/[nodeId]/[skill] — RUNNER luyện kỹ năng CÓ CHẤM ĐIỂM (vỏ Galerie).
 *
 * Port của /student/practice-session/[nodeId]/[skill]. GIỮ NGUYÊN contract param
 * (`nodeId` số + `skill` chữ thường: hoeren|sprechen|lesen|schreiben). Endpoint:
 *   · POST /skill-tree/{nodeId}/practice/{SKILL}/start   — lấy/tạo session
 *   · GET  /skill-tree/practice/{sessionId}/quiz         — đề bài ĐÃ ẨN ĐÁP ÁN (A3)
 *   · POST /skill-tree/practice/{sessionId}/check        — chấm câu vừa trả lời (A3, không ghi DB)
 *   · POST /skill-tree/practice/{sessionId}/submit       — nộp bài (server chấm lại, ghi điểm + XP)
 *   · GET  /skill-tree/practice/{sessionId}/review       — đáp án + giải thích, chỉ sau khi nộp (A3)
 *   · POST /skill-tree/{nodeId}/practice/{SKILL}/next    — sinh thế hệ mới
 *
 * A3 (09/11/2026): trước đây trang lấy GET /skill-tree/practice/{sessionId}: đề kèm sẵn đáp án và
 * giải thích, trình duyệt tự chấm (mở DevTools là thấy đáp án). Giờ đúng/sai từng câu do server
 * chấm qua /check NGAY sau khi trả lời (trắc nghiệm: kèm phương án đúng để tô xanh như cũ); đáp án
 * chữ + giải thích chỉ về qua /review sau khi nộp. Luật chấm không đổi (PracticeExerciseGrader,
 * khớp v1): bài nói tính đúng khi học viên tự xác nhận đã đọc.
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

/**
 * Đường về cây (L3a/L3b): luôn mang `feiern=<skill>` — tab cây tự đối chiếu điểm để diễn bậc 0
 * (dưới ngưỡng: cánh nhún) hay bậc 1–3 (đạt: cánh nhận màu → hoa hoá lá → tuần khép tán).
 */
const treeHref = (nodeId: number, skill: Skill, feiern: boolean) =>
  `/v2/student/roadmap?tab=tree&node=${nodeId}${feiern ? `&feiern=${skill}` : ''}`

/** Các dạng bài "nói" — không chấm tự động, học viên tự xác nhận đã đọc (giữ nguyên v1). */
const SPEAKING_TYPES = ['SPEAKING_REPEAT', 'SPEAKING_RESPONSE', 'ROLE_PLAY', 'SPEAKING_DESCRIBE']

/** Ô trả lời server bảo client dựng (A3: client không còn nhìn đáp án để tự suy ra). */
type AnswerMode = 'choice' | 'text' | 'spoken' | 'none'

/** Một câu trong ĐỀ — GET …/quiz, đã ẩn mọi trường đáp án/giải thích. */
interface Exercise {
  type: string
  answer_mode?: AnswerMode
  /** Hợp đồng mới 18/08: đề 100% tiếng Đức. Field `*_vi` chỉ còn ở session sinh trước ngày đổi. */
  instruction_de?: string
  instruction_vi?: string
  audio_transcript?: string
  question_vi?: string
  sentence_with_blank?: string
  sentence_de?: string
  question_de?: string
  focus_sounds?: string[]
  scenario_vi?: string
  scenario_de?: string
  partner_line_de?: string
  situation_vi?: string
  situation_de?: string
  statement_de?: string
  words?: string[]
  hint_vi?: string
  hint_de?: string
  prompt_vi?: string
  prompt_de?: string
  min_words?: number
  options?: string[]
}

/** Đáp án + giải thích của một câu — CHỈ có sau khi nộp (GET …/review). */
interface ExerciseReview extends ExplanationFields {
  correct_index?: number
  correct_answer?: string | boolean
  grammar_rule_vi?: string
  sentence_vi?: string
}

/** POST …/check: đúng/sai từng câu vừa trả lời; trắc nghiệm kèm phương án đúng. */
interface CheckVerdict {
  correct: boolean
  correctIndex?: number
}

type ExercisePayload =
  | Exercise[]
  | {
      reading_passage?: { text_type?: string; text_de?: string }
      exercises?: Exercise[]
      /** Vỏ LLM tự bọc (đã bóc ở backend từ V275) — giữ để render được session sót. */
      content?: Exercise[]
    }

/**
 * Lấy mảng bài tập ra khỏi payload session.
 *
 * Dạng chuẩn là `{ exercises: [...] }` (Lesen kèm `reading_passage`). Các dạng còn lại đến từ
 * session sinh TRƯỚC bản vá prompt, khi model bị kẹt giữa "prompt đòi mảng" và
 * `response_format: json_object` (chế độ CẤM mảng top-level) nên tự bọc mảng lại: vỏ
 * `{"type":"object","content":[...]}` (prod 17–18/08, backend đã bóc từ V275) hoặc một khoá
 * model tự đặt như `uebungen` (prod 25/08, node 114 Hören). Bắt mảng-đối-tượng đầu tiên nên
 * cứu được cả hai kiểu vỏ mà không phải liệt kê tên khoá, thay vì hiện "0 câu" cụt đường.
 */
function extractExercises(payload: ExercisePayload | undefined): Exercise[] {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  if (Array.isArray(payload.exercises)) return payload.exercises
  const rescued = Object.values(payload as Record<string, unknown>).find(
    (value): value is Exercise[] =>
      Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null,
  )
  return rescued ?? []
}

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
  pending,
  isCorrect,
  correctIndex,
  review,
  revealExplanations,
}: {
  exercise: Exercise
  index: number
  accent: string
  onAnswer: (answer: AnswerValue) => void
  answered: boolean
  /** Đang chờ server chấm câu này (POST …/check). */
  pending: boolean
  isCorrect: boolean | null
  /** Phương án đúng của câu trắc nghiệm — server trả SAU khi học viên đã chọn. */
  correctIndex?: number
  /** Đáp án + giải thích — chỉ có sau khi nộp. */
  review?: ExerciseReview
  /** Chỉ true SAU khi nộp bài — mọi giải thích/dịch nghĩa (VI/EN) giấu đến lúc đó (product 18/08). */
  revealExplanations: boolean
}) {
  const t = useTranslations('v2.student.practiceRunner')
  const locale = useLocale()
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [textInput, setTextInput] = useState('')
  const explanation = review ? pickExplanation(review, locale) : null
  const locked = answered || pending
  const typeLabel = exercise.type ?? ''

  const isSpeaking = SPEAKING_TYPES.includes(typeLabel)
  const isReadingType = ['READ_AND_CHOOSE', 'READ_TRUE_FALSE', 'READ_AND_FILL'].includes(typeLabel)
  // Ô nhập chữ (chính tả/dịch/điền): server báo qua `answer_mode` — cùng luật v1 (không options,
  // đáp án là chuỗi, không phải bài nói) nhưng client không phải nhìn đáp án nữa.
  const hasTextInput = !exercise.options && exercise.answer_mode === 'text' && !isSpeaking

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
          {typeLabel.replace(/_/g, ' ')}
        </span>
      </div>

      <p id={`practice-ex-${index}`} className="ga-ui mb-3 break-words text-[14px] font-semibold text-ga-ink">
        {exercise.instruction_de ?? exercise.instruction_vi}
      </p>

      {/* Nói: tình huống / kịch bản (hợp đồng DE-only 18/08) */}
      {(exercise.situation_de || exercise.scenario_de) && (
        <div className="mb-4 rounded-ga border border-ga-line bg-ga-surface px-4 py-3">
          <p className="ga-ui break-words text-[13.5px] leading-relaxed text-ga-ink">
            {exercise.situation_de ?? exercise.scenario_de}
          </p>
          {exercise.partner_line_de && (
            <p className="ga-ui mt-1 break-words text-[13.5px] italic text-ga-muted">
              &laquo;{exercise.partner_line_de}&raquo;
            </p>
          )}
        </div>
      )}

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
          {exercise.hint_de && (
            <p className="ga-ui mt-1 flex items-start gap-1.5 text-[12.5px] text-ga-muted"><Lightbulb size={13} className="mt-[2px] shrink-0" aria-hidden /> {exercise.hint_de}</p>
          )}
        </div>
      )}

      {/* Nói: câu mẫu + nghe mẫu */}
      {exercise.sentence_de && (exercise.type === 'SPEAKING_REPEAT' || exercise.type === 'SPEAKING_RESPONSE') && (
        <div className="mb-4 rounded-ga border border-ga-line bg-ga-surface px-4 py-3">
          <p className="break-words font-ga-display text-[17px] font-medium text-ga-ink">{exercise.sentence_de}</p>
          {/* Dịch nghĩa (session cũ) chỉ lộ sau khi nộp — trong bài là 100% tiếng Đức. */}
          {revealExplanations && review?.sentence_vi && (
            <p className="ga-ui mt-1 text-[12.5px] text-ga-muted">{review.sentence_vi}</p>
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

      {/* Câu hỏi VI: chỉ session cũ mới có — session mới hỏi bằng question_de. */}
      {exercise.question_vi && !exercise.question_de && !exercise.audio_transcript && (
        <p className="ga-ui mb-3 text-[13.5px] text-ga-muted">{exercise.question_vi}</p>
      )}
      {exercise.question_de && (
        <p id={`practice-ex-${index}-q`} className="ga-ui mb-3 text-[14px] font-medium text-ga-ink">{exercise.question_de}</p>
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

      {/* Trắc nghiệm — chọn là gửi chấm ngay (POST …/check), nên mũi tên chỉ dời tiêu điểm, Space/Enter mới chọn. */}
      {exercise.options && exercise.options.length > 0 && (
        <GaChoiceGroup
          // Tên nhóm = câu lệnh + câu hỏi (nếu có) — trình đọc màn hình nghe đủ đề trước khi nghe phương án.
          aria-labelledby={exercise.question_de ? `practice-ex-${index} practice-ex-${index}-q` : `practice-ex-${index}`}
          className="mb-3"
          lang="de"
          options={exercise.options.map((opt, idx) => ({ value: idx, label: opt }))}
          value={selectedOption}
          onChange={(idx) => {
            if (locked) return
            setSelectedOption(idx)
            onAnswer(idx)
          }}
          locked={locked}
          correctValue={answered ? (correctIndex ?? review?.correct_index ?? null) : null}
          verdict={answered ? isCorrect : null}
        />
      )}

      {/* Nhập chữ (chính tả / dịch / điền) */}
      {hasTextInput && (
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !locked && textInput.trim()) onAnswer(textInput.trim())
            }}
            disabled={locked}
            placeholder={t('answerPlaceholder')}
            className="ga-ui min-w-0 flex-1 rounded-ga border-2 border-ga-line bg-ga-card px-4 py-3 text-[14px] text-ga-ink outline-none focus:border-ga-accent disabled:opacity-70"
          />
          {!answered && (
            <button
              type="button"
              disabled={pending}
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
          disabled={pending}
          onClick={() => onAnswer('spoken')}
          className="ga-ui flex w-full items-center justify-center gap-2 rounded-ga border-2 py-3 text-[13.5px] font-semibold transition-opacity hover:opacity-80"
          style={{ borderColor: accent, color: accent }}
        >
          <Mic size={15} aria-hidden /> {t('spokenDone')}
        </button>
      )}

      {/* Giải thích: CHỈ sau khi nộp cả bài (product 18/08) — trong bài đề 100% tiếng Đức,
          phản hồi đúng/sai tức thời vẫn có qua màu viền/đáp án. */}
      {revealExplanations && answered && explanation && (
        <div
          className="mt-3 rounded-ga border px-4 py-3"
          style={{
            borderColor: isCorrect ? 'var(--ga-green)' : 'var(--ga-orange)',
            background: isCorrect ? 'var(--ga-green-soft)' : 'var(--ga-yellow-soft)',
          }}
        >
          <p
            className="ga-ui mb-1 flex items-center gap-1.5 text-[12px] font-semibold"
            style={{ color: isCorrect ? 'var(--ga-green)' : 'var(--ga-orange)' }}
          >
            {isCorrect ? <CircleCheck size={14} aria-hidden /> : <CircleX size={14} aria-hidden />}
            {isCorrect ? t('correct') : t('incorrect')}
          </p>
          <p className="ga-ui break-words text-[13.5px] text-ga-muted">{explanation}</p>
          {!isCorrect && typeof review?.correct_answer === 'string' && (
            <p className="ga-ui mt-1 break-words text-[13.5px] font-semibold text-ga-ink">
              {t('answerIs')} {review.correct_answer}
            </p>
          )}
          {review?.grammar_rule_vi && (
            <p className="ga-ui mt-1 text-[12.5px] font-medium text-ga-accent">{review.grammar_rule_vi}</p>
          )}
        </div>
      )}
    </GaCard>
  )
}

export default function V2StudentPracticeRunnerPage() {
  usePageTimeTracker('practice_session')
  const t = useTranslations('v2.student.practiceRunner')
  const fmt = useFmt()
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
  const [errorInfo, setErrorInfo] = useState<PracticeErrorInfo | null>(null)
  const [answers, setAnswers] = useState<Map<number, { answer: AnswerValue; correct: boolean }>>(new Map())
  /** Phương án đúng của câu trắc nghiệm đã trả lời (server trả qua /check). */
  const [choiceKeys, setChoiceKeys] = useState<Map<number, number>>(new Map())
  /** Câu đang chờ server chấm. */
  const [pending, setPending] = useState<Set<number>>(new Set())
  const [checkError, setCheckError] = useState<string | null>(null)
  /** Đáp án + giải thích — chỉ nạp SAU khi nộp (GET …/review). */
  const [review, setReview] = useState<ExerciseReview[] | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const [draftUnavailable, setDraftUnavailable] = useState(false)
  const tShell = useTranslations('v2.student.lessonShell')

  /**
   * Nháp bài luyện (S-04 AC-2). ĐO ĐƯỢC trước khi làm: trả lời 2/3 câu rồi tải lại → còn 0.
   * `answers` chỉ sống trong `useState`, y hệt lỗi mất-trắng của engine thi ở B-13. Khác phòng
   * thi (đã có autosave server V285), bài luyện chưa có endpoint lưu tạm — localStorage là mức
   * client làm được ngay, và nhãn nói đúng phạm vi "trên thiết bị này".
   *
   * `scope` gắn theo sessionId và nháp mang theo `generation`: sinh thế hệ đề mới thì bản nháp cũ
   * bị coi như không có, nếu không đáp án của đề cũ sẽ đánh dấu đúng những câu chưa ai trả lời.
   */
  const draftScope = session ? practiceScope(nodeId, skill, session.sessionId) : null
  /** Chặn effect ghi chạy TRƯỚC effect khôi phục — nếu không nó ghi đè nháp bằng một Map rỗng. */
  const draftReadyRef = useRef<string | null>(null)

  /** Ghi đúng/sai (và phương án đúng của câu trắc nghiệm) do server chấm vào state. */
  const applyVerdicts = useCallback((results: Record<string, CheckVerdict>) => {
    const entries = Object.entries(results)
    if (entries.length === 0) return
    setAnswers((prev) => {
      const next = new Map(prev)
      for (const [idx, v] of entries) {
        const current = next.get(Number(idx))
        if (current) next.set(Number(idx), { ...current, correct: v.correct })
      }
      return next
    })
    setChoiceKeys((prev) => {
      const next = new Map(prev)
      for (const [idx, v] of entries) {
        if (typeof v.correctIndex === 'number') next.set(Number(idx), v.correctIndex)
      }
      return next
    })
  }, [])

  useEffect(() => {
    pruneStaleLessonDrafts(Date.now())
  }, [])

  useEffect(() => {
    if (!session || !draftScope) return
    if (draftReadyRef.current === draftScope) return

    const saved = readLessonDraft(draftScope, session.generation)
    if (saved && Object.keys(saved.answers).length > 0) {
      setAnswers(
        new Map(
          Object.entries(saved.answers).map(([idx, a]) => [Number(idx), a] as const),
        ),
      )
      setDraftSavedAt(saved.savedAt)
      setDraftRestored(true)
      // Nháp chỉ giữ đáp án đã chọn; đúng/sai + phương án đúng lấy lại từ server (A3) — cờ
      // `correct` trong localStorage không đáng tin, và client không còn đáp án để tự tô.
      const rawAnswers = Object.fromEntries(
        Object.entries(saved.answers).map(([idx, a]) => [idx, a.answer] as const),
      )
      void api
        .post<{ results?: Record<string, CheckVerdict> }>(
          `/skill-tree/practice/${session.sessionId}/check`,
          { answers: rawAnswers },
        )
        .then(({ data }) => applyVerdicts(data?.results ?? {}))
        .catch(() => {
          /* giữ cờ của nháp — lần nộp vẫn được server chấm lại */
        })
    }
    draftReadyRef.current = draftScope
  }, [session, draftScope, applyVerdicts])

  useEffect(() => {
    if (!draftScope || draftReadyRef.current !== draftScope || !session) return
    if (submitted || answers.size === 0) return

    const savedAt = Date.now()
    const ok = writeLessonDraft({
      scope: draftScope,
      generation: session.generation,
      answers: Object.fromEntries(Array.from(answers.entries()).map(([i, a]) => [String(i), a])),
      savedAt,
    })
    setDraftUnavailable(!ok)
    if (ok) setDraftSavedAt(savedAt)
  }, [answers, draftScope, session, submitted])
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
  const [generatingNext, setGeneratingNext] = useState(false)

  const accent = SKILL_COLORS[skill]

  /** Đ0b: tách nhánh 409 / quota / AI 503 / job FAILED thay vì nuốt hết thành "không tải được". */
  const failWith = useCallback(
    (err: unknown, fallbackKey: 'loadError' | 'generateError') => {
      const info = classifyPracticeError(err)
      setErrorInfo(info)
      const base =
        info.kind === 'conflict'
          ? t('errorConflict')
          : info.kind === 'quota'
            ? info.retryAfterSeconds
              ? t('errorRateLimited', { seconds: info.retryAfterSeconds })
              : t('errorQuota')
            : info.kind === 'aiUnavailable'
              ? t('errorAiUnavailable')
              : info.kind === 'jobFailed'
                ? t('errorJobFailed')
                : t(fallbackKey)
      setError(info.detail && info.kind !== 'generic' ? `${base} ${info.detail}` : base)
    },
    [t],
  )

  const applyDetail = useCallback((detail: SessionDetail) => {
    setSession(detail)
    setExercises(extractExercises(detail.exercises))
  }, [])

  const loadDetail = useCallback(
    async (sessionId: number) => {
      const { data } = await api.get<SessionDetail>(`/skill-tree/practice/${sessionId}/quiz`)
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
    setErrorInfo(null)
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
    } catch (err) {
      failWith(err, 'loadError')
    } finally {
      setLoading(false)
    }
  }, [nodeId, skill, skillUpper, loadDetail, generateSkillSession, failWith, t])

  useEffect(() => {
    if (me && nodeId && skill) void fetchSession()
  }, [me, nodeId, skill, fetchSession])

  /**
   * Chấm câu vừa trả lời TRÊN SERVER (A3): POST …/check — không ghi DB, không gọi AI. Luật chấm
   * giữ nguyên v1 (PracticeExerciseGrader). Hỏng mạng thì câu chưa tính là đã trả lời: học viên
   * trả lời lại được, không bị khoá vào một kết quả "sai" giả.
   */
  const handleAnswer = async (index: number, answer: AnswerValue) => {
    if (!session || !exercises[index] || answers.has(index) || pending.has(index)) return
    setPending((prev) => new Set(prev).add(index))
    setCheckError(null)
    try {
      const { data } = await api.post<{ results?: Record<string, CheckVerdict> }>(
        `/skill-tree/practice/${session.sessionId}/check`,
        { answers: { [index]: answer } },
      )
      const verdict = data?.results?.[String(index)]
      if (!verdict) throw new Error('missing verdict')
      setAnswers((prev) => new Map(prev).set(index, { answer, correct: verdict.correct }))
      applyVerdicts({ [index]: verdict })
    } catch {
      setCheckError(t('checkError'))
    } finally {
      setPending((prev) => {
        const next = new Set(prev)
        next.delete(index)
        return next
      })
    }
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
      // Đã nộp ⇒ server mới chịu trả đáp án chữ + giải thích (A3).
      try {
        const { data: reviewed } = await api.get<{ exercises?: ExerciseReview[] }>(
          `/skill-tree/practice/${session.sessionId}/review`,
        )
        setReview(Array.isArray(reviewed?.exercises) ? reviewed.exercises : null)
      } catch {
        /* giải thích không tải được: kết quả + đúng/sai vẫn hiện đủ */
      }
    } catch {
      // v1 vẫn hiện kết quả cục bộ khi submit hỏng — giữ nguyên để học viên không mất công làm bài.
      setSubmitResult({ scorePercent, xpEarned: 0, status: 'COMPLETED' })
    } finally {
      // Nộp xong thì nháp hết vai trò — giữ lại chỉ khiến lần luyện sau nhặt lại bài cũ. Xoá ở
      // `finally` chứ không ở nhánh thành công: kể cả khi submit hỏng, bài đã chấm và đã hiện kết
      // quả, nên bản nháp không còn là thứ cần khôi phục.
      if (draftScope) clearLessonDraft(draftScope)
      setDraftSavedAt(null)
      setDraftRestored(false)
    }
  }

  const handleGenerateNext = async () => {
    if (!nodeId) return
    setGeneratingNext(true)
    setError(null)
    setErrorInfo(null)
    try {
      // `next` LUÔN trả 202 + jobId → bắt buộc phải poll (v1 thiếu bước này nên nút không chạy).
      const sessionId = await generateSkillSession()
      if (sessionId) {
        await loadDetail(sessionId)
        setAnswers(new Map())
        setChoiceKeys(new Map())
        setPending(new Set())
        setCheckError(null)
        setReview(null)
        setSubmitted(false)
        setSubmitResult(null)
        // Đề mới ⇒ nháp của đề cũ vô nghĩa. Xoá cả khoá lẫn cờ sẵn-sàng để vòng khôi phục chạy lại
        // cho scope mới thay vì tưởng mình đã khôi phục rồi.
        if (draftScope) clearLessonDraft(draftScope)
        draftReadyRef.current = null
        setDraftSavedAt(null)
        setDraftRestored(false)
      } else {
        setError(t('generateError'))
      }
    } catch (err) {
      failWith(err, 'generateError')
    } finally {
      setGeneratingNext(false)
    }
  }

  if (meLoading || !me) return <LoadingState label={t('loading')} />

  const readingPassage =
    session && !Array.isArray(session.exercises) ? session.exercises.reading_passage : undefined

  /**
   * Câu trạng thái nháp. Phải nêu ĐÚNG phạm vi — "trên thiết bị này" — vì đây là `localStorage` của
   * một trình duyệt, không phải server (cùng ràng buộc đã áp cho nhãn bài thi ở B-14).
   */
  const savedNote = draftUnavailable ? (
    <span className="text-ga-red">{tShell('saveUnavailable')}</span>
  ) : draftRestored && !submitted ? (
    tShell('restoredDraft')
  ) : draftSavedAt ? (
    tShell('savedOnDevice', {
      time: fmt.time(draftSavedAt, {
        hour: '2-digit',
        minute: '2-digit',
      }),
    })
  ) : null

  return (
    <LessonShell
      mode="practice"
      onModeChange={(next) => {
        if (next === 'learn') router.push(`/v2/student/learn/${nodeId}`)
      }}
      chapter={
        session
          ? t('headerSubtitle', { node: session.sourceNodeTitleVi, gen: session.generation })
          : t('subtitle')
      }
      title={`${SKILL_LABELS[skill]} · ${SKILL_LABELS_DE[skill]}`}
      /* KHÔNG truyền `progress`: dải lá `LeafProgress` bên dưới ĐÃ là thanh tiến độ của runner —
         nó được dựng để THAY thanh xám, không phải đứng cạnh. Truyền thêm ở đây làm một màn có
         HAI `role="progressbar"` cùng `aria-valuenow`/`aria-valuemax` (vỏ + lá): người dùng
         screen reader nghe hai lần cùng một con số, người nhìn thấy hai thước đo cho cùng một
         việc. Trang HỌC (`learn/[nodeId]`) vẫn dùng thanh của vỏ vì ở đó không có dải lá. */
      savedNote={savedNote}
      onExit={() => router.push(`/v2/student/practice/${nodeId}`)}
    >
      <>
          {/* Thoát giữa chừng: session giữ ACTIVE, quay lại là tiếp — cây không mất gì. Vỏ chỉ
              mang exit về trang kỹ năng, nên đường về CÂY (L3a) đứng trong nội dung. */}
          <Link
            href={treeHref(nodeId, skill, false)}
            className="ga-ui inline-flex min-h-10 items-center gap-1.5 self-start text-[13px] font-semibold text-ga-muted transition-colors hover:text-ga-ink lg:min-h-0"
          >
            <TreeDeciduous size={15} aria-hidden /> {t('backToTree')}
          </Link>

          {error && (
            <ErrorBanner
              message={error}
              // Quota/giới hạn tần suất: thử lại ngay chỉ ăn thêm 429 — để học viên tự quay lại sau.
              onRetry={errorInfo?.kind === 'quota' ? undefined : () => void fetchSession()}
            />
          )}

          {/* Đầu bài + điểm hiện tại */}
          {session && (
            <GaCard className="flex items-center gap-3 p-4 lg:gap-4 lg:p-5">
              <GaGlyph icon={SKILL_ICON[skill]} size="lg" tone="navy" />
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
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <LeafProgress
                  total={exercises.length}
                  answered={answers.size}
                  accent={accent}
                  label={t('progressLabel', { answered: answers.size, total: exercises.length })}
                />
                {/* Trả lời xong một câu phải NGHE được, không chỉ nhìn được (S-04 §Accessibility).
                    Việc này trước đây do dòng `Bước x/y` của vỏ đảm nhiệm; vỏ không còn thanh tiến
                    độ trên trang luyện nên dải lá mang luôn thông báo. `role="progressbar"` tự nó
                    KHÔNG được đọc lại khi đổi giá trị — phải có vùng `aria-live`. */}
                <p aria-live="polite" className="sr-only">
                  {t('progressLabel', { answered: answers.size, total: exercises.length })}
                </p>
                <p className="ga-ui whitespace-nowrap text-[11px] text-ga-subtle">
                  <span className="font-ga-display text-[15px] font-medium" style={{ color: accent }}>
                    {correctCount}/{exercises.length}
                  </span>{' '}
                  {t('correctLabel')}
                </p>
              </div>
            </GaCard>
          )}

          {/* Đang sinh đề (202 + job nền) — nghi thức ươm mầm thay spinner chung. */}
          {(loading || generatingNext) && !error && <SeedlingWait label={t('seeding')} accent={accent} />}

          {/* Session không có bài nào: cho lối thoát thay vì màn hình cụt (không nộp được,
              cũng không có nút sinh lại vì nút đó chỉ hiện sau khi nộp). */}
          {!loading && session && exercises.length === 0 && (
            <GaCard className="p-5 text-center lg:p-6" style={{ borderColor: 'var(--ga-orange)' }}>
              <p className="ga-ui text-[14px] font-semibold text-ga-ink">{t('emptySession')}</p>
              <p className="ga-ui mt-1 text-[13px] text-ga-muted">{t('emptySessionHint')}</p>
              <button
                type="button"
                onClick={() => void handleGenerateNext()}
                disabled={generatingNext}
                className="ga-ui mt-4 inline-flex min-h-10 items-center gap-2 rounded-ga bg-ga-accent px-5 py-2.5 text-[13.5px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60 lg:min-h-0"
              >
                {generatingNext ? (
                  <RefreshCw size={14} className="animate-spin" aria-hidden />
                ) : (
                  <Sparkles size={14} aria-hidden />
                )}
                {generatingNext ? t('generating') : t('regenerate')}
              </button>
            </GaCard>
          )}

          {/* Bài đọc (LESEN) */}
          {readingPassage && (
            <GaCard className="p-4 lg:p-5" style={{ borderColor: accent }}>
              <GaCap className="mb-3">{readingPassage.text_type || 'Lesetext'}</GaCap>
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
                  onAnswer={(answer) => void handleAnswer(idx, answer)}
                  answered={answers.has(idx)}
                  pending={pending.has(idx)}
                  isCorrect={answers.get(idx)?.correct ?? null}
                  correctIndex={choiceKeys.get(idx)}
                  review={review?.[idx]}
                  revealExplanations={submitted}
                />
              ))}
            </div>
          )}

          {checkError && <ErrorBanner message={checkError} />}

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
              <GaGlyph
                icon={Trophy}
                size="lg"
                tone={submitResult.scorePercent >= 60 ? 'green' : 'yellow'}
                className="mx-auto mb-3"
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

              {/* ≥70%: "Về cây" là CTA chính — phần thưởng là cây lớn lên, đi xem nó. Dưới ngưỡng:
                  làm thêm bài mới là việc chính, cây vẫn ở đó. */}
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href={treeHref(nodeId, skill, true)}
                  data-testid="back-to-tree"
                  className={
                    submitResult.scorePercent >= MASTERY_PERCENT
                      ? 'ga-ui inline-flex min-h-10 items-center gap-2 rounded-ga bg-ga-accent px-5 py-2.5 text-[13.5px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90 lg:min-h-0'
                      : 'ga-ui inline-flex min-h-10 items-center gap-2 rounded-ga border-2 border-ga-line bg-ga-card px-5 py-2.5 text-[13.5px] font-semibold text-ga-muted transition-colors hover:bg-ga-surface lg:min-h-0'
                  }
                >
                  <TreeDeciduous size={14} aria-hidden />
                  {submitResult.scorePercent >= MASTERY_PERCENT ? t('backToTreeGrow') : t('backToTree')}
                </Link>
                <button
                  type="button"
                  onClick={() => void handleGenerateNext()}
                  disabled={generatingNext}
                  className={
                    submitResult.scorePercent >= MASTERY_PERCENT
                      ? 'ga-ui inline-flex min-h-10 items-center gap-2 rounded-ga border-2 border-ga-line bg-ga-card px-5 py-2.5 text-[13.5px] font-semibold text-ga-muted transition-colors hover:bg-ga-surface disabled:opacity-60 lg:min-h-0'
                      : 'ga-ui inline-flex min-h-10 items-center gap-2 rounded-ga bg-ga-accent px-5 py-2.5 text-[13.5px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60 lg:min-h-0'
                  }
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
      </>
    </LessonShell>
  )
}
