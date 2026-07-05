'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import api, { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn, GaCap, TkStatStrip } from '@/components/ui-v2'

// Báo cáo chất lượng từ vựng (admin) — navy.
// GET /api/admin/reports/vocabulary-quality?days=N
//   → { nounGenderCoverage: {days, items: WordCoverageResponse[]},
//       translationCoverage: {days, items: WordTranslationCoverageResponse[]} }

interface NounItem {
  date: string
  totalWords: number
  nounWords: number
  nounWithGender: number
  nounCoveragePercent: number
  verbWords: number
  verbCoveragePercent: number
}
interface TransItem {
  date: string
  totalWords: number
  deCoveragePercent: number
  viCoveragePercent: number
  enCoveragePercent: number
  allLocalesCoveragePercent: number
}
interface Data {
  nounGenderCoverage?: { days: number; items: NounItem[] }
  translationCoverage?: { days: number; items: TransItem[] }
}
const selectCls = 'ga-ui border border-ga-line bg-ga-bg px-2.5 py-1.5 text-[12px] text-ga-ink outline-none'
const pct = (n: number | undefined) => `${Math.round(Number(n ?? 0))}%`
function coverageColor(p: number): string {
  if (p >= 80) return 'var(--ga-green)'
  if (p >= 50) return 'var(--ga-orange)'
  return 'var(--ga-red)'
}

/** Daily coverage bar row. */
function CovRow({ date, value, right, idx }: { date: string; value: number; right: string; idx: number }) {
  return (
    <div className="px-5 py-3" style={{ borderTop: idx ? '1px solid var(--ga-line)' : 'none' }}>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[12.5px]">
        <span className="font-mono text-ga-muted">{(date ?? '').slice(0, 10)}</span>
        <span className="shrink-0 font-semibold text-ga-ink">{right}</span>
      </div>
      <span className="block h-1.5 bg-ga-line">
        <span
          className="block h-full"
          style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: coverageColor(value) }}
        />
      </span>
    </div>
  )
}

export default function V2VocabularyQualityPage() {
  const t = useTranslations('v2.adminContent.reportVocabQuality')
  const tc = useTranslations('v2.common')
  const router = useRouter()
  const [data, setData] = useState<Data | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: res } = await api.get<Data>(`/admin/reports/vocabulary-quality?days=${days}`)
      setData(res)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [days])
  useEffect(() => {
    void load()
  }, [load])

  const nounItems = data?.nounGenderCoverage?.items ?? []
  const transItems = data?.translationCoverage?.items ?? []
  const latestNoun = nounItems[nounItems.length - 1]
  const latestTrans = transItems[transItems.length - 1]
  const empty = nounItems.length === 0 && transItems.length === 0

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <div className="flex items-center gap-2">
            <select className={selectCls} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label={t('rangeAria')}>
              {[7, 14, 30, 90].map((d) => (
                <option key={d} value={d}>
                  {t('rangeDays', { days: d })}
                </option>
              ))}
            </select>
            <GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/admin/reports')}>
              <ArrowLeft size={15} /> {t('backToReports')}
            </GaBtn>
          </div>
        }
      />
      <div className="flex-1 overflow-auto px-10 py-6">
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ga-shimmer h-[44px] border border-ga-line" aria-hidden />
            ))}
          </div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">
              {error} <code className="font-mono text-[12px] text-ga-accent">GET /api/admin/reports/vocabulary-quality</code>
            </p>
            <GaBtn variant="primary" onClick={load}>
              {tc('retry')}
            </GaBtn>
          </div>
        ) : empty ? (
          <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">
            {t('emptyRange', { days })}
          </div>
        ) : (
          <>
            <TkStatStrip
              items={[
                { label: t('statTotal'), value: (latestNoun?.totalWords ?? latestTrans?.totalWords ?? 0).toLocaleString() },
                { label: t('statNounGender'), value: pct(latestNoun?.nounCoveragePercent), sub: t('statNounGenderSub'), color: '#1E9E61' },
                { label: t('statTranslationVi'), value: pct(latestTrans?.viCoveragePercent), sub: t('statTranslationViSub'), color: '#2F6FC9' },
                { label: t('statAllLocales'), value: pct(latestTrans?.allLocalesCoveragePercent), sub: t('statAllLocalesSub'), color: '#E07B39' },
              ]}
            />

            <div className="mt-[22px] grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Noun-gender + verb coverage */}
              <div>
                <div className="mb-3.5">
                  <GaCap>{t('nounCap')}</GaCap>
                </div>
                <div className="border border-ga-line bg-ga-card">
                  {nounItems.length === 0 ? (
                    <div className="px-6 py-[30px] text-center text-[13px] text-ga-muted">{t('noData')}</div>
                  ) : (
                    nounItems
                      .slice(-14)
                      .map((r, i) => (
                        <CovRow
                          key={r.date}
                          idx={i}
                          date={r.date}
                          value={r.nounCoveragePercent}
                          right={t('nounRight', { pct: pct(r.nounCoveragePercent), withGender: r.nounWithGender, nounWords: r.nounWords })}
                        />
                      ))
                  )}
                </div>
              </div>

              {/* Translation coverage */}
              <div>
                <div className="mb-3.5">
                  <GaCap>{t('translationCap')}</GaCap>
                </div>
                <div className="border border-ga-line bg-ga-card">
                  {transItems.length === 0 ? (
                    <div className="px-6 py-[30px] text-center text-[13px] text-ga-muted">{t('noData')}</div>
                  ) : (
                    transItems
                      .slice(-14)
                      .map((r, i) => (
                        <CovRow
                          key={r.date}
                          idx={i}
                          date={r.date}
                          value={r.viCoveragePercent}
                          right={t('transRight', { vi: pct(r.viCoveragePercent), en: pct(r.enCoveragePercent) })}
                        />
                      ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
