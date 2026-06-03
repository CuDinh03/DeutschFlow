// Branded launch splash — RN/Reanimated port of the native (Capacitor) splash.
// Sequence: draw the 'D' outline → red glow → colour details → wordmark → tagline,
// then self-fade and unmount. Brand-locked (always dark + logo colours), theme-independent.

import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { MotiView } from 'moti'
import Svg, { Path, Rect, G, Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg'
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

// Logo colours locked to the brand mark (do not theme these).
const BG = '#0B0B0C'
const STROKE = '#FFFFFF'
const GOLD = '#FFCD00'
const RED = '#DA291C'

// 'D' outline path in a 100×100 viewBox (matches DFLogo.swift geometry).
const D_PATH = 'M20 18 L20 82 L52 82 L74 62 L74 38 L52 18 Z'
// Perimeter of D_PATH ≈ 211.4 viewBox units — used for the stroke-draw animation.
const PATH_LEN = 212

const LOGO = 132

interface SplashAnimatedProps {
  onDone: () => void
}

export function SplashAnimated({ onDone }: SplashAnimatedProps) {
  const draw = useSharedValue(0)
  const detail = useSharedValue(0)
  const [leaving, setLeaving] = useState(false)

  const outlineProps = useAnimatedProps(() => ({
    strokeDashoffset: PATH_LEN * (1 - draw.value),
  }))
  const detailProps = useAnimatedProps(() => ({ opacity: detail.value }))

  useEffect(() => {
    draw.value = withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) })
    detail.value = withDelay(820, withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }))

    const fade = setTimeout(() => setLeaving(true), 2400)
    const done = setTimeout(onDone, 2850)
    return () => {
      clearTimeout(fade)
      clearTimeout(done)
    }
  }, [draw, detail, onDone])

  return (
    <MotiView
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.root]}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ type: 'timing', duration: 420, easing: Easing.inOut(Easing.ease) }}
    >
      {/* Red radial glow behind the mark */}
      <MotiView
        style={styles.glow}
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 550, delay: 500 }}
      >
        <Svg width={320} height={320}>
          <Defs>
            <RadialGradient id="g" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={RED} stopOpacity={0.26} />
              <Stop offset="55%" stopColor={RED} stopOpacity={0.08} />
              <Stop offset="100%" stopColor={RED} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={160} cy={160} rx={160} ry={160} fill="url(#g)" />
        </Svg>
      </MotiView>

      {/* The 'D' mark */}
      <Svg width={LOGO} height={LOGO} viewBox="0 0 100 100">
        <AnimatedPath
          d={D_PATH}
          stroke={STROKE}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="miter"
          fill="none"
          strokeDasharray={PATH_LEN}
          animatedProps={outlineProps}
        />
        <AnimatedG animatedProps={detailProps}>
          <Path d="M52 38 L74 50 L52 62 Z" fill={RED} />
          <Rect x={24} y={45} width={9} height={9} fill={GOLD} />
        </AnimatedG>
      </Svg>

      {/* Wordmark */}
      <MotiView
        style={styles.wordmarkRow}
        from={{ opacity: 0, translateY: 8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 450, delay: 1050 }}
      >
        <Text style={styles.my}>my</Text>
        <Text style={styles.deutsch}>Deutsch</Text>
        <Text style={styles.flow}>Flow</Text>
      </MotiView>

      {/* Tagline */}
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 400, delay: 1350 }}
      >
        <Text style={styles.tagline}>GERMAN LANGUAGE LEARNING</Text>
      </MotiView>
    </MotiView>
  )
}

const styles = StyleSheet.create({
  root: { backgroundColor: BG, alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  glow: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  wordmarkRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 32 },
  my: { fontFamily: fonts.bodyRegular, fontSize: 24, color: 'rgba(255,255,255,0.72)', lineHeight: 30 },
  deutsch: { fontFamily: fonts.displayBold, fontSize: 30, color: '#FFFFFF', lineHeight: 32 },
  flow: { fontFamily: fonts.displayBold, fontSize: 30, color: RED, lineHeight: 32 },
  tagline: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10.5,
    letterSpacing: 3.5,
    color: 'rgba(255,255,255,0.42)',
    marginTop: 10,
  },
})
