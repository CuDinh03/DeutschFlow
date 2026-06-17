'use client'

import { useCallback, useEffect, useState } from 'react'
import { Volume2, RotateCcw, Check } from 'lucide-react'
import { toast } from 'sonner'
import { reviewApi, type VocabReviewCard, type ErrorReviewTaskDto } from '@/lib/reviewApi'
import { GaPageHdr, GaCard, GaCap, GaBtn, LoadingState, ErrorBanner, TkBadge } from '@/components/ui-v2'

// Reuse reviewApi 1:1: getDueVocab + gradeVocab (FSRS flashcards) + getTodayTasks + completeTask
// (grammar error tasks). SRS quality buttons map 0/2/4/5 → forgot/hard/good/easy.

const GRADES = [
  { q: 0, label: 'Quên', color: 'var(--ga-red)' },
  { q: 2, label: 'Khó', color: 'var(--ga-orange)' },
  { q: 4, label: 'Tốt', color: 'var(--ga-blue)' },
  { q: 5, label: 'Dễ', color: 'var(--ga-green)' },
]

const ARTICLE_COLOR: Record<string, string> = { der: '#2F6FC9', die: '#DA291C', das: '#1E9E61' }
function articleOf(german: string): string | null {
  const first = german.trim().split(/\s+/)[0]?.toLowerCase()
  return first && ARTICLE_COLOR[first] ? first : null
}

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'de-DE'
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

export default function V2StudentReviewPage() {
  const [cards, setCards] = useState<VocabReviewCard[]>([])
  const [tasks, setTasks] = useState<ErrorReviewTaskDto[]>([])
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [grading, setGrading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    setIdx(0)
    setRevealed(false)
    setReviewed(0)
    Promise.allSettled([reviewApi.getDueVocab(), reviewApi.getTodayTasks()])
      .then(([c, t]) => {
        if (c.status === 'fulfilled') setCards(c.value)
        else setError('Không thể tải hàng đợi ôn tập.')
        if (t.status === 'fulfilled') setTasks(t.value.tasks ?? [])
      })
      .finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  const card = cards[idx] ?? null

  const grade = async (q: number) => {
    if (!card || grading) return
    setGrading(true)
    try {
      await reviewApi.gradeVocab(card.vocabId, q)
      setReviewed((n) => n + 1)
      setRevealed(false)
      setIdx((i) => i + 1)
    } catch {
      toast.error('Không lưu được kết quả, thử lại.')
    } finally {
      setGrading(false)
    }
  }

  const completeTask = async (t: ErrorReviewTaskDto) => {
    try {
      await reviewApi.completeTask(t.id, true)
      setTasks((prev) => prev.filter((x) => x.id !== t.id))
      toast.success('Đã hoàn thành nhiệm vụ.')
    } catch {
      toast.error('Không lưu được, thử lại.')
    }
  }

  const done = !loading && idx >= cards.length

  return (
    <div className="flex min-h-screen flex-col">
      <GaPageHdr
        accent
        title="Ôn tập (SRS)"
        subtitle="Lặp lại ngắt quãng giúp ghi nhớ lâu dài"
        right={
          cards.length > 0 ? (
            <span className="ga-ui text-[13px] font-semibold text-ga-muted">
              {Math.min(idx, cards.length)}/{cards.length} thẻ
            </span>
          ) : null
        }
      />
      <div className="flex-1 px-10 py-6">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        )}
        {loading ? (
          <LoadingState label="Đang tải hàng đợi…" />
        ) : (
          <div className="mx-auto max-w-2xl space-y-[22px]">
            {/* Flashcard */}
            {!done && card ? (
              <GaCard className="overflow-hidden">
                {/* progress bar */}
                <div className="h-1 bg-ga-border">
                  <div className="h-full bg-ga-accent transition-[width]" style={{ width: `${(idx / cards.length) * 100}%` }} />
                </div>
                <div className="px-7 py-10 text-center">
                  {(() => {
                    const art = articleOf(card.german)
                    return (
                      <p
                        className="font-ga-display text-[40px] font-medium leading-tight"
                        style={{ color: art ? ARTICLE_COLOR[art] : 'var(--ga-ink)' }}
                      >
                        {card.german}
                      </p>
                    )
                  })()}
                  <button
                    type="button"
                    onClick={() => speak(card.speakDe || card.german)}
                    className="ga-ui mt-3 inline-flex items-center gap-1.5 text-[13px] text-ga-muted hover:text-ga-accent"
                  >
                    <Volume2 size={16} aria-hidden /> Nghe phát âm
                  </button>

                  {revealed ? (
                    <div className="mt-6 border-t border-ga-border pt-6">
                      <p className="text-[20px] font-semibold text-ga-ink">{card.meaning}</p>
                      {card.exampleDe && <p className="ga-ui mt-3 text-[14.5px] italic text-ga-muted">“{card.exampleDe}”</p>}
                    </div>
                  ) : (
                    <GaBtn variant="primary" className="mt-7" onClick={() => setRevealed(true)}>
                      Hiện nghĩa
                    </GaBtn>
                  )}
                </div>

                {revealed && (
                  <div className="grid grid-cols-4 border-t border-ga-border">
                    {GRADES.map((g) => (
                      <button
                        key={g.q}
                        type="button"
                        disabled={grading}
                        onClick={() => grade(g.q)}
                        className="ga-ui border-l border-ga-border py-4 text-[13.5px] font-semibold transition-colors first:border-l-0 hover:bg-ga-surface disabled:opacity-50"
                        style={{ color: g.color }}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                )}
              </GaCard>
            ) : (
              <GaCard className="px-7 py-14 text-center">
                <p className="text-[40px]">🎉</p>
                <p className="mt-3 font-ga-display text-[22px] font-medium text-ga-ink">
                  {cards.length === 0 ? 'Không có thẻ nào cần ôn' : `Đã ôn xong ${reviewed} thẻ!`}
                </p>
                <p className="ga-ui mt-2 text-[14px] text-ga-muted">Quay lại sau để ôn các thẻ tới hạn tiếp theo.</p>
                {cards.length > 0 && (
                  <GaBtn variant="ghost" className="mt-5" onClick={load}>
                    <RotateCcw size={15} aria-hidden /> Tải lại
                  </GaBtn>
                )}
              </GaCard>
            )}

            {/* Grammar error tasks */}
            {tasks.length > 0 && (
              <div>
                <GaCap className="mb-3 block">Nhiệm vụ ngữ pháp hôm nay ({tasks.length})</GaCap>
                <div className="border border-ga-line bg-ga-card">
                  {tasks.map((t, i) => (
                    <div key={t.id} className={`flex items-center gap-3 px-5 py-3.5 ${i ? 'border-t border-ga-border' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-ga-ink">{t.errorCode.replace(/_/g, ' ')}</p>
                        <p className="ga-ui text-[12px] text-ga-muted">Chu kỳ {t.intervalDays} ngày</p>
                      </div>
                      <TkBadge tone="violet">{t.taskType}</TkBadge>
                      <button
                        type="button"
                        onClick={() => completeTask(t)}
                        className="ga-ui inline-flex items-center gap-1 rounded-ga border border-ga-line px-3 py-1.5 text-[12px] font-semibold text-ga-muted transition-colors hover:border-ga-green hover:text-ga-green"
                      >
                        <Check size={14} aria-hidden /> Xong
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
