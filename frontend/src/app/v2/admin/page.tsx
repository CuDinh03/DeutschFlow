'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight } from 'lucide-react'
import api from '@/lib/api'
import { AdStatStrip, type AdStatCell, ErrorBanner, LoadingState, GaPageHdr } from '@/components/ui-v2'
import { GaSection, GaBars, GaDonut, GaLegend, fmtVnd, nfVN } from '../analyticsShared'

type OverviewUser = { id: number; role?: string; isActive?: boolean; isactive?: boolean; usageLast30Days?: number }
type ChartRow = { period: string; netVnd: number; subscribers: number }
type RevenueResponse = { totals?: { netVnd: number }; chartData?: ChartRow[] }
type DailyCostRow = { costUsd: number }
type DailyCostDto = { data?: DailyCostRow[] }

const ROLE_COLOR: Record<string, string> = { STUDENT: '#2F6FC9', TEACHER: '#7C56C8', ADMIN: '#DA291C' }

export default function V2AdminOverviewPage() {
  const t = useTranslations('v2.adminOps.overview')
  const [users, setUsers] = useState<OverviewUser[]>([])
  const [revenue, setRevenue] = useState<RevenueResponse | null>(null)
  const [daily, setDaily] = useState<DailyCostDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.allSettled([
      api.get<OverviewUser[]>('/admin/users'),
      api.get<RevenueResponse>('/admin/analytics/revenue', { params: { page: 0, size: 1 } }),
      api.get<DailyCostDto>('/admin/reports/ai-cost-daily', { params: { days: 30 } }),
    ])
      .then(([u, r, d]) => {
        if (u.status === 'fulfilled') setUsers(u.value.data ?? [])
        else setError(t('loadError'))
        if (r.status === 'fulfilled') setRevenue(r.value.data ?? null)
        if (d.status === 'fulfilled') setDaily(d.value.data ?? null)
      })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
    const r = (u.role ?? 'STUDENT').toUpperCase()
    acc[r] = (acc[r] ?? 0) + 1
    return acc
  }, {})
  const roleSegs = (['STUDENT', 'TEACHER', 'ADMIN'] as const)
    .filter((r) => (roleCounts[r] ?? 0) > 0)
    .map((r) => ({ label: t(`roles.${r}`), value: roleCounts[r], color: ROLE_COLOR[r] ?? '#76716A' }))

  const chart = revenue?.chartData ?? []
  const latest = chart.length > 0 ? chart[chart.length - 1] : null
  const mrr = latest?.netVnd ?? revenue?.totals?.netVnd ?? 0
  const aiCost = (daily?.data ?? []).reduce((s, r) => s + (Number(r.costUsd) || 0), 0)
  const activeUsers = users.filter((u) => (Number(u.usageLast30Days) || 0) > 0).length
  const pausedUsers = users.filter((u) => u.isActive === false || u.isactive === false).length

  const cells: AdStatCell[] = [
    { label: t('stats.totalUsers'), value: nfVN.format(users.length), color: '#27406B' },
    { label: t('stats.mrr'), value: fmtVnd(mrr), color: '#1E9E61', sub: latest?.period },
    { label: t('stats.aiCost'), value: `$${aiCost.toFixed(2)}`, color: '#E07B39', sub: t('stats.aiCostSub') },
    { label: t('stats.aiActivity'), value: nfVN.format(activeUsers), color: '#7C56C8', sub: t('stats.aiActivitySub') },
  ]

  const todo: { text: string; href: string }[] = [
    ...(pausedUsers > 0 ? [{ text: t('todo.pausedAccounts', { count: pausedUsers }), href: '/v2/admin/users' }] : []),
    { text: t('todo.reviewVocabImages'), href: '/v2/admin/vocabulary' },
    { text: t('todo.checkPendingOrgs'), href: '/v2/admin/organizations' },
    { text: t('todo.trackAiBudget'), href: '/v2/admin/tokens' },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        )}
        {loading ? (
          <LoadingState label={t('loading')} />
        ) : (
          <div className="space-y-[22px]">
            <AdStatStrip cells={cells} />

            <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-[2fr_1fr]">
              <GaSection title={t('subscribersByPeriod')} right={<span className="ga-ui text-[12.5px] text-ga-muted">{t('recentPeriods', { count: chart.length })}</span>}>
                {chart.length > 0 ? (
                  <GaBars data={chart.map((r) => ({ label: r.period, value: r.subscribers }))} color="#27406B" height={180} />
                ) : (
                  <p className="ga-ui py-10 text-center text-[14px] text-ga-muted">{t('noPeriodData')}</p>
                )}
              </GaSection>

              <GaSection title={t('roleDistribution')}>
                {roleSegs.length > 0 ? (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
                    <GaDonut segments={roleSegs} />
                    <div className="min-w-0 flex-1">
                      <GaLegend items={roleSegs.map((s) => ({ ...s, display: nfVN.format(s.value) }))} />
                    </div>
                  </div>
                ) : (
                  <p className="ga-ui py-10 text-center text-[14px] text-ga-muted">{t('noUsers')}</p>
                )}
              </GaSection>
            </div>

            <GaSection title={t('todoTitle')}>
              <div className="-my-1">
                {todo.map((item, i) => (
                  <Link
                    key={i}
                    href={item.href}
                    className="group flex items-center gap-3 border-t border-ga-border py-3 first:border-0"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 bg-ga-yellow" />
                    <span className="ga-ui min-w-0 text-[14px] text-ga-ink">{item.text}</span>
                    <ArrowRight
                      size={16}
                      className="ml-auto shrink-0 text-ga-subtle transition-colors group-hover:text-ga-accent"
                      aria-hidden
                    />
                  </Link>
                ))}
              </div>
            </GaSection>
          </div>
        )}
      </div>
    </div>
  )
}
