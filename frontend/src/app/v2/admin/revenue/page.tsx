'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { AdStatStrip, type AdStatCell, ErrorBanner, LoadingState } from '@/components/ui-v2'
import { GaPageHdr } from '@/components/ui-v2'
import { GaSection, GaBars, GaDonut, GaLegend, GA_CHART, fmtVnd, fmtDateTime, nfVN } from '../../analyticsShared'

// ── Real shape of GET /admin/analytics/revenue (AdminAnalyticsController) ────────
interface RevenueOverview {
  grossVnd: number
  netVnd: number
  marginPct: number
}
interface ChartRow {
  period: string
  grossVnd: number
  netVnd: number
  storeFeeVnd: number
  apiCostVnd: number
  marginPct: number
  subscribers: number
}
interface Transaction {
  id: number
  email: string
  planCode: string
  amount: number
  status: string
  providerTransactionId: string
  createdAt: string
}
interface TransactionPage {
  content: Transaction[]
  totalPages: number
  totalElements: number
}
interface RevenueResponse {
  // Backend (AdminRevenueAnalyticsResponse) serialises this as `totals`, not `overview`.
  totals: RevenueOverview
  chartData: ChartRow[]
  transactions: TransactionPage
}

const PAGE_SIZE = 20

function StatusDot({ status }: { status: string }) {
  const s = status.toUpperCase()
  const color = s === 'COMPLETED' ? 'var(--ga-green)' : s === 'FAILED' ? 'var(--ga-red)' : 'var(--ga-orange)'
  return (
    <span className="ga-ui inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color }}>
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {s}
    </span>
  )
}

export default function V2AdminRevenuePage() {
  const t = useTranslations('v2.adminOps.revenue')
  const [data, setData] = useState<RevenueResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  const fetchData = useCallback(async (pageNum: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<RevenueResponse>('/admin/analytics/revenue', {
        params: { page: pageNum, size: PAGE_SIZE },
      })
      setData(res.data)
      setPage(pageNum)
    } catch {
      setError(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchData(0)
  }, [fetchData])

  const overview = data?.totals
  const chart = data?.chartData ?? []
  const tx = data?.transactions
  const latest = chart.length > 0 ? chart[chart.length - 1] : null
  const mrr = latest?.netVnd ?? overview?.netVnd ?? 0

  const cells: AdStatCell[] = [
    { label: t('stats.mrr'), value: fmtVnd(mrr), color: '#1E9E61', sub: latest ? latest.period : '—' },
    { label: t('stats.arr'), value: fmtVnd(mrr * 12), color: '#2F6FC9', sub: t('stats.arrSub') },
    {
      label: t('stats.subscribers'),
      value: latest ? nfVN.format(latest.subscribers) : '—',
      color: '#7C56C8',
      sub: t('stats.subscribersSub'),
    },
    {
      label: t('stats.margin'),
      value: overview ? `${overview.marginPct.toFixed(1)}%` : '—',
      color: overview && overview.marginPct >= 50 ? '#1E9E61' : '#E07B39',
      sub: t('stats.marginSub'),
    },
  ]

  // Cost breakdown of latest period (real) — replaces proto's plan-mix donut (no plan-breakdown EP).
  const breakdownSegs = latest
    ? [
        { label: t('segNet'), value: Math.max(0, latest.netVnd), color: GA_CHART[4] },
        { label: t('segStoreFee'), value: Math.max(0, latest.storeFeeVnd), color: GA_CHART[3] },
        { label: t('segAiCost'), value: Math.max(0, latest.apiCostVnd), color: GA_CHART[7] },
      ].filter((s) => s.value > 0)
    : []

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 px-10 py-6">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={() => fetchData(page)} />
          </div>
        )}

        {loading && !data ? (
          <LoadingState label={t('loading')} />
        ) : (
          <div className="space-y-[22px]">
            <AdStatStrip cells={cells} />

            <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-[2fr_1fr]">
              <GaSection title={t('netByPeriod')}>
                {chart.length > 0 ? (
                  <GaBars
                    data={chart.map((r) => ({ label: r.period, value: r.netVnd }))}
                    color="#1E9E61"
                    height={180}
                    valueFmt={fmtVnd}
                  />
                ) : (
                  <p className="ga-ui py-10 text-center text-[14px] text-ga-muted">{t('noPeriodData')}</p>
                )}
              </GaSection>

              <GaSection title={t('latestBreakdown')}>
                {breakdownSegs.length > 0 ? (
                  <div className="flex items-center gap-5">
                    <GaDonut segments={breakdownSegs} />
                    <div className="flex-1">
                      <GaLegend items={breakdownSegs.map((s) => ({ ...s, display: fmtVnd(s.value) }))} />
                    </div>
                  </div>
                ) : (
                  <p className="ga-ui py-10 text-center text-[14px] text-ga-muted">{t('noPeriodData')}</p>
                )}
              </GaSection>
            </div>

            <GaSection
              title={t('recentTransactions')}
              right={
                tx ? (
                  <span className="ga-ui text-[12.5px] text-ga-muted">{t('txCount', { count: nfVN.format(tx.totalElements) })}</span>
                ) : null
              }
              bodyClassName="p-0"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-ga-border">
                      {[
                        { key: 'colId', label: t('colId') },
                        { key: 'colEmail', label: t('colEmail') },
                        { key: 'colPlan', label: t('colPlan') },
                        { key: 'colAmount', label: t('colAmount') },
                        { key: 'colStatus', label: t('colStatus') },
                        { key: 'colTxId', label: t('colTxId') },
                        { key: 'colDate', label: t('colDate') },
                      ].map((h) => (
                        <th
                          key={h.key}
                          className="ga-ui px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ga-muted"
                        >
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!tx || tx.content.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="ga-ui px-5 py-10 text-center text-[14px] text-ga-muted">
                          {t('noTransactions')}
                        </td>
                      </tr>
                    ) : (
                      tx.content.map((r) => (
                        <tr key={r.id} className="border-b border-ga-border last:border-0 hover:bg-ga-surface">
                          <td className="px-5 py-3 text-[12px] tabular-nums text-ga-subtle">{r.id}</td>
                          <td className="max-w-[200px] truncate px-5 py-3 text-[13.5px] font-medium text-ga-ink">
                            {r.email}
                          </td>
                          <td className="px-5 py-3">
                            <span className="ga-ui rounded-ga border border-ga-line px-2 py-0.5 text-[11px] font-semibold text-ga-muted">
                              {r.planCode || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-[13.5px] font-semibold text-ga-ink">{fmtVnd(r.amount)}</td>
                          <td className="px-5 py-3">
                            <StatusDot status={r.status} />
                          </td>
                          <td className="max-w-[150px] truncate px-5 py-3 font-mono text-[11px] text-ga-subtle">
                            {r.providerTransactionId || '—'}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-[12.5px] text-ga-muted">
                            {fmtDateTime(r.createdAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {tx && tx.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-ga-border px-5 py-3">
                  <p className="ga-ui text-[12.5px] text-ga-muted">
                    {t('pageInfo', { page: page + 1, total: tx.totalPages })}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page === 0 || loading}
                      onClick={() => fetchData(page - 1)}
                      className="ga-ui flex items-center gap-1 rounded-ga border border-ga-line px-3 py-1.5 text-[12px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent disabled:opacity-40"
                    >
                      <ChevronLeft size={14} aria-hidden /> {t('prev')}
                    </button>
                    <button
                      type="button"
                      disabled={page >= tx.totalPages - 1 || loading}
                      onClick={() => fetchData(page + 1)}
                      className="ga-ui flex items-center gap-1 rounded-ga border border-ga-line px-3 py-1.5 text-[12px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent disabled:opacity-40"
                    >
                      {t('next')} <ChevronRight size={14} aria-hidden />
                    </button>
                  </div>
                </div>
              )}
            </GaSection>
          </div>
        )}
      </div>
    </div>
  )
}
