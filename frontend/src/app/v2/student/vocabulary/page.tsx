'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { BarChart3, HelpCircle, Layers, Mic, Volume2 } from 'lucide-react'
import api from '@/lib/api'
import { colorForArticle } from '@/lib/vocabWords'
import { GaPageHdr, TkSearch, GaCap, LoadingState, ErrorBanner } from '@/components/ui-v2'

// Reuse GET /words (the vocabulary store). Tolerant field-picking (shape varies) + gender→color
// (der=blue / die=red / das=green, DeutschFlow's signature) + search + speak.
// Trang này là TRA CỨU; 4 bài luyện thật nằm ở các route con (practice · swipe · article-quiz ·
// analytics) và được vào từ dải "Luyện tập" bên dưới header.

interface Word {
  id: string
  german: string
  meaning: string
  article: string | null
  example: string | null
  level: string | null
}

/** Dải lối vào các bài luyện — cùng thứ tự với sư phạm: nói → thẻ → mạo từ → thống kê. */
const DRILLS = [
  { key: 'practice', href: '/v2/student/vocabulary/practice', Icon: Mic },
  { key: 'swipe', href: '/v2/student/vocabulary/swipe', Icon: Layers },
  { key: 'articleQuiz', href: '/v2/student/vocabulary/article-quiz', Icon: HelpCircle },
  { key: 'analytics', href: '/v2/student/vocabulary/analytics', Icon: BarChart3 },
] as const

function str(r: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}
function normalize(r: Record<string, unknown>, i: number): Word {
  const german = str(r, 'german', 'word', 'wordDe', 'lemma', 'text')
  let article = str(r, 'gender', 'artikel', 'article').toLowerCase() || null
  if (!article) {
    const first = german.split(/\s+/)[0]?.toLowerCase()
    if (first && colorForArticle(first)) article = first
  }
  // normalize gender codes (M/F/N) → articles
  if (article === 'm' || article === 'masculine') article = 'der'
  if (article === 'f' || article === 'feminine') article = 'die'
  if (article === 'n' || article === 'neuter') article = 'das'
  return {
    id: str(r, 'id', 'vocabId') || String(i),
    german,
    meaning: str(r, 'meaning', 'vietnamese', 'translation', 'meaningVi', 'vi'),
    article: article && colorForArticle(article) ? article : null,
    example: str(r, 'exampleDe', 'example', 'sampleSentence') || null,
    level: str(r, 'level', 'cefrLevel', 'cefr') || null,
  }
}

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'de-DE'
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

export default function V2StudentVocabularyPage() {
  const t = useTranslations('v2.student.vocabulary')
  const [words, setWords] = useState<Word[]>([])
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    api
      .get('/words')
      .then((res) => {
        const raw = (Array.isArray(res.data) ? res.data : (res.data?.content ?? [])) as Record<string, unknown>[]
        setWords(raw.map(normalize).filter((w) => w.german))
      })
      .catch(() => setError(t('loadError')))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const levels = useMemo(
    () => ['ALL', ...Array.from(new Set(words.map((w) => w.level).filter(Boolean) as string[])).sort()],
    [words],
  )
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return words.filter((w) => {
      const mq = !q || w.german.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)
      const ml = level === 'ALL' || w.level === level
      return mq && ml
    })
  }, [words, query, level])

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <TkSearch
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            containerClassName="w-[230px]"
          />
        }
      />
      <div className="flex-1 px-10 py-6">
        {/* Lối vào các bài luyện — trước đây chỉ có ở cây v1, /v2 không có đường nào bấm được. */}
        <div className="mb-6">
          <GaCap className="mb-3 block">{t('drills.cap')}</GaCap>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DRILLS.map(({ key, href, Icon }) => (
              <Link
                key={key}
                href={href}
                className="group flex items-start gap-3 border border-ga-line bg-ga-card p-4 transition-shadow hover:shadow-ga-card-hover"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-ga bg-ga-accent-soft text-ga-accent">
                  <Icon size={17} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-semibold text-ga-ink group-hover:text-ga-accent">
                    {t(`drills.${key}.title`)}
                  </span>
                  <span className="ga-ui mt-0.5 block text-[12.5px] leading-snug text-ga-muted">
                    {t(`drills.${key}.desc`)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        {levels.length > 1 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {levels.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLevel(l)}
                className={`ga-ui rounded-ga border px-[14px] py-2 text-[12.5px] font-semibold transition-colors ${
                  level === l
                    ? 'border-ga-ink bg-ga-ink text-ga-card'
                    : 'border-ga-border bg-ga-card text-ga-muted hover:border-ga-ink hover:text-ga-ink'
                }`}
              >
                {l === 'ALL' ? t('all') : l}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        )}

        {loading ? (
          <LoadingState label={t('loading')} />
        ) : filtered.length === 0 ? (
          <div className="border border-ga-line bg-ga-card py-16 text-center">
            <p className="font-ga-display text-[20px] font-medium text-ga-ink">{t('emptyTitle')}</p>
            <p className="ga-ui mt-2 text-[14px] text-ga-muted">{t('emptyDesc')}</p>
          </div>
        ) : (
          <>
            <GaCap className="mb-3 block">{t('count', { count: filtered.length })}</GaCap>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.slice(0, 300).map((w) => {
                const color = colorForArticle(w.article) ?? 'var(--ga-ink)'
                return (
                  <div
                    key={w.id}
                    className="group border border-ga-line bg-ga-card p-4 transition-shadow hover:shadow-ga-card-hover"
                    style={w.article ? { borderLeftWidth: 3, borderLeftColor: color } : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-ga-display text-[19px] font-medium leading-tight" style={{ color }}>
                        {w.german}
                      </p>
                      <button
                        type="button"
                        onClick={() => speak(w.german)}
                        className="shrink-0 text-ga-subtle transition-colors hover:text-ga-accent"
                        aria-label={t('speakAria')}
                      >
                        <Volume2 size={17} aria-hidden />
                      </button>
                    </div>
                    <p className="ga-ui mt-1 text-[14px] text-ga-ink">{w.meaning || '—'}</p>
                    {w.example && <p className="ga-ui mt-2 text-[12.5px] italic text-ga-muted">“{w.example}”</p>}
                    {w.level && (
                      <span className="ga-ui mt-2 inline-block rounded-ga border border-ga-line px-1.5 py-0.5 text-[10px] font-semibold text-ga-muted">
                        {w.level}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            {filtered.length > 300 && (
              <p className="ga-ui mt-5 text-center text-[12.5px] text-ga-subtle">
                {t('cappedNote', { count: filtered.length })}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
