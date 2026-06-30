// SkillTreeView — bottom-up "Cây học tập" (SKILL_TREE_SPEC Pha 1).
//
// The tree grows UP from the ground: the lowest CEFR level sits on a soil mound
// with a sprout at the trunk's base; each higher level stacks above it on the
// tapering bark trunk; the crown (goal) caps the top. Every level carries a
// milestone disc (gold trophy = passed, white = in-progress, dashed grey lock =
// locked) and fans its lessons onto curved branches with topic-tinted foliage.
// Lesson fruit: ripe orange + ✓ = completed, accent halo = in-progress, green
// bud = available (tappable), grey nub = locked.
//
// Geometry is computed in `skill-tree/layout.ts` (pure, unit-tested); colours in
// `skill-tree/palette.ts`; motif glyphs in `skill-tree/glyphs.tsx`. Pan/zoom,
// the lifecycle motifs, and the companion arrive in Pha 2.

import { useMemo } from 'react'
import { View } from 'react-native'
import { router, type Href } from 'expo-router'
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
import { fonts, useTheme } from '@/lib/theme'
import type { SkillNode } from '@/lib/skillTreeApi'
import { buildTreeLayout, trunkPath, type BranchRow, type MilestoneState } from './skill-tree/layout'
import { BARK, CROWN_LEAVES, FOLIAGE, GROUND, MS_PAL } from './skill-tree/palette'
import { CheckGlyph, LockGlyph, SproutGlyph, TrophyGlyph } from './skill-tree/glyphs'

const FRUIT_R = 13

function truncate(s: string, n = 14): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

interface SkillTreeViewProps {
  nodes: SkillNode[]
  width: number
}

export function SkillTreeView({ nodes, width }: SkillTreeViewProps) {
  const c = useTheme().colors
  const layout = useMemo(() => buildTreeLayout(nodes, width, FOLIAGE), [nodes, width])

  if (nodes.length === 0) return null

  const { tiers, groundY, topY, height, cx, goalLabel } = layout
  const armX = Math.min(width / 2 - 56, 120) // branch foliage centre offset

  const fruitFill = (status: SkillNode['status']) =>
    status === 'COMPLETED'
      ? 'url(#naRipe)'
      : status === 'IN_PROGRESS'
        ? c.accent
        : status === 'AVAILABLE'
          ? 'url(#naBud)'
          : '#AEBCA4'

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
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

        {/* Ground mound */}
        <Ellipse cx={cx} cy={groundY + 30} rx={Math.min(width * 0.42, 200)} ry={30} fill={GROUND.moundOuter} opacity={0.55} />
        <Ellipse cx={cx} cy={groundY + 26} rx={Math.min(width * 0.3, 140)} ry={20} fill={GROUND.moundInner} opacity={0.5} />

        {/* Tapering trunk (wide at the base, thin at the crown) */}
        <Path d={trunkPath(cx, groundY, topY)} fill="url(#naTrunk)" stroke={BARK.dark} strokeWidth={1.5} />

        {/* Crown canopy + goal label */}
        <Crown cx={cx} topY={topY} goalLabel={goalLabel} />

        {/* Branches (arms + foliage + fruit) */}
        {tiers.map((tier) =>
          tier.branchRows.map((branch, bi) => (
            <Branch
              key={`${tier.level}-${bi}`}
              branch={branch}
              cx={cx}
              armX={armX}
              fruitFill={fruitFill}
              labelColor={c.textSecondary}
              accent={c.accent}
              success={c.success}
            />
          )),
        )}

        {/* Milestone discs on the trunk */}
        {tiers.map((tier) => (
          <Milestone key={tier.level} level={tier.level} state={tier.state} cx={cx} y={tier.milestoneY} />
        ))}

        {/* Sprout at the base of the trunk */}
        <G transform={`translate(${cx},${groundY + 6})`}>
          <Circle r={16} fill="#fff" stroke={GROUND.sproutRing} strokeWidth={2.5} />
          <SproutGlyph />
        </G>
      </Svg>
    </View>
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
        <Ellipse
          key={i}
          cx={b[0]}
          cy={b[1]}
          rx={b[2]}
          ry={b[2] * 0.82}
          fill={CROWN_LEAVES[i % 2]}
          opacity={0.55 + 0.1 * (i % 3)}
        />
      ))}
      {goalLabel ? (
        <SvgText
          x={cx}
          y={topY - 36}
          textAnchor="middle"
          fontFamily={fonts.displayBold}
          fontSize={15}
          fill="#fff"
        >
          {goalLabel}
        </SvgText>
      ) : null}
    </G>
  )
}

function Branch({
  branch,
  cx,
  armX,
  fruitFill,
  labelColor,
  accent,
  success,
}: {
  branch: BranchRow
  cx: number
  armX: number
  fruitFill: (s: SkillNode['status']) => string
  labelColor: string
  accent: string
  success: string
}) {
  const fx = cx + branch.side * armX
  const fy = branch.y
  const chipLabel = truncate(
    branch.nodes[0]?.tags?.[0]?.replace(/^#/, '') || `Ngày ${branch.nodes[0]?.dayNumber ?? ''}`,
  )

  return (
    <G>
      {/* arm from trunk to foliage centre */}
      <Path
        d={`M ${cx} ${fy + 8} Q ${cx + branch.side * armX * 0.5} ${fy - 16} ${fx} ${fy - 2}`}
        stroke={BARK.dark}
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
      />

      {/* leaf blobs */}
      <Ellipse cx={fx - 16} cy={fy - 6} rx={34} ry={26} fill={branch.foliage} opacity={0.55} />
      <Ellipse cx={fx + 18} cy={fy - 2} rx={30} ry={24} fill={branch.foliage} opacity={0.42} />
      <Ellipse cx={fx} cy={fy + 14} rx={32} ry={22} fill={branch.foliage} opacity={0.5} />

      {/* topic chip (Pha 3 wires real topic groups; until then: tag/day) */}
      <SvgText x={fx} y={fy - 30} textAnchor="middle" fontFamily={fonts.bodyMedium} fontSize={10} fill={labelColor}>
        {chipLabel}
      </SvgText>

      {/* lesson fruit */}
      {branch.nodes.map((node, j) => {
        const angle = (-50 + j * 50) * (Math.PI / 180)
        const nx = fx + Math.cos(angle) * 20
        const ny = fy + Math.sin(angle) * 18
        const locked = node.status === 'LOCKED'
        const statusWord =
          node.status === 'COMPLETED'
            ? 'đã hoàn thành'
            : node.status === 'IN_PROGRESS'
              ? 'đang học'
              : node.status === 'AVAILABLE'
                ? 'sẵn sàng học'
                : 'đã khoá'
        return (
          <G
            key={node.id}
            opacity={locked ? 0.5 : 1}
            accessibilityRole={locked ? undefined : 'button'}
            accessibilityLabel={`${node.title}, ${statusWord}`}
            onPress={
              locked
                ? undefined
                : () =>
                    router.push({
                      pathname: '/(student)/node',
                      params: { nodeId: String(node.id), title: node.title },
                    } as unknown as Href)
            }
          >
            {node.status === 'IN_PROGRESS' ? <Circle cx={nx} cy={ny} r={FRUIT_R + 5} fill={accent} opacity={0.2} /> : null}
            <Circle
              cx={nx}
              cy={ny}
              r={FRUIT_R}
              fill={fruitFill(node.status)}
              stroke={node.status === 'COMPLETED' ? '#C2611A' : '#ffffff'}
              strokeWidth={1.5}
            />
            {node.status === 'COMPLETED' ? (
              <G transform={`translate(${nx + 9},${ny + 9})`}>
                <Circle r={6.5} fill={success} stroke="#fff" strokeWidth={1.2} />
                <CheckGlyph />
              </G>
            ) : null}
          </G>
        )
      })}
    </G>
  )
}

function Milestone({
  level,
  state,
  cx,
  y,
}: {
  level: string
  state: MilestoneState
  cx: number
  y: number
}) {
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
          <SvgText
            x={0}
            y={5}
            textAnchor="middle"
            fontFamily={fonts.displayBold}
            fontSize={14}
            fill="#161513"
          >
            {level}
          </SvgText>
        )}
      </G>
    </G>
  )
}
