'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { FileDown } from 'lucide-react'
import {
  GaPageHdr,
  GaBtn,
  TkStatStrip,
  ErrorBanner,
  LoadingState,
} from '@/components/ui-v2'
import {
  GaSection,
  GaBarRow,
  GaLines,
  GaLegend,
  GA_CHART,
  nfVN,
  type LineSeries,
} from '../../analyticsShared'
import {
  getClassesSummary,
  getReportsOverview,
  getSkillDistribution,
  getWeeklyTrends,
  type ClassSummary,
  type ClassTrend,
  type ReportsOverview,
  type SkillDistribution,
} from '@/lib/teacherAnalyticsApi'
import { classHref } from '../tcShared'

const VIOLET = '#7C56C8'
const EMPTY_TREND: ClassTrend = { buckets: [], series: [] }
const EMPTY_SKILL: SkillDistribution = {
  horen: null,
  lesen: null,
  schreiben: null,
  sprechen: null,
  ratedCount: 0,
}

/** Fixed per-skill colours (match the gradebook's skill accents). */
const SKILL_COLOR: Record<'horen' | 'lesen' | 'schreiben' | 'sprechen', string> = {
  horen: '#2F6FC9',
  lesen: '#1E9E61',
  schreiben: '#7C56C8',
  sprechen: '#C79A00',
}

export default function V2TeacherAnalyticsPage() {
  const t = useTranslations('v2.teacher.analytics')
  const [overview, setOverview] = useState<ReportsOverview | null>(null)
  const [classes, setClasses] = useState<ClassSummary[]>([])
  const [trend, setTrend] = useState<ClassTrend>(EMPTY_TREND)
  const [skill, setSkill] = useState<SkillDistribution>(EMPTY_SKILL)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    // One batched summary call + two enhancement calls (trend/skill). Each degrades on its own: a
    // failed chart falls back to its empty state; only losing BOTH core datasets shows the retry.
    const [ov, cls, tr, sk] = await Promise.allSettled([
      getReportsOverview(),
      getClassesSummary(),
      getWeeklyTrends(),
      getSkillDistribution(),
    ])
    if (ov.status === 'rejected' && cls.status === 'rejected') {
      setError(t('loadError'))
      setLoading(false)
      return
    }
    setOverview(ov.status === 'fulfilled' ? ov.value : null)
    setClasses(cls.status === 'fulfilled' ? cls.value : [])
    setTrend(tr.status === 'fulfilled' ? tr.value : EMPTY_TREND)
    setSkill(sk.status === 'fulfilled' ? sk.value : EMPTY_SKILL)
    setLoading(false)
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const scored = classes.filter((c) => c.avgScore > 0)

  // recharts rows: one row per week, one keyed value per class series.
  const trendData = trend.buckets.map((bucket, i) => {
    const row: Record<string, string | number | null> = { label: bucket.split('-')[1] ?? bucket }
    for (const s of trend.series) row[`c${s.classId}`] = s.values[i] ?? null
    return row
  })
  const trendSeries: LineSeries[] = trend.series.map((s, i) => ({
    key: `c${s.classId}`,
    name: s.className,
    color: GA_CHART[i % GA_CHART.length],
  }))

  const skillRows = (['horen', 'lesen', 'schreiben', 'sprechen'] as const)
    .map((key) => ({ key, label: t(`skill.${key}`), value: skill[key] }))
    .filter((row): row is { key: typeof row.key; label: string; value: number } => row.value != null)

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <GaBtn variant="ghost" size="sm" onClick={() => window.print()}>
            <FileDown size={15} aria-hidden /> {t('exportPdf')}
          </GaBtn>
        }
      />
      <div className="flex-1 px-10 py-6">
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
                { label: t('stats.classes'), value: overview?.classCount ?? 0, color: VIOLET },
                { label: t('stats.students'), value: overview?.studentCount ?? 0, sub: t('stats.studentsSub'), color: '#2F6FC9' },
                { label: t('stats.assignments'), value: overview?.assignmentCount ?? 0, sub: t('stats.assignmentsSub'), color: '#11888A' },
                {
                  label: t('stats.avgScore'),
                  value: overview && overview.avgScore > 0 ? overview.avgScore.toFixed(1) : '—',
                  sub: t('stats.avgScoreSub'),
                  color: '#1E9E61',
                },
              ]}
            />

            <GaSection
              title={t('trendTitle')}
              right={<span className="ga-ui text-[12px] text-ga-muted">{t('trendScaleNote')}</span>}
            >
              {trendSeries.length > 0 ? (
                <div className="space-y-3">
                  <GaLines data={trendData} series={trendSeries} yDomain={[0, 100]} valueFmt={(v) => v.toFixed(0)} />
                  <GaLegend items={trendSeries.map((s) => ({ label: s.name, color: s.color }))} />
                </div>
              ) : (
                <p className="ga-ui py-8 text-center text-[14px] text-ga-muted">{t('trendEmpty')}</p>
              )}
            </GaSection>

            <GaSection
              title={t('skillTitle')}
              right={<span className="ga-ui text-[12px] text-ga-muted">{t('skillScaleNote')}</span>}
            >
              {skillRows.length > 0 ? (
                <div className="space-y-1">
                  {skillRows.map((row) => (
                    <GaBarRow
                      key={row.key}
                      label={row.label}
                      value={row.value}
                      max={10}
                      color={SKILL_COLOR[row.key]}
                      display={row.value.toFixed(1)}
                    />
                  ))}
                </div>
              ) : (
                <p className="ga-ui py-8 text-center text-[14px] text-ga-muted">{t('skillEmpty')}</p>
              )}
            </GaSection>

            <GaSection title={t('avgByClass')}>
              {scored.length > 0 ? (
                <div className="space-y-1">
                  {scored
                    .slice()
                    .sort((a, b) => b.avgScore - a.avgScore)
                    .map((c, i) => (
                      <GaBarRow
                        key={c.id}
                        label={c.name}
                        value={c.avgScore}
                        max={100}
                        color={GA_CHART[i % GA_CHART.length]}
                        display={t('scoreUnit', { value: c.avgScore.toFixed(1) })}
                      />
                    ))}
                </div>
              ) : (
                <p className="ga-ui py-8 text-center text-[14px] text-ga-muted">{t('avgByClassEmpty')}</p>
              )}
            </GaSection>

            <GaSection title={t('byClassDetail')} bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-ga-border">
                      {[t('colClass'), t('colStudents'), t('colAssignments'), t('colAvgScore')].map((h, i) => (
                        <th
                          key={h}
                          className={`ga-ui px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ga-muted ${i === 0 ? '' : 'text-right'}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {classes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="ga-ui px-5 py-10 text-center text-[14px] text-ga-muted">
                          {t('noClasses')}
                        </td>
                      </tr>
                    ) : (
                      classes.map((c) => (
                        <tr key={c.id} className="border-b border-ga-border last:border-0 hover:bg-ga-surface">
                          <td className="px-5 py-3 text-[14px] font-semibold text-ga-ink">
                            <Link
                              href={classHref('/v2/teacher/tc-reports', c.id)}
                              className="text-ga-accent hover:underline"
                            >
                              {c.name}
                            </Link>
                          </td>
                          <td className="px-5 py-3 text-right text-[13.5px] tabular-nums text-ga-muted">
                            {nfVN.format(c.studentCount)}
                          </td>
                          <td className="px-5 py-3 text-right text-[13.5px] tabular-nums text-ga-muted">
                            {nfVN.format(c.assignmentCount)}
                          </td>
                          <td className="px-5 py-3 text-right text-[13.5px] font-semibold tabular-nums text-ga-ink">
                            {c.avgScore > 0 ? c.avgScore.toFixed(1) : '—'}
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
