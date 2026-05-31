// Linear progress. `value` is 0..1. Fill animates with a spring on change.

import { useEffect } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { motion, radius, useTheme } from '@/lib/theme'

interface ProgressBarProps {
  value: number
  height?: number
  trackColor?: string
  fillColor?: string
  style?: StyleProp<ViewStyle>
}

export function ProgressBar({ value, height = 8, trackColor, fillColor, style }: ProgressBarProps) {
  const theme = useTheme()
  const clamped = Math.max(0, Math.min(1, value))
  const progress = useSharedValue(clamped)

  useEffect(() => {
    progress.value = withSpring(clamped, motion.spring.gentle)
  }, [clamped])

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }))

  return (
    <View
      style={[
        {
          height,
          borderRadius: radius.full,
          backgroundColor: trackColor ?? theme.colors.surfaceSunken,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          { height: '100%', borderRadius: radius.full, backgroundColor: fillColor ?? theme.colors.accent },
          fillStyle,
        ]}
      />
    </View>
  )
}
