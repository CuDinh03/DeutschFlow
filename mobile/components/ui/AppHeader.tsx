// Screen header. Optional back button, a title (with optional subtitle), and a
// right-hand actions slot. Sits below the safe-area inset, not inside it.

import { ChevronLeft } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { radius, space, useTheme } from '@/lib/theme'
import { Icon } from './Icon'
import { ThemedText } from './ThemedText'

interface AppHeaderProps {
  title?: string
  subtitle?: string
  onBack?: () => void
  right?: ReactNode
}

export function AppHeader({ title, subtitle, onBack, right }: AppHeaderProps) {
  const theme = useTheme()

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
          onPress={() => {
            void Haptics.selectionAsync()
            onBack()
          }}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: radius.md,
            backgroundColor: theme.colors.surfaceSunken,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon icon={ChevronLeft} size={22} color="primary" />
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
