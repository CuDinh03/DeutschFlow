// Screen header. Optional back button, a title (with optional subtitle), and a
// right-hand actions slot. Sits below the safe-area inset, not inside it.

import { ChevronLeft } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { space } from '@/lib/theme'
import { Icon } from './Icon'
import { ThemedText } from './ThemedText'

interface AppHeaderProps {
  title?: string
  subtitle?: string
  onBack?: () => void
  right?: ReactNode
}

export function AppHeader({ title, subtitle, onBack, right }: AppHeaderProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        paddingHorizontal: space[5],
        paddingVertical: space[3],
      }}
    >
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={() => {
            void Haptics.selectionAsync()
            onBack()
          }}
          hitSlop={10}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            marginLeft: -10,
            marginRight: -space[1],
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Icon icon={ChevronLeft} size={26} color="primary" />
        </Pressable>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <ThemedText variant="titleLg">{title}</ThemedText> : null}
        {subtitle ? (
          <ThemedText variant="caption" color="muted">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right ?? null}
    </View>
  )
}
