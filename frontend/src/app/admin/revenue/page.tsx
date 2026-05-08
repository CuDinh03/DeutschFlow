'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import AdminShell from '@/components/admin/AdminShell'
import useAdminData from '@/hooks/useAdminData'
import api from '@/lib/api'
import {
  aggregateRevenueByQuarter,
  aggregateRevenueYearly,
  buildMonthlyRevenueVnd,
  type RevenueMonthRow,
} from '@/lib/adminDashboardMock'

type Overview = { studentCount: number }

function fmtVndVi(n: number) {
  return n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
}

export default function AdminRevenuePage() {
  const t = useTranslations('adminRevenue')
  const locale = useLocale()
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly')

  const { data: ov, loading, error, refreshing, lastSyncedAt, reload } = useAdminData<Overview | null>({
    initialData: null,
    errorMessage: t('error'),
    fetchData: async () => {
      const res = await api.get('/admin/reports/overview')
      return res.data as Overview
    },
    intervalMs: 120_000,
  })

  const monthly = useMemo(
    () => buildMonthlyRevenueVnd(ov?.studentCount ?? 160, locale === 'vi' ? 'vi-VN' : locale === 'de' ? 'de-DE' : 'en-US'),
    [ov?.studentCount, locale],
  )

  const chartRows = useMemo(() => {
    if (period === 'monthly') return monthly.map((r) => ({ ...r, grossM: r.grossVnd / 1e6, profitM: r.netVnd / 1e6 }))
    if (period === 'quarterly') {
      return aggregateRevenueByQuarter(monthly).map((r) => ({ ...r, grossM: r.grossVnd / 1e6, profitM: r.netVnd / 1e6 }))
    }
    return aggregateRevenueYearly(monthly).map((r) => ({ ...r, grossM: r.grossVnd / 1e6, profitM: r.netVnd / 1e6 }))
  }, [period, monthly])

  const totals = useMemo(() => {
    const gross = monthly.reduce((s, r) => s + r.grossVnd, 0)
    const net = monthly.reduce((s, r) => s + r.netVnd, 0)
    const margin = gross > 0 ? ((net / gross) * 100).toFixed(1) : '0'
    return { gross, net, margin }
  }, [monthly])

  const tableRows: RevenueMonthRow[] = useMemo(() => {
    if (period === 'monthly') return monthly
    if (period === 'quarterly') return aggregateRevenueByQuarter(monthly)
    return aggregateRevenueYearly(monthly)
  }, [period, monthly])

  if (loading) {
    return (
      <AdminShell
        title={t('title')}
        subtitle={t('subtitle')}
        activeNav="revenue"
        onRefresh={() => reload({ silent: true })}
      >
        <p className="text-[#94A3B8] text-sm">{t('loading')}</p>
      </AdminShell>
    )
  }

  return (
    <AdminShell
      title={t('title')}
      subtitle={t('subtitle')}
      activeNav="revenue"
      error={error}
      refreshing={refreshing}
      onRefresh={() => reload({ silent: true })}
      lastSyncedAt={lastSyncedAt}
    >
      <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-[10px] px-3 py-2">{t('disclaimer')}</p>
      <p className="text-[11px] text-[#64748B]">
        {t('scaleHint', { students: ov?.studentCount ?? '—' })}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        {[
          { label: t('kpiGross'), val: fmtVndVi(totals.gross), color: '#121212', bg: '#f5f5f5' },
          { label: t('kpiNet'), val: fmtVndVi(totals.net), color: '#10b981', bg: '#d1fae5' },
          { label: t('kpiMargin'), val: `${totals.margin}%`, color: '#7c3aed', bg: '#fef2f2' },
        ].map(({ label, val, color, bg }) => (
          <div
            key={label}
            className="rounded-[14px] p-4 text-center border border-[#E2E8F0]"
            style={{ backgroundColor: bg }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color }}>
              {label}
            </p>
            <p className="text-[#0F172A] font-extrabold text-lg">{val}</p>
          </div>
        ))}
      </div>

      <div className="section-card rounded-[14px] border border-[#E2E8F0] bg-white p-5 mt-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-[#0F172A]">{t('chartTitle')}</h3>
            <p className="text-xs text-[#64748B]">{t('chartSub')}</p>
          </div>
          <div className="flex rounded-[8px] overflow-hidden border border-[#E2E8F0]">
            {(['monthly', 'quarterly', 'yearly'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  period === p ? 'bg-[#121212] text-white' : 'bg-white text-[#64748B] hover:bg-[#F8FAFC]'
                }`}
              >
                {p === 'monthly' ? t('periodMonthly') : p === 'quarterly' ? t('periodQuarterly') : t('periodYearly')}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#121212" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#121212" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#64748B', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}M`}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${(Number(value) * 1e6).toLocaleString('vi-VN')} ₫`,
                  name === 'grossM' ? t('legendGross') : t('legendNet'),
                ]}
                labelFormatter={(l) => String(l)}
                contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0' }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="grossM"
                name={t('legendGross')}
                stroke="#121212"
                strokeWidth={2}
                fill="url(#revG)"
              />
              <Area
                type="monotone"
                dataKey="profitM"
                name={t('legendNet')}
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#profG)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="section-card rounded-[14px] border border-[#E2E8F0] bg-white overflow-hidden mt-4">
        <div className="px-4 py-3 border-b border-[#E2E8F0]">
          <h3 className="font-bold text-[#0F172A]">{t('tableTitle')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F8FAFC] text-left text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                <th className="px-3 py-2">{t('colPeriod')}</th>
                <th className="px-3 py-2">{t('colSubs')}</th>
                <th className="px-3 py-2">{t('colGross')}</th>
                <th className="px-3 py-2">{t('colStore')}</th>
                <th className="px-3 py-2">{t('colApi')}</th>
                <th className="px-3 py-2">{t('colNet')}</th>
                <th className="px-3 py-2">{t('colMargin')}</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => (
                <tr key={row.key} className={i > 0 ? 'border-t border-[#E2E8F0]' : ''}>
                  <td className="px-3 py-2 font-semibold text-[#0F172A]">{row.label}</td>
                  <td className="px-3 py-2 text-[#64748B]">{row.subscribers}</td>
                  <td className="px-3 py-2 text-[#121212] font-medium">{fmtVndVi(row.grossVnd)}</td>
                  <td className="px-3 py-2 text-red-600">−{fmtVndVi(row.storeFeeVnd)}</td>
                  <td className="px-3 py-2 text-amber-700">−{fmtVndVi(row.apiCostVnd)}</td>
                  <td className="px-3 py-2 text-emerald-700 font-semibold">{fmtVndVi(row.netVnd)}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex rounded-full bg-emerald-50 text-emerald-800 px-2 py-0.5 text-xs font-bold">
                      {row.marginPct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  )
}
