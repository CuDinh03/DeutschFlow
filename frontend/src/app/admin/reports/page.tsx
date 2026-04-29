'use client'

import { useEffect, useMemo, useState } from 'react'
import api from '@/lib/api'
import AdminShell from '@/components/admin/AdminShell'
import useAdminData from '@/hooks/useAdminData'

type TelemetryDay = {
  snapshotDate: string
  totalRequests: number
  errorRequests: number
  avgLatencyMs: number
  errorRatePercent: number
}

type PercentileReport = {
  days: number
  endpoint: string
  sampleCount: number
  p50LatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
}

type GrammarFeedbackDay = {
  snapshotDate: string
  totalSubmits: number
  totalItems: number
  itemsWithFeedback: number
  coveragePercent: number
}

type PersonalizationRuleset = {
  version: string
  dimensionsSupported: string[]
}

type GateChecklistDay = {
  snapshotDate: string
  endpoint: string
  grammarCoveragePercent: number
  errorRatePercent: number
  p95LatencyMs: number
  sampleCount: number
  grammarPass: boolean
  errorPass: boolean
  p95Pass: boolean
  allPass: boolean
}

export default function AdminReportsPage() {
  const [overview, setOverview] = useState<any>(null)
  const [studentProgress, setStudentProgress] = useState<any[]>([])
  const [telemetry, setTelemetry] = useState<TelemetryDay[]>([])
  const [percentiles, setPercentiles] = useState<PercentileReport | null>(null)
  const [grammarCoverage, setGrammarCoverage] = useState<GrammarFeedbackDay[]>([])
  const [ruleset, setRuleset] = useState<PersonalizationRuleset | null>(null)
  const [gateChecklist, setGateChecklist] = useState<GateChecklistDay[]>([])
  const [onlyUnder20, setOnlyUnder20] = useState(false)
  const [sortBy, setSortBy] = useState<'lastStudyDesc' | 'lastStudyAsc' | 'progressDesc' | 'progressAsc'>('lastStudyDesc')
  const [wiktionaryLimit, setWiktionaryLimit] = useState(100)
  const [wiktionaryResetCursor, setWiktionaryResetCursor] = useState(false)
  const [wiktionaryRunning, setWiktionaryRunning] = useState(false)
  const [wiktionaryResult, setWiktionaryResult] = useState<any>(null)
  const [wiktionaryError, setWiktionaryError] = useState('')

  const visibleStudentProgress = useMemo(() => {
    const list = [...studentProgress]
      .filter((row) => (onlyUnder20 ? Number(row.planProgressPercent ?? 0) < 20 : true))

    const studyMs = (row: any) => {
      if (!row?.lastStudyAt) return -1
      const ms = new Date(row.lastStudyAt).getTime()
      return Number.isNaN(ms) ? -1 : ms
    }

    list.sort((a, b) => {
      if (sortBy === 'progressAsc') {
        return Number(a.planProgressPercent ?? 0) - Number(b.planProgressPercent ?? 0)
      }
      if (sortBy === 'progressDesc') {
        return Number(b.planProgressPercent ?? 0) - Number(a.planProgressPercent ?? 0)
      }
      if (sortBy === 'lastStudyAsc') {
        return studyMs(a) - studyMs(b)
      }
      return studyMs(b) - studyMs(a)
    })

    return list
  }, [studentProgress, onlyUnder20, sortBy])

  const { data, loading, refreshing, error, lastSyncedAt, reload } = useAdminData<{
    overview: any
    studentProgress: any[]
    telemetry: TelemetryDay[]
    percentiles: PercentileReport | null
    grammarCoverage: GrammarFeedbackDay[]
    ruleset: PersonalizationRuleset | null
    gateChecklist: GateChecklistDay[]
  }>({
    initialData: { overview: null, studentProgress: [], telemetry: [], percentiles: null, grammarCoverage: [], ruleset: null, gateChecklist: [] },
    errorMessage: 'Khong the tai report.',
    fetchData: async () => {
      const [overviewRes, progressRes, telemetryRes, percentileRes, grammarRes, rulesetRes, gateRes] = await Promise.all([
        api.get('/admin/reports/overview'),
        api.get('/admin/reports/student-plan-progress'),
        api.get('/admin/reports/api-telemetry', { params: { days: 14 } }),
        api.get('/admin/reports/api-telemetry/percentiles', { params: { days: 7, endpoint: '/api/plan/sessions/submit' } }),
        api.get('/admin/reports/grammar-feedback-coverage', { params: { days: 14 } }),
        api.get('/admin/reports/personalization-ruleset'),
        api.get('/admin/reports/gate-checklist', { params: { days: 14, endpoint: '/api/plan/sessions/submit' } }),
      ])
      return {
        overview: overviewRes.data ?? null,
        studentProgress: progressRes.data ?? [],
        telemetry: telemetryRes.data ?? [],
        percentiles: percentileRes.data ?? null,
        grammarCoverage: grammarRes.data ?? [],
        ruleset: rulesetRes.data ?? null,
        gateChecklist: gateRes.data ?? [],
      }
    },
  })

  useEffect(() => {
    setOverview(data.overview)
    setStudentProgress(data.studentProgress ?? [])
    setTelemetry(data.telemetry ?? [])
    setPercentiles(data.percentiles ?? null)
    setGrammarCoverage(data.grammarCoverage ?? [])
    setRuleset(data.ruleset ?? null)
    setGateChecklist(data.gateChecklist ?? [])
  }, [data])

  if (loading) return <div className="page-shell text-muted-foreground">Dang tai report...</div>

  return (
    <AdminShell
      title="Bao cao he thong"
      subtitle="Chi so he thong va tien do lo trinh hoc vien"
      activeNav="reports"
      error={error}
      refreshing={refreshing}
      onRefresh={() => reload({ silent: true })}
      lastSyncedAt={lastSyncedAt}
    >
      {!overview ? (
        <div className="empty-state">Khong co du lieu.</div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="section-card">
              <p className="text-muted-foreground text-sm">Tong user</p>
              <p className="text-2xl font-bold">{overview.userCount}</p>
            </div>
            <div className="section-card">
              <p className="text-muted-foreground text-sm">Teacher / Student</p>
              <p className="text-2xl font-bold">
                {overview.teacherCount} / {overview.studentCount}
              </p>
            </div>
            <div className="section-card">
              <p className="text-muted-foreground text-sm">Tong lop hoc</p>
              <p className="text-2xl font-bold">{overview.classCount}</p>
            </div>
            <div className="section-card">
              <p className="text-muted-foreground text-sm">Tong quiz</p>
              <p className="text-2xl font-bold">{overview.quizCount}</p>
            </div>
            <div className="section-card">
              <p className="text-muted-foreground text-sm">Quiz dang active</p>
              <p className="text-2xl font-bold">{overview.activeQuizCount}</p>
            </div>
            <div className="section-card">
              <p className="text-muted-foreground text-sm">Diem TB quiz</p>
              <p className="text-2xl font-bold">{Number(overview.avgQuizScore ?? 0).toFixed(2)}</p>
            </div>
          </div>

          <div className="section-card">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-base font-semibold">Cong cu quan tri</p>
                <p className="text-sm text-muted-foreground">
                  Lam giau du lieu tu vung (IPA/nghia/vi du) bang Wiktionary. Chay theo batch, co the bam nhieu lan.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm text-muted-foreground inline-flex items-center gap-2">
                  Limit
                  <input
                    className="input h-9 py-1 text-sm w-[110px]"
                    type="number"
                    min={1}
                    max={2000}
                    value={wiktionaryLimit}
                    onChange={(e) => setWiktionaryLimit(Number(e.target.value || 0))}
                  />
                </label>
                <label className="text-sm text-muted-foreground inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={wiktionaryResetCursor}
                    onChange={(e) => setWiktionaryResetCursor(e.target.checked)}
                  />
                  Chay lai tu dau
                </label>
                <button
                  className="btn-outline btn-sm h-9"
                  disabled={wiktionaryRunning}
                  onClick={async () => {
                    setWiktionaryRunning(true)
                    setWiktionaryError('')
                    try {
                      const res = await api.post('/admin/vocabulary/wiktionary/enrich/batch', null, {
                        params: { limit: wiktionaryLimit, resetCursor: wiktionaryResetCursor },
                      })
                      setWiktionaryResult(res.data)
                      // refresh reports silently after kicking job
                      reload({ silent: true })
                    } catch (e: any) {
                      const msg = e?.response?.data?.message || e?.message || 'Khong the chay Wiktionary enrich.'
                      setWiktionaryError(String(msg))
                    } finally {
                      setWiktionaryRunning(false)
                    }
                  }}
                >
                  {wiktionaryRunning ? 'Dang lam giau...' : 'Lam giau Wiktionary'}
                </button>
              </div>
            </div>

            {wiktionaryResetCursor ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Se quet lai tu id=0; khong ghi de du lieu da co (chi fill khi trong).
              </p>
            ) : null}

            {wiktionaryError ? <div className="mt-3 alert-error">{wiktionaryError}</div> : null}
            {wiktionaryResult ? (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-7 gap-2 text-sm">
                <div className="rounded-lg border border-border p-2">
                  <p className="text-xs text-muted-foreground">Processed</p>
                  <p className="font-semibold">{String(wiktionaryResult.processedRows ?? '—')}</p>
                </div>
                <div className="rounded-lg border border-border p-2">
                  <p className="text-xs text-muted-foreground">IPA filled</p>
                  <p className="font-semibold">{String(wiktionaryResult.ipaFilled ?? '—')}</p>
                </div>
                <div className="rounded-lg border border-border p-2">
                  <p className="text-xs text-muted-foreground">EN upserts</p>
                  <p className="font-semibold">{String(wiktionaryResult.enUpserts ?? '—')}</p>
                </div>
                <div className="rounded-lg border border-border p-2">
                  <p className="text-xs text-muted-foreground">DE upserts</p>
                  <p className="font-semibold">{String(wiktionaryResult.deUpserts ?? '—')}</p>
                </div>
                <div className="rounded-lg border border-border p-2">
                  <p className="text-xs text-muted-foreground">Failed</p>
                  <p className="font-semibold">{String(wiktionaryResult.failed ?? '—')}</p>
                </div>
                <div className="rounded-lg border border-border p-2">
                  <p className="text-xs text-muted-foreground">Lock retries</p>
                  <p className="font-semibold">{String(wiktionaryResult.lockRetries ?? '—')}</p>
                </div>
                <div className="rounded-lg border border-border p-2">
                  <p className="text-xs text-muted-foreground">Cursor</p>
                  <p className="font-semibold">{String(wiktionaryResult.lastProcessedWordId ?? '—')}</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="section-card overflow-x-auto">
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <p className="text-base font-semibold">Tien do lo trinh hoc vien</p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={onlyUnder20}
                    onChange={(e) => setOnlyUnder20(e.target.checked)}
                  />
                  Chi hien hoc vien duoi 20%
                </label>
                <select
                  className="input h-9 py-1 text-sm min-w-[220px]"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                >
                  <option value="lastStudyDesc">Last study moi nhat</option>
                  <option value="lastStudyAsc">Last study cu nhat</option>
                  <option value="progressDesc">Progress cao den thap</option>
                  <option value="progressAsc">Progress thap den cao</option>
                </select>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Theo doi hoc vien dang hoc den tuan / session nao. Dang hien {visibleStudentProgress.length}/{studentProgress.length} hoc vien.
            </p>
            {studentProgress.length === 0 ? (
              <div className="empty-state">Chua co du lieu hoc vien.</div>
            ) : visibleStudentProgress.length === 0 ? (
              <div className="empty-state">Khong co hoc vien phu hop bo loc hien tai.</div>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4">Student</th>
                    <th className="py-2 pr-4">Current</th>
                    <th className="py-2 pr-4">Completed</th>
                    <th className="py-2 pr-4">Progress</th>
                    <th className="py-2 pr-0">Last study</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleStudentProgress.map((row) => (
                    <tr key={String(row.studentId)} className="border-b border-border/60">
                      <td className="py-2 pr-4">
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">#{row.studentId}</p>
                      </td>
                      <td className="py-2 pr-4">
                        W{row.currentWeek} · S{row.currentSessionIndex}
                      </td>
                      <td className="py-2 pr-4">{row.completedSessions}</td>
                      <td className="py-2 pr-4">
                        <span className="inline-flex rounded-full bg-[#EEF4FF] px-2 py-0.5 text-xs font-semibold text-[#00305E]">
                          {row.planProgressPercent}%
                        </span>
                      </td>
                      <td className="py-2 pr-0 text-muted-foreground">
                        {row.lastStudyAt ? new Date(row.lastStudyAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="section-card overflow-x-auto">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <p className="text-base font-semibold">KPI W4 - Core System</p>
              <p className="text-xs text-muted-foreground">
                Nguon: /api/admin/reports/api-telemetry, /percentiles, /grammar-feedback-coverage, /personalization-ruleset
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg border border-border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground">Submit latency p95</p>
                <p className="text-xl font-bold">{percentiles ? Number(percentiles.p95LatencyMs ?? 0).toFixed(0) : '—'} ms</p>
                <p className={`text-xs ${percentiles && Number(percentiles.p95LatencyMs ?? 0) < 500 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {percentiles && Number(percentiles.p95LatencyMs ?? 0) < 500 ? 'PASS < 500ms' : 'FAIL >= 500ms'}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground">Latest grammar feedback coverage</p>
                <p className="text-xl font-bold">
                  {grammarCoverage.length > 0 ? Number(grammarCoverage[grammarCoverage.length - 1]?.coveragePercent ?? 0).toFixed(2) : '—'}%
                </p>
                <p className={`text-xs ${grammarCoverage.length > 0 && Number(grammarCoverage[grammarCoverage.length - 1]?.coveragePercent ?? 0) >= 100 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {grammarCoverage.length > 0 && Number(grammarCoverage[grammarCoverage.length - 1]?.coveragePercent ?? 0) >= 100 ? 'PASS = 100%' : 'FAIL < 100%'}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground">Personalization ruleset</p>
                <p className="text-lg font-bold">{ruleset?.version ?? '—'}</p>
                <p className="text-xs text-muted-foreground">
                  {(ruleset?.dimensionsSupported ?? []).join(', ') || 'Khong co du lieu'}
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-3">
              Checklist pass/fail theo ngay cho Gate W4 (grammar coverage, API error rate, submit p95). D7 uplift hien chua co endpoint cohort.
            </p>
            {gateChecklist.length === 0 ? (
              <div className="empty-state">Chua co du lieu checklist theo ngay.</div>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Grammar coverage</th>
                    <th className="py-2 pr-3">API error rate</th>
                    <th className="py-2 pr-3">Submit p95</th>
                    <th className="py-2 pr-0">Gate signal</th>
                  </tr>
                </thead>
                <tbody>
                  {gateChecklist.map((row) => (
                    <tr key={row.snapshotDate} className="border-b border-border/60">
                      <td className="py-2 pr-3">{row.snapshotDate}</td>
                      <td className="py-2 pr-3">
                        {`${Number(row.grammarCoveragePercent ?? 0).toFixed(2)}%`}
                        <span className={`ml-2 text-xs ${row.grammarPass ? 'text-emerald-600' : 'text-red-600'}`}>
                          {row.grammarPass ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        {`${Number(row.errorRatePercent ?? 0).toFixed(2)}%`}
                        <span className={`ml-2 text-xs ${row.errorPass ? 'text-emerald-600' : 'text-red-600'}`}>
                          {row.errorPass ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        {`${Number(row.p95LatencyMs ?? 0).toFixed(0)} ms`}
                        <span className={`ml-2 text-xs ${row.p95Pass ? 'text-emerald-600' : 'text-red-600'}`}>
                          {row.p95Pass ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                      <td className="py-2 pr-0">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${row.allPass ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {row.allPass ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  )
}

