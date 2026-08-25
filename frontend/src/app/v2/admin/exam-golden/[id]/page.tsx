'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Save } from 'lucide-react'
import {
  adminExamGoldenApi,
  type GoldenDetail,
  type GoldenSaveResult,
  type GoldenSheetCriterion,
} from '@/lib/adminExamGoldenApi'
import { apiMessage } from '@/lib/api'
import { GaPageHdr, GaCard, GaCap, GaBtn, TkBadge, LoadingState, ErrorBanner } from '@/components/ui-v2'

const keyOf = (teilNo: number, code: string) => (teilNo === 0 ? `G:${code}` : `T${teilNo}:${code}`)

/**
 * G.1 Phiếu chấm tay của giám khảo người: transcript đóng băng bên trái, phiếu band đúng rubric hệ
 * bên phải (band máy hiện mờ cạnh từng tiêu chí để đối chiếu). Điểm người chấm do backend tính lại
 * bằng RubricScorer — người chấm KHÔNG nhập số.
 */
export default function AdminExamGoldenRatePage() {
  const params = useParams<{ id: string }>()
  const sessionId = Number(params?.id)
  const t = useTranslations('v2.adminOps.examGolden')
  const [detail, setDetail] = useState<GoldenDetail | null>(null)
  const [bands, setBands] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<GoldenSaveResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    adminExamGoldenApi
      .detail(sessionId)
      .then(({ data }) => {
        if (!alive) return
        setDetail(data)
        setBands(Object.fromEntries(data.myRatings.map((r) => [keyOf(r.teilNo, r.criterionCode), r.band])))
      })
      .catch((e) => alive && setError(apiMessage(e)))
    return () => {
      alive = false
    }
  }, [sessionId])

  const turnsByTeil = useMemo(() => {
    const m = new Map<number, GoldenDetail['turns']>()
    detail?.turns.forEach((l) => {
      if (!m.has(l.teilNo)) m.set(l.teilNo, [])
      m.get(l.teilNo)!.push(l)
    })
    return m
  }, [detail])

  const save = async () => {
    if (!detail) return
    setSaving(true)
    setError(null)
    try {
      const ratings = Object.entries(bands).map(([k, band]) => {
        const [pre, code] = k.split(':')
        return { teilNo: pre === 'G' ? 0 : Number(pre.slice(1)), criterionCode: code, band }
      })
      const { data } = await adminExamGoldenApi.saveRatings(sessionId, ratings)
      setSaved(data)
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (error && !detail) return <ErrorBanner variant="page" message={error} />
  if (!detail) return <LoadingState label={t('loading')} />

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('rateTitle', { id: detail.sessionId })}
        subtitle={`${detail.provider} ${detail.level} · ${new Date(detail.createdAt).toLocaleString()}`}
        right={
          <a href="/v2/admin/exam-golden" className="ga-ui inline-flex items-center gap-1.5 rounded-ga border border-ga-line bg-ga-card px-4 py-2.5 text-[13px] font-semibold text-ga-ink hover:bg-ga-surface">
            <ArrowLeft size={14} aria-hidden /> {t('back')}
          </a>
        }
      />
      <div className="flex-1 space-y-4 px-4 py-5 sm:px-6 lg:px-10">
        {error && <ErrorBanner message={error} onRetry={() => setError(null)} retryLabel={t('dismiss')} />}

        {saved && (
          <GaCard className="border-2 border-ga-accent p-4" data-testid="golden-saved">
            <GaCap className="mb-2 block">{t('savedCap')}</GaCap>
            <p className="ga-ui text-[14px] text-ga-ink">
              {t('savedHuman')}: <strong className="tabular-nums">{saved.human.total} / {saved.human.max}</strong>{' '}
              <Pass passed={saved.human.passed} t={t} /> · {t('savedMachine')}:{' '}
              <strong className="tabular-nums">{saved.machine.total} / {saved.machine.max}</strong>{' '}
              <Pass passed={saved.machine.passed} t={t} />
            </p>
            <p className="ga-ui mt-1 text-[13px] text-ga-muted">
              {t('savedAgree', {
                pass: saved.passAgree === null ? '—' : saved.passAgree ? '✓' : '✗',
                within1: saved.bands.within1,
                exact: saved.bands.exact,
                pairs: saved.bands.pairs,
              })}
            </p>
          </GaCard>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
          <section className="space-y-4">
            {Array.from(turnsByTeil.entries()).map(([teil, lines]) => (
              <GaCard key={teil} className="p-4">
                <GaCap className="mb-2 block">{t('teilCap', { n: teil })}</GaCap>
                <ol className="space-y-1.5" data-testid={`transcript-${teil}`}>
                  {lines.map((l, i) => (
                    <li key={i} className="ga-ui text-[13.5px] leading-relaxed text-ga-ink">
                      <span className={`mr-1.5 text-[11px] font-bold uppercase ${l.role === 'CANDIDATE' ? 'text-ga-gold' : 'text-ga-muted'}`}>
                        {l.role}
                      </span>
                      {l.transcript}
                    </li>
                  ))}
                </ol>
              </GaCard>
            ))}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            {detail.sheet.parts.map((p) => (
              <GaCard key={p.teilNo} className="p-4">
                <GaCap className="mb-2 block">{t('teilCap', { n: p.teilNo })}</GaCap>
                {p.criteria.map((c) => (
                  <CriterionRow
                    key={c.code}
                    c={c}
                    bands={detail.sheet.bands}
                    value={bands[keyOf(p.teilNo, c.code)]}
                    machine={detail.machineBands[keyOf(p.teilNo, c.code)]}
                    onPick={(b) => setBands((prev) => ({ ...prev, [keyOf(p.teilNo, c.code)]: b }))}
                    t={t}
                  />
                ))}
              </GaCard>
            ))}
            {detail.sheet.global.length > 0 && (
              <GaCard className="p-4">
                <GaCap className="mb-2 block">{t('globalCap')}</GaCap>
                {detail.sheet.global.map((c) => (
                  <CriterionRow
                    key={c.code}
                    c={c}
                    bands={detail.sheet.bands}
                    value={bands[keyOf(0, c.code)]}
                    machine={detail.machineBands[keyOf(0, c.code)]}
                    onPick={(b) => setBands((prev) => ({ ...prev, [keyOf(0, c.code)]: b }))}
                    t={t}
                  />
                ))}
              </GaCard>
            )}
            <GaBtn variant="ink" size="lg" onClick={() => void save()} disabled={saving || Object.keys(bands).length === 0} data-testid="golden-save">
              <Save size={15} aria-hidden className="mr-1.5" /> {saving ? t('saving') : t('save')}
            </GaBtn>
          </aside>
        </div>
      </div>
    </div>
  )
}

function CriterionRow({
  c, bands, value, machine, onPick, t,
}: {
  c: GoldenSheetCriterion
  bands: string[]
  value?: string
  machine?: string
  onPick: (band: string) => void
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <div className="border-b border-ga-line py-2.5 last:border-b-0" data-testid={`criterion-${c.code}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="ga-ui text-[13px] font-semibold text-ga-ink">{c.label || c.code}</span>
        <span className="ga-ui text-[11.5px] text-ga-muted">
          {t('maxPts', { max: c.max })}{machine ? ` · ${t('machineBand', { band: machine })}` : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={c.label || c.code}>
        {bands.map((b) => (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={value === b}
            onClick={() => onPick(b)}
            className={`ga-ui min-w-[44px] rounded-ga border px-2.5 py-1.5 text-[12.5px] font-bold ${
              value === b ? 'border-ga-ink bg-ga-ink text-ga-bg' : 'border-ga-line bg-ga-card text-ga-ink hover:bg-ga-surface'
            }`}
          >
            {b}
          </button>
        ))}
      </div>
    </div>
  )
}

function Pass({ passed, t }: { passed: boolean | null; t: ReturnType<typeof useTranslations> }) {
  if (passed === null) return <TkBadge tone="neutral">{t('noThreshold')}</TkBadge>
  return <TkBadge tone={passed ? 'green' : 'red'}>{passed ? t('passed') : t('failed')}</TkBadge>
}
