// paths.ts — PURE SVG path builders for the learning-tree renderer.
//
// The layout engine (computeTreeLayout) emits straight tapered segments + circle positions. To get
// the organic look of the Claude Design prototype (tree-draw.js) without touching the layout, these
// helpers turn those primitives into FILLED, gently-curved shapes:
//   • taperedLimbPath  — a filled limb (two offset curves), tapering start→end, with a soft bend
//   • trunkOutlinePath — a Catmull-Rom-smoothed, thickness-offset closed trunk outline
//   • leafPath         — an almond leaf silhouette
//   • softBlobCircles  — multi-lobe canopy foliage (circle specs) around a leaf cluster
// All functions are deterministic and free of React/DOM, so they snapshot-test directly.

import type { Pt } from '@/lib/learning-tree/core'

const round = (n: number): number => Math.round(n * 10) / 10

function unit(dx: number, dy: number): [number, number] {
  const len = Math.hypot(dx, dy) || 1
  return [dx / len, dy / len]
}

/** Catmull-Rom interpolation between p1 and p2 (p0/p3 are neighbours). */
function catmullRom(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const t2 = t * t
  const t3 = t2 * t
  return {
    x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  }
}

function toPathD(points: Pt[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${round(p.x)} ${round(p.y)}`).join(' ')
}

/**
 * A filled, tapered limb from `from` to `to`. Width lerps from `thickStart` to `thickEnd`; `bend`
 * (a small signed fraction, e.g. ±0.18) bows the limb sideways with a sine profile for an organic
 * feel. Returns a closed SVG path `d`.
 */
export function taperedLimbPath(
  from: Pt,
  to: Pt,
  thickStart: number,
  thickEnd: number,
  bend = 0,
  steps = 10,
): string {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const [ux, uy] = unit(dx, dy)
  const nx = -uy
  const ny = ux
  const top: Pt[] = []
  const bottom: Pt[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const bow = bend * len * Math.sin(t * Math.PI)
    const cx = from.x + dx * t + nx * bow
    const cy = from.y + dy * t + ny * bow
    const halfW = (thickStart + (thickEnd - thickStart) * t) / 2
    top.push({ x: cx + nx * halfW, y: cy + ny * halfW })
    bottom.push({ x: cx - nx * halfW, y: cy - ny * halfW })
  }
  return `${toPathD(top.concat(bottom.reverse()))} Z`
}

/**
 * A smooth, thickness-offset closed trunk outline through `spine` points (each carries its own
 * half-width `hw`). Spine is densified with Catmull-Rom so the trunk reads as a single organic taper.
 */
export function trunkOutlinePath(spine: Array<Pt & { hw: number }>, seg = 12): string {
  if (spine.length < 2) return ''
  const padded = [spine[0], ...spine, spine[spine.length - 1]]
  const dense: Array<Pt & { hw: number }> = []
  for (let i = 0; i < spine.length - 1; i++) {
    for (let s = 0; s < seg; s++) {
      const t = s / seg
      const q = catmullRom(padded[i], padded[i + 1], padded[i + 2], padded[i + 3], t)
      const hw = spine[i].hw + (spine[i + 1].hw - spine[i].hw) * t
      dense.push({ x: q.x, y: q.y, hw })
    }
  }
  dense.push({ ...spine[spine.length - 1] })

  const left: Pt[] = []
  const right: Pt[] = []
  for (let i = 0; i < dense.length; i++) {
    const a = dense[Math.max(0, i - 1)]
    const b = dense[Math.min(dense.length - 1, i + 1)]
    const [ux, uy] = unit(b.x - a.x, b.y - a.y)
    const nx = -uy
    const ny = ux
    left.push({ x: dense[i].x + nx * dense[i].hw, y: dense[i].y + ny * dense[i].hw })
    right.push({ x: dense[i].x - nx * dense[i].hw, y: dense[i].y - ny * dense[i].hw })
  }
  return `${toPathD(left.concat(right.reverse()))} Z`
}

/** Almond leaf silhouette of the given length/width, drawn from the origin pointing +x. */
export function leafPath(len: number, wid: number): string {
  const l = round(len)
  const w = round(wid)
  return `M0 0 C ${round(len * 0.32)} ${-w} ${round(len * 0.72)} ${round(-w * 0.82)} ${l} 0 C ${round(len * 0.72)} ${round(w * 0.82)} ${round(len * 0.32)} ${w} 0 0 Z`
}

/** A small accent leaflet (used to thicken completed clusters). */
export function leafletPath(): string {
  return leafPath(16, 7)
}

export interface BlobCircle {
  cx: number
  cy: number
  r: number
}

/**
 * Multi-lobe canopy: circle specs forming soft foliage hugging a leaf cluster centred at (cx, cy)
 * with radius `r`. `seed` (0..1) varies the lobe layout deterministically.
 */
export function softBlobCircles(cx: number, cy: number, r: number, lobes: number, seed: number): BlobCircle[] {
  const out: BlobCircle[] = []
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + seed * Math.PI * 2
    const rr = r * (0.62 + 0.3 * Math.abs(Math.sin(seed * 9 + i)))
    out.push({ cx: round(cx + Math.cos(a) * r * 0.42), cy: round(cy + Math.sin(a) * r * 0.42), r: round(rr) })
  }
  out.push({ cx: round(cx), cy: round(cy), r: round(r * 0.7) })
  return out
}
