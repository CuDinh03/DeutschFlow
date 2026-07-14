'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'
import api from '@/lib/api'
import { articleOf, type WordListResponse } from '@/lib/vocabWords'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'
import { GaCap, GaCard, GaPageHdr, ErrorBanner, LoadingState, TkSeg } from '@/components/ui-v2'
import { ArticleQuiz, type ArticleQuizWord } from './ArticleQuiz'

/**
 * /v2/student/vocabulary/article-quiz — quiz mạo từ der/die/das (port của /student/article-quiz).
 *
 * Giữ nguyên: GET /words?cefr=<A1|A2|B1|B2>&dtype=NOUN&size=20&locale · chỉ lấy danh từ CÓ giống ·
 * PostHog page-time 'article_quiz'. Trang v1 không nhận query param nào → v2 cũng vậy (đổi mức
 * ngay trên trang), nên không cần <Suspense>.
 */

const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const
type Level = (typeof LEVELS)[number]

export default function V2StudentArticleQuizPage() {
  usePageTimeTracker('article_quiz')
  const router = useRouter()
  const t = useTranslations('v2.student.articleQuiz')
  const locale = useLocale()
  const { me, loading: sessionLoading } = useStudentPracticeSession()

  const [words, setWords] = useState<ArticleQuizWord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cefr, setCefr] = useState<Level>('A1')
  const [quizKey, setQuizKey] = useState(0)
  const [result, setResult] = useState<{ score: number; total: number } | null>(null)

  const apiLocale = useMemo(() => me?.locale || locale || 'vi', [me?.locale, locale])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<WordListResponse>('/words', {
        params: { cefr, dtype: 'NOUN', size: 20, locale: apiLocale },
      })
      // Chỉ giữ danh từ CÓ giống — quiz mạo từ vô nghĩa nếu thiếu der/die/das.
      const nouns = (data.items ?? []).flatMap((it) => {
        const art = articleOf(it)
        if (!art) return []
        return [{ id: it.id, word: it.baseForm, article: art, meaning: it.meaning ?? '' }]
      })
      setWords(nouns)
    } catch {
      setError(t('loadError'))
      setWords([])
    } finally {
      setLoading(false)
    }
  }, [cefr, apiLocale, t])

  useEffect(() => {
    if (me) void load()
  }, [me, load])

  const handleComplete = useCallback((score: number, total: number) => setResult({ score, total }), [])

  if (sessionLoading || !me) return <LoadingState label={t('loading')} />

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 px-10 py-6">
        <div className="mx-auto max-w-lg space-y-[22px]">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.push('/v2/student/vocabulary')}
              className="grid h-9 w-9 place-items-center rounded-ga border border-ga-line bg-ga-card text-ga-muted transition-colors hover:bg-ga-surface"
              aria-label={t('back')}
            >
              <ArrowLeft size={16} aria-hidden />
            </button>
            <TkSeg
              aria-label={t('levelLabel')}
              options={LEVELS.map((l) => ({ value: l, label: l }))}
              value={cefr}
              onValueChange={(v) => {
                setCefr(v)
                setQuizKey((k) => k + 1)
                setResult(null)
              }}
            />
          </div>

          {error && <ErrorBanner message={error} onRetry={load} />}

          {loading ? (
            <LoadingState label={t('loadingWords')} />
          ) : words.length === 0 ? (
            <GaCard className="px-7 py-14 text-center">
              <p className="font-ga-display text-[20px] font-medium text-ga-ink">{t('emptyTitle')}</p>
              <p className="ga-ui mt-2 text-[13px] text-ga-muted">{t('emptyDesc', { level: cefr })}</p>
            </GaCard>
          ) : (
            <ArticleQuiz key={quizKey} words={words} onComplete={handleComplete} />
          )}

          {result && (
            <GaCap className="block text-center">
              {t('lastResult', { score: result.score, total: result.total })}
            </GaCap>
          )}
        </div>
      </div>
    </div>
  )
}
