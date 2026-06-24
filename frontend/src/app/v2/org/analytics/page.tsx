'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiMessage } from '@/lib/api'
import { getAnalytics, listClasses, type OrgAnalytics, type OrgClass } from '@/lib/orgApi'
import { GaPageHdr, TkStatStrip, ErrorBanner, LoadingState } from '@/components/ui-v2'
import { GaSection, GaDonut, GaLegend, GaBarRow, GA_CHART, nfVN } from '../../analyticsShared'

// Option-1: GET /org/analytics is FLAT (no time-series). Reuse getAnalytics + listClasses.
// Proto's monthly trend + per-class performance comparison have no backing endpoint → dropped.

const TEAL = '#11888A'

export default function V2OrgAnalyticsPage() {
  const [analytics, setAnalytics] = useState<OrgAnalytics | null>(null)
  const [classes, setClasses] = useState<OrgClass[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [a, c] = await Promise.all([
        getAnalytics(),
        listClasses(0, 100).then((p) => p.content).catch(() => [] as OrgClass[]),
      ])
      setAnalytics(a)
      setClasses(c)
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const cefr = analytics?.cefrDistribution ?? []
  const cefrSegs = cefr
    .filter((b) => b.count > 0)
    .map((b, i) => ({ label: b.level, value: b.count, color: GA_CHART[i % GA_CHART.length] }))
  const engagementPct =
    analytics && analytics.studentCount > 0
      ? Math.round((analytics.activeStudents7d / analytics.studentCount) * 100)
      : 0
  const poolPct = analytics ? Math.round(analytics.poolUsagePercent) : 0

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title="Phân tích tổ chức" subtitle="Phân bố trình độ, mức độ hoạt động và sử dụng token AI" />
      <div className="flex-1 px-10 py-6">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={() => void load()} />
          </div>
        )}
        {loading ? (
          <LoadingState label="Đang tải phân tích…" />
        ) : (
          <div className="space-y-[22px]">
            <TkStatStrip
              items={[
                { label: 'Tổng học viên', value: analytics?.studentCount ?? 0, color: TEAL },
                {
                  label: 'Hoạt động 7 ngày',
                  value: analytics?.activeStudents7d ?? 0,
                  sub: `${engagementPct}% học viên`,
                  color: '#2F6FC9',
                },
                { label: 'Lớp đang mở', value: analytics?.classCount ?? classes.length, color: '#7C56C8' },
                {
                  label: 'Token AI tháng này',
                  value: analytics ? nfVN.format(analytics.tokensThisMonth) : '—',
                  sub: analytics?.poolUnlimited ? 'pool không giới hạn' : analytics && analytics.monthlyTokenPool > 0 ? `${poolPct}% pool` : 'Chưa cấu hình pool',
                  color: '#1E9E61',
                },
              ]}
            />

            <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-[1fr_1fr]">
              <GaSection title="Phân bố trình độ (CEFR)">
                {cefrSegs.length > 0 ? (
                  <div className="flex items-center gap-5">
                    <GaDonut segments={cefrSegs} />
                    <div className="flex-1">
                      <GaLegend items={cefrSegs.map((s) => ({ ...s, display: nfVN.format(s.value) }))} />
                    </div>
                  </div>
                ) : (
                  <p className="ga-ui py-10 text-center text-[14px] text-ga-muted">Chưa có dữ liệu phân bố trình độ.</p>
                )}
              </GaSection>

              <GaSection title="Mức độ sử dụng">
                <div className="space-y-5 py-1">
                  <div>
                    <div className="ga-ui mb-1.5 flex items-baseline justify-between text-[13px]">
                      <span className="text-ga-ink">Học viên hoạt động (7 ngày)</span>
                      <span className="font-medium text-ga-muted">{engagementPct}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-[3px] bg-ga-border">
                      <div className="h-full rounded-[3px]" style={{ width: `${Math.min(100, engagementPct)}%`, background: TEAL }} />
                    </div>
                  </div>
                  {analytics && analytics.monthlyTokenPool > 0 && (
                    <div>
                      <div className="ga-ui mb-1.5 flex items-baseline justify-between text-[13px]">
                        <span className="text-ga-ink">Pool token AI</span>
                        <span className="font-medium text-ga-muted">
                          {nfVN.format(analytics.tokensThisMonth)} / {nfVN.format(analytics.monthlyTokenPool)}
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-[3px] bg-ga-border">
                        <div
                          className="h-full rounded-[3px]"
                          style={{
                            width: `${Math.min(100, poolPct)}%`,
                            background: poolPct >= 90 ? 'var(--ga-red)' : poolPct >= 70 ? 'var(--ga-orange)' : 'var(--ga-green)',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </GaSection>
            </div>

            <GaSection title="Lớp học của tổ chức" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-ga-border">
                      {['Lớp', 'Mã lớp', 'Giáo viên'].map((h, i) => (
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
                    {classes.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="ga-ui px-5 py-10 text-center text-[14px] text-ga-muted">
                          Chưa có lớp nào.
                        </td>
                      </tr>
                    ) : (
                      classes.map((c) => (
                        <tr key={c.id} className="border-b border-ga-border last:border-0 hover:bg-ga-surface">
                          <td className="px-5 py-3 text-[14px] font-semibold text-ga-ink">{c.name}</td>
                          <td className="px-5 py-3">
                            {c.inviteCode ? (
                              <code className="bg-ga-ink px-2 py-1 text-[11px] font-semibold tracking-[0.06em] text-ga-yellow">
                                {c.inviteCode}
                              </code>
                            ) : (
                              <span className="text-ga-subtle">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right text-[13px]">
                            {c.teacherId == null ? (
                              <span className="text-ga-red">Chưa phân</span>
                            ) : (
                              <span className="text-ga-muted">Đã có GV</span>
                            )}
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
