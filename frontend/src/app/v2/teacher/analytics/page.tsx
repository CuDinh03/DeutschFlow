'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { FileDown } from 'lucide-react'
import api from '@/lib/api'
import { GaPageHdr, GaBtn, TkStatStrip, ErrorBanner, LoadingState } from '@/components/ui-v2'
import { GaSection, GaBarRow, GA_CHART, nfVN } from '../../analyticsShared'

// Option-1: real teacher reports are FLAT (no time-series). Reuse:
//   GET /v2/teacher/reports/overview  → { classCount, assignmentCount, studentCount, avgScore }
//   GET /v2/teacher/classes           → class list
//   GET /v2/teacher/reports/classes/{id} → per-class { studentCount, assignmentCount, avgScore }
// Proto's score-trend chart + student leaderboard have no backing endpoint → dropped (backlog).

const VIOLET = '#7C56C8'

interface Overview {
  classCount: number
  studentCount: number
  assignmentCount: number
  avgScore: number
}
interface ClassRow {
  id: number
  name: string
  studentCount: number
  assignmentCount: number
  avgScore: number
}

function num(r: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const n = Number(r[k])
    if (r[k] != null && Number.isFinite(n)) return n
  }
  return 0
}

export default function V2TeacherAnalyticsPage() {
  const t = useTranslations('v2.teacher.analytics')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [rows, setRows] = useState<ClassRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ovRes, clsRes] = await Promise.all([
        api.get('/v2/teacher/reports/overview'),
        api.get('/v2/teacher/classes'),
      ])
      const o = (ovRes.data ?? {}) as Record<string, unknown>
      setOverview({
        classCount: num(o, 'classCount'),
        studentCount: num(o, 'studentCount'),
        assignmentCount: num(o, 'assignmentCount'),
        avgScore: num(o, 'avgScore'),
      })
      const classes = (clsRes.data ?? []) as Record<string, unknown>[]
      const detail = await Promise.all(
        classes.map(async (c) => {
          const id = Number(c.id)
          let d: Record<string, unknown> = {}
          try {
            d = ((await api.get(`/v2/teacher/reports/classes/${id}`)).data ?? {}) as Record<string, unknown>
          } catch {
            d = {}
          }
          return {
            id,
            name: String(c.name ?? `Lớp ${id}`),
            studentCount: num(d, 'studentCount') || num(c, 'studentCount', 'students'),
            assignmentCount: num(d, 'assignmentCount') || num(c, 'quizCount', 'taskCount'),
            avgScore: num(d, 'avgScore'),
          } as ClassRow
        }),
      )
      setRows(detail)
    } catch {
      setError(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { void load() }, [load])

  const scored = rows.filter((r) => r.avgScore > 0)

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

            <GaSection title={t('avgByClass')}>
              {scored.length > 0 ? (
                <div className="space-y-1">
                  {scored
                    .sort((a, b) => b.avgScore - a.avgScore)
                    .map((r, i) => (
                      <GaBarRow
                        key={r.id}
                        label={r.name}
                        value={r.avgScore}
                        max={100}
                        color={GA_CHART[i % GA_CHART.length]}
                        display={t('scoreUnit', { value: r.avgScore.toFixed(1) })}
                      />
                    ))}
                </div>
              ) : (
                <p className="ga-ui py-8 text-center text-[14px] text-ga-muted">
                  {t('avgByClassEmpty')}
                </p>
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
                          className={`ga-ui px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ga-muted ${
                            i === 0 ? '' : 'text-right'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="ga-ui px-5 py-10 text-center text-[14px] text-ga-muted">
                          {t('noClasses')}
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => (
                        <tr key={r.id} className="border-b border-ga-border last:border-0 hover:bg-ga-surface">
                          <td className="px-5 py-3 text-[14px] font-semibold text-ga-ink">{r.name}</td>
                          <td className="px-5 py-3 text-right text-[13.5px] tabular-nums text-ga-muted">
                            {nfVN.format(r.studentCount)}
                          </td>
                          <td className="px-5 py-3 text-right text-[13.5px] tabular-nums text-ga-muted">
                            {nfVN.format(r.assignmentCount)}
                          </td>
                          <td className="px-5 py-3 text-right text-[13.5px] font-semibold tabular-nums text-ga-ink">
                            {r.avgScore > 0 ? r.avgScore.toFixed(1) : '—'}
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
