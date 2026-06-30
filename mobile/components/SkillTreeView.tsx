// SkillTreeView — a vertical "growing tree" of the real skill-tree nodes.
// A central bark trunk with lesson nodes as fruit (ripe = completed, bloom =
// in-progress, bud = available, grey leaf = locked) on alternating branches,
// CEFR milestone discs between levels. Tap a non-locked node to open it.
//
// v1: vertical scroll (no pan/zoom/companion yet). Data is the real flat node
// list grouped by cefrLevel — the mockup's per-skill branches need data the
// backend doesn't expose, so the tree grows by level instead.

import { useMemo } from 'react'
import { View } from 'react-native'
import { router, type Href } from 'expo-router'
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg'
import { fonts, useTheme } from '@/lib/theme'
import type { SkillNode } from '@/lib/skillTreeApi'

const CEFR_ORDER = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const ROW = 98 // vertical gap between nodes
const MS_ROW = 92 // space a milestone disc takes
const TOP_PAD = 28
const BOTTOM_PAD = 48
const NODE_R = 19
const MS_R = 26
const BARK = '#564636'

type Placed =
  | { kind: 'milestone'; level: string; y: number; state: 'passed' | 'current' | 'locked' }
  | { kind: 'node'; node: SkillNode; x: number; y: number }

function levelState(nodes: SkillNode[]): 'passed' | 'current' | 'locked' {
  if (nodes.every((n) => n.status === 'COMPLETED')) return 'passed'
  if (nodes.some((n) => n.status === 'IN_PROGRESS' || n.status === 'AVAILABLE')) return 'current'
  if (nodes.some((n) => n.status === 'COMPLETED')) return 'current'
  return 'locked'
}

function truncate(s: string, n = 16): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

interface SkillTreeViewProps {
  nodes: SkillNode[]
  width: number
}

export function SkillTreeView({ nodes, width }: SkillTreeViewProps) {
  const c = useTheme().colors
  const cx = width / 2
  const off = Math.min(width / 2 - 52, 104)

  const { placed, height } = useMemo(() => {
    const grouped: Record<string, SkillNode[]> = {}
    for (const n of nodes) {
      const k = n.cefrLevel || '—'
      ;(grouped[k] ??= []).push(n)
    }
    const levels = Object.keys(grouped).sort(
      (a, b) => (CEFR_ORDER.indexOf(a) + 1 || 99) - (CEFR_ORDER.indexOf(b) + 1 || 99),
    )

    const out: Placed[] = []
    let y = TOP_PAD
    for (const level of levels) {
      const lvNodes = grouped[level].slice().sort((a, b) => a.dayNumber - b.dayNumber)
      out.push({ kind: 'milestone', level, y, state: levelState(lvNodes) })
      y += MS_ROW
      lvNodes.forEach((node, i) => {
        out.push({ kind: 'node', node, x: cx + (i % 2 === 0 ? -off : off), y })
        y += ROW
      })
    }
    return { placed: out, height: y + BOTTOM_PAD }
  }, [nodes, cx, off])

  if (nodes.length === 0) return null

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

        {/* Trunk */}
        <Rect x={cx - 7} y={TOP_PAD} width={14} height={height - TOP_PAD - BOTTOM_PAD} rx={7} fill={BARK} />

        {/* Branches (drawn first, behind the fruit) */}
        {placed.map((p, i) =>
          p.kind === 'node' ? (
            <Line key={`b${i}`} x1={cx} y1={p.y} x2={p.x} y2={p.y} stroke={BARK} strokeWidth={6} strokeLinecap="round" />
          ) : null,
        )}

        {/* Milestones */}
        {placed.map((p, i) => {
          if (p.kind !== 'milestone') return null
          const isCurrent = p.state === 'current'
          const isPassed = p.state === 'passed'
          const fill = isCurrent ? c.inkSurface : isPassed ? c.accentSoft : c.surface
          const stroke = isCurrent ? c.inkSurface : isPassed ? c.accentText : c.border
          const txt = isCurrent ? c.onInk : c.textPrimary
          return (
            <G key={`m${i}`}>
              <Circle cx={cx} cy={p.y} r={MS_R} fill={fill} stroke={stroke} strokeWidth={3} />
              <SvgText
                x={cx}
                y={p.y + 5}
                textAnchor="middle"
                fontFamily={fonts.displayBold}
                fontSize={15}
                fill={txt}
              >
                {p.level}
              </SvgText>
            </G>
          )
        })}

        {/* Nodes (fruit) */}
        {placed.map((p, i) => {
          if (p.kind !== 'node') return null
          const st = p.node.status
          const locked = st === 'LOCKED'
          return (
            <G
              key={`n${i}`}
              onPress={
                locked
                  ? undefined
                  : () =>
                      router.push({
                        pathname: '/(student)/node',
                        params: { nodeId: String(p.node.id), title: p.node.title },
                      } as unknown as Href)
              }
              opacity={locked ? 0.5 : 1}
            >
              {st === 'IN_PROGRESS' ? (
                <Circle cx={p.x} cy={p.y} r={NODE_R + 6} fill={c.accent} opacity={0.18} />
              ) : null}
              {st === 'COMPLETED' ? (
                <>
                  <Circle cx={p.x} cy={p.y} r={NODE_R} fill="url(#ripe)" stroke="#C2611A" strokeWidth={1.5} />
                  <Circle cx={p.x + 13} cy={p.y + 13} r={9} fill={c.success} stroke="#fff" strokeWidth={1.5} />
                  <SvgText x={p.x + 13} y={p.y + 16.5} textAnchor="middle" fontSize={11} fill="#fff">
                    ✓
                  </SvgText>
                </>
              ) : st === 'IN_PROGRESS' ? (
                <Circle cx={p.x} cy={p.y} r={NODE_R} fill={c.accent} stroke="#E0A800" strokeWidth={1.5} />
              ) : st === 'AVAILABLE' ? (
                <Circle cx={p.x} cy={p.y} r={NODE_R - 2} fill="url(#bud)" stroke="#6F9460" strokeWidth={2} />
              ) : (
                <Circle cx={p.x} cy={p.y} r={NODE_R - 4} fill="#AEBCA4" stroke="#94A589" strokeWidth={1.5} />
              )}
              <SvgText
                x={p.x}
                y={p.y + NODE_R + 16}
                textAnchor="middle"
                fontFamily={fonts.bodyMedium}
                fontSize={11}
                fill={locked ? c.textFaint : c.textSecondary}
              >
                {truncate(p.node.title)}
              </SvgText>
            </G>
          )
        })}
      </Svg>
    </View>
  )
}
