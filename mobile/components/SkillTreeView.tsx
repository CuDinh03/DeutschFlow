// SkillTreeView — the interactive bottom-up "Cây học tập" surface (Pha 2).
//
// The tree is laid out in a fixed canvas space (CANVAS_W × layout.height) and
// painted once inside an <Animated.G>; pan / pinch / double-tap-zoom drive that
// group's transform on the UI thread via useTreeGestures, so the SVG never
// re-renders per frame (spec C4). Lesson taps are hit-tested in canvas space (the
// per-node <G onPress> is unreliable under a GestureDetector), then surfaced to
// the host via onSelectNode, which opens the NodeSheet. Zoom/fit/companion chrome
// are RN overlays outside the <Svg>.

import { useCallback, useMemo } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg'
import { GestureDetector } from 'react-native-gesture-handler'
import { useReducedMotion } from 'react-native-reanimated'
import { fonts, space, useTheme } from '@/lib/theme'
import type { SkillNode } from '@/lib/skillTreeApi'
import { companionEmoji, type CompanionKey } from '@/lib/treeCompanion'
import {
  buildTreeLayout,
  recommendedNodeId,
  trunkPath,
  type MilestoneState,
} from './skill-tree/layout'
import { BARK, CROWN_LEAVES, FOLIAGE, GROUND, MS_PAL, SKILL_DOTS } from './skill-tree/palette'
import { LockGlyph, SproutGlyph, TrophyGlyph } from './skill-tree/glyphs'
import { nodeOffsets } from './skill-tree/nodeOffsets'
import { AnimatedG, useTreeGestures } from './skill-tree/controls/useTreeGestures'
import { FitButton, ZoomButtons } from './skill-tree/controls/TreeControls'
import { CompanionChips } from './skill-tree/controls/CompanionChips'
import { BloomHalo, CompanionEmoji, NodeMotif, RecRing, SkillBadge } from './skill-tree/motifs/NodeMotif'

const CANVAS_W = 380 // fixed layout width; the gesture transform maps it to the viewport
const ARM_X = Math.min(CANVAS_W / 2 - 56, 120)
const TAP_R = 26 // tap hit radius in canvas px

function truncate(s: string, n = 14): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

interface PlacedNode {
  node: SkillNode
  x: number
  y: number
}
interface BranchVisual {
  key: string
  fx: number
  fy: number
  foliage: string
  chipLabel: string
}

interface SkillTreeViewProps {
  nodes: SkillNode[]
  viewportW: number
  viewportH: number
  companion: CompanionKey
  onCompanionChange: (key: CompanionKey) => void
  onSelectNode: (node: SkillNode) => void
}

export function SkillTreeView({
  nodes,
  viewportW,
  viewportH,
  companion,
  onCompanionChange,
  onSelectNode,
}: SkillTreeViewProps) {
  const c = useTheme().colors
  const insets = useSafeAreaInsets()
  const reduced = useReducedMotion()
  const layout = useMemo(() => buildTreeLayout(nodes, CANVAS_W, FOLIAGE), [nodes])
  const recId = useMemo(() => recommendedNodeId(nodes), [nodes])
  const compEmoji = companionEmoji(companion)

  // Foliage clusters + per-node canvas positions (shared by render + hit-test).
  const geom = useMemo(() => {
    const branches: BranchVisual[] = []
    const placed: PlacedNode[] = []
    layout.tiers.forEach((tier) => {
      tier.branchRows.forEach((b, bi) => {
        const fx = layout.cx + b.side * ARM_X
        const fy = b.y
        branches.push({
          key: `${tier.level}-${bi}`,
          fx,
          fy,
          foliage: b.foliage,
          chipLabel: truncate(
            b.nodes[0]?.tags?.[0]?.replace(/^#/, '') || `Ngày ${b.nodes[0]?.dayNumber ?? ''}`,
          ),
        })
        const offs = nodeOffsets(b.nodes.length)
        b.nodes.forEach((node, j) => {
          const [dx, dy] = offs[j]
          placed.push({ node, x: fx + dx, y: fy + dy })
        })
      })
    })
    return { branches, placed }
  }, [layout])

  const onTapCanvas = useCallback(
    (px: number, py: number) => {
      let best: PlacedNode | null = null
      let bestD = TAP_R * TAP_R
      for (const p of geom.placed) {
        const d = (p.x - px) * (p.x - px) + (p.y - py) * (p.y - py)
        if (d < bestD) {
          bestD = d
          best = p
        }
      }
      if (best) onSelectNode(best.node)
    },
    [geom, onSelectNode],
  )

  const { animatedProps, gesture, fitView, zoomIn, zoomOut } = useTreeGestures({
    canvasW: CANVAS_W,
    canvasH: layout.height,
    viewportW,
    viewportH,
    onTapCanvas,
  })

  if (nodes.length === 0 || viewportW === 0 || viewportH === 0) return null

  return (
    <View
      style={{ flex: 1, overflow: 'hidden' }}
      accessibilityLabel="Cây học tập — kéo để di chuyển, chụm để phóng to. Dùng tab Giai đoạn để xem danh sách bài học."
    >
      <GestureDetector gesture={gesture}>
        <Svg width={viewportW} height={viewportH}>
          <Defs>
            <RadialGradient id="naRipe" cx="38%" cy="34%" r="68%">
              <Stop offset="0%" stopColor="#F6B85A" />
              <Stop offset="55%" stopColor="#EE8C2E" />
              <Stop offset="100%" stopColor="#D86E1C" />
            </RadialGradient>
            <RadialGradient id="naBud" cx="40%" cy="36%" r="70%">
              <Stop offset="0%" stopColor="#B6D49E" />
              <Stop offset="100%" stopColor="#7FA86A" />
            </RadialGradient>
            <LinearGradient id="naTrunk" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor={BARK.dark} />
              <Stop offset="1" stopColor={BARK.light} />
            </LinearGradient>
          </Defs>

          <AnimatedG animatedProps={animatedProps}>
            {/* ground mound */}
            <Ellipse cx={layout.cx} cy={layout.groundY + 30} rx={180} ry={30} fill={GROUND.moundOuter} opacity={0.55} />
            <Ellipse cx={layout.cx} cy={layout.groundY + 26} rx={130} ry={20} fill={GROUND.moundInner} opacity={0.5} />

            {/* trunk */}
            <Path
              d={trunkPath(layout.cx, layout.groundY, layout.topY)}
              fill="url(#naTrunk)"
              stroke={BARK.dark}
              strokeWidth={1.5}
            />

            <Crown cx={layout.cx} topY={layout.topY} goalLabel={layout.goalLabel} />

            {/* branch arms + foliage + topic chip */}
            {geom.branches.map((b) => (
              <BranchFoliage key={b.key} branch={b} cx={layout.cx} labelColor={c.textSecondary} />
            ))}

            {/* lesson fruit motifs */}
            {geom.placed.map(({ node, x, y }) => {
              const isRec = node.id === recId
              return (
                <G key={node.id} transform={`translate(${x},${y})`} opacity={node.status === 'LOCKED' ? 0.5 : 1}>
                  {isRec ? <RecRing reduced={reduced} /> : null}
                  {node.status === 'IN_PROGRESS' ? <BloomHalo reduced={reduced} /> : null}
                  <NodeMotif status={node.status} success={c.success} />
                  <SkillBadge color={SKILL_DOTS[node.dayNumber % 4].color} />
                  {isRec && compEmoji ? <CompanionEmoji emoji={compEmoji} /> : null}
                </G>
              )
            })}

            {/* milestone discs */}
            {layout.tiers.map((tier) => (
              <Milestone key={tier.level} level={tier.level} state={tier.state} cx={layout.cx} y={tier.milestoneY} />
            ))}

            {/* sprout at the trunk base */}
            <G transform={`translate(${layout.cx},${layout.groundY + 6})`}>
              <Circle r={16} fill="#fff" stroke={GROUND.sproutRing} strokeWidth={2.5} />
              <SproutGlyph />
            </G>
          </AnimatedG>
        </Svg>
      </GestureDetector>

      {/* zoom / fit cluster — sits above the companion row, clear of the home indicator */}
      <View
        style={{ position: 'absolute', right: space[4], bottom: insets.bottom + space[12], alignItems: 'flex-end', gap: space[2] }}
      >
        <FitButton onFit={fitView} />
        <ZoomButtons onZoomIn={zoomIn} onZoomOut={zoomOut} />
      </View>

      {/* companion picker */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + space[2] }}>
        <CompanionChips value={companion} onChange={onCompanionChange} />
      </View>
    </View>
  )
}

function BranchFoliage({
  branch,
  cx,
  labelColor,
}: {
  branch: BranchVisual
  cx: number
  labelColor: string
}) {
  const { fx, fy, foliage, chipLabel } = branch
  return (
    <G>
      <Path
        d={`M ${cx} ${fy + 8} Q ${(cx + fx) / 2} ${fy - 16} ${fx} ${fy - 2}`}
        stroke={BARK.dark}
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
      />
      <Ellipse cx={fx - 16} cy={fy - 6} rx={34} ry={26} fill={foliage} opacity={0.55} />
      <Ellipse cx={fx + 18} cy={fy - 2} rx={30} ry={24} fill={foliage} opacity={0.42} />
      <Ellipse cx={fx} cy={fy + 14} rx={32} ry={22} fill={foliage} opacity={0.5} />
      <SvgText x={fx} y={fy - 30} textAnchor="middle" fontFamily={fonts.bodyMedium} fontSize={10} fill={labelColor}>
        {chipLabel}
      </SvgText>
    </G>
  )
}

function Crown({ cx, topY, goalLabel }: { cx: number; topY: number; goalLabel: string }) {
  const blobs: [number, number, number][] = [
    [cx - 34, topY - 4, 40],
    [cx + 32, topY, 44],
    [cx, topY - 38, 50],
    [cx - 58, topY + 26, 34],
    [cx + 60, topY + 22, 38],
  ]
  return (
    <G opacity={0.92}>
      {blobs.map((b, i) => (
        <Ellipse key={i} cx={b[0]} cy={b[1]} rx={b[2]} ry={b[2] * 0.82} fill={CROWN_LEAVES[i % 2]} opacity={0.55 + 0.1 * (i % 3)} />
      ))}
      {goalLabel ? (
        <SvgText x={cx} y={topY - 36} textAnchor="middle" fontFamily={fonts.displayBold} fontSize={15} fill="#fff">
          {goalLabel}
        </SvgText>
      ) : null}
    </G>
  )
}

function Milestone({ level, state, cx, y }: { level: string; state: MilestoneState; cx: number; y: number }) {
  const p = MS_PAL[state]
  return (
    <G>
      {p.glow ? <Circle cx={cx} cy={y} r={32} fill={p.glow} opacity={0.18} /> : null}
      <Circle
        cx={cx}
        cy={y}
        r={22}
        fill={p.fill}
        stroke={p.stroke}
        strokeWidth={state === 'in_progress' ? 3.5 : 3}
        strokeDasharray={p.dashed ? '5 5' : undefined}
      />
      <G transform={`translate(${cx},${y})`}>
        {state === 'passed' ? (
          <TrophyGlyph />
        ) : state === 'locked' ? (
          <LockGlyph />
        ) : (
          <SvgText x={0} y={5} textAnchor="middle" fontFamily={fonts.displayBold} fontSize={14} fill="#161513">
            {level}
          </SvgText>
        )}
      </G>
    </G>
  )
}
