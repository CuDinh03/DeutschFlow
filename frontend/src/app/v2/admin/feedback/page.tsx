'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MessageSquarePlus } from 'lucide-react'
import { toast } from 'sonner'
import {
  GaPageHdr, GaBtn, GaGlyph, EmptyState, ErrorBanner, FilterChips, LoadingState, TkSearch,
} from '@/components/ui-v2'
import { AdminFeedbackDetail } from '@/components/feedback/AdminFeedbackDetail'
import { STATUS_PILL, TYPE_GLYPH } from '@/components/feedback/feedbackVisual'
import { apiMessage } from '@/lib/api'
import { useFmt } from '@/lib/i18n/useFmt'
import { cn } from '@/lib/utils'
import {
  AREAS_BY_AUDIENCE, FEEDBACK_TYPES, adminFeedbackApi,
  type AdminFeedbackFilter, type AdminFeedbackPage, type AdminFeedbackSort, type FeedbackArea,
  type FeedbackStatus, type FeedbackType,
} from '@/lib/feedbackApi'

const STATUSES: FeedbackStatus[] = ['NEW', 'READ', 'IN_PROGRESS', 'SHIPPED', 'DECLINED']
const ALL_AREAS: FeedbackArea[] = Array.from(new Set([
  ...AREAS_BY_AUDIENCE.STUDENT, ...AREAS_BY_AUDIENCE.TEACHER, ...AREAS_BY_AUDIENCE.ORG,
]))
const SELECT = 'ga-ui min-h-[40px] rounded-ga border border-ga-border bg-ga-card px-3 text-ga-caption font-semibold text-ga-ink lg:min-h-0 lg:py-2'

/**
 * /v2/admin/feedback — hộp góp ý (đặc tả gopycapnhat GĐ1: FBK-15, 17…23, 28). Mặc định mở bộ lọc
 * Chưa đọc; góp ý điểm thấp đứng đầu (server sắp). Chọn một dòng: chi tiết bên phải, tự đánh dấu đã đọc.
 */
export default function AdminFeedbackPage() {
  const t = useTranslations('v2.adminOps.feedback')
  const fmt = useFmt()
  const [status, setStatus] = useState<FeedbackStatus | 'ALL'>('NEW')
  const [type, setType] = useState<FeedbackType | ''>('')
  const [area, setArea] = useState<FeedbackArea | ''>('')
  const [role, setRole] = useState<'' | 'STUDENT' | 'TEACHER' | 'ORG'>('')
  const [sort, setSort] = useState<AdminFeedbackSort>('NEWEST')
  const [query, setQuery] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<AdminFeedbackPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [checked, setChecked] = useState<Set<number>>(new Set())

  // Gõ tìm kiếm: chờ 350 ms rồi mới gọi API.
  useEffect(() => {
    const id = setTimeout(() => { setQ(query.trim()); setPage(0) }, 350)
    return () => clearTimeout(id)
  }, [query])

  const filter: AdminFeedbackFilter = useMemo(() => ({
    status: status === 'ALL' ? undefined : status,
    type: type || undefined,
    area: area || undefined,
    role: role || undefined,
    q: q || undefined,
    sort,
    page,
  }), [status, type, area, role, q, sort, page])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminFeedbackApi.list(filter)
      setData(res.data)
      setChecked(new Set())
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { void load() }, [load])

  const onChanged = useCallback((id: number, patch: { status?: FeedbackStatus; replyCount?: number }) => {
    setData((prev) => prev && {
      ...prev,
      items: prev.items.map((it) => (it.id === id
        ? { ...it, ...(patch.status && { status: patch.status }), ...(patch.replyCount != null && { replyCount: patch.replyCount }) }
        : it)),
    })
  }, [])

  const toggle = (id: number) => setChecked((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const markCheckedRead = async () => {
    try {
      await adminFeedbackApi.markManyRead(Array.from(checked))
      await load()
    } catch (e) {
      toast.error(apiMessage(e))
    }
  }

  const resetPage = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0) }
  const counts = data?.statusCounts
  const total = counts ? STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0) : undefined
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <TkSearch
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search')}
            aria-label={t('search')}
            containerClassName="w-full sm:w-72"
          />
          <FilterChips
            ariaLabel={t('statusField')}
            value={status}
            onChange={resetPage(setStatus)}
            options={[
              { value: 'ALL' as const, label: t('allStatuses'), count: total },
              ...STATUSES.map((s) => ({ value: s, label: t(`status.${s}`), count: counts?.[s] })),
            ]}
          />
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select aria-label={t('typeFilter')} value={type} onChange={(e) => resetPage(setType)(e.target.value as FeedbackType | '')} className={SELECT}>
            <option value="">{t('allTypes')}</option>
            {FEEDBACK_TYPES.map((v) => <option key={v} value={v}>{t(`types.${v}`)}</option>)}
          </select>
          <select aria-label={t('areaFilter')} value={area} onChange={(e) => resetPage(setArea)(e.target.value as FeedbackArea | '')} className={SELECT}>
            <option value="">{t('allAreas')}</option>
            {ALL_AREAS.map((v) => <option key={v} value={v}>{t(`areas.${v}`)}</option>)}
          </select>
          <select aria-label={t('roleFilter')} value={role} onChange={(e) => resetPage(setRole)(e.target.value as typeof role)} className={SELECT}>
            <option value="">{t('allRoles')}</option>
            {(['STUDENT', 'TEACHER', 'ORG'] as const).map((v) => <option key={v} value={v}>{t(`roles.${v}`)}</option>)}
          </select>
          <select aria-label={t('sortLabel')} value={sort} onChange={(e) => resetPage(setSort)(e.target.value as AdminFeedbackSort)} className={SELECT}>
            {(['NEWEST', 'LOW_SCORE'] as const).map((v) => <option key={v} value={v}>{t(`sort.${v}`)}</option>)}
          </select>
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-ga border border-ga-line bg-ga-card">
            {checked.size > 0 && (
              <div className="flex flex-wrap items-center gap-2.5 bg-ga-navy px-4 py-2.5 text-ga-caption text-ga-card">
                <span>{t('selected', { n: checked.size })}</span>
                <GaBtn size="sm" variant="ghost" onClick={markCheckedRead}>{t('markRead')}</GaBtn>
                <button type="button" onClick={() => setChecked(new Set())} className="ml-auto underline-offset-2 hover:underline">
                  {t('clear')}
                </button>
              </div>
            )}

            {loading && <LoadingState variant="skeleton" rows={5} className="p-4" />}
            {!loading && error && <div className="p-4"><ErrorBanner message={t('loadError')} onRetry={load} retryLabel={t('retry')} /></div>}
            {!loading && !error && data && data.items.length === 0 && (
              <EmptyState variant="neutral" icon={MessageSquarePlus} title={t('empty')} className="py-12" />
            )}

            {!loading && !error && data && data.items.length > 0 && (
              <ul className="divide-y divide-ga-line">
                {data.items.map((item) => {
                  const glyph = TYPE_GLYPH[item.type]
                  const selected = item.id === selectedId
                  const roleLabel = t.has(`roles.${item.authorRole}`) ? t(`roles.${item.authorRole}`) : item.authorRole
                  return (
                    <li
                      key={item.id}
                      className={cn(
                        'grid grid-cols-[20px_minmax(0,1fr)] gap-3 px-4 py-3.5 sm:grid-cols-[20px_28px_minmax(0,1fr)_auto]',
                        selected ? 'bg-ga-navy-soft shadow-ga-selected-bar' : 'hover:bg-ga-surface',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked.has(item.id)}
                        onChange={() => toggle(item.id)}
                        aria-label={item.title}
                        className="mt-1 h-4 w-4 accent-ga-navy"
                      />
                      <span className="hidden sm:block"><GaGlyph icon={glyph.icon} tone={glyph.tone} size="sm" /></span>
                      <button type="button" onClick={() => setSelectedId(item.id)} className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus">
                        <span className="flex items-center gap-2 text-ga-small font-semibold leading-snug text-ga-ink">
                          {item.status === 'NEW' && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ga-blue" aria-hidden />}
                          <span className="break-words">{item.title}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-ga-caption text-ga-muted">{item.excerpt}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-ga-caption text-ga-muted">
                          <span className={cn('rounded-ga-pill px-2 py-0.5 font-semibold', STATUS_PILL[item.status])}>{t(`status.${item.status}`)}</span>
                          {item.lowScore && <span className="rounded-ga-pill bg-ga-red-soft px-2 py-0.5 font-semibold text-ga-red">{t('lowScore')}</span>}
                          <span>{t(`areas.${item.area}`)}</span>
                          <span>{[item.authorName, roleLabel, item.authorLevel].filter(Boolean).join(' · ')}</span>
                        </span>
                      </button>
                      <span className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-ga-caption text-ga-muted sm:col-start-auto sm:flex-col sm:items-end">
                        <span>{item.satisfaction != null ? t('score', { n: item.satisfaction }) : t('noScore')}</span>
                        {item.replyCount > 0 && <span>{t('replies', { n: item.replyCount })}</span>}
                        {item.attachmentCount > 0 && <span>{t('images', { n: item.attachmentCount })}</span>}
                        <span>{fmt.date(item.createdAt)}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}

            {data && data.total > data.size && (
              <div className="flex flex-wrap items-center gap-2 border-t border-ga-line px-4 py-3 text-ga-caption text-ga-muted">
                <span>{t('pageOf', { page: page + 1, pages, total: data.total })}</span>
                <GaBtn className="ml-auto" size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{t('prev')}</GaBtn>
                <GaBtn size="sm" variant="ghost" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>{t('next')}</GaBtn>
              </div>
            )}
          </section>

          <div className="xl:sticky xl:top-4">
            {selectedId != null ? (
              <AdminFeedbackDetail key={selectedId} id={selectedId} onChanged={onChanged} />
            ) : (
              <div className="rounded-ga border border-dashed border-ga-line-strong bg-ga-card px-5 py-10 text-center text-ga-small text-ga-muted">
                {t('pickOne')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
