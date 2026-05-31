'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Wallet, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'

// ─── Palette (mirrors other admin pages) ──────────────────────────────────────
const P = {
  navy: '#121212',
  navyLt: '#EBF2FA',
  blue: '#2D9CDB',
  blueLt: '#EBF5FB',
  red: '#EB5757',
  redLt: '#FDEAEA',
  green: '#27AE60',
  greenLt: '#E8F8F0',
  yellow: '#FFCD00',
  yellowLt: '#FFF8E1',
  purple: '#9B51E0',
  purpleLt: '#F4EDFF',
  orange: '#F2994A',
  orangeLt: '#FEF3E8',
  bg: '#F5F5F5',
  white: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
}

// ─── Types ────────────────────────────────────────────────────────────────────
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

interface AdminRevenueAnalyticsResponse {
  overview: RevenueOverview
  chartData: ChartRow[]
  transactions: TransactionPage
}

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmtVnd(n: number): string {
  if (n >= 10_000_000) {
    return `${(n / 1_000_000).toFixed(1)}tr ₫`
  }
  return `${Math.round(n / 1_000)}k ₫`
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase()
  const color =
    s === 'COMPLETED' ? P.green
    : s === 'FAILED' ? P.red
    : P.orange
  const bg =
    s === 'COMPLETED' ? P.greenLt
    : s === 'FAILED' ? P.redLt
    : P.orangeLt

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ background: bg, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
      {s}
    </span>
  )
}

// ─── Loading spinner ──────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw size={24} className="animate-spin" style={{ color: P.muted }} />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminRevenuePage() {
  const [data, setData] = useState<AdminRevenueAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async (pageNum: number, silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/analytics/revenue?page=${pageNum}&size=20`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: AdminRevenueAnalyticsResponse = await res.json()
      setData(json)
      setPage(pageNum)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData(0)
  }, [])

  const overview = data?.overview
  const chartData = data?.chartData ?? []
  const transactions = data?.transactions

  const overviewCards = overview
    ? [
        {
          label: 'Gross revenue',
          value: fmtVnd(overview.grossVnd),
          sub: `Net: ${fmtVnd(overview.netVnd)}`,
          positive: true,
          icon: <Wallet size={16} />,
          color: P.blue,
          bg: P.blueLt,
        },
        {
          label: 'Net revenue',
          value: fmtVnd(overview.netVnd),
          sub: `${overview.marginPct.toFixed(1)}% margin`,
          positive: true,
          icon: <TrendingUp size={16} />,
          color: P.green,
          bg: P.greenLt,
        },
        {
          label: 'Margin',
          value: `${overview.marginPct.toFixed(1)}%`,
          sub: `Gross – store – API costs`,
          positive: overview.marginPct >= 50,
          icon: <BarChart3 size={16} />,
          color: overview.marginPct >= 50 ? P.green : P.orange,
          bg: overview.marginPct >= 50 ? P.greenLt : P.orangeLt,
        },
        {
          label: 'Total subscribers',
          value: chartData.length > 0
            ? chartData[chartData.length - 1].subscribers.toLocaleString('vi-VN')
            : '—',
          sub: chartData.length > 0 ? `Latest: ${chartData[chartData.length - 1].period}` : '',
          positive: true,
          icon: <TrendingUp size={16} />,
          color: P.purple,
          bg: P.purpleLt,
        },
      ]
    : []

  return (
    <AdminShell
      title="Revenue"
      subtitle="Tổng quan doanh thu, tăng trưởng và hiệu quả thương mại của nền tảng."
      activeNav="revenue"
      error={error ?? undefined}
      refreshing={refreshing}
      onRefresh={() => fetchData(page, true)}
    >
      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-5">
          {/* ── Header banner ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-[16px] p-5 border border-[#E2E8F0] shadow-sm">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#94A3B8]">Revenue dashboard</p>
                <h2 className="text-xl font-extrabold text-[#0F172A] mt-1">Doanh thu theo thời gian thực</h2>
                <p className="text-sm text-[#64748B] mt-1">
                  Theo dõi các chỉ số thương mại chính và trạng thái tăng trưởng để hỗ trợ ra quyết định nhanh.
                </p>
              </div>
              <div
                className="inline-flex items-center gap-2 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-2 text-sm font-semibold text-[#0F172A]"
              >
                <Wallet size={16} /> Revenue snapshot
              </div>
            </div>
          </div>

          {/* ── Overview cards ────────────────────────────────────────────── */}
          {overview && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {overviewCards.map((card, index) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  className="rounded-[16px] bg-white border border-[#E2E8F0] p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-[#64748B]">{card.label}</p>
                    <span style={{ color: card.color }}>{card.icon}</span>
                  </div>
                  <p className="mt-3 text-2xl font-extrabold text-[#0F172A]">{card.value}</p>
                  <p className="mt-2 text-xs font-medium" style={{ color: card.positive ? P.green : P.red }}>
                    {card.sub}
                  </p>
                </motion.div>
              ))}
            </div>
          )}

          {/* ── Monthly chart table ───────────────────────────────────────── */}
          {chartData.length > 0 && (
            <div className="rounded-[16px] bg-white border border-[#E2E8F0] p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#0F172A]">Doanh thu theo tháng</h3>
                  <p className="text-sm text-[#64748B]">Chi tiết từng kỳ — gross, net, store fee, API cost, margin và subscribers.</p>
                </div>
                <BarChart3 size={18} className="text-[#0F172A]" />
              </div>

              <div className="overflow-x-auto rounded-[12px] border" style={{ borderColor: P.border }}>
                <table className="w-full text-xs text-left">
                  <thead style={{ background: P.navyLt }}>
                    <tr>
                      {['Kỳ', 'Subscribers', 'Gross', 'Net', 'Store Fee', 'API Cost', 'Margin'].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider"
                          style={{ color: P.navy }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: P.border }}>
                    {chartData.map((row, i) => (
                      <tr
                        key={row.period}
                        style={{ background: i % 2 === 0 ? P.white : '#FAFCFF' }}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-bold" style={{ color: P.text }}>{row.period}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: P.purple }}>
                          {row.subscribers.toLocaleString('vi-VN')}
                        </td>
                        <td className="px-4 py-3 font-semibold" style={{ color: P.blue }}>{fmtVnd(row.grossVnd)}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: P.green }}>{fmtVnd(row.netVnd)}</td>
                        <td className="px-4 py-3" style={{ color: P.muted }}>{fmtVnd(row.storeFeeVnd)}</td>
                        <td className="px-4 py-3" style={{ color: P.muted }}>{fmtVnd(row.apiCostVnd)}</td>
                        <td className="px-4 py-3">
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{
                              background: row.marginPct >= 50 ? P.greenLt : P.orangeLt,
                              color: row.marginPct >= 50 ? P.green : P.orange,
                            }}
                          >
                            {row.marginPct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Transactions table ────────────────────────────────────────── */}
          {transactions && (
            <div className="rounded-[16px] bg-white border border-[#E2E8F0] p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-1">
                <div>
                  <h3 className="text-base font-extrabold text-[#0F172A]">Giao dịch gần đây</h3>
                  <p className="text-sm text-[#64748B]">
                    {transactions.totalElements.toLocaleString('vi-VN')} giao dịch tổng cộng
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-[12px] border mt-4" style={{ borderColor: P.border }}>
                <table className="w-full text-xs text-left">
                  <thead style={{ background: P.navyLt }}>
                    <tr>
                      {['#', 'Email', 'Plan', 'Amount', 'Status', 'Provider TX ID', 'Ngày'].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider"
                          style={{ color: P.navy }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: P.border }}>
                    {transactions.content.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center italic" style={{ color: P.muted }}>
                          Không có giao dịch.
                        </td>
                      </tr>
                    ) : (
                      transactions.content.map((tx, i) => (
                        <tr
                          key={tx.id}
                          style={{ background: i % 2 === 0 ? P.white : '#FAFCFF' }}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-4 py-3 font-mono text-[10px]" style={{ color: P.muted }}>
                            {tx.id}
                          </td>
                          <td className="px-4 py-3 max-w-[180px] truncate font-medium" style={{ color: P.text }}>
                            {tx.email}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ background: P.navyLt, color: P.navy }}
                            >
                              {tx.planCode}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold" style={{ color: P.blue }}>
                            {fmtVnd(tx.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={tx.status} />
                          </td>
                          <td className="px-4 py-3 font-mono text-[10px] max-w-[160px] truncate" style={{ color: P.muted }}>
                            {tx.providerTransactionId || '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: P.muted }}>
                            {fmtDate(tx.createdAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ──────────────────────────────────────────── */}
              {transactions.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: P.border }}>
                  <p className="text-xs font-medium" style={{ color: P.muted }}>
                    Trang {page + 1} / {transactions.totalPages} &nbsp;·&nbsp;
                    {transactions.totalElements.toLocaleString('vi-VN')} giao dịch
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={page === 0 || refreshing}
                      onClick={() => fetchData(page - 1)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-[10px] text-xs font-bold disabled:opacity-40 transition-colors hover:bg-slate-100"
                      style={{ border: `1.5px solid ${P.border}`, color: P.navy }}
                    >
                      <ChevronLeft size={13} /> Trước
                    </button>
                    <button
                      disabled={page >= transactions.totalPages - 1 || refreshing}
                      onClick={() => fetchData(page + 1)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-[10px] text-xs font-bold disabled:opacity-40 transition-colors hover:bg-slate-100"
                      style={{ border: `1.5px solid ${P.border}`, color: P.navy }}
                    >
                      Tiếp <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Empty state ───────────────────────────────────────────────── */}
          {!loading && !overview && !error && (
            <div
              className="py-16 text-center text-sm font-medium rounded-[20px] bg-white"
              style={{ color: P.muted, border: `1.5px dashed ${P.border}` }}
            >
              Không có dữ liệu doanh thu.
            </div>
          )}
        </div>
      )}
    </AdminShell>
  )
}
