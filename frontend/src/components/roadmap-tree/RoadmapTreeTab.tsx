'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Sparkles } from 'lucide-react'
import { buildTreeLayout, type Branch, type PlacedNode } from '@/lib/roadmap-tree/treeLayout'
import { nodeDisplayTitle, type RoadmapNode } from '@/lib/roadmap-tree/types'
import { EmptyState } from '@/components/ui-v2'
import { SkillTreeCanvas } from './SkillTreeCanvas'
import { TreeNodePanel, type TreeNodeSummary } from './TreeNodePanel'

/**
 * Tab "Cây học tập" — cùng dữ liệu `GET /roadmap/me` với tab "Bài học", chỉ khác cách nhìn: cành là
 * tuần, node là ngày, và bốn kỹ năng nằm trong bảng bên phải vì đó là chỗ chúng thật sự ở.
 */

const ZOOM_STEP = 1.25
const MOTION_PREF_KEY = 'df-tree-motion'

export interface RoadmapTreeTabProps {
  nodes: RoadmapNode[]
  /** Node từ URL (?node=) — chọn sẵn khi mở tab để share/refresh giữ đúng ngữ cảnh (T7). */
  initialSelectedId?: number | null
  /** Bắn khi NGƯỜI DÙNG chọn node (không bắn cho auto-select) — page ghi vào URL. */
  onSelectedIdChange?: (id: number) => void
}

export function RoadmapTreeTab({ nodes, initialSelectedId, onSelectedIdChange }: RoadmapTreeTabProps) {
  const t = useTranslations('v2.student.roadmap')
  const locale = useLocale()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  // Nút tắt/bật hiệu ứng nhớ qua các lần vào (T5). Đọc trong effect chứ không phải initializer —
  // SSR render mặc định true, đọc localStorage lúc init sẽ lệch hydration.
  const [motionEnabled, setMotionEnabled] = useState(true)
  useEffect(() => {
    if (localStorage.getItem(MOTION_PREF_KEY) === 'off') setMotionEnabled(false)
  }, [])
  const toggleMotion = useCallback(() => {
    setMotionEnabled((on) => {
      localStorage.setItem(MOTION_PREF_KEY, on ? 'off' : 'on')
      return !on
    })
  }, [])
  const panelRef = useRef<HTMLDivElement | null>(null)

  const layout = useMemo(() => buildTreeLayout(nodes), [nodes])
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const placedById = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout])

  /** Node đang học — đích của auto-focus camera và nút ⌖. */
  const focusNodeId = useMemo(() => {
    const preferred =
      layout.nodes.find((n) => n.motif === 'flower') ??
      layout.nodes.find((n) => n.motif === 'bud') ??
      layout.nodes[0]
    return preferred?.id ?? null
  }, [layout])

  // Mở sẵn node từ URL nếu có, không thì node đang học.
  useEffect(() => {
    if (selectedId != null && placedById.has(selectedId)) return
    if (initialSelectedId != null && placedById.has(initialSelectedId)) {
      setSelectedId(initialSelectedId)
      return
    }
    setSelectedId(focusNodeId)
  }, [placedById, selectedId, initialSelectedId, focusNodeId])

  /** Chọn node do người dùng chạm: cập nhật URL, và trên màn hẹp cuộn tới panel (F7 —
   *  panel nằm dưới canvas 420px nên chọn xong không thấy phản hồi gì). */
  const handleUserSelect = useCallback(
    (id: number) => {
      setSelectedId(id)
      onSelectedIdChange?.(id)
      if (window.innerWidth < 1024) {
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    },
    [onSelectedIdChange],
  )

  const summary = useMemo<TreeNodeSummary | null>(() => {
    if (selectedId == null) return null
    const node = nodeById.get(selectedId)
    const placed = placedById.get(selectedId)
    if (!node || !placed) return null
    return {
      id: node.id,
      title: node.title,
      subtitle: node.subtitle,
      dayNumber: placed.dayNumber,
      weekNumber: node.weekNumber ?? placed.week,
      motif: placed.motif,
      skillCounts: node.skillCounts ?? {},
      lessonsCompleted: node.lessonsCompleted,
      lessonsTotal: node.lessonsTotal,
    }
  }, [selectedId, nodeById, placedById])

  const nodeLabel = (placed: PlacedNode) => {
    const node = nodeById.get(placed.id)
    const name = node ? nodeDisplayTitle(node, locale) : ''
    const day = placed.dayNumber ? t('tree.dayShort', { day: placed.dayNumber }) : ''
    return [day, name, t(`tree.status.${placed.motif}`)].filter(Boolean).join(' · ')
  }

  const weekLabel = (branch: Branch) =>
    branch.firstDay != null && branch.lastDay != null
      ? t('tree.weekRange', { week: branch.week, from: branch.firstDay, to: branch.lastDay })
      : t('tree.weekShort', { week: branch.week })

  if (nodes.length === 0) {
    return <EmptyState title={t('nodesEmptyTitle')} description={t('nodesEmptyDesc')} />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-ga border border-ga-line bg-ga-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-ga-line px-3 py-2">
        <p className="ga-ui text-[12.5px] font-semibold text-ga-ink">
          {t('tree.summary', { days: nodes.length, weeks: layout.branches.length })}
        </p>
        <span className="ga-ui rounded-ga-pill bg-ga-green-soft px-2 py-0.5 text-[11.5px] font-semibold text-ga-green">
          {t('tree.doneCount', {
            done: layout.nodes.filter((n) => n.motif === 'leaf').length,
            total: layout.nodes.length,
          })}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={toggleMotion}
          aria-pressed={motionEnabled}
          className="ga-ui inline-flex min-h-9 items-center gap-1.5 rounded-ga border border-ga-line px-2.5 py-1 text-[12px] text-ga-muted transition-colors hover:bg-ga-surface"
        >
          <Sparkles size={13} aria-hidden />
          {motionEnabled ? t('tree.motionOff') : t('tree.motionOn')}
        </button>
      </div>

      {/* Vùng cây có chiều cao ghim cứng: SVG dùng `preserveAspectRatio` nên nó co theo khung, và
          một khung cao vô định sẽ đẩy gốc cây xuống dưới mép màn hình. */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="h-[420px] shrink-0 border-b border-ga-line lg:h-[calc(100vh-22rem)] lg:max-h-[640px] lg:min-h-[400px] lg:flex-1 lg:border-b-0 lg:border-r">
          <SkillTreeCanvas
            layout={layout}
            selectedId={selectedId}
            onSelect={handleUserSelect}
            nodeLabel={nodeLabel}
            weekLabel={weekLabel}
            futureTipLabel={t('tree.futureTip')}
            treeLabel={t('tabTree')}
            motionEnabled={motionEnabled}
            zoomStep={ZOOM_STEP}
            focusNodeId={focusNodeId}
            focusLabel={t('tree.focusCurrent')}
          />
        </div>
        <div
          ref={panelRef}
          className="min-h-0 shrink-0 bg-ga-surface lg:h-[calc(100vh-22rem)] lg:max-h-[640px] lg:min-h-[400px] lg:w-[300px] lg:overflow-auto"
        >
          <TreeNodePanel node={summary} />
        </div>
      </div>
    </div>
  )
}
