'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import api, { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn, GaCap, TkStatStrip } from '@/components/ui-v2'

// Báo cáo phủ phản hồi ngữ pháp (admin) — navy.
// GET /api/admin/reports/grammar-feedback-coverage?days=N
//   → [{ snapshotDate, totalSubmits, totalItems, itemsWithFeedback, coveragePercent }]  (theo ngày)

interface Row {
  snapshotDate: string
  totalSubmits: number
  totalItems: number
  itemsWithFeedback: number
  coveragePercent: number
}
const selectCls = 'ga-ui border border-ga-line bg-ga-bg px-2.5 py-1.5 text-[12px] text-ga-ink outline-none'
function coverageColor(p: number): string {
  if (p >= 80) return 'var(--ga-green)'
  if (p >= 50) return 'var(--ga-orange)'
  return 'var(--ga-red)'
}

export default function V2GrammarFeedbackCoveragePage() {
  const t = useTranslations('v2.adminContent.reportGrammarCoverage')
  const tc = useTranslations('v2.common')
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [days, setDays] = useState(14)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<Row[]>(`/admin/reports/grammar-feedback-coverage?days=${days}`)
      setRows(Array.isArray(data) ? data : [])
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [days])
  useEffect(() => {
    void load()
  }, [load])

  const totals = useMemo(() => {
    const submits = rows.reduce((s, r) => s + Number(r.totalSubmits ?? 0), 0)
    const items = rows.reduce((s, r) => s + Number(r.totalItems ?? 0), 0)
    const withFb = rows.reduce((s, r) => s + Number(r.itemsWithFeedback ?? 0), 0)
    const avg = items > 0 ? Math.round((withFb / items) * 100) : 0
    const latest = rows.length ? Number(rows[rows.length - 1].coveragePercent ?? 0) : 0
    return { submits, items, avg, latest }
  }, [rows])

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <div className="flex items-center gap-2">
            <select className={selectCls} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label={t('rangeAria')}>
              {[7, 14, 30].map((d) => (
                <option key={d} value={d}>
                  {t('rangeDays', { days: d })}
                </option>
              ))}
            </select>
            <GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/admin/reports')}>
              <ArrowLeft size={15} /> {t('backToReports')}
            </GaBtn>
          </div>
        }
      />
      <div className="flex-1 overflow-auto px-10 py-6">
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ga-shimmer h-[48px] border border-ga-line" aria-hidden />
            ))}
          </div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">
              {error} <code className="font-mono text-[12px] text-ga-accent">GET /api/admin/reports/grammar-feedback-coverage</code>
            </p>
            <GaBtn variant="primary" onClick={load}>
              {tc('retry')}
            </GaBtn>
          </div>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">
            {t('emptyRange', { days })}
          </div>
        ) : (
          <>
            <TkStatStrip
              items={[
                { label: t('statSubmits'), value: totals.submits.toLocaleString(), sub: t('statSubmitsSub', { days }) },
                { label: t('statItems'), value: totals.items.toLocaleString(), sub: t('statItemsSub'), color: '#2F6FC9' },
                { label: t('statAvg'), value: `${totals.avg}%`, sub: t('statAvgSub'), color: '#1E9E61' },
                { label: t('statLatest'), value: `${Math.round(totals.latest)}%`, sub: t('statLatestSub'), color: '#E07B39' },
              ]}
            />
            <div className="mb-3.5 mt-[22px]">
              <GaCap>{t('dailyCap')}</GaCap>
            </div>
            <div className="border border-ga-line bg-ga-card">
              {rows
                .slice()
                .reverse()
                .map((r, i) => {
                  const cov = Number(r.coveragePercent ?? 0)
                  return (
                    <div key={r.snapshotDate} className="px-5 py-3.5" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="font-mono text-[12.5px] text-ga-muted">{(r.snapshotDate ?? '').slice(0, 10)}</span>
                        <span className="flex shrink-0 items-center gap-3 text-[12px] text-ga-muted">
                          <span>{t('submitsSuffix', { count: Number(r.totalSubmits ?? 0) })}</span>
                          <span>
                            {t('itemsSuffix', { withFb: Number(r.itemsWithFeedback ?? 0), total: Number(r.totalItems ?? 0) })}
                          </span>
                          <span className="font-bold" style={{ color: coverageColor(cov) }}>
                            {Math.round(cov)}%
                          </span>
                        </span>
                      </div>
                      <span className="block h-1.5 bg-ga-line">
                        <span className="block h-full" style={{ width: `${Math.min(100, Math.max(0, cov))}%`, background: coverageColor(cov) }} />
                      </span>
                    </div>
                  )
                })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
