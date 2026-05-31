// Compact status/label chip. `tone` maps to a semantic soft-background pair.

import type { LucideIcon } from 'lucide-react-native'
import { View, type ViewStyle, type StyleProp } from 'react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { ThemedText } from './ThemedText'

type Tone = 'neutral' | 'accent' | 'success' | 'danger' | 'info' | 'der' | 'die' | 'das'

interface PillProps {
  label: string
  tone?: Tone
  icon?: LucideIcon
  style?: StyleProp<ViewStyle>
}

export function Pill({ label, tone = 'neutral', icon, style }: PillProps) {
  const theme = useTheme()
  const c = theme.colors

  const toneMap: Record<Tone, { bg: string; fg: string }> = {
    neutral: { bg: c.surfaceSunken, fg: c.textSecondary },
    accent: { bg: c.accentSoft, fg: c.accentText },
    success: { bg: c.successSoft, fg: c.success },
    danger: { bg: c.dangerSoft, fg: c.danger },
    info: { bg: c.infoSoft, fg: c.info },
    der: { bg: c.infoSoft, fg: c.der },
    die: { bg: c.dangerSoft, fg: c.die },
    das: { bg: c.successSoft, fg: c.das },
  }

  const picked = toneMap[tone]

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[1],
          backgroundColor: picked.bg,
          borderRadius: radius.full,
          paddingHorizontal: space[3],
          paddingVertical: space[1],
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      {icon ? <LeadingIcon icon={icon} color={picked.fg} /> : null}
      <ThemedText variant="label" style={{ color: picked.fg }}>
        {label}
      </ThemedText>
    </View>
  )
}

function LeadingIcon({ icon, color }: { icon: LucideIcon; color: string }) {
  const Lucide = icon
  return <Lucide size={12} color={color} strokeWidth={2.5} />
}
