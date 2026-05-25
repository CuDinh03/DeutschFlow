'use client'

import { motion } from 'framer-motion'
import { BarChart3, ArrowUpRight, Wallet, TrendingUp } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'

type RevenueMetric = {
  label: string
  value: string
  delta: string
  positive: boolean
}

const metrics: RevenueMetric[] = [
  { label: 'Gross revenue', value: '₫128.4M', delta: '+18.2% vs last month', positive: true },
  { label: 'Net revenue', value: '₫96.1M', delta: '+12.7% vs last month', positive: true },
  { label: 'Refunds', value: '₫3.4M', delta: '-2.1% vs last month', positive: false },
  { label: 'Active subscriptions', value: '2,184', delta: '+146 new renewals', positive: true },
]

export default function AdminRevenuePage() {
  return (
    <AdminShell title="Revenue" subtitle="Tổng quan doanh thu, tăng trưởng và hiệu quả thương mại của nền tảng." activeNav="revenue">
      <div className="space-y-5">
        <div className="bg-white rounded-[16px] p-5 border border-[#E2E8F0] shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#94A3B8]">Revenue dashboard</p>
              <h2 className="text-xl font-extrabold text-[#0F172A] mt-1">Doanh thu theo thời gian thực</h2>
              <p className="text-sm text-[#64748B] mt-1">Theo dõi các chỉ số thương mại chính và trạng thái tăng trưởng để hỗ trợ ra quyết định nhanh.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-2 text-sm font-semibold text-[#0F172A]">
              <Wallet size={16} /> Revenue snapshot
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="rounded-[16px] bg-white border border-[#E2E8F0] p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-[#64748B]">{metric.label}</p>
                <TrendingUp size={16} className={metric.positive ? 'text-emerald-500' : 'text-rose-500'} />
              </div>
              <p className="mt-3 text-2xl font-extrabold text-[#0F172A]">{metric.value}</p>
              <p className={`mt-2 text-sm font-medium ${metric.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                {metric.delta}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-4">
          <div className="rounded-[16px] bg-white border border-[#E2E8F0] p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-[#0F172A]">Doanh thu theo tháng</h3>
                <p className="text-sm text-[#64748B]">Biểu đồ tổng quan cho xu hướng kinh doanh.</p>
              </div>
              <BarChart3 size={18} className="text-[#0F172A]" />
            </div>
            <div className="h-72 rounded-[14px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] flex items-center justify-center text-sm text-[#94A3B8]">
              Chart placeholder
            </div>
          </div>

          <div className="rounded-[16px] bg-white border border-[#E2E8F0] p-5 shadow-sm">
            <h3 className="text-base font-extrabold text-[#0F172A]">Key actions</h3>
            <div className="mt-4 space-y-3">
              {[
                'Review monthly billing health',
                'Track churn and renewal rates',
                'Compare plans by ARPU',
                'Export finance summary',
              ].map((item) => (
                <div key={item} className="flex items-center justify-between gap-3 rounded-[12px] border border-[#E2E8F0] px-4 py-3 text-sm text-[#0F172A]">
                  <span>{item}</span>
                  <ArrowUpRight size={16} className="text-[#94A3B8]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
