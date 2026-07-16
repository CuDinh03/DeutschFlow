'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Clock, ExternalLink, Newspaper, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { GaPageHdr, EmptyState, ErrorBanner, LoadingState, TkBadge, TkSearch } from '@/components/ui-v2'

/**
 * /v2/student/news — feed báo Đức (Galerie shell).
 *
 * Port của /news: CÙNG endpoint (GET /news → NewsController), cùng bộ lọc tìm kiếm client-side
 * (title + summary, không phân biệt hoa thường), cùng nút "Làm mới" gọi lại API, cùng cách mở bài
 * ở tab mới. Chỉ đổi vỏ + i18n hoá chuỗi (v1 hard-code tiếng Việt).
 *
 * PHẠM VI VAI TRÒ: /news ở v1 là "learner-shared" (STUDENT + TEACHER + ADMIN đều vào được —
 * xem learnerSharedPaths trong middleware.ts). Route mới nằm dưới /v2/student/* nên mặc định
 * chỉ STUDENT lọt cổng; middleware đã được bổ sung ngoại lệ để giữ nguyên quyền truy cập cũ.
 */

interface NewsItem {
  title: string
  summary: string
  url: string
  publishedAt: string
  sourceName: string
  sourceType: 'DW_LEARN' | 'DW_VI' | 'TAGESSCHAU' | 'SPIEGEL'
}

/**
 * Bảng màu theo nguồn của v1 ánh xạ sang tone Galerie (TkBadge không có tone `orange`, nên
 * SPIEGEL — vốn cam ở v1 — dùng `yellow`/gold, sắc gần nhất trong bảng màu Galerie).
 */
type SourceTone = 'blue' | 'violet' | 'yellow' | 'green' | 'neutral'

const SOURCE_TONE: Record<string, SourceTone> = {
  DW_LEARN: 'blue',
  TAGESSCHAU: 'violet',
  SPIEGEL: 'yellow',
  DW_VI: 'green',
}

const DATE_LOCALE: Record<string, string> = { vi: 'vi-VN', en: 'en-US', de: 'de-DE' }

export default function V2StudentNewsPage() {
  const t = useTranslations('v2.student.news')
  const locale = useLocale()

  const [loading, setLoading] = useState(true)
  const [news, setNews] = useState<NewsItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const fetchNews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<NewsItem[]>('/news')
      setNews(data ?? [])
    } catch {
      setError(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void fetchNews()
  }, [fetchNews])

  const needle = query.trim().toLowerCase()
  const filtered = needle
    ? news.filter(
        (item) =>
          item.title.toLowerCase().includes(needle) || item.summary.toLowerCase().includes(needle),
      )
    : news

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 px-10 py-6">
        <div className="mx-auto max-w-4xl space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <TkSearch
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
            />
            <button
              type="button"
              onClick={() => void fetchNews()}
              className="ga-ui inline-flex shrink-0 items-center justify-center gap-2 rounded-ga border border-ga-line bg-ga-card px-5 py-2.5 text-[13px] font-semibold text-ga-ink transition-colors hover:bg-ga-surface"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden />
              {t('refresh')}
            </button>
          </div>

          {loading ? (
            <LoadingState label={t('loading')} />
          ) : error ? (
            <ErrorBanner variant="page" title={t('errorTitle')} message={error} onRetry={() => void fetchNews()} />
          ) : filtered.length === 0 ? (
            <EmptyState icon="newspaper" title={t('emptyTitle')} description={t('emptyDesc')} />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filtered.map((item, idx) => (
                <a
                  key={`${item.url}-${idx}`}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-full flex-col rounded-ga border border-ga-line bg-ga-card p-5 transition-shadow duration-150 hover:shadow-ga-card-hover"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <TkBadge tone={SOURCE_TONE[item.sourceType] ?? 'neutral'}>{item.sourceName}</TkBadge>
                    <span className="ga-ui flex shrink-0 items-center gap-1.5 text-[12px] text-ga-subtle">
                      <Clock size={12} aria-hidden />
                      {new Date(item.publishedAt).toLocaleDateString(DATE_LOCALE[locale] ?? 'vi-VN')}
                    </span>
                  </div>

                  <h2 className="mb-2 line-clamp-2 font-ga-display text-[19px] font-medium leading-snug text-ga-ink transition-colors group-hover:text-ga-accent">
                    {item.title}
                  </h2>

                  <p className="ga-ui mb-5 line-clamp-3 flex-1 text-[13.5px] leading-relaxed text-ga-muted">
                    {item.summary}
                  </p>

                  <span className="ga-ui mt-auto flex items-center justify-between border-t border-ga-border pt-3.5 text-[13px] font-semibold text-ga-accent">
                    {t('readFull')}
                    <ExternalLink
                      size={15}
                      className="text-ga-subtle transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </a>
              ))}
            </div>
          )}

          {!loading && !error && news.length > 0 && (
            <p className="ga-ui flex items-center justify-center gap-1.5 pt-1 text-[12.5px] text-ga-subtle">
              <Newspaper size={13} aria-hidden />
              {t('countLine', { count: filtered.length })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
