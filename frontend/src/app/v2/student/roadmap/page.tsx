'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Check, ArrowRight, BookOpen, Dumbbell, Lock } from 'lucide-react'
import api from '@/lib/api'
import { phaseApi, type PhaseStateResponse, type PhaseType } from '@/lib/phaseApi'
import type { RoadmapNode } from '@/lib/roadmap-tree/types'
import { RoadmapTreeTab } from '@/components/roadmap-tree/RoadmapTreeTab'
import {
  GaPageHdr,
  GaCard,
  GaCap,
  EmptyState,
  LoadingState,
  ErrorBanner,
  TkBadge,
  TkTabs,
  TkTabsList,
  TkTabsTrigger,
  TkTabsContent,
} from '@/components/ui-v2'

/**
 * Trang này từng có một tab "Cây học tập" khác, đọc `GET /roadmap/tree`. Đã gỡ 2026-08-03: dữ liệu
 * ở đó là nội dung demo hardcode trong `TreeCurriculumSeeder` (144 node kiểu "Begrüßung"/"Familie")
 * và ghi tiến độ vào một sổ riêng không cộng vào đâu cả.
 *
 * Tab "Cây học tập" hiện tại KHÁC HẲN: cùng nguồn `GET /roadmap/me` với tab "Bài học" — cùng dữ
 * liệu, cùng sổ tiến độ, chỉ khác cách nhìn (cành = tuần, node = ngày). Xem
 * TONG_HOP_CAY_HOC_TAP_2026-08-03.md.
 */

const PHASES: { type: PhaseType; labelKey: string; descKey: string }[] = [
  { type: 'FOUNDATION', labelKey: 'phases.foundationLabel', descKey: 'phases.foundationDesc' },
  { type: 'PRODUCTION', labelKey: 'phases.productionLabel', descKey: 'phases.productionDesc' },
  { type: 'FLUENCY', labelKey: 'phases.fluencyLabel', descKey: 'phases.fluencyDesc' },
  { type: 'GRADUATED', labelKey: 'phases.graduatedLabel', descKey: 'phases.graduatedDesc' },
]
const ORDER: PhaseType[] = ['FOUNDATION', 'PRODUCTION', 'FLUENCY', 'GRADUATED']

export default function V2StudentRoadmapPage() {
  const t = useTranslations('v2.student.roadmap')
  const [tab, setTab] = useState('tree')

  // ── Bài học (nodes) — cửa vào bài học thật + runner luyện 4 kỹ năng ──
  const [nodes, setNodes] = useState<RoadmapNode[]>([])
  const [nodesLoading, setNodesLoading] = useState(true)
  const [nodesError, setNodesError] = useState<string | null>(null)

  const loadNodes = useCallback(() => {
    setNodesLoading(true)
    setNodesError(null)
    api
      .get<RoadmapNode[]>('/roadmap/me')
      .then((res) => setNodes(Array.isArray(res.data) ? res.data : []))
      .catch(() => setNodesError(t('nodesLoadError')))
      .finally(() => setNodesLoading(false))
  }, [t])
  useEffect(loadNodes, [loadNodes])

  // ── Phase journey (preserved phaseApi journey; lazy-loaded) ──
  const [phase, setPhase] = useState<PhaseStateResponse | null>(null)
  const [nextActions, setNextActions] = useState<string[]>([])
  const [phaseLoading, setPhaseLoading] = useState(false)
  const [phaseError, setPhaseError] = useState<string | null>(null)
  const [phaseLoaded, setPhaseLoaded] = useState(false)

  const loadPhase = useCallback(() => {
    setPhaseLoading(true)
    setPhaseError(null)
    Promise.allSettled([phaseApi.getCurrent(), phaseApi.getNextActions()])
      .then(([p, n]) => {
        if (p.status === 'fulfilled') setPhase(p.value.data)
        else setPhaseError(t('phaseLoadError'))
        if (n.status === 'fulfilled') setNextActions(n.value.data.nextActions ?? [])
        setPhaseLoaded(true)
      })
      .finally(() => setPhaseLoading(false))
  }, [t])
  useEffect(() => {
    if (tab === 'phase' && !phaseLoaded && !phaseLoading) loadPhase()
  }, [tab, phaseLoaded, phaseLoading, loadPhase])

  const currentIdx = phase ? ORDER.indexOf(phase.currentPhase) : -1

  return (
    <div className="flex h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-6 pt-4 sm:px-6 lg:px-10">
        <TkTabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <TkTabsList>
            <TkTabsTrigger value="tree">{t('tabTree')}</TkTabsTrigger>
            <TkTabsTrigger value="nodes">{t('tabNodes')}</TkTabsTrigger>
            <TkTabsTrigger value="phase">{t('tabPhase')}</TkTabsTrigger>
          </TkTabsList>

          {/* Cây học tập — cùng dữ liệu với tab "Bài học", khác cách nhìn. Dùng chung state tải ở
              trên nên chuyển tab không gọi lại API. */}
          <TkTabsContent value="tree" className="flex min-h-0 flex-1 flex-col">
            {nodesError ? (
              <ErrorBanner message={nodesError} onRetry={loadNodes} />
            ) : nodesLoading ? (
              <LoadingState label={t('nodesLoading')} />
            ) : (
              <RoadmapTreeTab nodes={nodes} />
            )}
          </TkTabsContent>

          {/* Bài học — cửa DUY NHẤT của /v2 vào bài học thật (5 view) và runner luyện 4 kỹ năng
              có chấm điểm. Cùng nguồn dữ liệu với app mobile. */}
          <TkTabsContent value="nodes" className="min-h-0 flex-1 overflow-auto">
            {nodesError ? (
              <ErrorBanner message={nodesError} onRetry={loadNodes} />
            ) : nodesLoading ? (
              <LoadingState label={t('nodesLoading')} />
            ) : nodes.length === 0 ? (
              <EmptyState title={t('nodesEmptyTitle')} description={t('nodesEmptyDesc')} />
            ) : (
              <div className="space-y-3">
                {nodes.map((node) => {
                  const locked = node.state === 'locked'
                  const done = node.state === 'completed'
                  const percent =
                    node.lessonsTotal > 0
                      ? Math.round((node.lessonsCompleted / node.lessonsTotal) * 100)
                      : 0

                  return (
                    <GaCard key={node.id} hover className="p-4 lg:p-5">
                      <div className="flex items-start gap-3 lg:gap-4">
                        <span
                          className={`grid h-11 w-11 shrink-0 place-items-center rounded-ga bg-ga-surface text-[22px] ${locked ? 'opacity-50' : ''}`}
                        >
                          {locked ? <Lock size={18} className="text-ga-subtle" aria-hidden /> : node.emoji}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* RoadmapNodeDto: `title` = title_de, `subtitle` = title_vi. Hiện CẢ HAI —
                                chỉ in `title` là học viên Việt chỉ thấy tiêu đề tiếng Đức. */}
                            <p
                              className={`min-w-0 break-words text-[15px] font-semibold ${locked ? 'text-ga-subtle' : 'text-ga-ink'}`}
                            >
                              {node.subtitle || node.title}
                            </p>
                            <TkBadge tone={done ? 'green' : locked ? 'neutral' : 'yellow'}>
                              {done ? t('nodeDone') : locked ? t('nodeLocked') : t('nodeCurrent')}
                            </TkBadge>
                            <span className="ga-ui rounded-ga-pill bg-ga-accent-soft px-2 py-0.5 text-[11px] font-bold text-ga-accent">
                              {node.cefrLevel}
                            </span>
                            <span className="ga-ui text-[11.5px] text-ga-subtle">+{node.xpReward} XP</span>
                          </div>

                          {node.subtitle && node.title && (
                            <p className="ga-ui mt-0.5 break-words text-[12.5px] italic text-ga-subtle">
                              {node.title}
                            </p>
                          )}

                          {node.description && (
                            <p className="ga-ui mt-1 line-clamp-2 text-[13px] text-ga-muted">
                              {node.description}
                            </p>
                          )}

                          {!locked && (
                            <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                              <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-ga-pill bg-ga-border sm:w-32 lg:w-40">
                                <span
                                  className="block h-full rounded-ga-pill"
                                  style={{
                                    width: `${percent}%`,
                                    background: done ? 'var(--ga-green)' : 'var(--ga-accent)',
                                  }}
                                />
                              </span>
                              <span className="ga-ui text-[12px] text-ga-subtle">
                                {t('nodeLessons', {
                                  done: node.lessonsCompleted,
                                  total: node.lessonsTotal,
                                })}
                              </span>
                            </div>
                          )}

                          {/* Hai cửa: học bài (5 view) · luyện 4 kỹ năng (runner có chấm điểm) */}
                          {!locked && (
                            <div className="mt-3.5 flex flex-wrap gap-2">
                              <Link
                                href={`/v2/student/learn/${node.id}`}
                                className="ga-ui inline-flex min-h-10 items-center gap-1.5 rounded-ga bg-ga-accent px-4 py-2 text-[12.5px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90 lg:min-h-0"
                              >
                                <BookOpen size={14} aria-hidden />
                                {done ? t('nodeRelearn') : t('nodeLearn')}
                              </Link>
                              <Link
                                href={`/v2/student/practice/${node.id}`}
                                className="ga-ui inline-flex min-h-10 items-center gap-1.5 rounded-ga border border-ga-line bg-ga-card px-4 py-2 text-[12.5px] font-semibold text-ga-ink transition-colors hover:bg-ga-surface lg:min-h-0"
                              >
                                <Dumbbell size={14} aria-hidden />
                                {t('nodePractice')}
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    </GaCard>
                  )
                })}
              </div>
            )}
          </TkTabsContent>

          {/* Phase tab (preserved phaseApi journey) */}
          <TkTabsContent value="phase" className="min-h-0 flex-1 overflow-auto">
            {phaseError && (
              <div className="mb-5">
                <ErrorBanner message={phaseError} onRetry={loadPhase} />
              </div>
            )}
            {phaseLoading ? (
              <LoadingState label={t('phaseLoading')} />
            ) : (
              <div className="space-y-[22px]">
                <div className="space-y-0">
                  {PHASES.map((p, i) => {
                    const done = currentIdx > i
                    const active = currentIdx === i
                    const tone = done ? 'var(--ga-green)' : active ? 'var(--ga-accent)' : 'var(--ga-subtle)'
                    return (
                      <div key={p.type} className="flex gap-3 lg:gap-4">
                        <div className="flex flex-col items-center">
                          <span
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[14px] font-bold text-white"
                            style={{ background: tone }}
                          >
                            {done ? <Check size={18} aria-hidden /> : i + 1}
                          </span>
                          {i < PHASES.length - 1 && (
                            <span
                              className="my-1 w-0.5 flex-1"
                              style={{ background: done ? 'var(--ga-green)' : 'var(--ga-border)' }}
                            />
                          )}
                        </div>
                        <div className={`mb-4 min-w-0 flex-1 border bg-ga-card p-4 lg:p-5 ${active ? 'border-ga-accent' : 'border-ga-line'}`}>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="break-words font-ga-display text-[19px] font-medium text-ga-ink">{t(p.labelKey)}</p>
                            {active && (
                              <span className="ga-ui rounded-ga-pill bg-ga-accent-soft px-2 py-0.5 text-[11px] font-semibold text-ga-accent">
                                {t('phaseCurrent')}
                              </span>
                            )}
                            {done && <span className="ga-ui text-[12px] font-semibold text-ga-green">{t('phaseDone')}</span>}
                          </div>
                          <p className="ga-ui mt-1 text-[13.5px] text-ga-muted">{t(p.descKey)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-2">
                  {phase && (
                    <GaCard className="p-4 lg:p-6">
                      <GaCap className="mb-3 block">{t('currentProgressCap')}</GaCap>
                      <div className="space-y-3">
                        {[
                          [t('metrics.vocabMastered'), phase.vocabularyMasteredCount],
                          [t('metrics.speakingMinutes'), phase.speakingMinutesTotal],
                          [t('metrics.grammarAccuracy'), `${Math.round(phase.grammarAccuracyPercent)}%`],
                          [t('metrics.sessionsCompleted'), phase.sessionsCompleted],
                        ].map(([k, v]) => (
                          <div key={String(k)} className="ga-ui flex items-center justify-between gap-3 text-[13.5px]">
                            <span className="min-w-0 break-words text-ga-muted">{k}</span>
                            <span className="shrink-0 font-semibold text-ga-ink">{v}</span>
                          </div>
                        ))}
                      </div>
                    </GaCard>
                  )}

                  <GaCard className="p-4 lg:p-6">
                    <GaCap className="mb-3 block">{t('nextActionsCap')}</GaCap>
                    {nextActions.length > 0 ? (
                      <ul className="space-y-2.5">
                        {nextActions.map((a, i) => (
                          <li key={i} className="ga-ui flex min-w-0 items-start gap-2.5 break-words text-[14px] text-ga-ink">
                            <ArrowRight size={16} className="mt-0.5 shrink-0 text-ga-accent" aria-hidden />
                            {a}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="ga-ui text-[13.5px] text-ga-muted">{t('noNextActions')}</p>
                    )}
                    <Link
                      href="/v2/student/dashboard"
                      className="ga-ui mt-4 inline-flex min-h-10 items-center gap-1 text-[13px] font-semibold text-ga-accent lg:min-h-0"
                    >
                      {t('toDashboard')} <ArrowRight size={14} aria-hidden />
                    </Link>
                  </GaCard>
                </div>
              </div>
            )}
          </TkTabsContent>
        </TkTabs>
      </div>
    </div>
  )
}
