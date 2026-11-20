// Themed screen container. Fills the background, applies safe-area insets, and
// optionally scrolls. Edges are configurable so headers/tab bars can opt out.

import { useRef, type ReactNode } from 'react'
import { RefreshControl, ScrollView, View, type ViewStyle, type StyleProp } from 'react-native'
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context'
import { space, useTheme } from '@/lib/theme'
import { SpotlightScrollHostProvider } from '@/components/guide/spotlightScrollHost'
import { insetPadding } from '@/lib/screenInset'

interface ScreenProps {
  children: ReactNode
  scroll?: boolean
  edges?: Edge[]
  padded?: boolean
  contentStyle?: StyleProp<ViewStyle>
  refreshing?: boolean
  onRefresh?: () => void
  /** iOS: ScrollView tự chừa chỗ cho bàn phím. Tắt ở màn đã tự bọc KeyboardAvoidingView. */
  keyboardInsets?: boolean
}

export function Screen({
  children,
  scroll = false,
  edges = ['top'],
  padded = false,
  contentStyle,
  refreshing,
  onRefresh,
  keyboardInsets = true,
}: ScreenProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  // Neo spotlight nằm trong màn cuộn được tour host cuộn vào tầm nhìn trước khi
  // chiếu sáng — host lấy ScrollView qua context này (components/guide).
  const scrollRef = useRef<ScrollView | null>(null)

  // Chỉ đặt inset cho cạnh ĐƯỢC chọn (05/09: cạnh bị loại ghi `paddingLeft: 0` từng vô hiệu
  // `paddingHorizontal` của màn `edges={[]}`), và CỘNG với đệm của màn thay vì để `contentStyle` đè
  // mất inset (20/11: nút back Chứng nhận nằm dưới thanh trạng thái) — xem `lib/screenInset`.
  // Đặt SAU `pad` và `contentStyle` trong mảng style.
  const pad: ViewStyle = padded ? { paddingHorizontal: space[5] } : {}
  const inset = insetPadding(edges, insets, [pad, contentStyle] as never) as ViewStyle

  if (scroll) {
    return (
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: theme.colors.bg }}
        contentContainerStyle={[pad, contentStyle, inset]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // iOS: tự chừa chỗ cho bàn phím để ô nhập cuối màn (ô Viết, ghi chú) không bị che.
        // Màn nào đã tự bọc KeyboardAvoidingView thì tắt bằng keyboardInsets={false}.
        automaticallyAdjustKeyboardInsets={keyboardInsets}
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
    <View style={[{ flex: 1, backgroundColor: theme.colors.bg }, pad, contentStyle, inset]}>
      {children}
    </View>
  )
}
