// Yellow-square motif (Galerie v2) — the brand mark's signature accent, used as
// a bullet/leading glyph on buttons, headings and list rows. Sharp by definition.

import { View, type ViewStyle, type StyleProp } from 'react-native'
import { useTheme } from '@/lib/theme'

interface YellowSquareProps {
  size?: number
  /** Defaults to the brand accent (yellow). */
  color?: string
  style?: StyleProp<ViewStyle>
}

export function YellowSquare({ size = 7, color, style }: YellowSquareProps) {
  const c = useTheme().colors
  return <View style={[{ width: size, height: size, backgroundColor: color ?? c.accent }, style]} />
}
