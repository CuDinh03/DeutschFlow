// Native frosted tab bar. Docked, blur-backed, theme-aware. Each tab carries an
// animated soft pill behind the active icon and a light haptic on press.

import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { useEffect } from 'react'
import { Home, BookOpen, Mic, User, type LucideIcon } from 'lucide-react-native'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { ThemedText } from './ThemedText'

const ICONS: Record<string, LucideIcon> = {
  index: Home,
  learn: BookOpen,
  speaking: Mic,
  profile: User,
}

const LABELS: Record<string, string> = {
  index: 'Trang chủ',
  learn: 'Học',
  speaking: 'Speaking',
  profile: 'Hồ sơ',
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={{
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
        backgroundColor: theme.isDark ? 'rgba(11,11,12,0.6)' : 'rgba(250,250,251,0.7)',
      }}
    >
      <BlurView intensity={theme.isDark ? 40 : 60} tint={theme.blurTint} style={StyleSheet.absoluteFill} />
      <View
        style={{
          flexDirection: 'row',
          paddingTop: space[2],
          paddingBottom: Math.max(insets.bottom, space[2]),
          paddingHorizontal: space[2],
        }}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index
          const icon = ICONS[route.name]
          if (!icon) return null

          const onPress = () => {
            void Haptics.selectionAsync()
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name)
            }
          }

          return (
            <TabItem
              key={route.key}
              icon={icon}
              label={LABELS[route.name] ?? route.name}
              focused={focused}
              onPress={onPress}
            />
          )
        })}
      </View>
    </View>
  )
}

function TabItem({
  icon: LucideComponent,
  label,
  focused,
  onPress,
}: {
  icon: LucideIcon
  label: string
  focused: boolean
  onPress: () => void
}) {
  const theme = useTheme()
  const pillOpacity = useSharedValue(focused ? 1 : 0)
  const iconScale = useSharedValue(focused ? 1 : 0.92)

  useEffect(() => {
    pillOpacity.value = withTiming(focused ? 1 : 0, { duration: motion.duration.fast })
    iconScale.value = withSpring(focused ? 1 : 0.92, motion.spring.snappy)
  }, [focused])

  const pillStyle = useAnimatedStyle(() => ({ opacity: pillOpacity.value }))
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }))

  const tint = focused ? theme.colors.accentText : theme.colors.textMuted

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: space[1] }}
    >
      <View style={{ width: 56, height: 32, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: 56,
              height: 32,
              borderRadius: radius.full,
              backgroundColor: theme.colors.accentSoft,
            },
            pillStyle,
          ]}
        />
        <Animated.View style={iconStyle}>
          <LucideComponent size={22} color={tint} strokeWidth={focused ? 2.4 : 1.9} />
        </Animated.View>
      </View>
      <ThemedText variant="caption" style={{ color: tint, fontSize: 11 }}>
        {label}
      </ThemedText>
    </Pressable>
  )
}
