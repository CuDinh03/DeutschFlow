'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Play, Sparkles } from 'lucide-react'
import api from '@/lib/api'
import { buildTreeLayout, type Branch, type PlacedNode } from '@/lib/roadmap-tree/treeLayout'
import {
  isSkillMastered,
  nextSkillToPractice,
  parsePracticeOverview,
  SKILL_ORDER,
  type NodePracticeStats,
} from '@/lib/roadmap-tree/practiceStats'
import { planRitual, RITUAL_TIMELINE, type RitualPlan } from '@/lib/roadmap-tree/ritual'
import { nodeDisplayTitle, type RoadmapNode } from '@/lib/roadmap-tree/types'
import type { Skill } from '@/lib/skills'
import { EmptyState } from '@/components/ui-v2'
import { SkillTreeCanvas } from './SkillTreeCanvas'
import { TreeNodePanel, type TreeNodeSummary } from './TreeNodePanel'

/**
 * Tab "Cây học tập" — cùng dữ liệu `GET /roadmap/me` với tab "Bài học", chỉ khác cách nhìn: cành là
 * tuần, node là ngày, và bốn kỹ năng nằm trong bảng bên phải vì đó là chỗ chúng thật sự ở.
 *
 * Riêng điểm luyện tập per-kỹ-năng (Đợt 2) đọc thêm `GET /skill-tree/{nodeId}/practice` — CHỈ cho
 * node đang chọn và node đang học, có cache theo node: cây 46 ngày mà fetch cả 46 là tự bắn mình.
 */

const ZOOM_STEP = 1.25
const MOTION_PREF_KEY = 'df-tree-motion'

export interface RoadmapTreeTabProps {
  nodes: RoadmapNode[]
  /** Node từ URL (?node=) — chọn sẵn khi mở tab để share/refresh giữ đúng ngữ cảnh (T7). */
  initialSelectedId?: number | null
  /** Bắn khi NGƯỜI DÙNG chọn node (không bắn cho auto-select) — page ghi vào URL. */
  onSelectedIdChange?: (id: number) => void
  /**
   * Nghi thức trở về từ runner: `?feiern=<skill>` đi kèm `?node=` (page đã đọc + xoá param).
   * Tab tải lại điểm của node đó (bỏ cache) rồi diễn bậc tương ứng — xem ritual.ts.
   */
  initialFeiern?: { nodeId: number; skill: Skill } | null
}

export function RoadmapTreeTab({
  nodes,
  initialSelectedId,
  onSelectedIdChange,
  initialFeiern,
}: RoadmapTreeTabProps) {
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
  const panelRef = useRef<HTMLElement | null>(null)

  const layout = useMemo(() => buildTreeLayout(nodes), [nodes])
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const nodeByCode = useMemo(() => new Map(nodes.map((n) => [n.code, n])), [nodes])
  const placedById = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout])

  /** Node đang học — đích của auto-focus camera, nút ⌖ và hero CTA "Học tiếp". */
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

  // ── Điểm luyện tập per-kỹ-năng (N2) — cache theo node, node khoá không có gì để hỏi ──
  const [practiceStats, setPracticeStats] = useState<Map<number, NodePracticeStats>>(new Map())
  const statsInFlightRef = useRef(new Set<number>())

  // ── Nghi thức trở về (L3a) ──
  // `pendingFeiern` sống từ lúc nhận param tới lúc điểm của node về; lúc đó mới biết bậc nào.
  const [pendingFeiern, setPendingFeiern] = useState<{ nodeId: number; skill: Skill } | null>(null)
  const [ritual, setRitual] = useState<RitualPlan | null>(null)
  const [cameraTarget, setCameraTarget] = useState<{ id: number; seq: number } | null>(null)
  const ritualTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => {
    if (!initialFeiern) return
    setPendingFeiern(initialFeiern)
    // BẮT BUỘC bỏ cache node vừa luyện: điểm vừa chấm phải về thì cánh mới tô — cache Map không có
    // invalidation nào khác.
    setPracticeStats((m) => {
      if (!m.has(initialFeiern.nodeId)) return m
      const next = new Map(m)
      next.delete(initialFeiern.nodeId)
      return next
    })
  }, [initialFeiern])

  useEffect(() => {
    // Fetch cho node đang chọn VÀ node đang học: cánh hoa cần dữ liệu của node hoa kể cả khi
    // người dùng deep-link vào một node khác. `statsInFlightRef` chặn fetch trùng — effect chạy lại
    // mỗi khi cache đổi, không được coi đó là cớ hỏi lại API.
    const wanted = new Set(
      [selectedId, focusNodeId, pendingFeiern?.nodeId ?? null].filter(
        (id): id is number =>
          id != null &&
          !practiceStats.has(id) &&
          !statsInFlightRef.current.has(id) &&
          nodeById.get(id)?.state !== 'locked',
      ),
    )
    wanted.forEach((id) => {
      statsInFlightRef.current.add(id)
      api
        .get(`/skill-tree/${id}/practice`)
        .then((res) => {
          setPracticeStats((m) => new Map(m).set(id, parsePracticeOverview(res.data)))
        })
        .catch(() => {
          // Điểm là lớp trang trí trên cây — thiếu nó panel vẫn đủ đường đi. Ghi marker rỗng để
          // không tự hỏi lại một API đang hỏng trong vòng lặp effect.
          setPracticeStats((m) => new Map(m).set(id, {}))
        })
        .finally(() => statsInFlightRef.current.delete(id))
    })
  }, [selectedId, focusNodeId, pendingFeiern, nodeById, practiceStats])

  // Điểm của node vừa luyện đã về → chốt kế hoạch nghi thức, chạy timeline, rồi trả cây về tĩnh.
  useEffect(() => {
    if (!pendingFeiern) return
    const stats = practiceStats.get(pendingFeiern.nodeId)
    if (!stats) return
    setPendingFeiern(null)
    const plan = planRitual(layout, pendingFeiern.nodeId, pendingFeiern.skill, stats)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Tắt hiệu ứng / giảm chuyển động → mọi nghi thức thành đổi trạng thái tức thì: cây đã ở
    // trạng thái mới rồi, không gắn class nào cả.
    if (!plan || !motionEnabled || reduced) return
    setRitual(plan)
    const timers: ReturnType<typeof setTimeout>[] = []
    if (plan.tier >= 2 && plan.nextNodeId != null) {
      timers.push(
        setTimeout(
          () => setCameraTarget({ id: plan.nextNodeId as number, seq: Date.now() }),
          RITUAL_TIMELINE.cameraGlideMs,
        ),
      )
    }
    timers.push(setTimeout(() => setRitual(null), RITUAL_TIMELINE.totalMs))
    ritualTimersRef.current = timers
  }, [pendingFeiern, practiceStats, layout, motionEnabled])
  useEffect(() => () => ritualTimersRef.current.forEach(clearTimeout), [])

  // ── Hero CTA "Học tiếp" (N1): node đang học + kỹ năng còn thiếu → 1 click vào runner ──
  const hero = useMemo<{ id: number; skill: Skill; target: string } | null>(() => {
    if (focusNodeId == null) return null
    const node = nodeById.get(focusNodeId)
    const placed = placedById.get(focusNodeId)
    if (!node || !placed || placed.motif === 'nub' || placed.motif === 'leaf') return null
    const skill = nextSkillToPractice(practiceStats.get(focusNodeId) ?? {})
    const target = placed.dayNumber
      ? t('tree.dayShort', { day: placed.dayNumber })
      : nodeDisplayTitle(node, locale)
    return { id: focusNodeId, skill, target }
  }, [focusNodeId, nodeById, placedById, practiceStats, t, locale])

  /** Cánh hoa theo kỹ năng — chỉ có nghĩa khi đã tải xong thống kê của node hoa. */
  const flowerMastery = useMemo<Partial<Record<Skill, boolean>> | null>(() => {
    if (focusNodeId == null || placedById.get(focusNodeId)?.motif !== 'flower') return null
    const stats = practiceStats.get(focusNodeId)
    if (!stats) return null
    const mastery: Partial<Record<Skill, boolean>> = {}
    for (const skill of SKILL_ORDER) mastery[skill] = isSkillMastered(stats[skill])
    return mastery
  }, [focusNodeId, placedById, practiceStats])

  const summary = useMemo<TreeNodeSummary | null>(() => {
    if (selectedId == null) return null
    const node = nodeById.get(selectedId)
    const placed = placedById.get(selectedId)
    if (!node || !placed) return null
    // N7: node khoá kể điều kiện mở — tra node chặn từ `prerequisiteCode` (cùng payload
    // /roadmap/me, không cần gọi thêm gì).
    const prereqNode = node.prerequisiteCode ? nodeByCode.get(node.prerequisiteCode) : null
    const prerequisite = prereqNode
      ? {
          id: prereqNode.id,
          label: [
            prereqNode.dayNumber ? t('tree.dayShort', { day: prereqNode.dayNumber }) : '',
            nodeDisplayTitle(prereqNode, locale),
          ]
            .filter(Boolean)
            .join(' · '),
        }
      : null
    return {
      id: node.id,
      title: node.title,
      subtitle: node.subtitle,
      emoji: node.emoji,
      description: node.description,
      xpReward: node.xpReward,
      cefrLevel: node.cefrLevel,
      dayNumber: placed.dayNumber,
      weekNumber: node.weekNumber ?? placed.week,
      motif: placed.motif,
      skillCounts: node.skillCounts ?? {},
      lessonsCompleted: node.lessonsCompleted,
      lessonsTotal: node.lessonsTotal,
      prerequisite,
    }
  }, [selectedId, nodeById, nodeByCode, placedById, t, locale])

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
        {hero && (
          <Link
            href={`/v2/student/practice/${hero.id}/${hero.skill}`}
            className="ga-ui inline-flex min-h-9 items-center gap-1.5 rounded-ga bg-ga-accent px-3 py-1.5 text-[12.5px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90"
          >
            <Play size={13} aria-hidden />
            {t('tree.continueCta', { target: hero.target, skill: t(`tree.skillNames.${hero.skill}`) })}
          </Link>
        )}
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
            flowerMastery={flowerMastery}
            ritual={ritual}
            cameraTarget={cameraTarget}
            autoFocusId={initialFeiern?.nodeId ?? focusNodeId}
          />
        </div>
        {/* Landmark riêng (B-04): panel là vùng bổ trợ của cây — có tên để screen reader
            nhảy thẳng tới, và để e2e đếm hành động TRONG panel không dính CTA ngoài trang. */}
        <aside
          ref={panelRef}
          aria-label={t('tree.panelLabel')}
          className="min-h-0 shrink-0 bg-ga-surface lg:h-[calc(100vh-22rem)] lg:max-h-[640px] lg:min-h-[400px] lg:w-[300px] lg:overflow-auto"
        >
          <TreeNodePanel
            node={summary}
            stats={selectedId != null ? practiceStats.get(selectedId) ?? null : null}
            onJumpToNode={handleUserSelect}
          />
        </aside>
      </div>
    </div>
  )
}
