'use client'

import { useState } from 'react'

export interface VocabItem {
  de: string
  vi: string
}

type ArticleFilter = 'all' | 'der' | 'die' | 'das'

function detectArticle(term: string): 'der' | 'die' | 'das' | 'mixed' | null {
  const lower = term.trim().toLowerCase()
  const hasDer = /\bder\s+/i.test(lower)
  const hasDie = /\bdie\s+/i.test(lower)
  const hasDas = /\bdas\s+/i.test(lower)
  const count = Number(hasDer) + Number(hasDie) + Number(hasDas)
  if (count > 1) return 'mixed'
  if (hasDer) return 'der'
  if (hasDie) return 'die'
  if (hasDas) return 'das'
  return null
}

function articleBadgeClass(article: ReturnType<typeof detectArticle>): string {
  if (article === 'der') return 'border-ga-navy bg-ga-navy-soft text-ga-navy'
  if (article === 'die') return 'border-ga-red bg-ga-red-soft text-ga-red'
  if (article === 'das') return 'border-ga-yellow bg-ga-yellow-soft text-ga-ink'
  return 'border-ga-border bg-ga-bg text-ga-muted'
}

function articleLabel(article: ReturnType<typeof detectArticle>): string | null {
  if (article === 'der') return 'der · giống đực'
  if (article === 'die') return 'die · giống cái / số nhiều'
  if (article === 'das') return 'das · giống trung'
  if (article === 'mixed') return 'der / die'
  return null
}

/**
 * Bảng từ vựng nghề tương tác cho bài Cẩm nang (`/cam-nang/[slug]/`):
 * - Giữ nguyên cấu trúc ngữ nghĩa `<dl><dt lang="de">...</dt><dd>...</dd></dl>` cho SEO.
 * - Tô màu mạo từ `der` (navy), `die` (đỏ), `das` (vàng) giúp nhớ giống danh từ tiếng Đức.
 * - Cho phép lọc theo mạo từ và bật chế độ "Tự nhẩm nghĩa" (chạm từng thẻ `.kw-mark` để lật xem nghĩa tiếng Việt).
 */
export function GuideVocabDeck({ items }: { items: VocabItem[] }) {
  const [filter, setFilter] = useState<ArticleFilter>('all')
  const [quizMode, setQuizMode] = useState(false)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<string | null>(null)

  const filtered = items.filter((item) => {
    if (filter === 'all') return true
    const kind = detectArticle(item.de)
    if (kind === 'mixed') return filter === 'der' || filter === 'die'
    return kind === filter
  })

  const toggleCard = (de: string) => {
    setSelected((prev) => (prev === de ? null : de))
    if (quizMode) {
      setRevealed((prev) => ({ ...prev, [de]: !prev[de] }))
    }
  }

  const toggleQuiz = () => {
    setQuizMode((prev) => !prev)
    setRevealed({})
  }

  const chipClass = (active: boolean) =>
    `min-h-9 rounded-ga-pill border px-3.5 py-1.5 text-ga-caption font-semibold transition-colors ${
      active
        ? 'border-ga-ink bg-ga-ink text-ga-bg'
        : 'border-ga-border bg-ga-card text-ga-ink hover:border-ga-ink'
    }`

  return (
    <div className="rounded-ga-xl border border-ga-border bg-ga-card p-4 shadow-ga-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ga-border pb-4">
        <div role="group" aria-label="Lọc theo giống danh từ" className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')} className={chipClass(filter === 'all')}>
            Tất cả ({items.length})
          </button>
          <button type="button" aria-pressed={filter === 'der'} onClick={() => setFilter('der')} className={chipClass(filter === 'der')}>
            der
          </button>
          <button type="button" aria-pressed={filter === 'die'} onClick={() => setFilter('die')} className={chipClass(filter === 'die')}>
            die
          </button>
          <button type="button" aria-pressed={filter === 'das'} onClick={() => setFilter('das')} className={chipClass(filter === 'das')}>
            das
          </button>
        </div>

        <button
          type="button"
          aria-pressed={quizMode}
          onClick={toggleQuiz}
          className={`min-h-9 rounded-ga-pill border px-3.5 py-1.5 text-ga-caption font-semibold transition-colors ${
            quizMode
              ? 'border-ga-yellow bg-ga-yellow text-ga-ink'
              : 'border-ga-border bg-ga-bg text-ga-ink hover:border-ga-ink'
          }`}
        >
          {quizMode ? 'Đang tự nhẩm · Hiện tất cả' : 'Tự nhẩm nghĩa tiếng Việt'}
        </button>
      </div>

      <p className="mt-3 text-ga-caption text-ga-muted">
        {quizMode
          ? 'Chạm vào từng từ tiếng Đức để kiểm tra nghĩa tiếng Việt.'
          : 'Màu mạo từ: der (xanh hải quân) · die (đỏ) · das (vàng). Chạm vào từ để đánh dấu đang ôn.'}
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {filtered.map((v) => {
          const article = detectArticle(v.de)
          const badge = articleLabel(article)
          const isSelected = selected === v.de
          const isHidden = quizMode && !revealed[v.de]
          return (
            <div
              key={v.de}
              onClick={() => toggleCard(v.de)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggleCard(v.de)
                }
              }}
              role="button"
              tabIndex={0}
              aria-pressed={quizMode ? Boolean(revealed[v.de]) : isSelected}
              className={`rounded-ga-md border p-3.5 text-left transition-all ${
                isSelected
                  ? 'border-ga-ink bg-ga-yellow-soft shadow-ga-sm'
                  : 'border-ga-border bg-ga-bg hover:border-ga-ink'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <dt lang="de" className="text-ga-body font-semibold text-ga-ink">
                  <span className={isSelected ? 'kw-mark' : undefined}>{v.de}</span>
                </dt>
                {badge && (
                  <span className={`shrink-0 rounded-ga-pill border px-2 py-0.5 text-ga-eyebrow ${articleBadgeClass(article)}`}>
                    {badge}
                  </span>
                )}
              </div>
              <dd className={`mt-1.5 text-ga-small transition-opacity ${isHidden ? 'select-none text-ga-muted italic' : 'text-ga-muted'}`}>
                {isHidden ? 'Chạm để xem nghĩa tiếng Việt →' : v.vi}
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}
