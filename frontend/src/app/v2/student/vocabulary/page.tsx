'use client'

import { useEffect, useMemo, useState } from 'react'
import { Volume2 } from 'lucide-react'
import api from '@/lib/api'
import { GaPageHdr, TkSearch, GaCap, LoadingState, ErrorBanner } from '@/components/ui-v2'

// Reuse GET /words (the vocabulary store). Tolerant field-picking (shape varies) + gender→color
// (der=blue / die=red / das=green, DeutschFlow's signature) + search + speak.

interface Word {
  id: string
  german: string
  meaning: string
  article: string | null
  example: string | null
  level: string | null
}

const ARTICLE_COLOR: Record<string, string> = { der: '#2F6FC9', die: '#DA291C', das: '#1E9E61' }

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
    if (first && ARTICLE_COLOR[first]) article = first
  }
  // normalize gender codes (M/F/N) → articles
  if (article === 'm' || article === 'masculine') article = 'der'
  if (article === 'f' || article === 'feminine') article = 'die'
  if (article === 'n' || article === 'neuter') article = 'das'
  return {
    id: str(r, 'id', 'vocabId') || String(i),
    german,
    meaning: str(r, 'meaning', 'vietnamese', 'translation', 'meaningVi', 'vi'),
    article: article && ARTICLE_COLOR[article] ? article : null,
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
      .catch(() => setError('Không thể tải từ vựng.'))
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
        title="Từ vựng"
        subtitle="Học từ theo màu giống — der (xanh) · die (đỏ) · das (lục)"
        right={
          <TkSearch
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm từ / nghĩa…"
            containerClassName="w-[230px]"
          />
        }
      />
      <div className="flex-1 px-10 py-6">
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
                {l === 'ALL' ? 'Tất cả' : l}
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
          <LoadingState label="Đang tải từ vựng…" />
        ) : filtered.length === 0 ? (
          <div className="border border-ga-line bg-ga-card py-16 text-center">
            <p className="font-ga-display text-[20px] font-medium text-ga-ink">Không có từ nào</p>
            <p className="ga-ui mt-2 text-[14px] text-ga-muted">Thử từ khoá khác hoặc đổi cấp độ.</p>
          </div>
        ) : (
          <>
            <GaCap className="mb-3 block">{filtered.length} từ</GaCap>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.slice(0, 300).map((w) => {
                const color = w.article ? ARTICLE_COLOR[w.article] : 'var(--ga-ink)'
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
                        aria-label="Nghe phát âm"
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
                Hiển thị 300/{filtered.length} từ — dùng tìm kiếm để thu hẹp.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
