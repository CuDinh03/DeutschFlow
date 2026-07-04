'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import { listClasses, type OrgClass } from '@/lib/orgApi'
import { GaPageHdr, GaBtn, GaCap, TkSearch } from '@/components/ui-v2'
import { CreateClassModal } from './CreateClassModal'

// ─────────────────────────────────────────────────────────────────────────────
// Lớp học của tổ chức (GaOrgClasses) — teal, class LIST.
// Plumbing: orgApi.listClasses → Page<OrgClass> { id, name, inviteCode, teacherId, createdAt };
//   "Tạo lớp" → POST /org/classes (chọn tên + giáo viên phụ trách, CreateClassModal).
// Option-1: OrgClass has no teacher NAME / LEVEL / student count / avg score → dropped
//   (the proto's level/students/avg columns aren't backed).
// ─────────────────────────────────────────────────────────────────────────────

const TEAL = '#11888A'
const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')

export default function V2OrgClassesPage() {
  const t = useTranslations('v2.org.classes')
  const tc = useTranslations('v2.common')
  const router = useRouter()
  const [classes, setClasses] = useState<OrgClass[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const page = await listClasses(0, 100)
      setClasses(page.content ?? [])
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const rows = useMemo(() => classes.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())), [classes, query])
  const unassigned = classes.filter((c) => c.teacherId == null).length

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

      <div className="flex-1 overflow-auto px-10 py-6">
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <GaCap>{t('count', { count: rows.length })}</GaCap>
            {unassigned > 0 && (
              <span className="px-2 py-0.5 text-[11px] font-bold" style={{ color: 'var(--ga-red)', background: 'var(--ga-red-soft)' }}>
                {t('unassignedBadge', { count: unassigned })}
              </span>
            )}
          </div>
          <TkSearch value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchPlaceholder')} containerClassName="w-[220px]" />
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="ga-shimmer h-[54px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error} <code className="font-mono text-[12px] text-ga-accent">GET /api/org/classes</code></p>
            <GaBtn variant="primary" onClick={load}>{tc('retry')}</GaBtn>
          </div>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">
            {classes.length === 0 ? t('emptyOrg') : t('emptySearch')}
          </div>
        ) : (
          <div className="border border-ga-line bg-ga-card">
            <div className="grid items-center gap-2 border-b border-ga-line bg-ga-bg px-5 py-[11px]" style={{ gridTemplateColumns: '1.6fr 150px 130px 120px 84px' }}>
              {[t('colClass'), t('colTeacher'), t('colCode'), t('colCreated'), ''].map((h, i) => (
                <span key={i} className="ga-ui text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted">{h}</span>
              ))}
            </div>
            {rows.map((c, i) => (
              <div key={c.id} className="grid items-center gap-2 px-5 py-3.5 transition-colors hover:bg-ga-surface" style={{ gridTemplateColumns: '1.6fr 150px 130px 120px 84px', borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center font-ga-display text-[14px] font-medium" style={{ color: TEAL, background: 'var(--ga-teal-soft)' }}>{(c.name[0] ?? 'L').toUpperCase()}</span>
                  <span className="truncate text-[14px] font-semibold text-ga-ink">{c.name}</span>
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
                <button type="button" onClick={() => router.push(`/v2/org/classes/${c.id}`)} className="ga-ui justify-self-end border border-ga-line px-2.5 py-1.5 text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent">
                  {t('detail')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateClassModal onClose={() => setShowCreate(false)} onCreated={() => void load()} />
      )}
    </div>
  )
}
