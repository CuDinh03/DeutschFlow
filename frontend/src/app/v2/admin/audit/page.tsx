'use client'

import * as React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { GaPageHdr, GaBtn, GaCap, GaIcon } from '@/components/ui-v2'
import api from '@/lib/api'

/**
 * admin-audit (/v2/admin/audit) — GaAdminAudit (proto-admin-extra.jsx). Navy.
 * Reuse GET /admin/audit (Page envelope {items,total,page,size}) — admin-only on the backend.
 * Option-1: proto's IP column dropped (audit_logs has no IP). Category = target_type.
 */

interface AuditRow {
  id: number
  eventName: string
  category: string | null
  actorEmail: string | null
  actorRole: string | null
  targetType: string | null
  targetId: string | null
  createdAt: string | null
}

const PAGE_SIZE = 30

// Category key → catalog label key (resolved via t(`cat${key}`)).
const CAT_LABEL_KEY: Record<string, string> = {
  USER: 'catUser',
  VOCABULARY: 'catVocabulary',
  ORG: 'catOrg',
  PLAN: 'catPlan',
  SYSTEM: 'catSystem',
}

export default function AdminAuditPage() {
  const t = useTranslations('v2.adminContent.audit')
  const relTime = (iso: string | null): string => {
    if (!iso) return '—'
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    const m = Math.round(diff / 60000)
    if (m < 1) return t('relJustNow')
    if (m < 60) return t('relMinutes', { count: m })
    const h = Math.round(m / 60)
    if (h < 24) return t('relHours', { count: h })
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  const [rows, setRows] = useState<AuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [cat, setCat] = useState('all')
  const [query, setQuery] = useState('')
  const [seenCats, setSeenCats] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params: Record<string, string | number> = { page: 0, size: PAGE_SIZE }
      if (cat !== 'all') params.cat = cat
      if (query.trim()) params.q = query.trim()
      const { data } = await api.get('/admin/audit', { params })
      const items: AuditRow[] = data?.items ?? []
      setRows(items)
      setTotal(data?.total ?? items.length)
      setSeenCats((prev) => {
        const next = new Set(prev)
        items.forEach((r) => r.category && next.add(r.category))
        return Array.from(next)
      })
    } catch {
      setError(true)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [cat, query])

  useEffect(() => {
    const t = setTimeout(load, query ? 350 : 0)
    return () => clearTimeout(t)
  }, [load, query])

  const filters = useMemo(() => ['all', ...seenCats], [seenCats])

  const exportCsv = () => {
    const head = [t('csvActor'), t('csvRole'), t('csvAction'), t('csvTarget'), t('csvId'), t('csvTime')]
    const lines = rows.map((r) =>
      [r.actorEmail ?? t('system'), r.actorRole ?? '', r.eventName, r.targetType ?? '', r.targetId ?? '', r.createdAt ?? '']
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(','),
    )
    const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'audit-log.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <GaBtn variant="ghost" size="sm" onClick={exportCsv} disabled={!rows.length}>
            <GaIcon name="description" size={15} />{t('exportCsv')}
          </GaBtn>
        }
      />
      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-[40px]">
        <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => {
              const on = cat === f
              return (
                <button
                  key={f}
                  onClick={() => setCat(f)}
                  className={`min-h-[40px] rounded-ga border px-3.5 py-2 text-[12.5px] font-semibold transition-colors lg:min-h-0 ${
                    on ? 'border-ga-ink bg-ga-ink text-ga-bg' : 'border-ga-line bg-ga-card text-ga-muted hover:text-ga-ink'
                  }`}
                >
                  {f === 'all' ? t('filterAll') : CAT_LABEL_KEY[f] ? t(CAT_LABEL_KEY[f]) : f}
                </button>
              )
            })}
          </div>
          <div className="flex w-full min-w-0 items-center gap-2 rounded-ga border border-ga-line bg-ga-card px-3 py-2 sm:w-auto">
            <GaIcon name="search" size={15} className="shrink-0 text-ga-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="ga-ui w-full min-w-0 border-none bg-transparent text-[13px] text-ga-ink outline-none placeholder:text-ga-subtle sm:w-[240px] sm:max-w-[50vw]"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-ga-line bg-ga-card lg:overflow-visible">
          <div className="grid min-w-[620px] grid-cols-[1.2fr_1.4fr_1.4fr_130px] gap-2 border-b border-ga-line bg-ga-surface px-5 py-3 lg:min-w-0">
            {[t('colActor'), t('colAction'), t('colTarget'), t('colTime')].map((h) => (
              <GaCap key={h} className="text-[10px]">{h}</GaCap>
            ))}
          </div>

          {loading && (
            <div className="min-w-[620px] px-5 py-[30px] text-center text-[13px] text-ga-muted lg:min-w-0">{t('loading')}</div>
          )}
          {error && !loading && (
            <div className="min-w-[620px] px-5 py-[30px] text-center text-[13px] text-ga-red lg:min-w-0">
              {t('loadError')} <button onClick={load} className="font-semibold underline">{t('retry')}</button>
            </div>
          )}
          {!loading && !error && rows.length === 0 && (
            <div className="min-w-[620px] px-5 py-[30px] text-center text-[13px] text-ga-muted lg:min-w-0">{t('empty')}</div>
          )}

          {!loading && !error && rows.map((r, i) => {
            const sys = !r.actorEmail
            return (
              <div
                key={r.id}
                className={`grid min-w-[620px] grid-cols-[1.2fr_1.4fr_1.4fr_130px] items-center gap-2 px-5 py-3 lg:min-w-0 ${i ? 'border-t border-ga-line' : ''}`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-ga-pill text-[11px] font-bold ${
                      sys ? 'bg-ga-surface text-ga-muted' : 'bg-ga-ink text-ga-yellow'
                    }`}
                  >
                    {(r.actorEmail ?? t('system'))[0].toUpperCase()}
                  </span>
                  <span className="truncate text-[13px] font-semibold text-ga-ink" title={r.actorEmail ?? t('system')}>
                    {r.actorEmail ?? t('system')}
                  </span>
                </div>
                <span className="break-words text-[13.5px] text-ga-ink">{r.eventName}</span>
                <span className="break-words text-[13px] text-ga-muted">
                  {r.targetType}{r.targetId ? ` · ${r.targetId}` : ''}
                </span>
                <span className="text-[12.5px] text-ga-muted">{relTime(r.createdAt)}</span>
              </div>
            )
          })}
        </div>

        {!loading && !error && total > rows.length && (
          <p className="ga-ui mt-3 text-[12.5px] text-ga-muted">
            {t('footerCount', { shown: rows.length, total: total.toLocaleString('vi-VN') })}
          </p>
        )}
      </div>
    </div>
  )
}
