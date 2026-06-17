// treeScene.tsx — presentational SVG for the learning tree.
//
// Consumes a TreeLayout from the (untouched) layout engine and draws it with the prototype's
// organic look via the pure path helpers: filled tapered limbs, almond leaves, multi-lobe canopies,
// flowers, and glow defs. No hooks, no state — the interactive wrapper (LearningTree) supplies the
// camera and tap handling.
//
// The engine grows +y downward (origin at the start of the journey); the tree metaphor grows UP, so
// every y read here is negated (`fy`). Glyphs are still drawn upright (text/leaves never flip), and
// the camera uses the matching y-flipped bbox. The engine output itself is never mutated.

import * as React from 'react'
import type {
  TreeLayout,
  TopicGroup,
  Leaf,
  Shoot,
  SkillBranch,
  TrunkSegment,
  MilestoneNode,
} from '@/lib/learning-tree/core'
import { hashUnit } from '@/lib/learning-tree/core'
import { taperedLimbPath, trunkOutlinePath, leafPath, softBlobCircles } from '@/lib/learning-tree/render/paths'
import { BARK, GROUP_COLORS, SKILL_COLORS, SKILL_LABELS, branchFill, milestoneColors } from '@/lib/learning-tree/render/palette'

/** Flip the engine's downward y so the tree grows up the screen. */
const fy = (y: number) => -y
const fp = (p: { x: number; y: number }) => ({ x: p.x, y: -p.y })

function groupFromSlot(colorSlot: string): TopicGroup | null {
  if (colorSlot.startsWith('group:')) return colorSlot.slice('group:'.length) as TopicGroup
  return null
}

/** Parse a `leaf:<state>` token → bare node state. */
function leafState(token: string): string {
  return token.startsWith('leaf:') ? token.slice('leaf:'.length) : token
}

/** Shared SVG defs: bark gradient, drop shadows, and the glow filter for active elements. */
export function LearningTreeDefs(): React.ReactElement {
  return (
    <defs>
      <linearGradient id="lt-bark" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={BARK.dark} />
        <stop offset="0.5" stopColor={BARK.mid} />
        <stop offset="1" stopColor={BARK.light} />
      </linearGradient>
      <filter id="lt-soft" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#2A2114" floodOpacity="0.1" />
      </filter>
      <filter id="lt-ms-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#2A2114" floodOpacity="0.22" />
      </filter>
      <filter id="lt-glow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="4" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  )
}

interface SceneProps {
  layout: TreeLayout
}

/** The full tree scene as a fragment of SVG elements (drawn back-to-front). */
export function LearningTreeScene({ layout }: SceneProps): React.ReactElement {
  const els = layout.elements

  const trunkSegs = els.filter((e): e is TrunkSegment => e.kind === 'trunkSegment')
  const branches = els.filter((e): e is SkillBranch => e.kind === 'skillBranch')
  const shoots = els.filter((e): e is Shoot => e.kind === 'shoot')
  const leaves = els.filter((e): e is Leaf => e.kind === 'leaf')
  const milestones = els.filter((e): e is MilestoneNode => e.kind === 'milestone')

  // ── Trunk: chain segment endpoints into a single smoothed, thickness-offset outline ──
  const trunkD = React.useMemo(() => {
    if (trunkSegs.length === 0) return ''
    const ordered = [...trunkSegs].sort((a, b) => a.from.y - b.from.y) // start → tip
    const spine: Array<{ x: number; y: number; hw: number }> = []
    ordered.forEach((seg, i) => {
      if (i === 0) spine.push({ x: seg.from.x, y: fy(seg.from.y), hw: seg.thickStart / 2 })
      spine.push({ x: seg.to.x, y: fy(seg.to.y), hw: seg.thickEnd / 2 })
    })
    return trunkOutlinePath(spine)
  }, [trunkSegs])

  // ── Canopies + flowers: derived from leaf clusters per shoot (engine stays decoration-free) ──
  const shootById = new Map<string, Shoot>(shoots.map((s) => [s.id, s]))
  const leavesByShoot = new Map<string, Leaf[]>()
  for (const lf of leaves) {
    const arr = leavesByShoot.get(lf.shootId) ?? []
    arr.push(lf)
    leavesByShoot.set(lf.shootId, arr)
  }

  const canopies: Array<{ key: string; circles: ReturnType<typeof softBlobCircles>; color: string; op: number }> = []
  const flowers: Array<{ key: string; x: number; y: number; soft: string }> = []
  Array.from(leavesByShoot.entries()).forEach(([shootId, group]: [string, Leaf[]]) => {
    if (group.length < 2) return
    const g = groupFromSlot(group[0].colorSlot) ?? 'daily'
    const gc = GROUP_COLORS[g]
    const cx = group.reduce((sum, l) => sum + l.pos.x, 0) / group.length
    const cy = group.reduce((sum, l) => sum + fy(l.pos.y), 0) / group.length
    const maxR = group.reduce((m, l) => Math.max(m, Math.hypot(l.pos.x - cx, fy(l.pos.y) - cy)), 0)
    const allDone = group.every((l) => leafState(l.state) === 'completed')
    canopies.push({
      key: shootId,
      circles: softBlobCircles(cx, cy, maxR + 16, allDone ? 6 : 4, hashUnit(shootId)),
      color: gc.soft,
      op: allDone ? 0.42 : 0.28,
    })
    const sh = shootById.get(shootId)
    if (allDone && sh) flowers.push({ key: shootId, x: sh.to.x, y: fy(sh.to.y), soft: gc.soft })
  })

  return (
    <>
      {/* Ground + roots (origin is the base of the trunk, below the start level) */}
      <g>
        <ellipse cx={0} cy={18} rx={92} ry={25} fill="#E7DFCF" />
        <ellipse cx={0} cy={14} rx={66} ry={16} fill="#D8CDB7" />
        <path
          d="M-6 6 q -22 22 -40 30 M6 6 q 22 22 42 28 M0 8 q -2 26 -4 36"
          stroke="#A89C82"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          opacity={0.7}
        />
      </g>

      {/* Trunk */}
      {trunkD && <path d={trunkD} fill="url(#lt-bark)" stroke={BARK.dark} strokeWidth={1.2} filter="url(#lt-soft)" />}

      {/* Branches (filled tapered limbs) */}
      <g>
        {branches.map((b) => {
          const bend = (hashUnit(b.id) * 2 - 1) * 0.16
          const fill = branchFill(b.skill)
          const matured = b.state === 'branch:matured'
          const from = fp(b.from)
          const to = fp(b.to)
          return (
            <g key={b.id}>
              <path d={taperedLimbPath(from, to, b.thickStart, b.thickEnd, bend)} fill={fill} stroke={BARK.dark} strokeWidth={0.8} />
              <circle cx={from.x} cy={from.y} r={3.4} fill={SKILL_COLORS[b.skill]} stroke="#FBFAF7" strokeWidth={1} />
              {matured && (
                <g>
                  <circle cx={to.x} cy={to.y} r={4.6} fill="#FBFAF7" stroke={SKILL_COLORS[b.skill]} strokeWidth={1.6} />
                  <circle cx={to.x} cy={to.y} r={1.8} fill={SKILL_COLORS[b.skill]} />
                </g>
              )}
            </g>
          )
        })}
      </g>

      {/* Canopies (behind leaves) */}
      <g>
        {canopies.map((c) => (
          <g key={c.key} opacity={c.op}>
            {c.circles.map((circ, i) => (
              <circle key={i} cx={circ.cx} cy={circ.cy} r={circ.r} fill={c.color} />
            ))}
          </g>
        ))}
      </g>

      {/* Shoots (thin tapered stems) */}
      <g>
        {shoots.map((s) => {
          const g = groupFromSlot(s.colorSlot) ?? 'daily'
          const bend = (hashUnit(s.id) * 2 - 1) * 0.12
          return (
            <path
              key={s.id}
              d={taperedLimbPath(fp(s.from), fp(s.to), s.thickStart, s.thickEnd, bend)}
              fill={GROUP_COLORS[g].dark}
              stroke={BARK.dark}
              strokeWidth={0.5}
            />
          )
        })}
      </g>

      {/* Leaves (interactive) */}
      <g>
        {leaves.map((lf) => (
          <LeafGlyph key={lf.id} leaf={lf} />
        ))}
      </g>

      {/* Flowers (matured shoots) */}
      <g>
        {flowers.map((f) => (
          <g key={f.key} transform={`translate(${f.x.toFixed(1)} ${f.y.toFixed(1)})`}>
            {[0, 1, 2, 3, 4].map((i) => (
              <ellipse
                key={i}
                cx={0}
                cy={-6.5}
                rx={4.2}
                ry={6.5}
                fill={f.soft}
                stroke="#B8911C"
                strokeWidth={0.8}
                transform={`rotate(${i * 72})`}
              />
            ))}
            <circle cx={0} cy={0} r={3.6} fill="#FFCD00" stroke="#B8911C" strokeWidth={0.9} />
          </g>
        ))}
      </g>

      {/* Milestones (on top) */}
      <g>
        {milestones.map((m) => (
          <MilestoneGlyph key={m.id} ms={m} />
        ))}
      </g>
    </>
  )
}

function LeafGlyph({ leaf }: { leaf: Leaf }): React.ReactElement {
  const g = groupFromSlot(leaf.colorSlot) ?? 'daily'
  const gc = GROUP_COLORS[g]
  const state = leafState(leaf.state)
  const transform = `translate(${leaf.pos.x.toFixed(1)} ${fy(leaf.pos.y).toFixed(1)})`
  const interactive = state !== 'locked'

  let glyph: React.ReactElement
  if (state === 'completed') {
    glyph = (
      <>
        <path d={leafPath(21, 9.5)} fill={gc.leaf} stroke={gc.dark} strokeWidth={1} />
        <path d="M0 0 L 20 0" stroke={gc.dark} strokeWidth={0.9} opacity={0.5} fill="none" />
      </>
    )
  } else if (state === 'in_progress') {
    glyph = (
      <>
        <circle className="lt-breathe" cx={6} cy={0} r={15} fill={gc.leaf} opacity={0.5} filter="url(#lt-glow)" />
        <path d={leafPath(17, 8)} fill={gc.soft} stroke={gc.dark} strokeWidth={1} />
        <circle cx={17} cy={0} r={2.6} fill="#FFCD00" stroke={gc.dark} strokeWidth={0.8} />
      </>
    )
  } else if (state === 'available') {
    glyph = (
      <>
        <circle className="lt-breathe" cx={6} cy={0} r={14} fill={gc.leaf} opacity={0.45} filter="url(#lt-glow)" />
        <path d="M0 0 C 7 -4.5 13 -3 14 0 C 13 3 7 4.5 0 0 Z" fill={gc.soft} stroke={gc.dark} strokeWidth={1} opacity={0.95} />
      </>
    )
  } else {
    glyph = <circle cx={0} cy={0} r={4} fill="#CFC8BC" stroke="#B0A795" strokeWidth={1} />
  }

  return (
    <g
      className={interactive ? 'lt-node' : undefined}
      transform={transform}
      tabIndex={interactive ? 0 : undefined}
      data-node-id={leaf.nodeId}
      data-state={state}
      data-group={g}
    >
      <g transform={`rotate(${leaf.orderIndex % 2 ? 36 : -36})`}>{glyph}</g>
    </g>
  )
}

function MilestoneGlyph({ ms }: { ms: MilestoneNode }): React.ReactElement {
  const c = milestoneColors(ms.effectiveState)
  const r = ms.r
  return (
    <g transform={`translate(${ms.pos.x.toFixed(1)} ${fy(ms.pos.y).toFixed(1)})`}>
      {c.glow && (
        <circle className={ms.effectiveState === 'ready' ? 'lt-pulse' : undefined} r={r + 14} fill={c.glow} opacity={0.16} />
      )}
      <circle
        r={r}
        fill={c.ringFill}
        stroke={c.ringStroke}
        strokeWidth={2.8}
        strokeDasharray={c.dashed ? '3.5 3.5' : undefined}
        filter="url(#lt-ms-shadow)"
      />
      <circle r={r - 5} fill="none" stroke={c.ringStroke} strokeWidth={1} opacity={0.55} />
      <text
        x={0}
        y={r * 0.36}
        textAnchor="middle"
        fontFamily="'Newsreader', Georgia, serif"
        fontSize={r * 0.98}
        fontWeight={600}
        fill={c.text}
      >
        {ms.level}
      </text>
      {ms.effectiveState === 'passed' && (
        <g transform={`translate(${(r * 0.62).toFixed(1)} ${(-r * 0.62).toFixed(1)})`}>
          <circle r={6} fill="#161513" />
          <path d="M-2.6 0 L-0.7 2 L2.8 -2.4" stroke="#FFCD00" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </g>
  )
}

/** Skill colour legend rows for the page chrome. */
export const SKILL_LEGEND: Array<{ skill: keyof typeof SKILL_LABELS; color: string; label: string }> = (
  Object.keys(SKILL_LABELS) as Array<keyof typeof SKILL_LABELS>
).map((skill) => ({ skill, color: SKILL_COLORS[skill], label: SKILL_LABELS[skill] }))
