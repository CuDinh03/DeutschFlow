// iOS 26 "Liquid Glass" tab bar. Floating, near full-width, blur-backed with
// refraction edges (top highlight + inner depth). Selection is a soft tinted
// glass capsule that slides between tabs with spring physics — HIG-aligned
// (tint + glass highlight, not a heavy filled pill). Light haptic on press.

import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { Home, BookOpen, Mic, User, type LucideIcon } from 'lucide-react-native'
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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

const BAR_HEIGHT = 64
const INDICATOR_HEIGHT = 48

interface TabLayout {
  x: number
  width: number
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  // Only the routes that are real tabs (have an icon mapping).
  const tabRoutes = state.routes.filter((r) => ICONS[r.name])

  const [layouts, setLayouts] = useState<Record<number, TabLayout>>({})
  const indicatorX = useSharedValue(0)
  const indicatorW = useSharedValue(0)
  const ready = useSharedValue(0)

  const activeKey = state.routes[state.index]?.key
  const activeTabIndex = tabRoutes.findIndex((r) => r.key === activeKey)

  useEffect(() => {
    const layout = layouts[activeTabIndex]
    if (!layout) return
    indicatorX.value = withSpring(layout.x, motion.spring.snappy)
    indicatorW.value = withSpring(layout.width, motion.spring.snappy)
    ready.value = withSpring(1, motion.spring.gentle)
  }, [activeTabIndex, layouts, indicatorX, indicatorW, ready])

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
    opacity: ready.value,
  }))

  const onTabLayout = (index: number) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout
    setLayouts((prev) => {
      const existing = prev[index]
      if (existing && existing.x === x && existing.width === width) return prev
      return { ...prev, [index]: { x, width } }
    })
  }

  const glassTint = theme.isDark ? 'rgba(20,20,22,0.42)' : 'rgba(255,255,255,0.46)'
  const edgeBorder = theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)'
  const topHighlight = theme.isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.9)'

  return (
    <View
      pointerEvents="box-none"
      style={{
        paddingHorizontal: space[3],
        paddingTop: space[2],
        paddingBottom: insets.bottom > 0 ? insets.bottom : space[3],
        backgroundColor: 'transparent',
      }}
    >
      <View
        style={{
          height: BAR_HEIGHT,
          borderRadius: radius.full,
          shadowColor: theme.isDark ? '#000' : '#1A1A2E',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: theme.isDark ? 0.42 : 0.16,
          shadowRadius: theme.isDark ? 26 : 22,
          elevation: 12,
        }}
      >
        <View
          style={{
            flex: 1,
            borderRadius: radius.full,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: edgeBorder,
          }}
        >
          <BlurView
            intensity={theme.isDark ? 50 : 65}
            tint={theme.blurTint}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: glassTint }]} />
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: StyleSheet.hairlineWidth * 2,
              backgroundColor: topHighlight,
            }}
          />

          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: space[1],
            }}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  top: (BAR_HEIGHT - INDICATOR_HEIGHT) / 2,
                  left: 0,
                  height: INDICATOR_HEIGHT,
                  borderRadius: radius.full,
                  backgroundColor: theme.colors.accentSoft,
                },
                indicatorStyle,
              ]}
            />

            {tabRoutes.map((route, index) => {
              const focused = activeTabIndex === index
              const icon = ICONS[route.name]
              if (!icon) return null

              const onPress = () => {
                void Haptics.selectionAsync()
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                })
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
                  onLayout={onTabLayout(index)}
                />
              )
            })}
          </View>
        </View>
      </View>
    </View>
  )
}

interface TabItemProps {
  icon: LucideIcon
  label: string
  focused: boolean
  onPress: () => void
  onLayout: (e: LayoutChangeEvent) => void
}

function TabItem({ icon: LucideComponent, label, focused, onPress, onLayout }: TabItemProps) {
  const theme = useTheme()
  const iconScale = useSharedValue(focused ? 1 : 0.9)
  const press = useSharedValue(1)

  useEffect(() => {
    iconScale.value = withSpring(focused ? 1 : 0.9, motion.spring.snappy)
  }, [focused, iconScale])

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value * press.value }],
  }))

  const tint = focused ? theme.colors.accentText : theme.colors.textMuted

  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      onPressIn={() => {
        press.value = withSpring(0.86, motion.spring.snappy)
      }}
      onPressOut={() => {
        press.value = withSpring(1, motion.spring.snappy)
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        height: BAR_HEIGHT,
      }}
    >
      <Animated.View style={iconStyle}>
        <LucideComponent size={23} color={tint} strokeWidth={focused ? 2.3 : 1.9} />
      </Animated.View>
      <ThemedText variant="caption" style={{ color: tint, fontSize: 11 }}>
        {label}
      </ThemedText>
    </Pressable>
  )
}
