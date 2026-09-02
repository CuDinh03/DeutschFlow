'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight, BarChart3, HelpCircle, Layers, Mic, RotateCcw, Volume2 } from 'lucide-react'
import api from '@/lib/api'
import { useReviewDueCount } from '@/hooks/useReviewDueCount'
import { cleanExample, colorForArticle } from '@/lib/vocabWords'
import { GaPageHdr, TkSearch, GaCap, LoadingState, ErrorBanner } from '@/components/ui-v2'
import {
  CEFR_ORDER,
  DTYPE_ORDER,
  EMPTY_FACETS,
  GENDER_ORDER,
  NO_FILTERS,
  STATUS_ORDER,
  UNGRADED,
  filterParams,
  genderChipColor,
  hasAnyFilter,
  toggleAxis,
  type VocabFilterState,
  type WordFacets,
} from './facets'

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
  /** NEW | LEARNING | MASTERED — theo lịch ôn của chính người học. */
  srsStatus: string | null
}

/** Nơi CTA chính dẫn tới khi còn thẻ đến hạn ôn. Không nằm trong DRILLS — đây là màn ôn tập SRS. */
const REVIEW_HREF = '/v2/student/review'
/** Khi không còn gì đến hạn thì CTA chính mời học từ mới, tức chính bài thẻ vuốt. */
const FRESH_HREF = '/v2/student/vocabulary/swipe'

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
    srsStatus: str(r, 'srsStatus') || null,
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

/**
 * Chấm trạng thái ôn tập trên thẻ từ.
 *
 * <p>Chỉ vẽ cho từ ĐANG học hoặc ĐÃ thuộc — chấm trên mọi từ chưa học là nhiễu. Màu không phải tín hiệu
 * duy nhất: mỗi chấm mang nhãn chữ cho trình đọc màn hình và tooltip.
 */
function SrsDot({ status, label }: { status: string; label: string }) {
  if (status !== 'LEARNING' && status !== 'MASTERED') return null
  const color = status === 'MASTERED' ? 'var(--ga-green)' : 'var(--ga-gold)'
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-ga border border-ga-line px-1.5 py-0.5"
      title={label}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
      <span className="ga-ui text-[10px] font-semibold text-ga-muted">{label}</span>
    </span>
  )
}

/** Một lựa chọn trên dải lọc. `color` chỉ dùng cho mạo từ — der xanh · die đỏ · das lục. */
function Chip({
  label,
  count,
  active,
  color,
  onClick,
}: {
  label: string
  count?: number
  active: boolean
  color?: string | null
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`ga-ui inline-flex min-h-10 items-center justify-center gap-1.5 rounded-ga border px-[14px] py-2 text-[12.5px] font-semibold transition-colors lg:min-h-0 ${
        active
          ? 'border-ga-ink bg-ga-ink text-ga-card'
          : 'border-ga-border bg-ga-card text-ga-muted hover:border-ga-ink hover:text-ga-ink'
      }`}
      style={
        color
          ? active
            ? { backgroundColor: color, borderColor: color }
            : { borderLeftWidth: 3, borderLeftColor: color }
          : undefined
      }
    >
      {label}
      {typeof count === 'number' && count > 0 && (
        <span className={active ? 'opacity-70' : 'text-ga-subtle'}>{count}</span>
      )}
    </button>
  )
}

function FilterRow({ cap, children }: { cap: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-4">
      <GaCap className="block shrink-0 sm:w-[108px] sm:pt-2.5">{cap}</GaCap>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export default function V2StudentVocabularyPage() {
  const t = useTranslations('v2.student.vocabulary')
  const locale = useLocale()
  const dueCount = useReviewDueCount()
  const [words, setWords] = useState<Word[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [filters, setFilters] = useState<VocabFilterState>(NO_FILTERS)
  const [facets, setFacets] = useState<WordFacets>(EMPTY_FACETS)
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
        const params = {
          ...filterParams(filters, locale, debouncedQuery),
          page: pageNum,
          size: PAGE_SIZE,
        }
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
    [debouncedQuery, filters, locale, t],
  )

  // Số đếm của MỌI trục lấy trong một lượt gọi, và tính lại mỗi khi bộ lọc đổi: mỗi trục được đếm với
  // các bộ lọc khác đang bật nhưng BỎ bộ lọc của chính nó, nên con số trên chip trả lời đúng câu "chọn
  // chip này thì còn bao nhiêu từ" — không chip nào dẫn tới danh sách rỗng.
  useEffect(() => {
    let cancelled = false
    api
      .get('/words/facets', { params: filterParams(filters, locale, debouncedQuery) })
      .then((res) => {
        if (!cancelled) setFacets({ ...EMPTY_FACETS, ...(res.data as WordFacets) })
      })
      .catch(() => {
        // Không lấy được số liệu thì bỏ hẳn dải chip — thà không có bộ lọc còn hơn bộ lọc trả rỗng.
        if (!cancelled) setFacets(EMPTY_FACETS)
      })
    return () => {
      cancelled = true
    }
  }, [filters, locale, debouncedQuery])

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

  // Chip chỉ hiện khi có từ, HOẶC khi đang được chọn — chọn xong mà chip biến mất thì không bỏ chọn được.
  const statusChips = useMemo(
    () => STATUS_ORDER.filter((k) => (facets.status[k] ?? 0) > 0 || filters.status === k),
    [facets.status, filters.status],
  )
  const dtypeChips = useMemo(
    () => DTYPE_ORDER.filter((k) => (facets.dtype[k] ?? 0) > 0 || filters.dtype === k),
    [facets.dtype, filters.dtype],
  )
  const cefrOptions = useMemo(() => {
    const levels: string[] = CEFR_ORDER.filter((l) => (facets.cefr[l] ?? 0) > 0 || filters.cefr === l)
    if ((facets.cefr[UNGRADED] ?? 0) > 0 || filters.cefr === UNGRADED) levels.push(UNGRADED)
    return levels
  }, [facets.cefr, filters.cefr])
  // Một CTA chính thay bốn ô đồng hạng: bốn lối vào ngang nhau không trả lời được câu "giờ tôi làm gì".
  // Còn thẻ đến hạn thì ôn trước — đó là việc SRS đòi hôm nay; hết hạn mới mời học từ mới.
  const cta = dueCount > 0
    ? { href: REVIEW_HREF, Icon: RotateCcw, title: t('cta.due', { count: dueCount }), desc: t('cta.dueDesc') }
    : { href: FRESH_HREF, Icon: Layers, title: t('cta.fresh'), desc: t('cta.freshDesc') }
  // Không lặp lại lối vào mà CTA đã dẫn tới.
  const secondaryDrills = DRILLS.filter((d) => d.href !== cta.href)

  const anyFilter = hasAnyFilter(filters)
  const showFilters = statusChips.length > 0 || dtypeChips.length > 0 || facets.topics.length > 0 || anyFilter

  return (
    <div className="flex min-h-full flex-col">
      {/* Ô tìm rời khỏi header: thanh trên đã có ô tìm toàn cục, hai ô cạnh nhau chỉ gây phân vân.
          Nó xuống mở đầu khối tra cứu, nơi nó thật sự thuộc về. */}
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {/* Việc chính hôm nay, nói thẳng ra một lần. */}
        <Link
          href={cta.href}
          className="group mb-3 flex items-center gap-4 rounded-ga bg-ga-accent px-5 py-5 text-ga-accent-ink transition-transform duration-200 hover:-translate-y-0.5 sm:px-7 sm:py-6"
        >
          <cta.Icon size={26} aria-hidden className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="ga-ui block text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">
              {t('cta.cap')}
            </span>
            <span className="mt-1 block font-ga-display text-[21px] font-medium leading-tight sm:text-[25px]">
              {cta.title}
            </span>
            <span className="ga-ui mt-1 block text-[12.5px] leading-snug opacity-80">{cta.desc}</span>
          </span>
          <ArrowRight
            size={20}
            aria-hidden
            className="shrink-0 transition-transform duration-200 group-hover:translate-x-1"
          />
        </Link>

        {/* Ba lối vào còn lại: vẫn bấm được, nhưng không còn tranh chỗ với việc chính. */}
        {/* 3 hay 4 mục tuỳ CTA dẫn đi đâu, nên để chúng tự chia đều thay vì ghim số cột. */}
        <div className="mb-8 flex flex-wrap gap-2">
          {secondaryDrills.map(({ key, href, Icon }) => (
            <Link
              key={key}
              href={href}
              className="group flex min-w-[9.5rem] flex-1 items-center gap-2.5 border border-ga-line bg-ga-card px-3 py-2.5 transition-colors hover:border-ga-accent"
            >
              <Icon size={15} aria-hidden className="shrink-0 text-ga-accent" />
              <span className="ga-ui truncate text-[13px] font-semibold text-ga-ink group-hover:text-ga-accent">
                {t(`drills.${key}.title`)}
              </span>
            </Link>
          ))}
        </div>

        {/* Khối tra cứu: tìm → lọc → đếm → lưới, đi liền một mạch. */}
        <GaCap className="mb-3 block">{t('lookup.cap')}</GaCap>
        <TkSearch
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          containerClassName="mb-3 w-full"
        />

        {/* Ba trục có dữ liệu thật thay cho một trục CEFR đơn độc: trạng thái học · từ loại + mạo từ ·
            chủ đề. Cấp độ lùi xuống một select vì đó là trục dữ liệu yếu nhất của kho. Chip chỉ hiện khi
            có từ (hoặc khi đang được chọn) — chip đếm 0 là chip dẫn tới danh sách rỗng. */}
        {showFilters && (
          <div className="mb-5 flex flex-col gap-3 border border-ga-line bg-ga-card p-4">
            {statusChips.length > 0 && (
              <FilterRow cap={t('filters.statusCap')}>
                {statusChips.map((key) => (
                  <Chip
                    key={key}
                    label={t(`filters.status.${key}`)}
                    count={facets.status[key] ?? 0}
                    active={filters.status === key}
                    onClick={() => setFilters((f) => toggleAxis(f, 'status', key))}
                  />
                ))}
              </FilterRow>
            )}

            {dtypeChips.length > 0 && (
              <FilterRow cap={t('filters.typeCap')}>
                {dtypeChips.map((key) => (
                  <Chip
                    key={key}
                    label={t(`filters.dtype.${key}`)}
                    count={facets.dtype[key] ?? 0}
                    active={filters.dtype === key}
                    onClick={() => setFilters((f) => toggleAxis(f, 'dtype', key))}
                  />
                ))}
                {filters.dtype === 'Noun' &&
                  GENDER_ORDER.filter((g) => (facets.gender[g] ?? 0) > 0 || filters.gender === g).map((g) => (
                    <Chip
                      key={g}
                      label={g.toLowerCase()}
                      count={facets.gender[g] ?? 0}
                      active={filters.gender === g}
                      color={genderChipColor(g)}
                      onClick={() => setFilters((f) => toggleAxis(f, 'gender', g))}
                    />
                  ))}
              </FilterRow>
            )}

            {facets.topics.length > 0 && (
              <FilterRow cap={t('filters.topicCap')}>
                {facets.topics.map((topic) => (
                  <Chip
                    key={topic.name}
                    label={topic.label}
                    count={topic.count}
                    active={filters.tag === topic.name}
                    onClick={() => setFilters((f) => toggleAxis(f, 'tag', topic.name))}
                  />
                ))}
              </FilterRow>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-ga-line pt-3">
              <label htmlFor="vocab-cefr" className="ga-ui text-[12.5px] font-semibold text-ga-muted">
                {t('filters.levelLabel')}
              </label>
              <select
                id="vocab-cefr"
                value={filters.cefr ?? 'ALL'}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, cefr: e.target.value === 'ALL' ? null : e.target.value }))
                }
                className="ga-ui min-h-10 rounded-ga border border-ga-border bg-ga-card px-3 py-2 text-[12.5px] font-semibold text-ga-ink lg:min-h-0"
              >
                <option value="ALL">{t('all')}</option>
                {cefrOptions.map((l) => (
                  <option key={l} value={l}>
                    {`${l === UNGRADED ? t('ungraded') : l} · ${facets.cefr[l] ?? 0}`}
                  </option>
                ))}
              </select>
              {anyFilter && (
                <button
                  type="button"
                  onClick={() => setFilters(NO_FILTERS)}
                  className="ga-ui min-h-10 text-[12.5px] font-semibold text-ga-accent underline underline-offset-4 hover:text-ga-ink lg:min-h-0"
                >
                  {t('filters.clear')}
                </button>
              )}
            </div>
          </div>
        )}

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
            {anyFilter && (
              <button
                type="button"
                onClick={() => setFilters(NO_FILTERS)}
                className="ga-ui mt-4 min-h-10 rounded-ga border border-ga-ink px-4 py-2 text-[12.5px] font-semibold text-ga-ink transition-colors hover:bg-ga-ink hover:text-ga-card"
              >
                {t('filters.clear')}
              </button>
            )}
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
                    className="group border border-ga-line bg-ga-card p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(22,21,19,0.16)]"
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
                    {(w.level || w.srsStatus) && (
                      <span className="mt-2 flex flex-wrap items-center gap-1.5">
                        {w.level && (
                          <span className="ga-ui inline-block rounded-ga border border-ga-line px-1.5 py-0.5 text-[10px] font-semibold text-ga-muted">
                            {w.level}
                          </span>
                        )}
                        {w.srsStatus && (
                          <SrsDot status={w.srsStatus} label={t(`filters.status.${w.srsStatus}`)} />
                        )}
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
