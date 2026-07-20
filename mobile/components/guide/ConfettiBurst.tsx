// Lightweight pure-JS confetti (Moti + plain Views) for the first-sentence
// celebration. Deliberately no native confetti lib so onboarding v1 ships OTA
// without a new binary build (plan §4.3).

import { useMemo } from 'react'
import { View, useWindowDimensions } from 'react-native'
import { MotiView } from 'moti'

const PIECES = 26
// Brand-forward palette: DE gold + red, ink, and a cool counterpoint.
const COLORS = ['#FFCD00', '#DA291C', '#161513', '#2E86AB', '#5FAD56']

interface Piece {
  startX: number
  driftX: number
  delay: number
  duration: number
  size: number
  color: string
  spin: string
}

export function ConfettiBurst() {
  const { width, height } = useWindowDimensions()

  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: PIECES }, (_, i) => ({
        startX: Math.random() * width,
        driftX: (Math.random() - 0.5) * width * 0.4,
        delay: Math.random() * 350,
        duration: 1400 + Math.random() * 900,
        size: 7 + Math.random() * 6,
        color: COLORS[i % COLORS.length],
        spin: `${Math.random() > 0.5 ? '' : '-'}${360 + Math.round(Math.random() * 540)}deg`,
      })),
    [width],
  )

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
    >
      {pieces.map((p, i) => (
        <MotiView
          key={i}
          from={{ translateY: -40, translateX: p.startX, rotate: '0deg', opacity: 1 }}
          animate={{
            translateY: height * 0.95,
            translateX: p.startX + p.driftX,
            rotate: p.spin,
            opacity: 0,
          }}
          transition={{ type: 'timing', duration: p.duration, delay: p.delay }}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size * 1.6,
            borderRadius: 2,
            backgroundColor: p.color,
          }}
        />
      ))}
    </View>
  )
}
