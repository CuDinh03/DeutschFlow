'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ArrowRight, Check, ChevronLeft, Heart, Lightbulb, Loader2, Star, Volume2, X } from 'lucide-react'
import api from '@/lib/api'
import { speakGerman } from '@/lib/speechDe'
import {
  buildStandaloneQuestions,
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

  const [index, setIndex] = useState(0)
  const sessionType = 'GENERAL'
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      router.push('/login')
      return
    }

    // Thử fetch câu hỏi từ vocabulary DB thực, fallback về hardcoded
    fetchVocabGameQuestions(
      (path, params) => api.get(path, { params }).then(r => r.data),
      12
    ).then((mapped) => {
      setQuestions(mapped)
      if (mapped.length > 0) {
        const slotCount = tokenizeForSlots(mapped[0]!.answerCanonical, mapped[0]!.joiner).length
        setSlots(new Array(slotCount).fill(null))
        setSlotWordIds(new Array(slotCount).fill(null))
      }
      setLoading(false)
    })
  }, [router])

  useEffect(() => {
    if (!q) return
    const slotCount = tokenizeForSlots(q.answerCanonical, q.joiner).length
    setSlots(new Array(slotCount).fill(null))
    setSlotWordIds(new Array(slotCount).fill(null))
    setChecked('idle')
    setShowHint(false)
    setValidatorErrors([])
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
        setValidatorErrors(messages.length > 0 ? messages : ['Câu chưa đúng theo rule ngữ pháp A1-A2.'])
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFF] flex items-center justify-center">
        <div className="flex items-center gap-2 text-[#00305E]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading game...</span>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#F8FAFF] flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-white border-2 border-[#E2E8F0] rounded-2xl p-6 text-center shadow-lg">
          <h2 className="text-2xl font-bold text-[#00305E] mb-2">Hoàn thành {variant.title}</h2>
          <p className="text-slate-600 mb-1">Điểm của bạn: <b>{score}</b></p>
          <p className="text-slate-600 mb-5">Bạn đã hoàn thành chế độ chơi độc lập.</p>
          <div className="flex gap-2 justify-center">
            <button
              className="btn-primary btn-md"
              onClick={() => {
                setDone(false)
                setIndex(0)
                setLives(3)
                setScore(0)
              }}
            >
              Chơi lại
            </button>
            <button className="btn-outline btn-md" onClick={() => router.push('/student')}>
              Về dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!q) {
    return (
      <div className="min-h-screen bg-[#F8FAFF] flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white border-2 border-[#E2E8F0] rounded-2xl p-6 text-center shadow-lg">
          <h2 className="text-xl font-bold text-[#00305E] mb-2">Không có dữ liệu game</h2>
          <p className="text-slate-600 mb-4">Không có câu hỏi cho chế độ luyện tập hiện tại.</p>
          <button className="btn-outline btn-md" onClick={() => router.push('/student')}>
            Về dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <DndContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div
        className="min-h-screen flex flex-col"
        style={{
          background: '#F8FAFF',
          backgroundImage: 'radial-gradient(circle, rgba(0,48,94,0.045) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      >
        <header className="bg-white/90 backdrop-blur border-b border-[#E2E8F0] px-5 py-4 flex items-center gap-4 flex-shrink-0">
          <button onClick={() => router.push('/student')} className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[#64748B] hover:bg-[#F5F7FA]">
            <ChevronLeft size={16} /> Verlassen
          </button>
          <div className="flex-1">
            <div className="flex gap-1.5 mb-1.5">
              {questions.map((_, i) => (
                <div key={i} className="flex-1 h-2.5 rounded-full" style={{ background: i < index ? '#FFCE00' : i === index ? 'linear-gradient(90deg, #FFCE00 0%, #E2E8F0 100%)' : '#E2E8F0' }} />
              ))}
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#94A3B8]">Frage {index + 1}/{questions.length}</span>
              <span className="text-[#00305E] font-semibold">{progress}%</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-[#FFF8E1] border border-[#FFCE00]/40">
            <Star size={14} className="text-[#FFCE00]" fill="#FFCE00" />
            <span className="font-bold text-[#00305E] text-sm">{score}</span>
          </div>
          <div className="flex gap-1">{[0, 1, 2].map((i) => <Heart key={i} size={18} className={i < lives ? 'text-red-500' : 'text-[#E2E8F0]'} fill={i < lives ? '#EF4444' : '#E2E8F0'} />)}</div>
        </header>

        <div className="page-container max-w-5xl px-4 sm:px-6 py-6 flex-1">
          <div className="flex items-center gap-2 mb-5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#EEF4FF] text-[#00305E] border border-[#00305E]/15">
              {variant.emoji} {variant.title}
            </span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#FFCE00]/20 text-[#00305E]">{q.level}</span>
          </div>

          <h2 className="text-[40px] leading-tight font-bold text-[#00305E] mb-2">Baue den deutschen Satz! 🧱</h2>
          <p className="text-[30px] text-[#64748B] mb-2">{variant.subtitle}</p>
          <p className="text-base text-slate-600 mb-6 whitespace-pre-wrap">{q.prompt}</p>

          <div className="section-card rounded-[20px] p-6 sm:p-8 mb-5 border-2 border-[#E2E8F0] shadow-[0_4px_24px_rgba(0,48,94,0.08)]">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {q.audioGerman ? (
                <button
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[8px] text-[#64748B] bg-[#F5F7FA] border border-[#E2E8F0]"
                  onClick={() => speakGerman(q.audioGerman || '')}
                >
                  <Volume2 size={13} /> Anhören
                </button>
              ) : null}
            </div>
            <p className="text-[52px] leading-[1.5] text-[#1A1A1A] flex flex-wrap items-center">
              {Array.from({ length: tokenizeForSlots(q.answerCanonical, q.joiner).length }).map((_, i) => (
                <Slot
                  key={i}
                  id={`slot-${i}`}
                  filledItem={slotWordIds[i] ? wordById.get(String(slotWordIds[i])) ?? null : null}
                  onClear={() => clearSlot(i)}
                />
              ))}
            </p>
          </div>

          <div className="section-card rounded-[20px] p-5 mb-6 bg-[#F1F4F9] border-2 border-[#E2E8F0]">
            <p className="text-xs font-semibold text-[#94A3B8] mb-3 uppercase tracking-wider">{variant.poolLabel}</p>
            <div className="flex flex-wrap gap-3">
              {q.pool.map((item) => <DraggableWord key={item.id} item={item} used={usedIds.has(item.id)} />)}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="relative">
              {showHint ? (
                <div className="absolute bottom-full mb-3 left-0 rounded-[16px] p-4 max-w-xs bg-[#00305E] text-white text-sm shadow-xl">
                  {variant.hint}
                </div>
              ) : null}
              <button onClick={() => setShowHint((v) => !v)} className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] font-semibold text-sm bg-white text-[#64748B] border-2 border-[#E2E8F0]">
                <Lightbulb size={15} /> Hinweis
              </button>
            </div>

            {checked === 'idle' ? (
              <button
                onClick={checkAnswer}
                disabled={!allFilled}
                className="px-8 py-3.5 rounded-[14px] font-bold text-base flex items-center gap-2 transition-all"
                style={{
                  background: allFilled ? '#00305E' : '#E2E8F0',
                  color: allFilled ? 'white' : '#94A3B8',
                  boxShadow: allFilled ? '0 5px 0 0 #002447, 0 8px 20px rgba(0,48,94,0.25)' : '0 3px 0 0 #CBD5E1',
                }}
              >
                <Check size={17} strokeWidth={3} /> Prüfen
              </button>
            ) : (
              <button
                onClick={next}
                className="px-8 py-3.5 rounded-[14px] font-bold text-base flex items-center gap-2 text-white"
                style={{
                  background: checked === 'correct' ? '#10B981' : '#00305E',
                  boxShadow: checked === 'correct' ? '0 5px 0 0 #059669, 0 8px 20px rgba(16,185,129,0.3)' : '0 5px 0 0 #002447, 0 8px 20px rgba(0,48,94,0.25)',
                }}
              >
                {index + 1 >= questions.length ? 'Abschließen' : 'Weiter'} <ArrowRight size={16} />
              </button>
            )}
          </div>

          {checked !== 'idle' ? (
            <div className={`mt-5 rounded-[16px] p-4 border-2 ${checked === 'correct' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
              <p className="font-bold mb-1">{checked === 'correct' ? 'Richtig! 🎉' : 'Nicht ganz…'}</p>
              <p className="text-sm">{checked === 'correct' ? 'Đúng đáp án cho bài này.' : 'Sai rồi, hãy kéo-thả lại theo rule ngữ pháp.'}</p>
              {checked === 'wrong' && validatorErrors.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs">
                  {validatorErrors.map((msg, i) => (
                    <li key={`${msg}-${i}`}>- {msg}</li>
                  ))}
                </ul>
              ) : null}
              {checked === 'wrong' ? (
                <button
                  onClick={resetQuestion}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-red-200 text-red-700 text-sm"
                >
                  <X size={14} /> Neu versuchen
                </button>
              ) : null}
            </div>
          ) : null}

          {activeId ? <p className="text-xs text-slate-400 mt-3">Dragging: {activeId}</p> : null}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
        {activeWord ? <WordBlock item={activeWord} floating /> : null}
      </DragOverlay>
    </DndContext>
  )
}

