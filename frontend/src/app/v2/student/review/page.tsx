'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Volume2, RotateCcw, Check } from 'lucide-react'
import { toast } from 'sonner'
import { reviewApi, type VocabReviewCard, type ErrorReviewTaskDto } from '@/lib/reviewApi'
import { getErrorSnippet } from '@/lib/errors/errorTaxonomy'
import { GaPageHdr, GaCard, GaCap, GaBtn, LoadingState, ErrorBanner, TkBadge } from '@/components/ui-v2'

// Reuse reviewApi 1:1: getDueVocab + gradeVocab (FSRS flashcards) + getTodayTasks + completeTask
// (grammar error tasks). SRS quality buttons map 0/2/4/5 → forgot/hard/good/easy.

const GRADES = [
  { q: 0, labelKey: 'forgot', color: 'var(--ga-red)' },
  { q: 2, labelKey: 'hard', color: 'var(--ga-orange)' },
  { q: 4, labelKey: 'good', color: 'var(--ga-blue)' },
  { q: 5, labelKey: 'easy', color: 'var(--ga-green)' },
] as const

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
  const t = useTranslations('v2.student.review')
  const locale = useLocale()
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
      .then(([c, res]) => {
        if (c.status === 'fulfilled') setCards(c.value)
        else setError(t('loadError'))
        if (res.status === 'fulfilled') setTasks(res.value.tasks ?? [])
      })
      .finally(() => setLoading(false))
  }, [t])
  useEffect(load, [load])

  const card = cards[idx] ?? null

  // Grammar error codes (e.g. "ARTICLE.GENDER_WRONG_DER_DIE_DAS") and task types
  // ("REWRITE") are internal taxonomy values — never show them raw to learners.
  // getErrorSnippet is the shared, backend-catalog-aligned label source used across
  // the app; taskType has no snippet, so fall back to a localized label (then the
  // humanized code) for any value not yet mapped rather than leaking it.
  const errorCodeLabel = (code: string): string => getErrorSnippet(code, locale).title
  const taskTypeLabel = (type: string): string => {
    const key = `taskTypes.${type.toUpperCase()}`
    return t.has(key) ? t(key) : type.replace(/_/g, ' ')
  }

  const grade = async (q: number) => {
    if (!card || grading) return
    setGrading(true)
    try {
      await reviewApi.gradeVocab(card.vocabId, q)
      setReviewed((n) => n + 1)
      setRevealed(false)
      setIdx((i) => i + 1)
    } catch {
      toast.error(t('gradeSaveError'))
    } finally {
      setGrading(false)
    }
  }

  const completeTask = async (task: ErrorReviewTaskDto) => {
    try {
      await reviewApi.completeTask(task.id, true)
      setTasks((prev) => prev.filter((x) => x.id !== task.id))
      toast.success(t('taskDone'))
    } catch {
      toast.error(t('taskSaveError'))
    }
  }

  const done = !loading && idx >= cards.length

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          cards.length > 0 ? (
            <span className="ga-ui text-[13px] font-semibold text-ga-muted">
              {t('cardsProgress', { current: Math.min(idx, cards.length), total: cards.length })}
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
          <LoadingState label={t('loading')} />
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
                    <Volume2 size={16} aria-hidden /> {t('listen')}
                  </button>

                  {revealed ? (
                    <div className="mt-6 border-t border-ga-border pt-6">
                      <p className="text-[20px] font-semibold text-ga-ink">{card.meaning}</p>
                      {card.exampleDe && <p className="ga-ui mt-3 text-[14.5px] italic text-ga-muted">“{card.exampleDe}”</p>}
                    </div>
                  ) : (
                    <GaBtn variant="primary" className="mt-7" onClick={() => setRevealed(true)}>
                      {t('reveal')}
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
                        {t(`grades.${g.labelKey}`)}
                      </button>
                    ))}
                  </div>
                )}
              </GaCard>
            ) : (
              <GaCard className="px-7 py-14 text-center">
                <p className="text-[40px]">🎉</p>
                <p className="mt-3 font-ga-display text-[22px] font-medium text-ga-ink">
                  {cards.length === 0 ? t('emptyQueue') : t('doneCount', { count: reviewed })}
                </p>
                <p className="ga-ui mt-2 text-[14px] text-ga-muted">{t('comeBackLater')}</p>
                {cards.length > 0 && (
                  <GaBtn variant="ghost" className="mt-5" onClick={load}>
                    <RotateCcw size={15} aria-hidden /> {t('reload')}
                  </GaBtn>
                )}
              </GaCard>
            )}

            {/* Grammar error tasks */}
            {tasks.length > 0 && (
              <div>
                <GaCap className="mb-3 block">{t('grammarTasksCap', { count: tasks.length })}</GaCap>
                <div className="border border-ga-line bg-ga-card">
                  {tasks.map((task, i) => (
                    <div key={task.id} className={`flex items-center gap-3 px-5 py-3.5 ${i ? 'border-t border-ga-border' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-ga-ink">{errorCodeLabel(task.errorCode)}</p>
                        <p className="ga-ui text-[12px] text-ga-muted">{t('taskCycle', { days: task.intervalDays })}</p>
                      </div>
                      <TkBadge tone="violet">{taskTypeLabel(task.taskType)}</TkBadge>
                      <button
                        type="button"
                        onClick={() => completeTask(task)}
                        className="ga-ui inline-flex items-center gap-1 rounded-ga border border-ga-line px-3 py-1.5 text-[12px] font-semibold text-ga-muted transition-colors hover:border-ga-green hover:text-ga-green"
                      >
                        <Check size={14} aria-hidden /> {t('taskDoneBtn')}
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
