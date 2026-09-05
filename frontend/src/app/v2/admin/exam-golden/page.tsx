'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Download, ChevronRight, Scale, Mic, Trash2, Plus, RefreshCw } from 'lucide-react'
import {
  adminExamGoldenApi,
  REGRADE_BATCH_MAX,
  type GoldenCompareReport,
  type GoldenParticipant,
  type GoldenRegradeBatchResult,
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
  const [batch, setBatch] = useState<GoldenRegradeBatchResult | null>(null)
  const [batching, setBatching] = useState(false)

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

  /** Regression harness (gate §6.3): chỉ phiên đã có giám khảo người chấm; tốn token thật nên hỏi trước. */
  const regradeBatch = async () => {
    if (!window.confirm(t('regradeBatchConfirm', { max: REGRADE_BATCH_MAX }))) return
    setBatching(true)
    setError(null)
    try {
      const { data } = await adminExamGoldenApi.regradeBatch({ ...params(), ratedOnly: true, limit: REGRADE_BATCH_MAX })
      setBatch(data)
      const { data: fresh } = await adminExamGoldenApi.compare(params())
      setReport(fresh)
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setBatching(false)
    }
  }

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
          <GaBtn variant="ghost" size="sm" onClick={() => void regradeBatch()} disabled={batching} data-testid="golden-regrade-batch">
            <RefreshCw size={14} aria-hidden className={`mr-1.5 ${batching ? 'animate-spin' : ''}`} /> {batching ? t('regradeBatchRunning') : t('regradeBatch')}
          </GaBtn>
        </div>

        {batch && (
          <GaCard className="border-2 border-ga-accent p-4" data-testid="golden-regrade-batch-result">
            <GaCap className="mb-1 block">{t('regradeBatchCap')}</GaCap>
            <p className="ga-ui text-ga-small text-ga-ink">
              {t('regradeBatchDone', {
                regraded: batch.regraded, requested: batch.requested, failed: batch.failed,
                passFlips: batch.passFlips, avgDelta: batch.avgTotalDelta, bandChanges: batch.totalBandChanges,
              })}
            </p>
          </GaCard>
        )}

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
                <StatCard label={t('machineBorderline')} value={`${report.machineBorderline ?? 0}`} sub={t('machineBorderlineSub')} />
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
                          {r.machine.total} / {r.machine.max} <PassBadge passed={r.machine.passed} borderline={r.machine.borderline} t={t} />
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

            <ParticipantsCard t={t} />
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Chiến dịch hiệu chuẩn: CHỈ những người trong danh sách này mới được lưu audio phiên mock
 * (quyết định owner 26/08 — không lưu audio đại trà). Xoá khỏi danh sách = rút đồng ý +
 * audio đã lưu bị xoá vĩnh viễn, transcript giữ nguyên.
 */
function ParticipantsCard({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [rows, setRows] = useState<GoldenParticipant[] | null>(null)
  const [userId, setUserId] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    adminExamGoldenApi
      .listParticipants()
      .then((r) => setRows(r.data))
      .catch((e) => setError(apiMessage(e)))
  }, [])

  useEffect(() => load(), [load])

  const add = async () => {
    const id = Number(userId.trim())
    if (!Number.isFinite(id) || id <= 0) return
    setBusy(true)
    setError(null)
    try {
      await adminExamGoldenApi.addParticipant({ userId: id, note: note.trim() || undefined })
      setUserId('')
      setNote('')
      load()
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row: GoldenParticipant) => {
    if (!window.confirm(t('participants.confirmRemove', { name: row.displayName ?? String(row.userId) }))) return
    setBusy(true)
    setError(null)
    try {
      await adminExamGoldenApi.removeParticipant(row.userId)
      load()
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <GaCard className="p-4 lg:p-6" data-testid="calibration-participants">
      <GaCap className="mb-1 block">
        <Mic size={13} aria-hidden className="mr-1 inline" /> {t('participants.cap')}
      </GaCap>
      <p className="ga-ui mb-3 text-[12.5px] text-ga-muted">{t('participants.desc')}</p>

      {error && (
        <div className="mb-3">
          <ErrorBanner message={error} onRetry={() => setError(null)} />
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className="ga-ui min-h-[44px] w-32 rounded-ga border border-ga-line bg-ga-bg px-3 text-[13px] text-ga-ink"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder={t('participants.userIdPlaceholder')}
          aria-label={t('participants.userIdPlaceholder')}
          inputMode="numeric"
          data-testid="participant-user-id"
        />
        <input
          className="ga-ui min-h-[44px] min-w-[180px] flex-1 rounded-ga border border-ga-line bg-ga-bg px-3 text-[13px] text-ga-ink"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('participants.notePlaceholder')}
          aria-label={t('participants.notePlaceholder')}
          data-testid="participant-note"
        />
        <GaBtn variant="ink" size="sm" onClick={() => void add()} disabled={busy || !userId.trim()} data-testid="participant-add">
          <Plus size={14} aria-hidden className="mr-1" /> {t('participants.add')}
        </GaBtn>
      </div>

      {rows === null ? (
        <LoadingState label={t('loading')} />
      ) : rows.length === 0 ? (
        <p className="ga-ui text-[13px] text-ga-muted" data-testid="participants-empty">
          {t('participants.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-ga-line" data-testid="participants-list">
          {rows.map((r) => (
            <li key={r.userId} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="ga-ui truncate text-[13.5px] font-semibold text-ga-ink">
                  {r.displayName ?? `#${r.userId}`} <span className="font-normal text-ga-muted">#{r.userId}</span>
                </p>
                <p className="ga-ui truncate text-[12px] text-ga-muted">
                  {r.email ?? '—'} · {t('participants.consentedAt', { at: new Date(r.consentedAt).toLocaleDateString() })}
                  {r.note ? ` · ${r.note}` : ''}
                </p>
              </div>
              <GaBtn variant="ghost" size="sm" onClick={() => void remove(r)} disabled={busy} aria-label={t('participants.remove')}>
                <Trash2 size={14} aria-hidden />
              </GaBtn>
            </li>
          ))}
        </ul>
      )}
    </GaCard>
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

function PassBadge({ passed, borderline, t }: { passed: boolean | null; borderline?: boolean | null; t: ReturnType<typeof useTranslations> }) {
  if (borderline) return <TkBadge tone="yellow">{t('borderline')}</TkBadge>
  if (passed === null) return <TkBadge tone="neutral">{t('noThreshold')}</TkBadge>
  return <TkBadge tone={passed ? 'green' : 'red'}>{passed ? t('passed') : t('failed')}</TkBadge>
}
