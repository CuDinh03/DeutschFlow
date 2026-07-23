'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Check, ArrowRight, BookOpen, Dumbbell, Lock } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { phaseApi, type PhaseStateResponse, type PhaseType } from '@/lib/phaseApi'
import { fetchTree, completeNode, levelUp, type TreeResponse } from '@/lib/learning-tree/treeApi'
import { LearningTree, type TappedNode } from '@/components/learning-tree/LearningTree'
import { NodeLessonPanel } from '@/components/learning-tree/NodeLessonPanel'
import { TreeSeedState } from '@/components/learning-tree/TreeSeedState'
import { LevelUpBanner } from '@/components/learning-tree/LevelUpBanner'
import { GROUP_COLORS, SKILL_COLORS, SKILL_LABELS, TOPIC_CHIP } from '@/lib/learning-tree/render/palette'
import { SKILL_ICONS, TOPIC_ICONS } from '@/lib/learning-tree/render/icons'
import { TreeIcon } from '@/components/learning-tree/TreeIcon'
import { COMPANIONS, CompanionGlyph, type CompanionChoice } from '@/components/learning-tree/companions'
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
import type { Skill, TopicGroup } from '@/lib/learning-tree/core'

/**
 * Node của lộ trình bài học (`GET /roadmap/me` → RoadmapNodeDto). CHÚ Ý: `id` ở đây là SỐ và là id
 * duy nhất mà backend bài học/luyện tập chấp nhận (`/skill-tree/{nodeId}/...`,
 * `/skill-tree/node/{nodeId}/session`).
 *
 * Nó KHÔNG PHẢI id của lá trên "Cây học tập" (tab Cây) — cây dùng bảng TreeNode với id CHUỖI qua
 * `/roadmap/tree` (xem RoadmapTreeController: "Distinct from the legacy week/day roadmap"). Vì vậy
 * không thể lấy lá cây làm cửa vào runner; tab "Bài học" dưới đây mới là cửa đúng.
 */
interface RoadmapNode {
  id: number
  code: string
  title: string
  subtitle: string
  emoji: string
  /** "completed" | "current" | "locked" */
  state: string
  xpReward: number
  lessonsTotal: number
  lessonsCompleted: number
  cefrLevel: string
  description: string
}

const PHASES: { type: PhaseType; labelKey: string; descKey: string }[] = [
  { type: 'FOUNDATION', labelKey: 'phases.foundationLabel', descKey: 'phases.foundationDesc' },
  { type: 'PRODUCTION', labelKey: 'phases.productionLabel', descKey: 'phases.productionDesc' },
  { type: 'FLUENCY', labelKey: 'phases.fluencyLabel', descKey: 'phases.fluencyDesc' },
  { type: 'GRADUATED', labelKey: 'phases.graduatedLabel', descKey: 'phases.graduatedDesc' },
]
const ORDER: PhaseType[] = ['FOUNDATION', 'PRODUCTION', 'FLUENCY', 'GRADUATED']

/** True when the tree carries no lessons yet (A0 "mầm" state — nothing to render but a seedling). */
function treeIsSeed(tree: TreeResponse): boolean {
  return !tree.path?.some((l) =>
    l.branches?.some((b) => b.shoots?.some((s) => (s.nodes?.length ?? 0) > 0)),
  )
}

/** The level whose milestone is ready to pass (all four skills matured), plus the level it unlocks. */
function readyMilestone(tree: TreeResponse): { readyLevel: string; nextLevel: string | null } | null {
  const idx = tree.path.findIndex((l) => l.milestone.state === 'ready')
  if (idx < 0) return null
  return { readyLevel: tree.path[idx].level, nextLevel: tree.path[idx + 1]?.level ?? null }
}

export default function V2StudentRoadmapPage() {
  const t = useTranslations('v2.student.roadmap')
  const [tab, setTab] = useState('tree')

  // ── Tree (Cây học tập) ──
  const [tree, setTree] = useState<TreeResponse | null>(null)
  const [treeLoading, setTreeLoading] = useState(true)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [tapped, setTapped] = useState<TappedNode | null>(null)
  const [completing, setCompleting] = useState(false)
  const [fTopic, setFTopic] = useState<TopicGroup | null>(null)
  const [fSkill, setFSkill] = useState<Skill | null>(null)
  const [companion, setCompanion] = useState<CompanionChoice>('owl')
  useEffect(() => {
    const saved = window.localStorage.getItem('lt_companion') as CompanionChoice | null
    if (saved) setCompanion(saved)
  }, [])
  const chooseCompanion = useCallback((c: CompanionChoice) => {
    setCompanion(c)
    try {
      window.localStorage.setItem('lt_companion', c)
    } catch {
      /* ignore */
    }
  }, [])

  const loadTree = useCallback(() => {
    setTreeLoading(true)
    setTreeError(null)
    fetchTree()
      .then(setTree)
      .catch(() => setTreeError(t('treeLoadError')))
      .finally(() => setTreeLoading(false))
  }, [t])
  useEffect(loadTree, [loadTree])

  const onComplete = useCallback((nodeId: string) => {
    setCompleting(true)
    completeNode(nodeId)
      .then((next) => {
        setTree(next)
        setTapped(null)
      })
      .catch(() => setTreeError(t('nodeUpdateError')))
      .finally(() => setCompleting(false))
  }, [t])

  // ── Level-up ritual (G3): pass the current milestone → gold flash + toast + grown tree ──
  const [leveling, setLeveling] = useState(false)
  const [flashing, setFlashing] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
  }, [])
  const onLevelUp = useCallback(() => {
    setLeveling(true)
    levelUp()
      .then((next) => {
        setTree(next)
        setTapped(null)
        setFlashing(true)
        if (flashTimer.current) clearTimeout(flashTimer.current)
        flashTimer.current = setTimeout(() => setFlashing(false), 1500)
        toast.success(t('levelUpToast', { level: next.user.currentLevel ?? '' }))
      })
      .catch(() => toast.error(t('levelUpError')))
      .finally(() => setLeveling(false))
  }, [t])

  // ── Bài học (nodes) — cửa vào bài học thật + runner luyện 4 kỹ năng (lazy-loaded) ──
  const [nodes, setNodes] = useState<RoadmapNode[]>([])
  const [nodesLoading, setNodesLoading] = useState(false)
  const [nodesError, setNodesError] = useState<string | null>(null)
  const [nodesLoaded, setNodesLoaded] = useState(false)

  const loadNodes = useCallback(() => {
    setNodesLoading(true)
    setNodesError(null)
    api
      .get<RoadmapNode[]>('/roadmap/me')
      .then((res) => {
        setNodes(Array.isArray(res.data) ? res.data : [])
        setNodesLoaded(true)
      })
      .catch(() => setNodesError(t('nodesLoadError')))
      .finally(() => setNodesLoading(false))
  }, [t])
  useEffect(() => {
    if (tab === 'nodes' && !nodesLoaded && !nodesLoading) loadNodes()
  }, [tab, nodesLoaded, nodesLoading, loadNodes])

  // ── Phase journey (preserved from the previous roadmap; lazy-loaded) ──
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

          {/* Tree tab. `data-[state=active]:flex` (not bare `flex`) so the inactive panel respects
              Radix's `hidden` — a bare `flex` class overrides [hidden]{display:none} and leaves the
              panel occupying flex space, pushing the other tab's content down. */}
          <TkTabsContent
            value="tree"
            className="min-h-0 flex-1 flex-col gap-3 data-[state=active]:flex"
            style={{ fontFamily: 'var(--ga-vn)' }}
          >
            {treeError ? (
              <ErrorBanner message={treeError} onRetry={loadTree} />
            ) : treeLoading || !tree ? (
              <LoadingState label={t('treeLoading')} />
            ) : treeIsSeed(tree) ? (
              <TreeSeedState displayName={tree.user.displayName} />
            ) : (
              <>
                <TreeHeader tree={tree} />
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                  <TreeFilterBar
                    topic={fTopic}
                    skill={fSkill}
                    onTopic={setFTopic}
                    onSkill={setFSkill}
                    onClear={() => {
                      setFTopic(null)
                      setFSkill(null)
                    }}
                  />
                  <CompanionPicker choice={companion} onChange={chooseCompanion} />
                </div>
                {(() => {
                  const ready = readyMilestone(tree)
                  return ready ? (
                    <LevelUpBanner
                      readyLevel={ready.readyLevel}
                      nextLevel={ready.nextLevel}
                      busy={leveling}
                      onLevelUp={onLevelUp}
                    />
                  ) : null
                })()}
                <div className="relative flex min-h-0 flex-1 border border-ga-line">
                  <LearningTree
                    tree={tree}
                    onTapNode={setTapped}
                    filter={{ topic: fTopic, skill: fSkill }}
                    companion={companion}
                  />
                  {flashing && (
                    <div
                      aria-hidden
                      className="lt-levelup-flash absolute inset-0 z-20"
                      style={{
                        background:
                          'radial-gradient(circle at 50% 60%, rgba(232,200,78,0.55), rgba(232,200,78,0.12) 45%, transparent 70%)',
                      }}
                    />
                  )}
                  {tapped && (
                    <NodeLessonPanel
                      nodeId={tapped.nodeId}
                      group={tapped.group}
                      alreadyCompleted={tapped.state === 'completed'}
                      completing={completing}
                      onClose={() => setTapped(null)}
                      onComplete={onComplete}
                    />
                  )}
                </div>
                <TreeLegend />
              </>
            )}
          </TkTabsContent>

          {/* Bài học tab — cửa DUY NHẤT của /v2 vào bài học thật (5 view) và runner luyện 4 kỹ năng
              có chấm điểm. Tab "Cây" ở trên chỉ có bài demo hardcode trong NodeLessonPanel
              (LESSON_BY_GROUP: 6 chủ đề × 1 câu + 1 trắc nghiệm), nên KHÔNG thay thế được runner. */}
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
                            {/* RoadmapNodeDto: `title` = title_de, `subtitle` = title_vi. Bản v1
                                (RoadmapTreePage) hiện CẢ HAI — chỉ in `title` là học viên Việt chỉ
                                thấy tiêu đề tiếng Đức. */}
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

/** Goal line + CEFR level chips above the tree. */
function TreeHeader({ tree }: { tree: TreeResponse }) {
  const t = useTranslations('v2.student.roadmap')
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="ga-ui min-w-0 break-words text-[13.5px] text-ga-muted">
        <span className="font-semibold text-ga-ink">{tree.user.displayName}</span>
        {tree.user.goal ? <span> · {tree.user.goal}</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {tree.path.map((lvl) => {
          const current = lvl.status === 'current'
          const passed = lvl.milestone.state === 'passed'
          const ready = lvl.milestone.state === 'ready'
          return (
            <span
              key={lvl.level}
              className="ga-ui inline-flex items-center gap-1 rounded-ga-pill border px-2.5 py-1 text-[12px] font-semibold"
              style={{
                background: current ? 'var(--ga-ink)' : passed ? 'var(--ga-yellow-soft)' : 'transparent',
                color: current ? 'var(--ga-bg)' : passed ? 'var(--ga-ink)' : 'var(--ga-faint)',
                borderColor: current ? 'var(--ga-ink)' : passed ? 'var(--ga-yellow)' : 'var(--ga-border)',
              }}
            >
              {lvl.level}
              {passed && <Check size={11} aria-hidden style={{ color: current ? 'var(--ga-yellow)' : '#B8911C' }} />}
              {(current || ready) && (
                <span className="text-[9px] uppercase tracking-[0.1em]" style={{ color: 'var(--ga-yellow)' }}>
                  {ready ? t('levelReady') : t('levelCurrent')}
                </span>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** Topic-group + skill colour legend below the tree. */
function TreeLegend() {
  const groups = Object.entries(GROUP_COLORS) as [TopicGroup, (typeof GROUP_COLORS)[TopicGroup]][]
  const skills = Object.keys(SKILL_LABELS) as Skill[]
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-ga-line pt-3">
      {/* Topic key — muted icon + name (matches the per-limb chips; topic colour stays quiet) */}
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5">
        {groups.map(([key, g]) => (
          <span key={key} className="inline-flex items-center gap-1.5 text-[11.5px] text-ga-muted">
            <TreeIcon paths={TOPIC_ICONS[key]} size={13} color={TOPIC_CHIP.icon} strokeWidth={2} />
            {g.name}
          </span>
        ))}
      </div>
      {/* Skill key — icon + name, shown once (the badge motif used on every node). */}
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5">
        {skills.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-[11.5px] text-ga-muted">
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-full"
              style={{ background: SKILL_COLORS[s] }}
            >
              <TreeIcon paths={SKILL_ICONS[s]} size={10} color="#FFFFFF" strokeWidth={2.6} />
            </span>
            {SKILL_LABELS[s]}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Filter chips (topic + skill) with clear + focus heading; selecting dims the rest of the tree. */
function TreeFilterBar({
  topic,
  skill,
  onTopic,
  onSkill,
  onClear,
}: {
  topic: TopicGroup | null
  skill: Skill | null
  onTopic: (t: TopicGroup | null) => void
  onSkill: (s: Skill | null) => void
  onClear: () => void
}) {
  const t = useTranslations('v2.student.roadmap')
  const groups = Object.entries(GROUP_COLORS) as [TopicGroup, (typeof GROUP_COLORS)[TopicGroup]][]
  const skills = Object.keys(SKILL_LABELS) as Skill[]
  const active = !!(topic || skill)
  const chip = 'inline-flex items-center gap-1 rounded-ga-pill border px-2.5 py-1 transition-colors'
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
      <span className="text-ga-muted">{t('filterLabel')}</span>
      {groups.map(([key, g]) => {
        const on = topic === key
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onTopic(on ? null : key)}
            className={`${chip} ${on ? 'border-ga-ink bg-ga-ink text-ga-bg' : 'border-ga-line text-ga-muted hover:text-ga-ink'}`}
          >
            <TreeIcon paths={TOPIC_ICONS[key]} size={12} color={on ? '#FFFFFF' : TOPIC_CHIP.icon} strokeWidth={2} />
            {g.name}
          </button>
        )
      })}
      <span className="mx-0.5 text-ga-faint">·</span>
      {skills.map((s) => {
        const on = skill === s
        return (
          <button
            key={s}
            type="button"
            aria-pressed={on}
            onClick={() => onSkill(on ? null : s)}
            className={`${chip} ${on ? 'text-white' : 'border-ga-line text-ga-muted hover:text-ga-ink'}`}
            style={on ? { background: SKILL_COLORS[s], borderColor: SKILL_COLORS[s] } : undefined}
          >
            <TreeIcon paths={SKILL_ICONS[s]} size={12} color={on ? '#FFFFFF' : SKILL_COLORS[s]} strokeWidth={2.4} />
            {SKILL_LABELS[s]}
          </button>
        )
      })}
      {active && (
        <button
          type="button"
          onClick={onClear}
          className={`${chip} border-ga-line font-semibold text-ga-ink hover:bg-ga-surface`}
        >
          {t('filterAll')}
        </button>
      )}
      {active && (
        <span className="ml-1 font-semibold text-ga-ink">
          {t('filterSummary', {
            topic: topic ? GROUP_COLORS[topic].name : t('filterAllTopics'),
            skill: skill ? SKILL_LABELS[skill] : t('filterAllSkills'),
          })}
        </span>
      )}
    </div>
  )
}

/** Companion picker — owl/bird/butterfly/squirrel or off (B2B). Persisted by the page in localStorage. */
function CompanionPicker({
  choice,
  onChange,
}: {
  choice: CompanionChoice
  onChange: (c: CompanionChoice) => void
}) {
  const t = useTranslations('v2.student.roadmap')
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
      <span className="text-ga-muted">{t('companionLabel')}</span>
      {COMPANIONS.map((c) => {
        const on = choice === c.id
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(c.id)}
            className={`inline-flex items-center gap-1 rounded-ga-pill border px-2 py-1 transition-colors ${on ? 'border-ga-ink bg-ga-ink text-ga-bg' : 'border-ga-line text-ga-muted hover:text-ga-ink'}`}
          >
            {c.id !== 'none' && (
              <svg width={16} height={16} viewBox="-14 -14 28 28" aria-hidden="true">
                <CompanionGlyph choice={c.id} />
              </svg>
            )}
            {c.label}
          </button>
        )
      })}
    </div>
  )
}
