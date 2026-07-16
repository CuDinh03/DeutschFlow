'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, BarChart2, RefreshCw, TrendingUp } from 'lucide-react'
import api from '@/lib/api'
import { ARTICLE_COLOR } from '@/lib/vocabWords'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'
import { GaBtn, GaCap, GaCard, GaPageHdr, ErrorBanner, LoadingState } from '@/components/ui-v2'

/**
 * /v2/student/vocabulary/analytics — độ phủ từ vựng (port của /student/vocab-analytics).
 *
 * Giữ nguyên: GET /words/coverage · GET /words/coverage/history?days=30 (lỗi history → mảng rỗng,
 * KHÔNG chặn trang) · PostHog page-time 'vocab_analytics'.
 * ⚠️ Khối der/die/das (số danh từ theo giống) là phần cốt lõi — luôn hiển thị.
 */

interface CoverageData {
  date: string
  totalWords: number
  nounWords: number
  nounRows: number
  nounWithGender: number
  nounDer: number
  nounDie: number
  nounDas: number
  nounCoveragePercent: number
  verbWords: number
  verbRows: number
  verbCoveragePercent: number
}

interface CoverageHistoryPoint {
  date: string
  nounCoveragePercent: number
}

/** Đường xu hướng % danh từ có giống (SVG thuần — không thêm thư viện chart). */
function LineChart({ data, emptyLabel }: { data: CoverageHistoryPoint[]; emptyLabel: string }) {
  if (!data || data.length < 2) {
    return <p className="ga-ui py-8 text-center text-[13px] text-ga-subtle">{emptyLabel}</p>
  }

  const W = 300
  const H = 100
  const PAD = 16
  const maxPct = Math.max(...data.map((d) => d.nounCoveragePercent), 100)
  const minPct = Math.min(...data.map((d) => d.nounCoveragePercent), 0)
  const range = maxPct - minPct || 1

  const pts = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((d.nounCoveragePercent - minPct) / range) * (H - PAD * 2)
    return [x, y] as [number, number]
  })

  const path = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ')
  const area = `${path} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full" role="img" aria-hidden>
      <defs>
        <linearGradient id="ga-coverage-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ga-accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--ga-accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ga-coverage-grad)" />
      <path
        d={path}
        stroke="var(--ga-accent)"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="var(--ga-accent)" />
      ))}
    </svg>
  )
}

export default function V2StudentVocabAnalyticsPage() {
  usePageTimeTracker('vocab_analytics')
  const router = useRouter()
  const t = useTranslations('v2.student.vocabAnalytics')
  const { me, loading: sessionLoading } = useStudentPracticeSession()

  const [coverage, setCoverage] = useState<CoverageData | null>(null)
  const [history, setHistory] = useState<CoverageHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: raw } = await api.get<CoverageData>('/words/coverage')
      if (raw) setCoverage(raw)
      const { data: hist } = await api
        .get<CoverageHistoryPoint[]>('/words/coverage/history', { params: { days: 30 } })
        .catch(() => ({ data: [] as CoverageHistoryPoint[] }))
      setHistory(Array.isArray(hist) ? hist : [])
    } catch {
      setError(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  if (sessionLoading || !me) return <LoadingState label={t('analyzing')} />

  const genderCells = coverage
    ? ([
        ['der', coverage.nounDer, ARTICLE_COLOR.der],
        ['die', coverage.nounDie, ARTICLE_COLOR.die],
        ['das', coverage.nounDas, ARTICLE_COLOR.das],
      ] as const)
    : []

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <GaBtn variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw size={14} aria-hidden /> {t('refresh')}
          </GaBtn>
        }
      />

      <div className="flex-1 px-10 py-6">
        <div className="mx-auto max-w-xl space-y-[22px]">
          <button
            type="button"
            onClick={() => router.push('/v2/student/vocabulary')}
            className="grid h-9 w-9 place-items-center rounded-ga border border-ga-line bg-ga-card text-ga-muted transition-colors hover:bg-ga-surface"
            aria-label={t('back')}
          >
            <ArrowLeft size={16} aria-hidden />
          </button>

          {error && <ErrorBanner message={error} onRetry={fetchData} />}

          {loading ? (
            <LoadingState label={t('analyzing')} />
          ) : coverage ? (
            <>
              <GaCard className="p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="font-ga-display text-[22px] font-medium text-ga-ink">{t('vocabCoverage')}</p>
                    <p className="ga-ui mt-1 text-[13px] text-ga-muted">
                      {coverage.totalWords.toLocaleString()} {t('wordsInSystem')}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-ga border border-ga-line bg-ga-surface p-4 text-center">
                    <p className="font-ga-display text-[28px] font-medium text-ga-ink">
                      {Math.round(coverage.nounCoveragePercent)}%
                    </p>
                    <p className="ga-ui mt-1 text-[12.5px] text-ga-muted">{t('nounsWithGender')}</p>
                    <p className="ga-ui text-[11px] text-ga-subtle">
                      {coverage.nounWithGender.toLocaleString()} / {coverage.nounWords.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-ga border border-ga-line bg-ga-surface p-4 text-center">
                    <p className="font-ga-display text-[28px] font-medium text-ga-ink">
                      {Math.round(coverage.verbCoveragePercent)}%
                    </p>
                    <p className="ga-ui mt-1 text-[12.5px] text-ga-muted">{t('verbsConjugated')}</p>
                    <p className="ga-ui text-[11px] text-ga-subtle">
                      {coverage.verbRows.toLocaleString()} / {coverage.verbWords.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Giống der/die/das — mã màu chuẩn dự án */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {genderCells.map(([g, count, color]) => (
                    <div
                      key={g}
                      className="rounded-ga border bg-ga-card p-3 text-center"
                      style={{ borderColor: `${color}44` }}
                    >
                      <p className="font-ga-display text-[20px] font-medium" style={{ color }}>
                        {Number(count).toLocaleString()}
                      </p>
                      <p className="ga-ui text-[12px] font-semibold" style={{ color }}>
                        {g}
                      </p>
                    </div>
                  ))}
                </div>
              </GaCard>

              <GaCard className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <BarChart2 size={17} className="text-ga-accent" aria-hidden />
                  <GaCap>{t('vocabDetails')}</GaCap>
                </div>
                <div className="space-y-4">
                  {[
                    {
                      label: t('nouns'),
                      pct: Math.round(coverage.nounCoveragePercent),
                      count: `${coverage.nounWithGender.toLocaleString()} / ${coverage.nounWords.toLocaleString()}`,
                      color: 'var(--ga-accent)',
                    },
                    {
                      label: t('verbs'),
                      pct: Math.round(coverage.verbCoveragePercent),
                      count: `${coverage.verbRows.toLocaleString()} / ${coverage.verbWords.toLocaleString()}`,
                      color: 'var(--ga-orange)',
                    },
                  ].map(({ label, pct, count, color }) => (
                    <div key={label}>
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="ga-ui text-[13.5px] font-semibold text-ga-ink">{label}</span>
                        <span className="ga-ui text-[12px] text-ga-muted">
                          {t('wordsRatio', { ratio: count, percent: pct })}
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-ga-pill bg-ga-border">
                        <div
                          className="h-full rounded-ga-pill transition-[width]"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </GaCard>

              {history.length >= 2 && (
                <GaCard className="p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <TrendingUp size={17} className="text-ga-accent" aria-hidden />
                    <GaCap>{t('historyTitle')}</GaCap>
                  </div>
                  <LineChart data={history} emptyLabel={t('historyEmpty')} />
                  <p className="ga-ui mt-2 text-center text-[11px] text-ga-subtle">{t('historyNote')}</p>
                </GaCard>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
