'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Download, ChevronRight, Scale } from 'lucide-react'
import {
  adminExamGoldenApi,
  type GoldenCompareReport,
  type GoldenSessionRow,
} from '@/lib/adminExamGoldenApi'
import { apiMessage } from '@/lib/api'
import { GaPageHdr, GaCard, GaCap, GaBtn, TkSeg, TkBadge, LoadingState, ErrorBanner } from '@/components/ui-v2'

const LEVELS = ['', 'A1', 'A2', 'B1', 'B2'] as const
// Gate ra mắt (kế hoạch mục G): đồng thuận đạt/trượt ≥85%, ±1 band ≥90%.
const GATE_PASS_PCT = 85
const GATE_WITHIN1_PCT = 90

/** G.1 Golden set: danh sách phiên mock cần chấm tay + báo cáo đồng thuận máy↔người + CSV. */
export default function AdminExamGoldenPage() {
  const t = useTranslations('v2.adminOps.examGolden')
  const [provider, setProvider] = useState('')
  const [level, setLevel] = useState('')
  const [sessions, setSessions] = useState<GoldenSessionRow[]>([])
  const [report, setReport] = useState<GoldenCompareReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const params = useCallback(
    () => ({ ...(provider ? { provider } : {}), ...(level ? { level } : {}) }),
    [provider, level],
  )

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    Promise.all([adminExamGoldenApi.listSessions(params()), adminExamGoldenApi.compare(params())])
      .then(([s, c]) => {
        if (!alive) return
        setSessions(s.data)
        setReport(c.data)
      })
      .catch((e) => alive && setError(apiMessage(e)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [params])

  const downloadCsv = async () => {
    try {
      const { data } = await adminExamGoldenApi.exportCsv(params())
      const url = URL.createObjectURL(new Blob([data], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'golden-set.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(apiMessage(e))
    }
  }

  const unrated = sessions.filter((s) => s.raters.length === 0)

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <a href="/v2/admin" className="ga-ui inline-flex items-center gap-1.5 rounded-ga border border-ga-line bg-ga-card px-4 py-2.5 text-[13px] font-semibold text-ga-ink hover:bg-ga-surface">
            <ArrowLeft size={14} aria-hidden /> {t('back')}
          </a>
        }
      />
      <div className="flex-1 space-y-5 px-4 py-5 sm:px-6 lg:px-10">
        {error && <ErrorBanner message={error} onRetry={() => setError(null)} retryLabel={t('dismiss')} />}

        <div className="flex flex-wrap items-center gap-3">
          <TkSeg
            aria-label={t('providerLabel')}
            value={provider}
            onValueChange={setProvider}
            options={[
              { value: '', label: t('all') },
              { value: 'GOETHE', label: 'Goethe' },
              { value: 'TELC', label: 'telc' },
            ]}
          />
          <TkSeg
            aria-label={t('levelLabel')}
            value={level}
            onValueChange={setLevel}
            options={LEVELS.map((l) => ({ value: l, label: l === '' ? t('all') : l }))}
          />
          <GaBtn variant="ghost" size="sm" onClick={() => void downloadCsv()} data-testid="golden-csv">
            <Download size={14} aria-hidden className="mr-1.5" /> {t('exportCsv')}
          </GaBtn>
        </div>

        {loading ? (
          <LoadingState label={t('loading')} />
        ) : (
          <>
            {report && (
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="golden-aggregate">
                <StatCard label={t('ratedSessions')} value={`${report.sessions}`} sub={t('raterPairs', { n: report.ratedPairs })} />
                <GateCard label={t('passAgree')} pct={report.passAgreePct} gate={GATE_PASS_PCT} t={t} />
                <GateCard label={t('within1')} pct={report.within1BandPct} gate={GATE_WITHIN1_PCT} t={t} />
                <StatCard label={t('exactBand')} value={report.exactBandPct === null ? '—' : `${report.exactBandPct}%`} sub={t('exactBandSub')} />
              </section>
            )}

            {report && report.rows.length > 0 && (
              <GaCard className="overflow-x-auto p-4">
                <GaCap className="mb-3 block">{t('compareCap')}</GaCap>
                <table className="ga-ui w-full min-w-[720px] text-left text-[13.5px]" data-testid="golden-compare-table">
                  <thead>
                    <tr className="text-[12px] uppercase tracking-wide text-ga-muted">
                      <th className="py-2 pr-3">{t('colSession')}</th>
                      <th className="py-2 pr-3">{t('colExam')}</th>
                      <th className="py-2 pr-3">{t('colRater')}</th>
                      <th className="py-2 pr-3">{t('colMachine')}</th>
                      <th className="py-2 pr-3">{t('colHuman')}</th>
                      <th className="py-2 pr-3">{t('colBands')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ga-line">
                    {report.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="py-2 pr-3">
                          <a className="font-semibold text-ga-accent underline-offset-2 hover:underline" href={`/v2/admin/exam-golden/${r.sessionId}`}>
                            #{r.sessionId}
                          </a>
                        </td>
                        <td className="py-2 pr-3">{r.provider} {r.level}</td>
                        <td className="py-2 pr-3">{r.rater}</td>
                        <td className="py-2 pr-3 tabular-nums">
                          {r.machine.total} / {r.machine.max} <PassBadge passed={r.machine.passed} t={t} />
                        </td>
                        <td className="py-2 pr-3 tabular-nums">
                          {r.human.total} / {r.human.max} <PassBadge passed={r.human.passed} t={t} />
                        </td>
                        <td className="py-2 pr-3 tabular-nums">
                          {t('bandsCell', { within1: r.bands.within1, exact: r.bands.exact, pairs: r.bands.pairs })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </GaCard>
            )}

            <GaCard className="p-4">
              <GaCap className="mb-3 block">{t('unratedCap', { n: unrated.length })}</GaCap>
              {unrated.length === 0 ? (
                <p className="ga-ui text-[13.5px] text-ga-muted">{t('unratedEmpty')}</p>
              ) : (
                <ul className="divide-y divide-ga-line" data-testid="golden-unrated">
                  {unrated.map((s) => (
                    <li key={s.sessionId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="ga-ui text-[13.5px] text-ga-ink">
                        <span className="font-semibold">#{s.sessionId}</span> · {s.provider} {s.level} ·{' '}
                        <span className="tabular-nums">{s.machineTotal} / {s.machineMax}</span>{' '}
                        <PassBadge passed={s.machinePassed} t={t} />
                        <span className="ml-2 text-[12px] text-ga-muted">{new Date(s.createdAt).toLocaleString()}</span>
                      </div>
                      <a
                        className="ga-ui inline-flex items-center gap-1 rounded-ga bg-ga-ink px-3 py-1.5 text-[12.5px] font-semibold text-ga-bg"
                        href={`/v2/admin/exam-golden/${s.sessionId}`}
                        data-testid={`rate-${s.sessionId}`}
                      >
                        <Scale size={13} aria-hidden /> {t('rateCta')} <ChevronRight size={13} aria-hidden />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </GaCard>
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <GaCard className="p-4">
      <p className="ga-ui text-[12px] uppercase tracking-wide text-ga-muted">{label}</p>
      <p className="font-ga-display mt-1 text-[28px] font-semibold text-ga-ink tabular-nums">{value}</p>
      {sub && <p className="ga-ui mt-0.5 text-[12px] text-ga-muted">{sub}</p>}
    </GaCard>
  )
}

function GateCard({ label, pct, gate, t }: { label: string; pct: number | null; gate: number; t: ReturnType<typeof useTranslations> }) {
  const ok = pct !== null && pct >= gate
  return (
    <GaCard className="p-4">
      <p className="ga-ui text-[12px] uppercase tracking-wide text-ga-muted">{label}</p>
      <p className={`font-ga-display mt-1 text-[28px] font-semibold tabular-nums ${pct === null ? 'text-ga-muted' : ok ? 'text-ga-green' : 'text-ga-red'}`}>
        {pct === null ? '—' : `${pct}%`}
      </p>
      <p className="ga-ui mt-0.5 text-[12px] text-ga-muted">{t('gateNeeds', { gate })}</p>
    </GaCard>
  )
}

function PassBadge({ passed, t }: { passed: boolean | null; t: ReturnType<typeof useTranslations> }) {
  if (passed === null) return <TkBadge tone="neutral">{t('noThreshold')}</TkBadge>
  return <TkBadge tone={passed ? 'green' : 'red'}>{passed ? t('passed') : t('failed')}</TkBadge>
}
