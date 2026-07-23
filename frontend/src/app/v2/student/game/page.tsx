'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Heart, Trophy } from 'lucide-react'
import api from '@/lib/api'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'
import { GaBtn, GaCap, GaCard, GaPageHdr, LoadingState } from '@/components/ui-v2'
import { GameModeSwitch } from './GameModeSwitch'

/**
 * /v2/student/game — trò chơi kéo-thả khối từ (Galerie shell).
 *
 * Port của /student/game: CÙNG endpoint (GET /grammar/syllabus/topics?cefrLevel=A1 → lấy 4 chủ đề
 * đầu, rồi GET /grammar/syllabus/topics/{id}/exercises?limit=5), cùng bộ lọc exercise_type
 * (FILL_BLANK | MULTIPLE_CHOICE), cùng cách parse question_json → chỗ trống, cùng luật chơi
 * (deck 10 câu xáo trộn · 3 mạng · chấm client-side), cùng event PostHog `feature_session`
 * (usePageTimeTracker('game')).
 *
 * ⚠️ KHÁC HẲN /game ở root — và /game KHÔNG PHẢI demo. `app/game/page.tsx` render LegoGameScreen,
 * component đó gọi API THẬT: `fetchVocabGameQuestions` → GET /words?size=&locale=&cefr=
 * (gameAdapters.ts:412-425) + POST /grammar/validate (LegoGameScreen.tsx:278) + PostHog
 * `trackFeatureAction('lego_game', …)`. Đó là game GHÉP CÂU từ ngân hàng TỪ VỰNG; trang này là
 * game ĐIỀN CHỖ TRỐNG từ ngân hàng NGỮ PHÁP (grammar syllabus) — hai tính năng khác nhau.
 * /game CHƯA được port. Ai xoá cây v1 mà xoá luôn `app/game` + `components/game/*` là MẤT tính năng
 * (plan 2026-07-14-xoa-sach-v1-web.md từng xếp nhầm nó vào nhóm "demo, xoá được ngay").
 *
 * Lưu ý: game KHÔNG gọi POST /grammar/syllabus/exercises/{id}/submit — chấm điểm chạy hoàn toàn
 * ở client và không ghi mastery (đúng như v1). Runner ghi tiến độ thật là /v2/student/grammar/practice.
 */

interface WordItem {
  id: string
  word: string
  colorIdx: number
}

interface Question {
  id: number
  category: string
  level: string
  parts: string[]
  answers: string[]
  pool: WordItem[]
  explanation: string
}

type FeedbackState = null | 'correct' | 'incorrect'

interface DragData {
  wordId: string
  word: string
  colorIdx: number
}

interface RawExercise {
  id: number
  exercise_type: string
  difficulty: number
  question_json: string
}

interface ParsedQ {
  prompt: string
  options?: string[]
  correct_answer: string
  explanation_vi?: string
}

/** Màu khối từ — giữ nguyên bảng của v1 (vàng Đức / lam / tím / cam). */
const BLOCK_COLORS = [
  { bg: '#FFCD00', shadow: '#C9A200', text: '#1A1A1A' },
  { bg: '#2F6FC9', shadow: '#22508F', text: '#FFFFFF' },
  { bg: '#7C56C8', shadow: '#5A3E92', text: '#FFFFFF' },
  { bg: '#E07B39', shadow: '#B0602A', text: '#FFFFFF' },
]

const TOTAL_LIVES = 3
const DECK_SIZE = 10
const TOPICS_PER_DECK = 4
const EXERCISES_PER_TOPIC = 5

function rawToQuestion(ex: RawExercise, catLabel: string): Question | null {
  try {
    const parsed: ParsedQ =
      typeof ex.question_json === 'string'
        ? JSON.parse(ex.question_json)
        : (ex.question_json as unknown as ParsedQ)

    const prompt: string = parsed.prompt ?? ''
    const correct: string = parsed.correct_answer ?? ''
    if (!prompt || !correct) return null

    const BLANK = /_{2,}|\.\.\.|___/
    const parts = prompt.split(BLANK)
    if (parts.length < 2) return null

    const optionWords: string[] = parsed.options
      ? parsed.options.filter((o) => typeof o === 'string' && o.trim())
      : [correct, 'der', 'die', 'das', 'ein'].filter((o) => o !== correct)

    if (!optionWords.includes(correct)) optionWords.unshift(correct)

    const shuffled = [...optionWords].sort(() => Math.random() - 0.5)
    const pool: WordItem[] = shuffled.map((w, i) => ({
      id: `${ex.id}_${i}`,
      word: w,
      colorIdx: i % BLOCK_COLORS.length,
    }))

    return {
      id: ex.id,
      category: catLabel,
      level: ex.difficulty === 1 ? 'A1' : ex.difficulty === 2 ? 'A2' : 'B1',
      parts,
      answers: [correct],
      pool,
      explanation: parsed.explanation_vi ?? '',
    }
  } catch {
    return null
  }
}

function LegoBlock({ item, isUsed }: { item: WordItem; isUsed: boolean }) {
  const color = BLOCK_COLORS[item.colorIdx % BLOCK_COLORS.length]
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { wordId: item.id, word: item.word, colorIdx: item.colorIdx } satisfies DragData,
    disabled: isUsed,
  })

  if (isUsed) {
    return (
      <div className="min-w-[72px] rounded-ga border-2 border-dashed border-ga-line bg-ga-surface px-4 py-2.5 text-center opacity-40">
        <span className="ga-ui text-[14px] font-bold text-ga-subtle">{item.word}</span>
      </div>
    )
  }

  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="ga-ui relative cursor-grab touch-none rounded-ga px-5 py-2.5 font-bold active:cursor-grabbing"
      style={{
        background: color.bg,
        boxShadow: `0 6px 0 0 ${color.shadow}`,
        opacity: isDragging ? 0.4 : 1,
      }}
      whileHover={{ y: -2 }}
      whileTap={{ y: 2 }}
    >
      <span style={{ color: color.text }}>{item.word}</span>
    </motion.div>
  )
}

function FloatingBlock({ item }: { item: WordItem }) {
  const color = BLOCK_COLORS[item.colorIdx % BLOCK_COLORS.length]
  return (
    <div
      className="ga-ui scale-105 cursor-grabbing rounded-ga px-5 py-2.5 font-bold"
      style={{ background: color.bg, boxShadow: `0 6px 0 0 ${color.shadow}` }}
    >
      <span style={{ color: color.text }}>{item.word}</span>
    </div>
  )
}

function DropSlot({
  slotIdx,
  filledWord,
  filledColorIdx,
  onRemove,
  feedbackState,
  correctAnswer,
}: {
  slotIdx: number
  filledWord: string | null
  filledColorIdx: number | null
  onRemove: (slotIdx: number) => void
  feedbackState: FeedbackState
  correctAnswer: string
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${slotIdx}` })

  if (filledWord) {
    const color = BLOCK_COLORS[(filledColorIdx ?? 0) % BLOCK_COLORS.length]
    const isCorrect = feedbackState !== null && filledWord === correctAnswer
    const bg = feedbackState === null ? color.bg : isCorrect ? 'var(--ga-green)' : 'var(--ga-red)'
    const shadow = feedbackState === null ? color.shadow : isCorrect ? '#167145' : '#9E1E15'
    return (
      <span className="mx-1.5 my-1 inline-flex items-center">
        <span
          onClick={() => feedbackState === null && onRemove(slotIdx)}
          className="ga-ui cursor-pointer rounded-ga px-4 py-2 text-[15px] font-bold text-white"
          style={{ background: bg, boxShadow: `0 4px 0 0 ${shadow}` }}
        >
          {filledWord} {feedbackState === null && '×'}
        </span>
      </span>
    )
  }

  return (
    <span
      ref={setNodeRef}
      className={`mx-1.5 my-1 inline-flex h-11 min-w-[70px] items-center justify-center rounded-ga border-2 border-dashed transition-colors lg:min-w-[90px] ${
        isOver ? 'border-ga-gold bg-ga-yellow-soft' : 'border-ga-line bg-ga-surface'
      }`}
    >
      <span className="ga-ui text-[12px] font-bold text-ga-subtle">_ _ _</span>
    </span>
  )
}

export default function V2StudentGamePage() {
  usePageTimeTracker('game')
  const t = useTranslations('v2.student.game')
  const router = useRouter()

  const [questions, setQuestions] = useState<Question[]>([])
  const [loadingQ, setLoadingQ] = useState(true)
  const [questionIdx, setQuestionIdx] = useState(0)
  const [slots, setSlots] = useState<(string | null)[]>([])
  const [slotColorIdxs, setSlotColorIdxs] = useState<(number | null)[]>([])
  const [slotWordIds, setSlotWordIds] = useState<(string | null)[]>([])
  const [usedWordIds, setUsedWordIds] = useState<Set<string>>(new Set())
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [lives, setLives] = useState(TOTAL_LIVES)
  const [score, setScore] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [activeItem, setActiveItem] = useState<WordItem | null>(null)

  const resetSlots = useCallback((answerCount: number) => {
    setSlots(Array(answerCount).fill(null))
    setSlotColorIdxs(Array(answerCount).fill(null))
    setSlotWordIds(Array(answerCount).fill(null))
    setUsedWordIds(new Set())
    setFeedback(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingQ(true)
      try {
        const topicsRes = await api.get<{ id: number; title_de: string }[]>(
          '/grammar/syllabus/topics?cefrLevel=A1',
        )
        const topics = topicsRes.data ?? []
        const allQ: Question[] = []
        for (const topic of topics.slice(0, TOPICS_PER_DECK)) {
          const exRes = await api.get<RawExercise[]>(
            `/grammar/syllabus/topics/${topic.id}/exercises?limit=${EXERCISES_PER_TOPIC}`,
          )
          const mapped = (exRes.data ?? [])
            .filter((e) => e.exercise_type === 'FILL_BLANK' || e.exercise_type === 'MULTIPLE_CHOICE')
            .map((e) => rawToQuestion(e, topic.title_de))
            .filter((q): q is Question => q !== null)
          allQ.push(...mapped)
        }
        if (cancelled) return
        const deck = allQ.sort(() => Math.random() - 0.5).slice(0, DECK_SIZE)
        setQuestions(deck)
        if (deck.length > 0) resetSlots(deck[0].answers.length)
      } catch {
        // rơi vào trạng thái rỗng — như v1
      } finally {
        if (!cancelled) setLoadingQ(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [resetSlots])

  const q = questions[questionIdx]
  const allFilled = slots.length > 0 && slots.every((s) => s !== null)

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined
    if (!data) return
    setActiveItem(q?.pool.find((p) => p.id === data.wordId) ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null)
    const { active, over } = event
    if (!over) return

    const slotId = over.id as string
    if (!slotId.startsWith('slot-')) return
    const slotIdx = parseInt(slotId.replace('slot-', ''), 10)

    const data = active.data.current as DragData | undefined
    if (!data) return
    if (usedWordIds.has(data.wordId)) return

    setSlots((prev) => {
      const n = [...prev]
      n[slotIdx] = data.word
      return n
    })
    setSlotColorIdxs((prev) => {
      const n = [...prev]
      n[slotIdx] = data.colorIdx
      return n
    })
    setSlotWordIds((prev) => {
      const n = [...prev]
      n[slotIdx] = data.wordId
      return n
    })
    setUsedWordIds((prev) => {
      const n = new Set(prev)
      n.add(data.wordId)
      return n
    })
  }

  const handleRemove = (slotIdx: number) => {
    const wordId = slotWordIds[slotIdx]
    if (wordId)
      setUsedWordIds((prev) => {
        const n = new Set(prev)
        n.delete(wordId)
        return n
      })
    setSlots((prev) => {
      const n = [...prev]
      n[slotIdx] = null
      return n
    })
    setSlotColorIdxs((prev) => {
      const n = [...prev]
      n[slotIdx] = null
      return n
    })
    setSlotWordIds((prev) => {
      const n = [...prev]
      n[slotIdx] = null
      return n
    })
  }

  const handleCheck = () => {
    if (!q) return
    const correct = slots.every((s, i) => s?.toLowerCase() === q.answers[i]?.toLowerCase())
    setFeedback(correct ? 'correct' : 'incorrect')
    if (correct) setScore((s) => s + 1)
    else setLives((l) => l - 1)
  }

  const handleNext = () => {
    const nextIdx = questionIdx + 1
    if (nextIdx < questions.length) {
      setQuestionIdx(nextIdx)
      resetSlots(questions[nextIdx].answers.length)
    } else {
      setCompleted(true)
    }
  }

  if (loadingQ) {
    return (
      <div className="flex min-h-full flex-col">
        <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
          <LoadingState label={t('loading')} />
        </div>
      </div>
    )
  }

  if (completed || !q) {
    const finished = completed && questions.length > 0
    return (
      <div className="flex min-h-full flex-col">
        <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-xl">
            <GaCard className="flex flex-col items-center gap-4 px-4 py-12 text-center sm:px-6 lg:py-14">
              <span className="grid h-14 w-14 place-items-center rounded-ga-pill bg-ga-yellow-soft text-ga-gold">
                <Trophy size={28} aria-hidden />
              </span>
              <div className="space-y-1">
                <p className="font-ga-display text-[20px] font-medium text-ga-ink lg:text-[24px]">
                  {finished ? t('doneTitle', { score, total: questions.length }) : t('emptyTitle')}
                </p>
                <p className="ga-ui text-[13px] text-ga-muted">{finished ? t('doneDesc') : t('emptyDesc')}</p>
              </div>
              <GaBtn onClick={() => router.push('/v2/student/dashboard')}>{t('backHome')}</GaBtn>
            </GaCard>
          </div>
        </div>
      </div>
    )
  }

  const progress = (questionIdx / Math.max(questions.length, 1)) * 100

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex min-h-full flex-col">
        <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

        <div className="flex-1 space-y-5 px-4 py-6 sm:px-6 lg:px-10">
          <GameModeSwitch active="blank" />

          <div className="mx-auto max-w-xl space-y-5">
            {/* Thanh trạng thái: thoát · tiến độ · mạng */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push('/v2/student/dashboard')}
                aria-label={t('exit')}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-ga border border-ga-line bg-ga-card text-ga-muted transition-colors hover:bg-ga-surface lg:h-9 lg:w-9"
              >
                <ArrowLeft size={16} aria-hidden />
              </button>

              <div
                className="h-1.5 flex-1 overflow-hidden rounded-ga-pill bg-ga-border"
                role="progressbar"
                aria-label={t('progressLabel')}
                aria-valuenow={questionIdx}
                aria-valuemin={0}
                aria-valuemax={questions.length}
              >
                <div
                  className="h-full rounded-ga-pill bg-ga-accent transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex shrink-0 gap-1" aria-label={t('livesLabel', { lives })}>
                {Array.from({ length: TOTAL_LIVES }).map((_, i) => (
                  <Heart
                    key={i}
                    size={18}
                    aria-hidden
                    fill={i < lives ? 'var(--ga-red)' : 'none'}
                    className={i < lives ? 'text-ga-red' : 'text-ga-faint'}
                  />
                ))}
              </div>
            </div>

            <GaCap className="break-words">
              {q.category} · {q.level} · {questionIdx + 1}/{questions.length}
            </GaCap>

            {/* Câu hỏi + ô trống */}
            <GaCard className="p-4 sm:p-6 lg:p-8">
              <p className="break-words font-ga-display text-[18px] leading-loose text-ga-ink sm:text-[20px] lg:text-[22px]">
                {q.parts.map((part, i) => (
                  <span key={i}>
                    {part}
                    {i < q.parts.length - 1 && (
                      <DropSlot
                        slotIdx={i}
                        filledWord={slots[i]}
                        filledColorIdx={slotColorIdxs[i]}
                        onRemove={handleRemove}
                        feedbackState={feedback}
                        correctAnswer={q.answers[i]}
                      />
                    )}
                  </span>
                ))}
              </p>
            </GaCard>

            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  role="status"
                  className="rounded-ga border px-4 py-3.5"
                  style={{
                    borderColor: feedback === 'correct' ? 'var(--ga-green)' : 'var(--ga-red)',
                    background: feedback === 'correct' ? 'var(--ga-green-soft)' : 'var(--ga-red-soft)',
                  }}
                >
                  <p
                    className="ga-ui text-[13.5px] font-semibold"
                    style={{ color: feedback === 'correct' ? 'var(--ga-green)' : 'var(--ga-red)' }}
                  >
                    {feedback === 'correct' ? t('correct') : t('wrong', { answer: q.answers.join(', ') })}
                  </p>
                  {q.explanation && <p className="ga-ui mt-1 text-[12.5px] text-ga-muted">{q.explanation}</p>}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Kho khối từ */}
            <div className="rounded-ga border border-ga-line bg-ga-surface p-4 lg:p-6">
              <GaCap className="mb-3 block">{t('poolCap')}</GaCap>
              <div className="flex flex-wrap gap-3">
                {q.pool.map((item) => (
                  <LegoBlock key={item.id} item={item} isUsed={usedWordIds.has(item.id)} />
                ))}
              </div>
            </div>

            <GaBtn
              size="lg"
              variant={allFilled || feedback ? 'ink' : 'ghost'}
              onClick={feedback ? handleNext : handleCheck}
              disabled={!allFilled && !feedback}
              className="w-full"
            >
              {feedback ? t('next') : t('check')}
            </GaBtn>
          </div>
        </div>
      </div>

      <DragOverlay>{activeItem ? <FloatingBlock item={activeItem} /> : null}</DragOverlay>
    </DndContext>
  )
}
