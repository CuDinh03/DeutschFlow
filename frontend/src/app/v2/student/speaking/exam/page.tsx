'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { GraduationCap, Mic, ArrowLeft, ChevronRight, Clock, Users } from 'lucide-react'
import { examSpeakingApi } from '@/lib/examSpeakingApi'
import { apiMessage } from '@/lib/api'
import type { BlueprintSummary, ExamProvider, ExamResultView } from '@/types/exam-speaking'
import { GaPageHdr, GaCard, GaCap, GaBtn, TkSeg, TkBadge, LoadingState, ErrorBanner } from '@/components/ui-v2'

const SESSION_HREF = (id: number) => `/v2/student/speaking/exam/session/${id}`
// Đợt 1 chỉ mở A1 (ngân hàng đề A1 đã seed). A2–B2 có blueprint nhưng chưa có đề → hiện "sắp có".
const OPEN_LEVELS = new Set(['A1'])
const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const

/** Catalog phòng luyện thi nói: chọn hệ (Goethe/telc) × cấp × chế độ (drill từng Teil / mock trọn gói). */
export default function V2ExamSpeakingCatalogPage() {
  const t = useTranslations('v2.student.examSpeaking.catalog')
  const router = useRouter()
  const [provider, setProvider] = useState<ExamProvider>('GOETHE')
  const [level, setLevel] = useState<string>('A1')
  const [blueprints, setBlueprints] = useState<BlueprintSummary[]>([])
  const [results, setResults] = useState<ExamResultView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([examSpeakingApi.listBlueprints(), examSpeakingApi.listResults().catch(() => ({ data: [] as ExamResultView[] }))])
      .then(([b, r]) => {
        if (!alive) return
        setBlueprints(b.data)
        setResults(r.data)
      })
      .catch((e) => alive && setError(apiMessage(e)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const blueprint = useMemo(
    () => blueprints.find((b) => b.provider === provider && b.level === level) ?? null,
    [blueprints, provider, level],
  )
  const open = OPEN_LEVELS.has(level)

  const start = async (mode: 'DRILL' | 'MOCK', teil?: number) => {
    const key = `${mode}-${teil ?? 'all'}`
    setStarting(key)
    setError(null)
    try {
      const { data } = await examSpeakingApi.createSession({ provider, level, mode, teil })
      router.push(SESSION_HREF(data.id))
    } catch (e) {
      setError(apiMessage(e))
      setStarting(null)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <a href="/v2/student/speaking" className="ga-ui inline-flex min-h-[40px] items-center gap-1.5 rounded-ga border border-ga-line bg-ga-card px-4 py-2.5 text-[13px] font-semibold text-ga-ink hover:bg-ga-surface lg:min-h-0">
            <ArrowLeft size={14} aria-hidden /> {t('back')}
          </a>
        }
      />
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={() => setError(null)} retryLabel={t('dismiss')} />
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <TkSeg
            aria-label={t('providerLabel')}
            value={provider}
            onValueChange={(v) => setProvider(v)}
            options={[
              { value: 'GOETHE', label: 'Goethe' },
              { value: 'TELC', label: 'telc' },
            ]}
          />
          <div className="flex gap-1.5" role="group" aria-label={t('levelLabel')}>
            {LEVELS.map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => setLevel(lv)}
                aria-pressed={level === lv}
                className={`ga-ui min-h-[40px] rounded-ga border px-3.5 text-[13px] font-semibold transition-colors lg:min-h-[36px] ${
                  level === lv ? 'border-ga-ink bg-ga-ink text-ga-bg' : 'border-ga-line bg-ga-card text-ga-ink hover:bg-ga-surface'
                }`}
                data-testid={`level-${lv}`}
              >
                {lv}
                {!OPEN_LEVELS.has(lv) && <span className="ml-1 text-[10px] font-normal opacity-70">{t('soon')}</span>}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <LoadingState label={t('loading')} />
        ) : !blueprint ? (
          <ErrorBanner message={t('noBlueprint')} />
        ) : (
          <>
            <div className="mb-[22px] flex flex-col items-start gap-4 bg-ga-ink p-5 text-ga-bg md:flex-row md:items-center md:justify-between lg:p-7">
              <div className="min-w-0">
                <GaCap className="mb-2 block" style={{ color: '#A39E94' }}>{t('mockCap')}</GaCap>
                <p className="font-ga-display text-[22px] font-medium lg:text-[26px]">{blueprint.title}</p>
                <p className="ga-ui mt-1.5 flex flex-wrap gap-x-4 text-[13.5px]" style={{ color: '#A39E94' }}>
                  <span className="inline-flex items-center gap-1"><Clock size={13} aria-hidden /> {t('duration', { min: Math.round(blueprint.parts.reduce((s, p) => s + p.durationSec, 0) / 60) })}</span>
                  {blueprint.prepSec > 0 && <span>{t('prep', { min: Math.round(blueprint.prepSec / 60) })}</span>}
                  <span className="inline-flex items-center gap-1"><Users size={13} aria-hidden /> {t('partnerAi')}</span>
                  <span>{t('scale', { scale: blueprint.rubricScale === 'VHN' ? t('scaleVhn') : blueprint.rubricScale.replace('_', '–'), max: blueprint.maxTotal })}</span>
                </p>
                <p className="ga-ui mt-2 text-[12.5px]" style={{ color: '#A39E94' }}>{t('mockDesc')}</p>
              </div>
              <GaBtn variant="yellow" size="lg" onClick={() => void start('MOCK')} disabled={!open || starting !== null} data-testid="start-mock">
                <Mic size={16} aria-hidden className="mr-2" /> {starting === 'MOCK-all' ? t('starting') : t('startMock')}
              </GaBtn>
            </div>

            <GaCap className="mb-3 block">{t('drillCap')}</GaCap>
            <div className="grid grid-cols-1 gap-[18px] md:grid-cols-3">
              {blueprint.parts.map((p) => (
                <GaCard key={p.teilNo} className="flex h-full flex-col p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-ga bg-ga-yellow-soft font-ga-display text-[18px] font-semibold text-ga-ink">{p.teilNo}</span>
                    <TkBadge tone="neutral">{Math.round(p.durationSec / 60)}′</TkBadge>
                  </div>
                  <p className="font-ga-display text-[18px] font-medium text-ga-ink">{p.title}</p>
                  <p className="ga-ui mt-1 flex-1 text-[13px] text-ga-muted">{t(`archetype.${p.archetype}`)}</p>
                  <GaBtn variant="ghost" size="md" className="mt-4 justify-between" onClick={() => void start('DRILL', p.teilNo)} disabled={!open || starting !== null} data-testid={`start-drill-${p.teilNo}`}>
                    {starting === `DRILL-${p.teilNo}` ? t('starting') : t('startDrill')} <ChevronRight size={14} aria-hidden />
                  </GaBtn>
                </GaCard>
              ))}
            </div>

            {!open && <p className="ga-ui mt-4 text-[13px] text-ga-muted">{t('levelSoon', { level })}</p>}
          </>
        )}

        {results.length > 0 && (
          <section className="mt-8">
            <GaCap className="mb-3 block">{t('recentCap')}</GaCap>
            <ul className="divide-y divide-ga-line rounded-ga border border-ga-line bg-ga-card">
              {results.map((r) => (
                <li key={r.sessionId}>
                  <a href={SESSION_HREF(r.sessionId)} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-ga-surface">
                    <span className="ga-ui text-[14px] text-ga-ink">
                      <GraduationCap size={14} aria-hidden className="mr-1.5 inline" />
                      {r.provider === 'GOETHE' ? 'Goethe' : 'telc'} {r.level} · {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="ga-ui text-[14px] font-semibold tabular-nums text-ga-ink">{r.total ?? '–'} / {r.max ?? '–'}</span>
                      {r.passed === true && <TkBadge tone="green">{t('passed')}</TkBadge>}
                      {r.passed === false && <TkBadge tone="red">{t('failed')}</TkBadge>}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="ga-ui mt-8 text-[12px] text-ga-muted">{t('disclaimer')}</p>
      </div>
    </div>
  )
}
