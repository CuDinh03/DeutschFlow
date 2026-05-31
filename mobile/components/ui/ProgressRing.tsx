// Circular progress ring with an optional centered label. `value` is 0..1.
// Stroke animates via animated dash offset (no layout properties touched).

import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { motion, useTheme } from '@/lib/theme'
import { ThemedText } from './ThemedText'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

interface ProgressRingProps {
  value: number
  size?: number
  strokeWidth?: number
  color?: string
  trackColor?: string
  label?: string
  sublabel?: string
}

export function ProgressRing({
  value,
  size = 96,
  strokeWidth = 8,
  color,
  trackColor,
  label,
  sublabel,
}: ProgressRingProps) {
  const theme = useTheme()
  const clamped = Math.max(0, Math.min(1, value))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withSpring(clamped, motion.spring.gentle)
  }, [clamped])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }))

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor ?? theme.colors.surfaceSunken}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color ?? theme.colors.accent}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {label ? (
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <ThemedText variant="monoLg">{label}</ThemedText>
          {sublabel ? (
            <ThemedText variant="caption" color="muted">
              {sublabel}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
