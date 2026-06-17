'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'
import { phaseApi, type PhaseStateResponse, type PhaseType } from '@/lib/phaseApi'
import { fetchTree, completeNode, type TreeResponse } from '@/lib/learning-tree/treeApi'
import { LearningTree, type TappedNode } from '@/components/learning-tree/LearningTree'
import { NodeLessonPanel } from '@/components/learning-tree/NodeLessonPanel'
import { GROUP_COLORS, SKILL_COLORS, SKILL_LABELS } from '@/lib/learning-tree/render/palette'
import {
  GaPageHdr,
  GaCard,
  GaCap,
  LoadingState,
  ErrorBanner,
  TkTabs,
  TkTabsList,
  TkTabsTrigger,
  TkTabsContent,
} from '@/components/ui-v2'
import type { Skill, TopicGroup } from '@/lib/learning-tree/core'

const PHASES: { type: PhaseType; label: string; desc: string }[] = [
  { type: 'FOUNDATION', label: 'Nền tảng', desc: 'Bảng chữ cái, từ vựng & ngữ pháp cơ bản (A1)' },
  { type: 'PRODUCTION', label: 'Sản sinh', desc: 'Tạo câu, luyện nói có cấu trúc (A2–B1)' },
  { type: 'FLUENCY', label: 'Lưu loát', desc: 'Hội thoại tự nhiên, phỏng vấn, thi thử (B1–B2)' },
  { type: 'GRADUATED', label: 'Tốt nghiệp', desc: 'Sẵn sàng cho kỳ thi Goethe & môi trường thực tế' },
]
const ORDER: PhaseType[] = ['FOUNDATION', 'PRODUCTION', 'FLUENCY', 'GRADUATED']

export default function V2StudentRoadmapPage() {
  const [tab, setTab] = useState('tree')

  // ── Tree (Cây học tập) ──
  const [tree, setTree] = useState<TreeResponse | null>(null)
  const [treeLoading, setTreeLoading] = useState(true)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [tapped, setTapped] = useState<TappedNode | null>(null)
  const [completing, setCompleting] = useState(false)

  const loadTree = useCallback(() => {
    setTreeLoading(true)
    setTreeError(null)
    fetchTree()
      .then(setTree)
      .catch(() => setTreeError('Không thể tải cây học tập.'))
      .finally(() => setTreeLoading(false))
  }, [])
  useEffect(loadTree, [loadTree])

  const onComplete = useCallback((nodeId: string) => {
    setCompleting(true)
    completeNode(nodeId)
      .then((next) => {
        setTree(next)
        setTapped(null)
      })
      .catch(() => setTreeError('Không thể cập nhật bài học.'))
      .finally(() => setCompleting(false))
  }, [])

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
        else setPhaseError('Không thể tải giai đoạn.')
        if (n.status === 'fulfilled') setNextActions(n.value.data.nextActions ?? [])
        setPhaseLoaded(true)
      })
      .finally(() => setPhaseLoading(false))
  }, [])
  useEffect(() => {
    if (tab === 'phase' && !phaseLoaded && !phaseLoading) loadPhase()
  }, [tab, phaseLoaded, phaseLoading, loadPhase])

  const currentIdx = phase ? ORDER.indexOf(phase.currentPhase) : -1

  return (
    <div className="flex h-full flex-col">
      <GaPageHdr accent title="Lộ trình học" subtitle="Cây học tập cá nhân hoá — chạm vào lá đang sáng để học" />
      <div className="flex min-h-0 flex-1 flex-col px-10 pb-6 pt-4">
        <TkTabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <TkTabsList>
            <TkTabsTrigger value="tree">Cây học tập</TkTabsTrigger>
            <TkTabsTrigger value="phase">Giai đoạn</TkTabsTrigger>
          </TkTabsList>

          {/* Tree tab */}
          <TkTabsContent value="tree" className="flex min-h-0 flex-1 flex-col gap-3">
            {treeError ? (
              <ErrorBanner message={treeError} onRetry={loadTree} />
            ) : treeLoading || !tree ? (
              <LoadingState label="Đang tải cây học tập…" />
            ) : (
              <>
                <TreeHeader tree={tree} />
                <div className="relative flex min-h-0 flex-1 border border-ga-line">
                  <LearningTree tree={tree} onTapNode={setTapped} />
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

          {/* Phase tab (preserved phaseApi journey) */}
          <TkTabsContent value="phase" className="min-h-0 flex-1 overflow-auto">
            {phaseError && (
              <div className="mb-5">
                <ErrorBanner message={phaseError} onRetry={loadPhase} />
              </div>
            )}
            {phaseLoading ? (
              <LoadingState label="Đang tải giai đoạn…" />
            ) : (
              <div className="space-y-[22px]">
                <div className="space-y-0">
                  {PHASES.map((p, i) => {
                    const done = currentIdx > i
                    const active = currentIdx === i
                    const tone = done ? 'var(--ga-green)' : active ? 'var(--ga-accent)' : 'var(--ga-subtle)'
                    return (
                      <div key={p.type} className="flex gap-4">
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
                        <div className={`mb-4 flex-1 border bg-ga-card p-5 ${active ? 'border-ga-accent' : 'border-ga-line'}`}>
                          <div className="flex items-center gap-2">
                            <p className="font-ga-display text-[19px] font-medium text-ga-ink">{p.label}</p>
                            {active && (
                              <span className="ga-ui rounded-ga-pill bg-ga-accent-soft px-2 py-0.5 text-[11px] font-semibold text-ga-accent">
                                Hiện tại
                              </span>
                            )}
                            {done && <span className="ga-ui text-[12px] font-semibold text-ga-green">Hoàn thành</span>}
                          </div>
                          <p className="ga-ui mt-1 text-[13.5px] text-ga-muted">{p.desc}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-2">
                  {phase && (
                    <GaCard className="p-6">
                      <GaCap className="mb-3 block">Tiến độ hiện tại</GaCap>
                      <div className="space-y-3">
                        {[
                          ['Từ vựng đã thuộc', phase.vocabularyMasteredCount],
                          ['Phút luyện nói', phase.speakingMinutesTotal],
                          ['Độ chính xác ngữ pháp', `${Math.round(phase.grammarAccuracyPercent)}%`],
                          ['Phiên hoàn thành', phase.sessionsCompleted],
                        ].map(([k, v]) => (
                          <div key={String(k)} className="ga-ui flex items-center justify-between text-[13.5px]">
                            <span className="text-ga-muted">{k}</span>
                            <span className="font-semibold text-ga-ink">{v}</span>
                          </div>
                        ))}
                      </div>
                    </GaCard>
                  )}

                  <GaCard className="p-6">
                    <GaCap className="mb-3 block">Việc nên làm tiếp theo</GaCap>
                    {nextActions.length > 0 ? (
                      <ul className="space-y-2.5">
                        {nextActions.map((a, i) => (
                          <li key={i} className="ga-ui flex items-start gap-2.5 text-[14px] text-ga-ink">
                            <ArrowRight size={16} className="mt-0.5 shrink-0 text-ga-accent" aria-hidden />
                            {a}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="ga-ui text-[13.5px] text-ga-muted">Tiếp tục luyện tập hằng ngày để tiến bộ.</p>
                    )}
                    <Link
                      href="/v2/student/dashboard"
                      className="ga-ui mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-ga-accent"
                    >
                      Tới bảng điều khiển <ArrowRight size={14} aria-hidden />
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
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="ga-ui text-[13.5px] text-ga-muted">
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
                  {ready ? 'sẵn sàng' : 'đang'}
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
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5">
        {groups.map(([key, g]) => (
          <span key={key} className="ga-ui inline-flex items-center gap-1.5 text-[11.5px] text-ga-muted">
            <i className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: g.leaf }} />
            {g.name}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5">
        {skills.map((s) => (
          <span key={s} className="ga-ui inline-flex items-center gap-1.5 text-[11.5px] text-ga-muted">
            <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SKILL_COLORS[s] }} />
            {SKILL_LABELS[s]}
          </span>
        ))}
      </div>
    </div>
  )
}
