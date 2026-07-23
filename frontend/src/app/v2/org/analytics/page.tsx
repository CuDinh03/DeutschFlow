'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiMessage } from '@/lib/api'
import { getAnalytics, listClasses, type OrgAnalytics, type OrgClass } from '@/lib/orgApi'
import { GaPageHdr, TkStatStrip, ErrorBanner, LoadingState } from '@/components/ui-v2'
import { GaSection, GaDonut, GaLegend, GaBarRow, GA_CHART, nfVN } from '../../analyticsShared'

// Option-1: GET /org/analytics is FLAT (no time-series). Reuse getAnalytics + listClasses.
// Proto's monthly trend + per-class performance comparison have no backing endpoint → dropped.

const TEAL = '#11888A'

export default function V2OrgAnalyticsPage() {
  const t = useTranslations('v2.org.analytics')
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
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={() => void load()} />
          </div>
        )}
        {loading ? (
          <LoadingState label={t('loading')} />
        ) : (
          <div className="space-y-[22px]">
            <TkStatStrip
              items={[
                { label: t('stats.totalStudents'), value: analytics?.studentCount ?? 0, color: TEAL },
                {
                  label: t('stats.active7d'),
                  value: analytics?.activeStudents7d ?? 0,
                  sub: t('stats.ofStudents', { pct: engagementPct }),
                  color: '#2F6FC9',
                },
                { label: t('stats.openClasses'), value: analytics?.classCount ?? classes.length, color: '#7C56C8' },
                {
                  label: t('stats.tokensThisMonth'),
                  value: analytics ? nfVN.format(analytics.tokensThisMonth) : '—',
                  sub: analytics?.poolUnlimited ? t('stats.poolUnlimited') : analytics && analytics.monthlyTokenPool > 0 ? t('stats.poolPercent', { pct: poolPct }) : t('stats.noPool'),
                  color: '#1E9E61',
                },
              ]}
            />

            <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-[1fr_1fr]">
              <GaSection title={t('cefrTitle')}>
                {cefrSegs.length > 0 ? (
                  <div className="flex flex-col items-center gap-5 sm:flex-row">
                    <GaDonut segments={cefrSegs} />
                    <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                      <GaLegend items={cefrSegs.map((s) => ({ ...s, display: nfVN.format(s.value) }))} />
                    </div>
                  </div>
                ) : (
                  <p className="ga-ui py-10 text-center text-[14px] text-ga-muted">{t('cefrEmpty')}</p>
                )}
              </GaSection>

              <GaSection title={t('usageTitle')}>
                <div className="space-y-5 py-1">
                  <div>
                    <div className="ga-ui mb-1.5 flex items-baseline justify-between text-[13px]">
                      <span className="text-ga-ink">{t('activeStudents')}</span>
                      <span className="font-medium text-ga-muted">{engagementPct}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-[3px] bg-ga-border">
                      <div className="h-full rounded-[3px]" style={{ width: `${Math.min(100, engagementPct)}%`, background: TEAL }} />
                    </div>
                  </div>
                  {analytics && analytics.monthlyTokenPool > 0 && (
                    <div>
                      <div className="ga-ui mb-1.5 flex items-baseline justify-between text-[13px]">
                        <span className="text-ga-ink">{t('tokenPool')}</span>
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

            <GaSection title={t('classesTitle')} bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left lg:min-w-0">
                  <thead>
                    <tr className="border-b border-ga-border">
                      {[t('colClass'), t('colCode'), t('colTeacher')].map((h, i) => (
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
                          {t('emptyClasses')}
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
                              <span className="text-ga-red">{t('unassigned')}</span>
                            ) : (
                              <span className="text-ga-muted">{t('assigned')}</span>
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
