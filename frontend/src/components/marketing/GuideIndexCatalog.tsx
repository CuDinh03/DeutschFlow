'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { GuideArticle } from '@/data/camNang'
import { GaGlyphMark } from '@/components/ui-v2/GaGlyphMark'
import type { GlyphName } from '@/lib/galerieGlyphs'

function glyphForOccupation(code: string): GlyphName {
  if (code === 'koch') return 't_food'
  if (code === 'pflegefachkraft') return 't_health'
  return 'phongvan'
}

export function GuideIndexCatalog({ articles }: { articles: GuideArticle[] }) {
  const [selectedTrade, setSelectedTrade] = useState<string>('all')

  const trades = Array.from(
    new Map(articles.map((a) => [a.occupationCode, { code: a.occupationCode, label: a.crumb, de: a.occupationNameDe }])).values(),
  )

  const shown = selectedTrade === 'all' ? articles : articles.filter((a) => a.occupationCode === selectedTrade)

  const chipClass = (active: boolean) =>
    `inline-flex min-h-10 items-center gap-2 rounded-ga-pill border px-4 py-2 text-ga-small font-semibold transition-colors ${
      active
        ? 'border-ga-ink bg-ga-ink text-ga-bg'
        : 'border-ga-border bg-ga-card text-ga-ink hover:border-ga-ink'
    }`

  return (
    <div className="mt-8">
      <div role="group" aria-label="Lọc bài cẩm nang theo nhóm nghề" className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={selectedTrade === 'all'}
          onClick={() => setSelectedTrade('all')}
          className={chipClass(selectedTrade === 'all')}
        >
          Tất cả ({articles.length})
        </button>
        {trades.map((t) => (
          <button
            key={t.code}
            type="button"
            aria-pressed={selectedTrade === t.code}
            onClick={() => setSelectedTrade(t.code)}
            className={chipClass(selectedTrade === t.code)}
          >
            <GaGlyphMark name={glyphForOccupation(t.code)} size={16} />
            <span>{t.label}</span>
            <span lang="de" className="opacity-75">· {t.de}</span>
          </button>
        ))}
      </div>

      <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((a) => (
          <li key={a.slug}>
            <Link
              href={`/cam-nang/${a.slug}/`}
              className="group flex h-full flex-col justify-between rounded-ga-xl border border-ga-border bg-ga-card p-6 shadow-ga-sm transition-all hover:-translate-y-0.5 hover:border-ga-ink hover:shadow-ga-md"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 rounded-ga-pill border border-ga-border bg-ga-bg px-3 py-1 text-ga-eyebrow uppercase text-ga-ink">
                    <GaGlyphMark name={glyphForOccupation(a.occupationCode)} size={15} />
                    <span lang="de">{a.occupationNameDe}</span>
                  </span>
                  <time dateTime={a.published} className="text-ga-caption text-ga-muted">
                    {a.published.split('-').reverse().join('/')}
                  </time>
                </div>

                <h2 className="mt-4 font-ga-display text-ga-m-h3 font-medium text-ga-ink group-hover:text-ga-navy">
                  {a.h1}
                </h2>
                <p className="mt-2.5 text-ga-small text-ga-muted">{a.description}</p>
              </div>

              <div className="mt-5 border-t border-ga-border pt-4">
                <div className="flex flex-wrap gap-1.5 text-ga-caption text-ga-muted">
                  <span className="rounded-ga-pill bg-ga-bg px-2.5 py-0.5">{a.questions.length} câu hỏi đã duyệt</span>
                  <span className="rounded-ga-pill bg-ga-bg px-2.5 py-0.5">{a.vocab.length} từ vựng nghề</span>
                  <span className="rounded-ga-pill bg-ga-bg px-2.5 py-0.5">{a.mistakes.length} lỗi ngữ pháp</span>
                </div>
                <span className="mt-3 inline-flex items-center gap-1.5 text-ga-small font-semibold text-ga-ink underline decoration-ga-yellow decoration-2 underline-offset-4 group-hover:decoration-ga-ink">
                  Đọc bài chi tiết
                  <ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
