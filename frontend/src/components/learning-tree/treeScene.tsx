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
  Skill,
  Leaf,
  Shoot,
  SkillBranch,
  TrunkSegment,
  MilestoneNode,
} from '@/lib/learning-tree/core'
import { hashUnit } from '@/lib/learning-tree/core'
import { taperedLimbPath, trunkOutlinePath, softBlobCircles } from '@/lib/learning-tree/render/paths'
import { BARK, GROUP_COLORS, SKILL_COLORS, SKILL_LABELS, TOPIC_CHIP, branchFill, milestoneColors } from '@/lib/learning-tree/render/palette'
import { SKILL_ICONS, TOPIC_ICONS } from '@/lib/learning-tree/render/icons'
import { TreeIcon } from './TreeIcon'

/** Canonical skill order — pip slots ring the current milestone in this order. */
const CANON_SKILLS = ['hoeren', 'sprechen', 'lesen', 'schreiben'] as const

/** Decorative canopy foliage — a single soft green, deliberately NOT encoding topic. */
const FOLIAGE_GREEN = '#C3D6AC'

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
      {/* Ripe-fruit gradient (mastered node) — warm orange, state ripeness (not skill/topic). */}
      <radialGradient id="lt-ripe" cx="0.38" cy="0.32" r="0.75">
        <stop offset="0" stopColor="#F2B65A" />
        <stop offset="0.6" stopColor="#E5912F" />
        <stop offset="1" stopColor="#CE7A1E" />
      </radialGradient>
    </defs>
  )
}

export interface TreeFilter {
  topic: TopicGroup | null
  skill: Skill | null
}

interface SceneProps {
  layout: TreeLayout
  filter: TreeFilter
}

const DIM = 0.22

/** The full tree scene as a fragment of SVG elements (drawn back-to-front). */
export function LearningTreeScene({ layout, filter }: SceneProps): React.ReactElement {
  const els = layout.elements

  // Filter dimming: an element is dimmed when an active filter excludes it. Null group/skill means
  // that dimension doesn't apply (e.g. a branch has a skill but no single topic).
  const active = !!(filter.topic || filter.skill)
  const dimEl = (group: TopicGroup | null, skill: Skill | null): boolean => {
    if (!active) return false
    if (filter.topic && group !== null && group !== filter.topic) return true
    if (filter.skill && skill !== null && skill !== filter.skill) return true
    return false
  }

  const trunkSegs = els.filter((e): e is TrunkSegment => e.kind === 'trunkSegment')
  const branches = els.filter((e): e is SkillBranch => e.kind === 'skillBranch')
  const shoots = els.filter((e): e is Shoot => e.kind === 'shoot')
  const leaves = els.filter((e): e is Leaf => e.kind === 'leaf')
  const milestones = els.filter((e): e is MilestoneNode => e.kind === 'milestone')

  // Branch status per (level, skill) — feeds the current milestone's skill pips.
  const branchStateByLevelSkill = new Map<string, string>()
  branches.forEach((b) => branchStateByLevelSkill.set(`${b.level}:${b.skill}`, b.state))

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
    const cx = group.reduce((sum, l) => sum + l.pos.x, 0) / group.length
    const cy = group.reduce((sum, l) => sum + fy(l.pos.y), 0) / group.length
    const maxR = group.reduce((m, l) => Math.max(m, Math.hypot(l.pos.x - cx, fy(l.pos.y) - cy)), 0)
    const allDone = group.every((l) => leafState(l.state) === 'completed')
    canopies.push({
      key: shootId,
      circles: softBlobCircles(cx, cy, maxR + 10, allDone ? 6 : 4, hashUnit(shootId)),
      color: FOLIAGE_GREEN, // decorative foliage stays green/unencoded (topic lives only on the chip)
      op: allDone ? 0.32 : 0.22,
    })
    const sh = shootById.get(shootId)
    if (allDone && sh) flowers.push({ key: shootId, x: sh.to.x, y: fy(sh.to.y), soft: '#FBEFD0' })
  })

  // One muted topic chip per limb on the CURRENT level only (the focal level), deduped per
  // branch×topic-group so repeated topics don't stack, placed mid-branch where limbs have fanned out.
  const currentLevel = milestones.find((m) => m.isCurrentGate)?.level
  const seenChip = new Set<string>()
  const topicChips = shoots
    .filter((s) => s.level === currentLevel)
    .map((s) => ({ s, g: groupFromSlot(s.colorSlot) ?? ('daily' as TopicGroup) }))
    .filter(({ s, g }) => {
      const key = `${s.skill}:${g}`
      if (seenChip.has(key)) return false
      seenChip.add(key)
      return true
    })
    .map(({ s, g }) => {
      const from = fp(s.from)
      const to = fp(s.to)
      const t = 0.5
      return { id: s.id, x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, group: g }
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
            <g key={b.id} opacity={dimEl(null, b.skill) ? DIM : 1}>
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
              opacity={dimEl(g, s.skill) ? DIM : 1}
            />
          )
        })}
      </g>

      {/* Leaves (interactive) */}
      <g>
        {leaves.map((lf) => (
          <LeafGlyph key={lf.id} leaf={lf} dimmed={dimEl(groupFromSlot(lf.colorSlot), lf.skill)} />
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

      {/* Topic chips — one muted chip per limb (icon + name) at the limb base; never per leaf */}
      <g>
        {topicChips.map((c) => (
          <TopicChip key={c.id} x={c.x} y={c.y} group={c.group} dimmed={dimEl(c.group, null)} />
        ))}
      </g>

      {/* Milestones (on top) */}
      <g>
        {milestones.map((m) => {
          const pips = m.isCurrentGate
            ? CANON_SKILLS.map((sk) => branchStateByLevelSkill.get(`${m.level}:${sk}`) ?? 'branch:locked')
            : null
          return <MilestoneGlyph key={m.id} ms={m} pips={pips} />
        })}
      </g>
    </>
  )
}

function LeafGlyph({ leaf, dimmed }: { leaf: Leaf; dimmed?: boolean }): React.ReactElement {
  const g = groupFromSlot(leaf.colorSlot) ?? 'daily'
  const state = leafState(leaf.state)
  const transform = `translate(${leaf.pos.x.toFixed(1)} ${fy(leaf.pos.y).toFixed(1)})`
  const interactive = state !== 'locked'

  // State = motif + its NATURAL ripeness colour (skill stays the badge, never dyes the body):
  // locked = closed bud · available = bloom + glow · in_progress = green fruit · mastered = ripe fruit.
  let glyph: React.ReactElement
  if (state === 'completed') {
    glyph = (
      <g transform="translate(0 -2)">
        <circle r={8} fill="url(#lt-ripe)" stroke="#B5701C" strokeWidth={0.8} />
        <ellipse cx={-2.6} cy={-3} rx={2.2} ry={1.3} fill="#FFFFFF" opacity={0.45} />
        <path d="M0 -8 q 1.6 -3 3.6 -3.2" stroke="#6E5A45" strokeWidth={1} fill="none" strokeLinecap="round" />
        <g transform="translate(7 -7)">
          <circle r={4} fill="#1E9E61" stroke="#FBFAF7" strokeWidth={0.8} />
          <path d="M-1.8 0 L-0.5 1.4 L2 -1.7" stroke="#FFFFFF" strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
    )
  } else if (state === 'in_progress') {
    glyph = (
      <g transform="translate(0 -2)">
        <circle r={7.5} fill="#7FA86A" stroke="#4E7E3C" strokeWidth={0.8} />
        <ellipse cx={-2.4} cy={-2.8} rx={1.9} ry={1.1} fill="#FFFFFF" opacity={0.4} />
        <path d="M0 -7.5 q 1.6 -3 3.6 -3.2" stroke="#4E7E3C" strokeWidth={1} fill="none" strokeLinecap="round" />
      </g>
    )
  } else if (state === 'available') {
    // The glowing bloom — the tap point.
    glyph = (
      <g>
        <circle className="lt-breathe" cx={0} cy={-3} r={16} fill="#FFCD00" opacity={0.5} filter="url(#lt-glow)" />
        <g transform="translate(0 -3)">
          {[0, 1, 2, 3, 4].map((i) => (
            <ellipse key={i} cx={0} cy={-5} rx={3.2} ry={5} fill="#FBEFD0" stroke="#E6C766" strokeWidth={0.7} transform={`rotate(${i * 72})`} />
          ))}
          <circle r={3} fill="#FFCD00" stroke="#B8911C" strokeWidth={0.8} />
        </g>
      </g>
    )
  } else {
    // locked = closed bud
    glyph = <path d="M0 1 C -3 -4 -3 -10 0 -12 C 3 -10 3 -4 0 1 Z" fill="#AEB49C" stroke="#868C72" strokeWidth={0.8} />
  }

  return (
    <g
      className={interactive ? 'lt-node' : undefined}
      transform={transform}
      opacity={dimmed ? DIM : state === 'locked' ? 0.55 : 1}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? `${GROUP_COLORS[g].name} · ${SKILL_LABELS[leaf.skill]} · ${leaf.title}` : undefined}
      data-node-id={leaf.nodeId}
      data-state={state}
      data-group={g}
      data-skill={leaf.skill}
      data-title={leaf.title}
    >
      {glyph}
      {/* Skill = a small upright badge at the node base, identical across every state (the colour is
          the only skill signal; the motif/body colour stays the state's, never dyed by skill). */}
      <SkillBadge skill={leaf.skill} dim={state === 'locked'} />
    </g>
  )
}

/** Small skill identifier pinned at a node's base — skill colour + white icon, constant per state. */
function SkillBadge({ skill, dim }: { skill: Skill; dim?: boolean }): React.ReactElement {
  return (
    <g transform="translate(0 9)" opacity={dim ? 0.55 : 1}>
      <circle r={6.5} fill={SKILL_COLORS[skill]} stroke="#FBFAF7" strokeWidth={1} />
      <TreeIcon paths={SKILL_ICONS[skill]} size={9} color="#FFFFFF" strokeWidth={2.6} x={-4.5} y={-4.5} />
    </g>
  )
}

/** Muted topic chip — one per limb (icon + Vietnamese topic name), warm-neutral so topic ≠ skill. */
function TopicChip({
  x,
  y,
  group,
  dimmed,
}: {
  x: number
  y: number
  group: TopicGroup
  dimmed?: boolean
}): React.ReactElement {
  const name = GROUP_COLORS[group].name
  const w = name.length * 6.2 + 26
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} opacity={dimmed ? DIM : 1}>
      <rect x={-w / 2} y={-9} width={w} height={18} rx={9} fill={TOPIC_CHIP.bg} stroke={TOPIC_CHIP.border} strokeWidth={1} />
      <TreeIcon paths={TOPIC_ICONS[group]} size={11} color={TOPIC_CHIP.icon} strokeWidth={2} x={-w / 2 + 6} y={-5.5} />
      <text x={-w / 2 + 20} y={3.4} fontSize={10} fontWeight={600} fill={TOPIC_CHIP.text}>
        {name}
      </text>
    </g>
  )
}

/** Pip colour by branch status (matured → green, growing → amber, locked → grey). */
function pipColor(branchState: string): string {
  if (branchState === 'branch:matured') return '#1E9E61'
  if (branchState === 'branch:growing') return '#E0A23A'
  return '#C9C2B6'
}

function MilestoneGlyph({ ms, pips }: { ms: MilestoneNode; pips: string[] | null }): React.ReactElement {
  const c = milestoneColors(ms.effectiveState)
  // The current level's gate is the focal point: bigger, brighter, always pulsing.
  const focal = ms.isCurrentGate
  const r = focal ? ms.r * 1.3 : ms.r
  return (
    <g transform={`translate(${ms.pos.x.toFixed(1)} ${fy(ms.pos.y).toFixed(1)})`}>
      {(c.glow || focal) && (
        <circle
          className={ms.effectiveState === 'ready' || focal ? 'lt-pulse' : undefined}
          r={r + (focal ? 20 : 14)}
          fill={c.glow ?? '#FFCD00'}
          opacity={focal ? 0.24 : 0.16}
        />
      )}
      <circle
        r={r}
        fill={c.ringFill}
        stroke={c.ringStroke}
        strokeWidth={focal ? 3.4 : 2.8}
        strokeDasharray={c.dashed ? '3.5 3.5' : undefined}
        filter="url(#lt-ms-shadow)"
      />
      <circle r={r - 5} fill="none" stroke={c.ringStroke} strokeWidth={1} opacity={0.55} />
      <text
        x={0}
        y={r * 0.36}
        textAnchor="middle"
        style={{ fontFamily: 'var(--ga-display)' }}
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
      {pips?.map((st, i) => {
        const ang = ((-128 + i * (256 / 3)) * Math.PI) / 180
        return (
          <circle
            key={i}
            cx={(r + 9) * Math.cos(ang)}
            cy={(r + 9) * Math.sin(ang)}
            r={3.4}
            fill={pipColor(st)}
            stroke="#FBFAF7"
            strokeWidth={1.2}
          />
        )
      })}
    </g>
  )
}
