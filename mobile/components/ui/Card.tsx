// Surface card. `elevation` picks the shadow tier; `tone` swaps the surface
// layer. When `onPress` is set it becomes a pressable with a subtle scale.

import type { ReactNode } from 'react'
import { Pressable, View, type ViewStyle, type StyleProp } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { motion, radius, space, themeShadowStyle, useTheme } from '@/lib/theme'

type Elevation = 'flat' | 'card' | 'lifted'
type Tone = 'surface' | 'elevated' | 'sunken'

interface CardProps {
  children: ReactNode
  elevation?: Elevation
  tone?: Tone
  bordered?: boolean
  padded?: boolean
  onPress?: () => void
  /** Required for pressable Cards whose tap target is not self-describing from the visible text. */
  accessibilityLabel?: string
  /** Optional additional hint announced after the label (e.g. "Opens the vocabulary list"). */
  accessibilityHint?: string
  /** Announce a disabled state to assistive tech AND block the press handler. */
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function Card({
  children,
  elevation = 'card',
  tone = 'surface',
  bordered = true,
  padded = true,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  style,
}: CardProps) {
  const theme = useTheme()
  const scale = useSharedValue(1)

  const toneMap: Record<Tone, string> = {
    surface: theme.colors.surface,
    elevated: theme.colors.surfaceElevated,
    sunken: theme.colors.surfaceSunken,
  }

  const base: ViewStyle = {
    backgroundColor: toneMap[tone],
    borderRadius: radius.md,
    padding: padded ? space[4] : 0,
    borderWidth: bordered ? 1 : 0,
    borderColor: theme.colors.border,
    ...(elevation === 'card' ? themeShadowStyle(theme.shadow.card) : {}),
    ...(elevation === 'lifted' ? themeShadowStyle(theme.shadow.lifted) : {}),
  }

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  if (!onPress) {
    return <View style={[base, style]}>{children}</View>
  }

  const handlePress = () => {
    if (disabled) return
    void Haptics.selectionAsync()
    onPress()
  }

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={handlePress}
      onPressIn={() => {
        if (!disabled) scale.value = withSpring(0.97, motion.spring.snappy)
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring.snappy)
      }}
      style={[base, animatedStyle, style]}
    >
      {children}
    </AnimatedPressable>
  )
}
