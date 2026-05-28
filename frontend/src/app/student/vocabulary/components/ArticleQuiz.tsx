'use client'

import { useState, useCallback } from 'react'
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import { GENDER_STYLE, type ArticleLower, type GenderCode } from './types'

type QuizWord = {
  id: number
  word: string
  article: ArticleLower
  gender: GenderCode
  meaning: string
}

type ArticleQuizProps = {
  words: QuizWord[]
  onComplete?: (score: number, total: number) => void
}

const ARTICLES: ArticleLower[] = ['der', 'die', 'das']

type AnswerState = 'unanswered' | 'correct' | 'wrong'

export default function ArticleQuiz({ words, onComplete }: ArticleQuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [answerState, setAnswerState] = useState<AnswerState>('unanswered')
  const [chosenArticle, setChosenArticle] = useState<ArticleLower | null>(null)
  const [finished, setFinished] = useState(false)

  const current = words[currentIndex]

  const handleAnswer = useCallback((article: ArticleLower) => {
    if (answerState !== 'unanswered') return
    setChosenArticle(article)
    const correct = article === current.article
    setAnswerState(correct ? 'correct' : 'wrong')
    if (correct) setScore((s) => s + 1)
  }, [answerState, current])

  const handleNext = useCallback(() => {
    if (currentIndex + 1 >= words.length) {
      setFinished(true)
      onComplete?.(score + (answerState === 'correct' ? 0 : 0), words.length)
    } else {
      setCurrentIndex((i) => i + 1)
      setAnswerState('unanswered')
      setChosenArticle(null)
    }
  }, [currentIndex, words.length, score, answerState, onComplete])

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
      <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center shadow-sm">
        <div className="text-5xl font-extrabold text-slate-900 mb-1">{pct}%</div>
        <p className="text-slate-500 text-sm mb-1">{score} / {words.length} correct</p>
        <p className="text-slate-400 text-xs mb-6">{pct >= 80 ? 'Ausgezeichnet!' : pct >= 60 ? 'Gut gemacht!' : 'Weiter üben!'}</p>
        <button type="button" onClick={handleRestart} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-700 transition-colors">
          <RefreshCw size={14} /> Quiz wiederholen
        </button>
      </div>
    )
  }

  const genderStyle = GENDER_STYLE[current.gender] ?? GENDER_STYLE.DER

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Artikel Quiz</span>
        <span className="text-xs text-slate-400">{currentIndex + 1} / {words.length}</span>
      </div>

      <div className="px-6 py-8 text-center">
        <p className="text-[11px] uppercase tracking-widest text-slate-400 mb-2">Welcher Artikel?</p>
        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">{current.word}</h2>
        <p className="mt-2 text-sm text-slate-500">{current.meaning}</p>
      </div>

      <div className="px-6 pb-6 grid grid-cols-3 gap-3">
        {ARTICLES.map((art) => {
          const isChosen = chosenArticle === art
          const isCorrect = art === current.article
          let className = 'py-3 rounded-xl text-sm font-bold border-2 transition-all duration-150 '

          if (answerState === 'unanswered') {
            className += 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 cursor-pointer'
          } else if (isCorrect) {
            className += 'border-emerald-400 bg-emerald-50 text-emerald-700'
          } else if (isChosen && !isCorrect) {
            className += 'border-red-400 bg-red-50 text-red-600'
          } else {
            className += 'border-slate-100 bg-slate-50 text-slate-400 opacity-60'
          }

          return (
            <button key={art} type="button" className={className}
              onClick={() => handleAnswer(art)}
              style={answerState === 'unanswered' ? { borderColor: undefined } : isCorrect ? {} : {}}>
              <span className="text-lg">{art}</span>
            </button>
          )
        })}
      </div>

      {answerState !== 'unanswered' ? (
        <div className={`px-6 py-4 border-t flex items-center justify-between ${answerState === 'correct' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
          <div className="flex items-center gap-2">
            {answerState === 'correct'
              ? <><CheckCircle2 size={18} className="text-emerald-500" /><span className="text-sm font-semibold text-emerald-700">Richtig!</span></>
              : <><XCircle size={18} className="text-red-500" /><span className="text-sm font-semibold text-red-700">Falsch — <span style={{ color: genderStyle.text }}>{current.article}</span> {current.word}</span></>}
          </div>
          <button type="button" onClick={handleNext}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-700 transition-colors">
            {currentIndex + 1 >= words.length ? 'Fertig' : 'Weiter →'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
