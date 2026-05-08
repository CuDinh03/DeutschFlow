'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import AdminShell from '@/components/admin/AdminShell'
import useAdminData from '@/hooks/useAdminData'
import api from '@/lib/api'
import { buildAiTokenPie, type AiUsageByFeatureDto } from '@/lib/adminTokenPie'

type AdminUser = {
  id: number
  email: string
  displayName: string
  role: string
  isActive: boolean
  planCode?: string
  quotaKind?: string
  usedToday?: number
  usageLast30Days?: number
  dailyTokenGrant?: number
  walletBalance?: number
  walletCap?: number
  usedThisMonth?: number
  remainingThisMonth?: number
  monthlyTokenLimit?: number
  unlimitedInternal?: boolean
  quotaPeriodStartUtc?: string
  quotaPeriodEndUtc?: string
  subscriptionStartsAtUtc?: string | null
  subscriptionEndsAtUtc?: string | null
}

/** % hiển thị: WALLET → usage 30d / trần ví; FREE → hôm nay / ngày. */
function usageRatioPct(u: AdminUser): number {
  const k = u.quotaKind ?? ''
  if (u.unlimitedInternal || k === 'INTERNAL_UNLIMITED') return 0
  const used30 = Number(u.usageLast30Days) || 0
  const cap = Number(u.walletCap) || 0
  const daily = Number(u.dailyTokenGrant) || 0
  const today = Number(u.usedToday ?? u.usedThisMonth) || 0
  if (k === 'WALLET' && cap > 0) {
    return Math.min(100, Math.round((used30 / cap) * 1000) / 10)
  }
  if (k === 'FREE_DAY' && daily > 0) {
    return Math.min(100, Math.round((today / daily) * 1000) / 10)
  }
  return 0
}

function quotaKindLabel(kind: string | undefined, t: (key: string) => string): string {
  switch (kind) {
    case 'WALLET':
      return t('kindWallet')
    case 'FREE_DAY':
      return t('kindFreeDay')
    case 'INTERNAL_UNLIMITED':
      return t('kindInternal')
    default:
      return t('kindNone')
  }
}

type TokenDashState = {
  users: AdminUser[]
  ledger: AiUsageByFeatureDto | null
}

export default function AdminTokenAnalyticsPage() {
  const t = useTranslations('adminTokens')
  const locale = useLocale()
  const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0 })
  const [query, setQuery] = useState('')

  const nf = useMemo(
    () => new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : locale === 'de' ? 'de-DE' : 'en-US'),
    [locale],
  )

  const { data, loading, error, refreshing, lastSyncedAt, reload } = useAdminData<TokenDashState>({
    initialData: { users: [], ledger: null },
    errorMessage: t('error'),
    fetchData: async () => {
      const usersRes = await api.get('/admin/users')
      const usersData = (usersRes.data ?? []) as AdminUser[]
      let ledger: AiUsageByFeatureDto | null = null
      try {
        const lr = await api.get<AiUsageByFeatureDto>('/admin/reports/ai-usage-by-feature', {
          params: { days: 30 },
        })
        ledger = lr.data ?? null
      } catch {
        ledger = null
      }
      return { users: usersData, ledger }
    },
    intervalMs: 45_000,
  })

  const users = data.users
  const ledger = data.ledger

  useEffect(() => {
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      const now = new Date()
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
      const diff = next.getTime() - now.getTime()
      setCountdown({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      })
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  const sumUsed30d = useMemo(
    () => users.reduce((s, u) => s + (Number(u.usageLast30Days) || 0), 0),
    [users],
  )

  /** Trần ví tối đa (Σ) — chỉ tài khoản gói ví. */
  const sumWalletCaps = useMemo(
    () =>
      users.reduce((s, u) => {
        if (u.quotaKind !== 'WALLET') return s
        return s + (Number(u.walletCap) || 0)
      }, 0),
    [users],
  )

  const sumRemainingSpendable = useMemo(
    () => users.reduce((s, u) => s + (Number(u.remainingThisMonth) || 0), 0),
    [users],
  )

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = users.filter((u) => {
      if (!q) return true
      return (
        String(u.id).includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q) ||
        (u.planCode || '').toLowerCase().includes(q)
      )
    })
    list.sort((a, b) => (Number(b.usageLast30Days) || 0) - (Number(a.usageLast30Days) || 0))
    return list
  }, [users, query])

  const pie = useMemo(() => buildAiTokenPie(ledger, sumUsed30d, t), [ledger, sumUsed30d, t])

  const usedPctAcrossCaps =
    sumWalletCaps > 0 ? Math.min(100, Math.round((sumUsed30d / sumWalletCaps) * 1000) / 10) : 0

  if (loading) {
    return (
      <AdminShell title={t('title')} subtitle={t('subtitle')} activeNav="tokenAnalytics" onRefresh={() => reload({ silent: true })}>
        <p className="text-[#94A3B8] text-sm">{t('loading')}</p>
      </AdminShell>
    )
  }

  return (
    <AdminShell
      title={t('title')}
      subtitle={t('subtitle')}
      activeNav="tokenAnalytics"
      error={error}
      refreshing={refreshing}
      onRefresh={() => reload({ silent: true })}
      lastSyncedAt={lastSyncedAt}
    >
      <p className="text-xs text-amber-900 df-glass-subtle border border-amber-200/80 rounded-[10px] px-3 py-2 backdrop-blur-sm">
        {t('disclaimer')}
      </p>

      {/* App-wide: ledger 30d + ví thật */}
      <div className="rounded-[14px] border border-white/20 bg-gradient-to-br from-[#121212]/95 to-[#0c4a7c]/95 backdrop-blur-md text-white p-5 mt-3 shadow-lg shadow-[#121212]/20">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white/80">{t('appTotalsTitle')}</h2>
        <p className="text-xs text-white/70 mt-1">{t('appTotalsSub', { count: users.length })}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div>
            <p className="text-[11px] text-white/60 font-medium">{t('appWalletCapSum')}</p>
            <p className="text-2xl font-black tabular-nums tracking-tight">{nf.format(sumWalletCaps)}</p>
            <p className="text-[10px] text-white/50 mt-0.5">{t('appWalletCapHint')}</p>
          </div>
          <div>
            <p className="text-[11px] text-white/60 font-medium">{t('appTotalUsed30d')}</p>
            <p className="text-2xl font-black tabular-nums tracking-tight text-amber-200">{nf.format(sumUsed30d)}</p>
            <p className="text-[10px] text-white/50 mt-0.5">tokens</p>
          </div>
          <div>
            <p className="text-[11px] text-white/60 font-medium">{t('appTotalRemainSpendable')}</p>
            <p className="text-2xl font-black tabular-nums tracking-tight text-emerald-300">
              {nf.format(sumRemainingSpendable)}
            </p>
            <p className="text-[10px] text-white/50 mt-0.5">{t('appRemainHint')}</p>
          </div>
        </div>
        <p className="text-[11px] text-white/65 mt-4 border-t border-white/10 pt-3">{t('totalsFoot')}</p>
      </div>

      {/* Per-user detail table */}
      <div className="rounded-[14px] border border-[#E2E8F0] bg-white overflow-hidden mt-5">
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <h3 className="font-bold text-[#0F172A]">{t('allUsersTitle')}</h3>
            <p className="text-xs text-[#64748B]">{t('allUsersSub')}</p>
          </div>
          <div className="relative sm:ml-auto sm:w-[min(100%,20rem)]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-8 pr-3 h-9 rounded-[8px] border border-[#E2E8F0] text-sm outline-none focus:ring-1 focus:ring-[#121212]"
              aria-label={t('searchPlaceholder')}
            />
          </div>
        </div>
        <div className="overflow-x-auto max-h-[min(70vh,720px)] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 shadow-sm">
              <tr className="bg-[#F8FAFC] text-left text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                <th className="px-3 py-2.5">{t('colId')}</th>
                <th className="px-3 py-2.5">{t('colUser')}</th>
                <th className="px-3 py-2.5">{t('colRole')}</th>
                <th className="px-3 py-2.5">{t('colActive')}</th>
                <th className="px-3 py-2.5">{t('colPlan')}</th>
                <th className="px-3 py-2.5">{t('colKind')}</th>
                <th className="px-3 py-2.5 text-right">{t('colCap')}</th>
                <th className="px-3 py-2.5 text-right">{t('colUsed30d')}</th>
                <th className="px-3 py-2.5 text-right">{t('colUsedToday')}</th>
                <th className="px-3 py-2.5 text-right">{t('colRemainSpend')}</th>
                <th className="px-3 py-2.5 text-right">{t('colPctUsed')}</th>
                <th className="px-3 py-2.5 min-w-[200px]">{t('colPeriod')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredSorted.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-10 text-center text-[#64748B]">
                    {users.length === 0 ? t('emptyTop') : t('noMatchSearch')}
                  </td>
                </tr>
              ) : (
                filteredSorted.map((u) => {
                  const cap =
                    u.quotaKind === 'WALLET'
                      ? Number(u.walletCap) || 0
                      : u.quotaKind === 'FREE_DAY'
                        ? Number(u.dailyTokenGrant) || 0
                        : 0
                  const used30 = Number(u.usageLast30Days) || 0
                  const usedTodayRow = Number(u.usedToday ?? u.usedThisMonth) || 0
                  const rem = Number(u.remainingThisMonth) || 0
                  const p = usageRatioPct(u)
                  return (
                    <tr key={u.id} className="border-t border-[#E2E8F0] hover:bg-[#FAFBFC]">
                      <td className="px-3 py-2 font-mono text-xs text-[#64748B]">{u.id}</td>
                      <td className="px-3 py-2 min-w-[180px]">
                        <p className="font-semibold text-[#0F172A]">{u.displayName || u.email}</p>
                        <p className="text-[11px] text-[#94A3B8]">{u.email}</p>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex rounded-full bg-[#EEF4FF] text-[#121212] text-xs font-semibold px-2 py-0.5">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">{u.isActive ? t('yes') : t('no')}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex rounded-full bg-slate-100 text-slate-800 text-xs font-semibold px-2 py-0.5">
                          {u.planCode ?? '—'}
                        </span>
                        {(u.subscriptionStartsAtUtc || u.subscriptionEndsAtUtc) && (
                          <p
                            className="text-[10px] text-[#64748B] mt-0.5 max-w-[168px] leading-tight"
                            title={
                              `${u.subscriptionStartsAtUtc ?? '—'} → ${u.subscriptionEndsAtUtc ?? 'open'}`
                            }
                          >
                            Sub:&nbsp;
                            {u.subscriptionStartsAtUtc ? String(u.subscriptionStartsAtUtc).slice(0, 10) : '?'}
                            {' → '}
                            {u.subscriptionEndsAtUtc ? String(u.subscriptionEndsAtUtc).slice(0, 10) : '—'}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-[#334155]">{quotaKindLabel(u.quotaKind, t)}</td>
                      <td className="px-3 py-2 text-right align-top tabular-nums">
                        {u.quotaKind === 'WALLET' ? (
                          <div className="inline-block text-right">
                            <p className="font-semibold text-[#0F172A]">{nf.format(cap)}</p>
                            <p className="text-[10px] text-[#64748B]">
                              +{nf.format(Number(u.dailyTokenGrant) || 0)}{t('perDaySuffix')}
                            </p>
                          </div>
                        ) : u.quotaKind === 'FREE_DAY' ? (
                          <span className="text-[#64748B]">{nf.format(cap)}</span>
                        ) : u.unlimitedInternal ? (
                          <span className="text-amber-100">∞</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-800">
                        {nf.format(used30)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#64748B]">
                        {nf.format(usedTodayRow)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-800">
                        {u.unlimitedInternal ? '—' : nf.format(rem)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="tabular-nums font-bold text-[#0F172A]">{p}%</span>
                          <div className="w-20 h-1.5 rounded-full bg-[#E2E8F0]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${p}%`,
                                backgroundColor: p > 90 ? '#ef4444' : p > 70 ? '#f59e0b' : '#10b981',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-[#64748B] whitespace-nowrap font-mono">
                        {u.quotaPeriodStartUtc && u.quotaPeriodEndUtc
                          ? `${String(u.quotaPeriodStartUtc)} → ${String(u.quotaPeriodEndUtc)}`
                          : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-[#E2E8F0] text-[11px] text-[#64748B] bg-[#FAFBFC] space-y-1">
          <p>{t('pctNote')}</p>
          <p>{t('apiFoot', { shown: filteredSorted.length, total: users.length })}</p>
        </div>
      </div>

      {/* Auxiliary: illustrative pie + reset */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
        <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-4">
          <h3 className="font-bold text-[#0F172A] text-sm mb-2">
            {pie.source === 'ledger' ? t('pieTitleLedger') : t('pieTitleEstimate')}
          </h3>
          <p className="text-[11px] text-[#64748B] mb-2">{t('pieSub')}</p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pie.slices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {pie.slices.map((entry, idx) => (
                    <Cell key={`${entry.name}-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => nf.format(v)}
                  contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-[#64748B] text-center mt-2">
            {pie.source === 'ledger' && ledger
              ? t('liveUsedLedger', {
                  ledger: nf.format(ledger.totalTokens ?? 0),
                  days: ledger.days ?? 30,
                })
              : t('liveUsedEstimate', { quota: nf.format(sumUsed30d) })}
          </p>
        </div>

        <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-4">
          <h3 className="font-bold text-[#0F172A] text-sm mb-3">{t('resetTitle')}</h3>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { val: countdown.d, label: 'd' },
              { val: countdown.h, label: 'h' },
              { val: countdown.m, label: 'm' },
              { val: countdown.s, label: 's' },
            ].map(({ val, label }) => (
              <div key={label} className="rounded-[10px] bg-[#EEF4FF] border border-[#121212]/15 py-3 text-center">
                <p className="text-[#121212] font-black text-xl tabular-nums">{String(val).padStart(2, '0')}</p>
                <p className="text-[10px] text-[#64748B] uppercase">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#64748B]">{t('resetHint')}</p>
          <div className="mt-4 h-2 rounded-full bg-[#E2E8F0]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${usedPctAcrossCaps}%`,
                backgroundColor: usedPctAcrossCaps > 85 ? '#ef4444' : usedPctAcrossCaps > 65 ? '#f59e0b' : '#10b981',
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-[#64748B] mt-2">
            <span>{t('usedLabelWallet')}</span>
            <span className="font-semibold text-[#0F172A]">{usedPctAcrossCaps}%</span>
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-4 pt-3 border-t border-[#E2E8F0]">{t('liveFoot')}</p>
        </div>
      </div>
    </AdminShell>
  )
}
