// Pressable list row: leading icon chip, title/subtitle stack, trailing slot
// (defaults to a chevron when pressable). Subtle press feedback via opacity.

import { ChevronRight } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { radius, space, useTheme } from '@/lib/theme'
import { Icon } from './Icon'
import { ThemedText } from './ThemedText'

type IconTone = 'accent' | 'success' | 'danger' | 'info' | 'neutral'

interface ListRowProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  iconTone?: IconTone
  trailing?: ReactNode
  onPress?: () => void
  showChevron?: boolean
}

export function ListRow({
  title,
  subtitle,
  icon,
  iconTone = 'neutral',
  trailing,
  onPress,
  showChevron = true,
}: ListRowProps) {
  const theme = useTheme()
  const c = theme.colors

  const toneBg: Record<IconTone, string> = {
    accent: c.accentSoft,
    success: c.successSoft,
    danger: c.dangerSoft,
    info: c.infoSoft,
    neutral: c.surfaceSunken,
  }
  const toneFg: Record<IconTone, 'accent' | 'success' | 'danger' | 'info' | 'secondary'> = {
    accent: 'accent',
    success: 'success',
    danger: 'danger',
    info: 'info',
    neutral: 'secondary',
  }

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        paddingVertical: space[3],
      }}
    >
      {icon ? (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            backgroundColor: toneBg[iconTone],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon icon={icon} size={20} color={toneFg[iconTone]} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText variant="bodyStrong">{title}</ThemedText>
        {subtitle ? (
          <ThemedText variant="caption" color="muted">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {trailing ?? (onPress && showChevron ? <Icon icon={ChevronRight} size={20} color="faint" /> : null)}
    </View>
  )

  if (!onPress) return content

  const handlePress = () => {
    void Haptics.selectionAsync()
    onPress()
  }

  // The default label is the row's own title (+ subtitle), so every pressable ListRow gets a
  // sensible VoiceOver/TalkBack announcement without each call site having to pass it.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={handlePress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {content}
    </Pressable>
  )
}
