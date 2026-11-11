'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  listSourceFeeds, pollSourceFeed, setSourceFeedActive,
  type SourceFeed, type SourceUsageClass,
} from '@/lib/adminExamStudioApi'
import { EmptyState, ErrorBanner, GaCap, GaCard, LoadingState, TkBadge } from '@/components/ui-v2'
import { studioMiniBtn } from './ui'

const CLASS_ORDER: SourceUsageClass[] = ['ADAPT', 'FACTS_ONLY', 'TOPIC_ONLY']
const CLASS_TONE: Record<SourceUsageClass, 'green' | 'blue' | 'neutral'> = {
  ADAPT: 'green', FACTS_ONLY: 'blue', TOPIC_ONLY: 'neutral',
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * Tab "Nguồn": danh mục nơi đăng mà dây chuyền tạo bộ đề được dùng, chia ba hạng. Owner bật / tắt từng nguồn và
 * bấm "Đọc bài mới" để máy lấy danh sách bài (không tải bài). Báo đài hạng "gợi ý chủ đề" chỉ được đọc tiêu đề.
 */
export function SourcesTab({ active }: { active: boolean }) {
  const t = useTranslations('v2.adminContent.examStudio.sources')
  const [feeds, setFeeds] = useState<SourceFeed[] | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      setFeeds(await listSourceFeeds())
      setError('')
    } catch (e) {
      setError(apiMessage(e))
    }
  }, [])

  useEffect(() => { if (active) void load() }, [active, load])

  const act = async (id: number, fn: () => Promise<string | void>) => {
    setBusyId(id)
    try {
      const msg = await fn()
      if (msg) toast.success(msg)
      await load()
    } catch (e) {
      toast.error(apiMessage(e))
      await load()
    } finally {
      setBusyId(null)
    }
  }

  if (error) return <ErrorBanner message={error} />
  if (!feeds) return <LoadingState />
  if (feeds.length === 0) return <EmptyState title={t('empty')} />

  return (
    <div className="flex flex-col gap-4">
      <p className="ga-ui text-ga-small text-ga-muted">{t('intro')}</p>
      {CLASS_ORDER.map((cls) => {
        const rows = feeds.filter((f) => f.usageClass === cls)
        if (rows.length === 0) return null
        return (
          <GaCard key={cls} className="flex flex-col gap-3 p-4 sm:p-5">
            <div>
              <GaCap>{t(`class.${cls}.title`)}</GaCap>
              <p className="ga-ui mt-1 text-ga-small text-ga-muted">{t(`class.${cls}.body`)}</p>
            </div>
            <ul className="flex flex-col divide-y divide-ga-line">
              {rows.map((f) => {
                const canPoll = f.listingKind !== 'NONE' && f.active
                return (
                  <li key={f.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="ga-ui min-w-0 flex-1 text-ga-body font-semibold text-ga-ink">
                        {f.publisher}
                        <a href={f.homeUrl} target="_blank" rel="noreferrer noopener" aria-label={t('openSite', { name: f.publisher })}
                          className="ml-1.5 inline-flex align-middle text-ga-muted hover:text-ga-ink">
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      </span>
                      <TkBadge tone={f.active ? CLASS_TONE[cls] : 'neutral'}>{f.active ? t('on') : t('off')}</TkBadge>
                      <TkBadge tone="neutral">{t('counts', { seen: f.seen, used: f.used })}</TkBadge>
                    </div>
                    {f.licenseName && (
                      <p className="ga-ui text-ga-caption text-ga-muted">
                        {t('license')}:{' '}
                        {f.licenseUrl
                          ? <a href={f.licenseUrl} target="_blank" rel="noreferrer noopener" className="underline hover:text-ga-ink">{f.licenseName}</a>
                          : f.licenseName}
                        {f.approvedOn && <> · {t('approvedOn', { date: f.approvedOn })}</>}
                      </p>
                    )}
                    {f.notes && <p className="ga-ui text-ga-caption text-ga-muted">{f.notes}</p>}
                    {f.lastPollNote && (
                      <p className="ga-ui text-ga-caption text-ga-muted">
                        {t('lastPoll', { when: fmtDate(f.lastPolledAt) })}: {f.lastPollNote}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className={studioMiniBtn} disabled={!canPoll || busyId != null}
                        title={f.listingKind === 'NONE' ? t('noListing') : undefined}
                        onClick={() => void act(f.id, async () => (await pollSourceFeed(f.id)).note)}>
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden /> {t('poll')}
                      </button>
                      <button type="button" className={studioMiniBtn} disabled={busyId != null}
                        onClick={() => void act(f.id, async () => { await setSourceFeedActive(f.id, !f.active) })}>
                        {f.active ? t('turnOff') : t('turnOn')}
                      </button>
                      {f.listingKind === 'NONE' && (
                        <span className="ga-ui text-ga-caption text-ga-muted">{t('noListing')}</span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </GaCard>
        )
      })}
    </div>
  )
}
