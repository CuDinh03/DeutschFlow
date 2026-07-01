// Branded launch splash — Galerie v2 port of na-intro.jsx `NASplash`.
// Yellow canvas → an ink logo tile whose 'D' stroke draws in (yellow), then the
// red triangle + yellow square pop, then the serif "DeutschFlow" wordmark fades
// in. A spinner + "Đang khởi động…" sits near the home indicator. Brand-locked
// (theme-independent): yellow paper, ink mark.
//
// Holds (after a minimum on-screen time) until the app is ready, then self-fades
// and unmounts — a safety cap guarantees it never traps the user on the splash.

import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { MotiView } from 'moti'
import Svg, { G, Path, Polygon, Rect } from 'react-native-svg'
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { fonts } from '@/lib/theme'

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedG = Animated.createAnimatedComponent(G)

// Brand-locked colours (na-theme NA.yellow / NA.ink / NA.red).
const YELLOW = '#FFCD00'
const INK = '#161513'
const RED = '#DA291C'

// 'D' outline in a 100×100 viewBox (matches the brand mark geometry).
const D_PATH = 'M20 18 L20 82 L52 82 L74 62 L74 38 L52 18 Z'
const PATH_LEN = 212 // perimeter ≈ stroke-draw length
const LOGO = 52
const TILE = 88

interface SplashAnimatedProps {
  /** App-readiness gate: the splash holds (after its min display time) until true. */
  ready: boolean
  onDone: () => void
}

export function SplashAnimated({ ready, onDone }: SplashAnimatedProps) {
  const draw = useSharedValue(0)
  const detail = useSharedValue(0)
  const [minElapsed, setMinElapsed] = useState(false)
  const [forced, setForced] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const outlineProps = useAnimatedProps(() => ({ strokeDashoffset: PATH_LEN * (1 - draw.value) }))
  const detailProps = useAnimatedProps(() => ({ opacity: detail.value }))

  // Sequence: draw the 'D' (delay 0.35s), then pop the red triangle + yellow
  // square (~1.1s). Enforce a 2.3s minimum, and a 6s safety cap.
  useEffect(() => {
    draw.value = withDelay(350, withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }))
    detail.value = withDelay(1150, withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) }))

    const min = setTimeout(() => setMinElapsed(true), 2300)
    const cap = setTimeout(() => setForced(true), 6000)
    return () => {
      clearTimeout(min)
      clearTimeout(cap)
    }
  }, [draw, detail])

  // Fade out once min time elapsed AND the app is ready — or the safety cap fires.
  useEffect(() => {
    if (leaving) return
    if (!((minElapsed && ready) || forced)) return
    setLeaving(true)
    const done = setTimeout(onDone, 420)
    return () => clearTimeout(done)
  }, [minElapsed, ready, forced, leaving, onDone])

  return (
    <MotiView
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.root]}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ type: 'timing', duration: 380, easing: Easing.inOut(Easing.ease) }}
    >
      {/* Logo tile + wordmark — the tile springs in, the mark draws, the word fades. */}
      <MotiView
        style={styles.center}
        from={{ opacity: 0, scale: 0.84 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'timing', duration: 520, easing: Easing.out(Easing.back(1.5)) }}
      >
        <View style={styles.tile}>
          <Svg width={LOGO} height={LOGO} viewBox="0 0 100 100">
            <AnimatedPath
              d={D_PATH}
              stroke={YELLOW}
              strokeWidth={6}
              strokeLinejoin="miter"
              fill="none"
              strokeDasharray={PATH_LEN}
              animatedProps={outlineProps}
            />
            <AnimatedG animatedProps={detailProps}>
              <Polygon points="52,38 74,50 52,62" fill={RED} />
              <Rect x={24} y={45} width={9} height={9} fill={YELLOW} />
            </AnimatedG>
          </Svg>
        </View>

        <MotiView
          from={{ opacity: 0, translateY: 6 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 520, delay: 1500 }}
        >
          <Text style={styles.wordmark}>DeutschFlow</Text>
        </MotiView>
      </MotiView>

      {/* Loading indicator near the home indicator. */}
      <View style={styles.bottom}>
        <ActivityIndicator color={INK} />
      </View>
    </MotiView>
  )
}

const styles = StyleSheet.create({
  root: { backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  center: { alignItems: 'center', gap: 20 },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 22,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: INK,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  wordmark: { fontFamily: fonts.displayBold, fontSize: 30, letterSpacing: -0.6, color: INK },
  bottom: { position: 'absolute', bottom: 56, left: 0, right: 0, alignItems: 'center' },
})
