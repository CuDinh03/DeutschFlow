'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import api from '@/lib/api'
import { AdStatStrip, type AdStatCell, ErrorBanner, LoadingState, GaPageHdr } from '@/components/ui-v2'
import { GaSection, GaBars, GaDonut, GaLegend, fmtVnd, nfVN } from '../analyticsShared'

type OverviewUser = { id: number; role?: string; isActive?: boolean; isactive?: boolean; usageLast30Days?: number }
type ChartRow = { period: string; netVnd: number; subscribers: number }
type RevenueResponse = { overview?: { netVnd: number }; chartData?: ChartRow[] }
type DailyCostRow = { costUsd: number }
type DailyCostDto = { data?: DailyCostRow[] }

const ROLE_COLOR: Record<string, string> = { STUDENT: '#2F6FC9', TEACHER: '#7C56C8', ADMIN: '#DA291C' }
const ROLE_LABEL: Record<string, string> = { STUDENT: 'Học viên', TEACHER: 'Giáo viên', ADMIN: 'Quản trị' }

export default function V2AdminOverviewPage() {
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
        else setError('Không thể tải dữ liệu tổng quan.')
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
  const roleSegs = ['STUDENT', 'TEACHER', 'ADMIN']
    .filter((r) => (roleCounts[r] ?? 0) > 0)
    .map((r) => ({ label: ROLE_LABEL[r] ?? r, value: roleCounts[r], color: ROLE_COLOR[r] ?? '#76716A' }))

  const chart = revenue?.chartData ?? []
  const latest = chart.length > 0 ? chart[chart.length - 1] : null
  const mrr = latest?.netVnd ?? revenue?.overview?.netVnd ?? 0
  const aiCost = (daily?.data ?? []).reduce((s, r) => s + (Number(r.costUsd) || 0), 0)
  const activeUsers = users.filter((u) => (Number(u.usageLast30Days) || 0) > 0).length
  const pausedUsers = users.filter((u) => u.isActive === false || u.isactive === false).length

  const cells: AdStatCell[] = [
    { label: 'Tổng người dùng', value: nfVN.format(users.length), color: '#27406B' },
    { label: 'Doanh thu (MRR)', value: fmtVnd(mrr), color: '#1E9E61', sub: latest?.period },
    { label: 'Chi phí AI (30 ngày)', value: `$${aiCost.toFixed(2)}`, color: '#E07B39', sub: 'ước tính ledger' },
    { label: 'Hoạt động AI', value: nfVN.format(activeUsers), color: '#7C56C8', sub: 'dùng AI 30 ngày' },
  ]

  const todo: { text: string; href: string }[] = [
    ...(pausedUsers > 0 ? [{ text: `${pausedUsers} tài khoản đang tạm dừng — xem lại`, href: '/v2/admin/users' }] : []),
    { text: 'Duyệt ảnh từ vựng còn thiếu', href: '/v2/admin/vocabulary' },
    { text: 'Kiểm tra tổ chức B2B chờ kích hoạt', href: '/v2/admin/organizations' },
    { text: 'Theo dõi ngân sách chi phí AI', href: '/v2/admin/tokens' },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <GaPageHdr accent title="Bảng điều khiển quản trị" subtitle="Tổng quan sức khỏe nền tảng DeutschFlow" />
      <div className="flex-1 px-10 py-6">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        )}
        {loading ? (
          <LoadingState label="Đang tải tổng quan…" />
        ) : (
          <div className="space-y-[22px]">
            <AdStatStrip cells={cells} />

            <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-[2fr_1fr]">
              <GaSection title="Thuê bao trả phí theo kỳ" right={<span className="ga-ui text-[12.5px] text-ga-muted">{chart.length} kỳ gần nhất</span>}>
                {chart.length > 0 ? (
                  <GaBars data={chart.map((r) => ({ label: r.period, value: r.subscribers }))} color="#27406B" height={180} />
                ) : (
                  <p className="ga-ui py-10 text-center text-[14px] text-ga-muted">Chưa có dữ liệu kỳ.</p>
                )}
              </GaSection>

              <GaSection title="Phân bổ theo vai trò">
                {roleSegs.length > 0 ? (
                  <div className="flex items-center gap-5">
                    <GaDonut segments={roleSegs} />
                    <div className="flex-1">
                      <GaLegend items={roleSegs.map((s) => ({ ...s, display: nfVN.format(s.value) }))} />
                    </div>
                  </div>
                ) : (
                  <p className="ga-ui py-10 text-center text-[14px] text-ga-muted">Chưa có người dùng.</p>
                )}
              </GaSection>
            </div>

            <GaSection title="Cần xử lý">
              <div className="-my-1">
                {todo.map((item, i) => (
                  <Link
                    key={i}
                    href={item.href}
                    className="group flex items-center gap-3 border-t border-ga-border py-3 first:border-0"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 bg-ga-yellow" />
                    <span className="ga-ui text-[14px] text-ga-ink">{item.text}</span>
                    <ArrowRight
                      size={16}
                      className="ml-auto text-ga-subtle transition-colors group-hover:text-ga-accent"
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
