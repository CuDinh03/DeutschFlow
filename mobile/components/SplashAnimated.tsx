// Màn chờ khi mở app — nhận diện v3.4 (18/11/2026). Ô biểu tượng app nền mực (đúng
// app-icon-dark.svg chính thức của bộ nhận diện, owner giữ local) đứng YÊN đúng chỗ và đúng cỡ
// của ô trên màn chờ native (splash.png 1284×2778, resizeMode cover, ô 288px giữa ảnh), nên
// lúc màn chờ native nhường cho màn chờ này không có gì nhảy. Sau đó chữ "myDeutschFlow"
// (Flow luôn đỏ) và khẩu hiệu LEARN GERMAN. FIND YOUR FLOW. (owner chốt giữ) hiện dần bên dưới.
// Cố định màu, không theo theme.
//
// Holds (after a minimum on-screen time) until the app is ready, then self-fades
// and unmounts — a safety cap guarantees it never traps the user on the splash.

import { useEffect, useState } from 'react'
import { ActivityIndicator, Dimensions, StyleSheet, Text, View } from 'react-native'
import { MotiView } from 'moti'
import Svg, { Path, Polygon, Rect } from 'react-native-svg'
import { Easing } from 'react-native-reanimated'
import Constants from 'expo-constants'
import { fonts } from '@/lib/theme'
import { splashTileSize } from '@/lib/splashGeometry'

// Màu cố định của bộ nhận diện v3.4.
const YELLOW = '#FFC900'
const INK = '#171615'
const RED = '#E3261D'
const PAPER = '#FAF9F6'
// Nền nối tiếp màn chờ native: bản build hiện tại vẫn nền vàng; khi build mới đổi sang giấy
// (PR biểu tượng app) thì app.json đổi theo. Lấy từ cấu hình để không nhảy màu khi đi OTA.
const SPLASH_BG = Constants.expoConfig?.splash?.backgroundColor ?? PAPER
// Trên nền vàng của bản build cũ, chữ xám không đủ tương phản ⇒ khẩu hiệu dùng mực.
const SLOGAN_COLOR = SPLASH_BG.toUpperCase() === PAPER ? '#6E6A63' : INK

// Nét D của biểu tượng app (app-icon-dark.svg, viewBox 100).
const D_PATH = 'M 22 19 L 55 19 L 80 39 L 80 61 L 55 81 L 22 81 Z'


interface SplashAnimatedProps {
  /** App-readiness gate: the splash holds (after its min display time) until true. */
  ready: boolean
  onDone: () => void
}

export function SplashAnimated({ ready, onDone }: SplashAnimatedProps) {
  const [minElapsed, setMinElapsed] = useState(false)
  const [forced, setForced] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const { width, height } = Dimensions.get('window')
  const tile = splashTileSize(width, height)

  // Tối thiểu 2,3 s trên màn, tối đa 6 s (chốt an toàn).
  useEffect(() => {
    const min = setTimeout(() => setMinElapsed(true), 2300)
    const cap = setTimeout(() => setForced(true), 6000)
    return () => {
      clearTimeout(min)
      clearTimeout(cap)
    }
  }, [])

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
      {/* Ô biểu tượng: đúng tâm màn, đúng cỡ ô native, hiện sẵn (không nhảy khi nối tiếp). */}
      <View
        style={[styles.tile, { width: tile, height: tile, borderRadius: Math.round(tile * 0.22) }]}
        accessibilityLabel="myDeutschFlow"
      >
        <Svg width={tile} height={tile} viewBox="0 0 100 100">
          <Path d={D_PATH} stroke="#FFFFFF" strokeWidth={9.5} strokeLinejoin="miter" fill="none" />
          <Rect x={31} y={44.5} width={11} height={11} rx={1.5} fill={YELLOW} />
          <Polygon points="50,36 70,50 50,64" fill={RED} />
        </Svg>
      </View>

      {/* Chữ thương hiệu hiện dần NGAY DƯỚI ô, không đẩy ô lệch khỏi tâm. */}
      <MotiView
        style={[styles.words, { top: height / 2 + tile / 2 + 24 }]}
        from={{ opacity: 0, translateY: 6 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 520, delay: 450 }}
      >
        <Text style={styles.wordmark}>
          <Text style={styles.wordLight}>my</Text>
          Deutsch
          <Text style={{ color: RED }}>Flow</Text>
        </Text>
        <Text style={[styles.slogan, { color: SLOGAN_COLOR }]}>LEARN GERMAN. FIND YOUR FLOW.</Text>
      </MotiView>

      {/* Loading indicator near the home indicator. */}
      <View style={styles.bottom}>
        <ActivityIndicator color={INK} />
      </View>
    </MotiView>
  )
}

const styles = StyleSheet.create({
  root: { backgroundColor: SPLASH_BG, alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  // Bo góc ~22% như biểu tượng app (đặt theo cỡ ô lúc vẽ).
  tile: {
    backgroundColor: INK,
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
  slogan: { fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 2.2, textAlign: 'center', marginTop: 8 },
  words: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bottom: { position: 'absolute', bottom: 56, left: 0, right: 0, alignItems: 'center' },
})
