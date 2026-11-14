'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronDown, Search } from 'lucide-react'
import { GaGlyphMark } from '@/components/ui-v2/GaGlyphMark'
import type { GlyphName } from '@/lib/galerieGlyphs'
import {
  WORKPLACES,
  occupationName,
  type OccupationSummary,
  type Workplace,
} from '@/lib/occupationTypes'
import { localizedHref, type PublicLocale } from '@/lib/publicLocale'

const WORKPLACE_GLYPH: Record<Workplace, GlyphName> = {
  gastro: 't_food',
  pflege: 't_health',
  bau: 't_home',
  industrie: 'banhrang',
  logistik: 't_travel',
  handel: 't_shopping',
  buero: 'laptop',
  bildung: 'lophoc',
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
}

export interface OccupationIndexFilterProps {
  occupations: OccupationSummary[]
  locale: PublicLocale
  workplaceLabels: Record<Workplace, string>
  labels: {
    filterAll: string
    searchLabel: string
    searchPlaceholder: string
    curatedCap: string
    extendedSummary: string
    countTpl: string
  }
}

/**
 * Bộ lọc nhanh danh mục nghề `/phong-van/` (v3.4):
 * - Tất cả liên kết nghề đều có sẵn ngay trong HTML máy chủ (SEO crawlable).
 * - Tách nhóm nghề đã duyệt bộ câu hỏi riêng (`CURATED`) lên đầu để ưu tiên link equity & giúp
 *   người học trên điện thoại 390px không phải cuộn qua hàng trăm dòng chữ; nhóm nghề mở rộng
 *   (`GENERAL`) thu gọn gọn gàng trong `<details>` (tự động bung khi gõ tìm kiếm).
 */
export function OccupationIndexFilter({
  occupations,
  locale,
  workplaceLabels,
  labels,
}: OccupationIndexFilterProps) {
  const [query, setQuery] = React.useState('')
  const [activeWp, setActiveWp] = React.useState<'ALL' | Workplace>('ALL')
  const searchId = React.useId()

  const q = fold(query.trim())
  const isSearching = q.length > 0

  const filtered = React.useMemo(() => {
    return occupations.filter((o) => {
      if (activeWp !== 'ALL' && o.workplace !== activeWp) return false
      if (!q) return true
      const fields = [o.nameDe, o.nameVi, o.nameEn, ...(o.aliases ?? [])]
      return fields.some((f) => fold(f).includes(q))
    })
  }, [occupations, activeWp, q])

  const curated = React.useMemo(
    () => filtered.filter((o) => o.questionSet === 'CURATED'),
    [filtered],
  )
  const extended = React.useMemo(
    () => filtered.filter((o) => o.questionSet !== 'CURATED'),
    [filtered],
  )

  const formatCount = (n: number) => labels.countTpl.replace('{count}', String(n))

  const renderWorkplaceGroups = (list: OccupationSummary[], idPrefix: string) =>
    WORKPLACES.map((w) => {
      const items = list.filter((o) => o.workplace === w)
      if (!items.length) return null
      return (
        <section key={`${idPrefix}-${w}`} aria-labelledby={`${idPrefix}-${w}`} className="rounded-ga-lg border border-ga-border bg-ga-card p-5 shadow-ga-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-ga-border pb-3">
            <div className="flex items-center gap-2.5">
              <GaGlyphMark name={WORKPLACE_GLYPH[w]} size={24} className="shrink-0 text-ga-ink" />
              <h2 id={`${idPrefix}-${w}`} className="text-ga-h3 text-ga-ink">
                {workplaceLabels[w]}
              </h2>
            </div>
            <span className="rounded-ga-pill bg-ga-surface-2 px-2.5 py-0.5 text-ga-caption font-medium text-ga-muted">
              {formatCount(items.length)}
            </span>
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((o) => (
              <li key={o.code}>
                <Link
                  href={localizedHref(locale, `/phong-van/${o.code}`)}
                  className="group flex min-h-11 flex-col justify-center rounded-ga-md border border-ga-border bg-ga-bg px-3.5 py-2.5 transition-colors hover:border-ga-ink"
                >
                  <span className="block text-ga-body font-semibold text-ga-ink group-hover:text-ga-navy">
                    {o.nameDe}
                  </span>
                  {locale !== 'de' && (
                    <span className="block text-ga-caption text-ga-muted">
                      {occupationName(o, locale)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )
    })

  return (
    <div className="mt-8">
      {/* Thanh tìm nhanh + 8 chip nhóm ngành */}
      <div className="rounded-ga-lg border border-ga-border-strong bg-ga-card p-4 shadow-ga-sm sm:p-5">
        <label htmlFor={searchId} className="mb-2 block text-ga-small font-semibold text-ga-ink">
          {labels.searchLabel}
        </label>
        <div className="relative">
          <Search size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ga-muted" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.searchPlaceholder}
            className="block min-h-11 w-full rounded-ga-md border border-ga-line bg-ga-bg pl-10 pr-4 py-2.5 text-ga-body text-ga-ink outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
          />
        </div>

        <div className="mob-snap-rail mt-3.5 flex gap-2 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          <button
            type="button"
            aria-pressed={activeWp === 'ALL'}
            onClick={() => setActiveWp('ALL')}
            className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-ga-pill border px-3.5 text-ga-small font-semibold transition-colors ${
              activeWp === 'ALL'
                ? 'border-ga-ink bg-ga-ink text-ga-bg'
                : 'border-ga-border bg-ga-bg text-ga-ink hover:border-ga-ink'
            }`}
          >
            {labels.filterAll}
          </button>
          {WORKPLACES.map((w) => {
            const on = activeWp === w
            return (
              <button
                key={w}
                type="button"
                aria-pressed={on}
                onClick={() => setActiveWp(on ? 'ALL' : w)}
                className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-ga-pill border px-3.5 text-ga-small font-medium transition-colors ${
                  on
                    ? 'border-ga-ink bg-ga-ink text-ga-bg'
                    : 'border-ga-border bg-ga-bg text-ga-ink hover:border-ga-ink'
                }`}
              >
                <GaGlyphMark name={WORKPLACE_GLYPH[w]} size={18} className={on ? 'text-ga-yellow' : 'text-ga-ink'} />
                <span>{workplaceLabels[w]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Khu vực 1: Các nghề đã có bộ câu hỏi chuyên ngành duyệt tay (ưu tiên SEO & trải nghiệm) */}
      {curated.length > 0 && (
        <div className="mt-8">
          <div className="mb-4 flex items-center gap-2 text-ga-eyebrow uppercase text-ga-ink">
            <span className="inline-block h-[7px] w-[7px] bg-ga-yellow" />
            <span>{labels.curatedCap}</span>
          </div>
          <div className="flex flex-col gap-6">
            {renderWorkplaceGroups(curated, 'curated-wp')}
          </div>
        </div>
      )}

      {/* Khu vực 2: Các nghề mở rộng (thu gọn mặc định trên trang tổng, tự mở khi gõ tìm kiếm) */}
      {extended.length > 0 && (
        curated.length > 0 ? (
          <details open={isSearching || undefined} className="group mt-8 rounded-ga-lg border border-ga-border bg-ga-surface-2 p-4 sm:p-6">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-ga-h3 text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus [&::-webkit-details-marker]:hidden">
              <span>{labels.extendedSummary.replace('{count}', String(extended.length))}</span>
              <ChevronDown size={18} aria-hidden className="shrink-0 text-ga-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-5 flex flex-col gap-6">
              {renderWorkplaceGroups(extended, 'ext-wp')}
            </div>
          </details>
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            {renderWorkplaceGroups(extended, 'ext-wp')}
          </div>
        )
      )}
    </div>
  )
}
