// Compact editorial status/label chip (Galerie v2): sharp corners, UPPERCASE,
// letter-spaced. `tone` maps to a semantic colour; `solid` fills instead of soft.

import type { LucideIcon } from 'lucide-react-native'
import { View, Text, type ViewStyle, type StyleProp } from 'react-native'
import { fonts, radius, space, useTheme } from '@/lib/theme'

type Tone = 'neutral' | 'accent' | 'success' | 'danger' | 'info' | 'der' | 'die' | 'das'

interface PillProps {
  label: string
  tone?: Tone
  icon?: LucideIcon
  /** Fill the chip with the tone colour instead of the soft tint. */
  solid?: boolean
  style?: StyleProp<ViewStyle>
}

export function Pill({ label, tone = 'neutral', icon, solid = false, style }: PillProps) {
  const c = useTheme().colors

  const toneMap: Record<Tone, { soft: string; fg: string; fill: string }> = {
    neutral: { soft: c.surfaceSunken, fg: c.textSecondary, fill: c.textSecondary },
    accent: { soft: c.accentSoft, fg: c.accentText, fill: c.accent },
    success: { soft: c.successSoft, fg: c.success, fill: c.success },
    danger: { soft: c.dangerSoft, fg: c.danger, fill: c.danger },
    info: { soft: c.infoSoft, fg: c.info, fill: c.info },
    der: { soft: c.infoSoft, fg: c.der, fill: c.der },
    die: { soft: c.dangerSoft, fg: c.die, fill: c.die },
    das: { soft: c.successSoft, fg: c.das, fill: c.das },
  }

  const picked = toneMap[tone]
  const bg = solid ? picked.fill : picked.soft
  // On a solid fill, yellow needs ink for AA; everything else takes white.
  const fg = solid ? (tone === 'accent' ? c.onAccent : c.onBrand) : picked.fg

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[1],
          backgroundColor: bg,
          borderRadius: radius.sm,
          paddingHorizontal: space[2],
          paddingVertical: 5,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      {icon ? <LeadingIcon icon={icon} color={fg} /> : null}
      <Text
        style={{
          fontFamily: fonts.bodySemi,
          fontSize: 10,
          lineHeight: 12,
          letterSpacing: 0.9,
          textTransform: 'uppercase',
          color: fg,
        }}
      >
        {label}
      </Text>
    </View>
  )
}

function LeadingIcon({ icon, color }: { icon: LucideIcon; color: string }) {
  const Lucide = icon
  return <Lucide size={12} color={color} strokeWidth={2.5} />
}
