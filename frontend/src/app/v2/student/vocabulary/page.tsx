'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { BarChart3, HelpCircle, Layers, Mic, Volume2 } from 'lucide-react'
import api from '@/lib/api'
import { cleanExample, colorForArticle } from '@/lib/vocabWords'
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
/** True khi từ có loại từ RÕ RÀNG không phải danh từ (verb/adjective/…) — chỉ danh từ mới có mạo từ. */
function isNonNoun(r: Record<string, unknown>): boolean {
  const dtype = str(r, 'dtype', 'type', 'wordType', 'partOfSpeech').toLowerCase()
  return dtype !== '' && dtype !== 'noun'
}
function normalize(r: Record<string, unknown>, i: number): Word {
  // GET /words để từ ở `baseForm`; thiếu key này thì mọi từ bị lọc (filter theo w.german) → hub rỗng
  // dù API trả đủ dữ liệu (QA F-4: envelope `items` đã sửa, nhưng field từ vẫn lệch).
  const german = str(r, 'baseForm', 'german', 'word', 'wordDe', 'lemma', 'text')
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
    // QA F-5: chỉ danh từ mới có mạo từ — bỏ mạo từ với từ loại khác dù dữ liệu seed có gán giống.
    article: isNonNoun(r) ? null : (article && colorForArticle(article) ? article : null),
    example: cleanExample(str(r, 'exampleDe', 'example', 'sampleSentence')) || null,
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

// Kho có ~10.9k từ: KHÔNG tải hết. Tìm + lọc cấp độ đẩy xuống server (q/cefr), danh sách nạp theo
// trang và cuộn tới đâu nạp tới đó (infinite scroll). Trước đây trang chỉ gọi /words không tham số
// → mặc định 20 từ, lọc phía client trong 20 từ đó → không bao giờ thấy hết kho.
const PAGE_SIZE = 50
const LEVELS = ['ALL', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

export default function V2StudentVocabularyPage() {
  const t = useTranslations('v2.student.vocabulary')
  const locale = useLocale()
  const [words, setWords] = useState<Word[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [level, setLevel] = useState<string>('ALL')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pageRef = useRef(0)
  const inFlightRef = useRef(false)

  // Debounce ô tìm — mỗi phím không bắn một query.
  useEffect(() => {
    const h = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(h)
  }, [query])

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)
      try {
        const params: Record<string, string | number> = { page: pageNum, size: PAGE_SIZE, locale }
        if (debouncedQuery) params.q = debouncedQuery
        if (level !== 'ALL') params.cefr = level
        const res = await api.get('/words', { params })
        const data = res.data as { items?: unknown; content?: unknown; total?: number }
        const raw = (Array.isArray(res.data) ? res.data : (data?.items ?? data?.content ?? [])) as Record<
          string,
          unknown
        >[]
        const mapped = raw.map(normalize).filter((w) => w.german)
        const tot = typeof data?.total === 'number' ? data.total : mapped.length
        setTotal(tot)
        setWords((prev) => (append ? [...prev, ...mapped] : mapped))
        pageRef.current = pageNum
        setHasMore((pageNum + 1) * PAGE_SIZE < tot)
      } catch {
        setError(t('loadError'))
        if (!append) setWords([])
      } finally {
        inFlightRef.current = false
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [debouncedQuery, level, locale, t],
  )

  // Đổi từ khoá/cấp độ → nạp lại từ trang 0.
  useEffect(() => {
    pageRef.current = 0
    void fetchPage(0, false)
  }, [fetchPage])

  // Cuộn gần đáy → nạp trang kế.
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !inFlightRef.current) {
          void fetchPage(pageRef.current + 1, true)
        }
      },
      { rootMargin: '400px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, fetchPage])

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
            containerClassName="w-full lg:w-[230px]"
          />
        }
      />
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
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

        <div className="mb-5 flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLevel(l)}
              className={`ga-ui inline-flex min-h-10 items-center justify-center rounded-ga border px-[14px] py-2 text-[12.5px] font-semibold transition-colors lg:min-h-0 ${
                level === l
                  ? 'border-ga-ink bg-ga-ink text-ga-card'
                  : 'border-ga-border bg-ga-card text-ga-muted hover:border-ga-ink hover:text-ga-ink'
              }`}
            >
              {l === 'ALL' ? t('all') : l}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={() => fetchPage(0, false)} />
          </div>
        )}

        {loading ? (
          <LoadingState label={t('loading')} />
        ) : words.length === 0 ? (
          <div className="border border-ga-line bg-ga-card px-4 py-16 text-center lg:px-0">
            <p className="font-ga-display text-[20px] font-medium text-ga-ink">{t('emptyTitle')}</p>
            <p className="ga-ui mt-2 text-[14px] text-ga-muted">{t('emptyDesc')}</p>
          </div>
        ) : (
          <>
            <GaCap className="mb-3 block">{t('count', { count: total })}</GaCap>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {words.map((w) => {
                const color = colorForArticle(w.article) ?? 'var(--ga-ink)'
                return (
                  <div
                    key={w.id}
                    className="group border border-ga-line bg-ga-card p-4 transition-shadow hover:shadow-ga-card-hover"
                    style={w.article ? { borderLeftWidth: 3, borderLeftColor: color } : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className="min-w-0 break-words font-ga-display text-[19px] font-medium leading-tight"
                        style={{ color }}
                      >
                        {w.german}
                      </p>
                      <button
                        type="button"
                        onClick={() => speak(w.german)}
                        className="-m-3 shrink-0 p-3 text-ga-subtle transition-colors hover:text-ga-accent lg:m-0 lg:p-0"
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
            {/* Điểm neo cho infinite scroll + chỉ báo đang nạp thêm. */}
            <div ref={sentinelRef} className="h-1" aria-hidden />
            {loadingMore && (
              <p className="ga-ui mt-4 text-center text-[12.5px] text-ga-subtle">{t('loading')}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
