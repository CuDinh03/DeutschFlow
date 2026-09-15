// Themed screen container. Fills the background, applies safe-area insets, and
// optionally scrolls. Edges are configurable so headers/tab bars can opt out.

import { useRef, type ReactNode } from 'react'
import { RefreshControl, ScrollView, View, type ViewStyle, type StyleProp } from 'react-native'
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context'
import { space, useTheme } from '@/lib/theme'
import { SpotlightScrollHostProvider } from '@/components/guide/spotlightScrollHost'

interface ScreenProps {
  children: ReactNode
  scroll?: boolean
  edges?: Edge[]
  padded?: boolean
  contentStyle?: StyleProp<ViewStyle>
  refreshing?: boolean
  onRefresh?: () => void
}

export function Screen({
  children,
  scroll = false,
  edges = ['top'],
  padded = false,
  contentStyle,
  refreshing,
  onRefresh,
}: ScreenProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  // Neo spotlight nằm trong màn cuộn được tour host cuộn vào tầm nhìn trước khi
  // chiếu sáng — host lấy ScrollView qua context này (components/guide).
  const scrollRef = useRef<ScrollView | null>(null)

  // Chỉ đặt inset cho cạnh ĐƯỢC chọn. Trước 05/09 cạnh bị loại vẫn ghi `paddingLeft: 0` /
  // `paddingRight: 0`; Yoga ưu tiên key theo cạnh hơn `paddingHorizontal`, nên
  // `contentStyle={{ paddingHorizontal }}` của các màn `edges={[]}` (Sửa lỗi, Lernweg,
  // phòng thi nói, Đổi mật khẩu…) bị vô hiệu → nội dung sát mép màn hình.
  const inset: ViewStyle = {
    ...(edges.includes('top') ? { paddingTop: insets.top } : null),
    ...(edges.includes('bottom') ? { paddingBottom: insets.bottom } : null),
    ...(edges.includes('left') ? { paddingLeft: insets.left } : null),
    ...(edges.includes('right') ? { paddingRight: insets.right } : null),
  }

  const pad: ViewStyle = padded ? { paddingHorizontal: space[5] } : {}

  if (scroll) {
    return (
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: theme.colors.bg }}
        contentContainerStyle={[inset, pad, contentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing ?? false}
              onRefresh={onRefresh}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          ) : undefined
        }
      >
        <SpotlightScrollHostProvider value={scrollRef}>{children}</SpotlightScrollHostProvider>
      </ScrollView>
    )
  }

  return (
    <View style={[{ flex: 1, backgroundColor: theme.colors.bg }, inset, pad, contentStyle]}>
      {children}
    </View>
  )
}
