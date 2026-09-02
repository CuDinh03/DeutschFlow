// iOS 26 "Liquid Glass" tab bar. Floating, near full-width, blur-backed with
// refraction edges (top highlight + inner depth). Selection is a soft tinted
// glass capsule that slides between tabs with spring physics — HIG-aligned
// (tint + glass highlight, not a heavy filled pill). Light haptic on press.
//
// VUỐT NGANG trên pill (QA 02/09 tối): capsule chọn trượt bám theo ngón tay
// (worklet UI-thread, không đợi JS), haptic mỗi lần qua ô mới, NHẢ ở ô nào thì
// chuyển sang tab đó — đúng hành vi tab bar iOS 26. Chạm nhẹ vẫn là bấm thường
// (pan chỉ kích hoạt khi kéo ngang ≥10pt, lúc đó touch của Pressable bị huỷ).
//
// OVERLAY, không chiếm chỗ layout: react-navigation đặt custom tab bar theo
// flow CỘT (screens flex:1 + bar một khoang riêng), khoang đó lộ màu nền
// navigator thành một DẢI chia vùng ngay dưới nội dung — và BlurView chẳng có
// gì để blur (QA TestFlight 02/09). Bar vì thế tự ghim absolute đáy màn để
// nội dung chảy xuống dưới kính; các màn TAB chừa đáy bằng useTabBarClearance.

import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { Home, BookOpen, Mic, User, type LucideIcon } from 'lucide-react-native'
import { type LayoutChangeEvent, Pressable, StyleSheet, View, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { captureEvent } from '@/lib/analytics'
import { tabIndexForX } from '@/lib/tabGesture'
import { useSpotlightTarget } from '@/components/guide/SpotlightTour'
import { ThemedText } from './ThemedText'

const ICONS: Record<string, LucideIcon> = {
  index: Home,
  learn: BookOpen,
  speaking: Mic,
  profile: User,
}

// Fallback khi route chưa khai `title` trong Tabs.Screen — nguồn nhãn chính là
// options.title của _layout (trước đây map này ĐÈ title, nên đổi nhãn ở layout
// không có tác dụng — vd "Heute" của cụm màn 02/09 không bao giờ hiện).
const LABELS: Record<string, string> = {
  index: 'Trang chủ',
  learn: 'Học',
  speaking: 'Speaking',
  profile: 'Hồ sơ',
}

const BAR_HEIGHT = 64
const INDICATOR_HEIGHT = 48

/**
 * Khoảng chừa đáy cho NỘI DUNG các màn tab: thanh glass nổi đè lên nội dung,
 * scroll view phải cộng khoảng này vào paddingBottom để mục cuối không bị pill
 * che mất (pill + đệm trên + đệm dưới theo safe-area + hở thở thêm `extra`).
 */
export function useTabBarClearance(extra: number = space[4]): number {
  const insets = useSafeAreaInsets()
  return BAR_HEIGHT + space[2] + (insets.bottom > 0 ? insets.bottom : space[3]) + extra
}

interface TabLayout {
  x: number
  width: number
}

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
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

  // ── Vuốt ngang trên pill để chuyển tab ─────────────────────────────────────
  // Worklet chỉ được đọc shared value → mirror layout các ô + tab đang active.
  const slotsSv = useSharedValue<(TabLayout | undefined)[]>([])
  const activeIdxSv = useSharedValue(activeTabIndex)
  // Ô đang nằm dưới ngón tay trong lúc kéo (−1 = không trong cử chỉ nào).
  const previewIdx = useSharedValue(-1)

  useEffect(() => {
    slotsSv.value = tabRoutes.map((_, i) => layouts[i])
    // tabRoutes dựng lại mỗi render nhưng nội dung ổn định — chỉ layouts đáng theo dõi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layouts, tabRoutes.length, slotsSv])
  useEffect(() => {
    activeIdxSv.value = activeTabIndex
  }, [activeTabIndex, activeIdxSv])

  // JS-side: haptic khi ngón trượt qua ô mới; chốt tab khi nhả; trả capsule về
  // chỗ cũ khi cử chỉ bị huỷ hoặc bị màn chặn tabPress. Gesture dựng lại mỗi
  // render nên các closure này luôn thấy props/state mới nhất.
  const previewHaptic = () => {
    void Haptics.selectionAsync()
  }
  const snapToActive = () => {
    const layout = layouts[activeTabIndex]
    if (!layout) return
    indicatorX.value = withSpring(layout.x, motion.spring.snappy)
    indicatorW.value = withSpring(layout.width, motion.spring.snappy)
  }
  const commitFromSwipe = (idx: number) => {
    const route = tabRoutes[idx]
    if (idx < 0 || !route || idx === activeTabIndex) {
      snapToActive()
      return
    }
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
    if (event.defaultPrevented) {
      snapToActive()
      return
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    captureEvent('nav_clicked', { feature: route.name, from: 'tab_bar_swipe' })
    navigation.navigate(route.name)
  }

  const swipeGesture = Gesture.Pan()
    .maxPointers(1)
    // Chỉ nhận khi kéo NGANG ≥10pt — chạm nhẹ vẫn rơi vào Pressable của từng ô;
    // kéo dọc (mép dưới = home indicator của hệ) thì fail sớm, không tranh chấp.
    .activeOffsetX([-10, 10])
    .failOffsetY([-14, 14])
    .onBegin(() => {
      previewIdx.value = activeIdxSv.value
    })
    .onUpdate((e) => {
      // e.x = toạ độ trong hàng tab (view gắn detector) — cùng hệ với layouts.
      const idx = tabIndexForX(slotsSv.value, e.x)
      if (idx < 0) return
      if (idx !== previewIdx.value) {
        previewIdx.value = idx
        runOnJS(previewHaptic)()
      }
      const slot = slotsSv.value[idx]
      if (slot) {
        indicatorX.value = withSpring(slot.x, motion.spring.snappy)
        indicatorW.value = withSpring(slot.width, motion.spring.snappy)
      }
    })
    .onEnd(() => {
      runOnJS(commitFromSwipe)(previewIdx.value)
    })
    .onFinalize((_e, success) => {
      // Cử chỉ bị huỷ giữa chừng (hoặc chưa từng active) mà capsule đã trượt
      // lệch → trả về ô đang active. Tap thuần (preview == active) thì bỏ qua,
      // khỏi tạo double-spring chồng lên hiệu ứng của onPress.
      if (!success && previewIdx.value !== activeIdxSv.value) {
        runOnJS(snapToActive)()
      }
      previewIdx.value = -1
    })

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
    opacity: ready.value,
  }))

  // Hide the floating bar on pushed detail screens (href:null routes that aren't
  // one of the 4 real tabs). They have their own AppHeader + back button, and the
  // bar would otherwise float over their bottom content — e.g. the skill tree's
  // companion/zoom controls. Placed after all hooks to respect rules-of-hooks.
  const focusedRoute = state.routes[state.index]
  const focusedName = focusedRoute?.name
  // Màn tab cũng có thể tự ẩn bar theo pha (vd Speaking đang trong phiên chat)
  // qua navigation.setOptions({ tabBarStyle: { display: 'none' } }).
  const focusedTabBarStyle = focusedRoute
    ? (StyleSheet.flatten(descriptors[focusedRoute.key]?.options.tabBarStyle) as ViewStyle | undefined)
    : undefined
  if (!focusedName || !ICONS[focusedName] || focusedTabBarStyle?.display === 'none') return null

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
        // Overlay thật sự — không chiếm khoang layout, nội dung chảy dưới kính.
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
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

          <GestureDetector gesture={swipeGesture}>
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
                  captureEvent('nav_clicked', { feature: route.name, from: 'tab_bar' })
                  navigation.navigate(route.name)
                }
              }

              return (
                <TabItem
                  key={route.key}
                  icon={icon}
                  label={descriptors[route.key]?.options.title ?? LABELS[route.name] ?? route.name}
                  focused={focused}
                  onPress={onPress}
                  onLayout={onTabLayout(index)}
                  spotlightId={`tab-${route.name}`}
                />
              )
            })}
          </View>
          </GestureDetector>
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
  /** Anchor id so the spotlight tour can highlight this tab (e.g. "tab-learn"). */
  spotlightId?: string
}

function TabItem({ icon: LucideComponent, label, focused, onPress, onLayout, spotlightId }: TabItemProps) {
  const theme = useTheme()
  const spotlightRef = useSpotlightTarget(spotlightId)
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
      ref={spotlightRef}
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
