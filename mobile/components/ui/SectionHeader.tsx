// Section title with an optional trailing action. Eyebrow is opt-in and used
// sparingly — most sections just need a clear title.

import { Pressable, View } from 'react-native'
import { space } from '@/lib/theme'
import { ThemedText } from './ThemedText'

interface SectionHeaderProps {
  title: string
  eyebrow?: string
  actionLabel?: string
  onAction?: () => void
}

export function SectionHeader({ title, eyebrow, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: space[3],
      }}
    >
      <View style={{ flex: 1, gap: space[1] }}>
        {eyebrow ? (
          <ThemedText variant="label" color="accent">
            {eyebrow}
          </ThemedText>
        ) : null}
        <ThemedText variant="titleLg">{title}</ThemedText>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <ThemedText variant="bodyStrong" color="accent">
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  )
}
