'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, ChevronRight, Quote, Target } from 'lucide-react'
import { examSpeakingApi } from '@/lib/examSpeakingApi'
import { apiMessage } from '@/lib/api'
import type { WeakPointView, WeaknessView } from '@/types/exam-speaking'
import { GaPageHdr, GaCard, GaCap, GaBtn, TkBadge, LoadingState, ErrorBanner } from '@/components/ui-v2'

const ALL = 'ALL'

const severityTone = (sev: string | null): 'red' | 'yellow' | 'neutral' => {
  if (sev === 'BLOCKING') return 'red'
  if (sev === 'MAJOR') return 'yellow'
  return 'neutral'
}

/**
 * Đợt 5a — màn "Ôn yếu điểm" (kế hoạch 2.1 chế độ 3): yếu điểm từ phòng luyện thi gộp theo mã lỗi,
 * lọc theo dạng bài (archetype), kèm gói Redemittel; CTA luyện lại đúng Teil đang yếu.
 */
export default function V2ExamWeaknessPage() {
  const t = useTranslations('v2.student.examSpeaking.weakness')
  const tCat = useTranslations('v2.student.examSpeaking.catalog')
  const router = useRouter()
  const [data, setData] = useState<WeaknessView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [archetype, setArchetype] = useState<string>(ALL)
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    examSpeakingApi
      .getWeakness()
      .then((r) => alive && setData(r.data))
      .catch((e) => alive && setError(apiMessage(e)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const archetypes = useMemo(() => {
    const set = new Set<string>()
    data?.weakPoints.forEach((w) => w.contexts.forEach((c) => set.add(c.archetype)))
    return Array.from(set)
  }, [data])

  const visiblePoints = useMemo(
    () =>
      (data?.weakPoints ?? []).filter(
        (w) => archetype === ALL || w.contexts.some((c) => c.archetype === archetype),
      ),
    [data, archetype],
  )

  const visiblePacks = useMemo(
    () => (data?.packs ?? []).filter((p) => archetype === ALL || p.archetype === archetype),
    [data, archetype],
  )

  const drill = async (w: WeakPointView) => {
    const ctx = archetype === ALL ? w.contexts[0] : (w.contexts.find((c) => c.archetype === archetype) ?? w.contexts[0])
    if (!ctx) return
    setStarting(w.errorCode)
    setError(null)
    try {
      const { data: s } = await examSpeakingApi.createSession({
        provider: ctx.provider,
        level: ctx.level,
        mode: 'DRILL',
        teil: ctx.teilNo,
      })
      router.push(`/v2/student/speaking/exam/session/${s.id}`)
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
          <a
            href="/v2/student/speaking/exam"
            className="ga-ui inline-flex min-h-[40px] items-center gap-1.5 rounded-ga border border-ga-line bg-ga-card px-4 py-2.5 text-[13px] font-semibold text-ga-ink hover:bg-ga-surface lg:min-h-0"
          >
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

        {loading ? (
          <LoadingState label={t('loading')} />
        ) : (
          <>
            {archetypes.length > 0 && (
              <div className="mb-5 flex flex-wrap gap-1.5" role="group" aria-label={t('filterLabel')}>
                {[ALL, ...archetypes].map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setArchetype(a)}
                    aria-pressed={archetype === a}
                    data-testid={`filter-${a}`}
                    className={`ga-ui min-h-[36px] rounded-ga border px-3 text-[12.5px] font-semibold transition-colors ${
                      archetype === a
                        ? 'border-ga-ink bg-ga-ink text-ga-bg'
                        : 'border-ga-line bg-ga-card text-ga-ink hover:bg-ga-surface'
                    }`}
                  >
                    {a === ALL ? t('filterAll') : tCat(`archetype.${a}`)}
                  </button>
                ))}
              </div>
            )}

            {visiblePoints.length === 0 ? (
              <GaCard className="mb-8 p-6">
                <p className="ga-ui flex items-center gap-2 text-[14px] text-ga-ink">
                  <Target size={16} aria-hidden className="text-ga-muted" /> {t('empty')}
                </p>
                <p className="ga-ui mt-1.5 text-[13px] text-ga-muted">{t('emptyHint')}</p>
              </GaCard>
            ) : (
              <div className="mb-8 grid grid-cols-1 gap-[18px] lg:grid-cols-2" data-testid="weak-points">
                {visiblePoints.map((w) => (
                  <GaCard key={w.errorCode} className="flex h-full flex-col p-5" data-testid={`weak-${w.errorCode}`}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <code className="ga-ui rounded bg-ga-surface px-2 py-0.5 text-[12px] font-semibold text-ga-ink">
                        {w.errorCode}
                      </code>
                      <span className="flex items-center gap-1.5">
                        {w.lastSeverity && (
                          <TkBadge tone={severityTone(w.lastSeverity)}>{t(`severity.${w.lastSeverity}`)}</TkBadge>
                        )}
                        <TkBadge tone="neutral">{t('seenCount', { count: w.totalCount })}</TkBadge>
                      </span>
                    </div>
                    {w.ruleVi && <p className="ga-ui text-[13.5px] text-ga-ink">{w.ruleVi}</p>}
                    {w.exampleOriginal && (
                      <blockquote className="ga-ui mt-2.5 rounded-ga border border-ga-line bg-ga-surface px-3 py-2.5 text-[13px]">
                        <p className="text-ga-muted line-through">{w.exampleOriginal}</p>
                        {w.exampleCorrection && <p className="mt-1 font-medium text-ga-ink">{w.exampleCorrection}</p>}
                      </blockquote>
                    )}
                    <p className="ga-ui mt-2.5 flex flex-1 flex-wrap content-start gap-1.5">
                      {w.contexts.map((c) => (
                        <TkBadge key={`${c.provider}-${c.level}-${c.teilNo}`} tone="neutral">
                          {c.provider === 'GOETHE' ? 'Goethe' : 'telc'} {c.level} · Teil {c.teilNo}
                        </TkBadge>
                      ))}
                    </p>
                    <GaBtn
                      variant="ghost"
                      size="md"
                      className="mt-3.5 justify-between"
                      onClick={() => void drill(w)}
                      disabled={starting !== null}
                      data-testid={`drill-${w.errorCode}`}
                    >
                      {starting === w.errorCode ? t('starting') : t('drillCta')} <ChevronRight size={14} aria-hidden />
                    </GaBtn>
                  </GaCard>
                ))}
              </div>
            )}

            {visiblePacks.length > 0 && (
              <section>
                <GaCap className="mb-3 block">{t('redemittelCap')}</GaCap>
                <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2 lg:grid-cols-3" data-testid="redemittel-packs">
                  {visiblePacks.map((p) => (
                    <GaCard key={p.archetype} className="p-5">
                      <p className="mb-2.5 flex items-center gap-2 font-ga-display text-[16px] font-medium text-ga-ink">
                        <Quote size={14} aria-hidden className="text-ga-muted" /> {tCat(`archetype.${p.archetype}`)}
                      </p>
                      <ul className="ga-ui space-y-1.5 text-[13.5px] text-ga-ink">
                        {p.phrases.map((ph) => (
                          <li key={ph} className="border-l-2 border-ga-yellow pl-2.5">
                            {ph}
                          </li>
                        ))}
                      </ul>
                    </GaCard>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
