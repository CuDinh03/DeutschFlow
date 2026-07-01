// nodeOffsets(N) — N non-overlapping [dx,dy] offsets for the lesson fruit around
// a foliage centre. The design's 4-slot lookup table collapsed every 5th node to
// [0,0] (spec C2); this is a pure, generalised fan that never overlaps for any N.
//
// Shape: a symmetric arc that bows downward at the edges (centre rides slightly
// up into the foliage) — the same center-high / sides-low silhouette as the
// design's ≤3-node case, just generalised. Unit-tested like the rest of geometry.

const MIN_GAP = 34 // centre-to-centre ≥ 2 * fruitR(15) + breathing room
const ARC_DROP = 22 // how far the fan bows downward at its edges

export function nodeOffsets(n: number): Array<[number, number]> {
  if (n <= 0) return []
  if (n === 1) return [[0, 4]] // single fruit, slightly below centre

  const span = MIN_GAP * (n - 1)
  const half = span / 2
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1) // 0..1 across the fan
    const dx = -half + t * span // even horizontal spread
    const k = 2 * t - 1 // -1..1, 0 at centre
    const dy = -2 + ARC_DROP * (k * k) // centre dy=-2, edges dy≈+20
    return [Math.round(dx), Math.round(dy)] as [number, number]
  })
}
