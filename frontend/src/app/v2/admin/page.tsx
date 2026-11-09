'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight } from 'lucide-react'
import api from '@/lib/api'
import { adminUsersApi, type UserStats } from '@/lib/adminUsersApi'
import { GaStatStrip, type GaStatItem, ErrorBanner, LoadingState, GaPageHdr } from '@/components/ui-v2'
import { GaSection, GaBars, GaDonut, GaLegend, GA_CHART } from '../analyticsShared'
import { useFmt } from '@/lib/i18n/useFmt'

type ChartRow = { period: string; netVnd: number; subscribers: number; b2cGrossVnd?: number; b2bGrossVnd?: number }
type RevenueResponse = { totals?: { netVnd: number }; chartData?: ChartRow[] }
type DailyCostRow = { costUsd: number }
type DailyCostDto = { data?: DailyCostRow[] }

const ROLE_COLOR: Record<string, string> = { STUDENT: '#2F6FC9', TEACHER: '#7C56C8', ADMIN: '#DA291C' }
// 09/11/2026: MANAGER/OWNER là vai nền tảng thật (User.Role) — trước đây donut bỏ sót họ. Màu lấy từ
// bảng GA_CHART (teal, gold) thay vì thêm hex mới.
ROLE_COLOR.MANAGER = GA_CHART[2]
ROLE_COLOR.OWNER = GA_CHART[6]
const ROLE_ORDER = ['STUDENT', 'TEACHER', 'MANAGER', 'OWNER', 'ADMIN'] as const

export default function V2AdminOverviewPage() {
  const t = useTranslations('v2.adminOps.overview')
  const fmt = useFmt()
  // KPI người dùng đếm trên cả bảng ở server (GET /admin/users/stats) — không tải cả danh sách nữa.
  const [stats, setStats] = useState<UserStats | null>(null)
  const [revenue, setRevenue] = useState<RevenueResponse | null>(null)
  const [daily, setDaily] = useState<DailyCostDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.allSettled([
      adminUsersApi.stats(),
      api.get<RevenueResponse>('/admin/analytics/revenue', { params: { page: 0, size: 1 } }),
      api.get<DailyCostDto>('/admin/reports/ai-cost-daily', { params: { days: 30 } }),
    ])
      .then(([u, r, d]) => {
        if (u.status === 'fulfilled') setStats(u.value.data ?? null)
        else setError(t('loadError'))
        if (r.status === 'fulfilled') setRevenue(r.value.data ?? null)
        if (d.status === 'fulfilled') setDaily(d.value.data ?? null)
      })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const roleCounts: Record<string, number> = stats?.byRole ?? {}
  const roleSegs = ROLE_ORDER
    .filter((r) => (roleCounts[r] ?? 0) > 0)
    .map((r) => ({ label: t(`roles.${r}`), value: roleCounts[r], color: ROLE_COLOR[r] ?? '#76716A' }))

  const chart = revenue?.chartData ?? []
  const latest = chart.length > 0 ? chart[chart.length - 1] : null
  // KHÔNG phải MRR (ADMIN-08 / AC-ADMIN-13): đây là phần còn lại sau phí thanh toán và chi phí AI
  // của kỳ gần nhất. Âm = kỳ lỗ → tô cam như trang Doanh thu.
  const netRemaining = latest?.netVnd ?? revenue?.totals?.netVnd ?? 0
  const aiCost = (daily?.data ?? []).reduce((s, r) => s + (Number(r.costUsd) || 0), 0)
  const activeUsers = stats?.aiActive30d ?? 0
  const pausedUsers = stats?.locked ?? 0

  const cells: GaStatItem[] = [
    { label: t('stats.totalUsers'), value: fmt.num(stats?.total ?? 0), tone: 'navy' },
    {
      label: t('stats.netRemaining'),
      value: fmt.vndCompact(netRemaining),
      tone: netRemaining < 0 ? 'orange' : 'green',
      // Từ GĐ2 backend: gross = B2C + B2B (hoá đơn trung tâm đã thu), phí theo nhà cung cấp.
      sub: latest?.period
        ? t('stats.netRemainingSplit', {
            period: latest.period,
            b2c: fmt.vndCompact(latest.b2cGrossVnd ?? 0),
            b2b: fmt.vndCompact(latest.b2bGrossVnd ?? 0),
          })
        : undefined,
    },
    { label: t('stats.aiCost'), value: `$${aiCost.toFixed(2)}`, tone: 'orange', sub: t('stats.aiCostSub') },
    { label: t('stats.aiActivity'), value: fmt.num(activeUsers), tone: 'violet', sub: t('stats.aiActivitySub') },
  ]

  const todo: { text: string; href: string }[] = [
    ...(pausedUsers > 0
      ? [{ text: t('todo.pausedAccounts', { count: pausedUsers }), href: '/v2/admin/users?status=locked' }]
      : []),
    { text: t('todo.reviewVocabImages'), href: '/v2/admin/vocabulary' },
    { text: t('todo.checkPendingOrgs'), href: '/v2/admin/organizations' },
    { text: t('todo.trackAiBudget'), href: '/v2/admin/ai-usage' },
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
            <GaStatStrip items={cells} />

            <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-[2fr_1fr]">
              <GaSection title={t('successTxByPeriod')} right={<span className="ga-ui text-[12.5px] text-ga-muted">{t('recentPeriods', { count: chart.length })}</span>}>
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
                      <GaLegend items={roleSegs.map((s) => ({ ...s, display: fmt.num(s.value) }))} />
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
