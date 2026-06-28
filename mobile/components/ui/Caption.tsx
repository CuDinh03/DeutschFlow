// Editorial overline / caption (Galerie v2): small, UPPERCASE, wide letter-spacing.
// Used above section titles and as eyebrow labels across the student screens.

import type { ReactNode } from 'react'
import { Text, type TextStyle, type StyleProp } from 'react-native'
import { fonts, useTheme } from '@/lib/theme'

interface CaptionProps {
  children: ReactNode
  /** Override the default muted colour (e.g. accentText for an emphasised eyebrow). */
  color?: string
  style?: StyleProp<TextStyle>
}

export function Caption({ children, color, style }: CaptionProps) {
  const c = useTheme().colors
  return (
    <Text
      style={[
        {
          fontFamily: fonts.bodySemi,
          fontSize: 10.5,
          lineHeight: 14,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          color: color ?? c.textSecondary,
        },
        style,
      ]}
    >
      {children}
    </Text>
  )
}
