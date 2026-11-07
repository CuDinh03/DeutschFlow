'use client'

import * as React from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronRight, Mic } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import { WRITING_KEY, getPracticeOverview, type PracticeOverview, type PracticeTeil, type WritingEvaluation } from '@/lib/telcPracticeApi'
import { ErrorBanner, GaPageHdr, LoadingState } from '@/components/ui-v2'
import { findTeil, wordCount } from '@/components/exam/practice/practiceModel'

export default function PracticeMapRoute() {
  return (
    <Suspense fallback={<LoadingState label="…" />}>
      <PracticeMapPage />
    </Suspense>
  )
}

const SECTION_ORDER = ['LESEN', 'SPRACHBAUSTEINE', 'HOEREN', 'SCHREIBEN'] as const
const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 })

/**
 * Bản đồ đề của chế độ luyện đề telc: thấy cả đề trên một màn, mỗi Teil một hàng bấm được với trạng
 * thái + điểm + thời lượng gợi ý; khối "Đang làm dở · Làm tiếp"; tiến độ tính trên PHẦN ĐÃ LÀM
 * (không chia cho cả đề — 20/150 sau một Teil làm người học nản). Hören có từ 06/11/2026.
 */
function PracticeMapPage() {
  const t = useTranslations('v2.student.practice')
  const params = useSearchParams()
  const examId = Number(params.get('examId'))
  const [overview, setOverview] = React.useState<PracticeOverview | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    if (!examId) return
    setError(null)
    getPracticeOverview(examId).then(setOverview).catch((e) => setError(apiMessage(e)))
  }, [examId])
  React.useEffect(load, [load])

  if (!examId) return <div className="p-6"><ErrorBanner message={t('badLink')} /></div>

  const teile = overview?.teile ?? []
  const done = teile.filter((x) => x.progress?.checked)
  const earned = done.reduce((s, x) => s + (x.progress?.score ?? 0), 0)
  const possible = done.reduce((s, x) => s + (x.progress?.max ?? 0), 0)
  const pct = possible > 0 ? Math.round((earned / possible) * 100) : null
  const inProgress = teile.find((x) => {
    const p = x.progress
    if (!p || p.checked) return false
    return x.key === WRITING_KEY ? wordCount(p.answers?.text ?? '') > 0 : Object.keys(p.answers ?? {}).length > 0
  })
  const href = (key: string) => `/v2/student/mock-exam/practice/teil?examId=${examId}&teil=${key}`

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('mapTitle')} subtitle={overview?.title ?? t('loading')} />
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        )}
        {!overview && !error && <LoadingState label={t('loading')} />}
        {overview && (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <p className="ga-ui mb-5 max-w-[60ch] text-ga-body text-ga-muted">{t('mapLead')}</p>

              {inProgress && (
                <div className="mb-5 flex flex-wrap items-center gap-4 border-[1.5px] border-ga-ink bg-ga-card px-4 py-3.5">
                  <div className="min-w-[12rem] flex-1">
                    <p className="ga-ui text-ga-caption text-ga-muted">{t('continueCap')}</p>
                    <p className="ga-ui text-ga-body-lg font-semibold text-ga-ink">
                      {t(`section.${inProgress.section}`)} · Teil {inProgress.teil}
                    </p>
                  </div>
                  <Link
                    href={href(inProgress.key)}
                    className="ga-ui inline-flex min-h-11 items-center gap-1.5 rounded-ga-touch bg-ga-yellow px-4 text-ga-body font-semibold text-ga-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
                  >
                    {t('continue')} <ChevronRight size={16} aria-hidden />
                  </Link>
                </div>
              )}

              {SECTION_ORDER.map((section) => {
                const rows = teile.filter((x) => x.section === section)
                if (rows.length === 0) return null
                const max = rows.reduce((s, x) => s + x.maxPoints, 0)
                return (
                  <section key={section} className="mb-4 border border-ga-line bg-ga-card">
                    <div className="flex flex-wrap items-baseline gap-2.5 border-b border-ga-line px-4 py-3">
                      <h2 className="font-ga-display text-ga-h2 text-ga-ink">{t(`sectionDe.${section}`)}</h2>
                      <span className="ga-ui text-ga-small text-ga-muted">
                        {t(`section.${section}`)} · {t('points', { n: fmt(max) })}
                      </span>
                    </div>
                    {rows.map((x) => (
                      <TeilRow key={x.key} teil={x} overview={overview} href={href(x.key)} />
                    ))}
                  </section>
                )
              })}

              <section className="mb-4 border border-ga-line bg-ga-card">
                <div className="flex flex-wrap items-baseline gap-2.5 border-b border-ga-line px-4 py-3">
                  <h2 className="font-ga-display text-ga-h2 text-ga-ink">Mündliche Prüfung</h2>
                  <span className="ga-ui text-ga-small text-ga-muted">{t('oralSub')}</span>
                </div>
                <Link
                  href="/v2/student/speaking/exam"
                  className="ga-ui flex min-h-16 items-center gap-3.5 px-4 py-2.5 hover:bg-ga-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus"
                >
                  <Mic size={18} className="shrink-0 text-ga-muted" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <b className="block text-ga-body-lg font-semibold text-ga-ink">{t('oralTitle')}</b>
                    <span className="block text-ga-small text-ga-muted">{t('oralDesc')}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-ga-subtle" aria-hidden />
                </Link>
              </section>

            </div>

            <aside className="space-y-3.5">
              <div className="border border-ga-line bg-ga-card p-4">
                <p className="ga-ui mb-2 text-ga-eyebrow uppercase text-ga-muted">{t('progressCap')}</p>
                <p className="font-ga-display text-ga-stat tabular-nums text-ga-ink">
                  {done.length}
                  <span className="text-ga-body text-ga-muted"> / {t('teilCount', { n: teile.length })}</span>
                </p>
                <p className="ga-ui mt-1.5 text-ga-small text-ga-muted">
                  {pct == null ? t('progressNone') : t.rich('progressPct', { pct, b: (c) => <b className="text-ga-ink">{c}</b> })}
                </p>
              </div>
              <div className="border border-ga-line bg-ga-card p-4">
                <p className="ga-ui mb-1.5 text-ga-eyebrow uppercase text-ga-muted">{t('passCap')}</p>
                <div className="ga-ui flex justify-between border-b border-dashed border-ga-line py-1.5 text-ga-body">
                  <span>{t('passWritten')}</span>
                  <b>≥ 60%</b>
                </div>
                <div className="ga-ui flex justify-between py-1.5 text-ga-body">
                  <span>{t('passOral')}</span>
                  <b>≥ 60%</b>
                </div>
                <p className="ga-ui mt-1.5 text-ga-small text-ga-muted">{t('passNote')}</p>
              </div>
              <div className="border border-ga-line bg-ga-card p-4">
                <p className="ga-ui mb-1.5 text-ga-eyebrow uppercase text-ga-muted">{t('modeCap')}</p>
                <p className="ga-ui text-ga-small text-ga-muted">{t('modeDesc')}</p>
                <Link
                  href={`/v2/student/mock-exam/full?examId=${examId}`}
                  className="ga-ui mt-2.5 inline-flex min-h-10 items-center gap-1 rounded-ga-touch border-[1.5px] border-ga-line-strong px-3 text-ga-small font-semibold hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
                >
                  {t('fullExam')} <ChevronRight size={14} aria-hidden />
                </Link>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}

function TeilRow({ teil, overview, href }: { teil: PracticeTeil; overview: PracticeOverview; href: string }) {
  const t = useTranslations('v2.student.practice')
  const data = findTeil(overview.sectionsJson, teil.key)
  const p = teil.progress
  const isWriting = teil.key === WRITING_KEY
  let status: React.ReactNode
  if (p?.checked && isWriting) {
    const ev = p.result as WritingEvaluation | null
    const bands = ev?.bands ? Object.values(ev.bands).join(' · ') : ''
    status = (
      <span className="text-right">
        <b className="block text-ga-body text-ga-ink">{fmt(p.score ?? 0)}/{fmt(p.max ?? teil.maxPoints)}</b>
        {bands && <span className="block text-ga-small text-ga-muted">{t('bands', { bands })}</span>}
      </span>
    )
  } else if (p?.checked) {
    const r = p.result as { correctCount?: number; total?: number } | null
    status = (
      <span className="text-right">
        <b className="block text-ga-body text-ga-ink">{fmt(p.score ?? 0)}/{fmt(p.max ?? teil.maxPoints)}</b>
        <span className="block text-ga-small text-ga-muted">{t('rowCorrect', { done: r?.correctCount ?? 0, total: r?.total ?? teil.items })}</span>
      </span>
    )
  } else if (p) {
    const n = isWriting ? wordCount(p.answers?.text ?? '') : Object.keys(p.answers ?? {}).length
    status = (
      <span className="text-right">
        <b className="block text-ga-body text-ga-ink">{t('rowDoing')}</b>
        <span className="block text-ga-small text-ga-muted">{isWriting ? t('rowWords', { n }) : t('rowAnswered', { done: n, total: teil.items })}</span>
      </span>
    )
  } else {
    status = <span className="text-ga-small text-ga-muted">{t('rowNew')}</span>
  }

  const meta = isWriting
    ? t('metaWriting', { minutes: teil.suggestMinutes ?? 30 })
    : t('metaItems', { n: teil.items, minutes: teil.suggestMinutes ?? 10 })

  return (
    <Link
      href={href}
      className="ga-ui flex min-h-[4.25rem] items-center gap-3.5 border-b border-ga-line px-4 py-2.5 last:border-b-0 hover:bg-ga-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus"
    >
      <span className="w-7 shrink-0 text-center font-ga-display text-ga-h2 text-ga-muted">{teil.teil}</span>
      <span className="min-w-0 flex-1">
        <b className="block text-ga-body-lg font-semibold text-ga-ink">{t(`teilTitle.${data?.type ?? teil.section}`)}</b>
        <span className="block text-ga-small text-ga-muted">{meta}</span>
      </span>
      <span className="shrink-0">{status}</span>
      <ChevronRight size={16} className="shrink-0 text-ga-subtle" aria-hidden />
    </Link>
  )
}
