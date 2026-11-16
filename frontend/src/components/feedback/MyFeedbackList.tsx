'use client'

import { useTranslations } from 'next-intl'
import { MessageSquarePlus } from 'lucide-react'
import { GaGlyph, EmptyState, ErrorBanner, SkeletonRow } from '@/components/ui-v2'
import { useFmt } from '@/lib/i18n/useFmt'
import { cn } from '@/lib/utils'
import type { FeedbackStatus, MyFeedback } from '@/lib/feedbackApi'
import { STATUS_PILL, TYPE_GLYPH, statusKey } from './feedbackVisual'

const STEP_INDEX: Record<FeedbackStatus, number> = { NEW: 0, READ: 1, IN_PROGRESS: 2, SHIPPED: 3, DECLINED: -1 }

interface MyFeedbackListProps {
  items: MyFeedback[]
  loading: boolean
  error: boolean
  onRetry: () => void
  highlightId: number | null
}

export function MyFeedbackList({ items, loading, error, onRetry, highlightId }: MyFeedbackListProps) {
  const t = useTranslations('v2.account.feedback')
  const fmt = useFmt()

  return (
    <section aria-labelledby="fb-mine" className="rounded-ga border border-ga-line bg-ga-card">
      <header className="flex items-center gap-3 border-b border-ga-line px-5 py-4">
        <h2 id="fb-mine" className="text-ga-body font-semibold text-ga-ink">{t('mineTitle')}</h2>
        {!loading && !error && (
          <span className="ml-auto text-ga-caption text-ga-muted">{t('mineCount', { n: items.length })}</span>
        )}
      </header>

      {loading && (
        <div className="space-y-3 p-5" aria-busy="true">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}
      {!loading && error && (
        <div className="p-5">
          <ErrorBanner message={t('mineLoadError')} onRetry={onRetry} retryLabel={t('retry')} />
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <EmptyState variant="neutral" icon={MessageSquarePlus} title={t('mineEmpty')} className="py-10" />
      )}

      {!loading && !error && items.length > 0 && (
        <ol className="divide-y divide-ga-line">
          {items.map((item) => {
            const glyph = TYPE_GLYPH[item.type]
            const step = STEP_INDEX[item.status]
            const shippedLabel = item.type === 'BUG' ? t('steps.fixed') : t('steps.shipped')
            return (
              <li
                key={item.id}
                className={cn(
                  'grid grid-cols-[auto_1fr] gap-3 px-5 py-4',
                  item.id === highlightId && 'bg-ga-yellow-soft',
                )}
              >
                <GaGlyph icon={glyph.icon} tone={item.status === 'SHIPPED' ? 'green' : glyph.tone} size="sm" />
                <div className="min-w-0">
                  {/* Chữ thuần: text node, không bao giờ HTML (NFR-02). */}
                  <h3 className="break-words text-ga-small font-semibold leading-snug text-ga-ink">{item.title}</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-ga-caption text-ga-muted">
                    <span className={cn('inline-flex items-center rounded-ga-pill px-2 py-0.5 font-semibold', STATUS_PILL[item.status])}>
                      {t(`status.${statusKey(item.status, item.type)}`)}
                    </span>
                    <span>{t(`areas.${item.area}`)}</span>
                    {item.satisfaction != null && <span>{t('satisfactionShort', { n: item.satisfaction })}</span>}
                    {item.attachmentCount > 0 && <span>{t('attachments', { n: item.attachmentCount })}</span>}
                    <span>{fmt.date(item.createdAt)}</span>
                  </p>

                  {step >= 0 && (
                    <div className="mt-2.5" aria-hidden="true">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map((i) => (
                          <span
                            key={i}
                            className={cn(
                              'h-1 flex-1 rounded-ga-pill',
                              i > step ? 'bg-ga-side-active' : item.status === 'SHIPPED' ? 'bg-ga-green' : 'bg-ga-ink',
                            )}
                          />
                        ))}
                      </div>
                      <div className="mt-1 flex justify-between text-ga-caption text-ga-subtle">
                        <span>{t('steps.sent')}</span>
                        <span>{t('steps.read')}</span>
                        <span>{t('steps.doing')}</span>
                        <span>{shippedLabel}</span>
                      </div>
                    </div>
                  )}

                  {item.replies.map((reply) => (
                    <div
                      key={reply.id}
                      className={cn(
                        'mt-2.5 border-l-[3px] bg-ga-surface px-3 py-2 text-ga-caption text-ga-ink',
                        item.status === 'SHIPPED' ? 'border-ga-green' : 'border-ga-navy',
                      )}
                    >
                      <p className="mb-0.5 text-ga-caption font-semibold text-ga-navy">
                        {t('teamReply', { date: fmt.date(reply.createdAt) })}
                      </p>
                      <p className="whitespace-pre-line break-words">{reply.body}</p>
                    </div>
                  ))}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
