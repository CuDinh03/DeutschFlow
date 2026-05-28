'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import api from '@/lib/api'
import { getAccessToken } from '@/lib/authSession'
import { StudentShell } from '@/components/layouts/StudentShell'
import ArticleQuiz from '../vocabulary/components/ArticleQuiz'
import type { VocabCardItem, WordListItem } from '../vocabulary/components/types'
import { mapWordListItemToCard } from '../vocabulary/components/types'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'

type Me = { displayName: string; role: string; locale: string }

export default function ArticleQuizPage() {
  usePageTimeTracker('article_quiz');
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [nounWords, setNounWords] = useState<VocabCardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [quizKey, setQuizKey] = useState(0)
  const [cefrFilter, setCefrFilter] = useState('A1')
  const [result, setResult] = useState<{ score: number; total: number } | null>(null)

  useEffect(() => {
    if (!getAccessToken()) { router.push('/login'); return }
    ;(async () => {
      try {
        const meRes = await api.get<Me>('/auth/me')
        setMe(meRes.data)
        const { data } = await api.get('/words', {
          params: { cefr: cefrFilter, dtype: 'NOUN', size: 20, locale: meRes.data.locale || 'vi' }
        })
        const nouns = (data.items ?? [])
          .filter((it: WordListItem) => it.gender)
          .map((it: WordListItem) => mapWordListItemToCard({ ...it, category: 'Alltag' }))
        setNounWords(nouns)
      } finally {
        setLoading(false)
      }
    })()
  }, [router, cefrFilter])

  const handleComplete = useCallback((score: number, total: number) => {
    setResult({ score, total })
  }, [])

  const handleRestart = useCallback(() => {
    setResult(null)
    setQuizKey((k) => k + 1)
  }, [])

  if (!me) return <div className="min-h-screen flex items-center justify-center"><p className="text-slate-400">Loading…</p></div>

  const targetLevel = cefrFilter

  return (
    <StudentShell
      activeSection="vocabulary"
      user={{ displayName: me.displayName, role: me.role }}
      targetLevel={targetLevel}
      streakDays={0}
      initials={me.displayName.split(' ').map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase()}
      onLogout={() => router.push('/')}
      headerTitle="Artikel Quiz"
      headerSubtitle="Welcher Artikel gehört zum Nomen?"
    >
      <div className="max-w-lg mx-auto py-6 px-4 space-y-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
            <ArrowLeft size={16} className="text-slate-600" />
          </button>
          <div className="flex gap-1.5">
            {['A1', 'A2', 'B1', 'B2'].map((lvl) => (
              <button key={lvl} type="button"
                onClick={() => { setCefrFilter(lvl); setQuizKey((k) => k + 1); setResult(null) }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${cefrFilter === lvl ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center">
            <p className="text-slate-400 text-sm">Wörter laden…</p>
          </div>
        ) : nounWords.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center">
            <p className="text-slate-500 text-sm">Keine Nomen für dieses Niveau gefunden.</p>
          </div>
        ) : (
          <ArticleQuiz
            key={quizKey}
            words={nounWords}
            onComplete={handleComplete}
          />
        )}

        {result ? (
          <div className="text-center space-y-2">
            <p className="text-sm text-slate-500">Ergebnis: {result.score}/{result.total}</p>
            <button type="button" onClick={handleRestart}
              className="text-xs text-indigo-600 hover:underline">
              Neues Quiz starten
            </button>
          </div>
        ) : null}
      </div>
    </StudentShell>
  )
}
