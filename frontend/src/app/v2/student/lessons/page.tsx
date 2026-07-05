'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, PlayCircle } from 'lucide-react'
import { listMedia, type MediaAsset } from '@/lib/mediaApi'
import { GaPageHdr, GaCap, LoadingState, ErrorBanner, TkBadge } from '@/components/ui-v2'

// Reuse mediaApi.listMedia (/v2/media) — the lesson/media library (image + German narration
// assets). Grid + category filter + pagination. No fabricated content.

const PAGE_SIZE = 24

export default function V2StudentLessonsPage() {
  const t = useTranslations('v2.student.lessons')
  const [items, setItems] = useState<MediaAsset[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(0)
  const [category, setCategory] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listMedia(category, page, PAGE_SIZE)
      .then((res) => {
        if (cancelled) return
        setItems(res.content ?? [])
        setTotalPages(res.totalPages || 1)
      })
      .catch(() => !cancelled && setError(t('loadError')))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [category, page, t])

  const categories = ['ALL', ...Array.from(new Set(items.map((m) => m.category).filter(Boolean)))]

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <div className="flex-1 px-10 py-6">
        {/* Category filter */}
        <div className="mb-5 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCategory(c)
                setPage(0)
              }}
              className={`ga-ui rounded-ga border px-[14px] py-2 text-[12.5px] font-semibold capitalize transition-colors ${
                category === c
                  ? 'border-ga-ink bg-ga-ink text-ga-card'
                  : 'border-ga-border bg-ga-card text-ga-muted hover:border-ga-ink hover:text-ga-ink'
              }`}
            >
              {c === 'ALL' ? t('all') : c.toLowerCase()}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={() => setPage((p) => p)} />
          </div>
        )}

        {loading ? (
          <LoadingState label={t('loading')} />
        ) : items.length === 0 ? (
          <div className="border border-ga-line bg-ga-card py-16 text-center">
            <p className="font-ga-display text-[20px] font-medium text-ga-ink">{t('emptyTitle')}</p>
            <p className="ga-ui mt-2 text-[14px] text-ga-muted">{t('emptyDesc')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((m) => (
                <div key={m.id} className="group overflow-hidden border border-ga-line bg-ga-card">
                  <div className="relative aspect-[4/3] overflow-hidden bg-ga-side-active">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.url}
                      alt={m.altText || m.originalName}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                    <span className="absolute right-2 top-2">
                      <TkBadge tone="neutral" variant="solid">
                        {m.category?.toLowerCase() || t('mediaFallback')}
                      </TkBadge>
                    </span>
                    <span className="absolute inset-0 grid place-items-center bg-ga-ink/0 transition-colors group-hover:bg-ga-ink/20">
                      <PlayCircle size={36} className="text-white opacity-0 transition-opacity group-hover:opacity-90" aria-hidden />
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-[13px] font-semibold text-ga-ink">{m.altText || m.originalName}</p>
                    {m.tag && <p className="ga-ui mt-0.5 truncate text-[11.5px] text-ga-muted">{m.tag}</p>}
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="ga-ui flex items-center gap-1 rounded-ga border border-ga-line px-3 py-1.5 text-[12px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent disabled:opacity-40"
                >
                  <ChevronLeft size={14} aria-hidden /> {t('prev')}
                </button>
                <span className="ga-ui text-[12.5px] text-ga-muted">
                  {t('pageOf', { page: page + 1, total: totalPages })}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="ga-ui flex items-center gap-1 rounded-ga border border-ga-line px-3 py-1.5 text-[12px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent disabled:opacity-40"
                >
                  {t('next')} <ChevronRight size={14} aria-hidden />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
