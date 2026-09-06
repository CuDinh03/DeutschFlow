'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { listClasses, type OrgClass } from '@/lib/orgApi'
import { GaPageHdr, GaBtn, GaCap, TkSearch } from '@/components/ui-v2'
import { CreateClassModal } from './CreateClassModal'
import { CLASSES_PAGE_SIZE } from './pagination'

// ─────────────────────────────────────────────────────────────────────────────
// Lớp học của tổ chức (GaOrgClasses) — teal, class LIST.
// Plumbing: orgApi.listClasses → Page<OrgClass> { id, name, inviteCode, teacherId, createdAt };
//   "Tạo lớp" → POST /org/classes (chọn tên + giáo viên phụ trách, CreateClassModal).
// Option-1: OrgClass has no teacher NAME / LEVEL / student count / avg score → dropped
//   (the proto's level/students/avg columns aren't backed).
// PR-A2 (BF-03, 07/09/2026): phân trang thật thay `listClasses(0, 100)` cứng. Trang đầu PAGE_SIZE
//   lớp, nút "Tải thêm" nối trang kế; đếm "đã tải N/M"; tìm kiếm + huy hiệu "chưa có GV" nói rõ
//   chỉ tính trên phần đã tải. Tìm kiếm phía máy chủ (`q`) thuộc PR-A3 (O-2 backend).
// ─────────────────────────────────────────────────────────────────────────────

const TEAL = '#11888A'
const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')

export default function V2OrgClassesPage() {
  const t = useTranslations('v2.org.classes')
  const tc = useTranslations('v2.common')
  const router = useRouter()
  const [classes, setClasses] = useState<OrgClass[]>([])
  const [total, setTotal] = useState(0)
  const [nextPage, setNextPage] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const page = await listClasses(0, CLASSES_PAGE_SIZE)
      setClasses(page.content ?? [])
      setTotal(page.totalElements ?? (page.content ?? []).length)
      setNextPage(page.last === false ? (page.number ?? 0) + 1 : null)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (nextPage == null || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await listClasses(nextPage, CLASSES_PAGE_SIZE)
      setClasses((prev) => {
        const seen = new Set(prev.map((c) => c.id))
        return [...prev, ...(page.content ?? []).filter((c) => !seen.has(c.id))]
      })
      setTotal(page.totalElements ?? total)
      setNextPage(page.last === false ? (page.number ?? nextPage) + 1 : null)
    } catch (e: unknown) {
      toast.error(`${t('loadMoreError')} ${apiMessage(e)}`)
    } finally {
      setLoadingMore(false)
    }
  }, [nextPage, loadingMore, total, t])

  useEffect(() => { void load() }, [load])

  const rows = useMemo(() => classes.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())), [classes, query])
  const unassigned = classes.filter((c) => c.teacherId == null).length
  const allLoaded = nextPage == null
  const remaining = Math.max(total - classes.length, 0)

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <GaBtn variant="yellow" size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> {t('createClass')}
          </GaBtn>
        }
      />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <GaCap>{allLoaded ? t('count', { count: rows.length }) : t('loadedOf', { loaded: classes.length, total })}</GaCap>
            {unassigned > 0 && (
              <span className="px-2 py-0.5 text-[11px] font-bold" style={{ color: 'var(--ga-red)', background: 'var(--ga-red-soft)' }}>
                {allLoaded ? t('unassignedBadge', { count: unassigned }) : t('unassignedBadgePartial', { count: unassigned, loaded: classes.length })}
              </span>
            )}
          </div>
          <TkSearch value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchPlaceholder')} containerClassName="w-full sm:w-[220px]" />
        </div>
        {!allLoaded && query.trim() !== '' && (
          <p className="ga-ui mb-3 text-ga-caption text-ga-muted">{t('searchHint')}</p>
        )}

        {loading ? (
          <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="ga-shimmer h-[54px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-4 py-8 sm:px-8 lg:px-10 lg:py-[52px] text-center">
            <h2 className="font-ga-display text-[20px] font-medium text-ga-red lg:text-[24px]">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm break-words text-[14px] text-ga-muted">{error} <code className="font-mono text-[12px] text-ga-accent">GET /api/org/classes</code></p>
            <GaBtn variant="primary" onClick={load}>{tc('retry')}</GaBtn>
          </div>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-ga-line px-4 py-8 text-center text-[14px] text-ga-muted sm:px-8 lg:px-10 lg:py-[40px]">
            {classes.length === 0 ? t('emptyOrg') : t('emptySearch')}
          </div>
        ) : (
          <div className="overflow-x-auto border border-ga-line bg-ga-card lg:overflow-visible">
            <div className="grid min-w-[760px] items-center gap-2 border-b border-ga-line bg-ga-bg px-5 py-[11px] lg:min-w-0" style={{ gridTemplateColumns: '1.6fr 150px 130px 120px 84px' }}>
              {[t('colClass'), t('colTeacher'), t('colCode'), t('colCreated'), ''].map((h, i) => (
                <span key={i} className="ga-ui text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted">{h}</span>
              ))}
            </div>
            {rows.map((c, i) => (
              <div key={c.id} className="grid min-w-[760px] items-center gap-2 px-5 py-3.5 transition-colors hover:bg-ga-surface lg:min-w-0" style={{ gridTemplateColumns: '1.6fr 150px 130px 120px 84px', borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center font-ga-display text-[14px] font-medium" style={{ color: TEAL, background: 'var(--ga-teal-soft)' }}>{(c.name[0] ?? 'L').toUpperCase()}</span>
                  <span className="min-w-0 truncate text-[14px] font-semibold text-ga-ink">{c.name}</span>
                </div>
                <span>
                  {c.teacherId == null ? (
                    <span className="px-2 py-0.5 text-[11px] font-bold" style={{ color: 'var(--ga-red)', background: 'var(--ga-red-soft)' }}>{t('unassigned')}</span>
                  ) : (
                    <span className="text-[13px] text-ga-muted">{t('assigned')}</span>
                  )}
                </span>
                <span>{c.inviteCode ? <code className="bg-ga-ink px-2 py-1 text-[11px] font-semibold tracking-[0.06em] text-ga-yellow">{c.inviteCode}</code> : <span className="text-[12px] text-ga-subtle">—</span>}</span>
                <span className="text-[12.5px] text-ga-muted">{fmtDate(c.createdAt)}</span>
                <button type="button" onClick={() => router.push(`/v2/org/classes/${c.id}`)} className="ga-ui inline-flex min-h-[40px] items-center justify-center justify-self-end border border-ga-line px-2.5 py-1.5 text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent lg:min-h-0">
                  {t('detail')}
                </button>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && !allLoaded && (
          <div className="mt-3 flex justify-center">
            <GaBtn variant="ghost" size="sm" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? tc('loading') : t('loadMore', { remaining })}
            </GaBtn>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateClassModal onClose={() => setShowCreate(false)} onCreated={() => void load()} />
      )}
    </div>
  )
}
