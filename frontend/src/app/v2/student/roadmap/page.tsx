'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import api from '@/lib/api'
import { phaseApi, type PhaseStateResponse } from '@/lib/phaseApi'
import type { RoadmapNode } from '@/lib/roadmap-tree/types'
import { RoadmapTreeTab } from '@/components/roadmap-tree/RoadmapTreeTab'
import { NodeList } from '@/components/learning/NodeList'
import { JourneyPreview } from '@/components/learning/JourneyPreview'
import { courseCompletion } from '@/lib/learning/currentNode'
import { GaPageHdr, GaProgress, EmptyState, LoadingState, ErrorBanner, TkSeg } from '@/components/ui-v2'

/**
 * Lernweg (Learning Journey) — S-03.
 *
 * Trước Wave 1 màn này có BA tab ngang hàng (Cây · Bài học · Giai đoạn) = ba mental model cạnh
 * tranh, buộc người học chọn cách nhìn trước khi học được (UX-03). Sau P4-D6:
 *
 *   • Cây (Lernweg) là representation CHÍNH trên desktop.
 *   • Danh sách là bản THAY THẾ ACCESSIBLE của cùng dữ liệu — không phải mental model thứ hai;
 *     nó cũng là mặc định ở mobile vì canvas SVG ở 390px khó dùng và tốn CPU (P4-D4).
 *   • "Giai đoạn" không còn là tab: bối cảnh phase được hấp thụ vào header của màn.
 *
 * Điều kiện của P4-D4: mobile vẫn phải giữ visual signature → compact journey overview đứng
 * trên danh sách, không để mobile thành một danh sách generic.
 */
export default function V2StudentRoadmapPage() {
  const t = useTranslations('v2.student.roadmap')

  const [nodes, setNodes] = useState<RoadmapNode[]>([])
  const [nodesLoading, setNodesLoading] = useState(true)
  const [nodesError, setNodesError] = useState<string | null>(null)
  const [phase, setPhase] = useState<PhaseStateResponse | null>(null)

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

  // Phase chỉ còn là NGỮ CẢNH trong header — hỏng thì header vẫn đứng, không chặn lộ trình.
  useEffect(() => {
    phaseApi
      .getCurrent()
      .then((res) => setPhase(res.data))
      .catch(() => setPhase(null))
  }, [])

  // Mobile: mặc định danh sách và KHÔNG mount canvas cây (P4-D4). `null` = chưa biết khổ màn
  // (lần sơn đầu / SSR) → hiển thị danh sách vì nó đúng cho cả hai khổ và rẻ hơn.
  const [narrow, setNarrow] = useState<boolean | null>(null)
  const [view, setView] = useState<'tree' | 'list' | null>(null)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  // Người dùng chọn thì tôn trọng lựa chọn đó; chưa chọn thì theo khổ màn.
  const effectiveView: 'tree' | 'list' = view ?? (narrow === false ? 'tree' : 'list')

  const completion = useMemo(() => courseCompletion(nodes), [nodes])
  const phaseLabel = phase ? t(`phases.${phase.currentPhase.toLowerCase()}Label`) : null

  return (
    <div className="flex h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        // Ngữ cảnh giai đoạn hấp thụ vào header thay cho tab "Giai đoạn" (P4-D6).
        subtitle={phaseLabel ? t('headerContext', { phase: phaseLabel }) : t('subtitle')}
        right={
          nodes.length > 0 ? (
            <div className="min-w-[10rem]">
              <GaProgress value={completion.percent} label={t('courseProgressLabel')} showValue />
              <p className="mt-1 text-right text-ga-caption tabular-nums text-ga-muted">
                {t('courseCompletion', { done: completion.done, total: completion.total })}
              </p>
            </div>
          ) : null
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-6 pt-4 sm:px-6 lg:px-12">
        {nodesError ? (
          <ErrorBanner message={nodesError} onRetry={loadNodes} />
        ) : nodesLoading ? (
          <LoadingState label={t('nodesLoading')} />
        ) : nodes.length === 0 ? (
          <EmptyState title={t('nodesEmptyTitle')} description={t('nodesEmptyDesc')} />
        ) : (
          <>
            {/* Mobile: compact overview giữ visual signature của lộ trình (điều kiện P4-D4). */}
            {effectiveView === 'list' && (
              <div className="md:hidden">
                <JourneyPreview nodes={nodes} compact />
              </div>
            )}

            {/* Đổi CÁCH NHÌN cùng một dữ liệu — không phải chọn mental model. */}
            <div className="flex justify-end">
              <TkSeg
                aria-label={t('viewLabel')}
                value={effectiveView}
                onValueChange={(v) => setView(v)}
                options={[
                  { value: 'tree', label: t('viewTree') },
                  { value: 'list', label: t('viewList') },
                ]}
              />
            </div>

            {effectiveView === 'tree' ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <RoadmapTreeTab nodes={nodes} />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <NodeList nodes={nodes} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
