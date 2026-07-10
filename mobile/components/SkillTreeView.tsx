// SkillTreeView — the interactive bottom-up "Cây học tập" surface (Pha 2).
//
// The tree is laid out in a fixed canvas space (CANVAS_W × layout.height) and
// painted once inside a static <G>. Pan / pinch / double-tap-zoom drive a wrapping
// RN <Animated.View> (transformOrigin '0 0') on the UI thread via useTreeGestures'
// animatedStyle, so the SVG never re-renders per frame (spec C4). The transform is
// NOT on an svg <Animated.G>: on the New Architecture (Fabric), react-native-svg
// does not update an animated <G> transform (see SKILL_TREE_PROGRESS.md §10/§11).
// The <Svg> is sized to the full canvas and clipped by an overflow:hidden viewport
// View. Lesson taps are hit-tested in canvas space (per-node <G onPress> is
// unreliable under a GestureDetector), then surfaced via onSelectNode → NodeSheet.
// Zoom/fit/companion chrome are RN overlays outside the <Svg>.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { MotiView } from 'moti'
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
import Animated, { useReducedMotion } from 'react-native-reanimated'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import type { SkillNode } from '@/lib/skillTreeApi'
import { companionEmoji, type CompanionKey } from '@/lib/treeCompanion'
import {
  buildTreeLayout,
  detectLevelUp,
  focusTargetId,
  recommendedNodeId,
  trunkPath,
  type LevelUpEvent,
  type MilestoneState,
} from './skill-tree/layout'
import { BARK, CROWN_LEAVES, GROUND, GROUP_COLORS, MS_PAL, SKILL_DOTS, type TopicGroupKey } from './skill-tree/palette'
import { CheckGlyph, LockGlyph, SproutGlyph } from './skill-tree/glyphs'
import { nodeOffsets } from './skill-tree/nodeOffsets'
import { topicGroupOf, topicLabelOf } from './skill-tree/topicGroup'
import { useTreeGestures } from './skill-tree/controls/useTreeGestures'
import { FitButton, FocusButton, LevelRail, ShareButton, ZoomButtons } from './skill-tree/controls/TreeControls'
import { shareTreePng, treeCaption } from '@/lib/shareTree'
import { CompanionChips } from './skill-tree/controls/CompanionChips'
import { BloomHalo, CompanionEmoji, NodeMotif, RecRing, RootMotif, SkillBadge } from './skill-tree/motifs/NodeMotif'

const CANVAS_W = 380 // fixed layout width; the gesture transform maps it to the viewport
const ARM_X = Math.min(CANVAS_W / 2 - 56, 120)
const TAP_R = 26 // tap hit radius in canvas px
const MIN_TRUNK_STUB = 220 // cold-start (mầm) living-trunk height so the sprout has a stub to perch on

function truncate(s: string, n = 14): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

interface PlacedNode {
  node: SkillNode
  x: number
  y: number
  branchGroup: TopicGroupKey
  /** foundation-root node (lowest tier's seed cluster) — rendered as a seed/root, not fruit. */
  isRoot?: boolean
}
interface BranchVisual {
  key: string
  fx: number
  fy: number
  foliage: string
  chipLabel: string
  group: TopicGroupKey
  /** current (in-progress) level fills in its foliage as lessons complete (0..1);
   *  1 for already-passed levels. Drives the "tán dày dần" growth feel. */
  growth: number
  /** the ground-anchored foundation cluster — skips the branch arm + foliage (roots instead). */
  isRoot?: boolean
}

interface SkillTreeViewProps {
  nodes: SkillNode[]
  viewportW: number
  viewportH: number
  companion: CompanionKey
  onCompanionChange: (key: CompanionKey) => void
  onSelectNode: (node: SkillNode) => void
  /** Pha 4 filter: dim branches whose topic group ≠ this (null = no filter). */
  filterTopic?: TopicGroupKey | null
  /** Pha 4 filter: dim nodes whose skill index (dayNumber % 4) ≠ this. */
  filterSkill?: number | null
}

export function SkillTreeView({
  nodes,
  viewportW,
  viewportH,
  companion,
  onCompanionChange,
  onSelectNode,
  filterTopic = null,
  filterSkill = null,
}: SkillTreeViewProps) {
  const c = useTheme().colors
  const insets = useSafeAreaInsets()
  const reduced = useReducedMotion()
  const svgRef = useRef<Svg>(null)
  const layout = useMemo(() => buildTreeLayout(nodes, CANVAS_W), [nodes])
  const recId = useMemo(() => recommendedNodeId(nodes), [nodes])
  const compEmoji = companionEmoji(companion)

  // Foliage clusters + per-node canvas positions (shared by render + hit-test).
  const geom = useMemo(() => {
    const branches: BranchVisual[] = []
    const placed: PlacedNode[] = []
    layout.tiers.forEach((tier) => {
      tier.branchRows.forEach((b, bi) => {
        // The foundation root cluster is centred on the trunk base (seeds spread symmetrically
        // around the roots), not offset to one side — fixes #6 gap 2 ("lệch một bên").
        const fx = b.isRoot ? layout.cx : layout.cx + b.side * ARM_X
        const fy = b.y
        // Pha 3: tint + label each branch by its lead lesson's real topic group
        // (phase/industry → group), replacing the cosmetic palette cycle.
        const lead = b.nodes[0]
        const group: TopicGroupKey = lead ? topicGroupOf(lead) : 'daily'
        // Foliage density coefficient now lives in the pure layout layer (tier.foliageScale):
        // passed = lush, current level fills floor→1 by completion, future = none.
        const growth = tier.foliageScale
        branches.push({
          key: `${tier.level}-${bi}`,
          fx,
          fy,
          group,
          foliage: GROUP_COLORS[group].leaf,
          chipLabel: lead ? truncate(topicLabelOf(lead), 18) : '',
          growth,
          isRoot: b.isRoot,
        })
        const offs = nodeOffsets(b.nodes.length)
        b.nodes.forEach((node, j) => {
          const [dx, dy] = offs[j]
          placed.push({ node, x: fx + dx, y: fy + dy, branchGroup: group, isRoot: b.isRoot })
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
        // Skip filtered-out (dimmed) nodes so the filter gates interaction, not
        // just opacity — and so a nearby visible node still wins an overlapping tap.
        const branchDim = filterTopic !== null && p.branchGroup !== filterTopic
        const dimmed = branchDim || (filterSkill !== null && p.node.dayNumber % 4 !== filterSkill)
        if (dimmed) continue
        const d = (p.x - px) * (p.x - px) + (p.y - py) * (p.y - py)
        if (d < bestD) {
          bestD = d
          best = p
        }
      }
      if (best) onSelectNode(best.node)
    },
    [geom, onSelectNode, filterTopic, filterSkill],
  )

  const { animatedStyle, gesture, fitView, zoomIn, zoomOut, focusOn } = useTreeGestures({
    canvasW: CANVAS_W,
    canvasH: layout.height,
    viewportW,
    viewportH,
    onTapCanvas,
  })

  // Canvas position of the lesson "Về bài đang học" recentres on — the active IN_PROGRESS
  // lesson if any, else the recommended next-to-start (recId stays AVAILABLE-only for the
  // ring/companion). Plus a level-jump handler for the CEFR rail; both use focusOn.
  const focusId = useMemo(() => focusTargetId(nodes), [nodes])
  const focusPos = useMemo(() => geom.placed.find((p) => p.node.id === focusId), [geom, focusId])
  const jumpToLevel = useCallback(
    (level: string) => {
      const tier = layout.tiers.find((t) => t.level === level)
      if (tier) focusOn(layout.cx, tier.milestoneY)
    },
    [layout, focusOn],
  )

  const total = nodes.length
  const done = nodes.filter((n) => n.status === 'COMPLETED').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const onShare = useCallback(() => {
    // Auto-fit so the shared image is the whole tree, then capture exactly when
    // the fit animation completes (no thread race). react-native-svg toDataURL →
    // PNG, no extra native dep. base64 is undefined if the snapshot fails.
    fitView(() => {
      svgRef.current?.toDataURL((base64) => {
        if (!base64) return
        void shareTreePng(base64, treeCaption(done, total, pct))
      })
    })
  }, [fitView, done, total, pct])

  // Growth celebration (#6): when a CEFR level is newly passed/unlocked (the tree "mọc" a stage),
  // flash a banner. The foliage itself already fills in via foliageScale on the next render — this
  // just announces the milestone. Detection runs on the pure tier-state signature (unit-tested).
  const prevTierStates = useRef<Record<string, MilestoneState> | null>(null)
  const [levelUp, setLevelUp] = useState<LevelUpEvent | null>(null)
  useEffect(() => {
    const cur: Record<string, MilestoneState> = {}
    for (const t of layout.tiers) cur[t.level] = t.state
    const prev = prevTierStates.current
    prevTierStates.current = cur
    if (prev) {
      const ev = detectLevelUp(prev, cur)
      if (ev) setLevelUp(ev)
    }
  }, [layout.tiers])
  useEffect(() => {
    if (!levelUp) return
    const id = setTimeout(() => setLevelUp(null), 4200)
    return () => clearTimeout(id)
  }, [levelUp])

  // Living-trunk tip = the highest reached level, or a short stub at cold-start so
  // the "mầm" (bare trunk + sprout) shows instead of a degenerate/absent trunk. The
  // sprout perches here as the growing point until the goal/crown is reached.
  // Clamp the cold-start stub to the canvas band: on a short all-locked tree (≤2 tiers,
  // totalContent < MIN_TRUNK_STUB) an unclamped groundY − stub would push the sprout/trunk tip
  // above topY (even off the top edge), hiding the very "mầm" this branch exists to show.
  const trunkTopY = layout.hasGrown
    ? layout.grownTopY
    : Math.max(layout.topY, layout.groundY - MIN_TRUNK_STUB)

  if (nodes.length === 0 || viewportW === 0 || viewportH === 0) return null

  return (
    <View
      style={{ flex: 1, overflow: 'hidden' }}
      accessibilityLabel="Cây học tập — kéo để di chuyển, chụm để phóng to. Dùng tab Giai đoạn để xem danh sách bài học."
    >
      {/* The View carries RNGH's injected ref so svgRef stays bound to the Svg
          instance (toDataURL) regardless of gesture-handler/svg internals. */}
      <GestureDetector gesture={gesture}>
        <View collapsable={false} style={{ width: viewportW, height: viewportH, overflow: 'hidden' }}>
          {/* Pan/zoom transform on this wrapping View, NOT on an svg <G>: Fabric +
              react-native-svg does not update an animated <G> transform. The Svg is
              sized to the full canvas so nothing clips before the View scales it;
              transformOrigin '0 0' keeps the scale about the origin to match zoomMath. */}
          <Animated.View
            style={[
              { position: 'absolute', top: 0, left: 0, width: CANVAS_W, height: layout.height, transformOrigin: '0 0' },
              animatedStyle,
            ]}
          >
          <Svg ref={svgRef} width={CANVAS_W} height={layout.height}>
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

          <G>
            {/* ground mound + roots fanning into it */}
            <Ellipse cx={layout.cx} cy={layout.groundY + 30} rx={180} ry={30} fill={GROUND.moundOuter} opacity={0.55} />
            <Ellipse cx={layout.cx} cy={layout.groundY + 26} rx={130} ry={20} fill={GROUND.moundInner} opacity={0.5} />
            {[-66, -32, 34, 64].map((dx, i) => (
              <Path
                key={i}
                d={`M ${layout.cx + (dx < 0 ? -8 : 8)} ${layout.groundY + 2} Q ${layout.cx + dx * 0.6} ${layout.groundY + 12} ${layout.cx + dx} ${layout.groundY + 27}`}
                stroke={BARK.dark}
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                opacity={0.3}
              />
            ))}

            {/* faint "still to grow" trunk — from the living tip up to the goal crown */}
            {trunkTopY > layout.topY ? (
              <Path
                d={`M ${layout.cx} ${trunkTopY} L ${layout.cx} ${layout.topY + 8}`}
                stroke={BARK.dark}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray="2 13"
                opacity={0.28}
              />
            ) : null}

            {/* living trunk — grows up per reached level; at cold-start a short bare
                stub (MIN_TRUNK_STUB) so the mầm reads as a sprouting trunk, not nothing. */}
            <Path
              d={trunkPath(layout.cx, layout.groundY, trunkTopY)}
              fill="url(#naTrunk)"
              stroke={BARK.dark}
              strokeWidth={1.5}
            />

            {/* crown (goal) caps the top — faint until the goal level is actually reached */}
            <G opacity={layout.goalReached ? 1 : 0.34}>
              <Crown cx={layout.cx} topY={layout.topY} goalLabel={layout.goalLabel} />
            </G>

            {/* branch arms + foliage + topic chip */}
            {geom.branches.map((b) => {
              // Root (foundation) clusters render as seeds/roots at the ground per node, not a
              // fruit cluster up a branch arm — so skip the arm + foliage + chip for them.
              if (b.isRoot) return null
              const dim = filterTopic !== null && b.group !== filterTopic
              // current level's foliage fills in with completion (b.growth); passed = 1
              return (
                <G key={b.key} opacity={dim ? 0.16 : b.growth}>
                  <BranchFoliage branch={b} cx={layout.cx} labelColor={c.textPrimary} />
                </G>
              )
            })}

            {/* lesson fruit motifs */}
            {geom.placed.map(({ node, x, y, branchGroup, isRoot }) => {
              const isRec = node.id === recId
              const branchDim = filterTopic !== null && branchGroup !== filterTopic
              const nodeDim = branchDim || (filterSkill !== null && node.dayNumber % 4 !== filterSkill)
              const baseOpacity = node.status === 'LOCKED' ? 0.5 : 1
              // Name the frontier (recommended / in-progress / available) + every foundation-root
              // node so learners can tell lessons apart without tapping; the many completed/locked
              // ones stay unlabelled to avoid clutter (the cluster topic chip covers those).
              const showLabel = isRoot || isRec || node.status === 'IN_PROGRESS' || node.status === 'AVAILABLE'
              return (
                <G key={node.id} transform={`translate(${x},${y})`} opacity={nodeDim ? 0.12 : baseOpacity}>
                  {isRec ? <RecRing reduced={reduced} /> : null}
                  {node.status === 'IN_PROGRESS' ? <BloomHalo reduced={reduced} /> : null}
                  {isRoot ? (
                    <RootMotif status={node.status} />
                  ) : (
                    <>
                      <NodeMotif status={node.status} success={c.success} />
                      <SkillBadge color={SKILL_DOTS[node.dayNumber % 4].color} />
                    </>
                  )}
                  {isRec && compEmoji ? <CompanionEmoji emoji={compEmoji} /> : null}
                  {showLabel ? (
                    <SvgText
                      x={0}
                      y={27}
                      textAnchor="middle"
                      fontFamily={fonts.bodyMedium}
                      fontSize={8.5}
                      fill={c.textSecondary}
                    >
                      {truncate(node.title, 12)}
                    </SvgText>
                  ) : null}
                </G>
              )
            })}

            {/* milestone discs — solid for reached levels, faint skeleton for the future */}
            {layout.tiers.map((tier) =>
              tier.grown ? (
                <Milestone key={tier.level} level={tier.level} state={tier.state} cx={layout.cx} y={tier.milestoneY} />
              ) : (
                <SkeletonMilestone key={tier.level} level={tier.level} cx={layout.cx} y={tier.milestoneY} color={c.textFaint} />
              ),
            )}

            {/* sprout at the living tip — the growing point. The 2-leaf chồi marks
                "mọc từ mầm"; it gives way to the goal crown once the goal is reached. */}
            {!layout.goalReached ? (
              <G transform={`translate(${layout.cx} ${trunkTopY}) scale(1.7)`}>
                <SproutGlyph />
              </G>
            ) : null}
          </G>
        </Svg>
          </Animated.View>
        </View>
      </GestureDetector>

      {/* share / focus / zoom / fit cluster — sits above the companion row, clear of the home indicator */}
      <View
        style={{ position: 'absolute', right: space[4], bottom: insets.bottom + space[12], alignItems: 'flex-end', gap: space[2] }}
      >
        <ShareButton onShare={onShare} />
        {focusPos ? <FocusButton onFocus={() => focusOn(focusPos.x, focusPos.y, 1)} /> : null}
        <FitButton onFit={fitView} />
        <ZoomButtons onZoomIn={zoomIn} onZoomOut={zoomOut} />
      </View>

      {/* CEFR level-jump rail — left edge, highest level at the top to match the bottom-up canvas */}
      {layout.tiers.length > 1 ? (
        <View style={{ position: 'absolute', left: space[3], top: '32%' }}>
          <LevelRail
            levels={[...layout.tiers].reverse().map((t) => ({ level: t.level, state: t.state }))}
            onJump={jumpToLevel}
          />
        </View>
      ) : null}

      {/* companion picker */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + space[2] }}>
        <CompanionChips value={companion} onChange={onCompanionChange} />
      </View>

      {/* growth celebration — announces a newly passed/unlocked level (#6) */}
      {levelUp ? <GrowthBanner event={levelUp} reduced={reduced} top={insets.top} /> : null}
    </View>
  )
}

// Brief "cây vừa lớn thêm" overlay when a level is passed/unlocked. RN overlay OUTSIDE the Svg
// (spec §5); MotiView entrance, or a static box under reduced motion. Non-interactive.
function GrowthBanner({ event, reduced, top }: { event: LevelUpEvent; reduced: boolean; top: number }) {
  const c = useTheme().colors
  const text =
    event.kind === 'passed'
      ? `Hoàn thành ${event.level}! 🌳 Cây của bạn vừa lớn thêm`
      : `🌱 ${event.level} đã mở khoá — cây vươn cao hơn!`
  const box = (
    <View
      style={{
        backgroundColor: c.inkSurface,
        borderRadius: radius.md,
        paddingVertical: space[3],
        paddingHorizontal: space[4],
        maxWidth: 320,
      }}
    >
      <Text style={{ color: c.onInk, fontFamily: fonts.bodyMedium, fontSize: 14, textAlign: 'center' }}>{text}</Text>
    </View>
  )
  const wrap = {
    position: 'absolute' as const,
    top: top + space[3],
    left: space[4],
    right: space[4],
    alignItems: 'center' as const,
  }
  if (reduced) {
    return (
      <View pointerEvents="none" style={wrap}>
        {box}
      </View>
    )
  }
  return (
    <MotiView
      pointerEvents="none"
      style={wrap}
      from={{ opacity: 0, translateY: -12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 320 }}
    >
      {box}
    </MotiView>
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
      <SvgText x={fx} y={fy - 30} textAnchor="middle" fontFamily={fonts.bodyMedium} fontSize={12} fill={labelColor}>
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
        {state === 'locked' ? (
          <LockGlyph />
        ) : (
          <SvgText x={0} y={5} textAnchor="middle" fontFamily={fonts.displayBold} fontSize={14} fill="#161513">
            {level}
          </SvgText>
        )}
        {/* passed → keep the level letter + a small ✓ badge (matches the design's
            gold discs); the trophy hid which level it was. */}
        {state === 'passed' ? (
          <G transform="translate(15,-15)">
            <Circle cx={0} cy={0} r={8} fill="#1E9E61" stroke="#fff" strokeWidth={1.5} />
            <CheckGlyph />
          </G>
        ) : null}
      </G>
    </G>
  )
}

// A not-yet-reached level: a faint dashed dot with its CEFR letter, marking where
// the tree will grow next. Stacked up the faint trunk toward the (faint) crown.
function SkeletonMilestone({ level, cx, y, color }: { level: string; cx: number; y: number; color: string }) {
  return (
    <G opacity={0.4}>
      <Circle cx={cx} cy={y} r={15} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="3 4" />
      <SvgText x={cx} y={y + 4} textAnchor="middle" fontFamily={fonts.displayBold} fontSize={11} fill={color}>
        {level}
      </SvgText>
    </G>
  )
}
