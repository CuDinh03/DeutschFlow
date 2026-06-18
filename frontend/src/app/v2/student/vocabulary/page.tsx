'use client'

import { useEffect, useMemo, useState } from 'react'
import { Volume2, RotateCcw } from 'lucide-react'
import api from '@/lib/api'
import { GaPageHdr, GaCap, LoadingState, ErrorBanner } from '@/components/ui-v2'

// Reskin of proto GaVocab (proto-screens.jsx): single-card SRS flashcard study — progress bar,
// flippable card (front: gender + image + German; back: meaning + example), grade buttons.
// Reuse GET /words (the real vocabulary store). Grading advances the deck locally (the proto
// likewise only advances — persistent SRS grading lives in the Review screen, a separate domain).

interface Word {
  id: string
  german: string
  meaning: string
  article: string | null
  example: string | null
  level: string | null
  imageUrl: string | null
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
  if (article === 'm' || article === 'masculine') article = 'der'
  if (article === 'f' || article === 'feminine') article = 'die'
  if (article === 'n' || article === 'neuter') article = 'das'
  const img = str(r, 'imageUrl', 'image')
  return {
    id: str(r, 'id', 'vocabId') || String(i),
    german,
    meaning: str(r, 'meaning', 'vietnamese', 'translation', 'meaningVi', 'vi'),
    article: article && ARTICLE_COLOR[article] ? article : null,
    example: str(r, 'exampleDe', 'example', 'sampleSentence') || null,
    level: str(r, 'level', 'cefrLevel', 'cefr') || null,
    imageUrl: img && !img.includes('placeholder') ? img : null,
  }
}

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'de-DE'
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

const GRADES: { key: string; label: string; bg: string; fg: string }[] = [
  { key: 'again', label: 'Học lại', bg: '#E7E3DA', fg: 'var(--ga-ink)' },
  { key: 'hard', label: 'Khó', bg: 'var(--ga-red-soft)', fg: 'var(--ga-red)' },
  { key: 'easy', label: 'Dễ', bg: 'var(--ga-green-soft)', fg: 'var(--ga-green)' },
]

export default function V2StudentVocabularyPage() {
  const [words, setWords] = useState<Word[]>([])
  const [level, setLevel] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // deck state
  const [deck, setDeck] = useState<Word[]>([])
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    api
      .get('/words')
      .then((res) => {
        const raw = (Array.isArray(res.data) ? res.data : (res.data?.content ?? [])) as Record<string, unknown>[]
        setWords(raw.map(normalize).filter((w) => w.german && w.meaning))
      })
      .catch(() => setError('Không thể tải từ vựng.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const levels = useMemo(
    () => ['ALL', ...Array.from(new Set(words.map((w) => w.level).filter(Boolean) as string[])).sort()],
    [words],
  )

  // (re)build the deck whenever the words or level filter change
  useEffect(() => {
    const pool = words.filter((w) => level === 'ALL' || w.level === level).slice(0, 60)
    setDeck(pool)
    setIdx(0)
    setFlipped(false)
  }, [words, level])

  const total = deck.length
  const card = deck[idx]
  const remaining = total - idx
  const done = total > 0 && idx >= total

  const grade = (key: string) => {
    setFlipped(false)
    setTimeout(() => {
      if (key === 'again' && card) setDeck((d) => [...d, card]) // re-queue at the end
      setIdx((i) => i + 1)
    }, 140)
  }
  const restart = () => {
    setIdx(0)
    setFlipped(false)
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Ôn từ vựng"
        subtitle="Hệ thống thẻ ghi nhớ — der (xanh) · die (đỏ) · das (lục)"
        right={
          total > 0 && !done ? (
            <span className="font-ga-display text-[26px] font-medium text-ga-ink">
              {remaining} <span className="ga-ui text-[14px] font-normal text-ga-muted">thẻ còn lại</span>
            </span>
          ) : undefined
        }
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-10 py-8">
        {/* level / deck selector */}
        {levels.length > 1 && (
          <div className="flex w-full max-w-[640px] flex-wrap justify-center gap-2">
            {levels.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLevel(l)}
                className={`ga-ui rounded-ga border px-[13px] py-1.5 text-[12.5px] font-semibold transition-colors ${
                  level === l
                    ? 'border-ga-ink bg-ga-ink text-ga-card'
                    : 'border-ga-line bg-ga-card text-ga-muted hover:border-ga-ink hover:text-ga-ink'
                }`}
              >
                {l === 'ALL' ? 'Tất cả' : l}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="w-full max-w-[640px]">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        )}

        {loading ? (
          <LoadingState label="Đang tải từ vựng…" />
        ) : total === 0 ? (
          <div className="w-full max-w-[640px] border border-ga-line bg-ga-card py-16 text-center">
            <p className="font-ga-display text-[20px] font-medium text-ga-ink">Chưa có từ để ôn</p>
            <p className="ga-ui mt-2 text-[14px] text-ga-muted">Thử đổi cấp độ khác.</p>
          </div>
        ) : done ? (
          <div className="w-full max-w-[640px] border border-ga-line bg-ga-card py-16 text-center">
            <div className="text-[40px]">🎉</div>
            <p className="mt-3 font-ga-display text-[22px] font-medium text-ga-ink">Đã ôn xong bộ thẻ!</p>
            <p className="ga-ui mt-2 text-[14px] text-ga-muted">Bạn đã ôn {total} thẻ.</p>
            <button
              type="button"
              onClick={restart}
              className="ga-ui mx-auto mt-5 inline-flex items-center gap-2 rounded-ga bg-ga-accent px-4 py-2.5 text-[13.5px] font-semibold text-ga-accent-ink hover:opacity-90"
            >
              <RotateCcw size={15} aria-hidden /> Ôn lại từ đầu
            </button>
          </div>
        ) : (
          <>
            {/* progress */}
            <div className="w-full max-w-[640px]">
              <div className="h-[3px] bg-ga-line">
                <div
                  className="h-full bg-ga-accent transition-[width] duration-300"
                  style={{ width: `${(idx / total) * 100}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between">
                <GaCap>
                  {idx} / {total} đã ôn
                </GaCap>
                {card?.level && <GaCap>Cấp độ: {card.level}</GaCap>}
              </div>
            </div>

            {/* flashcard */}
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="relative flex min-h-[280px] w-full max-w-[640px] cursor-pointer flex-col items-center justify-center border border-ga-line bg-ga-card px-11 py-10 text-center transition-shadow hover:shadow-ga-card-hover"
            >
              {card?.article && (
                <span
                  className="absolute left-5 top-5 text-[13px] font-bold uppercase tracking-[0.04em]"
                  style={{ color: ARTICLE_COLOR[card.article] }}
                >
                  {card.article}
                </span>
              )}
              {!flipped ? (
                <>
                  {card?.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={card.imageUrl}
                      alt=""
                      className="mb-5 h-[120px] w-[200px] border border-ga-line object-cover"
                    />
                  ) : (
                    <div
                      className="mb-5 flex h-[120px] w-[200px] items-center justify-center border border-ga-line bg-ga-bg"
                      style={card?.article ? { borderColor: ARTICLE_COLOR[card.article] } : undefined}
                    >
                      <GaCap>{card?.article ? card.article.toUpperCase() : 'TỪ'}</GaCap>
                    </div>
                  )}
                  <div className="font-ga-display text-[52px] font-medium leading-[1.15] tracking-[-0.02em] text-ga-ink">
                    {card?.german}
                  </div>
                  <GaCap className="mt-4 text-ga-muted">Nhấn để xem nghĩa</GaCap>
                </>
              ) : (
                <>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="font-ga-display text-[36px] font-medium text-ga-ink">{card?.meaning}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (card) speak(card.german)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation()
                          if (card) speak(card.german)
                        }
                      }}
                      className="text-ga-subtle transition-colors hover:text-ga-accent"
                      aria-label="Nghe phát âm"
                    >
                      <Volume2 size={22} aria-hidden />
                    </span>
                  </div>
                  <div className="mx-auto mb-4 h-0.5 w-10 bg-ga-line" />
                  {card?.example && (
                    <p className="font-ga-display text-[18px] italic leading-relaxed text-ga-muted">“{card.example}”</p>
                  )}
                </>
              )}
            </button>

            {/* grade buttons */}
            <div className="flex w-full max-w-[640px] gap-3">
              {GRADES.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => grade(g.key)}
                  className="ga-ui flex-1 border py-3.5 text-[15px] font-bold transition-opacity hover:opacity-85"
                  style={{ background: g.bg, color: g.fg, borderColor: 'var(--ga-line)' }}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <GaCap className="text-ga-subtle">Nhấn vào thẻ để xem mặt sau trước khi đánh giá</GaCap>
          </>
        )}
      </div>
    </div>
  )
}
