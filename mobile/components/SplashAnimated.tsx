// Màn chờ khi mở app — nhận diện v3.4 (18/11/2026). Nền giấy ấm, ô biểu tượng app nền mực
// (đúng SVG chính thức docs/design/public-v3-assets/app-icon-dark.svg): nét D trắng tự vẽ,
// rồi ô vàng + tam giác đỏ bật ra, rồi chữ "myDeutschFlow" (Flow luôn đỏ) và khẩu hiệu
// LEARN GERMAN. FIND YOUR FLOW. (owner chốt giữ). Cố định màu, không theo theme.
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

// Màu cố định của bộ nhận diện v3.4.
const YELLOW = '#FFC900'
const INK = '#171615'
const RED = '#E3261D'
const PAPER = '#FAF9F6'

// Nét D của biểu tượng app (app-icon-dark.svg, viewBox 100). Chu vi ≈ 214 (độ dài để vẽ nét).
const D_PATH = 'M 22 19 L 55 19 L 80 39 L 80 61 L 55 81 L 22 81 Z'
const PATH_LEN = 215
const TILE = 96

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
          <Svg width={TILE} height={TILE} viewBox="0 0 100 100">
            <AnimatedPath
              d={D_PATH}
              stroke="#FFFFFF"
              strokeWidth={9.5}
              strokeLinejoin="miter"
              fill="none"
              strokeDasharray={PATH_LEN}
              animatedProps={outlineProps}
            />
            <AnimatedG animatedProps={detailProps}>
              <Rect x={31} y={44.5} width={11} height={11} rx={1.5} fill={YELLOW} />
              <Polygon points="50,36 70,50 50,64" fill={RED} />
            </AnimatedG>
          </Svg>
        </View>

        <MotiView
          from={{ opacity: 0, translateY: 6 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 520, delay: 1500 }}
        >
          <Text style={styles.wordmark} accessibilityLabel="myDeutschFlow">
            <Text style={styles.wordLight}>my</Text>
            Deutsch
            <Text style={{ color: RED }}>Flow</Text>
          </Text>
          <Text style={styles.slogan}>LEARN GERMAN. FIND YOUR FLOW.</Text>
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
  root: { backgroundColor: PAPER, alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  center: { alignItems: 'center', gap: 20 },
  tile: {
    width: TILE,
    height: TILE,
    // Bo góc ~22% như biểu tượng app trên màn hình chính iOS.
    borderRadius: 22,
    backgroundColor: INK,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: INK,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  wordmark: { fontFamily: fonts.bodyBold, fontSize: 28, letterSpacing: -0.6, color: INK, textAlign: 'center' },
  wordLight: { fontFamily: fonts.bodyRegular },
  slogan: { fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 2.2, color: '#6E6A63', textAlign: 'center', marginTop: 8 },
  bottom: { position: 'absolute', bottom: 56, left: 0, right: 0, alignItems: 'center' },
})
