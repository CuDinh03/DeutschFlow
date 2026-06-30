// SkillTreeView — lush botanical "Cây học tập" (na-tree parity v2).
// A tapering bark trunk; each CEFR level is a tier with a milestone disc, and its
// lessons fan out on curved branches (≤3 nodes per branch, alternating sides).
// Each branch carries a foliage cluster (topic-tinted leaf blobs) holding the
// lesson fruit: ripe orange = completed (✓), yellow bloom = in-progress, green
// bud = available, grey leaf = locked. Tap a non-locked fruit to open it.
//
// Real data = flat skill-tree nodes grouped by cefrLevel (the backend has no
// per-skill/topic structure), so branches chunk a level's nodes and the foliage
// is tinted by a cycling topic palette rather than a real topic group.

import { useMemo } from 'react'
import { View } from 'react-native'
import { router, type Href } from 'expo-router'
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg'
import { fonts, useTheme } from '@/lib/theme'
import type { SkillNode } from '@/lib/skillTreeApi'

const CEFR_ORDER = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const BARK = '#564636'
const BARK_DARK = '#3F3226'

// Foliage tints cycled per branch (na-theme topic-group leaves).
const FOLIAGE = ['#8FB36B', '#6FB0A8', '#7FA8D8', '#B79BD8', '#E0A36A', '#9FC27A']

const BRANCH_SIZE = 3 // lessons per branch
const ROW = 150 // vertical space a branch occupies
const MS_GAP = 64 // milestone disc band
const TOP_PAD = 40
const BOTTOM_PAD = 56
const FRUIT_R = 13

type Branch = { nodes: SkillNode[]; side: -1 | 1; foliage: string }
type Tier = { level: string; branches: Branch[]; state: 'passed' | 'current' | 'locked' }

function tierState(nodes: SkillNode[]): 'passed' | 'current' | 'locked' {
  if (nodes.every((n) => n.status === 'COMPLETED')) return 'passed'
  if (nodes.some((n) => n.status === 'IN_PROGRESS' || n.status === 'AVAILABLE' || n.status === 'COMPLETED'))
    return 'current'
  return 'locked'
}

function truncate(s: string, n = 13): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

interface SkillTreeViewProps {
  nodes: SkillNode[]
  width: number
}

export function SkillTreeView({ nodes, width }: SkillTreeViewProps) {
  const c = useTheme().colors
  const cx = width / 2
  const armX = Math.min(width / 2 - 70, 116) // branch foliage centre offset

  const { tiers, height } = useMemo(() => {
    const grouped: Record<string, SkillNode[]> = {}
    for (const n of nodes) (grouped[n.cefrLevel || '—'] ??= []).push(n)
    const levels = Object.keys(grouped).sort(
      (a, b) => (CEFR_ORDER.indexOf(a) + 1 || 99) - (CEFR_ORDER.indexOf(b) + 1 || 99),
    )

    let foliageI = 0
    const built: Tier[] = levels.map((level) => {
      const lv = grouped[level].slice().sort((a, b) => a.dayNumber - b.dayNumber)
      const branches: Branch[] = []
      for (let i = 0; i < lv.length; i += BRANCH_SIZE) {
        branches.push({
          nodes: lv.slice(i, i + BRANCH_SIZE),
          side: branches.length % 2 === 0 ? -1 : 1,
          foliage: FOLIAGE[foliageI++ % FOLIAGE.length],
        })
      }
      return { level, branches, state: tierState(lv) }
    })

    let h = TOP_PAD
    for (const t of built) h += MS_GAP + t.branches.length * ROW
    return { tiers: built, height: h + BOTTOM_PAD }
  }, [nodes])

  if (nodes.length === 0) return null

  // Place tiers top→bottom (A1 at top). Collect milestones + branches with y.
  const milestones: { level: string; y: number; state: Tier['state'] }[] = []
  const branchRows: { branch: Branch; y: number }[] = []
  let y = TOP_PAD
  for (const t of tiers) {
    milestones.push({ level: t.level, y, state: t.state })
    y += MS_GAP
    for (const branch of t.branches) {
      branchRows.push({ branch, y })
      y += ROW
    }
  }

  const fruitColor = (st: string) =>
    st === 'COMPLETED'
      ? 'url(#ripe)'
      : st === 'IN_PROGRESS'
        ? c.accent
        : st === 'AVAILABLE'
          ? 'url(#bud)'
          : '#AEBCA4'

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="ripe" cx="38%" cy="34%" r="68%">
            <Stop offset="0%" stopColor="#F6B85A" />
            <Stop offset="55%" stopColor="#EE8C2E" />
            <Stop offset="100%" stopColor="#D86E1C" />
          </RadialGradient>
          <RadialGradient id="bud" cx="40%" cy="36%" r="70%">
            <Stop offset="0%" stopColor="#B6D49E" />
            <Stop offset="100%" stopColor="#7FA86A" />
          </RadialGradient>
        </Defs>

        {/* Tapering trunk (narrower at the top) */}
        <Path
          d={`M ${cx - 7} ${TOP_PAD} L ${cx + 7} ${TOP_PAD} L ${cx + 13} ${height - BOTTOM_PAD} L ${cx - 13} ${height - BOTTOM_PAD} Z`}
          fill={BARK}
        />

        {/* Branch arms (behind foliage) */}
        {branchRows.map(({ branch, y: by }, i) => {
          const ex = cx + branch.side * armX
          return (
            <Path
              key={`arm${i}`}
              d={`M ${cx} ${by + 6} Q ${cx + branch.side * armX * 0.5} ${by - 14} ${ex} ${by - 4}`}
              stroke={BARK_DARK}
              strokeWidth={7}
              strokeLinecap="round"
              fill="none"
            />
          )
        })}

        {/* Foliage clusters + fruit */}
        {branchRows.map(({ branch, y: by }, i) => {
          const fx = cx + branch.side * armX
          const fy = by - 6
          return (
            <G key={`br${i}`}>
              {/* leaf blobs */}
              <Ellipse cx={fx - 16} cy={fy - 6} rx={34} ry={26} fill={branch.foliage} opacity={0.55} />
              <Ellipse cx={fx + 18} cy={fy - 2} rx={30} ry={24} fill={branch.foliage} opacity={0.42} />
              <Ellipse cx={fx} cy={fy + 14} rx={32} ry={22} fill={branch.foliage} opacity={0.5} />

              {/* topic chip (uses first tag of the lead node, else day label) */}
              <SvgText
                x={fx}
                y={fy - 30}
                textAnchor="middle"
                fontFamily={fonts.bodyMedium}
                fontSize={10}
                fill={c.textSecondary}
              >
                {truncate(branch.nodes[0]?.tags?.[0]?.replace(/^#/, '') || `Ngày ${branch.nodes[0]?.dayNumber ?? ''}`)}
              </SvgText>

              {/* fruit (clustered) */}
              {branch.nodes.map((node, j) => {
                const angle = (-50 + j * 50) * (Math.PI / 180)
                const nx = fx + Math.cos(angle) * 20
                const ny = fy + Math.sin(angle) * 18
                const locked = node.status === 'LOCKED'
                return (
                  <G
                    key={node.id}
                    opacity={locked ? 0.5 : 1}
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
                    {node.status === 'IN_PROGRESS' ? (
                      <Circle cx={nx} cy={ny} r={FRUIT_R + 5} fill={c.accent} opacity={0.2} />
                    ) : null}
                    <Circle
                      cx={nx}
                      cy={ny}
                      r={FRUIT_R}
                      fill={fruitColor(node.status)}
                      stroke={node.status === 'COMPLETED' ? '#C2611A' : '#ffffff'}
                      strokeWidth={1.5}
                    />
                    {node.status === 'COMPLETED' ? (
                      <>
                        <Circle cx={nx + 9} cy={ny + 9} r={6.5} fill={c.success} stroke="#fff" strokeWidth={1.2} />
                        <SvgText x={nx + 9} y={ny + 12} textAnchor="middle" fontSize={8} fill="#fff">
                          ✓
                        </SvgText>
                      </>
                    ) : null}
                  </G>
                )
              })}
            </G>
          )
        })}

        {/* Milestone discs on the trunk */}
        {milestones.map((m, i) => {
          const isCurrent = m.state === 'current'
          const isPassed = m.state === 'passed'
          const fill = isCurrent ? c.surface : isPassed ? c.accent : c.surfaceSunken
          const stroke = isCurrent ? c.inkSurface : isPassed ? c.accentText : c.border
          return (
            <G key={`ms${i}`}>
              <Circle cx={cx} cy={m.y} r={20} fill={fill} stroke={stroke} strokeWidth={3} />
              <SvgText
                x={cx}
                y={m.y + 5}
                textAnchor="middle"
                fontFamily={fonts.displayBold}
                fontSize={13}
                fill={isPassed ? c.inkSurface : c.textPrimary}
              >
                {m.level}
              </SvgText>
            </G>
          )
        })}
      </Svg>
    </View>
  )
}
