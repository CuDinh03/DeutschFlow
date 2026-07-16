'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Lock, ChevronRight, Clock, ArrowRight } from 'lucide-react'
import { getMockPacks, getMockPack, type MockExamPack, type MockExamPackDetail } from '@/lib/mockPackApi'
import { GaPageHdr, GaCard, GaCap, TkBadge, LoadingState, ErrorBanner } from '@/components/ui-v2'

// Reuse mockPackApi (getMockPacks + getMockPack). Catalog + per-pack exam list. The exam RUNNER
// now lives in v2 (/v2/student/mock-exam/run) — "Bắt đầu" carries the exam id + the pack's level,
// so the runner enters that exam directly instead of asking the user to pick it again.

const LEVEL_COLOR: Record<string, string> = {
  A1: '#1E9E61', A2: '#2F6FC9', B1: '#7C56C8', B2: '#E07B39', C1: '#DA291C',
}

export default function V2StudentMockExamPage() {
  const t = useTranslations('v2.student.mockExam')
  const [packs, setPacks] = useState<MockExamPack[]>([])
  const [openId, setOpenId] = useState<number | null>(null)
  const [detail, setDetail] = useState<MockExamPackDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getMockPacks()
      .then(setPacks)
      .catch(() => setError(t('loadError')))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const toggle = async (p: MockExamPack) => {
    if (p.locked) return
    if (openId === p.id) {
      setOpenId(null)
      return
    }
    setOpenId(p.id)
    setDetail(null)
    setDetailLoading(true)
    try {
      setDetail(await getMockPack(p.id))
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <div className="flex-1 px-10 py-6">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        )}
        {loading ? (
          <LoadingState label={t('loading')} />
        ) : packs.length === 0 ? (
          <div className="border border-ga-line bg-ga-card py-16 text-center">
            <p className="font-ga-display text-[20px] font-medium text-ga-ink">{t('emptyTitle')}</p>
            <p className="ga-ui mt-2 text-[14px] text-ga-muted">{t('emptyDesc')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {packs.map((p) => {
              const color = LEVEL_COLOR[p.cefrLevel?.toUpperCase()] ?? 'var(--ga-accent)'
              const open = openId === p.id
              return (
                <GaCard key={p.id} className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggle(p)}
                    disabled={p.locked}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors enabled:hover:bg-ga-surface disabled:cursor-not-allowed"
                  >
                    <span
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-ga font-ga-display text-[16px] font-medium text-white"
                      style={{ background: color }}
                    >
                      {p.cefrLevel}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[15px] font-semibold text-ga-ink">{p.title}</p>
                        {p.locked && <TkBadge tone="yellow">PRO</TkBadge>}
                      </div>
                      {p.descriptionVi && <p className="ga-ui mt-0.5 truncate text-[13px] text-ga-muted">{p.descriptionVi}</p>}
                      <p className="ga-ui mt-0.5 text-[12px] text-ga-subtle">
                        {t('packMeta', { format: p.examFormat, count: p.examCount })}
                      </p>
                    </div>
                    {p.locked ? (
                      <Lock size={18} className="text-ga-subtle" aria-hidden />
                    ) : (
                      <ChevronRight
                        size={18}
                        className={`text-ga-subtle transition-transform ${open ? 'rotate-90' : ''}`}
                        aria-hidden
                      />
                    )}
                  </button>

                  {open && (
                    <div className="border-t border-ga-border bg-ga-surface px-5 py-4">
                      {detailLoading ? (
                        <LoadingState label={t('detailLoading')} />
                      ) : detail && detail.exams.length > 0 ? (
                        <div className="space-y-2">
                          {detail.exams.map((ex) => (
                            <div key={ex.id} className="flex items-center gap-3 border border-ga-line bg-ga-card px-4 py-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-[14px] font-semibold text-ga-ink">{ex.title}</p>
                                <p className="ga-ui mt-0.5 flex items-center gap-3 text-[12px] text-ga-muted">
                                  {ex.timeLimitMinutes != null && (
                                    <span className="inline-flex items-center gap-1">
                                      <Clock size={12} aria-hidden /> {t('examTime', { minutes: ex.timeLimitMinutes })}
                                    </span>
                                  )}
                                  {ex.totalPoints != null && <span>{t('examPoints', { points: ex.totalPoints })}</span>}
                                  {ex.passPoints != null && <span>{t('examPass', { points: ex.passPoints })}</span>}
                                </p>
                              </div>
                              <a
                                href={`/v2/student/mock-exam/run?examId=${ex.id}&level=${encodeURIComponent(p.cefrLevel ?? '')}`}
                                className="ga-ui inline-flex shrink-0 items-center gap-1 rounded-ga bg-ga-accent px-3.5 py-2 text-[12.5px] font-semibold text-ga-accent-ink"
                              >
                                {t('start')} <ArrowRight size={13} aria-hidden />
                              </a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="ga-ui py-3 text-center text-[13px] text-ga-muted">{t('noExams')}</p>
                      )}
                    </div>
                  )}
                </GaCard>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
