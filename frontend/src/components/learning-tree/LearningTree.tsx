'use client'

// LearningTree — interactive SVG canvas: pan, wheel-zoom, fit-to-view, and tap-a-leaf.
// Layout comes from the untouched engine (computeTreeLayout); the scene is React-rendered inside an
// imperatively-transformed camera <g>, so panning never re-renders React and the tree can "grow"
// (re-render scene) while the camera stays put. Camera/gesture logic ported from the prototype.

import * as React from 'react'
import { computeTreeLayout } from '@/lib/learning-tree/core'
import type { TreeParams, Skill, TopicGroup } from '@/lib/learning-tree/core'
import { GROUP_COLORS, SKILL_LABELS } from '@/lib/learning-tree/render/palette'
import type { TreeResponse } from '@/lib/learning-tree/treeApi'
import { LearningTreeDefs, LearningTreeScene } from './treeScene'

/**
 * Galerie web tuning of the (shared) layout engine — passed via its public `params` arg, so the
 * engine + its snapshot tests stay untouched. Wider fan + longer branches/shoots make the tree fan
 * sideways and fill the wide canvas instead of stacking thin and vertical.
 */
const GALERIE_TREE_PARAMS: Partial<TreeParams> = {
  gmin: 36,
  gmax: 84, // near-horizontal outer branches → wide canopy that fills the landscape canvas
  upwardBias: 0.4, // keep upper levels wide (don't taper the crown inward)
  balancePullMax: 5,
  seedSegH: 46,
  trunkSegBase: 64, // shorter trunk → squatter tree, less portrait
  branchBaseLen: 132,
  branchPerNode: 14,
  branchMaxLen: 290,
  shootBaseLen: 58,
  shootPerCompleted: 13,
  shootMaxLen: 210,
  leafPerpOffset: 4,
}

export interface TappedNode {
  nodeId: string
  group: string
  state: string
}

/** A node being hovered/peeked — drives the tooltip. x/y are the node-top, relative to the wrapper. */
export interface HoveredNode {
  nodeId: string
  group: string
  skill: string
  title: string
  state: string
  x: number
  y: number
}

interface LearningTreeProps {
  tree: TreeResponse
  onTapNode: (node: TappedNode) => void
}

interface CamState {
  scale: number
  tx: number
  ty: number
  bbox: { minX: number; minY: number; width: number; height: number } | null
}

const PAD = 18

export function LearningTree({ tree, onTapNode }: LearningTreeProps): React.ReactElement {
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const camRef = React.useRef<SVGGElement>(null)
  const cam = React.useRef<CamState>({ scale: 1, tx: 0, ty: 0, bbox: null })
  const tapRef = React.useRef(onTapNode)
  tapRef.current = onTapNode
  // Tooltip state lives here (LearningTree owns the wrapper + node coords).
  const [hovered, setHovered] = React.useState<HoveredNode | null>(null)
  const hoverRef = React.useRef<(n: HoveredNode | null) => void>(() => {})
  hoverRef.current = setHovered
  // True once the user pans/zooms — suppresses auto-recenter so we don't fight their navigation.
  const touched = React.useRef(false)
  const recenterRef = React.useRef<(dur: number) => void>(() => {})

  const layout = React.useMemo(() => computeTreeLayout(tree.path, GALERIE_TREE_PARAMS), [tree])
  // The scene negates y (tree grows up), so the camera fits the y-flipped bbox.
  const b = layout.bbox
  cam.current.bbox = { minX: b.minX, minY: -(b.minY + b.height), width: b.width, height: b.height }

  const applyCam = React.useCallback(() => {
    const c = camRef.current
    const s = cam.current
    if (c) c.setAttribute('transform', `translate(${s.tx.toFixed(2)} ${s.ty.toFixed(2)}) scale(${s.scale.toFixed(4)})`)
  }, [])

  React.useEffect(() => {
    const svg = svgRef.current
    const wrap = wrapRef.current
    if (!svg || !wrap) return
    const s = cam.current
    let camAF = 0

    const animateCam = (ns: number, ntx: number, nty: number, dur: number) => {
      cancelAnimationFrame(camAF)
      const s0 = s.scale
      const x0 = s.tx
      const y0 = s.ty
      const t0 = performance.now()
      const step = (t: number) => {
        const k = dur <= 0 ? 1 : Math.min(1, (t - t0) / dur)
        const e = 1 - Math.pow(1 - k, 3)
        s.scale = s0 + (ns - s0) * e
        s.tx = x0 + (ntx - x0) * e
        s.ty = y0 + (nty - y0) * e
        applyCam()
        if (k < 1) camAF = requestAnimationFrame(step)
      }
      camAF = requestAnimationFrame(step)
    }

    // Fit the bbox into the wrapper. Not gated on a one-time flag, so it recovers if the wrapper
    // measured 0 at mount (flex/tab layout) and re-centers on resize / tree-growth until the user pans.
    const recenter = (dur: number) => {
      const r = wrap.getBoundingClientRect()
      const b = s.bbox
      if (!b || !r.width || !r.height) return
      const ns = Math.max(0.08, Math.min((r.width - PAD * 2) / b.width, (r.height - PAD * 2) / b.height))
      animateCam(ns, r.width / 2 - (b.minX + b.width / 2) * ns, r.height / 2 - (b.minY + b.height / 2) * ns, dur)
    }
    recenterRef.current = recenter
    ;(svg as SVGSVGElement & { __fit?: () => void }).__fit = () => {
      touched.current = false
      recenter(420)
    }

    const raf = requestAnimationFrame(() => recenter(0))

    let drag = false
    let lx = 0
    let ly = 0
    let moved = 0
    let downNode: Element | null = null

    const onDown = (e: PointerEvent) => {
      touched.current = true
      downNode = e.target instanceof Element ? e.target.closest('.lt-node') : null
      try {
        svg.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      drag = true
      lx = e.clientX
      ly = e.clientY
      moved = 0
      svg.style.cursor = 'grabbing'
    }
    const onMove = (e: PointerEvent) => {
      if (!drag) return
      const dx = e.clientX - lx
      const dy = e.clientY - ly
      moved += Math.abs(dx) + Math.abs(dy)
      if (moved > 6) hoverRef.current?.(null) // panning → drop the tooltip
      s.tx += dx
      s.ty += dy
      lx = e.clientX
      ly = e.clientY
      applyCam()
    }
    const onUp = (e: PointerEvent) => {
      if (drag) {
        drag = false
        svg.style.cursor = 'grab'
      }
      if (moved < 6) {
        let target = downNode
        if (!target) {
          const el = document.elementFromPoint(e.clientX, e.clientY)
          target = el ? el.closest('.lt-node') : null
        }
        if (target instanceof HTMLElement || target instanceof SVGElement) {
          const nodeId = target.getAttribute('data-node-id')
          if (nodeId) {
            hoverRef.current?.(null)
            tapRef.current({
              nodeId,
              group: target.getAttribute('data-group') ?? 'daily',
              state: target.getAttribute('data-state') ?? 'available',
            })
          }
        }
      }
      downNode = null
    }
    // Tooltip: show on pointer-over OR keyboard-focus of a node (hover desktop, touch-over mobile,
    // Tab keyboard); hide on leave/blur.
    const onOver = (e: Event) => {
      const node = e.target instanceof Element ? e.target.closest('.lt-node') : null
      if (!node) return
      const wr = wrap.getBoundingClientRect()
      const nr = node.getBoundingClientRect()
      setHovered({
        nodeId: node.getAttribute('data-node-id') ?? '',
        group: node.getAttribute('data-group') ?? 'daily',
        skill: node.getAttribute('data-skill') ?? '',
        title: node.getAttribute('data-title') ?? '',
        state: node.getAttribute('data-state') ?? 'available',
        x: nr.left + nr.width / 2 - wr.left,
        y: nr.top - wr.top,
      })
    }
    const onOut = (e: Event) => {
      const node = e.target instanceof Element ? e.target.closest('.lt-node') : null
      const to = (e as PointerEvent | FocusEvent).relatedTarget
      if (node && (!(to instanceof Node) || !node.contains(to))) setHovered(null)
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      hoverRef.current?.(null)
      touched.current = true
      const r = wrap.getBoundingClientRect()
      const px = e.clientX - r.left
      const py = e.clientY - r.top
      const wx = (px - s.tx) / s.scale
      const wy = (py - s.ty) / s.scale
      s.scale = Math.max(0.08, Math.min(4, s.scale * (e.deltaY < 0 ? 1.12 : 0.89)))
      s.tx = px - wx * s.scale
      s.ty = py - wy * s.scale
      applyCam()
    }

    svg.addEventListener('pointerdown', onDown)
    svg.addEventListener('pointermove', onMove)
    svg.addEventListener('pointerup', onUp)
    svg.addEventListener('pointercancel', onUp)
    svg.addEventListener('pointerover', onOver)
    svg.addEventListener('pointerout', onOut)
    svg.addEventListener('focusin', onOver)
    svg.addEventListener('focusout', onOut)
    svg.addEventListener('wheel', onWheel, { passive: false })

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (!touched.current) recenter(0)
      })
      ro.observe(wrap)
    }

    return () => {
      cancelAnimationFrame(camAF)
      cancelAnimationFrame(raf)
      if (ro) ro.disconnect()
      svg.removeEventListener('pointerdown', onDown)
      svg.removeEventListener('pointermove', onMove)
      svg.removeEventListener('pointerup', onUp)
      svg.removeEventListener('pointercancel', onUp)
      svg.removeEventListener('pointerover', onOver)
      svg.removeEventListener('pointerout', onOut)
      svg.removeEventListener('focusin', onOver)
      svg.removeEventListener('focusout', onOut)
      svg.removeEventListener('wheel', onWheel)
    }
  }, [applyCam])

  // Re-center when the tree changes (e.g. a node completes and it grows), unless the user has panned.
  React.useEffect(() => {
    if (!touched.current) recenterRef.current(0)
  }, [layout])

  return (
    <div
      ref={wrapRef}
      className="relative min-h-0 flex-1 overflow-hidden"
      style={{
        // Soft vignette — light around the crown, gently darker pastel at the edges so foliage pops.
        background: 'radial-gradient(105% 78% at 50% 40%, #FCFBF8 0%, #F1ECE1 58%, #E6DFD1 100%)',
      }}
    >
      <svg
        ref={svgRef}
        className="block h-full w-full"
        style={{ cursor: 'grab', touchAction: 'none', fontFamily: 'var(--ga-vn)' }}
      >
        <LearningTreeDefs />
        <g ref={camRef}>
          <LearningTreeScene layout={layout} />
        </g>
      </svg>
      <button
        type="button"
        onClick={() => {
          const el = svgRef.current as (SVGSVGElement & { __fit?: () => void }) | null
          el?.__fit?.()
        }}
        className="ga-ui absolute right-4 top-4 z-10 rounded-ga-pill border border-ga-line bg-ga-card px-3.5 py-2 text-[12.5px] font-semibold text-ga-ink shadow-sm"
      >
        ⤢ Toàn cảnh
      </button>
      <div className="ga-ui pointer-events-none absolute left-4 top-4 rounded-ga-pill bg-ga-card/80 px-3 py-1.5 text-[12px] text-ga-muted">
        Chạm vào lá đang sáng để học
      </div>
      {hovered && <NodeTooltip node={hovered} wrapWidth={wrapRef.current?.clientWidth ?? 0} />}
    </div>
  )
}

/** Tooltip "Topic · Skill · title" above a node; flips below near the top edge, clamps horizontally. */
function NodeTooltip({ node, wrapWidth }: { node: HoveredNode; wrapWidth: number }): React.ReactElement {
  const topic = GROUP_COLORS[node.group as TopicGroup]?.name ?? node.group
  const skill = SKILL_LABELS[node.skill as Skill] ?? node.skill
  const flipBelow = node.y < 52
  const left = wrapWidth ? Math.min(Math.max(node.x, 76), wrapWidth - 76) : node.x
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-30 max-w-[220px] truncate rounded-ga bg-ga-ink px-2.5 py-1.5 text-[11.5px] font-medium text-ga-bg shadow-md"
      style={{
        left,
        top: flipBelow ? node.y + 20 : node.y - 8,
        transform: flipBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
        fontFamily: 'var(--ga-vn)',
      }}
    >
      {topic} · {skill} · {node.title}
    </div>
  )
}
