// Number-forward stat. The value uses the mono scale for tabular weight; the
// label sits quietly beneath. Optional leading icon in a soft chip.

import type { LucideIcon } from 'lucide-react-native'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Icon } from './Icon'
import { ThemedText } from './ThemedText'

type Accent = 'accent' | 'success' | 'danger' | 'info'

interface StatTileProps {
  value: string
  label: string
  icon?: LucideIcon
  accent?: Accent
  style?: StyleProp<ViewStyle>
}

export function StatTile({ value, label, icon, accent = 'accent', style }: StatTileProps) {
  const theme = useTheme()
  const c = theme.colors

  const softMap: Record<Accent, string> = {
    accent: c.accentSoft,
    success: c.successSoft,
    danger: c.dangerSoft,
    info: c.infoSoft,
  }

  return (
    <View style={[{ gap: space[2] }, style]}>
      {icon ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.md,
            backgroundColor: softMap[accent],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon icon={icon} size={18} color={accent} />
        </View>
      ) : null}
      <ThemedText variant="monoLg">{value}</ThemedText>
      <ThemedText variant="caption" color="muted">
        {label}
      </ThemedText>
    </View>
  )
}
