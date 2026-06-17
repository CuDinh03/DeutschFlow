'use client'

import { useEffect, useState } from 'react'
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

const FEATURE_LABELS: Record<string, string> = {
  SPEAKING: 'Speaking (AI)',
  INTERVIEW: 'Phỏng vấn',
  GRAMMAR: 'Ngữ pháp AI',
  GRADING: 'Chấm bài AI',
  MATERIALS: 'Tài liệu AI',
  IMAGE: 'Sinh ảnh',
  TTS: 'TTS narration',
  VOCAB: 'Từ vựng AI',
}

function featureLabel(f?: string): string {
  if (!f) return 'Khác'
  return FEATURE_LABELS[f.toUpperCase()] ?? f
}

export default function V2AdminTokensPage() {
  const [state, setState] = useState<TokenState>({ users: [], ledger: null, daily: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
          setError('Không thể tải dữ liệu token.')
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
    { label: 'Tổng token (30 ngày)', value: nfVN.format(totalTokens), color: '#E07B39' },
    { label: 'Chi phí (14 ngày)', value: `$${totalCost.toFixed(2)}`, color: '#DA291C', sub: 'ước tính theo ledger' },
    { label: 'Người dùng AI', value: nfVN.format(activeUsers), color: '#2F6FC9', sub: 'có dùng 30 ngày' },
    { label: 'Tính năng', value: nfVN.format(featureSegs.length), color: '#1E9E61', sub: 'đang theo dõi' },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <GaPageHdr accent title="Phân tích chi phí AI" subtitle="Token, chi phí theo tính năng và theo người dùng" />
      <div className="flex-1 px-10 py-6">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        )}
        {loading ? (
          <LoadingState label="Đang tải dữ liệu token…" />
        ) : (
          <div className="space-y-[22px]">
            <AdStatStrip cells={cells} />

            <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-[1fr_1.6fr]">
              <GaSection title="Token theo tính năng">
                {featureSegs.length > 0 ? (
                  <div className="flex flex-col items-center gap-5">
                    <GaDonut segments={featureSegs} size={170} />
                    <div className="w-full">
                      <GaLegend items={featureSegs.map((s) => ({ ...s, display: nfVN.format(s.value) }))} />
                    </div>
                  </div>
                ) : (
                  <p className="ga-ui py-10 text-center text-[14px] text-ga-muted">Chưa có dữ liệu ledger theo tính năng.</p>
                )}
              </GaSection>

              <GaSection title="Chi phí AI theo ngày (14 ngày)">
                {dailyByDay.length > 0 ? (
                  <GaArea data={dailyByDay} color="#E07B39" height={230} valueFmt={(v) => `$${v.toFixed(2)}`} />
                ) : (
                  <p className="ga-ui py-10 text-center text-[14px] text-ga-muted">Chưa có dữ liệu chi phí theo ngày.</p>
                )}
              </GaSection>
            </div>

            <GaSection title="Người dùng tốn token nhất (30 ngày)" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-ga-border">
                      {['Người dùng', 'Vai trò', 'Token (30 ngày)'].map((h, i) => (
                        <th
                          key={h}
                          className={`ga-ui px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ga-muted ${
                            i === 2 ? 'text-right' : ''
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topUsers.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="ga-ui px-5 py-10 text-center text-[14px] text-ga-muted">
                          Không có dữ liệu người dùng.
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
