// useTreeGestures — pan / pinch / double-tap-zoom over the SVG tree, driven by
// Reanimated shared values so the 24-layer canvas never re-renders per frame
// (spec C4). The transform is applied to an <Animated.G> via useAnimatedProps as
// the string `translate(tx ty) scale(s)` — the form react-native-svg 15 reliably
// parses (proven by ProgressRing.tsx / SplashAnimated.tsx in this repo).
//
// Single taps are routed through a Gesture.Tap (NOT per-node <G onPress>, which is
// swallowed by the active pan/pinch detector under GestureDetector); the tap point
// is inverse-transformed to canvas coords and handed to `onTapCanvas` on the JS
// thread via runOnJS, where the host hit-tests it against the lesson positions.

import { useCallback, useEffect } from 'react'
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated'
import { Gesture } from 'react-native-gesture-handler'
import { G } from 'react-native-svg'
import {
  clampScale,
  fitTransform,
  PAN_SLOP,
  toggleScale,
  ZOOM_OUT,
} from './zoomMath'

export const AnimatedG = Animated.createAnimatedComponent(G)

interface UseTreeGesturesArgs {
  canvasW: number
  canvasH: number
  viewportW: number
  viewportH: number
  /** Called with canvas-space coords on a (non-pan, non-double) single tap. */
  onTapCanvas: (x: number, y: number) => void
}

export function useTreeGestures({
  canvasW,
  canvasH,
  viewportW,
  viewportH,
  onTapCanvas,
}: UseTreeGesturesArgs) {
  const s = useSharedValue(ZOOM_OUT)
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  // gesture-start snapshots so a gesture composes from the committed transform
  const startS = useSharedValue(ZOOM_OUT)
  const startTx = useSharedValue(0)
  const startTy = useSharedValue(0)

  const animatedProps = useAnimatedProps(() => ({
    transform: `translate(${tx.value} ${ty.value}) scale(${s.value})`,
  }))

  // Snap to fit whenever the canvas or viewport dimensions change. Writes only
  // shared values (no setState), so it can't trigger a React re-render loop.
  useEffect(() => {
    if (!viewportW || !viewportH || !canvasW || !canvasH) return
    const f = fitTransform(canvasW, canvasH, viewportW, viewportH, 1.0)
    s.value = f.s
    tx.value = f.tx
    ty.value = f.ty
    // shared values are stable refs — intentionally not in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasW, canvasH, viewportW, viewportH])

  const fitView = useCallback(() => {
    if (!viewportW || !viewportH || !canvasW || !canvasH) return
    const f = fitTransform(canvasW, canvasH, viewportW, viewportH, 1.0)
    const d = 260
    s.value = withTiming(f.s, { duration: d })
    tx.value = withTiming(f.tx, { duration: d })
    ty.value = withTiming(f.ty, { duration: d })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasW, canvasH, viewportW, viewportH])

  // Zoom about the viewport centre (used by the +/- buttons).
  const zoomAbout = useCallback(
    (factor: number) => {
      if (!viewportW || !viewportH) return
      const cx = viewportW / 2
      const cy = viewportH / 2
      const next = clampScale(s.value * factor)
      const k = next / s.value
      const d = 180
      tx.value = withTiming(cx - k * (cx - tx.value), { duration: d })
      ty.value = withTiming(cy - k * (cy - ty.value), { duration: d })
      s.value = withTiming(next, { duration: d })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [viewportW, viewportH],
  )

  const zoomIn = useCallback(() => zoomAbout(1.3), [zoomAbout])
  const zoomOut = useCallback(() => zoomAbout(1 / 1.3), [zoomAbout])

  const pan = Gesture.Pan()
    .minDistance(PAN_SLOP)
    .onStart(() => {
      startTx.value = tx.value
      startTy.value = ty.value
    })
    .onUpdate((e) => {
      tx.value = startTx.value + e.translationX
      ty.value = startTy.value + e.translationY
    })

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startS.value = s.value
      startTx.value = tx.value
      startTy.value = ty.value
    })
    .onUpdate((e) => {
      const next = clampScale(startS.value * e.scale)
      const k = next / startS.value
      tx.value = e.focalX - k * (e.focalX - startTx.value)
      ty.value = e.focalY - k * (e.focalY - startTy.value)
      s.value = next
    })

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd((e) => {
      const target = toggleScale(s.value)
      const k = target / s.value
      tx.value = withTiming(e.x - k * (e.x - tx.value), { duration: 220 })
      ty.value = withTiming(e.y - k * (e.y - ty.value), { duration: 220 })
      s.value = withTiming(target, { duration: 220 })
    })

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(250)
    .onEnd((e) => {
      const cx = (e.x - tx.value) / s.value
      const cy = (e.y - ty.value) / s.value
      runOnJS(onTapCanvas)(cx, cy)
    })

  // pan + pinch run together; double-tap pre-empts single-tap.
  const gesture = Gesture.Simultaneous(
    Gesture.Race(pan, pinch),
    Gesture.Exclusive(doubleTap, singleTap),
  )

  return { animatedProps, gesture, fitView, zoomIn, zoomOut }
}
