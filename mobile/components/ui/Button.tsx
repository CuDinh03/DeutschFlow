// Primary action surface. Variants cover the full hierarchy; every press has a
// scale + haptic, a loading state, and a disabled state. No layout-property
// animation — only transform/opacity.

import * as Haptics from 'expo-haptics'
import type { LucideIcon } from 'lucide-react-native'
import { ActivityIndicator, Pressable, View, type ViewStyle, type StyleProp } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { Icon } from './Icon'
import { ThemedText } from './ThemedText'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  iconRight?: boolean
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

const heights: Record<Size, number> = { sm: 40, md: 48, lg: 56 }

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight = false,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
}: ButtonProps) {
  const theme = useTheme()
  const scale = useSharedValue(1)
  const isInactive = disabled || loading

  const surfaces: Record<Variant, { bg: string; border: string }> = {
    primary: { bg: theme.colors.accent, border: theme.colors.accent },
    secondary: { bg: theme.colors.surfaceElevated, border: theme.colors.border },
    ghost: { bg: 'transparent', border: 'transparent' },
    danger: { bg: theme.colors.danger, border: theme.colors.danger },
  }

  const textColor =
    variant === 'primary'
      ? 'onAccent'
      : variant === 'danger'
        ? 'onAccent'
        : variant === 'ghost'
          ? 'accent'
          : 'primary'

  const iconColor = textColor === 'onAccent' ? 'onAccent' : variant === 'ghost' ? 'accent' : 'primary'

  const base: ViewStyle = {
    height: heights[size],
    borderRadius: radius.lg,
    backgroundColor: surfaces[variant].bg,
    borderWidth: 1,
    borderColor: surfaces[variant].border,
    paddingHorizontal: space[5],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    opacity: isInactive ? 0.55 : 1,
  }

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const handlePress = () => {
    if (isInactive) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress()
  }

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive, busy: loading }}
      onPress={handlePress}
      onPressIn={() => {
        if (!isInactive) scale.value = withSpring(0.96, motion.spring.snappy)
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring.snappy)
      }}
      style={[base, animatedStyle, style]}
    >
      {loading ? (
        <ActivityIndicator
          color={textColor === 'onAccent' ? theme.colors.onAccent : theme.colors.accent}
        />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          {icon && !iconRight ? <Icon icon={icon} size={size === 'sm' ? 16 : 18} color={iconColor} /> : null}
          <ThemedText variant="bodyStrong" color={textColor}>
            {label}
          </ThemedText>
          {icon && iconRight ? <Icon icon={icon} size={size === 'sm' ? 16 : 18} color={iconColor} /> : null}
        </View>
      )}
    </AnimatedPressable>
  )
}
