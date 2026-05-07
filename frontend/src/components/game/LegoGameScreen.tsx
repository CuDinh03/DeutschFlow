'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ArrowRight, Check, Heart, Lightbulb, Star, Volume2, X } from 'lucide-react'
import api from '@/lib/api'
import { clearTokens } from '@/lib/authSession'
import { speakGerman } from '@/lib/speechDe'
import { PracticeGlassSkeleton } from '@/components/practice/PracticeGlassSkeleton'
import { StudentShell } from '@/components/layouts/StudentShell'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import {
  fetchVocabGameQuestions,
  isCorrectLocal,
  sessionVariants,
  tokenizeForSlots,
  type GameQuestion,
  type WordItem,
} from './gameAdapters'

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

function WordBlock({
  item,
  dimmed = false,
  floating = false,
  onRemove,
}: {
  item: WordItem
  dimmed?: boolean
  floating?: boolean
  onRemove?: () => void
}) {
  return (
    <span
      className={`relative inline-flex select-none items-center gap-2 rounded-[12px] px-5 py-3 text-[22px] font-bold transition-all duration-200 ${
        floating ? 'scale-[1.03]' : ''
      }`}
      style={{
        background: dimmed ? '#E2E8F0' : item.color,
        boxShadow: dimmed
          ? 'none'
          : `0 5px 0 0 ${item.shadow}, 0 8px 20px rgba(0,0,0,0.15), 0 0 0 2px rgba(255,255,255,0.22) inset`,
        color: dimmed ? '#94A3B8' : item.text,
        opacity: dimmed ? 0.45 : 1,
      }}
    >
      <span>{item.word}</span>
      {onRemove ? (
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-xs text-current hover:bg-black/20"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label="Remove word"
        >
          ×
        </button>
      ) : null}
    </span>
  )
}

function DraggableWord({ item, used }: { item: WordItem; used: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: used,
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <button
      ref={setNodeRef}
      style={{
        ...style,
        background: used ? '#E2E8F0' : item.color,
        boxShadow: used ? 'none' : `0 5px 0 0 ${item.shadow}, 0 8px 20px rgba(0,0,0,0.15)`,
        color: used ? '#94A3B8' : item.text,
        opacity: isDragging ? 0.6 : used ? 0.45 : 1,
      }}
      {...listeners}
      {...attributes}
      className="relative select-none rounded-[12px] px-5 py-3 text-[22px] font-bold cursor-grab active:cursor-grabbing transition-all duration-200 hover:-translate-y-[2px] hover:scale-[1.01] focus-visible:outline-none"
      type="button"
      disabled={used}
    >
      <span
        className="absolute inset-0 rounded-[12px] pointer-events-none"
        style={{
          boxShadow: used ? 'none' : '0 0 0 2px rgba(0,48,94,0)',
        }}
      />
      {item.word}
    </button>
  )
}

function Slot({
  id,
  filledItem,
  onClear,
}: {
  id: string
  filledItem: WordItem | null
  onClear: () => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id })
  return (
    <span
      ref={setNodeRef}
      className="inline-flex items-center justify-center rounded-[12px] border-2 border-dashed px-4 py-2 mx-1 min-w-[140px] min-h-[58px] align-middle transition-all duration-200"
      style={{
        borderColor: isOver ? '#FFCE00' : filledItem ? '#93C5FD' : '#CBD5E1',
        background: isOver ? 'rgba(255,206,0,0.16)' : filledItem ? 'rgba(239,246,255,0.75)' : '#F8FAFF',
        boxShadow: isOver ? '0 0 0 4px rgba(255,206,0,0.22)' : 'none',
      }}
    >
      {filledItem ? (
        <WordBlock item={filledItem} onRemove={onClear} />
      ) : (
        <span className="text-[#CBD5E1] text-xl tracking-[0.2em]">_ _ _</span>
      )}
    </span>
  )
}

export default function LegoGameScreen() {
  const router = useRouter()

  const { me, loading: sessionLoading, targetLevel, practiceFloorLevel, streakDays, initials, reload } =
    useStudentPracticeSession()

  const [index, setIndex] = useState(0)
  const sessionType = 'GENERAL'
  const [questionsLoading, setQuestionsLoading] = useState(true)
  const [questions, setQuestions] = useState<GameQuestion[]>([])
  const [lives, setLives] = useState(3)
  const [score, setScore] = useState(0)
  const [slots, setSlots] = useState<(string | null)[]>([])
  const [slotWordIds, setSlotWordIds] = useState<(string | null)[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [checked, setChecked] = useState<'idle' | 'correct' | 'wrong'>('idle')
  const [showHint, setShowHint] = useState(false)
  const [done, setDone] = useState(false)
  const [validatorErrors, setValidatorErrors] = useState<string[]>([])

  const q = questions[index]
  const usedIds = useMemo(() => new Set(slotWordIds.filter(Boolean) as string[]), [slotWordIds])
  const wordById = useMemo(() => {
    const out = new Map<string, WordItem>()
    for (const w of q?.pool ?? []) out.set(w.id, w)
    return out
  }, [q])
  const activeWord = activeId ? wordById.get(activeId) ?? null : null
  const allFilled = slots.length > 0 && slots.every(Boolean)
  const progress = questions.length > 0 ? Math.round((index / questions.length) * 100) : 0
  const variant = sessionVariants[sessionType]

  const loadQuestions = useCallback(async () => {
    if (!me) return
    setQuestionsLoading(true)
    try {
      const uiLocale = (me.locale || 'vi').toLowerCase()
      const mapped = await fetchVocabGameQuestions(
        (path: string, params?: Record<string, string>) =>
          api.get(path, { params }).then((r) => r.data),
        {
          locale: uiLocale,
          cefr: practiceFloorLevel,
          count: 12,
        },
      )

      setQuestions(mapped)
      if (mapped.length > 0) {
        const slotCount = tokenizeForSlots(mapped[0]!.answerCanonical, mapped[0]!.joiner).length
        setSlots(new Array(slotCount).fill(null))
        setSlotWordIds(new Array(slotCount).fill(null))
      }
    } catch (err) {
      console.error('Game boot failed', err)
      setQuestions([])
    } finally {
      setQuestionsLoading(false)
    }
  }, [me, practiceFloorLevel])

  useEffect(() => {
    if (!me || sessionLoading) return
    void loadQuestions()
  }, [loadQuestions, me, sessionLoading])

  useEffect(() => {
    if (!q) return
    const slotCount = tokenizeForSlots(q.answerCanonical, q.joiner).length
    setSlots(new Array(slotCount).fill(null))
    setSlotWordIds(new Array(slotCount).fill(null))
    setChecked('idle')
    setShowHint(false)
    setValidatorErrors([])
  // q is questions[index] — q?.id uniquely identifies the question; suppressing exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, q?.id])

  const resetQuestion = () => {
    if (!q) return
    const slotCount = tokenizeForSlots(q.answerCanonical, q.joiner).length
    setSlots(new Array(slotCount).fill(null))
    setSlotWordIds(new Array(slotCount).fill(null))
    setChecked('idle')
    setShowHint(false)
    setValidatorErrors([])
  }

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
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

  const clearSlot = (slotIdx: number) => {
    const nextWords = [...slots]
    const nextIds = [...slotWordIds]
    nextWords[slotIdx] = null
    nextIds[slotIdx] = null
    setSlots(nextWords)
    setSlotWordIds(nextIds)
    if (checked !== 'idle') setChecked('idle')
  }

  const checkAnswer = async () => {
    if (!q || !allFilled) return
    setValidatorErrors([])
    const serialized = q.joiner === '|'
      ? slots.map((x) => String(x || '').trim()).join('|')
      : slots.map((x) => String(x || '').trim()).join(' ')
    let ok = isCorrectLocal(q, slots)
    try {
      const { data } = await api.post<GrammarValidateResponse>('/grammar/validate', {
        answer: serialized,
        expected: q.answerCanonical,
        joiner: q.joiner,
        sessionType,
        level: q.level,
      })
      ok = data.valid
      if (!data.valid) {
        const messages = (data.errors ?? []).slice(0, 3).map((x) => x.message)
        setValidatorErrors(messages.length > 0 ? messages : ['Câu chưa đúng theo rule ngữ pháp.'])
      }
    } catch {
      ok = isCorrectLocal(q, slots)
    }

    if (ok) {
      setChecked('correct')
      setScore((s) => s + 20)
    } else {
      setChecked('wrong')
      setLives((l) => Math.max(0, l - 1))
    }
  }

  const next = () => {
    if (!q) return
    if (index + 1 >= questions.length) {
      setDone(true)
      return
    }
    setIndex((i) => i + 1)
  }

  if (sessionLoading) {
    return (
      <div className="df-page-mesh flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <PracticeGlassSkeleton className="max-w-lg" blocks={4} />
      </div>
    )
  }

  if (!me) {
    return (
      <div className="df-page-mesh flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-10">
        <p className="max-w-md text-center text-sm text-[#64748B]">Could not load your profile.</p>
        <button
          type="button"
          className="rounded-[14px] bg-[#00305E] px-5 py-2.5 text-sm font-bold text-white shadow-md"
          onClick={() => void reload()}
        >
          Retry
        </button>
      </div>
    )
  }

  if (questionsLoading) {
    return (
      <StudentShell
        activeSection="game"
        user={{ displayName: me.displayName, role: me.role }}
        targetLevel={targetLevel}
        streakDays={streakDays}
        initials={initials}
        onLogout={() => {
          clearTokens()
          router.push('/login')
        }}
        headerTitle="Trò chơi Lego"
      >
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 py-12">
          <PracticeGlassSkeleton className="max-w-lg" blocks={4} />
        </div>
      </StudentShell>
    )
  }

  return (
    <StudentShell
      activeSection="game"
      user={{ displayName: me.displayName, role: me.role }}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      hideBottomNav={!done && !!q}
      onLogout={() => {
        clearTokens()
        router.push('/login')
      }}
      headerTitle="Trò chơi Lego"
    >
      <DndContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="max-w-5xl mx-auto flex flex-col h-full">
          {done ? (
            <div className="bg-white border-2 border-[#E2E8F0] rounded-2xl p-8 text-center shadow-lg df-glass-subtle">
              <h2 className="text-2xl font-bold text-[#00305E] mb-2">Hoàn thành {variant.title}</h2>
              <p className="text-slate-600 mb-1">Điểm của bạn: <b>{score}</b></p>
              <p className="text-slate-600 mb-6">Bạn đã hoàn thành chế độ chơi độc lập.</p>
              <div className="flex gap-3 justify-center">
                <button
                  className="px-6 py-2.5 rounded-xl bg-[#00305E] text-white font-bold"
                  onClick={() => {
                    setDone(false)
                    setIndex(0)
                    setLives(3)
                    setScore(0)
                  }}
                >
                  Chơi lại
                </button>
                <button 
                  className="px-6 py-2.5 rounded-xl border-2 border-[#00305E] text-[#00305E] font-bold" 
                  onClick={() => router.push('/dashboard')}
                >
                  Về dashboard
                </button>
              </div>
            </div>
          ) : !q ? (
            <div className="bg-white border-2 border-[#E2E8F0] rounded-2xl p-8 text-center shadow-lg df-glass-subtle">
              <h2 className="text-xl font-bold text-[#00305E] mb-2">Không có dữ liệu game</h2>
              <p className="text-slate-600 mb-6">Không có câu hỏi cho chế độ luyện tập hiện tại.</p>
              <button 
                className="px-6 py-2.5 rounded-xl border-2 border-[#00305E] text-[#00305E] font-bold" 
                onClick={() => router.push('/dashboard')}
              >
                Về dashboard
              </button>
            </div>
          ) : (
            <div className="flex flex-col flex-1">
              <div className="flex items-center justify-between mb-6">
                <div className="flex-1 max-w-md">
                  <div className="flex gap-1 mb-2">
                    {questions.map((_, i) => (
                      <div key={i} className="flex-1 h-2 rounded-full" style={{ background: i < index ? '#FFCE00' : i === index ? '#00305E' : '#E2E8F0' }} />
                    ))}
                  </div>
                  <p className="text-xs text-[#64748B]">Frage {index + 1}/{questions.length} · {progress}%</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-[#FFF8E1] border border-[#FFCE00]/40">
                    <Star size={14} className="text-[#FFCE00]" fill="#FFCE00" />
                    <span className="font-bold text-[#00305E] text-sm">{score}</span>
                  </div>
                  <div className="flex gap-1">{[0, 1, 2].map((i) => <Heart key={i} size={20} className={i < lives ? 'text-red-500' : 'text-[#E2E8F0]'} fill={i < lives ? '#EF4444' : '#E2E8F0'} />)}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#EEF4FF] text-[#00305E] border border-[#00305E]/15">
                  {variant.emoji} {variant.title}
                </span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#FFCE00]/20 text-[#00305E]">{q.level}</span>
              </div>

              <h2 className="text-3xl font-bold text-[#00305E] mb-1">Baue den deutschen Satz! 🧱</h2>
              <p className="text-xl text-[#64748B] mb-4">{variant.subtitle}</p>
              <p className="text-lg text-slate-700 mb-8 p-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm df-glass-subtle">
                {q.prompt}
              </p>

              <div className="bg-white rounded-3xl p-8 mb-8 border-2 border-[#E2E8F0] shadow-md df-glass-subtle">
                <div className="flex flex-wrap items-center gap-2 mb-6">
                  {q.audioGerman ? (
                    <button
                      className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl text-[#00305E] bg-[#EEF4FF] hover:bg-[#D0E0FF] transition-colors"
                      onClick={() => speakGerman(q.audioGerman || '')}
                    >
                      <Volume2 size={16} /> Nghe mẫu
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-y-4 min-h-[100px]">
                  {Array.from({ length: tokenizeForSlots(q.answerCanonical, q.joiner).length }).map((_, i) => (
                    <Slot
                      key={i}
                      id={`slot-${i}`}
                      filledItem={slotWordIds[i] ? wordById.get(String(slotWordIds[i])) ?? null : null}
                      onClear={() => clearSlot(i)}
                    />
                  ))}
                </div>
              </div>

              <div className="bg-[#F1F4F9] rounded-2xl p-6 mb-8 border-2 border-[#E2E8F0]">
                <p className="text-xs font-bold text-[#94A3B8] mb-4 uppercase tracking-widest">{variant.poolLabel}</p>
                <div className="flex flex-wrap gap-3">
                  {q.pool.map((item) => <DraggableWord key={item.id} item={item} used={usedIds.has(item.id)} />)}
                </div>
              </div>

              <div className="flex items-center justify-between mt-auto pt-6 border-t border-[#E2E8F0]">
                <div className="relative">
                  {showHint && (
                    <div className="absolute bottom-full mb-4 left-0 rounded-2xl p-4 w-64 bg-[#00305E] text-white text-sm shadow-2xl z-50">
                      <div className="flex items-start gap-3">
                        <Lightbulb className="flex-shrink-0 text-[#FFCE00]" size={20} />
                        <p>{variant.hint}</p>
                      </div>
                      <div className="absolute top-full left-6 w-4 h-4 bg-[#00305E] rotate-45 -translate-y-2" />
                    </div>
                  )}
                  <button 
                    onClick={() => setShowHint((v) => !v)} 
                    className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-[#64748B] bg-white border-2 border-[#E2E8F0] hover:bg-slate-50 transition-colors"
                  >
                    <Lightbulb size={18} /> Gợi ý
                  </button>
                </div>

                {checked === 'idle' ? (
                  <button
                    onClick={checkAnswer}
                    disabled={!allFilled}
                    className="px-10 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 transition-all"
                    style={{
                      background: allFilled ? '#00305E' : '#E2E8F0',
                      color: allFilled ? 'white' : '#94A3B8',
                      boxShadow: allFilled ? '0 5px 0 0 #002447, 0 8px 20px rgba(0,48,94,0.25)' : 'none',
                    }}
                  >
                    <Check size={20} strokeWidth={3} /> Kiểm tra
                  </button>
                ) : (
                  <button
                    onClick={next}
                    className="px-10 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 text-white transition-all"
                    style={{
                      background: checked === 'correct' ? '#10B981' : '#00305E',
                      boxShadow: checked === 'correct' ? '0 5px 0 0 #059669, 0 8px 20px rgba(16,185,129,0.3)' : '0 5px 0 0 #002447, 0 8px 20px rgba(0,48,94,0.25)',
                    }}
                  >
                    {index + 1 >= questions.length ? 'Hoàn thành' : 'Tiếp theo'} <ArrowRight size={20} />
                  </button>
                )}
              </div>

              {checked !== 'idle' && (
                <div className={`mt-6 rounded-2xl p-5 border-2 animate-in slide-in-from-bottom-2 duration-300 ${checked === 'correct' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${checked === 'correct' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                      {checked === 'correct' ? <Check size={18} strokeWidth={3} /> : <X size={18} strokeWidth={3} />}
                    </div>
                    <p className="font-black text-lg">{checked === 'correct' ? 'Chính xác! 🎉' : 'Chưa đúng rồi…'}</p>
                  </div>
                  <p className="text-base mb-3 pl-11">{checked === 'correct' ? 'Tuyệt vời, bạn đã ghép đúng cấu trúc câu.' : 'Hãy xem lại trật tự từ hoặc chia động từ.'}</p>
                  
                  {checked === 'wrong' && validatorErrors.length > 0 && (
                    <div className="pl-11">
                      <div className="bg-white/50 rounded-xl p-3 border border-red-200">
                        <p className="text-xs font-bold uppercase tracking-wider mb-2 text-red-900/60">Ghi chú ngữ pháp:</p>
                        <ul className="space-y-1.5">
                          {validatorErrors.map((msg, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                              {msg}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <button
                        onClick={resetQuestion}
                        className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border-2 border-red-200 text-red-700 font-bold hover:bg-red-50 transition-colors"
                      >
                        <X size={16} /> Thử lại câu này
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DndContext>
      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
        {activeWord ? <WordBlock item={activeWord} floating /> : null}
      </DragOverlay>
    </StudentShell>
  )
}
