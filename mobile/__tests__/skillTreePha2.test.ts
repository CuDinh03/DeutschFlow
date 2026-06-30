import { nodeOffsets } from '@/components/skill-tree/nodeOffsets'
import { recommendedNodeId } from '@/components/skill-tree/layout'
import {
  clampScale,
  fitTransform,
  focalZoom,
  MAX_SCALE,
  MIN_SCALE,
  PAN_SLOP,
  toCanvas,
  toggleScale,
  ZOOM_IN,
  ZOOM_OUT,
} from '@/components/skill-tree/controls/zoomMath'
import type { SkillNode } from '@/lib/skillTreeApi'

function node(id: number, cefr: string, status: SkillNode['status'], day = id): SkillNode {
  return { id, title: `N${id}`, cefrLevel: cefr, status, dayNumber: day, tags: [] }
}

describe('nodeOffsets — N-node fan, no collapse (C2)', () => {
  test('degenerate sizes', () => {
    expect(nodeOffsets(0)).toEqual([])
    expect(nodeOffsets(1)).toEqual([[0, 4]])
  })

  test('symmetric about x=0', () => {
    const o = nodeOffsets(5)
    expect(o[0][0]).toBe(-o[4][0])
    expect(o[1][0]).toBe(-o[3][0])
    expect(o[2][0]).toBe(0)
  })

  test('no two fruit collapse to the same point for N≥5 (the old bug)', () => {
    for (const n of [5, 7, 9]) {
      const o = nodeOffsets(n)
      for (let i = 0; i < o.length; i++) {
        for (let j = i + 1; j < o.length; j++) {
          const d = Math.hypot(o[i][0] - o[j][0], o[i][1] - o[j][1])
          expect(d).toBeGreaterThanOrEqual(30)
        }
      }
    }
  })
})

describe('zoomMath — scale clamp + double-tap toggle (§7)', () => {
  test('clampScale bounds to [0.32, 1.5]', () => {
    expect(clampScale(0.1)).toBe(MIN_SCALE)
    expect(clampScale(9)).toBe(MAX_SCALE)
    expect(clampScale(0.8)).toBe(0.8)
  })

  test('double-tap toggles 0.46 ↔ 1.1', () => {
    expect(toggleScale(ZOOM_OUT)).toBe(ZOOM_IN)
    expect(toggleScale(ZOOM_IN)).toBe(ZOOM_OUT)
    expect(toggleScale(0.3)).toBe(ZOOM_IN) // zoomed out → zoom in
    expect(toggleScale(1.4)).toBe(ZOOM_OUT) // zoomed in → zoom out
  })

  test('PAN_SLOP is the 5px threshold', () => {
    expect(PAN_SLOP).toBe(5)
  })
})

describe('zoomMath — fitTransform keeps content inside the viewport (§7 bbox ⊆ viewport)', () => {
  test('a tall canvas fits height-bound and stays within bounds', () => {
    const cw = 380
    const ch = 2000
    const vw = 380
    const vh = 700
    const { s, tx, ty } = fitTransform(cw, ch, vw, vh, 1.0)
    expect(s).toBeGreaterThanOrEqual(MIN_SCALE)
    expect(s).toBeLessThanOrEqual(MAX_SCALE)
    // content bbox = [tx, tx+s*cw] × [ty, ty+s*ch] ⊆ [0,vw] × [0,vh]
    expect(tx).toBeGreaterThanOrEqual(-0.01)
    expect(ty).toBeGreaterThanOrEqual(-0.01)
    expect(tx + s * cw).toBeLessThanOrEqual(vw + 0.01)
    expect(ty + s * ch).toBeLessThanOrEqual(vh + 0.01)
  })

  test('degenerate viewport returns a safe default', () => {
    expect(fitTransform(380, 2000, 0, 0)).toEqual({ s: ZOOM_OUT, tx: 0, ty: 0 })
  })
})

describe('zoomMath — focalZoom keeps the focal point fixed', () => {
  test('the canvas point under the focal is unchanged by the zoom', () => {
    const tx = 40
    const ty = 80
    const s0 = 0.5
    const s1 = 1.0
    const fx = 200
    const fy = 300
    const before = toCanvas(fx, fy, tx, ty, s0)
    const next = focalZoom(tx, ty, s0, s1, fx, fy)
    const after = toCanvas(fx, fy, next.tx, next.ty, s1)
    expect(after.x).toBeCloseTo(before.x, 6)
    expect(after.y).toBeCloseTo(before.y, 6)
  })
})

describe('recommendedNodeId — first AVAILABLE in CEFR/day order (H2)', () => {
  test('picks the lowest-level, earliest available node', () => {
    const nodes = [
      node(1, 'A1', 'COMPLETED'),
      node(5, 'B1', 'AVAILABLE', 5),
      node(3, 'A2', 'AVAILABLE', 3),
      node(4, 'A2', 'AVAILABLE', 4),
    ]
    expect(recommendedNodeId(nodes)).toBe(3) // A2 day3 beats A2 day4 and B1 day5
  })

  test('null when nothing is available', () => {
    expect(recommendedNodeId([node(1, 'A1', 'COMPLETED'), node(2, 'A2', 'LOCKED')])).toBeNull()
  })
})
