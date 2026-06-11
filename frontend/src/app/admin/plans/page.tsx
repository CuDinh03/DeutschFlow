'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Coins, CreditCard, CheckCircle2, RefreshCw, Zap, Shield } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'
import api from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SubscriptionPlan {
  code: string
  name: string
  monthlyTokenLimit: number
  dailyTokenGrant: number
  walletCapDays: number
  featuresJson: string | null
  isActive: boolean
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function parseFeatures(json: string | null): string[] {
  if (!json) return []
  try {
    const parsed: unknown = JSON.parse(json)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {
    // ignore
  }
  return []
}

// ─── Plan card ────────────────────────────────────────────────────────────────
function PlanCard({ plan, index }: { plan: SubscriptionPlan; index: number }) {
  const features = parseFeatures(plan.featuresJson)
  const highlighted = plan.code === 'PREMIUM' || plan.code === 'PRO'

  const metaItems = [
    { label: 'Monthly tokens', value: fmtTokens(plan.monthlyTokenLimit) },
    { label: 'Daily grant', value: fmtTokens(plan.dailyTokenGrant) },
    { label: 'Wallet cap', value: `${plan.walletCapDays}d` },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`rounded-[16px] p-5 border shadow-sm bg-white transition-shadow hover:shadow-md ${
        highlighted ? 'border-[#121212] ring-1 ring-[#121212]/10' : 'border-[#E2E8F0]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[12px] flex items-center justify-center bg-[#F1F5F9]">
            <CreditCard size={20} className="text-[#0F172A]" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#0F172A]">{plan.name}</h3>
            <p className="text-xs text-[#94A3B8] font-mono uppercase">{plan.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {highlighted && (
            <span className="text-[11px] font-bold uppercase tracking-widest rounded-full bg-[#121212] text-white px-3 py-1">Popular</span>
          )}
          {!plan.isActive && (
            <span className="text-[11px] font-bold uppercase tracking-widest rounded-full bg-[#FEE2E2] text-red-600 px-3 py-1">Inactive</span>
          )}
        </div>
      </div>

      {/* Token metrics */}
      <div className="grid grid-cols-3 gap-2 mt-3 mb-4">
        {metaItems.map((m) => (
          <div key={m.label} className="rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-2 text-center">
            <p className="text-base font-extrabold text-[#0F172A]">{m.value}</p>
            <p className="text-[10px] text-[#94A3B8] leading-tight mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Features */}
      {features.length > 0 && (
        <div className="space-y-2">
          {features.map((feature) => (
            <div key={feature} className="flex items-center gap-2 text-sm text-[#0F172A]">
              <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
              <span>{feature}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminPlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchPlans = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      // Use the axios client (baseURL = backend origin + Bearer auth + refresh); a raw
      // relative fetch('/api/...') resolves to the Next.js origin → 404 in production.
      const { data } = await api.get<SubscriptionPlan[]>('/admin/plans')
      setPlans(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  const activePlans = plans.filter((p) => p.isActive)
  const inactivePlans = plans.filter((p) => !p.isActive)

  return (
    <AdminShell
      title="Plans"
      subtitle="Gói đăng ký đang hoạt động — cấu hình token, quyền lợi và trạng thái thương mại."
      activeNav="plans"
      error={error ?? undefined}
      refreshing={refreshing}
      onRefresh={() => fetchPlans(true)}
    >
      <div className="space-y-5">
        {/* Header banner */}
        <div className="bg-white rounded-[16px] p-5 border border-[#E2E8F0] shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#94A3B8]">Subscription management</p>
              <h2 className="text-xl font-extrabold text-[#0F172A] mt-1">Gói dịch vụ từ cơ sở dữ liệu</h2>
              <p className="text-sm text-[#64748B] mt-1">
                Dữ liệu thực từ bảng <code className="font-mono text-xs bg-[#F1F5F9] px-1 rounded">subscription_plans</code>.
                {plans.length > 0 && ` ${plans.length} gói — ${activePlans.length} đang hoạt động.`}
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-2 text-sm font-semibold text-[#0F172A]">
              <Coins size={16} /> Revenue-ready
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={24} className="animate-spin text-[#64748B]" />
          </div>
        )}

        {/* Active plans */}
        {!loading && activePlans.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap size={15} className="text-emerald-500" />
              <h3 className="text-sm font-bold text-[#0F172A]">Đang hoạt động ({activePlans.length})</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {activePlans.map((plan, i) => (
                <PlanCard key={plan.code} plan={plan} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Inactive plans */}
        {!loading && inactivePlans.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield size={15} className="text-[#94A3B8]" />
              <h3 className="text-sm font-bold text-[#64748B]">Không còn hoạt động ({inactivePlans.length})</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 opacity-60">
              {inactivePlans.map((plan, i) => (
                <PlanCard key={plan.code} plan={plan} index={activePlans.length + i} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && plans.length === 0 && !error && (
          <div
            className="py-16 text-center text-sm font-medium rounded-[20px] bg-white"
            style={{ color: '#64748B', border: '1.5px dashed #E2E8F0' }}
          >
            Không có gói đăng ký nào.
          </div>
        )}
      </div>
    </AdminShell>
  )
}
