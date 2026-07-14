'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react'
import { ARTICLE_COLOR, type ArticleLower } from '@/lib/vocabWords'
import { GaBtn, GaCap, GaCard } from '@/components/ui-v2'

/**
 * ArticleQuiz — quiz mạo từ der/die/das (port của components/ArticleQuiz.tsx ở cây v1,
 * đổi vỏ sang Galerie + i18n; logic chấm/điểm/luồng giữ nguyên).
 *
 * ⚠️ Đây LÀ bài tập mạo từ — trục sư phạm chính của DeutschFlow.
 */

export type ArticleQuizWord = {
  id: number
  word: string
  article: ArticleLower
  meaning: string
}

const ARTICLES: ArticleLower[] = ['der', 'die', 'das']
type AnswerState = 'unanswered' | 'correct' | 'wrong'

export function ArticleQuiz({
  words,
  onComplete,
}: {
  words: ArticleQuizWord[]
  onComplete?: (score: number, total: number) => void
}) {
  const t = useTranslations('v2.student.articleQuiz')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [answerState, setAnswerState] = useState<AnswerState>('unanswered')
  const [chosenArticle, setChosenArticle] = useState<ArticleLower | null>(null)
  const [finished, setFinished] = useState(false)

  const current = words[currentIndex]

  const handleAnswer = useCallback(
    (article: ArticleLower) => {
      if (answerState !== 'unanswered' || !current) return
      setChosenArticle(article)
      const correct = article === current.article
      setAnswerState(correct ? 'correct' : 'wrong')
      if (correct) setScore((s) => s + 1)
    },
    [answerState, current],
  )

  const handleNext = useCallback(() => {
    if (currentIndex + 1 >= words.length) {
      setFinished(true)
      onComplete?.(score, words.length)
      return
    }
    setCurrentIndex((i) => i + 1)
    setAnswerState('unanswered')
    setChosenArticle(null)
  }, [currentIndex, words.length, score, onComplete])

  const handleRestart = useCallback(() => {
    setCurrentIndex(0)
    setScore(0)
    setAnswerState('unanswered')
    setChosenArticle(null)
    setFinished(false)
  }, [])

  if (words.length === 0) return null

  if (finished) {
    const pct = Math.round((score / words.length) * 100)
    return (
      <GaCard className="px-7 py-10 text-center">
        <p className="font-ga-display text-[44px] font-medium leading-none text-ga-ink">{pct}%</p>
        <p className="ga-ui mt-2 text-[14px] text-ga-muted">
          {t('scoreLine', { score, total: words.length })}
        </p>
        <p className="ga-ui mt-1 text-[12.5px] text-ga-subtle">
          {pct >= 80 ? t('excellent') : pct >= 60 ? t('good') : t('keepPracticing')}
        </p>
        <GaBtn variant="primary" className="mt-6" onClick={handleRestart}>
          <RefreshCw size={14} aria-hidden /> {t('again')}
        </GaBtn>
      </GaCard>
    )
  }

  return (
    <GaCard className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-ga-border px-5 py-3">
        <GaCap>{t('title')}</GaCap>
        <span className="ga-ui text-[12px] text-ga-subtle">
          {currentIndex + 1} / {words.length}
        </span>
      </div>

      <div className="px-6 py-9 text-center">
        <p className="ga-ui mb-2 text-[11px] font-semibold uppercase tracking-widest text-ga-subtle">
          {t('question')}
        </p>
        <p className="font-ga-display text-[36px] font-medium leading-tight text-ga-ink">{current.word}</p>
        <p className="ga-ui mt-2 text-[14px] text-ga-muted">{current.meaning}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 px-6 pb-6">
        {ARTICLES.map((art) => {
          const isChosen = chosenArticle === art
          const isCorrect = art === current.article
          const answered = answerState !== 'unanswered'
          const color = ARTICLE_COLOR[art]

          const borderColor = !answered
            ? 'var(--ga-line)'
            : isCorrect
              ? 'var(--ga-green)'
              : isChosen
                ? 'var(--ga-red)'
                : 'var(--ga-border)'
          const textColor = !answered
            ? color
            : isCorrect
              ? 'var(--ga-green)'
              : isChosen
                ? 'var(--ga-red)'
                : 'var(--ga-subtle)'

          return (
            <button
              key={art}
              type="button"
              onClick={() => handleAnswer(art)}
              disabled={answered}
              className="ga-ui rounded-ga border-2 py-3 text-[17px] font-bold transition-colors disabled:cursor-default"
              style={{
                borderColor,
                color: textColor,
                background: answered && isCorrect ? 'var(--ga-green-soft)' : undefined,
                opacity: answered && !isCorrect && !isChosen ? 0.55 : 1,
              }}
            >
              {art}
            </button>
          )
        })}
      </div>

      {answerState !== 'unanswered' && (
        <div
          className="flex items-center justify-between gap-3 border-t px-6 py-4"
          style={{
            borderTopColor: answerState === 'correct' ? 'var(--ga-green)' : 'var(--ga-red)',
            background: answerState === 'correct' ? 'var(--ga-green-soft)' : 'var(--ga-red-soft)',
          }}
        >
          <div className="flex min-w-0 items-center gap-2">
            {answerState === 'correct' ? (
              <>
                <CheckCircle2 size={18} style={{ color: 'var(--ga-green)' }} aria-hidden />
                <span className="ga-ui text-[13.5px] font-semibold" style={{ color: 'var(--ga-green)' }}>
                  {t('correct')}
                </span>
              </>
            ) : (
              <>
                <XCircle size={18} style={{ color: 'var(--ga-red)' }} aria-hidden />
                <span className="ga-ui truncate text-[13.5px] font-semibold" style={{ color: 'var(--ga-red)' }}>
                  {t('wrong')} —{' '}
                  <span style={{ color: ARTICLE_COLOR[current.article] }}>{current.article}</span> {current.word}
                </span>
              </>
            )}
          </div>
          <GaBtn variant="ink" size="sm" onClick={handleNext}>
            {currentIndex + 1 >= words.length ? t('finish') : t('next')}
          </GaBtn>
        </div>
      )}
    </GaCard>
  )
}
