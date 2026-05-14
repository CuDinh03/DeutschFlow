'use client'

import { useState, useEffect as import_react_useEffect } from 'react'
import { useLocale } from 'next-intl'
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
import {
  TrendingUp,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'
import useAdminData from '@/hooks/useAdminData'
import api from '@/lib/api'

export type TransactionDto = {
  id: number
  email: string
  planCode: string
  amount: number
  status: string
  providerTransactionId: string | null
  createdAt: string
}

export type RevenueChartRow = {
  period: string
  subscribers: number
  grossVnd: number
  netVnd: number
  storeFeeVnd: number
  apiCostVnd: number
  marginPct: number
}

export type OverviewTotals = {
  grossVnd: number
  netVnd: number
  marginPct: number
}

export type RevenueData = {
  totals: OverviewTotals
  chartData: RevenueChartRow[]
  transactions: {
    content: TransactionDto[]
    totalPages: number
    totalElements: number
  }
}

function fmtVndVi(n: number) {
  if (n == null) return '0 ₫'
  return n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
}

function fmtDate(iso: string, locale: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString(locale.replace('_', '-'), {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export default function AdminRevenuePage() {
  const locale = useLocale()
  
  const [page, setPage] = useState(0)
  const size = 15

  const { data, loading, error, refreshing, lastSyncedAt, reload } = useAdminData<RevenueData | null>({
    initialData: null,
    errorMessage: 'Lỗi tải dữ liệu doanh thu',
    fetchData: async () => {
      const res = await api.get('/admin/analytics/revenue', { params: { page, size } })
      return res.data as RevenueData
    },
    intervalMs: 120_000,
  })

  // Re-fetch when page changes
  import_react_useEffect(() => {
    reload({ silent: true })
  }, [page, reload])

  if (loading && !data) {
    return (
      <AdminShell
        title="Thống kê Doanh thu"
        subtitle="Báo cáo tài chính & lịch sử giao dịch"
        activeNav="revenue"
        onRefresh={() => reload({ silent: true })}
      >
        <div className="flex flex-col items-center justify-center py-20 opacity-50">
          <svg className="animate-spin h-8 w-8 text-violet-500 mb-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <p className="text-[#94A3B8] text-sm">Đang tải dữ liệu...</p>
        </div>
      </AdminShell>
    )
  }

  const chartRows = (data?.chartData ?? []).map(r => ({
    ...r,
    grossM: r.grossVnd / 1e6,
    profitM: r.netVnd / 1e6,
  }))

  const totals = data?.totals ?? { grossVnd: 0, netVnd: 0, marginPct: 0 }
  const txPage = data?.transactions

  return (
    <AdminShell
      title="Thống kê Doanh thu"
      subtitle="Báo cáo tài chính & lịch sử giao dịch"
      activeNav="revenue"
      error={error}
      refreshing={refreshing}
      onRefresh={() => reload({ silent: true })}
      lastSyncedAt={lastSyncedAt}
    >
      {/* KPI Cards (Bento-style Glassmorphism) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
        <div className="relative overflow-hidden rounded-[20px] p-6 border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-gradient-to-br from-white to-slate-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                <CreditCard size={14} className="text-violet-600" />
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">TỔNG DOANH THU (GROSS)</p>
            </div>
            <TrendingUp size={16} className="text-violet-500" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{fmtVndVi(totals.grossVnd)}</p>
          <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl"></div>
        </div>

        <div className="relative overflow-hidden rounded-[20px] p-6 border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <TrendingUp size={14} className="text-emerald-600" />
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">LỢI NHUẬN RÒNG (NET)</p>
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{fmtVndVi(totals.netVnd)}</p>
          <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl"></div>
        </div>

        <div className="relative overflow-hidden rounded-[20px] p-6 border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-gradient-to-br from-white to-amber-50/30">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">BIÊN LỢI NHUẬN</p>
            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Lợi nhuận
            </span>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{totals.marginPct}%</p>
          <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl"></div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="rounded-[20px] border border-slate-200/60 shadow-[0_4px_20px_rgb(0,0,0,0.02)] bg-white p-6 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Biểu đồ Tăng trưởng</h3>
            <p className="text-xs text-slate-500 mt-1">
              Phân tích doanh thu & lợi nhuận thực tế (Đã trừ phí Store 15% & API)
            </p>
          </div>
        </div>
        
        <div className="h-[320px] w-full">
          {chartRows.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">Chưa có dữ liệu thanh toán</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartRows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="period" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis
                  tick={{ fill: '#64748B', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}M`}
                  dx={-10}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${(Number(value) * 1e6).toLocaleString('vi-VN')} ₫`,
                    name,
                  ]}
                  labelFormatter={(l) => `Tháng: ${l}`}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Area
                  type="monotone"
                  dataKey="grossM"
                  name="Tổng doanh thu"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  fill="url(#colorGross)"
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="profitM"
                  name="Lợi nhuận ròng"
                  stroke="#10b981"
                  strokeWidth={3}
                  fill="url(#colorNet)"
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-[20px] border border-slate-200/60 shadow-[0_4px_20px_rgb(0,0,0,0.02)] bg-white overflow-hidden mt-6">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Giao dịch gần đây</h3>
          <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
            {txPage?.totalElements ?? 0} giao dịch
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4 whitespace-nowrap">Thời gian</th>
                <th className="px-6 py-4">Học viên</th>
                <th className="px-6 py-4">Gói</th>
                <th className="px-6 py-4 text-right">Số tiền</th>
                <th className="px-6 py-4">Mã MoMo</th>
                <th className="px-6 py-4 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(txPage?.content ?? []).map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-xs">
                    {fmtDate(tx.createdAt, locale)}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-800">
                    {tx.email}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex font-bold text-[10px] px-2 py-0.5 rounded-full border ${
                      tx.planCode === 'ULTRA' ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                      tx.planCode === 'PRO' ? 'bg-violet-100 text-violet-700 border-violet-200' :
                      'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {tx.planCode}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">
                    {fmtVndVi(tx.amount)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                      {tx.providerTransactionId || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {tx.status === 'SUCCESS' ? (
                      <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                        <CheckCircle2 size={12} /> Thành công
                      </div>
                    ) : tx.status === 'PENDING' ? (
                      <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                        <Clock size={12} /> Đang chờ
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                        <XCircle size={12} /> Thất bại
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {(txPage?.content == null || txPage.content.length === 0) && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Không có giao dịch nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(txPage?.totalPages ?? 0) > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Trang <span className="font-bold text-slate-900">{page + 1}</span> / {txPage!.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(txPage!.totalPages - 1, p + 1))}
                disabled={page >= txPage!.totalPages - 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  )
}
