// Empty state: framed icon, title, supporting line, optional action. Used when
// a list/section has no data — distinct from an error.

import type { LucideIcon } from 'lucide-react-native'
import { View } from 'react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Button } from './Button'
import { Icon } from './Icon'
import { ThemedText } from './ThemedText'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  message?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme()

  return (
    <View style={{ alignItems: 'center', paddingVertical: space[10], paddingHorizontal: space[6], gap: space[3] }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: radius['2xl'],
          backgroundColor: theme.colors.surfaceSunken,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon icon={icon} size={28} color="muted" />
      </View>
      <ThemedText variant="title" align="center">
        {title}
      </ThemedText>
      {message ? (
        <ThemedText variant="body" color="secondary" align="center">
          {message}
        </ThemedText>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" fullWidth={false} style={{ marginTop: space[2] }} />
      ) : null}
    </View>
  )
}
