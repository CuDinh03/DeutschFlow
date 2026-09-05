'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Search } from 'lucide-react'
import { adminAiUsageApi, type AiUsageReport } from '@/lib/adminAiUsageApi'
import { apiMessage } from '@/lib/api'
import { GaPageHdr, GaCard, GaCap, GaBtn, LoadingState, ErrorBanner } from '@/components/ui-v2'

const DEFAULT_PREFIX = 'EXAM_SPEAKING'

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

const nf = new Intl.NumberFormat('vi-VN')
const usd = (v: number) => `$${v.toFixed(v < 1 ? 4 : 2)}`

/**
 * AI usage (N0.6 / T.3): token theo feature × model, giây STT, top phiên tốn nhất — trả lời "một mock A1/B1
 * tốn bao nhiêu" từ ledger thật. Mặc định lọc EXAM_SPEAKING (lượt nói, chấm nhanh, chấm mock, STT phòng thi).
 */
export default function AdminAiUsagePage() {
  const t = useTranslations('v2.adminOps.aiUsage')
  const [from, setFrom] = useState(isoDaysAgo(30))
  const [to, setTo] = useState(isoDaysAgo(0))
  const [prefix, setPrefix] = useState(DEFAULT_PREFIX)
  const [report, setReport] = useState<AiUsageReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await adminAiUsageApi.report({ from, to, featurePrefix: prefix.trim() || undefined })
      setReport(data)
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [from, to, prefix])

  useEffect(() => {
    void load()
    // Chỉ nạp lần đầu; đổi bộ lọc → bấm Áp dụng (tránh bắn query mỗi ký tự gõ).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const inputCls = 'ga-ui h-10 rounded-ga border border-ga-line bg-ga-card px-3 text-ga-small text-ga-ink'

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <a href="/v2/admin" className="ga-ui inline-flex items-center gap-1.5 rounded-ga border border-ga-line bg-ga-card px-4 py-2.5 text-ga-small font-semibold text-ga-ink hover:bg-ga-surface">
            <ArrowLeft size={14} aria-hidden /> {t('back')}
          </a>
        }
      />
      <div className="flex-1 space-y-5 px-4 py-5 sm:px-6 lg:px-10">
        {error && <ErrorBanner message={error} onRetry={() => setError(null)} retryLabel={t('dismiss')} />}

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void load()
          }}
          data-testid="ai-usage-filters"
        >
          <label className="ga-ui flex flex-col gap-1 text-ga-caption text-ga-muted">
            {t('from')}
            <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} data-testid="ai-usage-from" />
          </label>
          <label className="ga-ui flex flex-col gap-1 text-ga-caption text-ga-muted">
            {t('to')}
            <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} data-testid="ai-usage-to" />
          </label>
          <label className="ga-ui flex flex-col gap-1 text-ga-caption text-ga-muted">
            {t('featurePrefix')}
            <input type="text" className={`${inputCls} w-56`} value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder={DEFAULT_PREFIX} data-testid="ai-usage-prefix" />
          </label>
          <GaBtn variant="ink" size="md" type="submit" disabled={loading} data-testid="ai-usage-apply">
            <Search size={14} aria-hidden className="mr-1.5" /> {t('apply')}
          </GaBtn>
        </form>

        {loading ? (
          <LoadingState label={t('loading')} />
        ) : report ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="ai-usage-totals">
              <Stat label={t('totalCalls')} value={nf.format(report.totals.calls)} />
              <Stat label={t('totalTokens')} value={nf.format(report.totals.totalTokens)} />
              <Stat label={t('totalStt')} value={`${nf.format(Math.round(report.totals.sttSeconds))} s`} />
              <Stat label={t('totalCost')} value={`${nf.format(report.totals.estVnd)} ₫`} sub={`${usd(report.totals.estUsd)} · ${t('rateNote', { rate: nf.format(report.usdVndRate) })}`} />
            </section>

            <GaCard className="overflow-x-auto p-4">
              <GaCap className="mb-3 block">{t('byFeature')}</GaCap>
              {report.rows.length === 0 ? (
                <p className="ga-ui text-ga-small text-ga-muted">{t('empty')}</p>
              ) : (
                <table className="ga-ui w-full min-w-[760px] text-left text-ga-small" data-testid="ai-usage-rows">
                  <thead>
                    <tr className="text-ga-eyebrow uppercase text-ga-muted">
                      <th className="py-2 pr-3">{t('colFeature')}</th>
                      <th className="py-2 pr-3">{t('colModel')}</th>
                      <th className="py-2 pr-3 text-right">{t('colCalls')}</th>
                      <th className="py-2 pr-3 text-right">{t('colPrompt')}</th>
                      <th className="py-2 pr-3 text-right">{t('colCached')}</th>
                      <th className="py-2 pr-3 text-right">{t('colCompletion')}</th>
                      <th className="py-2 pr-3 text-right">{t('colTotal')}</th>
                      <th className="py-2 pr-3 text-right">{t('colCost')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ga-line">
                    {report.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="py-2 pr-3 font-semibold text-ga-ink">{r.feature || '—'}</td>
                        <td className="py-2 pr-3 text-ga-muted">{r.model || '—'}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{nf.format(r.calls)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{nf.format(r.promptTokens)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{nf.format(r.cachedPromptTokens)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{nf.format(r.completionTokens)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{nf.format(r.totalTokens)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{nf.format(r.estVnd)} ₫ <span className="text-ga-muted">({usd(r.estUsd)})</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </GaCard>

            <div className="grid gap-5 lg:grid-cols-2">
              <GaCard className="overflow-x-auto p-4">
                <GaCap className="mb-3 block">{t('stt')}</GaCap>
                {report.stt.length === 0 ? (
                  <p className="ga-ui text-ga-small text-ga-muted">{t('empty')}</p>
                ) : (
                  <table className="ga-ui w-full text-left text-ga-small" data-testid="ai-usage-stt">
                    <thead>
                      <tr className="text-ga-eyebrow uppercase text-ga-muted">
                        <th className="py-2 pr-3">{t('colFeature')}</th>
                        <th className="py-2 pr-3 text-right">{t('colCalls')}</th>
                        <th className="py-2 pr-3 text-right">{t('colSeconds')}</th>
                        <th className="py-2 pr-3 text-right">{t('colCost')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ga-line">
                      {report.stt.map((r, i) => (
                        <tr key={i}>
                          <td className="py-2 pr-3 font-semibold text-ga-ink">{r.feature || '—'}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{nf.format(r.calls)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{nf.format(Math.round(r.seconds))}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{nf.format(r.estVnd)} ₫</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </GaCard>

              <GaCard className="overflow-x-auto p-4">
                <GaCap className="mb-3 block">{t('sessions')}</GaCap>
                <p className="ga-ui mb-2 text-ga-caption text-ga-muted">{t('sessionsHint')}</p>
                {report.sessions.length === 0 ? (
                  <p className="ga-ui text-ga-small text-ga-muted">{t('empty')}</p>
                ) : (
                  <table className="ga-ui w-full text-left text-ga-small" data-testid="ai-usage-sessions">
                    <thead>
                      <tr className="text-ga-eyebrow uppercase text-ga-muted">
                        <th className="py-2 pr-3">{t('colSession')}</th>
                        <th className="py-2 pr-3">{t('colFeatures')}</th>
                        <th className="py-2 pr-3 text-right">{t('colCalls')}</th>
                        <th className="py-2 pr-3 text-right">{t('colTotal')}</th>
                        <th className="py-2 pr-3 text-right">{t('colCost')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ga-line">
                      {report.sessions.map((r) => (
                        <tr key={r.sessionId}>
                          <td className="py-2 pr-3 font-semibold text-ga-ink">#{r.sessionId}</td>
                          <td className="py-2 pr-3 text-ga-muted">{r.features}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{nf.format(r.calls)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{nf.format(r.totalTokens)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{nf.format(r.estVnd)} ₫</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </GaCard>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <GaCard className="p-4">
      <GaCap className="block">{label}</GaCap>
      <p className="font-ga-display mt-1 text-ga-stat-m font-semibold leading-none text-ga-ink">{value}</p>
      {sub && <p className="ga-ui mt-1 text-ga-caption text-ga-muted">{sub}</p>}
    </GaCard>
  )
}
