'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import api from '@/lib/api'
import type { AiUsageByFeatureDto } from '@/lib/adminTokenPie'
import { AdStatStrip, type AdStatCell, ErrorBanner, LoadingState, GaPageHdr, TkBadge } from '@/components/ui-v2'
import { GaSection, GaDonut, GaLegend, GaArea, GA_CHART, nfVN } from '../../analyticsShared'

type DailyCostRow = { day: string; tokens: number; costUsd: number; model: string; feature: string }
type DailyCostDto = { days: number; data: DailyCostRow[] }

type TokenUser = {
  id: number
  email: string
  displayName: string
  role?: string
  usageLast30Days?: number
}

type TokenState = {
  users: TokenUser[]
  ledger: AiUsageByFeatureDto | null
  daily: DailyCostDto | null
}

// Known AI-feature enum keys (from GET /admin/reports/ai-usage-by-feature). Label resolved
// via t('featureLabels.<KEY>'); unknown keys fall back to the raw feature string.
const FEATURE_KEYS = ['SPEAKING', 'INTERVIEW', 'GRAMMAR', 'GRADING', 'MATERIALS', 'IMAGE', 'TTS', 'VOCAB']

export default function V2AdminTokensPage() {
  const t = useTranslations('v2.adminOps.tokens')
  const [state, setState] = useState<TokenState>({ users: [], ledger: null, daily: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const featureLabel = (f?: string): string => {
    if (!f) return t('featureLabels.other')
    const key = f.toUpperCase()
    return FEATURE_KEYS.includes(key) ? t(`featureLabels.${key}`) : f
  }

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.allSettled([
      api.get<TokenUser[]>('/admin/users'),
      api.get<AiUsageByFeatureDto>('/admin/reports/ai-usage-by-feature', { params: { days: 30 } }),
      api.get<DailyCostDto>('/admin/reports/ai-cost-daily', { params: { days: 14 } }),
    ])
      .then(([u, l, d]) => {
        setState({
          users: u.status === 'fulfilled' ? (u.value.data ?? []) : [],
          ledger: l.status === 'fulfilled' ? (l.value.data ?? null) : null,
          daily: d.status === 'fulfilled' ? (d.value.data ?? null) : null,
        })
        if (u.status === 'rejected' && l.status === 'rejected' && d.status === 'rejected') {
          setError(t('loadError'))
        }
      })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const { users, ledger, daily } = state

  const featureSegs = (ledger?.rows ?? [])
    .map((r) => ({ label: featureLabel(r.feature), value: Number(r.totalTokens) || 0 }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((s, i) => ({ ...s, color: GA_CHART[i % GA_CHART.length] }))

  const dailyByDay = (() => {
    if (!daily?.data) return [] as { label: string; value: number }[]
    const acc: Record<string, number> = {}
    for (const r of daily.data) acc[r.day] = (acc[r.day] ?? 0) + (Number(r.costUsd) || 0)
    return Object.entries(acc)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, cost]) => ({ label: day.slice(5), value: Math.round(cost * 10000) / 10000 }))
  })()

  const totalTokens = ledger?.totalTokens ?? featureSegs.reduce((s, x) => s + x.value, 0)
  const totalCost = dailyByDay.reduce((s, x) => s + x.value, 0)
  const activeUsers = users.filter((u) => (Number(u.usageLast30Days) || 0) > 0).length
  const topUsers = [...users]
    .sort((a, b) => (Number(b.usageLast30Days) || 0) - (Number(a.usageLast30Days) || 0))
    .slice(0, 8)

  const cells: AdStatCell[] = [
    { label: t('stats.totalTokens'), value: nfVN.format(totalTokens), color: '#E07B39' },
    { label: t('stats.cost'), value: `$${totalCost.toFixed(2)}`, color: '#DA291C', sub: t('stats.costSub') },
    { label: t('stats.aiUsers'), value: nfVN.format(activeUsers), color: '#2F6FC9', sub: t('stats.aiUsersSub') },
    { label: t('stats.features'), value: nfVN.format(featureSegs.length), color: '#1E9E61', sub: t('stats.featuresSub') },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <div className="flex-1 px-10 py-6">
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

            <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-[1fr_1.6fr]">
              <GaSection title={t('tokensByFeature')}>
                {featureSegs.length > 0 ? (
                  <div className="flex flex-col items-center gap-5">
                    <GaDonut segments={featureSegs} size={170} />
                    <div className="w-full">
                      <GaLegend items={featureSegs.map((s) => ({ ...s, display: nfVN.format(s.value) }))} />
                    </div>
                  </div>
                ) : (
                  <p className="ga-ui py-10 text-center text-[14px] text-ga-muted">{t('noFeatureLedger')}</p>
                )}
              </GaSection>

              <GaSection title={t('dailyCost')}>
                {dailyByDay.length > 0 ? (
                  <GaArea data={dailyByDay} color="#E07B39" height={230} valueFmt={(v) => `$${v.toFixed(2)}`} />
                ) : (
                  <p className="ga-ui py-10 text-center text-[14px] text-ga-muted">{t('noDailyCost')}</p>
                )}
              </GaSection>
            </div>

            <GaSection title={t('topUsers')} bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-ga-border">
                      {[
                        { key: 'colUser', label: t('colUser') },
                        { key: 'colRole', label: t('colRole') },
                        { key: 'colTokens', label: t('colTokens') },
                      ].map((h, i) => (
                        <th
                          key={h.key}
                          className={`ga-ui px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ga-muted ${
                            i === 2 ? 'text-right' : ''
                          }`}
                        >
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topUsers.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="ga-ui px-5 py-10 text-center text-[14px] text-ga-muted">
                          {t('noUserData')}
                        </td>
                      </tr>
                    ) : (
                      topUsers.map((u) => (
                        <tr key={u.id} className="border-b border-ga-border last:border-0 hover:bg-ga-surface">
                          <td className="px-5 py-3">
                            <p className="text-[14px] font-semibold text-ga-ink">{u.displayName || u.email}</p>
                            <p className="truncate text-[12px] text-ga-muted">{u.email}</p>
                          </td>
                          <td className="px-5 py-3">
                            <TkBadge>{u.role || '—'}</TkBadge>
                          </td>
                          <td className="px-5 py-3 text-right text-[13.5px] font-semibold tabular-nums text-ga-ink">
                            {nfVN.format(Number(u.usageLast30Days) || 0)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </GaSection>
          </div>
        )}
      </div>
    </div>
  )
}
