// Themed screen container. Fills the background, applies safe-area insets, and
// optionally scrolls. Edges are configurable so headers/tab bars can opt out.

import type { ReactNode } from 'react'
import { RefreshControl, ScrollView, View, type ViewStyle, type StyleProp } from 'react-native'
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context'
import { space, useTheme } from '@/lib/theme'

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

  const inset: ViewStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  }

  const pad: ViewStyle = padded ? { paddingHorizontal: space[5] } : {}

  if (scroll) {
    return (
      <ScrollView
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
        {children}
      </ScrollView>
    )
  }

  return (
    <View style={[{ flex: 1, backgroundColor: theme.colors.bg }, inset, pad, contentStyle]}>
      {children}
    </View>
  )
}
