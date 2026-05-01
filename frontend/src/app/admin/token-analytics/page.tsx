'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import AdminShell from '@/components/admin/AdminShell'
import useAdminData from '@/hooks/useAdminData'
import api from '@/lib/api'
import { buildTokenServicePie } from '@/lib/adminDashboardMock'

type AdminUser = {
  id: number
  email: string
  displayName: string
  role: string
  isActive: boolean
  planCode?: string
  usedThisMonth?: number
  remainingThisMonth?: number
  monthlyTokenLimit?: number
  quotaPeriodStartUtc?: string
  quotaPeriodEndUtc?: string
  subscriptionStartsAtUtc?: string | null
  subscriptionEndsAtUtc?: string | null
}

function pctUsed(used: number, limit: number) {
  if (!limit || limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 1000) / 10)
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

  const { data: users, loading, error, refreshing, lastSyncedAt, reload } = useAdminData<AdminUser[]>({
    initialData: [],
    errorMessage: t('error'),
    fetchData: async () => {
      const res = await api.get('/admin/users')
      return (res.data ?? []) as AdminUser[]
    },
    intervalMs: 45_000,
  })

  useEffect(() => {
    const tick = () => {
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

  const sumUsed = useMemo(
    () => users.reduce((s, u) => s + (Number(u.usedThisMonth) || 0), 0),
    [users],
  )
  const sumLimit = useMemo(
    () => users.reduce((s, u) => s + (Number(u.monthlyTokenLimit) || 0), 0),
    [users],
  )
  const sumRemaining = useMemo(
    () => users.reduce((s, u) => s + (Number(u.remainingThisMonth) || 0), 0),
    [users],
  )

  const arithmeticRemain = Math.max(0, sumLimit - sumUsed)

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
    list.sort((a, b) => (Number(b.usedThisMonth) || 0) - (Number(a.usedThisMonth) || 0))
    return list
  }, [users, query])

  const pieData = useMemo(
    () =>
      buildTokenServicePie(sumUsed, {
        speaking: t('sliceSpeaking'),
        llm: t('sliceLlm'),
        grammar: t('sliceGrammar'),
        other: t('sliceOther'),
      }),
    [sumUsed, t],
  )

  const usedPct = sumLimit > 0 ? Math.min(100, Math.round((sumUsed / sumLimit) * 1000) / 10) : 0

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
      <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-[10px] px-3 py-2">{t('disclaimer')}</p>

      {/* App-wide totals (real sums from API) */}
      <div className="rounded-[14px] border border-[#00305E]/20 bg-gradient-to-br from-[#00305E] to-[#0c4a7c] text-white p-5 mt-3 shadow-md">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white/80">{t('appTotalsTitle')}</h2>
        <p className="text-xs text-white/70 mt-1">{t('appTotalsSub', { count: users.length })}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div>
            <p className="text-[11px] text-white/60 font-medium">{t('appTotalLimit')}</p>
            <p className="text-2xl font-black tabular-nums tracking-tight">{nf.format(sumLimit)}</p>
            <p className="text-[10px] text-white/50 mt-0.5">tokens</p>
          </div>
          <div>
            <p className="text-[11px] text-white/60 font-medium">{t('appTotalUsed')}</p>
            <p className="text-2xl font-black tabular-nums tracking-tight text-amber-200">{nf.format(sumUsed)}</p>
            <p className="text-[10px] text-white/50 mt-0.5">tokens</p>
          </div>
          <div>
            <p className="text-[11px] text-white/60 font-medium">{t('appTotalRemain')}</p>
            <p className="text-2xl font-black tabular-nums tracking-tight text-emerald-300">{nf.format(sumRemaining)}</p>
            <p className="text-[10px] text-white/50 mt-0.5">tokens</p>
          </div>
        </div>
        <p className="text-[11px] text-white/65 mt-4 border-t border-white/10 pt-3">
          {t('sanityHint', {
            remain: nf.format(sumRemaining),
            diff: nf.format(arithmeticRemain),
          })}
        </p>
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
              className="w-full pl-8 pr-3 h-9 rounded-[8px] border border-[#E2E8F0] text-sm outline-none focus:ring-1 focus:ring-[#00305E]"
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
                <th className="px-3 py-2.5 text-right">{t('colLimit')}</th>
                <th className="px-3 py-2.5 text-right">{t('colUsed')}</th>
                <th className="px-3 py-2.5 text-right">{t('colRemain')}</th>
                <th className="px-3 py-2.5 text-right">{t('colPctUsed')}</th>
                <th className="px-3 py-2.5 min-w-[200px]">{t('colPeriod')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredSorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-[#64748B]">
                    {users.length === 0 ? t('emptyTop') : t('noMatchSearch')}
                  </td>
                </tr>
              ) : (
                filteredSorted.map((u) => {
                  const limit = Number(u.monthlyTokenLimit) || 0
                  const used = Number(u.usedThisMonth) || 0
                  const rem = Number(u.remainingThisMonth) || 0
                  const p = pctUsed(used, limit)
                  return (
                    <tr key={u.id} className="border-t border-[#E2E8F0] hover:bg-[#FAFBFC]">
                      <td className="px-3 py-2 font-mono text-xs text-[#64748B]">{u.id}</td>
                      <td className="px-3 py-2 min-w-[180px]">
                        <p className="font-semibold text-[#0F172A]">{u.displayName || u.email}</p>
                        <p className="text-[11px] text-[#94A3B8]">{u.email}</p>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex rounded-full bg-[#EEF4FF] text-[#00305E] text-xs font-semibold px-2 py-0.5">
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
                      <td className="px-3 py-2 text-right tabular-nums text-[#64748B]">{nf.format(limit)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-800">{nf.format(used)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-800">{nf.format(rem)}</td>
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
        <div className="px-4 py-2 border-t border-[#E2E8F0] text-[11px] text-[#64748B] bg-[#FAFBFC]">
          {t('apiFoot', { shown: filteredSorted.length, total: users.length })}
        </div>
      </div>

      {/* Auxiliary: illustrative pie + reset */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
        <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-4">
          <h3 className="font-bold text-[#0F172A] text-sm mb-2">{t('pieTitle')}</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={2}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => nf.format(v)}
                  contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-[#64748B] text-center">{t('liveUsed', { n: nf.format(sumUsed) })}</p>
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
              <div key={label} className="rounded-[10px] bg-[#EEF4FF] border border-[#00305E]/15 py-3 text-center">
                <p className="text-[#00305E] font-black text-xl tabular-nums">{String(val).padStart(2, '0')}</p>
                <p className="text-[10px] text-[#64748B] uppercase">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#64748B]">{t('resetHint')}</p>
          <div className="mt-4 h-2 rounded-full bg-[#E2E8F0]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${usedPct}%`,
                backgroundColor: usedPct > 85 ? '#ef4444' : usedPct > 65 ? '#f59e0b' : '#10b981',
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-[#64748B] mt-2">
            <span>{t('usedLabel')}</span>
            <span className="font-semibold text-[#0F172A]">{usedPct}%</span>
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-4 pt-3 border-t border-[#E2E8F0]">{t('liveFoot')}</p>
        </div>
      </div>
    </AdminShell>
  )
}
