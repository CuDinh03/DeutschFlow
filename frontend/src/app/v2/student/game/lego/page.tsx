'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { ArrowLeft, Heart, Lightbulb, Trophy, Volume2 } from 'lucide-react'
import api from '@/lib/api'
import { speakGerman } from '@/lib/speechDe'
import {
  fetchVocabGameQuestions,
  isCorrectLocal,
  serializeAnswer,
  tokenizeForSlots,
  type GameQuestion,
  type WordItem,
} from '@/components/game/gameAdapters'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { useTracking } from '@/hooks/useTracking'
import { GaBtn, GaCap, GaCard, GaPageHdr, LoadingState } from '@/components/ui-v2'
import { GameModeSwitch } from '../GameModeSwitch'

/**
 * /v2/student/game/lego — trò chơi GHÉP CÂU từ ngân hàng TỪ VỰNG (vỏ Galerie).
 *
 * Port của /game (root) → `components/game/LegoGameScreen.tsx`. GIỮ NGUYÊN toàn bộ logic bằng cách
 * IMPORT lại `components/game/gameAdapters.ts` (fetchVocabGameQuestions · tokenizeForSlots ·
 * serializeAnswer · isCorrectLocal) — không copy-paste. Chỉ VỎ được thay: StudentShell (v1) →
 * Galerie, và route thoát /dashboard → /v2/student/dashboard.
 *
 * Contract giữ y nguyên:
 *   - GET  /words?size=&locale=&cefr=  (qua fetchVocabGameQuestions, count 12, cefr = practiceFloorLevel)
 *   - POST /grammar/validate { answer, expected, joiner, sessionType: 'GENERAL', level }
 *     → lỗi mạng thì fallback chấm local `isCorrectLocal` (đúng như v1)
 *   - PostHog: trackFeatureAction('lego_game', 'started' | 'completed')
 *   - Luật chơi: 3 mạng · +20 điểm mỗi câu đúng.
 *
 * ⚠️ KHÁC /v2/student/game: trang kia là ĐIỀN CHỖ TRỐNG từ ngân hàng NGỮ PHÁP (grammar syllabus).
 * Trang này là SẮP XẾP TỪ thành câu, dữ liệu lấy từ ví dụ trong ngân hàng TỪ VỰNG (/words).
 * Hai tính năng khác nhau — một khảo sát trước từng xếp nhầm /game vào nhóm "demo, xoá được ngay".
 */

const TOTAL_LIVES = 3
const POINTS_PER_CORRECT = 20
const DECK_SIZE = 12

type GrammarValidateResponse = {
  valid: boolean
  scorePercent: number
  errors?: Array<{
    code: string
    message: string
    position?: number | null
    expectedToken?: string | null
    actualToken?: string | null
  }>
}

function WordBlock({ item, isUsed }: { item: WordItem; isUsed: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
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
        background: item.color,
        boxShadow: `0 6px 0 0 ${item.shadow}`,
        color: item.text,
        opacity: isDragging ? 0.4 : 1,
      }}
      whileHover={{ y: -2 }}
      whileTap={{ y: 2 }}
    >
      {item.word}
    </motion.div>
  )
}

function FloatingBlock({ item }: { item: WordItem }) {
  return (
    <div
      className="ga-ui scale-105 cursor-grabbing rounded-ga px-5 py-2.5 font-bold"
      style={{ background: item.color, boxShadow: `0 6px 0 0 ${item.shadow}`, color: item.text }}
    >
      {item.word}
    </div>
  )
}

function DropSlot({
  slotIdx,
  filled,
  checked,
  onClear,
}: {
  slotIdx: number
  filled: string | null
  checked: 'idle' | 'correct' | 'wrong'
  onClear: (i: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${slotIdx}` })

  if (filled) {
    const bg =
      checked === 'idle' ? 'var(--ga-ink)' : checked === 'correct' ? 'var(--ga-green)' : 'var(--ga-red)'
    return (
      <button
        type="button"
        onClick={() => checked === 'idle' && onClear(slotIdx)}
        className="ga-ui rounded-ga px-4 py-2.5 text-[15px] font-bold text-white"
        style={{ background: bg }}
      >
        {filled}
        {checked === 'idle' && ' ×'}
      </button>
    )
  }

  return (
    <span
      ref={setNodeRef}
      className={`inline-flex h-11 min-w-[90px] items-center justify-center rounded-ga border-2 border-dashed transition-colors ${
        isOver ? 'border-ga-gold bg-ga-yellow-soft' : 'border-ga-line bg-ga-surface'
      }`}
    >
      <span className="ga-ui text-[12px] font-bold text-ga-subtle">_ _ _</span>
    </span>
  )
}

export default function V2StudentLegoGamePage() {
  const t = useTranslations('v2.student.legoGame')
  const router = useRouter()
  const { me, loading: sessionLoading, practiceFloorLevel } = useStudentPracticeSession()
  const { trackFeatureAction } = useTracking()

  const [questions, setQuestions] = useState<GameQuestion[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const [slots, setSlots] = useState<(string | null)[]>([])
  const [slotWordIds, setSlotWordIds] = useState<(string | null)[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [checked, setChecked] = useState<'idle' | 'correct' | 'wrong'>('idle')
  const [validatorErrors, setValidatorErrors] = useState<string[]>([])
  const [showHint, setShowHint] = useState(false)
  const [lives, setLives] = useState(TOTAL_LIVES)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  const q = questions[index]
  const usedIds = useMemo(() => new Set(slotWordIds.filter(Boolean) as string[]), [slotWordIds])
  const wordById = useMemo(() => {
    const out = new Map<string, WordItem>()
    for (const w of q?.pool ?? []) out.set(w.id, w)
    return out
  }, [q])
  const activeWord = activeId ? (wordById.get(activeId) ?? null) : null
  const allFilled = slots.length > 0 && slots.every(Boolean)
  const progress = questions.length > 0 ? (index / questions.length) * 100 : 0

  const loadQuestions = useCallback(async () => {
    if (!me) return
    setQuestionsLoading(true)
    try {
      const mapped = await fetchVocabGameQuestions(
        (path: string, params?: Record<string, string>) =>
          api.get(path, { params }).then((r) => r.data),
        {
          locale: (me.locale || 'vi').toLowerCase(),
          cefr: practiceFloorLevel,
          count: DECK_SIZE,
        },
      )
      setQuestions(mapped)
      if (mapped.length > 0) trackFeatureAction('lego_game', 'started', { count: mapped.length })
    } catch {
      setQuestions([])
    } finally {
      setQuestionsLoading(false)
    }
  }, [me, practiceFloorLevel, trackFeatureAction])

  useEffect(() => {
    if (!me || sessionLoading) return
    void loadQuestions()
  }, [loadQuestions, me, sessionLoading])

  // Reset ô trống mỗi khi đổi câu — số ô = số token của đáp án chuẩn.
  useEffect(() => {
    if (!q) return
    const slotCount = tokenizeForSlots(q.answerCanonical, q.joiner).length
    setSlots(new Array(slotCount).fill(null))
    setSlotWordIds(new Array(slotCount).fill(null))
    setChecked('idle')
    setShowHint(false)
    setValidatorErrors([])
  }, [q])

  const clearSlot = (slotIdx: number) => {
    setSlots((prev) => prev.map((x, i) => (i === slotIdx ? null : x)))
    setSlotWordIds((prev) => prev.map((x, i) => (i === slotIdx ? null : x)))
    if (checked !== 'idle') setChecked('idle')
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    if (!event.over || !q) return
    const overId = String(event.over.id)
    if (!overId.startsWith('slot-')) return

    const slotIdx = Number(overId.replace('slot-', ''))
    const wordId = String(event.active.id)
    const found = q.pool.find((x) => x.id === wordId)
    if (!found) return
    if (usedIds.has(wordId) && slotWordIds[slotIdx] !== wordId) return

    const nextWords = [...slots]
    const nextIds = [...slotWordIds]
    const prevSlot = nextIds.findIndex((x) => x === wordId)
    if (prevSlot >= 0) {
      nextIds[prevSlot] = null
      nextWords[prevSlot] = null
    }
    nextIds[slotIdx] = wordId
    nextWords[slotIdx] = found.word
    setSlotWordIds(nextIds)
    setSlots(nextWords)
  }

  /** Chấm qua POST /grammar/validate; lỗi mạng → fallback chấm local (đúng như v1). */
  const checkAnswer = async () => {
    if (!q || !allFilled) return
    setValidatorErrors([])
    let ok = isCorrectLocal(q, slots)
    try {
      const { data } = await api.post<GrammarValidateResponse>('/grammar/validate', {
        answer: serializeAnswer(q, slots),
        expected: q.answerCanonical,
        joiner: q.joiner,
        sessionType: 'GENERAL',
        level: q.level,
      })
      ok = data.valid
      if (!data.valid) {
        const messages = (data.errors ?? []).slice(0, 3).map((x) => x.message)
        setValidatorErrors(messages.length > 0 ? messages : [t('wrongGeneric')])
      }
    } catch {
      ok = isCorrectLocal(q, slots)
    }

    if (ok) {
      setChecked('correct')
      setScore((s) => s + POINTS_PER_CORRECT)
    } else {
      setChecked('wrong')
      setLives((l) => Math.max(0, l - 1))
    }
  }

  const next = () => {
    if (!q) return
    if (index + 1 >= questions.length) {
      setDone(true)
      trackFeatureAction('lego_game', 'completed', { score })
      return
    }
    setIndex((i) => i + 1)
  }

  const restart = () => {
    setDone(false)
    setIndex(0)
    setLives(TOTAL_LIVES)
    setScore(0)
  }

  if (sessionLoading || questionsLoading) {
    return (
      <div className="flex min-h-full flex-col">
        <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
        <div className="flex-1 px-10 py-6">
          <LoadingState label={t('loading')} />
        </div>
      </div>
    )
  }

  if (done || !q) {
    const finished = done && questions.length > 0
    return (
      <div className="flex min-h-full flex-col">
        <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
        <div className="flex-1 space-y-5 px-10 py-6">
          <GameModeSwitch active="lego" />
          <div className="mx-auto max-w-xl">
            <GaCard className="flex flex-col items-center gap-4 px-6 py-14 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-ga-pill bg-ga-yellow-soft text-ga-gold">
                <Trophy size={28} aria-hidden />
              </span>
              <div className="space-y-1">
                <p className="font-ga-display text-[24px] font-medium text-ga-ink">
                  {finished ? t('doneTitle', { score }) : t('emptyTitle')}
                </p>
                <p className="ga-ui text-[13px] text-ga-muted">
                  {finished ? t('doneDesc') : t('emptyDesc')}
                </p>
              </div>
              <div className="flex gap-3">
                {finished && <GaBtn onClick={restart}>{t('playAgain')}</GaBtn>}
                <GaBtn variant="ghost" onClick={() => router.push('/v2/student/dashboard')}>
                  {t('backHome')}
                </GaBtn>
              </div>
            </GaCard>
          </div>
        </div>
      </div>
    )
  }

  return (
    <DndContext onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd}>
      <div className="flex min-h-full flex-col">
        <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

        <div className="flex-1 space-y-5 px-10 py-6">
          <GameModeSwitch active="lego" />

          <div className="mx-auto max-w-xl space-y-5">
            {/* Thanh trạng thái: thoát · tiến độ · mạng */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push('/v2/student/dashboard')}
                aria-label={t('exit')}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-ga border border-ga-line bg-ga-card text-ga-muted transition-colors hover:bg-ga-surface"
              >
                <ArrowLeft size={16} aria-hidden />
              </button>

              <div
                className="h-1.5 flex-1 overflow-hidden rounded-ga-pill bg-ga-border"
                role="progressbar"
                aria-label={t('progressLabel')}
                aria-valuenow={index}
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

            <GaCap>
              {q.category} · {q.level} · {index + 1}/{questions.length} · {t('score', { score })}
            </GaCap>

            {/* Đề bài + ô ghép câu */}
            <GaCard className="space-y-5 p-8">
              <div className="flex items-start justify-between gap-3">
                <p className="font-ga-display text-[20px] leading-snug text-ga-ink">{q.prompt}</p>
                {q.audioGerman && (
                  <button
                    type="button"
                    onClick={() => speakGerman(q.audioGerman as string)}
                    aria-label={t('listen')}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-ga border border-ga-line bg-ga-card text-ga-muted transition-colors hover:bg-ga-surface"
                  >
                    <Volume2 size={16} aria-hidden />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {slots.map((filled, i) => (
                  <DropSlot key={i} slotIdx={i} filled={filled} checked={checked} onClear={clearSlot} />
                ))}
              </div>

              {showHint && q.audioGerman && (
                <p className="ga-ui rounded-ga bg-ga-surface px-4 py-3 text-[12.5px] text-ga-muted">
                  {q.audioGerman}
                </p>
              )}
            </GaCard>

            <AnimatePresence>
              {checked !== 'idle' && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  role="status"
                  className="rounded-ga border px-4 py-3.5"
                  style={{
                    borderColor: checked === 'correct' ? 'var(--ga-green)' : 'var(--ga-red)',
                    background:
                      checked === 'correct' ? 'var(--ga-green-soft)' : 'var(--ga-red-soft)',
                  }}
                >
                  <p
                    className="ga-ui text-[13.5px] font-semibold"
                    style={{ color: checked === 'correct' ? 'var(--ga-green)' : 'var(--ga-red)' }}
                  >
                    {checked === 'correct' ? t('correct') : t('wrongGeneric')}
                  </p>
                  {validatorErrors.map((msg, i) => (
                    <p key={i} className="ga-ui mt-1 text-[12.5px] text-ga-muted">
                      {msg}
                    </p>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Kho khối từ */}
            <div className="rounded-ga border border-ga-line bg-ga-surface p-6">
              <GaCap className="mb-3 block">{t('poolCap')}</GaCap>
              <div className="flex flex-wrap gap-3">
                {q.pool.map((item) => (
                  <WordBlock key={item.id} item={item} isUsed={usedIds.has(item.id)} />
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <GaBtn
                variant="ghost"
                onClick={() => setShowHint((s) => !s)}
                disabled={!q.audioGerman}
                aria-label={t('hint')}
              >
                <Lightbulb size={15} aria-hidden />
                {t('hint')}
              </GaBtn>
              <GaBtn
                size="lg"
                variant={allFilled || checked !== 'idle' ? 'ink' : 'ghost'}
                onClick={checked !== 'idle' ? next : () => void checkAnswer()}
                disabled={!allFilled && checked === 'idle'}
                className="flex-1"
              >
                {checked !== 'idle' ? t('next') : t('check')}
              </GaBtn>
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>{activeWord ? <FloatingBlock item={activeWord} /> : null}</DragOverlay>
    </DndContext>
  )
}
