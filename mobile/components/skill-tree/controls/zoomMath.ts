// Pure pan/zoom math for the tree canvas, isolated so the spec §7 invariants
// (scale clamp, fit-to-view, focal zoom, double-tap toggle) are unit-testable
// without a device. The transform model is SVG-native: a canvas point (x,y)
// maps to viewport px (tx + s*x, ty + s*y) — i.e. `translate(tx,ty) scale(s)`
// about origin (0,0). The `'worklet'` directives let these run inside Reanimated
// gesture callbacks on the UI thread; in Jest/JS they execute as plain functions.

export const MIN_SCALE = 0.32
export const MAX_SCALE = 1.5
export const ZOOM_OUT = 0.46
export const ZOOM_IN = 1.1
export const PAN_SLOP = 5 // ignore pans shorter than this (px)

export function clampScale(s: number): number {
  'worklet'
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))
}

// New translate that keeps the focal point fixed while scaling s0 → s1.
export function focalZoom(
  tx: number,
  ty: number,
  s0: number,
  s1: number,
  focalX: number,
  focalY: number,
): { tx: number; ty: number } {
  'worklet'
  const k = s1 / s0
  return { tx: focalX - k * (focalX - tx), ty: focalY - k * (focalY - ty) }
}

// Double-tap target: zoom out if currently zoomed past the midpoint, else in.
export function toggleScale(s: number): number {
  'worklet'
  return s > (ZOOM_OUT + ZOOM_IN) / 2 ? ZOOM_OUT : ZOOM_IN
}

// Fit a canvas (cw × ch) centred in a viewport (vw × vh). Scale is clamped, so a
// very tall canvas resolves to the height-bound scale (the whole tree visible).
export function fitTransform(
  cw: number,
  ch: number,
  vw: number,
  vh: number,
  overscan = 1.0,
): { s: number; tx: number; ty: number } {
  if (cw <= 0 || ch <= 0 || vw <= 0 || vh <= 0) return { s: ZOOM_OUT, tx: 0, ty: 0 }
  const s = clampScale(Math.min(vw / cw, vh / ch) * overscan)
  return { s, tx: (vw - s * cw) / 2, ty: (vh - s * ch) / 2 }
}

// Inverse transform: viewport px → canvas coords (for tap hit-testing).
export function toCanvas(
  px: number,
  py: number,
  tx: number,
  ty: number,
  s: number,
): { x: number; y: number } {
  return { x: (px - tx) / s, y: (py - ty) / s }
}
