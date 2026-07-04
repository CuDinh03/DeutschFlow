'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import api, { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn, GaCap, TkStatStrip } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Báo cáo hệ thống (admin) — navy HUB, condensed (W1.7 migrate admin/reports).
// Quyết định: hub rút gọn — giữ data (health + signals + overview + KPI + gate-checklist
//   + plan-progress + Wiktionary tool), bỏ chart telemetry nặng (api-telemetry[] vốn không
//   render trong bản gốc). 3 báo cáo chi tiết tách màn con (link bên dưới).
// Endpoints: /admin/reports/{overview, student-plan-progress, api-telemetry/percentiles,
//   grammar-feedback-coverage, personalization-ruleset, gate-checklist}.
// ─────────────────────────────────────────────────────────────────────────────

interface Overview { userCount: number; teacherCount: number; studentCount: number; classCount: number; quizCount: number; activeQuizCount: number; avgQuizScore: number }
interface ProgressRow { studentId: number; name: string; currentWeek: number; currentSessionIndex: number; completedSessions: number; planProgressPercent: number; lastStudyAt: string | null }
interface Percentiles { p95LatencyMs: number }
interface GrammarDay { snapshotDate: string; coveragePercent: number }
interface Ruleset { version: string; dimensionsSupported: string[] }
interface GateDay { snapshotDate: string; grammarCoveragePercent: number; errorRatePercent: number; p95LatencyMs: number; grammarPass: boolean; errorPass: boolean; p95Pass: boolean; allPass: boolean }
interface WiktionaryResult { processedRows?: number; ipaFilled?: number; enUpserts?: number; deUpserts?: number; failed?: number; lockRetries?: number; lastProcessedWordId?: number }

type SortBy = 'lastStudyDesc' | 'lastStudyAsc' | 'progressDesc' | 'progressAsc'
const selectCls = 'ga-ui border border-ga-line bg-ga-bg px-2.5 py-1.5 text-[12px] text-ga-ink outline-none'
const passStyle = (ok: boolean) => (ok ? { color: 'var(--ga-green)' } : { color: 'var(--ga-red)' })
const badge = (ok: boolean) => (ok ? { color: 'var(--ga-green)', background: 'var(--ga-green-soft)' } : { color: 'var(--ga-red)', background: 'var(--ga-red-soft)' })

const CHILD_REPORTS = [
  { href: '/v2/admin/reports/grammar-feedback-coverage', labelKey: 'childGrammar' },
  { href: '/v2/admin/reports/personalization-ruleset', labelKey: 'childPersonalization' },
  { href: '/v2/admin/reports/vocabulary-quality', labelKey: 'childVocab' },
]

export default function V2AdminReportsPage() {
  const t = useTranslations('v2.adminContent.reports')
  const tc = useTranslations('v2.common')
  const router = useRouter()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [progress, setProgress] = useState<ProgressRow[]>([])
  const [percentiles, setPercentiles] = useState<Percentiles | null>(null)
  const [grammar, setGrammar] = useState<GrammarDay[]>([])
  const [ruleset, setRuleset] = useState<Ruleset | null>(null)
  const [gate, setGate] = useState<GateDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [onlyUnder20, setOnlyUnder20] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('lastStudyDesc')
  const [wktLimit, setWktLimit] = useState(100)
  const [wktReset, setWktReset] = useState(false)
  const [wktRunning, setWktRunning] = useState(false)
  const [wktResult, setWktResult] = useState<WiktionaryResult | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, pr, pc, gr, rs, gt] = await Promise.all([
        api.get<Overview>('/admin/reports/overview'),
        api.get<ProgressRow[]>('/admin/reports/student-plan-progress'),
        api.get<Percentiles>('/admin/reports/api-telemetry/percentiles', { params: { days: 7, endpoint: '/api/plan/sessions/submit' } }),
        api.get<GrammarDay[]>('/admin/reports/grammar-feedback-coverage', { params: { days: 14 } }),
        api.get<Ruleset>('/admin/reports/personalization-ruleset'),
        api.get<GateDay[]>('/admin/reports/gate-checklist', { params: { days: 14, endpoint: '/api/plan/sessions/submit' } }),
      ])
      setOverview(ov.data ?? null); setProgress(pr.data ?? []); setPercentiles(pc.data ?? null)
      setGrammar(gr.data ?? []); setRuleset(rs.data ?? null); setGate(gt.data ?? [])
      setError('')
    } catch (e: unknown) { setError(apiMessage(e)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const runWiktionary = async () => {
    setWktRunning(true)
    try {
      const res = await api.post<WiktionaryResult>('/admin/vocabulary/wiktionary/enrich/batch', null, { params: { limit: wktLimit, resetCursor: wktReset } })
      setWktResult(res.data ?? null)
    } catch (e: unknown) { setError(apiMessage(e)) }
    finally { setWktRunning(false) }
  }

  const p95 = percentiles?.p95LatencyMs ?? null
  const grammarPct = grammar.length ? Number(grammar[grammar.length - 1]?.coveragePercent ?? 0) : null
  const under20 = progress.filter((r) => Number(r.planProgressPercent ?? 0) < 20).length

  const visibleProgress = useMemo(() => {
    const studyMs = (r: ProgressRow) => (r.lastStudyAt ? (Number.isNaN(new Date(r.lastStudyAt).getTime()) ? -1 : new Date(r.lastStudyAt).getTime()) : -1)
    return [...progress]
      .filter((r) => (onlyUnder20 ? Number(r.planProgressPercent ?? 0) < 20 : true))
      .sort((a, b) => {
        if (sortBy === 'progressAsc') return Number(a.planProgressPercent ?? 0) - Number(b.planProgressPercent ?? 0)
        if (sortBy === 'progressDesc') return Number(b.planProgressPercent ?? 0) - Number(a.planProgressPercent ?? 0)
        if (sortBy === 'lastStudyAsc') return studyMs(a) - studyMs(b)
        return studyMs(b) - studyMs(a)
      })
  }, [progress, onlyUnder20, sortBy])

  const signals = [
    { title: t('signalLatency'), value: p95 != null ? `${Math.round(p95)}ms` : '—', ok: p95 != null && p95 < 500 },
    { title: t('signalGrammar'), value: grammarPct != null ? `${grammarPct.toFixed(0)}%` : '—', ok: grammarPct != null && grammarPct >= 100 },
    { title: t('signalUnder20'), value: progress.length ? `${under20}` : '—', ok: under20 === 0 },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')}
        right={<GaBtn variant="ghost" size="sm" onClick={load}><RefreshCw size={15} /> {t('refresh')}</GaBtn>} />

      <div className="flex-1 overflow-auto px-10 py-6">
        {loading ? (
          <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="ga-shimmer h-[80px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error} <code className="font-mono text-[12px] text-ga-accent">GET /api/admin/reports/*</code></p>
            <GaBtn variant="primary" onClick={load}>{tc('retry')}</GaBtn>
          </div>
        ) : !overview ? (
          <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">{t('noData')}</div>
        ) : (
          <>
            {/* Action signals */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {signals.map((s) => (
                <div key={s.title} className="border border-ga-line bg-ga-card p-[18px]">
                  <div className="mb-2 flex items-center justify-between">
                    <GaCap>{s.title}</GaCap>
                    <span className="px-2 py-0.5 text-[10.5px] font-bold" style={badge(s.ok)}>{s.ok ? t('pass') : t('attention')}</span>
                  </div>
                  <div className="font-ga-display text-[26px] font-medium text-ga-ink">{s.value}</div>
                </div>
              ))}
            </div>

            {/* Overview */}
            <div className="mt-[22px]">
              <TkStatStrip items={[
                { label: t('statUsers'), value: (overview.userCount ?? 0).toLocaleString() },
                { label: t('statTeacherStudent'), value: `${overview.teacherCount ?? 0} / ${overview.studentCount ?? 0}`, color: '#2F6FC9' },
                { label: t('statClasses'), value: overview.classCount ?? 0, color: '#11888A' },
                { label: t('statAvgQuiz'), value: Number(overview.avgQuizScore ?? 0).toFixed(2), color: '#E07B39' },
              ]} />
            </div>

            {/* Child reports */}
            <div className="mb-3.5 mt-[22px]"><GaCap>{t('childReportsCap')}</GaCap></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {CHILD_REPORTS.map((c) => (
                <button key={c.href} type="button" onClick={() => router.push(c.href)}
                  className="flex items-center justify-between gap-2 border border-ga-line bg-ga-card px-4 py-3.5 text-left transition-colors hover:border-ga-accent">
                  <span className="text-[13.5px] font-semibold text-ga-ink">{t(c.labelKey)}</span>
                  <ChevronRight size={16} className="text-ga-muted" />
                </button>
              ))}
            </div>

            {/* KPI W4 */}
            <div className="mb-3.5 mt-[22px]"><GaCap>{t('kpiCap')}</GaCap></div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="border border-ga-line bg-ga-card p-[18px]">
                <GaCap>{t('kpiLatency')}</GaCap>
                <div className="mt-2 font-ga-display text-[22px] font-medium text-ga-ink">{p95 != null ? `${Math.round(p95)} ms` : '—'}</div>
                <p className="mt-1 text-[12px] font-bold" style={passStyle(p95 != null && p95 < 500)}>{p95 != null && p95 < 500 ? t('kpiLatencyPass') : t('kpiLatencyFail')}</p>
              </div>
              <div className="border border-ga-line bg-ga-card p-[18px]">
                <GaCap>{t('kpiGrammar')}</GaCap>
                <div className="mt-2 font-ga-display text-[22px] font-medium text-ga-ink">{grammarPct != null ? `${grammarPct.toFixed(2)}%` : '—'}</div>
                <p className="mt-1 text-[12px] font-bold" style={passStyle(grammarPct != null && grammarPct >= 100)}>{grammarPct != null && grammarPct >= 100 ? t('kpiGrammarPass') : t('kpiGrammarFail')}</p>
              </div>
              <div className="border border-ga-line bg-ga-card p-[18px]">
                <GaCap>{t('kpiRuleset')}</GaCap>
                <div className="mt-2 font-ga-display text-[18px] font-medium text-ga-ink">{ruleset?.version ?? '—'}</div>
                <p className="ga-ui mt-1 truncate text-[12px] text-ga-muted">{(ruleset?.dimensionsSupported ?? []).join(', ') || t('rulesetEmpty')}</p>
              </div>
            </div>

            {/* Gate checklist */}
            <div className="mb-3.5 mt-[22px]"><GaCap>{t('gateCap')}</GaCap></div>
            <div className="border border-ga-line bg-ga-card">
              <div className="grid items-center gap-2 border-b border-ga-line bg-ga-bg px-5 py-[11px]" style={{ gridTemplateColumns: '1fr 130px 120px 110px 80px' }}>
                {[t('gateColDate'), t('gateColGrammar'), t('gateColErrorRate'), t('gateColP95'), t('gateColGate')].map((h, i) => <span key={i} className={`ga-ui text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted ${i === 4 ? 'text-right' : ''}`}>{h}</span>)}
              </div>
              {gate.length === 0 ? (
                <div className="px-6 py-[26px] text-center text-[13.5px] text-ga-muted">{t('gateEmpty')}</div>
              ) : gate.map((r, i) => (
                <div key={r.snapshotDate} className="grid items-center gap-2 px-5 py-2.5 transition-colors hover:bg-ga-surface" style={{ gridTemplateColumns: '1fr 130px 120px 110px 80px', borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                  <span className="font-mono text-[12px] text-ga-muted">{r.snapshotDate}</span>
                  <span className="text-[12.5px]">{Number(r.grammarCoveragePercent ?? 0).toFixed(1)}% <span className="text-[10px] font-bold" style={passStyle(r.grammarPass)}>{r.grammarPass ? t('pass') : t('fail')}</span></span>
                  <span className="text-[12.5px]">{Number(r.errorRatePercent ?? 0).toFixed(1)}% <span className="text-[10px] font-bold" style={passStyle(r.errorPass)}>{r.errorPass ? t('pass') : t('fail')}</span></span>
                  <span className="text-[12.5px]">{Math.round(r.p95LatencyMs ?? 0)}ms <span className="text-[10px] font-bold" style={passStyle(r.p95Pass)}>{r.p95Pass ? t('pass') : t('fail')}</span></span>
                  <span className="flex justify-end"><span className="px-2 py-0.5 text-[10.5px] font-bold" style={badge(r.allPass)}>{r.allPass ? t('pass') : t('fail')}</span></span>
                </div>
              ))}
            </div>

            {/* Student progress */}
            <div className="mb-3.5 mt-[22px] flex flex-wrap items-center justify-between gap-3">
              <GaCap>{t('progressCap', { shown: visibleProgress.length, total: progress.length })}</GaCap>
              <div className="flex items-center gap-3">
                <label className="ga-ui flex items-center gap-1.5 text-[12px] text-ga-muted">
                  <input type="checkbox" checked={onlyUnder20} onChange={(e) => setOnlyUnder20(e.target.checked)} style={{ accentColor: 'var(--ga-accent)' }} /> {t('onlyUnder20')}
                </label>
                <select className={selectCls} value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} aria-label={t('sortAria')}>
                  <option value="lastStudyDesc">{t('sortStudyDesc')}</option>
                  <option value="lastStudyAsc">{t('sortStudyAsc')}</option>
                  <option value="progressDesc">{t('sortProgressDesc')}</option>
                  <option value="progressAsc">{t('sortProgressAsc')}</option>
                </select>
              </div>
            </div>
            <div className="border border-ga-line bg-ga-card">
              <div className="grid items-center gap-2 border-b border-ga-line bg-ga-bg px-5 py-[11px]" style={{ gridTemplateColumns: '1.4fr 100px 90px 90px 1fr' }}>
                {[t('progressColStudent'), t('progressColCurrent'), t('progressColCompleted'), t('progressColProgress'), t('progressColLastStudy')].map((h) => <span key={h} className="ga-ui text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted">{h}</span>)}
              </div>
              {visibleProgress.length === 0 ? (
                <div className="px-6 py-[26px] text-center text-[13.5px] text-ga-muted">{progress.length === 0 ? t('progressEmptyNone') : t('progressEmptyFilter')}</div>
              ) : visibleProgress.slice(0, 50).map((r, i) => (
                <div key={r.studentId} className="grid items-center gap-2 px-5 py-2.5 transition-colors hover:bg-ga-surface" style={{ gridTemplateColumns: '1.4fr 100px 90px 90px 1fr', borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                  <span className="min-w-0"><span className="block truncate text-[13.5px] font-semibold text-ga-ink">{r.name}</span><span className="block text-[11px] text-ga-muted">#{r.studentId}</span></span>
                  <span className="text-[12.5px] text-ga-muted">W{r.currentWeek}·S{r.currentSessionIndex}</span>
                  <span className="text-[13px] text-ga-ink">{r.completedSessions}</span>
                  <span><span className="px-2 py-0.5 text-[11px] font-bold" style={{ color: 'var(--ga-accent)', background: 'var(--ga-side-active)' }}>{r.planProgressPercent}%</span></span>
                  <span className="text-[12px] text-ga-muted">{r.lastStudyAt ? new Date(r.lastStudyAt).toLocaleDateString('vi-VN') : '—'}</span>
                </div>
              ))}
            </div>

            {/* Wiktionary enrich tool */}
            <div className="mb-3.5 mt-[22px]"><GaCap>{t('wiktionaryCap')}</GaCap></div>
            <div className="border border-ga-line bg-ga-card p-[18px]">
              <div className="flex flex-wrap items-end gap-3">
                <label className="ga-ui flex items-center gap-2 text-[12px] text-ga-muted">{t('wiktionaryLimit')}
                  <input type="number" min={1} max={2000} className={`${selectCls} w-[100px]`} value={wktLimit} onChange={(e) => setWktLimit(Number(e.target.value) || 0)} />
                </label>
                <label className="ga-ui flex items-center gap-1.5 text-[12px] text-ga-muted">
                  <input type="checkbox" checked={wktReset} onChange={(e) => setWktReset(e.target.checked)} style={{ accentColor: 'var(--ga-accent)' }} /> {t('wiktionaryReset')}
                </label>
                <GaBtn variant="primary" size="sm" loading={wktRunning} onClick={runWiktionary}>
                  {wktRunning ? t('wiktionaryRunning') : t('wiktionaryRun')}
                </GaBtn>
              </div>
              {wktResult && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
                  {([[t('wktProcessed'), wktResult.processedRows], [t('wktIpa'), wktResult.ipaFilled], [t('wktEn'), wktResult.enUpserts], [t('wktDe'), wktResult.deUpserts], [t('wktFailed'), wktResult.failed], [t('wktRetries'), wktResult.lockRetries], [t('wktCursor'), wktResult.lastProcessedWordId]] as [string, number | undefined][]).map(([k, v]) => (
                    <div key={k} className="border border-ga-line p-2">
                      <p className="ga-ui text-[10px] text-ga-muted">{k}</p>
                      <p className="text-[13px] font-semibold text-ga-ink">{v ?? '—'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
