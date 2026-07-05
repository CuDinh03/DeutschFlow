'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { interviewDomainApi, type InterviewAnalytics } from '@/lib/interviewDomainApi'
import { AdStatStrip, type AdStatCell, ErrorBanner, LoadingState, GaPageHdr } from '@/components/ui-v2'
import { GaSection, GaDonut, GaLegend, GaBarRow, GA_CHART, nfVN } from '../../analyticsShared'

function avgOfValues(rec: Record<string, number>): number {
  const vals = Object.values(rec).filter((v) => Number.isFinite(v))
  if (vals.length === 0) return 0
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

function recToSegs(rec: Record<string, number>): { label: string; value: number; color: string }[] {
  return Object.entries(rec)
    .sort(([, a], [, b]) => b - a)
    .map(([label, value], i) => ({ label, value, color: GA_CHART[i % GA_CHART.length] }))
}

export default function V2AdminInterviewsPage() {
  const t = useTranslations('v2.adminContent.interviews')
  const [data, setData] = useState<InterviewAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    interviewDomainApi
      .getAnalytics()
      .then(setData)
      .catch(() => setError(t('loadError')))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const industrySegs = data ? recToSegs(data.sessionsByIndustry) : []
  const variantEntries = data
    ? Object.entries(data.variantDistribution).sort(([, a], [, b]) => b - a)
    : []
  const maxVariant = variantEntries.reduce((m, [, v]) => Math.max(m, v), 0)
  const phaseMax = data ? data.phaseDropOff.reduce((m, p) => Math.max(m, p.sessionsReached), 0) : 0
  const avgScore = data ? avgOfValues(data.avgScoreByIndustry) : 0

  const cells: AdStatCell[] = [
    { label: t('statTotal'), value: data ? nfVN.format(data.totalSessions) : '—', color: '#2F6FC9' },
    {
      label: t('statCompletion'),
      value: data ? `${Math.round(data.completionRate * (data.completionRate <= 1 ? 100 : 1))}%` : '—',
      color: '#1E9E61',
      sub: data ? t('statCompletionSub', { count: nfVN.format(data.completedSessions) }) : undefined,
    },
    { label: t('statAvgScore'), value: avgScore > 0 ? avgScore.toFixed(1) : '—', color: '#7C56C8', sub: t('statAvgScoreSub') },
    {
      label: t('statVariants'),
      value: data ? nfVN.format(Object.keys(data.variantDistribution).length) : '—',
      color: '#E07B39',
      sub: t('statVariantsSub'),
    },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
      />
      <div className="flex-1 px-10 py-6">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        )}
        {loading && !data ? (
          <LoadingState label={t('loading')} />
        ) : data ? (
          <div className="space-y-[22px]">
            <AdStatStrip cells={cells} />

            <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-[1.4fr_1fr]">
              <GaSection title={t('phaseDropOffTitle')}>
                {data.phaseDropOff.length > 0 ? (
                  <div className="space-y-1">
                    {data.phaseDropOff.map((p) => (
                      <GaBarRow
                        key={p.phase}
                        label={p.phase}
                        value={p.sessionsReached}
                        max={phaseMax}
                        color="#2F6FC9"
                        display={`${nfVN.format(p.sessionsReached)} · ${Math.round(
                          p.reachRate * (p.reachRate <= 1 ? 100 : 1),
                        )}%`}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="ga-ui py-8 text-center text-[14px] text-ga-muted">{t('noPhaseData')}</p>
                )}
              </GaSection>

              <GaSection title={t('variantDistTitle')}>
                {variantEntries.length > 0 ? (
                  <div className="space-y-3">
                    {variantEntries.map(([variant, sess], i) => {
                      const score = data.avgScoreByVariant[variant]
                      return (
                        <GaBarRow
                          key={variant}
                          label={variant}
                          value={sess}
                          max={maxVariant}
                          color={GA_CHART[i % GA_CHART.length]}
                          display={
                            <>
                              {t('sessionsSuffix', { count: nfVN.format(sess) })}
                              {Number.isFinite(score) && <span className="text-ga-subtle"> · {score.toFixed(1)}đ</span>}
                            </>
                          }
                        />
                      )
                    })}
                  </div>
                ) : (
                  <p className="ga-ui py-8 text-center text-[14px] text-ga-muted">{t('noVariants')}</p>
                )}
              </GaSection>
            </div>

            <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-2">
              <GaSection title={t('sessionsByIndustryTitle')}>
                {industrySegs.length > 0 ? (
                  <div className="flex items-center gap-5">
                    <GaDonut segments={industrySegs} />
                    <div className="flex-1">
                      <GaLegend items={industrySegs.map((s) => ({ ...s, display: nfVN.format(s.value) }))} />
                    </div>
                  </div>
                ) : (
                  <p className="ga-ui py-8 text-center text-[14px] text-ga-muted">{t('noIndustryData')}</p>
                )}
              </GaSection>

              <GaSection title={t('avgScoreByIndustryTitle')}>
                {Object.keys(data.avgScoreByIndustry).length > 0 ? (
                  <div className="space-y-1">
                    {Object.entries(data.avgScoreByIndustry)
                      .sort(([, a], [, b]) => b - a)
                      .map(([ind, score], i) => (
                        <GaBarRow
                          key={ind}
                          label={ind}
                          value={score}
                          max={100}
                          color={GA_CHART[i % GA_CHART.length]}
                          display={`${score.toFixed(1)}đ`}
                        />
                      ))}
                  </div>
                ) : (
                  <p className="ga-ui py-8 text-center text-[14px] text-ga-muted">{t('noScoreByIndustry')}</p>
                )}
              </GaSection>
            </div>
          </div>
        ) : (
          !error && <p className="ga-ui py-10 text-center text-[14px] text-ga-muted">{t('noData')}</p>
        )}
      </div>
    </div>
  )
}
